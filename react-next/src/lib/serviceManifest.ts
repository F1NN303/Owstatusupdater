import { fetchCachedJson } from "@/lib/cachedJson";
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

interface FallbackServiceSeed {
  id: string;
  label: string;
  name?: string;
  aliases?: string[];
  iconName?: string;
  category?: string;
  legacyHref?: string;
}

const FALLBACK_GENERIC_NOTE = "Live service status and incident summary.";

// Keep the fallback intentionally thin so the generated manifest remains the detailed source of truth.
const FALLBACK_SERVICE_SEEDS: FallbackServiceSeed[] = [
  { id: "overwatch", label: "Overwatch", aliases: ["ow"], iconName: "Gamepad2", category: "gaming" },
  {
    id: "sony",
    label: "Sony",
    name: "Sony PSN",
    aliases: ["psn", "playstation", "playstation-network"],
    iconName: "Tv",
    category: "gaming",
    legacyHref: "/sony/legacy-index.html",
  },
  {
    id: "m365",
    label: "Microsoft 365",
    aliases: ["microsoft365", "office365", "microsoft-365"],
    category: "productivity",
  },
  {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    name: "OpenAI / ChatGPT",
    aliases: ["chatgpt", "open-ai"],
    iconName: "Cpu",
    category: "ai",
  },
  {
    id: "claude",
    label: "Claude (Anthropic)",
    name: "Claude / Anthropic",
    aliases: ["anthropic", "claude-ai"],
    iconName: "Cpu",
    category: "ai",
  },
  {
    id: "discord",
    label: "Discord",
    aliases: ["discordapp", "discord-status"],
    category: "notifications",
  },
  {
    id: "slack",
    label: "Slack",
    aliases: ["slack-status", "slackapp"],
    category: "productivity",
  },
  {
    id: "reddit",
    label: "Reddit",
    aliases: ["reddit-status", "redditstatus"],
    category: "social",
  },
  {
    id: "x",
    label: "X (Twitter)",
    name: "X / Twitter",
    aliases: ["twitter", "x-twitter"],
    category: "social",
  },
  {
    id: "github",
    label: "GitHub",
    aliases: ["github-status", "githubstatus"],
    category: "developer",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    aliases: ["cloudflare-status", "cf"],
    category: "infrastructure",
  },
  {
    id: "epic",
    label: "Epic Games",
    aliases: ["epic-games", "epicgames"],
    iconName: "Gamepad2",
    category: "gaming",
  },
  {
    id: "steam",
    label: "Steam",
    aliases: ["valve", "steam-platform"],
    iconName: "Flame",
    category: "gaming",
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

function tokenizeFallbackText(...values: Array<string | undefined>) {
  const tokens: string[] = [];
  for (const value of values) {
    const matches = String(value ?? "")
      .toLowerCase()
      .match(/[a-z0-9]+(?:-[a-z0-9]+)*/g);
    if (!matches) {
      continue;
    }
    tokens.push(...matches);
  }
  return Array.from(new Set(tokens));
}

function buildFallbackServiceManifestEntries(): ServiceManifestEntry[] {
  return FALLBACK_SERVICE_SEEDS.map((seed, index) => {
    const id = String(seed.id).trim().toLowerCase();
    const label = String(seed.label).trim() || id;
    const name = String(seed.name ?? label).trim() || label;
    const aliases = normalizeAliases(seed.aliases ?? [], id);
    const category = String(seed.category ?? "general").trim().toLowerCase() || "general";
    const priority = (index + 1) * 10;

    return {
      id,
      label,
      name,
      detailPath: `/status/${id}`,
      statusPath: `/${id}/data/status.json`,
      legacyHref: String(seed.legacyHref ?? `/${id}/`).trim() || `/${id}/`,
      note: FALLBACK_GENERIC_NOTE,
      iconName: String(seed.iconName ?? "Globe").trim() || "Globe",
      category,
      priority,
      tags: tokenizeFallbackText(label, name, category, ...aliases),
      aliases,
    };
  });
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
  return buildFallbackServiceManifestEntries();
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
      const result = await fetchCachedJson(
        "services-manifest",
        `${resolveLegacyUrl("/data/services-manifest.json")}?t=${Date.now()}`,
        {
          requestInit: { cache: "no-store" },
          sanitize: parseManifestPayload,
        }
      );
      const parsed = result.data;
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

