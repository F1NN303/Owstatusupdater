export type CachedJsonSource = "network" | "cache";

export interface CachedJsonResult<T> {
  data: T;
  source: CachedJsonSource;
  cachedAt: string | null;
}

interface CachedJsonEnvelope {
  savedAt: string;
  payload: unknown;
}

interface FetchCachedJsonOptions<T> {
  requestInit?: RequestInit;
  sanitize: (raw: unknown) => T;
}

const CACHE_KEY_PREFIX = "owstatusupdater.react.cache";

function buildCacheKey(cacheKey: string) {
  const normalized = String(cacheKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_/-]+/g, "-")
    .slice(0, 160);
  return `${CACHE_KEY_PREFIX}:${normalized || "default"}`;
}

function readCachedEnvelope(cacheKey: string): CachedJsonEnvelope | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(buildCacheKey(cacheKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedJsonEnvelope | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const savedAt = String(parsed.savedAt || "").trim();
    if (!savedAt) {
      return null;
    }
    return {
      savedAt,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}

function writeCachedEnvelope(cacheKey: string, payload: unknown) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const envelope: CachedJsonEnvelope = {
      savedAt: new Date().toISOString(),
      payload,
    };
    window.localStorage.setItem(buildCacheKey(cacheKey), JSON.stringify(envelope));
  } catch {
    // Ignore storage quota or private-mode failures. Live data should still render.
  }
}

export async function fetchCachedJson<T>(
  cacheKey: string,
  url: string,
  options: FetchCachedJsonOptions<T>
): Promise<CachedJsonResult<T>> {
  try {
    const response = await fetch(url, options.requestInit ?? { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const data = options.sanitize(payload);
    writeCachedEnvelope(cacheKey, payload);
    return {
      data,
      source: "network",
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    const cached = readCachedEnvelope(cacheKey);
    if (cached) {
      return {
        data: options.sanitize(cached.payload),
        source: "cache",
        cachedAt: cached.savedAt,
      };
    }
    throw error;
  }
}
