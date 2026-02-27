import { resolveLegacyUrl } from "@/lib/legacySite";

export interface ServiceManifestEntry {
  id: string;
  label: string;
  name: string;
  detailPath: string;
  statusPath: string;
  legacyHref?: string;
  note?: string;
  iconName?: string;
  category: string;
  priority: number;
  tags: string[];
  aliases: string[];
}

interface RawServiceManifestEntry {
  id?: unknown;
  label?: unknown;
  name?: unknown;
  detail_path?: unknown;
  detailPath?: unknown;
  status_path?: unknown;
  statusPath?: unknown;
  legacy_href?: unknown;
  legacyHref?: unknown;
  note?: unknown;
  icon?: unknown;
  iconName?: unknown;
  category?: unknown;
  priority?: unknown;
  tags?: unknown;
  aliases?: unknown;
}

interface RawServiceManifestPayload {
  services?: unknown;
}

const FALLBACK_SERVICE_MANIFEST: ServiceManifestEntry[] = [
  {
    id: "overwatch",
    label: "Overwatch",
    name: "Overwatch",
    detailPath: "/status/overwatch",
    statusPath: "/data/status.json",
    legacyHref: "/legacy-overwatch.html",
    note: "Full live dashboard with incidents, analytics, and status summary.",
    iconName: "Gamepad2",
    category: "gaming",
    priority: 100,
    tags: ["overwatch", "blizzard", "battle-net", "fps"],
    aliases: ["overwatch", "ow"],
  },
  {
    id: "sony",
    label: "Sony",
    name: "Sony PSN",
    detailPath: "/status/sony",
    statusPath: "/sony/data/status.json",
    legacyHref: "/sony/legacy-index.html",
    note: "PlayStation Network live signals, service trend, and incident data.",
    iconName: "Tv",
    category: "gaming",
    priority: 110,
    tags: ["sony", "psn", "playstation", "console"],
    aliases: ["sony", "psn", "playstation", "playstation-network"],
  },
  {
    id: "m365",
    label: "Microsoft 365",
    name: "Microsoft 365",
    detailPath: "/status/m365",
    statusPath: "/m365/data/status.json",
    legacyHref: "/m365/",
    note: "Microsoft 365 live service health signals with official and provider sources.",
    iconName: "Globe",
    category: "productivity",
    priority: 200,
    tags: ["microsoft", "office", "collaboration", "enterprise"],
    aliases: ["m365", "microsoft365", "office365", "microsoft-365"],
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    name: "OpenAI / ChatGPT",
    detailPath: "/status/openai",
    statusPath: "/openai/data/status.json",
    legacyHref: "/openai/",
    note: "OpenAI and ChatGPT live status signals with official Statuspage API and provider corroboration.",
    iconName: "Cpu",
    category: "ai",
    priority: 210,
    tags: ["openai", "chatgpt", "api", "ai"],
    aliases: ["openai", "chatgpt", "open-ai"],
  },
  {
    id: "steam",
    label: "Steam",
    name: "Steam",
    detailPath: "/status/steam",
    statusPath: "/steam/data/status.json",
    legacyHref: "/steam/",
    note: "Steam live status synthesized from official Valve API probes and provider corroboration.",
    iconName: "Flame",
    category: "gaming",
    priority: 120,
    tags: ["steam", "valve", "pc", "gaming"],
    aliases: ["steam", "valve", "steam-platform"],
  },
];

let manifestCache: ServiceManifestEntry[] | null = null;
let manifestInFlight: Promise<ServiceManifestEntry[]> | null = null;

function normalizePath(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    return fallback;
  }
  return text.startsWith("/") ? text : `/${text}`;
}

function normalizeAliases(rawAliases: unknown, serviceId: string) {
  const candidates: string[] = [];
  if (Array.isArray(rawAliases)) {
    for (const item of rawAliases) {
      const alias = String(item ?? "").trim().toLowerCase();
      if (alias) {
        candidates.push(alias);
      }
    }
  } else if (typeof rawAliases === "string") {
    for (const item of rawAliases.split(",")) {
      const alias = item.trim().toLowerCase();
      if (alias) {
        candidates.push(alias);
      }
    }
  }
  if (!candidates.includes(serviceId)) {
    candidates.unshift(serviceId);
  }
  return Array.from(new Set(candidates));
}

