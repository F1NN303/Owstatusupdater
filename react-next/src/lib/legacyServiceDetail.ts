import { fetchCachedJson, type CachedJsonSource } from "@/lib/cachedJson";
import { resolveLegacyUrl } from "@/lib/legacySite";
import { safeExternalHref } from "@/lib/safeUrl";
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

export interface LegacyScheduledMaintenance {
  title?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string | null;
  summary?: string | null;
  source?: string | null;
  url?: string;
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

export interface LegacyComponentStatusItem {
  component_id?: string | null;
  service_id?: string | null;
  name?: string | null;
  component?: string | null;
  service?: string | null;
  label?: string | null;
  status?: string | null;
  state?: string | null;
  severity_key?: string | null;
  health?: string | null;
  updated_at?: string | null;
  source?: string | null;
  url?: string;
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

export interface LegacyHistoryComponentState {
  component_id?: string;
  name?: string;
  status?: string | null;
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
  component_states?: Record<string, LegacyHistoryComponentState>;
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
  components?: LegacyComponentStatusItem[];
  services?: LegacyComponentStatusItem[];
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
    source_conflict?: {
      has_conflict?: boolean | null;
      level?: string | null;
      reason?: string | null;
      official_status?: string | null;
      derived_severity?: string | null;
      source_ok?: number | null;
      source_total?: number | null;
      summary?: string | null;
    };
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
    components?: LegacyComponentStatusItem[];
    services?: LegacyComponentStatusItem[];
    incidents?: LegacyOutageIncident[];
    scheduled_maintenances?: LegacyScheduledMaintenance[];
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
  cache: {
    statusSource: CachedJsonSource;
    statusCachedAt: string | null;
    historySource: CachedJsonSource | null;
    historyCachedAt: string | null;
  };
}

const MAX_LINK_ITEMS = 200;
const MAX_OUTAGE_INCIDENTS = 100;
const MAX_TOP_ISSUES = 50;
const MAX_SERIES_POINTS = 500;
const MAX_SOURCES = 100;
const MAX_HISTORY_POINTS = 5000;
const MAX_COMPONENT_ITEMS = 500;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown, maxLength = 500) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function asTimestamp(value: unknown) {
  const text = asTrimmedString(value, 64);
  if (!text) {
    return undefined;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? text : undefined;
}

function asFiniteNumber(
  value: unknown,
  options: { min?: number; max?: number; integer?: boolean } = {}
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  let next = parsed;
  if (typeof options.min === "number") {
    next = Math.max(options.min, next);
  }
  if (typeof options.max === "number") {
    next = Math.min(options.max, next);
  }
  return options.integer ? Math.round(next) : next;
}

function asPercentage(value: unknown) {
  const parsed = asFiniteNumber(value, { min: 0, max: 100 });
  if (typeof parsed !== "number") {
    return undefined;
  }
  return parsed <= 1 ? parsed * 100 : parsed;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return undefined;
}

function normalizeFreshness(value: unknown) {
  const normalized = asTrimmedString(value, 16)?.toLowerCase();
  if (normalized === "fresh" || normalized === "warm" || normalized === "stale" || normalized === "unknown") {
    return normalized;
  }
  return undefined;
}

function sanitizeStringArray(value: unknown, maxItems = 20, maxLength = 200) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const cleaned = value
    .map((item) => asTrimmedString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function sanitizeLegacyLinkItem(value: unknown): LegacyLinkItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const title = asTrimmedString(record.title, 240);
  const url = safeExternalHref(record.url) ?? undefined;
  const published_at = asTimestamp(record.published_at);
  const source = asTrimmedString(record.source, 160);
  const meta = asTrimmedString(record.meta, 500);
  if (!title && !url && !published_at && !source && !meta) {
    return null;
  }
  return { title, url, published_at, source, meta };
}

function sanitizeLegacyOutageIncident(value: unknown): LegacyOutageIncident | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const title = asTrimmedString(record.title, 240);
  const started_at = asTimestamp(record.started_at);
  const duration = asTrimmedString(record.duration, 120);
  const acknowledgement = asTrimmedString(record.acknowledgement, 240);
  if (!title && !started_at && !duration && !acknowledgement) {
    return null;
  }
  return { title, started_at, duration, acknowledgement };
}

function sanitizeLegacyTopReportedIssue(value: unknown): LegacyTopReportedIssue | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const label = asTrimmedString(record.label, 120);
  const count = asFiniteNumber(record.count, { min: 0, max: 1_000_000, integer: true });
  if (!label && typeof count !== "number") {
    return null;
  }
  return { label, count };
}

