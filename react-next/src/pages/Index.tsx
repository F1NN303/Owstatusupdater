import AppLayout from "@/components/AppLayout";
import OnboardingHints from "@/components/OnboardingHints";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import ServerCard from "@/components/ServerCard";
import ServiceIdentityIcon from "@/components/ServiceIdentityIcon";
import type { ServerService, Status } from "@/data/servers";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { pickLang, useAppShell } from "@/lib/appShell";
import { formatTimestampByMode } from "@/lib/timeDisplay";
import {
  fetchLegacyServiceDetail,
  type LegacyOutageIncident,
  type LegacyScheduledMaintenance,
  type LegacyServiceDetailResult,
} from "@/lib/legacyServiceDetail";
import { getLegacyLiveStatusServices } from "@/lib/legacyStatus";
import { Bell, ChevronRight, RefreshCw, Star, TriangleAlert, Wrench } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

type OverallState = "all-good" | "minor-issues" | "some-issues" | "major-outage";
type HomeFilterKey = "all" | "issues" | "healthy" | "favorites" | `category:${string}`;
type HomeSortKey = "impact" | "name" | "updated";

interface HomeServiceCard {
  serviceId: string;
  server: ServerService;
  generatedAt: string | null;
  dataSource: "network" | "cache";
  cachedAt: string | null;
  scheduledMaintenances: LegacyScheduledMaintenance[];
  serviceNote?: string;
  serviceCategory: string;
  servicePriority: number;
  serviceTags: string[];
  summaryText: string;
  latestIncidentTitle?: string;
  latestIncidentAt: string | null;
  incidentCount: number;
  reports24h: number | null;
  changeSnapshot: {
    newReports: number;
    newIncidents: number;
    updatedIncidents: number;
    resolvedIncidents: number;
    total: number;
  };
  changeHeadline: string;
  impactLabel: string;
  impactSummary: string;
  sourceConfidenceScore: number | null;
  sourceConfidenceTier: "high" | "medium" | "low" | "unknown";
  error?: string;
}

