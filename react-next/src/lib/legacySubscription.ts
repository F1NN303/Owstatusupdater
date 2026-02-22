import { resolveLegacyUrl } from "@/lib/legacySite";

export interface LegacySubscriptionConfig {
  provider?: string;
  form_url?: string;
  allowed_hosts?: string[];
}

export type LegacySubscriptionStatus =
  | "loading"
  | "ready"
  | "missing"
  | "invalid"
  | "error";

export interface LegacySubscriptionLoadResult {
  status: LegacySubscriptionStatus;
  config: LegacySubscriptionConfig | null;
  parsedUrl: URL | null;
  message?: string;
}

export function parseHttpsUrl(value: unknown) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isLikelyEmail(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text.length > 320) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function isAllowedSubscriptionHost(
  parsedUrl: URL | null,
  config: LegacySubscriptionConfig | null
) {
  const host = String(parsedUrl?.hostname || "").toLowerCase();
  if (!host) {
    return false;
  }

  const explicitHosts = Array.isArray(config?.allowed_hosts)
    ? config.allowed_hosts
        .map((item) => String(item || "").toLowerCase().trim())
        .filter(Boolean)
    : [];
  if (explicitHosts.length > 0) {
    return explicitHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  }

  const providerKey = String(config?.provider || "brevo")
    .trim()
    .toLowerCase();
  if (providerKey === "brevo") {
    return host === "sibforms.com" || host.endsWith(".sibforms.com");
  }
  return true;
}

export function providerLabel(providerKey: unknown) {
  const normalized = String(providerKey || "").trim().toLowerCase();
  if (normalized === "brevo") {
    return "Brevo";
  }
  if (!normalized) {
    return "Unknown";
  }
  return normalized.toUpperCase();
}

export async function fetchLegacySubscriptionConfig(): Promise<LegacySubscriptionLoadResult> {
  try {
    const response = await fetch(
      `${resolveLegacyUrl("/data/subscription.json")}?t=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return {
        status: "error",
        config: null,
        parsedUrl: null,
        message: `HTTP ${response.status}`,
      };
    }

    const config = (await response.json()) as LegacySubscriptionConfig;
    const rawUrl = String(config?.form_url || "").trim();

    if (!rawUrl) {
      return {
        status: "missing",
        config,
        parsedUrl: null,
        message: "subscription.json is missing form_url",
      };
    }

    const parsedUrl = parseHttpsUrl(rawUrl);
    if (!parsedUrl) {
      return {
        status: "invalid",
        config,
        parsedUrl: null,
        message: "form_url must be a valid https URL",
      };
    }

    if (!isAllowedSubscriptionHost(parsedUrl, config)) {
      return {
        status: "invalid",
        config,
        parsedUrl: null,
        message: "form_url host is not allowed by allowed_hosts",
      };
    }

    return {
      status: "ready",
      config,
      parsedUrl,
    };
  } catch (error) {
    return {
      status: "error",
      config: null,
      parsedUrl: null,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