function sanitizeLegacyServiceHealth24hPoint(value: unknown): LegacyServiceHealth24hPoint | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const timestamp = asTimestamp(record.timestamp);
  const signal_value = asFiniteNumber(record.signal_value, { min: 0, max: 1_000_000 });
  const status_code = asFiniteNumber(record.status_code, { min: 0, max: 100, integer: true });
  const status_label = asTrimmedString(record.status_label, 120);
  if (!timestamp && typeof signal_value !== "number" && typeof status_code !== "number" && !status_label) {
    return null;
  }
  return { timestamp, signal_value, status_code, status_label };
}

function sanitizeLegacyUserReports24hPoint(value: unknown): LegacyUserReports24hPoint | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const label = asTrimmedString(record.label, 120);
  const count = asFiniteNumber(record.count, { min: 0, max: 1_000_000, integer: true });
  if (!label && typeof count !== "number") {
    return null;
  }
  return { label, count };
}

function sanitizeLegacyComponentStatusItem(value: unknown): LegacyComponentStatusItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const component_id = asTrimmedString(record.component_id, 160);
  const service_id = asTrimmedString(record.service_id, 160);
  const name = asTrimmedString(record.name, 240);
  const component = asTrimmedString(record.component, 240);
  const service = asTrimmedString(record.service, 240);
  const label = asTrimmedString(record.label, 240);
  const status = asTrimmedString(record.status, 64);
  const state = asTrimmedString(record.state, 64);
  const severity_key = asTrimmedString(record.severity_key, 64);
  const health = asTrimmedString(record.health, 64);
  const updated_at = asTimestamp(record.updated_at);
  const source = asTrimmedString(record.source, 160);
  const url = safeExternalHref(record.url) ?? undefined;

  if (
    !component_id &&
    !service_id &&
    !name &&
    !component &&
    !service &&
    !label &&
    !status &&
    !state &&
    !severity_key &&
    !health &&
    !updated_at &&
    !source &&
    !url
  ) {
    return null;
  }

  return {
    component_id,
    service_id,
    name,
    component,
    service,
    label,
    status,
    state,
    severity_key,
    health,
    updated_at,
    source,
    url,
  };
}

function sanitizeLegacySourceHealth(value: unknown): LegacySourceHealth | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const source_id = asTrimmedString(record.source_id, 120);
  const name = asTrimmedString(record.name, 160);
  const kind = asTrimmedString(record.kind, 120);
  if (!source_id && !name && !kind) {
    return null;
  }
  return {
    source_id,
    name,
    kind,
    url: safeExternalHref(record.url) ?? undefined,
    role: asTrimmedString(record.role, 64),
    criticality: asTrimmedString(record.criticality, 64),
    used_for_scoring: asBoolean(record.used_for_scoring),
    ok: asBoolean(record.ok),
    error: asTrimmedString(record.error, 240),
    item_count: asFiniteNumber(record.item_count, { min: 0, max: 1_000_000, integer: true }),
    last_item_at: asTimestamp(record.last_item_at),
    freshness: normalizeFreshness(record.freshness),
    age_minutes: asFiniteNumber(record.age_minutes, { min: 0, max: 10_000_000, integer: true }),
    duration_ms: asFiniteNumber(record.duration_ms, { min: 0, max: 10_000_000, integer: true }),
    fetched_at: asTimestamp(record.fetched_at),
    cache_hit: asBoolean(record.cache_hit),
  };
}