interface HomeMaintenanceEntry {
  key: string;
  serviceId: string;
  serviceName: string;
  iconName?: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  summary?: string;
  source?: string;
  state: "active" | "scheduled";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATA_STALE_WARNING_MINUTES = 75;
const DATA_STALE_CRITICAL_MINUTES = 180;

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function parseDurationToMs(value?: string | null) {
  if (!value) {
    return null;
  }
  const text = value.toLowerCase();
  if (text.includes("ongoing")) {
    return null;
  }

  let totalMs = 0;
  const dayMatch = text.match(/(\d+)\s*d/);
  const hourMatch = text.match(/(\d+)\s*h/);
  const minMatch = text.match(/(\d+)\s*m/);

  if (dayMatch) {
    totalMs += Number(dayMatch[1]) * DAY_MS;
  }
  if (hourMatch) {
    totalMs += Number(hourMatch[1]) * 60 * 60 * 1000;
  }
  if (minMatch) {
    totalMs += Number(minMatch[1]) * 60 * 1000;
  }

  return totalMs > 0 ? totalMs : null;
}

function severityToStatus(severity: LegacyServiceDetailResult["severity"], tone: LegacyServiceDetailResult["tone"]): Status {
  if (severity === "stable" || severity === "minor") {
    return "online";
  }
  if (severity === "major" || tone === "bad") {
    return "offline";
  }
  if (severity === "degraded") {
    return "degraded";
  }
  return "degraded";
}

function isNonImpactIncident(incident: LegacyOutageIncident) {
  const text = `${incident.title || ""} ${incident.acknowledgement || ""}`.toLowerCase();
  return (
    text.includes("none / monitoring") ||
    text.includes("none / resolved") ||
    text.includes("informational") ||
    text.includes("information available") ||
    text.includes("service warning") ||
    text.includes("advisory")
  );
}

function severityWordToLevel(
  detail: LegacyServiceDetailResult,
  incident: LegacyOutageIncident
): number {
  if (isNonImpactIncident(incident)) {
    return 1;
  }
  const haystack = `${incident.title || ""} ${incident.acknowledgement || ""}`.toLowerCase();
  if (detail.tone === "bad" || haystack.includes("outage") || haystack.includes("offline")) {
    return 0;
  }
  return 0.5;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildTrendHistory(detail: LegacyServiceDetailResult) {
  const generatedAt = parseDate(detail.payload.generated_at) ?? new Date();
  const end = generatedAt.getTime();
  const windowStart = startOfDay(new Date(end - 29 * DAY_MS)).getTime();
  const history = Array.from({ length: 30 }, () => 1);
  const incidents = Array.isArray(detail.payload.outage?.incidents) ? detail.payload.outage?.incidents : [];

  for (const incident of incidents) {
    if (isNonImpactIncident(incident)) {
      continue;
    }
    const startDate = parseDate(incident.started_at);
    if (!startDate) {
      continue;
    }

    const startMs = startDate.getTime();
    const durationMs = parseDurationToMs(incident.duration);
    const endMs = durationMs === null ? end : startMs + durationMs;

    if (endMs <= windowStart || startMs >= end + DAY_MS) {
      continue;
    }

    const level = severityWordToLevel(detail, incident);

    for (let i = 0; i < history.length; i += 1) {
      const dayStart = windowStart + i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      if (startMs < dayEnd && endMs > dayStart) {
        history[i] = Math.min(history[i], level);
      }
    }
  }

  return history;
}

function buildActivitySparkline(detail: LegacyServiceDetailResult) {
  const generatedAt = parseDate(detail.payload.generated_at) ?? new Date();
  const nowMs = generatedAt.getTime();
  const bins = Array.from({ length: 24 }, () => 0);

  const addToBins = (value: string | null | undefined, weight: number) => {
    const parsed = parseDate(value);
    if (!parsed) {
      return;
    }
    const diffHours = (nowMs - parsed.getTime()) / (60 * 60 * 1000);
    if (diffHours < 0 || diffHours >= 24) {
      return;
    }
    const index = 23 - Math.floor(diffHours);
    bins[index] += weight;
  };

  for (const item of detail.payload.reports || []) {
    addToBins(item.published_at, 1);
  }

  for (const item of detail.payload.news || []) {
    addToBins(item.published_at, 0.5);
  }

  for (const incident of detail.payload.outage?.incidents || []) {
    addToBins(incident.started_at, 2.5);
  }

  const severityOffset = detail.tone === "bad" ? 55 : detail.tone === "warn" ? 34 : 16;
  const combinedScore = detail.payload.analytics?.signal_metrics?.cross_source?.combined_score ?? 0;
  const reports24h =
    detail.payload.outage?.reports_24h ?? detail.payload.analytics?.signal_metrics?.reports_24h ?? 0;

  if (bins.every((value) => value === 0)) {
    return Array.from({ length: 24 }, () => 0);
  }

  return bins.map((value, i) => {
    const neighborAvg = (bins[Math.max(0, i - 1)] + value + bins[Math.min(23, i + 1)]) / 3;
    const scaled = severityOffset + neighborAvg * 18 + combinedScore * 2 + Math.min(reports24h, 40) * 0.15;
    return Math.max(4, Math.min(140, scaled));
  });
}

function trendPercent(history: number[]) {
  if (!history.length) {
    return 0;
  }
  const avg = history.reduce((sum, value) => sum + value, 0) / history.length;
  return avg * 100;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return `${value >= 99 ? value.toFixed(2) : value.toFixed(1)}%`;
}

function formatFutureRelative(date: Date, language: "en" | "de") {
  const diffMs = Math.max(date.getTime() - Date.now(), 0);
  const totalMin = Math.round(diffMs / (60 * 1000));
  if (totalMin < 1) {
    return pickLang(language, "soon", "bald");
  }
  if (totalMin < 60) {
    return pickLang(language, `in ${totalMin}m`, `in ${totalMin}m`);
  }

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    if (mins > 0) {
      return pickLang(language, `in ${hours}h ${mins}m`, `in ${hours}h ${mins}m`);
    }
    return pickLang(language, `in ${hours}h`, `in ${hours}h`);
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (remHours > 0) {
    return pickLang(language, `in ${days}d ${remHours}h`, `in ${days}d ${remHours}h`);
  }
  return pickLang(language, `in ${days}d`, `in ${days}d`);
}

function formatScheduledTimestamp(
  value: string | null | undefined,
  language: "en" | "de",
  timeDisplayMode: "relative" | "absolute" | "both"
) {
  const parsed = parseDate(value);
  if (!parsed) {
    return pickLang(language, "Unknown", "Unbekannt");
  }
  const absolute = parsed.toLocaleString(language === "de" ? "de-DE" : "en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isFuture = parsed.getTime() > Date.now();
  const relative = isFuture
    ? formatFutureRelative(parsed, language)
    : formatTimestampByMode(value, {
        language,
        mode: "relative",
        absoluteFormat: {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        },
      });

  if (timeDisplayMode === "absolute") {
    return absolute;
  }
  if (timeDisplayMode === "relative") {
    return relative;
  }
  return `${absolute} (${relative})`;
}

function maintenanceStateFromItem(item: LegacyScheduledMaintenance): "active" | "scheduled" {
  const statusText = String(item.status || "").trim().toLowerCase();
  if (statusText.includes("progress") || statusText.includes("verifying") || statusText.includes("active")) {
    return "active";
  }
  const now = Date.now();
  const startsAt = parseDate(item.starts_at);
  const endsAt = parseDate(item.ends_at);
  if (startsAt && startsAt.getTime() <= now && (!endsAt || endsAt.getTime() >= now)) {
    return "active";
  }
  return "scheduled";
}

function maintenanceSortRank(item: HomeMaintenanceEntry) {
  return item.state === "active" ? 0 : 1;
}

function formatMaintenanceWindow(
  item: HomeMaintenanceEntry,
  language: "en" | "de",
  timeDisplayMode: "relative" | "absolute" | "both"
) {
  const startsLabel = item.startsAt ? formatScheduledTimestamp(item.startsAt, language, timeDisplayMode) : null;
  const endsLabel = item.endsAt ? formatScheduledTimestamp(item.endsAt, language, timeDisplayMode) : null;

  if (item.state === "active") {
    if (endsLabel) {
      return pickLang(language, `Active until ${endsLabel}`, `Aktiv bis ${endsLabel}`);
    }
    if (startsLabel) {
      return pickLang(language, `Active since ${startsLabel}`, `Aktiv seit ${startsLabel}`);
    }
    return pickLang(language, "Maintenance in progress", "Wartung aktiv");
  }

  if (startsLabel && endsLabel) {
    return pickLang(language, `Starts ${startsLabel} · ends ${endsLabel}`, `Startet ${startsLabel} · endet ${endsLabel}`);
  }
  if (startsLabel) {
    return pickLang(language, `Starts ${startsLabel}`, `Startet ${startsLabel}`);
  }
  return pickLang(language, "Scheduled maintenance window", "Geplantes Wartungsfenster");
}

function trimMaintenanceSummary(title: string, summary?: string | null) {
  const text = String(summary || "").trim();
  if (!text) {
    return undefined;
  }
  if (text.toLowerCase() === title.trim().toLowerCase()) {
    return undefined;
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function deriveMetricLabel(detail: LegacyServiceDetailResult, language: "en" | "de") {
  const ok = detail.payload.analytics?.source_ok_count;
  const total = detail.payload.analytics?.source_total_count;
  if (typeof ok === "number" && typeof total === "number" && total > 0) {
    return pickLang(language, `${ok}/${total} sources`, `${ok}/${total} Quellen`);
  }

  const reports24h =
    detail.payload.outage?.reports_24h ?? detail.payload.analytics?.signal_metrics?.reports_24h;
  if (typeof reports24h === "number") {
    return pickLang(language, `${reports24h} reports/24h`, `${reports24h} Meldungen/24h`);
  }

  return pickLang(language, "Live signals", "Live-Signale");
}

function compactText(value?: string | null, maxLength = 132) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function deriveSourceConfidenceSnapshot(detail: LegacyServiceDetailResult) {
  const overview = detail.payload.source_transparency?.overview;
  const sourceOk = detail.payload.analytics?.source_ok_count;
  const sourceTotal = detail.payload.analytics?.source_total_count;
  const score =
    typeof overview?.confidence_score === "number"
      ? overview.confidence_score
      : typeof sourceOk === "number" && typeof sourceTotal === "number" && sourceTotal > 0
        ? Math.round((sourceOk / sourceTotal) * 1000) / 10
        : null;
  const tier = String(
    overview?.confidence_tier ||
      (score === null ? "unknown" : score >= 85 ? "high" : score >= 65 ? "medium" : "low")
  ).toLowerCase();

  return {
    score,
    tier:
      tier === "high" || tier === "medium" || tier === "low"
        ? tier
        : ("unknown" as const),
  };
}

function deriveHomeChangeSnapshot(detail: LegacyServiceDetailResult) {
  const changeSummary = detail.payload.changes?.summary;
  const newReports =
    typeof changeSummary?.new_reports === "number" ? changeSummary.new_reports : 0;
  const newIncidents =
    typeof changeSummary?.new_incidents === "number" ? changeSummary.new_incidents : 0;
  const updatedIncidents =
    typeof changeSummary?.updated_incidents === "number" ? changeSummary.updated_incidents : 0;
  const resolvedIncidents =
    typeof changeSummary?.resolved_incidents === "number" ? changeSummary.resolved_incidents : 0;

  return {
    newReports,
    newIncidents,
    updatedIncidents,
    resolvedIncidents,
    total: newIncidents + updatedIncidents + resolvedIncidents,
  };
}

function buildHomeChangeHeadline(
  detail: LegacyServiceDetailResult,
  changeSnapshot: ReturnType<typeof deriveHomeChangeSnapshot>,
  language: "en" | "de"
) {
  const activeMaintenances = Array.isArray(detail.payload.outage?.scheduled_maintenances)
    ? detail.payload.outage.scheduled_maintenances.filter((item) =>
        maintenanceStateFromItem(item) === "active"
      ).length
    : 0;

  if (changeSnapshot.newIncidents > 0) {
    return pickLang(
      language,
      changeSnapshot.newIncidents === 1
        ? "A new incident appeared in the latest refresh"
        : `${changeSnapshot.newIncidents} new incidents appeared in the latest refresh`,
      changeSnapshot.newIncidents === 1
        ? "Im letzten Refresh ist ein neuer Vorfall aufgetaucht"
        : `Im letzten Refresh sind ${changeSnapshot.newIncidents} neue Vorfälle aufgetaucht`
    );
  }
  if (changeSnapshot.resolvedIncidents > 0 && changeSnapshot.total === changeSnapshot.resolvedIncidents) {
    return pickLang(
      language,
      changeSnapshot.resolvedIncidents === 1
        ? "The latest visible change is a resolution"
        : "Recent changes are moving toward resolution",
      changeSnapshot.resolvedIncidents === 1
        ? "Die letzte sichtbare Änderung ist eine Entwarnung"
        : "Die jüngsten Änderungen laufen eher auf Entwarnung hinaus"
    );
  }
  if (changeSnapshot.total > 0 || changeSnapshot.newReports > 0) {
    return pickLang(
      language,
      "The live picture is still shifting",
      "Das Live-Bild verschiebt sich weiterhin"
    );
  }
  if (activeMaintenances > 0) {
    return pickLang(
      language,
      activeMaintenances === 1 ? "Planned work is the main active change" : "Planned work is shaping the current view",
      activeMaintenances === 1 ? "Geplante Arbeit ist die wichtigste aktive Änderung" : "Geplante Arbeit prägt die aktuelle Ansicht"
    );
  }
  return pickLang(
    language,
    "No fresh incident delta in the latest refresh",
    "Im letzten Refresh gab es keine frische Vorfallsänderung"
  );
}

function buildHomeImpactSummary(
  detail: LegacyServiceDetailResult,
  language: "en" | "de"
) {
  const reports24h =
    typeof detail.payload.outage?.reports_24h === "number"
      ? detail.payload.outage.reports_24h
      : typeof detail.payload.analytics?.signal_metrics?.reports_24h === "number"
        ? detail.payload.analytics.signal_metrics.reports_24h
        : null;
  const incidents = Array.isArray(detail.payload.outage?.incidents)
    ? detail.payload.outage.incidents
    : [];
  const activeMaintenances = Array.isArray(detail.payload.outage?.scheduled_maintenances)
    ? detail.payload.outage.scheduled_maintenances.filter((item) =>
        maintenanceStateFromItem(item) === "active"
      ).length
    : 0;

  if (detail.severity === "major" || detail.tone === "bad" || (typeof reports24h === "number" && reports24h >= 120)) {
    return {
      label: pickLang(language, "Broad user impact", "Breite Nutzerwirkung"),
      summary: pickLang(
        language,
        typeof reports24h === "number"
          ? `${reports24h} reports in 24h and ${incidents.length} listed incidents point to a broader disruption.`
          : `${incidents.length} listed incidents point to a broader disruption right now.`,
        typeof reports24h === "number"
          ? `${reports24h} Meldungen in 24h und ${incidents.length} gelistete Vorfälle deuten auf eine breitere Störung hin.`
          : `${incidents.length} gelistete Vorfälle deuten gerade auf eine breitere Störung hin.`
      ),
    };
  }

  if (
    detail.severity === "degraded" ||
    (typeof reports24h === "number" && reports24h >= 25) ||
    incidents.length > 0
  ) {
    return {
      label: pickLang(language, "Partial user impact", "Teilweise Nutzerwirkung"),
      summary: pickLang(
        language,
        typeof reports24h === "number"
          ? `${reports24h} reports in 24h suggest a narrower disruption that users can still feel.`
          : incidents.length > 0
            ? "Recent incidents suggest user-facing friction, but not a full outage."
            : "Signals suggest user-facing friction, but not a full outage.",
        typeof reports24h === "number"
          ? `${reports24h} Meldungen in 24h deuten auf eine engere, aber spürbare Störung hin.`
          : incidents.length > 0
            ? "Jüngste Vorfälle deuten auf spürbare Reibung hin, aber nicht auf einen kompletten Ausfall."
            : "Die Signale deuten auf spürbare Reibung hin, aber nicht auf einen kompletten Ausfall."
      ),
    };
  }

  if (activeMaintenances > 0) {
    return {
      label: pickLang(language, "Planned work window", "Geplantes Wartungsfenster"),
      summary: pickLang(
        language,
        activeMaintenances === 1
          ? "A scheduled maintenance window is active, but the wider status picture is otherwise calm."
          : "Multiple scheduled maintenance windows are active without a broader outage signal.",
        activeMaintenances === 1
          ? "Ein geplantes Wartungsfenster ist aktiv, das restliche Statusbild wirkt aber ruhig."
          : "Mehrere geplante Wartungsfenster sind aktiv, ohne breiteres Ausfallsignal."
      ),
    };
  }

  return {
    label: pickLang(language, "Low active impact", "Geringe aktive Wirkung"),
    summary: pickLang(
      language,
      "Current sources do not suggest a broad disruption for most users.",
      "Die aktuellen Quellen deuten für die meisten Nutzer nicht auf eine breite Störung hin."
    ),
  };
}

function buildServerCard(detail: LegacyServiceDetailResult, language: "en" | "de"): HomeServiceCard {
  const uptimeHistory = buildTrendHistory(detail);
  const score = trendPercent(uptimeHistory);
  const responseHistory = buildActivitySparkline(detail);
  const status = severityToStatus(detail.severity, detail.tone);
  const latestIncident = detail.payload.outage?.incidents?.[0];
  const changeSnapshot = deriveHomeChangeSnapshot(detail);
  const sourceConfidence = deriveSourceConfidenceSnapshot(detail);
  const impactCopy = buildHomeImpactSummary(detail, language);
  const reports24h =
    typeof detail.payload.outage?.reports_24h === "number"
      ? detail.payload.outage.reports_24h
      : typeof detail.payload.analytics?.signal_metrics?.reports_24h === "number"
        ? detail.payload.analytics.signal_metrics.reports_24h
        : null;

  const name = detail.service.name || detail.service.id;
  const icon =
    detail.service.iconName ||
    (detail.service.id === "sony"
      ? "Tv"
      : detail.service.id === "m365"
        ? "Globe"
        : detail.service.id === "openai"
          ? "Cpu"
          : "Gamepad2");
  const sourceOk = detail.payload.analytics?.source_ok_count;
  const sourceTotal = detail.payload.analytics?.source_total_count;
  const sourceUnavailableCount =
    typeof sourceOk === "number" && typeof sourceTotal === "number" && sourceTotal > sourceOk
      ? Math.max(sourceTotal - sourceOk, 0)
      : 0;
  const staleSourceCount = Array.isArray(detail.payload.sources)
    ? detail.payload.sources.filter((source) => {
        const freshness = String(source?.freshness || "").toLowerCase();
        return freshness === "stale";
      }).length
    : 0;

  const server: ServerService = {
    id: detail.service.id,
    name,
    icon,
    status,
    uptime: Number(score.toFixed(2)),
    metricLabel: deriveMetricLabel(detail, language),
    sourceUnavailableCount,
    staleSourceCount,
    trendLabel: pickLang(language, "30-day signal trend", "30-Tage-Signaltrend"),
    trendValueLabel: formatPercent(score),
    lastIncident: detail.payload.outage?.incidents?.[0]?.title || undefined,
    uptimeHistory,
    responseHistory,
    incidents: [],
    services: [],
  };

  return {
    serviceId: detail.service.id,
    server,
    generatedAt: detail.payload.generated_at ?? null,
    dataSource: detail.cache.statusSource,
    cachedAt: detail.cache.statusCachedAt,
    scheduledMaintenances: Array.isArray(detail.payload.outage?.scheduled_maintenances)
      ? detail.payload.outage.scheduled_maintenances
      : [],
    serviceNote: detail.service.note,
    serviceCategory: String(detail.service.category || "general").toLowerCase(),
    servicePriority:
      typeof detail.service.priority === "number" && Number.isFinite(detail.service.priority)
        ? detail.service.priority
        : 1000,
    serviceTags: Array.isArray(detail.service.tags)
      ? detail.service.tags.map((tag) => String(tag || "").toLowerCase()).filter(Boolean)
      : [],
    summaryText: compactText(
      detail.payload.outage?.summary ||
        detail.payload.official?.summary ||
        latestIncident?.acknowledgement ||
        latestIncident?.title ||
        detail.service.note ||
        pickLang(
          language,
          "Live service signals are currently available.",
          "Live-Service-Signale sind aktuell verfügbar."
        )
    ),
    latestIncidentTitle: latestIncident?.title || undefined,
    latestIncidentAt: latestIncident?.started_at ?? null,
    incidentCount: Array.isArray(detail.payload.outage?.incidents)
      ? detail.payload.outage.incidents.length
      : 0,
    reports24h,
    changeSnapshot,
    changeHeadline: buildHomeChangeHeadline(detail, changeSnapshot, language),
    impactLabel: impactCopy.label,
    impactSummary: impactCopy.summary,
    sourceConfidenceScore: sourceConfidence.score,
    sourceConfidenceTier: sourceConfidence.tier,
  };
}

function formatHeaderSubtitle(
  lastRefreshAt: string | null,
  language: "en" | "de",
  timeDisplayMode: "relative" | "absolute" | "both"
) {
  if (!lastRefreshAt) {
    return pickLang(language, "Live monitoring · Fetching live status", "Live-Monitoring · Lade Live-Status");
  }

  const updatedLabel = formatTimestampByMode(lastRefreshAt, {
    language,
    mode: timeDisplayMode,
    absoluteFormat: {
      hour: "2-digit",
      minute: "2-digit",
    },
  });

  return pickLang(
    language,
    `Live monitoring · Updated ${updatedLabel}`,
    `Live-Monitoring · Aktualisiert ${updatedLabel}`
  );
}

function ageMinutesSince(value?: string | null) {
  const parsed = parseDate(value);
  if (!parsed) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / (60 * 1000)));
}

function formatAgeMinutes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  if (value < 60) {
    return `${Math.round(value)}m`;
  }
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  if (hours < 24) {
    return `${hours}h ${mins}m`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function categoryLabel(category: string, language: "en" | "de") {
  const key = String(category || "").trim().toLowerCase();
  if (key === "gaming") {
    return pickLang(language, "Gaming", "Gaming");
  }
  if (key === "productivity") {
    return pickLang(language, "Productivity", "Produktivität");
  }
  if (key === "ai") {
    return pickLang(language, "AI", "KI");
  }
  if (key === "notifications") {
    return pickLang(language, "Notifications", "Benachrichtigungen");
  }
  if (!key) {
    return pickLang(language, "General", "Allgemein");
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function parseFilterParam(rawValue: string | null): HomeFilterKey {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value || value === "all") {
    return "all";
  }
  if (value === "issues" || value === "healthy" || value === "favorites" || value === "starred") {
    return value;
  }
  if (value.startsWith("category:")) {
    const category = value.slice("category:".length).trim();
    if (category) {
      return `category:${category}`;
    }
  }
  if (value.startsWith("cat:")) {
    const category = value.slice("cat:".length).trim();
    if (category) {
      return `category:${category}`;
    }
  }
  return "all";
}

function parseSortParam(rawValue: string | null): HomeSortKey {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "name" || value === "updated") {
    return value;
  }
  return "impact";
}

function impactRank(status: Status): number {
  if (status === "offline") {
    return 0;
  }
  if (status === "degraded") {
    return 1;
  }
  return 2;
}

function overallStateFromCards(cards: HomeServiceCard[], hasErrors: boolean): OverallState {
  if (cards.length === 0) {
    return hasErrors ? "minor-issues" : "all-good";
  }

  const offlineCount = cards.filter((card) => card.server.status === "offline").length;
  const degradedCount = cards.filter((card) => card.server.status === "degraded").length;
  const impactedCount = offlineCount + degradedCount;
  const offlineRatio = offlineCount / cards.length;
  const impactedRatio = impactedCount / cards.length;

  if (offlineCount >= 2 || offlineRatio >= 0.25) {
    return "major-outage";
  }
  if (offlineCount === 1 || degradedCount >= 3 || impactedRatio >= 0.5) {
    return "some-issues";
  }
  if (degradedCount >= 1 || hasErrors) {
    return "minor-issues";
  }
  return "all-good";
}

const Index = () => {
  const {
    language,
    favoriteServiceIds,
    isFavoriteService,
    toggleFavoriteService,
    homeDefaultFilter,
    homeDefaultSort,
    homeRefreshIntervalSec,
    homeCompactCards,
    homeFavoritesFirst,
    homeHintsDismissed,
    dismissHomeHints,
    timeDisplayMode,
  } = useAppShell();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQueryParam = searchParams.get("q");
  const urlFilterParam = searchParams.get("filter");
  const urlSortParam = searchParams.get("sort");
  const [cards, setCards] = useState<HomeServiceCard[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => urlQueryParam || "");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeFilter, setActiveFilter] = useState<HomeFilterKey>(
    () => parseFilterParam(urlFilterParam || homeDefaultFilter)
  );
  const [sortBy, setSortBy] = useState<HomeSortKey>(() => parseSortParam(urlSortParam || homeDefaultSort));
  const favoriteServiceIdSet = useMemo(() => new Set(favoriteServiceIds), [favoriteServiceIds]);
  const hasFavoriteServices = favoriteServiceIds.length > 0;

  useEffect(() => {
    setSearchQuery(urlQueryParam || "");
  }, [urlQueryParam]);

  useEffect(() => {
    if (!urlFilterParam) {
      return;
    }
    setActiveFilter(parseFilterParam(urlFilterParam));
  }, [urlFilterParam]);

  useEffect(() => {
    if (!urlSortParam) {
      return;
    }
    setSortBy(parseSortParam(urlSortParam));
  }, [urlSortParam]);

  const loadCards = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const liveServices = await getLegacyLiveStatusServices();
      const results = await Promise.allSettled(
        liveServices.map((service) => fetchLegacyServiceDetail(service.id))
      );

      const nextCards: HomeServiceCard[] = [];
      const nextErrors: string[] = [];

      for (let i = 0; i < results.length; i += 1) {
        const serviceId = liveServices[i]?.id || `service-${i}`;
        const result = results[i];

        if (result.status === "fulfilled") {
          nextCards.push(buildServerCard(result.value, language));
          continue;
        }

        const reason =
          result.reason instanceof Error ? result.reason.message : "Unknown fetch error";
        nextErrors.push(`${serviceId}: ${reason}`);
      }

      const generatedTimes = nextCards
        .map((card) => parseDate(card.generatedAt))
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime());

      setCards((previous) => (nextCards.length > 0 ? nextCards : previous));
      setErrorMessages(nextErrors);
      setLastRefreshAt((previous) => generatedTimes[0]?.toISOString() || previous || new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error";
      setErrorMessages([message]);
    } finally {
      setIsRefreshing(false);
    }
  }, [language]);

