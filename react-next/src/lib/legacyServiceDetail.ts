import { resolveLegacyUrl } from "@/lib/legacySite";
import {
  getLegacyLiveStatusServices,
  legacySeverityToTone,
  normalizeLegacySeverity,
  type LegacySeverity,
  type LegacyTone,
} from "@/lib/legacyStatus";

export type LegacyDetailServiceId = string;

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

export interface LegacyServiceHealth24hPoint {
  timestamp?: string | null;
  signal_value?: number | null;
  status_code?: number | null;
  status_label?: string | null;
}

export interface LegacyServiceHealth24hMeta {
  source?: string | null;
  kind?: string | null;
  window_hours?: number | null;
  sample_count?: number | null;
  interval_minutes?: number | null;
  last_sample_at?: string | null;
}

export interface LegacyUserReports24hPoint {
  label?: string | null;
  count?: number | null;
}

export interface LegacyUserReports24hMeta {
  source?: string | null;
  kind?: string | null;
  window_hours?: number | null;
  sample_count?: number | null;
  interval_minutes?: number | null;
  last_reviewed_at?: string | null;
}

export interface LegacySourceHealth {
  source_id?: string;
  name?: string;
  kind?: string;
  url?: string;
  role?: string | null;
  criticality?: string | null;
  used_for_scoring?: boolean | null;
  ok?: boolean;
  error?: string | null;
  item_count?: number | null;
  last_item_at?: string | null;
  freshness?: string | null;
  age_minutes?: number | null;
  duration_ms?: number | null;
  fetched_at?: string | null;
  cache_hit?: boolean | null;
}

export interface LegacySourceTransparencySourceMetrics {
  runs?: number | null;
  ok?: number | null;
  stale?: number | null;
  success_rate?: number | null;
  stale_rate?: number | null;
  cache_hit_rate?: number | null;
  avg_duration_ms?: number | null;
}

export interface LegacySourceTransparencySourceEntry {
  source_id?: string;
  name?: string;
  kind?: string;
  url?: string;
  role?: string | null;
  criticality?: string | null;
  used_for_scoring?: boolean | null;
  latest?: {
    ok?: boolean | null;
    freshness?: string | null;
    duration_ms?: number | null;
    cache_hit?: boolean | null;
    at?: string | null;
  };
  metrics_24h?: LegacySourceTransparencySourceMetrics;
  metrics_7d?: LegacySourceTransparencySourceMetrics;
  consecutive_failures?: number | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
}

export interface LegacySourceTransparency {
  schema_version?: number | null;
  generated_at?: string | null;
  overview?: {
    confidence_score?: number | null;
    confidence_tier?: string | null;
    source_ok?: number | null;
    source_total?: number | null;
    required_ok?: number | null;
    required_total?: number | null;
    required_met?: boolean | null;
    scoring_ok?: number | null;
    scoring_total?: number | null;
    scoring_met?: boolean | null;
    degraded_reasons?: string[] | null;
    ratios?: {
      required_ratio?: number | null;
      scoring_ratio?: number | null;
      recent_success_ratio?: number | null;
      freshness_ratio?: number | null;
    };
  };
  decision?: {
    health?: string | null;
    severity_key?: string | null;
    explanation?: string | null;
  };
  sources?: LegacySourceTransparencySourceEntry[];
}

export interface LegacyHistorySourceState {
  source_id?: string;
  name?: string;
  ok?: boolean;
  freshness?: string | null;
  item_count?: number | null;
  kind?: string | null;
  role?: string | null;
  criticality?: string | null;
  used_for_scoring?: boolean | null;
}

export interface LegacyHistoryPoint {
  t?: string | null;
  health?: string | null;
  reports_24h?: number | null;
  severity_key?: string | null;
  severity_score?: number | null;
  source_ok?: number | null;
  source_total?: number | null;
  source_states?: Record<string, LegacyHistorySourceState>;
}

export interface LegacyHistoryPayload {
  updated_at?: string | null;
  cadence_minutes?: number | null;
  retention_days?: number | null;
  points?: LegacyHistoryPoint[];
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
    summary_origin?: string;
    current_status?: string;
    reports_24h?: number;
    incidents?: LegacyOutageIncident[];
    top_reported_issues?: LegacyTopReportedIssue[];
    top_reported_issues_meta?: LegacyTopReportedIssuesMeta;
    service_health_24h?: LegacyServiceHealth24hPoint[];
    service_health_24h_meta?: LegacyServiceHealth24hMeta;
    user_reports_24h?: LegacyUserReports24hPoint[];
    user_reports_24h_meta?: LegacyUserReports24hMeta;
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
  source_transparency?: LegacySourceTransparency;
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
  service: {
    id: string;
    name: string;
    href: string;
    legacyHref?: string;
    note: string;
    statusPath: string;
    iconName?: string;
    category?: string;
    priority?: number;
    tags?: string[];
    aliases?: string[];
  };
  payload: LegacyStatusDetailPayload;
  history?: LegacyHistoryPayload | null;
  severity: LegacySeverity;
  tone: LegacyTone;
  sourceConfidenceText: string;
}

async function getDetailServiceConfig(id: LegacyDetailServiceId) {
  const services = await getLegacyLiveStatusServices();
  const requestedId = String(id || "").trim().toLowerCase();
  if (!requestedId) {
    return null;
  }
  const service = services.find((item) => {
    if (item.id === requestedId) {
      return true;
    }
    if (Array.isArray(item.aliases) && item.aliases.some((alias) => alias === requestedId)) {
      return true;
    }
    return false;
  });
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

function deriveHistoryPath(statusPath: string) {
  const normalized = String(statusPath || "").trim();
  if (!normalized) {
    return "/data/history.json";
  }
  const withSlash = "/status.json";
  if (normalized.endsWith(withSlash)) {
    return `${normalized.slice(0, normalized.length - withSlash.length)}/history.json`;
  }
  const plain = "status.json";
  if (normalized.endsWith(plain)) {
    return `${normalized.slice(0, normalized.length - plain.length)}history.json`;
  }
  return normalized.replace(/\/?$/, "/history.json");
}

export async function fetchLegacyServiceDetail(
  id: LegacyDetailServiceId
): Promise<LegacyServiceDetailResult> {
  const service = await getDetailServiceConfig(id);
  if (!service) {
    throw new Error(`Unsupported service id: ${id}`);
  }

  const timestamp = Date.now();
  const statusUrl = `${resolveLegacyUrl(service.statusPath)}?t=${timestamp}`;
  const historyPath = deriveHistoryPath(service.statusPath);
  const historyUrl = `${resolveLegacyUrl(historyPath)}?t=${timestamp}`;
  const response = await fetch(statusUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${service.statusPath}: ${response.status}`);
  }

  const payload = (await response.json()) as LegacyStatusDetailPayload;
  let history: LegacyHistoryPayload | null = null;
  try {
    const historyResponse = await fetch(historyUrl, { cache: "no-store" });
    if (historyResponse.ok) {
      history = (await historyResponse.json()) as LegacyHistoryPayload;
    }
  } catch {
    history = null;
  }

  const severity = normalizeLegacySeverity(
    payload.analytics?.severity_key || payload.outage?.current_status || payload.health
  );

  return {
    service,
    payload,
    history,
    severity,
    tone: legacySeverityToTone(severity),
    sourceConfidenceText: formatConfidence(payload),
  };
}
