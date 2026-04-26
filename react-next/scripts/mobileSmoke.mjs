import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const reactDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(reactDir, "..");
const siteDir = path.join(repoRoot, "site");
const previewDir = path.join(siteDir, "next");
const outputDir = path.join(repoRoot, "output", "playwright");
const manifestPath = path.join(siteDir, "data", "services-manifest.json");
const rootIndexPath = path.join(siteDir, "index.html");
const previewIndexPath = path.join(previewDir, "index.html");

const basePath = "/Owstatusupdater";
const previewBasePath = `${basePath}/next`;
const viewportDevice = devices["iPhone 13"];
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function isPathInside(rootDir, targetPath) {
  const rootPosix = `${toPosixPath(path.resolve(rootDir))}/`;
  const targetPosix = toPosixPath(path.resolve(targetPath));
  return targetPosix === rootPosix.slice(0, -1) || targetPosix.startsWith(rootPosix);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureArtifactsExist() {
  const requiredFiles = [rootIndexPath, previewIndexPath, manifestPath];
  for (const targetPath of requiredFiles) {
    if (!(await fileExists(targetPath))) {
      throw new Error(
        `Missing built artifact: ${targetPath}. Run "py -3 scripts/build_react_artifacts.py" from the repo root first.`
      );
    }
  }
}

async function readManifest() {
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const firstService = Array.isArray(manifest?.services)
    ? manifest.services.find(
        (service) =>
          typeof service?.detail_path === "string" &&
          service.detail_path.startsWith("/status/") &&
          typeof service?.name === "string" &&
          service.name.trim().length > 0
      )
    : null;

  if (!firstService) {
    throw new Error(`Could not determine a service detail route from ${manifestPath}`);
  }

  return {
    detailPath: firstService.detail_path,
    id: String(firstService.id || "").trim(),
    name: String(firstService.name || "").trim(),
  };
}

function resolveRequest(pathname) {
  if (pathname === basePath) {
    return { redirectTo: `${basePath}/` };
  }
  if (pathname === previewBasePath) {
    return { redirectTo: `${previewBasePath}/` };
  }

  let mountDir = null;
  let relativePath = "";

  if (pathname.startsWith(`${previewBasePath}/`)) {
    mountDir = previewDir;
    relativePath = pathname.slice(previewBasePath.length + 1);
  } else if (pathname.startsWith(`${basePath}/`)) {
    mountDir = siteDir;
    relativePath = pathname.slice(basePath.length + 1);
  } else {
    return null;
  }

  const normalizedRelativePath = relativePath.replace(/^\/+/, "");
  return { mountDir, relativePath: normalizedRelativePath };
}

async function openFile(requestPath) {
  try {
    return await fs.stat(requestPath);
  } catch {
    return null;
  }
}

async function resolveFilePath(pathname) {
  const target = resolveRequest(pathname);
  if (!target) {
    return { status: 404 };
  }
  if (target.redirectTo) {
    return { status: 302, redirectTo: target.redirectTo };
  }

  const { mountDir, relativePath } = target;
  const requestPath = path.resolve(mountDir, relativePath || "index.html");
  if (!isPathInside(mountDir, requestPath)) {
    return { status: 403 };
  }

  const directStat = await openFile(requestPath);
  if (directStat?.isFile()) {
    return { status: 200, filePath: requestPath };
  }

  if (directStat?.isDirectory()) {
    const nestedIndexPath = path.join(requestPath, "index.html");
    if (await fileExists(nestedIndexPath)) {
      return { status: 200, filePath: nestedIndexPath };
    }
  }

  if (!path.extname(relativePath)) {
    return { status: 200, filePath: path.join(mountDir, "index.html") };
  }

  return { status: 404 };
}

async function startSiteServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const resolved = await resolveFilePath(url.pathname);

      if (resolved.status === 302) {
        response.writeHead(302, { Location: resolved.redirectTo });
        response.end();
        return;
      }

      if (resolved.status !== 200 || !resolved.filePath) {
        response.writeHead(resolved.status || 404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(resolved.status === 403 ? "Forbidden" : "Not Found");
        return;
      }

      const contentType =
        contentTypes.get(path.extname(resolved.filePath).toLowerCase()) || "application/octet-stream";
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
      });
      createReadStream(resolved.filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine local smoke server address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function buildSeedSettings(primaryServiceId) {
  return {
    schemaVersion: 4,
    language: "de",
    reduceMotion: true,
    favorites: primaryServiceId ? [primaryServiceId] : [],
    home: {
      defaultFilter: "all",
      defaultSort: "impact",
      refreshIntervalSec: 60,
      compactCards: false,
      favoritesFirst: true,
    },
    time: {
      displayMode: "both",
    },
    alerts: {
      watchedServiceIds: primaryServiceId ? [primaryServiceId] : [],
      severityThreshold: "major",
    },
    onboarding: {
      homeHintsDismissed: true,
    },
  };
}

function buildChecks(primaryService) {
  const serviceNamePattern = new RegExp(escapeRegex(primaryService.name), "i");
  return [
    {
      fileName: "home-root-mobile.png",
      label: "root home",
      path: `${basePath}/`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: /^(Status Radar|Server Status|Server-Status)$/i }).waitFor({ timeout: 15000 });
        await page.getByText(serviceNamePattern).first().waitFor({ timeout: 15000 });
      },
    },
    {
      fileName: "favorites-root-mobile.png",
      label: "root favorites",
      path: `${basePath}/favorites`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: /^(Favorites|Favoriten)$/i }).waitFor({ timeout: 15000 });
        await page.getByText(serviceNamePattern).first().waitFor({ timeout: 15000 });
      },
    },
    {
      fileName: "detail-root-mobile.png",
      label: "root detail",
      path: `${basePath}${primaryService.detailPath}`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: serviceNamePattern }).waitFor({ timeout: 15000 });
        await page.getByText(/Favorite pinned|Favorit angeheftet|Not favorited|Nicht favorisiert/i).first().waitFor({
          timeout: 15000,
        });
      },
    },
    {
      fileName: "alerts-root-mobile.png",
      label: "root alerts",
      path: `${basePath}/alerts`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: /^(Alerts|Alarme)$/i }).waitFor({ timeout: 15000 });
      },
    },
    {
      fileName: "settings-root-mobile.png",
      label: "root settings",
      path: `${basePath}/settings`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: /^(Settings|Einstellungen)$/i }).waitFor({ timeout: 15000 });
        await page.getByText(/This browser|Dieser Browser|Local storage|Lokaler Speicher/i).first().waitFor({ timeout: 15000 });
      },
    },
    {
      fileName: "home-next-mobile.png",
      label: "preview home",
      path: `${previewBasePath}/`,
      waitFor: async (page) => {
        await page.getByRole("heading", { name: /^(Status Radar|Server Status|Server-Status)$/i }).waitFor({ timeout: 15000 });
        await page.getByText(serviceNamePattern).first().waitFor({ timeout: 15000 });
      },
    },
  ];
}

