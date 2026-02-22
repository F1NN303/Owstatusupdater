import AppLayout from "@/components/AppLayout";
import OverallStatus from "@/components/OverallStatus";
import ServerCard from "@/components/ServerCard";
import type { ServerService, Status } from "@/data/servers";
import { pickLang, useAppShell } from "@/lib/appShell";
import {
  fetchLegacyServiceDetail,
  type LegacyDetailServiceId,
  type LegacyOutageIncident,
  type LegacyServiceDetailResult,
} from "@/lib/legacyServiceDetail";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type OverallState = "all-good" | "some-issues" | "major-outage";

interface HomeServiceCard {
  serviceId: LegacyDetailServiceId;
  server: ServerService;
  generatedAt: string | null;
  error?: string;
}

const LIVE_SERVICE_IDS: LegacyDetailServiceId[] = ["overwatch", "sony"];
const DAY_MS = 24 * 60 * 60 * 1000;

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

function toneToStatus(tone: LegacyServiceDetailResult["tone"]): Status {
  if (tone === "good") {
    return "online";
  }
  if (tone === "bad") {
    return "offline";
  }
  return "degraded";
}

function severityWordToLevel(
  detail: LegacyServiceDetailResult,
  incident: LegacyOutageIncident
): 0 | 0.5 {
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

  let hasOverlap = false;

  for (const incident of incidents) {
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
        hasOverlap = true;
      }
    }
  }

  if (!hasOverlap) {
    if (detail.tone === "warn") {
      history[28] = 0.5;
      history[29] = 0.5;
    } else if (detail.tone === "bad") {
      history[27] = 0.5;
      history[28] = 0;
      history[29] = 0;
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
  const reports24h = detail.payload.outage?.reports_24h ?? detail.payload.analytics?.signal_metrics?.reports_24h ?? 0;

  if (bins.every((value) => value === 0)) {
    return Array.from({ length: 24 }, (_, i) => {
      const wave = Math.sin((i + 1) * 0.8) * 4;
      const trendBoost = detail.tone === "warn" ? 4 : detail.tone === "bad" ? 8 : 0;
      return Math.max(4, severityOffset + trendBoost + wave + combinedScore * 2);
    });
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

function deriveMetricLabel(detail: LegacyServiceDetailResult) {
  const ok = detail.payload.analytics?.source_ok_count;
  const total = detail.payload.analytics?.source_total_count;
  if (typeof ok === "number" && typeof total === "number" && total > 0) {
    return `${ok}/${total} sources`;
  }

  const reports24h = detail.payload.outage?.reports_24h ?? detail.payload.analytics?.signal_metrics?.reports_24h;
  if (typeof reports24h === "number") {
    return `${reports24h} reports/24h`;
  }

  return "Live signals";
}

function buildServerCard(detail: LegacyServiceDetailResult): HomeServiceCard {
  const uptimeHistory = buildTrendHistory(detail);
  const score = trendPercent(uptimeHistory);
  const responseHistory = buildActivitySparkline(detail);
  const status = toneToStatus(detail.tone);

  const name = detail.service.id === "sony" ? "PlayStation Network" : "Overwatch";
  const icon = detail.service.id === "sony" ? "Tv" : "Gamepad2";

  const server: ServerService = {
    id: detail.service.id,
    name,
    icon,
    status,
    uptime: Number(score.toFixed(2)),
    metricLabel: deriveMetricLabel(detail),
    trendLabel: "30-day signal trend",
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
  };
}

function buildErrorCard(serviceId: LegacyDetailServiceId, error: string): HomeServiceCard {
  const name = serviceId === "sony" ? "PlayStation Network" : "Overwatch";
  const icon = serviceId === "sony" ? "Tv" : "Gamepad2";
  const uptimeHistory = Array.from({ length: 30 }, () => 0.5);
  const responseHistory = Array.from({ length: 24 }, (_, i) => 26 + Math.sin(i * 0.6) * 2);

  return {
    serviceId,
    generatedAt: null,
    error,
    server: {
      id: serviceId,
      name,
      icon,
      status: "degraded",
      uptime: 50,
      metricLabel: "Live data unavailable",
      trendLabel: "Status pipeline",
      trendValueLabel: "Fetch error",
      uptimeHistory,
      responseHistory,
      incidents: [],
      services: [],
    },
  };
}

function formatHeaderSubtitle(lastRefreshAt: string | null, language: "en" | "de") {
  if (!lastRefreshAt) {
    return pickLang(language, "Live monitoring · Fetching live status", "Live-Monitoring · Lade Live-Status");
  }

  const refreshed = parseDate(lastRefreshAt);
  if (!refreshed) {
    return pickLang(language, "Live monitoring", "Live-Monitoring");
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - refreshed.getTime()) / 1000));
  if (diffSeconds < 15) {
    return pickLang(language, "Live monitoring · Updated just now", "Live-Monitoring · Gerade aktualisiert");
  }
  if (diffSeconds < 60) {
    return pickLang(
      language,
      `Live monitoring · Updated ${diffSeconds}s ago`,
      `Live-Monitoring · Vor ${diffSeconds}s aktualisiert`
    );
  }

  const timeLabel = refreshed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return pickLang(
    language,
    `Live monitoring · Updated ${timeLabel}`,
    `Live-Monitoring · Aktualisiert ${timeLabel}`
  );
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
  const { language } = useAppShell();
  const [cards, setCards] = useState<HomeServiceCard[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const loadCards = async () => {
    setIsRefreshing(true);

    try {
      const results = await Promise.allSettled(
        LIVE_SERVICE_IDS.map((serviceId) => fetchLegacyServiceDetail(serviceId))
      );

      const nextCards: HomeServiceCard[] = [];
      const nextErrors: string[] = [];

      for (let i = 0; i < results.length; i += 1) {
        const serviceId = LIVE_SERVICE_IDS[i];
        const result = results[i];

        if (result.status === "fulfilled") {
          nextCards.push(buildServerCard(result.value));
          continue;
        }

        const reason =
          result.reason instanceof Error ? result.reason.message : "Unknown fetch error";
        nextErrors.push(`${serviceId}: ${reason}`);
        nextCards.push(buildErrorCard(serviceId, reason));
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
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const overallState = useMemo(
    () => overallStateFromCards(cards, errorMessages.length > 0),
    [cards, errorMessages.length]
  );
  const onlineCount = useMemo(
    () => cards.filter((card) => card.server.status === "online").length,
    [cards]
  );
  const subtitle = useMemo(
    () => formatHeaderSubtitle(lastRefreshAt, language),
    [lastRefreshAt, language]
  );

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-8">
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
          <div className="glass glass-specular h-[84px] animate-fade-in-up rounded-2xl" />
        ) : (
          <div className="animate-fade-in-up">
            <OverallStatus
              state={overallState}
              onlineCount={onlineCount}
              totalCount={cards.length}
            />
          </div>
        )}

        {cards.length === 0 ? (
          <div className="mt-4 space-y-4">
            <div className="glass glass-specular h-40 rounded-2xl" />
            <div className="glass glass-specular h-40 rounded-2xl" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {cards.map((card, index) => (
              <div
                key={card.serviceId}
                className="animate-fade-in-up"
                style={{ animationDelay: `${(index + 1) * 60}ms` }}
              >
                <ServerCard server={card.server} index={index} />
              </div>
            ))}
          </div>
        )}

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
                    "Aktuelle Anmeldeseite fuer Stoerungs-Benachrichtigungen öffnen"
                  )}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </Link>

        {errorMessages.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-200">
            {pickLang(
              language,
              "Some live sources failed to load. Cards stay available and will retry automatically.",
              "Einige Live-Quellen konnten nicht geladen werden. Karten bleiben sichtbar und werden automatisch erneut geladen."
            )}
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
};

export default Index;
