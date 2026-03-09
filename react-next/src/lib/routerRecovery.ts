export const ROUTE_REDIRECT_STORAGE_KEY = "owstatusupdater.routeRedirect";

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