function sanitizeLegacySourceTransparencyMetrics(value: unknown): LegacySourceTransparencySourceMetrics | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const metrics: LegacySourceTransparencySourceMetrics = {
    runs: asFiniteNumber(record.runs, { min: 0, max: 1_000_000, integer: true }),
    ok: asFiniteNumber(record.ok, { min: 0, max: 1_000_000, integer: true }),
    stale: asFiniteNumber(record.stale, { min: 0, max: 1_000_000, integer: true }),
    success_rate: asPercentage(record.success_rate),
    stale_rate: asPercentage(record.stale_rate),
    cache_hit_rate: asPercentage(record.cache_hit_rate),
    avg_duration_ms: asFiniteNumber(record.avg_duration_ms, { min: 0, max: 10_000_000, integer: true }),
  };
  return Object.values(metrics).some((item) => item !== undefined) ? metrics : undefined;
}

function sanitizeLegacyScheduledMaintenance(value: unknown): LegacyScheduledMaintenance | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const title = asTrimmedString(record.title, 240);
  const starts_at = asTimestamp(record.starts_at);
  const ends_at = asTimestamp(record.ends_at);
  const status = asTrimmedString(record.status, 120);
  const summary = asTrimmedString(record.summary, 500);
  const source = asTrimmedString(record.source, 160);
  const url = safeExternalHref(record.url) ?? undefined;
  if (!title && !starts_at && !ends_at && !status && !summary && !source && !url) {
    return null;
  }
  return { title, starts_at, ends_at, status, summary, source, url };
}

function sanitizeLegacySourceTransparencyEntry(value: unknown): LegacySourceTransparencySourceEntry | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const source_id = asTrimmedString(record.source_id, 120);
  const name = asTrimmedString(record.name, 160);
  const kind = asTrimmedString(record.kind, 120);
  if (!source_id && !name && !kind) {
    return null;
  }
  const latestRecord = asRecord(record.latest);
  const latest = latestRecord
    ? {
        ok: asBoolean(latestRecord.ok),
        freshness: normalizeFreshness(latestRecord.freshness),
        duration_ms: asFiniteNumber(latestRecord.duration_ms, {
          min: 0,
          max: 10_000_000,
          integer: true,
        }),
        cache_hit: asBoolean(latestRecord.cache_hit),
        at: asTimestamp(latestRecord.at),
      }
    : undefined;

  return {
    source_id,
    name,
    kind,
    url: safeExternalHref(record.url) ?? undefined,
    role: asTrimmedString(record.role, 64),
    criticality: asTrimmedString(record.criticality, 64),
    used_for_scoring: asBoolean(record.used_for_scoring),
    latest: latest && Object.values(latest).some((item) => item !== undefined) ? latest : undefined,
    metrics_24h: sanitizeLegacySourceTransparencyMetrics(record.metrics_24h),
    metrics_7d: sanitizeLegacySourceTransparencyMetrics(record.metrics_7d),
    consecutive_failures: asFiniteNumber(record.consecutive_failures, {
      min: 0,
      max: 1_000_000,
      integer: true,
    }),
    last_success_at: asTimestamp(record.last_success_at),
    last_failure_at: asTimestamp(record.last_failure_at),
  };
}

function sanitizeLegacyHistorySourceState(value: unknown): LegacyHistorySourceState | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const source_id = asTrimmedString(record.source_id, 120);
  const name = asTrimmedString(record.name, 160);
  if (!source_id && !name) {
    return null;
  }
  return {
    source_id,
    name,
    ok: asBoolean(record.ok),
    freshness: normalizeFreshness(record.freshness),
    item_count: asFiniteNumber(record.item_count, { min: 0, max: 1_000_000, integer: true }),
    kind: asTrimmedString(record.kind, 120),
    role: asTrimmedString(record.role, 64),
    criticality: asTrimmedString(record.criticality, 64),
    used_for_scoring: asBoolean(record.used_for_scoring),
  };
}

function sanitizeLegacyHistoryComponentState(value: unknown): LegacyHistoryComponentState | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const component_id = asTrimmedString(record.component_id, 120);
  const name = asTrimmedString(record.name, 160);
  const status = asTrimmedString(record.status, 64);
  if (!component_id && !name && !status) {
    return null;
  }
  return { component_id, name, status };
}

