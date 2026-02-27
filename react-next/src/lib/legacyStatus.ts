import { resolveLegacyUrl } from "@/lib/legacySite";
import {
  fetchServiceManifestEntries,
  getFallbackServiceManifestEntries,
  type ServiceManifestEntry,
} from "@/lib/serviceManifest";

export type LegacySeverity = "stable" | "minor" | "degraded" | "major" | "unknown";
export type LegacyTone = "good" | "warn" | "bad" | "unknown";

export interface LegacyHomeServiceConfig {
  id: string;
  name: string;
  href: string;
  legacyHref?: string;
  note: string;
  statusPath?: string;
  iconName?: string;
  category?: string;
  priority?: number;
  tags?: string[];
  aliases?: string[];
}

export interface LegacyServiceSummary {
  service: LegacyHomeServiceConfig;
  severity: LegacySeverity;
  tone: LegacyTone;
  statusLabel: string;
  updatedText: string;
  generatedAt: string | null;
  error: boolean;
}

interface LegacyStatusPayload {
  generated_at?: string;
  severity_key?: string;
  status?: string;
  health?: string;
  analytics?: {
    severity_key?: string;
  };
}

const EMAIL_SERVICE: LegacyHomeServiceConfig = {
  id: "email",
  name: "E-Mail Alerts",
  href: "/email-alerts.html",
  legacyHref: "/email-alerts.html",
  note: "Brevo signup page for outage notifications with captcha and double opt-in.",
  category: "notifications",
  priority: 9000,
  tags: ["email", "alerts"],
};

function mapManifestToLegacyHomeService(entry: ServiceManifestEntry): LegacyHomeServiceConfig {
  return {
    id: entry.id,
    name: entry.name,
    href: entry.detailPath,
    legacyHref: entry.legacyHref,
    note: entry.note || "Live service status and incident summary.",
    statusPath: entry.statusPath,
    iconName: entry.iconName,
    category: entry.category,
    priority: entry.priority,
    tags: entry.tags,
    aliases: entry.aliases,
  };
}

export const HOME_SERVICES: LegacyHomeServiceConfig[] = [
  ...getFallbackServiceManifestEntries().map(mapManifestToLegacyHomeService),
  EMAIL_SERVICE,
];

const SEVERITY_LABELS: Record<LegacySeverity, string> = {
  stable: "Stable",
  minor: "Warning",
  degraded: "Warning",
  major: "Outage",
  unknown: "Unknown",
};

export function normalizeLegacySeverity(value: unknown): LegacySeverity {
  const key = String(value || "").toLowerCase();
  if (key === "stable" || key === "minor" || key === "degraded" || key === "major") {
    return key;
  }
  return "unknown";
}

export function legacySeverityToTone(severity: LegacySeverity): LegacyTone {
  if (severity === "stable") {
    return "good";
  }
  if (severity === "minor" || severity === "degraded") {
    return "warn";
  }
  if (severity === "major") {
    return "bad";
  }
  return "unknown";
}

function getSeverityFromPayload(payload: LegacyStatusPayload): LegacySeverity {
  return normalizeLegacySeverity(
    payload.analytics?.severity_key || payload.severity_key || payload.status || payload.health
  );
}

function formatUpdated(isoString?: string) {
  if (!isoString) {
    return "Updated: unknown";
  }
  const parsed = new Date(isoString);
  if (!Number.isFinite(parsed.getTime())) {
    return "Updated: unknown";
  }
  return `Updated: ${parsed.toLocaleString()}`;
}

export async function getLegacyLiveStatusServices(): Promise<Array<LegacyHomeServiceConfig & { statusPath: string }>> {
  const manifest = await fetchServiceManifestEntries();
  return manifest
    .map(mapManifestToLegacyHomeService)
    .filter((service): service is LegacyHomeServiceConfig & { statusPath: string } => {
      return typeof service.statusPath === "string" && service.statusPath.length > 0;
    });
}

export async function getLegacyHomeServices(): Promise<LegacyHomeServiceConfig[]> {
  const liveServices = await getLegacyLiveStatusServices();
  return [...liveServices, EMAIL_SERVICE];
}

export async function fetchLegacyServiceSummary(
  service: LegacyHomeServiceConfig
): Promise<LegacyServiceSummary> {
  if (!service.statusPath) {
    return {
      service,
      severity: "unknown",
      tone: "unknown",
      statusLabel: "Setup",
      updatedText: "Updated: n/a",
      generatedAt: null,
      error: false,
    };
  }

  try {
    const response = await fetch(`${resolveLegacyUrl(service.statusPath)}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as LegacyStatusPayload;
    const severity = getSeverityFromPayload(payload);
    return {
      service,
      severity,
      tone: legacySeverityToTone(severity),
      statusLabel: SEVERITY_LABELS[severity] ?? SEVERITY_LABELS.unknown,
      updatedText: formatUpdated(payload.generated_at),
      generatedAt: payload.generated_at ?? null,
      error: false,
    };
  } catch {
    return {
      service,
      severity: "unknown",
      tone: "unknown",
      statusLabel: "Unavailable",
      updatedText: "Updated: unknown",
      generatedAt: null,
      error: true,
    };
  }
}

export async function fetchLegacyHomeSummaries() {
  const services = await getLegacyHomeServices();
  return Promise.all(services.map((service) => fetchLegacyServiceSummary(service)));
}

