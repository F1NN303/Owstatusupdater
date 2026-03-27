export const ROUTE_REDIRECT_STORAGE_KEY = "owstatusupdater.routeRedirect";
export const CHUNK_RECOVERY_STORAGE_KEY = "owstatusupdater.chunkRecovery";
const CHUNK_RECOVERY_WINDOW_MS = 60_000;

interface ChunkRecoveryAttempt {
  target: string;
  attemptedAt: number;
}

function normalizeBasePath(baseUrl?: string) {
  const raw = String(baseUrl || "").trim();
  if (!raw || raw === "/") {
    return "";
  }
  const next = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return next === "/" ? "" : next;
}

function normalizeRecoveredPath(path: string) {
  const trimmed = String(path || "").trim();
  if (!trimmed) {
    return null;
  }
  if (/^[a-z]+:/i.test(trimmed)) {
    return null;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function currentTargetPath(win: Window) {
  return `${win.location.pathname}${win.location.search}${win.location.hash}`;
}

function readChunkRecoveryAttempt(win: Window): ChunkRecoveryAttempt | null {
  try {
    const raw = String(win.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY) || "").trim();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ChunkRecoveryAttempt>;
    const target = normalizeRecoveredPath(String(parsed.target || ""));
    const attemptedAt = Number(parsed.attemptedAt);
    if (!target || !Number.isFinite(attemptedAt) || attemptedAt <= 0) {
      return null;
    }

    return {
      target,
      attemptedAt,
    };
  } catch {
    return null;
  }
}

function writeChunkRecoveryAttempt(win: Window, attempt: ChunkRecoveryAttempt) {
  try {
    win.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // Ignore storage access failures and still attempt recovery.
  }
}

function registrationMatchesBasePath(scope: string, basePath: string) {
  if (!basePath) {
    return true;
  }

  try {
    const scopePath = new URL(scope).pathname || "/";
    return scopePath.startsWith(basePath);
  } catch {
    return false;
  }
}

async function unregisterServiceWorkers(win: Window, baseUrl?: string) {
  if (!("serviceWorker" in win.navigator)) {
    return;
  }

  const basePath = normalizeBasePath(baseUrl);

  try {
    const registrations = await win.navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => registrationMatchesBasePath(registration.scope, basePath))
        .map((registration) => registration.unregister())
    );
  } catch {
    // Ignore service-worker cleanup failures and still attempt a reload.
  }
}

async function deleteOwstatusCaches(win: Window) {
  if (!("caches" in win)) {
    return;
  }

  try {
    const keys = await win.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("owstatus-"))
        .map((key) => win.caches.delete(key))
    );
  } catch {
    // Ignore cache cleanup failures and still attempt a reload.
  }
}

export function isRecoverableChunkLoadError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String((error as { message?: unknown } | null)?.message || "");

  if (!message) {
    return false;
  }

  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk [^ ]+ failed/i.test(
    message
  );
}

export async function recoverFailedRouteChunk(win: Window, baseUrl?: string) {
  const attemptTarget = normalizeRecoveredPath(currentTargetPath(win));
  if (!attemptTarget) {
    return false;
  }

  const previousAttempt = readChunkRecoveryAttempt(win);
  const now = Date.now();
  if (
    previousAttempt &&
    previousAttempt.target === attemptTarget &&
    now - previousAttempt.attemptedAt < CHUNK_RECOVERY_WINDOW_MS
  ) {
    return false;
  }

  writeChunkRecoveryAttempt(win, {
    target: attemptTarget,
    attemptedAt: now,
  });

  await Promise.all([
    unregisterServiceWorkers(win, baseUrl),
    deleteOwstatusCaches(win),
  ]);

  win.location.reload();
  return true;
}

export function installChunkLoadRecovery(win: Window, baseUrl?: string) {
  let recoveryStarted = false;

  const triggerRecovery = (error: unknown) => {
    if (recoveryStarted || !isRecoverableChunkLoadError(error)) {
      return;
    }

    recoveryStarted = true;
    void recoverFailedRouteChunk(win, baseUrl).then((didRecover) => {
      if (!didRecover) {
        recoveryStarted = false;
      }
    });
  };

  win.addEventListener("error", (event) => {
    triggerRecovery(event.error || event.message);
  });

  win.addEventListener("unhandledrejection", (event) => {
    triggerRecovery(event.reason);
  });
}

export function recoverAppRoute(win: Window, baseUrl?: string) {
  const basePath = normalizeBasePath(baseUrl);
  const location = win.location;
  const history = win.history;

  let redirectTarget: string | null = null;
  try {
    redirectTarget = normalizeRecoveredPath(
      win.sessionStorage.getItem(ROUTE_REDIRECT_STORAGE_KEY) || ""
    );
  } catch {
    redirectTarget = null;
  }
  if (redirectTarget) {
    try {
      win.sessionStorage.removeItem(ROUTE_REDIRECT_STORAGE_KEY);
    } catch {
      // Ignore storage access failures and still recover the route.
    }
    history.replaceState(null, "", redirectTarget);
    return true;
  }

  const hash = String(location.hash || "");
  if (hash.startsWith("#/")) {
    const recovered = normalizeRecoveredPath(hash.slice(1));
    if (recovered) {
      history.replaceState(null, "", `${basePath}${recovered}`);
      return true;
    }
  }

  return false;
}
