import { resolveLegacyUrl } from "@/lib/legacySite";
import {
  HOME_SERVICES,
  legacySeverityToTone,
  normalizeLegacySeverity,
  type LegacyHomeServiceConfig,
  type LegacySeverity,
  type LegacyTone,
} from "@/lib/legacyStatus";

export type LegacyDetailServiceId = "overwatch" | "sony";

export interface LegacyLinkItem {
  title?: string;
  url?: string;
  published_at?: string | null;
  source?: string | null;
  meta?: string | null;
}

export interface LegacyOutageIncident {
  title?: string;
  started_at?: string | null;
  duration?: string | null;
  acknowledgement?: string | null;
}

export interface LegacyTopReportedIssue {
  label?: string | null;
  count?: number | null;
}

export interface LegacyTopReportedIssuesMeta {
  source?: string | null;
  kind?: string | null;
  mode?: string | null;
  window_hours?: number | null;
}

export interface LegacySourceHealth {
  name?: string;
  kind?: string;
  url?: string;
  ok?: boolean;
  error?: string | null;
  item_count?: number | null;
  last_item_at?: string | null;
  freshness?: string | null;
  age_minutes?: number | null;
  duration_ms?: number | null;
  fetched_at?: string | null;
}

export interface LegacyStatusDetailPayload {
  generated_at?: string;
  health?: string;
  analytics?: {
    severity_key?: string;
    severity_score?: number;
    source_ok_count?: number;
    source_total_count?: number;
    model_version?: string;
    signal_metrics?: {
      reports_24h?: number;
      recent_incidents_6h?: number;
      recent_incidents_24h?: number;
      cross_source?: {
        combined_score?: number;
      };
    };
    safeguards?: Record<string, boolean>;
  };
  regions?: Record<
    string,
    {
      severity_key?: string;
      severity_score?: number;
      report_weight?: number;
    }
  >;
  outage?: {
    source?: string;
    url?: string;
    summary?: string;
    current_status?: string;
    reports_24h?: number;
    incidents?: LegacyOutageIncident[];
    top_reported_issues?: LegacyTopReportedIssue[];
    top_reported_issues_meta?: LegacyTopReportedIssuesMeta;
  };
  official?: {
    summary?: string;
    last_statement_at?: string;
    updates?: LegacyLinkItem[];
  };
  reports?: LegacyLinkItem[];
  news?: LegacyLinkItem[];
  social?: LegacyLinkItem[];
  known_resources?: LegacyLinkItem[];
  sources?: LegacySourceHealth[];
  changes?: {
    summary?: {
      new_incidents?: number;
      updated_incidents?: number;
      resolved_incidents?: number;
      new_reports?: number;
    };
  };
}

export interface LegacyServiceDetailResult {
  service: LegacyHomeServiceConfig & { statusPath: string };
  payload: LegacyStatusDetailPayload;
  severity: LegacySeverity;
  tone: LegacyTone;
  sourceConfidenceText: string;
}

function getDetailServiceConfig(id: LegacyDetailServiceId) {
  const service = HOME_SERVICES.find(
    (item): item is LegacyHomeServiceConfig & { statusPath: string } =>
      item.id === id && typeof item.statusPath === "string"
  );
  return service ?? null;
}

function formatConfidence(payload: LegacyStatusDetailPayload) {
  const ok = payload.analytics?.source_ok_count;
  const total = payload.analytics?.source_total_count;
  if (typeof ok === "number" && typeof total === "number" && total > 0) {
    return `${ok}/${total} sources healthy`;
  }
  return "Source confidence unavailable";
}

export async function fetchLegacyServiceDetail(
  id: LegacyDetailServiceId
): Promise<LegacyServiceDetailResult> {
  const service = getDetailServiceConfig(id);
  if (!service) {
    throw new Error(`Unsupported service id: ${id}`);
  }

  const response = await fetch(`${resolveLegacyUrl(service.statusPath)}?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${service.statusPath}: ${response.status}`);
  }

  const payload = (await response.json()) as LegacyStatusDetailPayload;
  const severity = normalizeLegacySeverity(
    payload.analytics?.severity_key || payload.outage?.current_status || payload.health
  );

  return {
    service,
    payload,
    severity,
    tone: legacySeverityToTone(severity),
    sourceConfidenceText: formatConfidence(payload),
  };
}
