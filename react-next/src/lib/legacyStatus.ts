import { resolveLegacyUrl } from "@/lib/legacySite";

export type LegacySeverity = "stable" | "minor" | "degraded" | "major" | "unknown";
export type LegacyTone = "good" | "warn" | "bad" | "unknown";

export interface LegacyHomeServiceConfig {
  id: "overwatch" | "sony" | "email";
  name: string;
  href: string;
  legacyHref?: string;
  note: string;
  statusPath?: string;
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

export const HOME_SERVICES: LegacyHomeServiceConfig[] = [
  {
    id: "overwatch",
    name: "Overwatch",
    href: "/status/overwatch",
    legacyHref: "/legacy-overwatch.html",
    note: "Full live dashboard with incidents, analytics, and status summary.",
    statusPath: "/data/status.json",
  },
  {
    id: "sony",
    name: "Sony PSN",
    href: "/status/sony",
    legacyHref: "/sony/legacy-index.html",
    note: "PlayStation Network live signals, service trend, and incident data.",
    statusPath: "/sony/data/status.json",
  },
  {
    id: "email",
    name: "E-Mail Alerts",
    href: "/email-alerts.html",
    legacyHref: "/email-alerts.html",
    note: "Brevo signup page for outage notifications with captcha and double opt-in.",
  },
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
  return Promise.all(HOME_SERVICES.map((service) => fetchLegacyServiceSummary(service)));
}
