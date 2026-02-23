const DEV_FALLBACK_ORIGIN = "https://f1nn303.github.io";
const DEV_FALLBACK_BASE_PATH = "/Owstatusupdater";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string) {
  if (!value) {
    return "/";
  }
  return value.startsWith("/") ? value : `/${value}`;
}

function joinPath(basePath: string, path: string) {
  const base = trimTrailingSlash(basePath || "");
  const next = ensureLeadingSlash(path || "/");
  return `${base}${next}` || "/";
}

function inferLegacyBasePathFromBaseUrl() {
  const rawBaseUrl = ((import.meta.env.BASE_URL as string | undefined) || "/").trim();
  if (!rawBaseUrl || rawBaseUrl === "/") {
    return "";
  }

  const normalized = trimTrailingSlash(ensureLeadingSlash(rawBaseUrl));
  if (!normalized || normalized === "/") {
    return "";
  }

  if (normalized.endsWith("/next")) {
    const parent = normalized.slice(0, -"/next".length);
    return parent === "/" ? "" : parent;
  }

  return normalized;
}

export function getLegacyOrigin() {
  const configured = (import.meta.env.VITE_LEGACY_SITE_ORIGIN as string | undefined)?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }
  if (import.meta.env.DEV) {
    return DEV_FALLBACK_ORIGIN;
  }
  return "";
}

export function getLegacyBasePath() {
  const configured = (import.meta.env.VITE_LEGACY_SITE_BASE_PATH as string | undefined)?.trim();
  if (configured && configured !== "/") {
    return trimTrailingSlash(ensureLeadingSlash(configured));
  }

  if (import.meta.env.DEV) {
    return DEV_FALLBACK_BASE_PATH;
  }

  return inferLegacyBasePathFromBaseUrl();
}

export function resolveLegacyUrl(path: string) {
  const origin = getLegacyOrigin();
  const pathname = joinPath(getLegacyBasePath(), path);
  return `${origin}${pathname}`;
}

export function resolveLegacyPath(path: string) {
  return joinPath(getLegacyBasePath(), path);
}