function normalizeTags(rawTags: unknown) {
  const candidates: string[] = [];
  if (Array.isArray(rawTags)) {
    for (const item of rawTags) {
      const tag = String(item ?? "").trim().toLowerCase();
      if (tag) {
        candidates.push(tag);
      }
    }
  } else if (typeof rawTags === "string") {
    for (const item of rawTags.split(",")) {
      const tag = item.trim().toLowerCase();
      if (tag) {
        candidates.push(tag);
      }
    }
  }
  return Array.from(new Set(candidates));
}

function normalizePriority(rawPriority: unknown, fallback: number) {
  const parsed = Number.parseInt(String(rawPriority ?? "").trim(), 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function normalizeManifestEntry(entry: RawServiceManifestEntry): ServiceManifestEntry | null {
  const id = String(entry.id ?? "").trim().toLowerCase();
  if (!id) {
    return null;
  }
  const label = String(entry.label ?? id).trim() || id;
  const name = String(entry.name ?? label).trim() || label;
  const detailPath = normalizePath(entry.detail_path ?? entry.detailPath, `/status/${id}`);
  const statusPath = normalizePath(entry.status_path ?? entry.statusPath, "/data/status.json");
  const legacyHrefRaw = String(entry.legacy_href ?? entry.legacyHref ?? "").trim();
  const noteRaw = String(entry.note ?? "").trim();
  const iconRaw = String(entry.icon ?? entry.iconName ?? "").trim();
  const categoryRaw = String(entry.category ?? "").trim().toLowerCase();
  const category = categoryRaw || "general";
  const priority = normalizePriority(entry.priority, 1000);

  return {
    id,
    label,
    name,
    detailPath,
    statusPath,
    legacyHref: legacyHrefRaw || undefined,
    note: noteRaw || undefined,
    iconName: iconRaw || undefined,
    category,
    priority,
    tags: normalizeTags(entry.tags),
    aliases: normalizeAliases(entry.aliases, id),
  };
}

function parseManifestPayload(payload: unknown): ServiceManifestEntry[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const raw = payload as RawServiceManifestPayload;
  if (!Array.isArray(raw.services)) {
    return [];
  }

  const entries: ServiceManifestEntry[] = [];
  const seenIds = new Set<string>();
  for (const item of raw.services) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const normalized = normalizeManifestEntry(item as RawServiceManifestEntry);
    if (!normalized || seenIds.has(normalized.id)) {
      continue;
    }
    seenIds.add(normalized.id);
    entries.push(normalized);
  }
  return entries;
}

export function getFallbackServiceManifestEntries(): ServiceManifestEntry[] {
  return FALLBACK_SERVICE_MANIFEST.map((entry) => ({
    ...entry,
    tags: [...entry.tags],
    aliases: [...entry.aliases],
  }));
}

export async function fetchServiceManifestEntries(forceRefresh = false): Promise<ServiceManifestEntry[]> {
  if (!forceRefresh && manifestCache) {
    return manifestCache;
  }
  if (!forceRefresh && manifestInFlight) {
    return manifestInFlight;
  }

  manifestInFlight = (async () => {
    try {
      const response = await fetch(`${resolveLegacyUrl("/data/services-manifest.json")}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as RawServiceManifestPayload;
      const parsed = parseManifestPayload(payload);
      manifestCache = parsed.length > 0 ? parsed : getFallbackServiceManifestEntries();
      return manifestCache;
    } catch {
      manifestCache = getFallbackServiceManifestEntries();
      return manifestCache;
    } finally {
      manifestInFlight = null;
    }
  })();

  return manifestInFlight;
}

export function resolveManifestServiceId(
  id: string,
  entries: ServiceManifestEntry[]
): string | null {
  const normalized = String(id || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const entry of entries) {
    if (entry.id === normalized) {
      return entry.id;
    }
    if (entry.aliases.includes(normalized)) {
      return entry.id;
    }
  }
  return null;
}