  const pullToRefresh = usePullToRefresh({
    isRefreshing,
    onRefresh: loadCards,
  });

  useEffect(() => {
    void loadCards();
    const timer = window.setInterval(() => {
      void loadCards();
    }, homeRefreshIntervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [homeRefreshIntervalSec, loadCards]);

  const overallState = useMemo(
    () => overallStateFromCards(cards, errorMessages.length > 0),
    [cards, errorMessages.length]
  );
  const statusCounts = useMemo(() => {
    const onlineCount = cards.filter((card) => card.server.status === "online").length;
    const degradedCount = cards.filter((card) => card.server.status === "degraded").length;
    const offlineCount = cards.filter((card) => card.server.status === "offline").length;
    return {
      onlineCount,
      degradedCount,
      offlineCount,
      impactedCount: degradedCount + offlineCount,
    };
  }, [cards]);
  const { onlineCount, degradedCount, offlineCount, impactedCount } = statusCounts;
  const cachedCardCount = useMemo(
    () => cards.filter((card) => card.dataSource === "cache").length,
    [cards]
  );
  const latestCachedAt = useMemo(() => {
    const timestamps = cards
      .map((card) => parseDate(card.cachedAt))
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime());
    return timestamps[0]?.toISOString() ?? null;
  }, [cards]);
  const subtitle = useMemo(
    () => formatHeaderSubtitle(lastRefreshAt, language, timeDisplayMode),
    [lastRefreshAt, language, timeDisplayMode]
  );
  const dataAgeMinutes = useMemo(() => ageMinutesSince(lastRefreshAt), [lastRefreshAt]);
  const isDataStale =
    typeof dataAgeMinutes === "number" && dataAgeMinutes >= DATA_STALE_WARNING_MINUTES;
  const isDataVeryStale =
    typeof dataAgeMinutes === "number" && dataAgeMinutes >= DATA_STALE_CRITICAL_MINUTES;
  const categoryFilters = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(cards.map((card) => card.serviceCategory).filter(Boolean))
    );
    return uniqueCategories.sort((a, b) =>
      categoryLabel(a, language).localeCompare(categoryLabel(b, language))
    );
  }, [cards, language]);
  const filterOptions = useMemo(
    () => [
      {
        key: "all" as HomeFilterKey,
        label: pickLang(language, "All", "Alle"),
      },
      {
        key: "issues" as HomeFilterKey,
        label: pickLang(language, "Issues", "Probleme"),
      },
      {
        key: "healthy" as HomeFilterKey,
        label: pickLang(language, "Healthy", "Stabil"),
      },
      ...(hasFavoriteServices
        ? [
            {
              key: "favorites" as HomeFilterKey,
              label: pickLang(language, "Favorites", "Favoriten"),
            },
          ]
        : []),
      ...categoryFilters.map((category) => ({
        key: `category:${category}` as HomeFilterKey,
        label: categoryLabel(category, language),
      })),
    ],
    [categoryFilters, hasFavoriteServices, language]
  );
  const primaryFilterOptions = useMemo(
    () => filterOptions.filter((option) => !option.key.startsWith("category:")),
    [filterOptions]
  );
  const categoryFilterOptions = useMemo(
    () => filterOptions.filter((option) => option.key.startsWith("category:")),
    [filterOptions]
  );
  const sortOptions = useMemo(
    () => [
      {
        key: "impact" as HomeSortKey,
        label: pickLang(language, "Impact", "Impact"),
      },
      {
        key: "name" as HomeSortKey,
        label: pickLang(language, "Name", "Name"),
      },
      {
        key: "updated" as HomeSortKey,
        label: pickLang(language, "Updated", "Aktualisiert"),
      },
    ],
    [language]
  );
  const activeFilterLabel = useMemo(() => {
    if (activeFilter === "all") {
      return null;
    }
    return (
      filterOptions.find((option) => option.key === activeFilter)?.label ||
      (activeFilter.startsWith("category:")
        ? categoryLabel(activeFilter.replace("category:", ""), language)
        : activeFilter)
    );
  }, [activeFilter, filterOptions, language]);
  const hasActiveSearch = deferredSearchQuery.trim().length > 0;
  const hasActiveRefinements = activeFilter !== "all" || hasActiveSearch;
  const maintenanceEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: HomeMaintenanceEntry[] = [];

    for (const card of cards) {
      for (const item of card.scheduledMaintenances) {
        const title = String(item.title || "").trim();
        const startsAt = item.starts_at ?? null;
        if (!title && !startsAt) {
          continue;
        }
        const key = `${card.serviceId}:${title}:${startsAt || "unknown"}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        entries.push({
          key,
          serviceId: card.serviceId,
          serviceName: card.server.name,
          iconName: card.server.icon,
          title: title || pickLang(language, "Scheduled maintenance", "Geplante Wartung"),
          startsAt,
          endsAt: item.ends_at ?? null,
          summary: trimMaintenanceSummary(title, item.summary),
          source: item.source ?? undefined,
          state: maintenanceStateFromItem(item),
        });
      }
    }

    return entries
      .sort((left, right) => {
        const byState = maintenanceSortRank(left) - maintenanceSortRank(right);
        if (byState !== 0) {
          return byState;
        }
        const leftStart = parseDate(left.startsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightStart = parseDate(right.startsAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (leftStart !== rightStart) {
          return leftStart - rightStart;
        }
        return left.serviceName.localeCompare(right.serviceName);
      })
      .slice(0, 4);
  }, [cards, language]);
  const averageSourceConfidence = useMemo(() => {
    const scores = cards
      .map((card) => card.sourceConfidenceScore)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (scores.length === 0) {
      return null;
    }
    return Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;
  }, [cards]);
  const servicesWithRecentChange = useMemo(
    () =>
      cards.filter(
        (card) => card.changeSnapshot.total > 0 || card.changeSnapshot.newReports > 0 || card.server.status !== "online"
      ).length,
    [cards]
  );
  const focusCards = useMemo(() => {
    return [...cards]
      .sort((left, right) => {
        const byImpact = impactRank(left.server.status) - impactRank(right.server.status);
        if (byImpact !== 0) {
          return byImpact;
        }
        const leftChangeWeight = left.changeSnapshot.total * 5 + left.changeSnapshot.newReports;
        const rightChangeWeight = right.changeSnapshot.total * 5 + right.changeSnapshot.newReports;
        if (leftChangeWeight !== rightChangeWeight) {
          return rightChangeWeight - leftChangeWeight;
        }
        const leftReports = typeof left.reports24h === "number" ? left.reports24h : -1;
        const rightReports = typeof right.reports24h === "number" ? right.reports24h : -1;
        if (leftReports !== rightReports) {
          return rightReports - leftReports;
        }
        const leftIncidentAt = parseDate(left.latestIncidentAt)?.getTime() ?? 0;
        const rightIncidentAt = parseDate(right.latestIncidentAt)?.getTime() ?? 0;
        if (leftIncidentAt !== rightIncidentAt) {
          return rightIncidentAt - leftIncidentAt;
        }
        return left.servicePriority - right.servicePriority;
      })
      .slice(0, 3);
  }, [cards]);
  const nextMaintenanceEntry = maintenanceEntries[0] ?? null;
  const heroStateLabel =
    overallState === "major-outage"
      ? pickLang(language, "Major outage", "Große Störung")
      : overallState === "some-issues"
        ? pickLang(language, "Active issues", "Aktive Probleme")
        : overallState === "minor-issues"
          ? pickLang(language, "Watching signals", "Signale im Blick")
          : pickLang(language, "Operational", "Stabil");
  const heroStateToneClass =
    overallState === "major-outage"
      ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
      : overallState === "some-issues"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
        : overallState === "minor-issues"
          ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
          : "border-emerald-300/25 bg-emerald-400/10 text-emerald-300";
  const heroHeadline =
    cards.length === 0
      ? pickLang(language, "Waiting for live status", "Warte auf Live-Status")
      : overallState === "major-outage"
        ? pickLang(language, `${offlineCount} services are down right now.`, `${offlineCount} Services sind gerade offline.`)
        : overallState === "some-issues"
          ? pickLang(language, `${impactedCount} services need attention right now.`, `${impactedCount} Services brauchen gerade Aufmerksamkeit.`)
          : overallState === "minor-issues"
            ? pickLang(language, "A few signals need watching.", "Ein paar Signale brauchen Beobachtung.")
            : pickLang(language, "Everything looks steady right now.", "Im Moment wirkt alles stabil.");
  const heroSupportCopy = useMemo(() => {
    if (cards.length === 0) {
      return pickLang(
        language,
        "Service cards appear as soon as the live status pipeline returns fresh data.",
        "Sobald die Live-Status-Pipeline frische Daten liefert, erscheinen hier die Service-Karten."
      );
    }

    if (isDataVeryStale) {
      return pickLang(
        language,
        `The last successful refresh is ${formatAgeMinutes(dataAgeMinutes)} old, so treat the feed as delayed until the next live poll lands.`,
        `Das letzte erfolgreiche Update ist ${formatAgeMinutes(dataAgeMinutes)} alt. Die Ansicht sollte bis zum nächsten Live-Poll als verzögert gelten.`
      );
    }

    if (cachedCardCount > 0 && latestCachedAt) {
      return pickLang(
        language,
        `${cachedCardCount} services are temporarily running on last known data from ${formatTimestampByMode(latestCachedAt, {
          language,
          mode: timeDisplayMode,
          absoluteFormat: {
            hour: "2-digit",
            minute: "2-digit",
          },
          fallbackText: "stored",
        })}.`,
        `${cachedCardCount} Services laufen vorübergehend mit zuletzt bekannten Daten von ${formatTimestampByMode(latestCachedAt, {
          language,
          mode: timeDisplayMode,
          absoluteFormat: {
            hour: "2-digit",
            minute: "2-digit",
          },
          fallbackText: "gespeichert",
        })}.`
      );
    }

    if (nextMaintenanceEntry) {
      return pickLang(
        language,
        `${servicesWithRecentChange}/${cards.length} services show live change signals. Next planned window: ${nextMaintenanceEntry.serviceName}.`,
        `${servicesWithRecentChange}/${cards.length} Services zeigen Live-Änderungen. Nächstes geplantes Fenster: ${nextMaintenanceEntry.serviceName}.`
      );
    }

    return pickLang(
      language,
      `${servicesWithRecentChange}/${cards.length} services currently show active change or disruption signals.`,
      `${servicesWithRecentChange}/${cards.length} Services zeigen aktuell aktive Änderungs- oder Störungssignale.`
    );
  }, [
    cachedCardCount,
    cards.length,
    dataAgeMinutes,
    isDataVeryStale,
    language,
    latestCachedAt,
    nextMaintenanceEntry,
    servicesWithRecentChange,
    timeDisplayMode,
  ]);
  const filteredCards = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return cards
      .filter((card) => {
        if (activeFilter === "all") {
          return true;
        }
        if (activeFilter === "issues") {
          return card.server.status !== "online";
        }
        if (activeFilter === "healthy") {
          return card.server.status === "online";
        }
        if (activeFilter === "favorites") {
          return favoriteServiceIdSet.has(card.serviceId);
        }
        if (activeFilter.startsWith("category:")) {
          return card.serviceCategory === activeFilter.replace("category:", "");
        }
        return true;
      })
      .filter((card) => {
        if (!query) {
          return true;
        }
        const haystack = [
          card.server.name,
          card.serviceId,
          card.serviceCategory,
          card.serviceNote || "",
          ...card.serviceTags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (homeFavoritesFirst) {
          const leftFavorite = favoriteServiceIdSet.has(left.serviceId);
          const rightFavorite = favoriteServiceIdSet.has(right.serviceId);
          if (leftFavorite !== rightFavorite) {
            return leftFavorite ? -1 : 1;
          }
        }

        if (sortBy === "name") {
          return left.server.name.localeCompare(right.server.name);
        }
        if (sortBy === "updated") {
          const leftTime = parseDate(left.generatedAt)?.getTime() || 0;
          const rightTime = parseDate(right.generatedAt)?.getTime() || 0;
          if (rightTime !== leftTime) {
            return rightTime - leftTime;
          }
          return left.server.name.localeCompare(right.server.name);
        }

        const byImpact = impactRank(left.server.status) - impactRank(right.server.status);
        if (byImpact !== 0) {
          return byImpact;
        }
        const byPriority = left.servicePriority - right.servicePriority;
        if (byPriority !== 0) {
          return byPriority;
        }
        return left.server.name.localeCompare(right.server.name);
      });
  }, [activeFilter, cards, deferredSearchQuery, favoriteServiceIdSet, homeFavoritesFirst, sortBy]);

  useEffect(() => {
    if (activeFilter === "favorites" && !hasFavoriteServices) {
      setActiveFilter("all");
      return;
    }
    if (!activeFilter.startsWith("category:")) {
      return;
    }
    const activeCategory = activeFilter.replace("category:", "");
    if (!categoryFilters.includes(activeCategory)) {
      setActiveFilter("all");
    }
  }, [activeFilter, categoryFilters, hasFavoriteServices]);

  return (
    <AppLayout>
      <OnboardingHints
        language={language}
        open={!homeHintsDismissed}
        onDismiss={dismissHomeHints}
        onOpenFavorites={() => {
          dismissHomeHints();
          navigate("/favorites");
        }}
      />
      <PullToRefreshIndicator
        distance={pullToRefresh.distance}
        isPullReady={pullToRefresh.isPullReady}
        isRefreshing={pullToRefresh.isPullRefreshing}
        pullLabel={pickLang(language, "Pull to refresh", "Zum Aktualisieren ziehen")}
        releaseLabel={pickLang(language, "Release to refresh", "Loslassen zum Aktualisieren")}
        refreshingLabel={pickLang(language, "Refreshing live status...", "Live-Status wird aktualisiert...")}
      />
      <main className="mx-auto max-w-md px-4 pb-32 pt-8" {...pullToRefresh.bind}>
        <div className="flex items-start justify-between gap-3 pb-4 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/75">
              {pickLang(language, "Live status view", "Live-Statusansicht")}
            </p>
            <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Status Radar", "Status Radar")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadCards()}
            className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
            aria-label={pickLang(language, "Refresh live status", "Live-Status aktualisieren")}
          >
            <RefreshCw
              size={18}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {cards.length === 0 && isRefreshing ? (
          <div className="space-y-3">
            <div className="glass-heavy glass-specular h-[220px] rounded-[28px]" />
            <div className="glass glass-specular h-[112px] rounded-[26px]" />
          </div>
        ) : cards.length > 0 ? (
          <section className="glass-heavy glass-specular overflow-hidden rounded-[28px] px-3 py-3 sm:px-4 sm:py-4">
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {pickLang(language, "Operational picture", "Betriebsbild")}
                  </p>
                  <h2 className="mt-1 max-w-[16ch] text-[23px] font-semibold leading-[0.95] tracking-tight text-foreground sm:mt-2 sm:max-w-[14ch] sm:text-[29px] sm:leading-[0.98]">
                    {heroHeadline}
                  </h2>
                  <p className="mt-2 max-w-[28rem] text-[11px] leading-[1.45] text-muted-foreground sm:mt-3 sm:max-w-[34rem] sm:text-[13px] sm:leading-relaxed">
                    {heroSupportCopy}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.16em] ${heroStateToneClass}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {heroStateLabel}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-4 sm:gap-2.5">
                <div className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                    {pickLang(language, "Monitored", "Überwacht")}
                  </p>
                  <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight text-foreground sm:mt-2 sm:text-2xl">{cards.length}</p>
                  <p className="mt-1 text-[10px] leading-[1.3] text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                    {pickLang(language, "Public status feeds", "Öffentliche Statusquellen")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFilter("issues")}
                  className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-2.5 text-left transition-colors hover:bg-white/10 sm:px-3 sm:py-3"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                    {pickLang(language, "Needs attention", "Braucht Aufmerksamkeit")}
                  </p>
                  <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight text-foreground sm:mt-2 sm:text-2xl">{impactedCount}</p>
                  <p className="mt-1 text-[10px] leading-[1.3] text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                    {pickLang(language, "Tap to isolate impacted services", "Tippen, um betroffene Services zu filtern")}
                  </p>
                </button>
                <div className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                    {pickLang(language, "Source confidence", "Quellenvertrauen")}
                  </p>
                  <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight text-foreground sm:mt-2 sm:text-2xl">
                    {averageSourceConfidence !== null ? `${averageSourceConfidence.toFixed(1)}%` : "--"}
                  </p>
                  <p className="mt-1 text-[10px] leading-[1.3] text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                    {pickLang(language, "Average cross-source confidence", "Durchschnittliches Quellenvertrauen")}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px]">
                    {pickLang(language, "Changing now", "Verändert sich jetzt")}
                  </p>
                  <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight text-foreground sm:mt-2 sm:text-2xl">
                    {servicesWithRecentChange}
                  </p>
                  <p className="mt-1 text-[10px] leading-[1.3] text-muted-foreground sm:text-[11px] sm:leading-relaxed">
                    {pickLang(language, "Services with live change or disruption signals", "Services mit Live-Änderungs- oder Störungssignalen")}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 sm:mt-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {pickLang(language, "Watch now", "Jetzt im Blick")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground sm:text-[12px]">
                      {pickLang(language, "The shortest path to what matters next.", "Der kürzeste Weg zu dem, was jetzt zählt.")}
                    </p>
                  </div>
                  {nextMaintenanceEntry ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-muted-foreground">
                      {pickLang(language, "Next planned", "Nächst geplant")}: {nextMaintenanceEntry.serviceName}
                    </span>
                  ) : null}
                </div>

                {impactedCount > 0 || servicesWithRecentChange > 0 || nextMaintenanceEntry ? (
                  <div className="mt-2.5 space-y-1.5 sm:space-y-2">
                    {focusCards.map((card) => (
                      <Link
                        key={card.serviceId}
                        to={`/status/${card.serviceId}`}
                        className="group flex items-start justify-between gap-2.5 rounded-2xl border border-white/10 bg-black/15 px-2.5 py-2.5 transition-colors hover:bg-white/10 sm:gap-3 sm:px-3 sm:py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ServiceIdentityIcon
                              serviceId={card.serviceId}
                              iconName={card.server.icon}
                              size={14}
                              containerClassName="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-foreground">{card.server.name}</p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {card.impactLabel}
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            {card.server.status !== "online" || card.changeSnapshot.total > 0 || card.changeSnapshot.newReports > 0
                              ? card.changeHeadline
                              : card.summaryText}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                              card.server.status === "offline"
                                ? "border-rose-300/25 bg-rose-300/10 text-rose-200"
                                : card.server.status === "degraded"
                                  ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                                  : card.sourceConfidenceTier === "high"
                                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300"
                                    : "border-white/10 bg-white/5 text-muted-foreground"
                            }`}
                          >
                            {card.server.status === "offline"
                              ? pickLang(language, "offline", "offline")
                              : card.server.status === "degraded"
                                ? pickLang(language, "degraded", "beeinträchtigt")
                                : card.sourceConfidenceScore !== null
                                  ? `${card.sourceConfidenceScore.toFixed(0)}%`
                                  : pickLang(language, "steady", "ruhig")}
                          </span>
                          <ChevronRight
                            size={15}
                            className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                    <p className="text-[13px] font-semibold text-foreground">
                      {pickLang(language, "No broad disruption is standing out right now.", "Gerade sticht keine breite Störung heraus.")}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {nextMaintenanceEntry
                        ? pickLang(
                            language,
                            `The next visible change is scheduled maintenance for ${nextMaintenanceEntry.serviceName}.`,
                            `Die nächste sichtbare Änderung ist geplante Wartung bei ${nextMaintenanceEntry.serviceName}.`
                          )
                        : pickLang(
                            language,
                            "Use the feed below to inspect individual services, categories, or freshness signals.",
                            "Nutze den Feed unten, um einzelne Services, Kategorien oder Frische-Signale zu prüfen."
                          )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="glass glass-specular rounded-[28px] p-4">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-foreground">
                {pickLang(language, "No live service data loaded", "Keine Live-Service-Daten geladen")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "Service cards appear as soon as live status updates are available.",
                  "Service-Karten erscheinen, sobald Live-Statusupdates verfügbar sind."
                )}
              </p>
            </div>
          </div>
        )}

        {maintenanceEntries.length > 0 ? (
          <section className="mt-4">
            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-primary">
                <Wrench size={15} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {pickLang(language, "Planned work", "Geplante Arbeiten")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pickLang(language, "Upcoming or active provider windows", "Bevorstehende oder aktive Wartungsfenster")}
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              {maintenanceEntries.map((entry) => (
                <Link
                  key={entry.key}
                  to={`/status/${entry.serviceId}`}
                  className="glass block rounded-2xl p-3 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ServiceIdentityIcon
                        serviceId={entry.serviceId}
                        iconName={entry.iconName}
                        size={16}
                        containerClassName="h-10 w-10 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-foreground">{entry.serviceName}</p>
                        <p className="mt-0.5 text-[13px] font-medium text-foreground/90">{entry.title}</p>
                        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                          {formatMaintenanceWindow(entry, language, timeDisplayMode)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                          entry.state === "active"
                            ? "border-status-degraded/30 bg-status-degraded/10 text-status-degraded"
                            : "border-sky-300/25 bg-sky-300/10 text-sky-100"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            entry.state === "active" ? "bg-status-degraded" : "bg-sky-200"
                          }`}
                        />
                        {entry.state === "active"
                          ? pickLang(language, "Active", "Aktiv")
                          : pickLang(language, "Scheduled", "Geplant")}
                      </span>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </div>
                  </div>
                  {entry.summary ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/90">{entry.summary}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {cards.length > 0 ? (
          <section className="mt-4">
            <div className="glass rounded-[26px] px-3 py-3">
              <div className="flex items-end justify-between gap-3">
                <label className="block min-w-0 flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {pickLang(language, "Find a service", "Service finden")}
                  </span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={pickLang(
                      language,
                      "Search by name, category, or tags",
                      "Nach Name, Kategorie oder Tags suchen"
                    )}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
                    aria-label={pickLang(language, "Search service cards", "Service-Karten durchsuchen")}
                  />
                </label>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {pickLang(language, "Visible", "Sichtbar")}
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {filteredCards.length}/{cards.length}
                  </p>
                </div>
              </div>

              <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {primaryFilterOptions.map((option) => {
                  const isActive = activeFilter === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setActiveFilter((previous) => (previous === option.key ? "all" : option.key))}
                      className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition-colors ${
                        isActive
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      }`}
                      aria-pressed={isActive}
                    >
                      {option.key === "favorites" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star size={12} className={isActive ? "fill-current" : ""} />
                          {option.label}
                        </span>
                      ) : (
                        option.label
                      )}
                    </button>
                  );
                })}
              </div>

              {categoryFilterOptions.length > 0 ? (
                <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {categoryFilterOptions.map((option) => {
                    const isActive = activeFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setActiveFilter((previous) => (previous === option.key ? "all" : option.key))}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                          isActive
                            ? "border-white/15 bg-white/10 text-foreground"
                            : "border-white/10 bg-black/15 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                        }`}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex rounded-full border border-white/10 bg-black/15 p-1">
                  {sortOptions.map((option) => {
                    const isActive = sortBy === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSortBy(option.key)}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                          isActive ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {hasActiveRefinements ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("all");
                      setSearchQuery("");
                    }}
                    className="shrink-0 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-white/10"
                  >
                    {pickLang(language, "Reset", "Zurücksetzen")}
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {pickLang(language, "Focused live feed", "Fokussierter Live-Feed")}
                  </p>
                )}
              </div>

              {hasActiveRefinements ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {activeFilterLabel
                    ? `${pickLang(language, "Filter", "Filter")}: ${activeFilterLabel}`
                    : pickLang(language, "Custom search is active", "Benutzerdefinierte Suche ist aktiv")}
                  {hasActiveSearch ? ` · ${pickLang(language, "Search", "Suche")}: ${deferredSearchQuery.trim()}` : ""}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {cards.length === 0 ? (
          isRefreshing ? (
            <div className="mt-4 space-y-4">
              <div className="glass glass-specular h-40 rounded-2xl" />
              <div className="glass glass-specular h-40 rounded-2xl" />
            </div>
          ) : null
        ) : filteredCards.length === 0 ? (
          <div className="glass glass-specular mt-4 rounded-2xl p-4">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-foreground">
                {pickLang(language, "No services match the current view", "Keine Services passen zur aktuellen Ansicht")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "Reset the current search or filter to bring cards back into the feed.",
                  "Setze die aktuelle Suche oder den Filter zurueck, damit wieder Karten im Feed erscheinen."
                )}
              </p>
              {hasActiveRefinements ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-3 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
                >
                  {pickLang(language, "Clear search and filters", "Suche und Filter loeschen")}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <section
            aria-label={pickLang(language, "Service feed", "Service-Feed")}
            className={`mt-4 ${homeCompactCards ? "space-y-2.5" : "space-y-4"}`}
          >
            {filteredCards.map((card) => {
              const isFavorite = isFavoriteService(card.serviceId);
              return (
                <div key={card.serviceId} className="relative">
                  <ServerCard
                    server={card.server}
                    compact={homeCompactCards}
                    reserveTopRightSpace
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleFavoriteService(card.serviceId);
                    }}
                    className={`absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-[0_4px_16px_rgba(0,0,0,0.28)] transition-colors ${
                      isFavorite
                        ? "border-amber-300/40 bg-amber-300/18 text-amber-200"
                        : "border-white/20 bg-black/25 text-muted-foreground hover:bg-white/10"
                    }`}
                    aria-label={
                      isFavorite
                        ? pickLang(language, "Remove from favorites", "Aus Favoriten entfernen")
                        : pickLang(language, "Add to favorites", "Zu Favoriten hinzufügen")
                    }
                  >
                    <Star size={15} className={isFavorite ? "fill-current" : ""} />
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {isDataStale ? (
          <div
            className={`mt-4 rounded-2xl border px-3 py-2.5 text-[11px] ${
              isDataVeryStale
                ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
                : "border-amber-300/20 bg-amber-300/10 text-amber-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {pickLang(
                    language,
                    "Live data refresh may be delayed",
                    "Live-Datenaktualisierung möglicherweise verzögert"
                  )}
                </p>
                <p className="mt-0.5 opacity-90">
                  {pickLang(
                    language,
                    `Latest status update is ${formatAgeMinutes(dataAgeMinutes)} old.`,
                    `Das letzte erfolgreiche Statusupdate ist ${formatAgeMinutes(dataAgeMinutes)} alt.`
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <Link
          to="/alerts"
          className="glass glass-specular mt-4 block rounded-2xl p-4 transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Bell size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {pickLang(language, "Alerts", "Alarme")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {pickLang(
                    language,
                    "Manage your alert account, watchlist, and e-mail delivery",
                    "Alarm-Konto, Watchlist und E-Mail-Zustellung verwalten"
                  )}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </Link>

        {errorMessages.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-200">
            <p>
              {pickLang(
                language,
                "Some services could not be refreshed right now. The latest available status remains visible while automatic retries continue.",
                "Einige Services konnten gerade nicht aktualisiert werden. Der zuletzt verfügbare Status bleibt sichtbar, während automatische Wiederholungen weiterlaufen."
              )}
            </p>
            <p className="mt-1 opacity-90">
              {pickLang(
                language,
                `${errorMessages.length} refresh requests failed during the latest update.`,
                `${errorMessages.length} Aktualisierungsanfragen sind bei der letzten Aktualisierung fehlgeschlagen.`
              )}
            </p>
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
};

export default Index;
