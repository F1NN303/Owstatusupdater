import AppLayout from "@/components/AppLayout";
import OverallStatus from "@/components/OverallStatus";
import ServerCard from "@/components/ServerCard";
import type { ServerService, Status } from "@/data/servers";
import { pickLang, useAppShell } from "@/lib/appShell";
import { formatTimestampByMode } from "@/lib/timeDisplay";
import {
  fetchLegacyServiceDetail,
  type LegacyOutageIncident,
  type LegacyServiceDetailResult,
} from "@/lib/legacyServiceDetail";
import { getLegacyLiveStatusServices } from "@/lib/legacyStatus";
import { Bell, ChevronRight, RefreshCw, Star, TriangleAlert } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type OverallState = "all-good" | "some-issues" | "major-outage";
type HomeFilterKey = "all" | "issues" | "healthy" | `category:${string}`;
type HomeSortKey = "impact" | "name" | "updated";

interface HomeServiceCard {
  serviceId: string;
  server: ServerService;
  generatedAt: string | null;
  serviceNote?: string;
  serviceCategory: string;
  servicePriority: number;
  serviceTags: string[];
  error?: string;
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

function buildServerCard(detail: LegacyServiceDetailResult, language: "en" | "de"): HomeServiceCard {
  const uptimeHistory = buildTrendHistory(detail);
  const score = trendPercent(uptimeHistory);
  const responseHistory = buildActivitySparkline(detail);
  const status = severityToStatus(detail.severity, detail.tone);

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
        return freshness && freshness !== "fresh" && freshness !== "warm";
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
    serviceNote: detail.service.note,
    serviceCategory: String(detail.service.category || "general").toLowerCase(),
    servicePriority:
      typeof detail.service.priority === "number" && Number.isFinite(detail.service.priority)
        ? detail.service.priority
        : 1000,
    serviceTags: Array.isArray(detail.service.tags)
      ? detail.service.tags.map((tag) => String(tag || "").toLowerCase()).filter(Boolean)
      : [],
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
  if (value === "issues" || value === "healthy") {
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
  if (cards.some((card) => card.server.status === "offline")) {
    return "major-outage";
  }
  if (hasErrors || cards.some((card) => card.server.status === "degraded")) {
    return "some-issues";
  }
  return "all-good";
}

const Index = () => {
  const {
    language,
    isFavoriteService,
    toggleFavoriteService,
    homeDefaultFilter,
    homeDefaultSort,
    homeRefreshIntervalSec,
    homeCompactCards,
    timeDisplayMode,
  } = useAppShell();
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

  const loadCards = async () => {
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

      setCards(nextCards);
      setErrorMessages(nextErrors);
      setLastRefreshAt(
        generatedTimes[0]?.toISOString() || new Date().toISOString()
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadCards();
    const timer = window.setInterval(() => {
      void loadCards();
    }, homeRefreshIntervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [homeRefreshIntervalSec, language]);

  const overallState = useMemo(
    () => overallStateFromCards(cards, errorMessages.length > 0),
    [cards, errorMessages.length]
  );
  const onlineCount = useMemo(
    () => cards.filter((card) => card.server.status === "online").length,
    [cards]
  );
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
      ...categoryFilters.map((category) => ({
        key: `category:${category}` as HomeFilterKey,
        label: categoryLabel(category, language),
      })),
    ],
    [categoryFilters, language]
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
  }, [activeFilter, cards, deferredSearchQuery, sortBy]);

  useEffect(() => {
    if (!activeFilter.startsWith("category:")) {
      return;
    }
    const activeCategory = activeFilter.replace("category:", "");
    if (!categoryFilters.includes(activeCategory)) {
      setActiveFilter("all");
    }
  }, [activeFilter, categoryFilters]);

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Server Status", "Server-Status")}
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
          <div className="glass glass-specular h-[84px] rounded-2xl" />
        ) : cards.length > 0 ? (
          <div>
            <OverallStatus
              state={overallState}
              onlineCount={onlineCount}
              totalCount={cards.length}
            />
          </div>
        ) : (
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-foreground">
                {pickLang(language, "No live service data loaded", "Keine Live-Service-Daten geladen")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "Cards are shown only when the live API/JSON response loads successfully.",
                  "Karten werden nur angezeigt, wenn die Live-API/JSON-Antwort erfolgreich geladen wird."
                )}
              </p>
            </div>
          </div>
        )}

        {cards.length > 0 ? (
          <div className="mt-4">
            <div className="glass rounded-2xl px-3 py-2.5">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {pickLang(language, "Search services", "Services suchen")}
              </label>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={pickLang(
                  language,
                  "Search by name, category, or tags",
                  "Nach Name, Kategorie oder Tags suchen"
                )}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
                aria-label={pickLang(
                  language,
                  "Search service cards",
                  "Service-Karten durchsuchen"
                )}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="glass rounded-xl px-2.5 py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Filter", "Filter")}
                </span>
                <select
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as HomeFilterKey)}
                  className="mt-1 w-full bg-transparent text-xs font-semibold text-foreground outline-none"
                  aria-label={pickLang(language, "Filter services", "Services filtern")}
                >
                  {filterOptions.map((option) => (
                    <option key={option.key} value={option.key} className="bg-[#0B1324] text-foreground">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="glass rounded-xl px-2.5 py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Sort", "Sortierung")}
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as HomeSortKey)}
                  className="mt-1 w-full bg-transparent text-xs font-semibold text-foreground outline-none"
                  aria-label={pickLang(language, "Sort services", "Services sortieren")}
                >
                  {sortOptions.map((option) => (
                    <option key={option.key} value={option.key} className="bg-[#0B1324] text-foreground">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {pickLang(
                language,
                `Showing ${filteredCards.length}/${cards.length} services`,
                `${filteredCards.length}/${cards.length} Services angezeigt`
              )}
            </p>
          </div>
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
                {pickLang(language, "No services match the current filters", "Keine Services passen zu den Filtern")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "Adjust search, filter, or sort to show cards again.",
                  "Passe Suche, Filter oder Sortierung an, um Karten wieder anzuzeigen."
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className={`mt-4 ${homeCompactCards ? "space-y-2.5" : "space-y-4"}`}>
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
          </div>
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
                    `Latest successful payload is ${formatAgeMinutes(dataAgeMinutes)} old.`,
                    `Der letzte erfolgreiche Payload ist ${formatAgeMinutes(dataAgeMinutes)} alt.`
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
                  {pickLang(language, "E-Mail Alerts", "E-Mail-Alarme")}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {pickLang(
                    language,
                    "Open the current signup page for outage notifications",
                    "Aktuelle Anmeldeseite für Störungs-Benachrichtigungen öffnen"
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
                "Some live sources failed to load. Only successfully loaded API data is shown. Automatic retries stay active.",
                "Einige Live-Quellen konnten nicht geladen werden. Es werden nur erfolgreich geladene API-Daten angezeigt. Automatische Wiederholungen bleiben aktiv."
              )}
            </p>
            <p className="mt-1 opacity-90">
              {pickLang(
                language,
                `${errorMessages.length} source requests failed during the latest refresh.`,
                `${errorMessages.length} Quellenanfragen sind bei der letzten Aktualisierung fehlgeschlagen.`
              )}
            </p>
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
};

export default Index;