async function captureRoute({ browser, check, origin, seedSettings }) {
  const context = await browser.newContext({
    ...viewportDevice,
    locale: "de-DE",
    colorScheme: "dark",
  });
  await context.addInitScript(
    ({ settings }) => {
      window.localStorage.setItem("owstatusupdater.react.settings.v2", JSON.stringify(settings));
    },
    { settings: seedSettings }
  );

  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.startsWith(origin)) {
      failedRequests.push(`${request.method()} ${url} -> ${request.failure()?.errorText || "request failed"}`);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(origin) && response.status() >= 400) {
      badResponses.push(`${response.status()} ${url}`);
    }
  });

  const targetUrl = `${origin}${check.path}`;
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  if (!response || !response.ok()) {
    throw new Error(`Navigation failed for ${check.label}: ${response?.status() || "no response"} (${targetUrl})`);
  }

  await check.waitFor(page);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.fonts?.status === "loaded").catch(() => {});
  await page.waitForTimeout(400);

  if (pageErrors.length || failedRequests.length || badResponses.length) {
    throw new Error(
      [
        `Smoke check failed for ${check.label}:`,
        ...pageErrors.map((entry) => `pageerror: ${entry}`),
        ...failedRequests.map((entry) => `requestfailed: ${entry}`),
        ...badResponses.map((entry) => `response: ${entry}`),
      ].join("\n")
    );
  }

  const outputPath = path.join(outputDir, check.fileName);
  await page.screenshot({ path: outputPath, fullPage: false });
  await context.close();

  return outputPath;
}

async function main() {
  await ensureArtifactsExist();
  await fs.mkdir(outputDir, { recursive: true });

  const primaryService = await readManifest();
  const seedSettings = buildSeedSettings(primaryService.id);
  const checks = buildChecks(primaryService);
  const server = await startSiteServer();
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    console.log(`[mobile-smoke] origin: ${server.origin}`);
    console.log(`[mobile-smoke] seeded favorite/alert service: ${primaryService.id || primaryService.name}`);

    for (const check of checks) {
      const outputPath = await captureRoute({ browser, check, origin: server.origin, seedSettings });
      console.log(`[mobile-smoke] OK ${check.label} -> ${outputPath}`);
    }

    console.log("[mobile-smoke] OK: mobile screenshots captured for root + /next routes.");
  } catch (error) {
    if (error instanceof Error && /Executable doesn't exist|browserType\.launch/i.test(error.message)) {
      throw new Error(
        `${error.message}\nInstall Chromium once with "npx playwright install chromium" in react-next/.`
      );
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    await server.close();
  }
}

main().catch((error) => {
  console.error(`[mobile-smoke] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
