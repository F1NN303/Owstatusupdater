export interface ServiceBrandAsset {
  assetPath: string;
  label: string;
  containerClassName?: string;
}

const BRAND_ASSETS: Record<string, ServiceBrandAsset> = {
  overwatch: {
    assetPath: "brands/overwatch.svg",
    label: "Overwatch",
  },
  sony: {
    assetPath: "brands/sony-psn.svg",
    label: "PlayStation",
  },
  m365: {
    assetPath: "brands/m365.svg",
    label: "Microsoft 365",
  },
  openai: {
    assetPath: "brands/openai.svg",
    label: "OpenAI / ChatGPT",
  },
  claude: {
    assetPath: "brands/claude.svg",
    label: "Claude / Anthropic",
  },
  steam: {
    assetPath: "brands/steam.svg",
    label: "Steam",
    containerClassName: "bg-white/90",
  },
};

const SERVICE_ALIASES: Record<string, string> = {
  ow: "overwatch",
  psn: "sony",
  playstation: "sony",
  "playstation-network": "sony",
  microsoft365: "m365",
  office365: "m365",
  "microsoft-365": "m365",
  chatgpt: "openai",
  "open-ai": "openai",
  anthropic: "claude",
  "claude-ai": "claude",
  valve: "steam",
  "steam-platform": "steam",
};

function normalizeServiceId(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  return SERVICE_ALIASES[raw] || raw;
}

export function resolveServiceBrandAsset(serviceId?: string | null): ServiceBrandAsset | null {
  const normalized = normalizeServiceId(serviceId);
  if (!normalized) {
    return null;
  }
  return BRAND_ASSETS[normalized] || null;
}

export function buildPublicAssetUrl(assetPath: string) {
  const baseUrl = String(import.meta.env.BASE_URL || "/");
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedAssetPath = String(assetPath || "").replace(/^\/+/, "");
  return `${normalizedBase}${normalizedAssetPath}`;
}