function sanitizeLegacyHistoryPoint(value: unknown): LegacyHistoryPoint | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const sourceStatesRecord = asRecord(record.source_states) ?? {};
  const source_states = Object.fromEntries(
    Object.entries(sourceStatesRecord)
      .slice(0, MAX_SOURCES)
      .map(([key, entry]) => [key, sanitizeLegacyHistorySourceState(entry)])
      .filter((entry): entry is [string, LegacyHistorySourceState] => Boolean(entry[1]))
  );

  const componentStatesRecord = asRecord(record.component_states) ?? {};
  const component_states = Object.fromEntries(
    Object.entries(componentStatesRecord)
      .slice(0, MAX_SOURCES)
      .map(([key, entry]) => [key, sanitizeLegacyHistoryComponentState(entry)])
      .filter((entry): entry is [string, LegacyHistoryComponentState] => Boolean(entry[1]))
  );

  const point: LegacyHistoryPoint = {
    t: asTimestamp(record.t),
    health: asTrimmedString(record.health, 64),
    reports_24h: asFiniteNumber(record.reports_24h, { min: 0, max: 1_000_000, integer: true }),
    severity_key: asTrimmedString(record.severity_key, 64),
    severity_score: asFiniteNumber(record.severity_score, { min: 0, max: 1_000_000, integer: true }),
    source_ok: asFiniteNumber(record.source_ok, { min: 0, max: 1_000_000, integer: true }),
    source_total: asFiniteNumber(record.source_total, { min: 0, max: 1_000_000, integer: true }),
    source_states: Object.keys(source_states).length > 0 ? source_states : undefined,
    component_states: Object.keys(component_states).length > 0 ? component_states : undefined,
  };

  return Object.values(point).some((item) => item !== undefined) ? point : null;
}

export function sanitizeLegacyHistoryPayload(value: unknown): LegacyHistoryPayload | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const points = Array.isArray(record.points)
    ? record.points
        .map((point) => sanitizeLegacyHistoryPoint(point))
        .filter((point): point is LegacyHistoryPoint => Boolean(point))
        .slice(0, MAX_HISTORY_POINTS)
    : [];

  return {
    updated_at: asTimestamp(record.updated_at),
    cadence_minutes: asFiniteNumber(record.cadence_minutes, { min: 1, max: 10_000, integer: true }),
    retention_days: asFiniteNumber(record.retention_days, { min: 1, max: 10_000, integer: true }),
    points,
  };
}

