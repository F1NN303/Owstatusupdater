import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

function safeGitSha() {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf-8",
    })
      .trim()
      .slice(0, 40);
  } catch {
    return "";
  }
}

function defaultBuildStamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const defaultBase = mode === "development" ? "/" : "/Owstatusupdater/next/";
  const base = (env.VITE_APP_BASE_PATH || defaultBase).trim() || defaultBase;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const buildStamp = (env.VITE_BUILD_STAMP || env.VITE_BUILD_TIME || defaultBuildStamp()).trim();
  const buildId = (env.VITE_BUILD_ID || env.VITE_GIT_SHA || safeGitSha()).trim();

  return {
    base: normalizedBase,
    define: {
      "import.meta.env.VITE_BUILD_STAMP": JSON.stringify(buildStamp),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildStamp),
      "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
      "import.meta.env.VITE_GIT_SHA": JSON.stringify(buildId),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