export function sanitizeLegacyStatusDetailPayload(value: unknown): LegacyStatusDetailPayload {
  const record = asRecord(value) ?? {};
  const analyticsRecord = asRecord(record.analytics) ?? {};
  const signalMetricsRecord = asRecord(analyticsRecord.signal_metrics) ?? {};
  const crossSourceRecord = asRecord(signalMetricsRecord.cross_source) ?? {};
  const sourceConflictRecord = asRecord(analyticsRecord.source_conflict) ?? {};
  const outageRecord = asRecord(record.outage) ?? {};
  const officialRecord = asRecord(record.official) ?? {};
  const transparencyRecord = asRecord(record.source_transparency) ?? {};
  const transparencyOverviewRecord = asRecord(transparencyRecord.overview) ?? {};
  const transparencyRatiosRecord = asRecord(transparencyOverviewRecord.ratios) ?? {};
  const transparencyDecisionRecord = asRecord(transparencyRecord.decision) ?? {};
  const changesRecord = asRecord(record.changes) ?? {};
  const changeSummaryRecord = asRecord(changesRecord.summary) ?? {};

  const regionsRecord = asRecord(record.regions) ?? {};
  const regions = Object.fromEntries(
    Object.entries(regionsRecord)
      .slice(0, 32)
      .map(([key, entry]) => {
        const regionRecord = asRecord(entry);
        if (!regionRecord) {
          return [key, null];
        }
        return [
          key,
          {
            severity_key: asTrimmedString(regionRecord.severity_key, 64),
            severity_score: asFiniteNumber(regionRecord.severity_score, {
              min: 0,
              max: 1_000_000,
              integer: true,
            }),
            report_weight: asFiniteNumber(regionRecord.report_weight, { min: 0, max: 1_000_000 }),
          },
        ];
      })
      .filter(
        (entry): entry is [string, NonNullable<LegacyStatusDetailPayload["regions"]>[string]] =>
          Boolean(entry[1])
      )
  );

  const officialUpdates = Array.isArray(officialRecord.updates)
    ? officialRecord.updates
        .map((item) => sanitizeLegacyLinkItem(item))
        .filter((item): item is LegacyLinkItem => Boolean(item))
        .slice(0, MAX_LINK_ITEMS)
    : [];

  const sanitizeLinkList = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item) => sanitizeLegacyLinkItem(item))
          .filter((item): item is LegacyLinkItem => Boolean(item))
          .slice(0, MAX_LINK_ITEMS)
      : [];

  const incidents = Array.isArray(outageRecord.incidents)
    ? outageRecord.incidents
        .map((item) => sanitizeLegacyOutageIncident(item))
        .filter((item): item is LegacyOutageIncident => Boolean(item))
        .slice(0, MAX_OUTAGE_INCIDENTS)
    : [];

  const top_reported_issues = Array.isArray(outageRecord.top_reported_issues)
    ? outageRecord.top_reported_issues
        .map((item) => sanitizeLegacyTopReportedIssue(item))
        .filter((item): item is LegacyTopReportedIssue => Boolean(item))
        .slice(0, MAX_TOP_ISSUES)
    : [];
  const scheduled_maintenances = Array.isArray(outageRecord.scheduled_maintenances)
    ? outageRecord.scheduled_maintenances
        .map((item) => sanitizeLegacyScheduledMaintenance(item))
        .filter((item): item is LegacyScheduledMaintenance => Boolean(item))
        .slice(0, MAX_TOP_ISSUES)
    : [];

  const service_health_24h = Array.isArray(outageRecord.service_health_24h)
    ? outageRecord.service_health_24h
        .map((item) => sanitizeLegacyServiceHealth24hPoint(item))
        .filter((item): item is LegacyServiceHealth24hPoint => Boolean(item))
        .slice(0, MAX_SERIES_POINTS)
    : [];

  const user_reports_24h = Array.isArray(outageRecord.user_reports_24h)
    ? outageRecord.user_reports_24h
        .map((item) => sanitizeLegacyUserReports24hPoint(item))
        .filter((item): item is LegacyUserReports24hPoint => Boolean(item))
        .slice(0, MAX_SERIES_POINTS)
    : [];

  const sanitizeComponentList = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item) => sanitizeLegacyComponentStatusItem(item))
          .filter((item): item is LegacyComponentStatusItem => Boolean(item))
          .slice(0, MAX_COMPONENT_ITEMS)
      : [];

  const components = sanitizeComponentList(record.components);
  const services = sanitizeComponentList(record.services);
  const outageComponents = sanitizeComponentList(outageRecord.components);
  const outageServices = sanitizeComponentList(outageRecord.services);

  const sources = Array.isArray(record.sources)
    ? record.sources
        .map((item) => sanitizeLegacySourceHealth(item))
        .filter((item): item is LegacySourceHealth => Boolean(item))
        .slice(0, MAX_SOURCES)
    : [];

  const transparencySources = Array.isArray(transparencyRecord.sources)
    ? transparencyRecord.sources
        .map((item) => sanitizeLegacySourceTransparencyEntry(item))
        .filter((item): item is LegacySourceTransparencySourceEntry => Boolean(item))
        .slice(0, MAX_SOURCES)
    : [];

  return {
    generated_at: asTimestamp(record.generated_at),
    health: asTrimmedString(record.health, 64),
    components,
    services,
    analytics: {
      severity_key: asTrimmedString(analyticsRecord.severity_key, 64),
      severity_score: asFiniteNumber(analyticsRecord.severity_score, { min: 0, max: 1_000_000, integer: true }),
      source_ok_count: asFiniteNumber(analyticsRecord.source_ok_count, {
        min: 0,
        max: 1_000_000,
        integer: true,
      }),
      source_total_count: asFiniteNumber(analyticsRecord.source_total_count, {
        min: 0,
        max: 1_000_000,
        integer: true,
      }),
      model_version: asTrimmedString(analyticsRecord.model_version, 64),
      signal_metrics: {
        reports_24h: asFiniteNumber(signalMetricsRecord.reports_24h, { min: 0, max: 1_000_000, integer: true }),
        recent_incidents_6h: asFiniteNumber(signalMetricsRecord.recent_incidents_6h, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        recent_incidents_24h: asFiniteNumber(signalMetricsRecord.recent_incidents_24h, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        cross_source: {
          combined_score: asFiniteNumber(crossSourceRecord.combined_score, { min: 0, max: 1_000_000 }),
        },
      },
      safeguards: Object.fromEntries(
        Object.entries(asRecord(analyticsRecord.safeguards) ?? {})
          .slice(0, 32)
          .map(([key, entry]) => [key, asBoolean(entry)])
          .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
      ),
      source_conflict: {
        has_conflict: asBoolean(sourceConflictRecord.has_conflict),
        level: asTrimmedString(sourceConflictRecord.level, 64),
        reason: asTrimmedString(sourceConflictRecord.reason, 240),
        official_status: asTrimmedString(sourceConflictRecord.official_status, 64),
        derived_severity: asTrimmedString(sourceConflictRecord.derived_severity, 64),
        source_ok: asFiniteNumber(sourceConflictRecord.source_ok, { min: 0, max: 1_000_000, integer: true }),
        source_total: asFiniteNumber(sourceConflictRecord.source_total, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        summary: asTrimmedString(sourceConflictRecord.summary, 500),
      },
    },
    regions,
    outage: {
      source: asTrimmedString(outageRecord.source, 160),
      url: safeExternalHref(outageRecord.url) ?? undefined,
      summary: asTrimmedString(outageRecord.summary, 4_000),
      summary_origin: asTrimmedString(outageRecord.summary_origin, 120),
      current_status: asTrimmedString(outageRecord.current_status, 64),
      reports_24h: asFiniteNumber(outageRecord.reports_24h, { min: 0, max: 1_000_000, integer: true }),
      components: outageComponents,
      services: outageServices,
      incidents,
      scheduled_maintenances,
      top_reported_issues,
      top_reported_issues_meta: {
        source: asTrimmedString(asRecord(outageRecord.top_reported_issues_meta)?.source, 160),
        kind: asTrimmedString(asRecord(outageRecord.top_reported_issues_meta)?.kind, 120),
        mode: asTrimmedString(asRecord(outageRecord.top_reported_issues_meta)?.mode, 64),
        window_hours: asFiniteNumber(asRecord(outageRecord.top_reported_issues_meta)?.window_hours, {
          min: 0,
          max: 10_000,
          integer: true,
        }),
      },
      service_health_24h,
      service_health_24h_meta: {
        source: asTrimmedString(asRecord(outageRecord.service_health_24h_meta)?.source, 160),
        kind: asTrimmedString(asRecord(outageRecord.service_health_24h_meta)?.kind, 120),
        window_hours: asFiniteNumber(asRecord(outageRecord.service_health_24h_meta)?.window_hours, {
          min: 0,
          max: 10_000,
          integer: true,
        }),
        sample_count: asFiniteNumber(asRecord(outageRecord.service_health_24h_meta)?.sample_count, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        interval_minutes: asFiniteNumber(asRecord(outageRecord.service_health_24h_meta)?.interval_minutes, {
          min: 0,
          max: 10_000,
          integer: true,
        }),
        last_sample_at: asTimestamp(asRecord(outageRecord.service_health_24h_meta)?.last_sample_at),
      },
      user_reports_24h,
      user_reports_24h_meta: {
        source: asTrimmedString(asRecord(outageRecord.user_reports_24h_meta)?.source, 160),
        kind: asTrimmedString(asRecord(outageRecord.user_reports_24h_meta)?.kind, 120),
        window_hours: asFiniteNumber(asRecord(outageRecord.user_reports_24h_meta)?.window_hours, {
          min: 0,
          max: 10_000,
          integer: true,
        }),
        sample_count: asFiniteNumber(asRecord(outageRecord.user_reports_24h_meta)?.sample_count, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        interval_minutes: asFiniteNumber(asRecord(outageRecord.user_reports_24h_meta)?.interval_minutes, {
          min: 0,
          max: 10_000,
          integer: true,
        }),
        last_reviewed_at: asTimestamp(asRecord(outageRecord.user_reports_24h_meta)?.last_reviewed_at),
      },
    },
    official: {
      summary: asTrimmedString(officialRecord.summary, 500),
      last_statement_at: asTimestamp(officialRecord.last_statement_at),
      updates: officialUpdates,
    },
    reports: sanitizeLinkList(record.reports),
    news: sanitizeLinkList(record.news),
    social: sanitizeLinkList(record.social),
    known_resources: sanitizeLinkList(record.known_resources),
    sources,
    source_transparency: {
      schema_version: asFiniteNumber(transparencyRecord.schema_version, { min: 0, max: 1_000, integer: true }),
      generated_at: asTimestamp(transparencyRecord.generated_at),
      overview: {
        confidence_score: asPercentage(transparencyOverviewRecord.confidence_score),
        confidence_tier: asTrimmedString(transparencyOverviewRecord.confidence_tier, 64),
        source_ok: asFiniteNumber(transparencyOverviewRecord.source_ok, { min: 0, max: 1_000_000, integer: true }),
        source_total: asFiniteNumber(transparencyOverviewRecord.source_total, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        required_ok: asFiniteNumber(transparencyOverviewRecord.required_ok, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        required_total: asFiniteNumber(transparencyOverviewRecord.required_total, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        required_met: asBoolean(transparencyOverviewRecord.required_met),
        scoring_ok: asFiniteNumber(transparencyOverviewRecord.scoring_ok, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        scoring_total: asFiniteNumber(transparencyOverviewRecord.scoring_total, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        scoring_met: asBoolean(transparencyOverviewRecord.scoring_met),
        degraded_reasons: sanitizeStringArray(transparencyOverviewRecord.degraded_reasons, 20, 240),
        ratios: {
          required_ratio: asFiniteNumber(transparencyRatiosRecord.required_ratio, { min: 0, max: 1 }),
          scoring_ratio: asFiniteNumber(transparencyRatiosRecord.scoring_ratio, { min: 0, max: 1 }),
          recent_success_ratio: asFiniteNumber(transparencyRatiosRecord.recent_success_ratio, {
            min: 0,
            max: 1,
          }),
          freshness_ratio: asFiniteNumber(transparencyRatiosRecord.freshness_ratio, { min: 0, max: 1 }),
        },
      },
      decision: {
        health: asTrimmedString(transparencyDecisionRecord.health, 64),
        severity_key: asTrimmedString(transparencyDecisionRecord.severity_key, 64),
        explanation: asTrimmedString(transparencyDecisionRecord.explanation, 500),
      },
      sources: transparencySources,
    },
    changes: {
      summary: {
        new_incidents: asFiniteNumber(changeSummaryRecord.new_incidents, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        updated_incidents: asFiniteNumber(changeSummaryRecord.updated_incidents, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        resolved_incidents: asFiniteNumber(changeSummaryRecord.resolved_incidents, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
        new_reports: asFiniteNumber(changeSummaryRecord.new_reports, {
          min: 0,
          max: 1_000_000,
          integer: true,
        }),
      },
    },
  };
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
    return `${ok}/${total}`;
  }
  return "n/a";
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
  const statusResult = await fetchCachedJson(
    `service-detail:${service.id}:status`,
    statusUrl,
    {
      requestInit: { cache: "no-store" },
      sanitize: sanitizeLegacyStatusDetailPayload,
    }
  );
  const payload = statusResult.data;
  let history: LegacyHistoryPayload | null = null;
  let historySource: CachedJsonSource | null = null;
  let historyCachedAt: string | null = null;
  try {
    const historyResult = await fetchCachedJson(
      `service-detail:${service.id}:history`,
      historyUrl,
      {
        requestInit: { cache: "no-store" },
        sanitize: sanitizeLegacyHistoryPayload,
      }
    );
    history = historyResult.data;
    historySource = historyResult.source;
    historyCachedAt = historyResult.cachedAt;
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
    cache: {
      statusSource: statusResult.source,
      statusCachedAt: statusResult.cachedAt,
      historySource,
      historyCachedAt,
    },
  };
}
