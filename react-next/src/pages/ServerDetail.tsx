import AppLayout from "@/components/AppLayout";
import MiniSparkline from "@/components/MiniSparkline";
import StatusBadge from "@/components/StatusBadge";
import UptimeBar from "@/components/UptimeBar";
import { getIconComponent, type Status } from "@/data/servers";
import { pickLang, useAppShell } from "@/lib/appShell";
import { resolveLegacyUrl } from "@/lib/legacySite";
import {
  fetchLegacyServiceDetail,
  type LegacyDetailServiceId,
  type LegacyLinkItem,
  type LegacyOutageIncident,
  type LegacyServiceDetailResult,
  type LegacySourceHealth,
} from "@/lib/legacyServiceDetail";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

const TONE_STYLES = {
  good: {
    dot: "bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.35)]",
    chip: "border-emerald-300/20 bg-emerald-400/10 text-emerald-300",
  },
  warn: {
    dot: "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]",
    chip: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  },
  bad: {
    dot: "bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.35)]",
    chip: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  },
  unknown: {
    dot: "bg-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.22)]",
    chip: "border-white/10 bg-white/5 text-slate-300",
  },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
type DetailTabKey = "overview" | "incidents" | "analysis" | "sources";
type SwipeAxisLock = "x" | "y" | null;

interface TabSwipeSession {
  startX: number;
  startY: number;
  width: number;
  axisLock: SwipeAxisLock;
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

function parseMaybeDate(value?: string | null) {
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
  const text = String(value).toLowerCase();
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function incidentLevel(
  detail: LegacyServiceDetailResult,
  incident: LegacyOutageIncident
): 0 | 0.5 {
  const text = `${incident.title || ""} ${incident.acknowledgement || ""}`.toLowerCase();
  if (detail.tone === "bad" || text.includes("outage") || text.includes("offline")) {
    return 0;
  }
  return 0.5;
}

function buildSignalTrend(detail: LegacyServiceDetailResult) {
  const generatedAt = parseMaybeDate(detail.payload.generated_at) ?? new Date();
  const endMs = generatedAt.getTime();
  const windowStartMs = startOfDay(new Date(endMs - 29 * DAY_MS)).getTime();
  const history = Array.from({ length: 30 }, () => 1);
  const incidents = Array.isArray(detail.payload.outage?.incidents)
    ? detail.payload.outage?.incidents
    : [];

  let hasIncidentOverlap = false;

  for (const incident of incidents) {
    const startedAt = parseMaybeDate(incident.started_at);
    if (!startedAt) {
      continue;
    }
    const startMs = startedAt.getTime();
    const durationMs = parseDurationToMs(incident.duration);
    const incidentEndMs = durationMs === null ? endMs : startMs + durationMs;

    if (incidentEndMs <= windowStartMs || startMs >= endMs + DAY_MS) {
      continue;
    }

    const level = incidentLevel(detail, incident);
    for (let i = 0; i < history.length; i += 1) {
      const dayStartMs = windowStartMs + i * DAY_MS;
      const dayEndMs = dayStartMs + DAY_MS;
      if (startMs < dayEndMs && incidentEndMs > dayStartMs) {
        history[i] = Math.min(history[i], level);
        hasIncidentOverlap = true;
      }
    }
  }

  if (!hasIncidentOverlap) {
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

function buildSignalSparkline(detail: LegacyServiceDetailResult) {
  const generatedAt = parseMaybeDate(detail.payload.generated_at) ?? new Date();
  const nowMs = generatedAt.getTime();
  const bins = Array.from({ length: 24 }, () => 0);

  const addSample = (value: string | null | undefined, weight: number) => {
    const parsed = parseMaybeDate(value);
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
    addSample(item.published_at, 1);
  }
  for (const item of detail.payload.news || []) {
    addSample(item.published_at, 0.5);
  }
  for (const incident of detail.payload.outage?.incidents || []) {
    addSample(incident.started_at, 2.5);
  }

  const base = detail.tone === "bad" ? 55 : detail.tone === "warn" ? 34 : 16;
  const combinedScore = detail.payload.analytics?.signal_metrics?.cross_source?.combined_score ?? 0;
  const reports24h =
    detail.payload.outage?.reports_24h ??
    detail.payload.analytics?.signal_metrics?.reports_24h ??
    0;

  if (bins.every((value) => value === 0)) {
    return Array.from({ length: 24 }, (_, i) => {
      const wave = Math.sin((i + 1) * 0.8) * 4;
      const offset = detail.tone === "warn" ? 4 : detail.tone === "bad" ? 8 : 0;
      return Math.max(4, base + offset + wave + combinedScore * 2);
    });
  }

  return bins.map((value, i) => {
    const smoothed =
      (bins[Math.max(0, i - 1)] + value + bins[Math.min(23, i + 1)]) / 3;
    const scaled = base + smoothed * 18 + combinedScore * 2 + Math.min(reports24h, 40) * 0.15;
    return Math.max(4, Math.min(140, scaled));
  });
}

function signalPercent(history: number[]) {
  if (!history.length) {
    return null;
  }
  const avg = history.reduce((sum, value) => sum + value, 0) / history.length;
  return avg * 100;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value >= 99 ? value.toFixed(2) : value.toFixed(1)}%`;
}

function shortMetricLabel(detail: LegacyServiceDetailResult) {
  const ok = detail.payload.analytics?.source_ok_count;
  const total = detail.payload.analytics?.source_total_count;
  if (typeof ok === "number" && typeof total === "number" && total > 0) {
    return `${ok}/${total} sources`;
  }
  const reports24h =
    detail.payload.outage?.reports_24h ??
    detail.payload.analytics?.signal_metrics?.reports_24h;
  if (typeof reports24h === "number") {
    return `${reports24h} reports/24h`;
  }
  return "Live signals";
}

function normalizeDetailId(id?: string): LegacyDetailServiceId | null {
  const key = String(id || "").toLowerCase();
  if (key === "overwatch" || key === "ow") {
    return "overwatch";
  }
  if (key === "sony" || key === "psn" || key === "playstation" || key === "playstation-network") {
    return "sony";
  }
  return null;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "Unknown";
  }
  return parsed.toLocaleString();
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
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

function clampList<T>(value: T[] | undefined, max = 6) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SignalChartCard({
  title,
  valueLabel,
  subtitle,
  children,
}: {
  title: string;
  valueLabel?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="glass glass-specular rounded-2xl p-4">
      <div className="relative z-10">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {valueLabel ? (
            <p className="shrink-0 text-lg font-bold tracking-tight text-foreground">
              {valueLabel}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function pickNiceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }
  const steps = [10, 20, 40, 60, 80, 100, 120, 160, 200];
  for (const step of steps) {
    if (value <= step) {
      return step;
    }
  }
  return Math.ceil(value / 50) * 50;
}

function SignalActivityChart({ data }: { data: number[] }) {
  const width = 320;
  const height = 150;
  const top = 8;
  const right = 8;
  const bottom = 8;
  const left = 4;
  const maxValue = pickNiceMax(Math.max(...data, 1));
  const xStep = (width - left - right) / Math.max(1, data.length - 1);
  const innerHeight = height - top - bottom;

  const points = data
    .map((value, index) => {
      const x = left + index * xStep;
      const y = top + innerHeight - (Math.max(0, value) / maxValue) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const gridRows = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 6, 12, 18];

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-[150px] flex-col justify-between pb-0.5 pt-1 text-[11px] text-muted-foreground">
          {gridRows.map((ratio) => (
            <span key={ratio}>{Math.round(maxValue * (1 - ratio))}</span>
          ))}
        </div>
        <div className="flex-1">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full">
            {gridRows.map((ratio) => {
              const y = top + ratio * innerHeight;
              return (
                <line
                  key={`gy-${ratio}`}
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.12)"
                  strokeDasharray="3 4"
                />
              );
            })}
            {xTicks.map((tick) => {
              const index = Math.min(data.length - 1, tick);
              const x = left + index * xStep;
              return (
                <line
                  key={`gx-${tick}`}
                  x1={x}
                  x2={x}
                  y1={top}
                  y2={height - bottom}
                  stroke="rgba(148,163,184,0.09)"
                  strokeDasharray="3 5"
                />
              );
            })}
            <polyline
              points={points}
              fill="none"
              stroke="hsl(199 89% 48%)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          </svg>
          <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>24h</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DailySignalBars({ values }: { values: number[] }) {
  const labels = [1, 6, 11, 16, 21, 26];

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-[120px] flex-col justify-between text-[11px] text-muted-foreground">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0">
            {[0, 25, 50, 75, 100].map((tick) => (
              <div
                key={tick}
                className="absolute left-0 right-0 border-t border-dashed border-white/10"
                style={{ bottom: `${tick}%` }}
              />
            ))}
          </div>
          <div className="relative flex h-[120px] items-end gap-[3px] pt-1">
            {values.map((value, index) => {
              const height = Math.max(2, Math.min(100, value));
              const toneClass =
                value >= 99
                  ? "bg-status-online/80"
                  : value >= 70
                    ? "bg-status-degraded/80"
                    : "bg-status-offline/85";
              return (
                <div
                  key={`bar-${index}`}
                  className={`flex-1 rounded-[3px] ${toneClass}`}
                  style={{ height: `${height}%` }}
                  title={`Day ${index + 1}: ${value.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between px-[2px] text-[11px] text-muted-foreground">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
            <span>30</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function inferServiceComponents(
  serviceId: LegacyDetailServiceId,
  detail: LegacyServiceDetailResult
): Array<{ name: string; status: Status }> {
  const catalog =
    serviceId === "sony"
      ? ["Gaming & Social", "Account Management", "PlayStation Store", "PlayStation Video"]
      : ["Game Servers", "Authentication", "Matchmaking", "Shop & Store"];

  const overall = toneToStatus(detail.tone);
  const incidentText = [
    detail.payload.outage?.summary,
    ...(detail.payload.outage?.incidents || []).slice(0, 6).map((incident) => incident.title || ""),
  ]
    .join(" ")
    .toLowerCase();

  const map = new Map<string, Status>(catalog.map((name) => [name, "online"]));
  const mark = (keywords: string[], target: string) => {
    if (keywords.some((keyword) => incidentText.includes(keyword))) {
      map.set(target, overall === "offline" ? "offline" : "degraded");
      return true;
    }
    return false;
  };

  if (serviceId === "sony") {
    const hitStore = mark(["store"], "PlayStation Store");
    const hitAccount = mark(["sign", "account", "login"], "Account Management");
    const hitSocial = mark(["gaming", "social", "network", "multiplayer"], "Gaming & Social");
    if (overall !== "online" && !hitStore && !hitAccount && !hitSocial) {
      map.set("Gaming & Social", overall);
    }
  } else {
    const hitAuth = mark(["login", "auth", "sign in", "queue"], "Authentication");
    const hitMatch = mark(["match", "queue", "competitive"], "Matchmaking");
    const hitStore = mark(["shop", "store"], "Shop & Store");
    const hitGame = mark(["server", "connection", "game"], "Game Servers");
    if (overall !== "online" && !hitAuth && !hitMatch && !hitStore && !hitGame) {
      map.set("Game Servers", overall);
    }
  }

  return catalog.map((name) => ({ name, status: map.get(name) || "online" }));
}

function incidentToneClass(incident: LegacyOutageIncident) {
  const text = `${incident.title || ""} ${incident.acknowledgement || ""}`.toLowerCase();
  if (text.includes("outage") || text.includes("offline")) {
    return "bg-status-offline";
  }
  if (
    text.includes("degraded") ||
    text.includes("issue") ||
    text.includes("queue") ||
    text.includes("maintenance")
  ) {
    return "bg-status-degraded";
  }
  return "bg-status-online";
}

const DETAIL_TABS: Array<{ key: DetailTabKey }> = [
  { key: "overview" },
  { key: "incidents" },
  { key: "analysis" },
  { key: "sources" },
];

function LinkListSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: LegacyLinkItem[];
  emptyText: string;
}) {
  return (
    <section className="glass glass-specular rounded-2xl p-4">
      <div className="relative z-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        <div className="mt-3 space-y-2.5">
          {items.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            items.map((item, index) => (
              <a
                key={`${item.url || item.title || "item"}-${index}`}
                href={item.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10"
              >
                <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                  {item.title || "Untitled item"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  {item.source ? <span>{item.source}</span> : null}
                  {item.published_at ? <span>{formatDateTime(item.published_at)}</span> : null}
                  {item.meta ? <span>{item.meta}</span> : null}
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

const ServerDetail = () => {
  const { language } = useAppShell();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serviceId = normalizeDetailId(id);
  const [detail, setDetail] = useState<LegacyServiceDetailResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTabKey>("overview");
  const [tabDragOffset, setTabDragOffset] = useState(0);
  const [isTabDragging, setIsTabDragging] = useState(false);
  const tabSwipeSessionRef = useRef<TabSwipeSession | null>(null);

  const loadDetail = async (mode: "initial" | "refresh" = "initial") => {
    if (!serviceId) {
      return;
    }
    if (mode === "initial") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorText(null);

    try {
      const next = await fetchLegacyServiceDetail(serviceId);
      setDetail(next);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!serviceId) {
      setIsLoading(false);
      return;
    }
    void loadDetail("initial");
    const timer = window.setInterval(() => {
      void loadDetail("refresh");
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [serviceId]);

  const outageIncidents = useMemo(
    () => clampList<LegacyOutageIncident>(detail?.payload.outage?.incidents, 8),
    [detail]
  );
  const reportItems = useMemo(
    () => clampList<LegacyLinkItem>(detail?.payload.reports, 6),
    [detail]
  );
  const officialItems = useMemo(
    () => clampList<LegacyLinkItem>(detail?.payload.official?.updates, 4),
    [detail]
  );
  const newsItems = useMemo(() => clampList<LegacyLinkItem>(detail?.payload.news, 4), [detail]);
  const socialItems = useMemo(() => clampList<LegacyLinkItem>(detail?.payload.social, 4), [detail]);
  const knownItems = useMemo(
    () => clampList<LegacyLinkItem>(detail?.payload.known_resources, 4),
    [detail]
  );
  const sources = useMemo(
    () => clampList<LegacySourceHealth>(detail?.payload.sources, 8),
    [detail]
  );
  const regionEntries = useMemo(() => {
    const regions = detail?.payload.regions || {};
    return Object.entries(regions).map(([regionKey, regionValue]) => ({
      key: regionKey.toUpperCase(),
      severityKey: String(regionValue?.severity_key || "unknown"),
      score:
        typeof regionValue?.severity_score === "number" ? regionValue.severity_score : null,
      weight:
        typeof regionValue?.report_weight === "number"
          ? Math.round(regionValue.report_weight * 100)
          : null,
    }));
  }, [detail]);

  if (!serviceId) {
    return (
      <AppLayout>
        <main className="mx-auto max-w-md px-4 pb-28 pt-12">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="glass mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="glass rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground">Service not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Supported routes: <code>/status/overwatch</code> and <code>/status/sony</code>
            </p>
          </div>
        </main>
      </AppLayout>
    );
  }

  const tone = detail ? TONE_STYLES[detail.tone] : TONE_STYLES.unknown;
  const severityLabel = detail ? detail.severity.toUpperCase() : "LOADING";
  const reports24h =
    detail?.payload.analytics?.signal_metrics?.reports_24h ?? detail?.payload.outage?.reports_24h ?? "--";
  const severityScore = detail?.payload.analytics?.severity_score ?? "--";
  const modelVersion = detail?.payload.analytics?.model_version ?? "--";
  const sourceOkCount = detail?.payload.analytics?.source_ok_count ?? "--";
  const sourceTotalCount = detail?.payload.analytics?.source_total_count ?? "--";
  const changeSummary = detail?.payload.changes?.summary;
  const serviceStatus = detail ? toneToStatus(detail.tone) : "degraded";
  const serviceIconName = serviceId === "sony" ? "Tv" : "Gamepad2";
  const ServiceIcon = getIconComponent(serviceIconName);
  const trendHistory = detail ? buildSignalTrend(detail) : Array.from({ length: 30 }, () => 0.5);
  const sparklineData = detail
    ? buildSignalSparkline(detail)
    : Array.from({ length: 24 }, (_, i) => 24 + Math.sin(i * 0.8) * 3);
  const trendScore = detail ? signalPercent(trendHistory) : null;
  const trendScoreLabel = formatPercent(trendScore);
  const incidentCount = outageIncidents.length;
  const stableRegionCount = regionEntries.filter(
    (region) => region.severityKey === "stable"
  ).length;
  const impactedRegionCount = regionEntries.filter(
    (region) => region.severityKey !== "stable"
  ).length;
  const latestIncidentTitle = outageIncidents[0]?.title || "No active incidents";
  const quickMetricLabel = detail ? shortMetricLabel(detail) : "Live signals";
  const dailySignalPercentages = trendHistory.map((value) => Math.round(value * 100));
  const componentRows = detail ? inferServiceComponents(serviceId, detail) : [];
  const activeTabIndex = DETAIL_TABS.findIndex((tab) => tab.key === activeTab);
  const lastTabIndex = DETAIL_TABS.length - 1;
  const indicatorVisualIndex = Math.max(
    0,
    Math.min(lastTabIndex, activeTabIndex + tabDragOffset)
  );
  const indicatorStretch = 1 + Math.min(0.1, Math.abs(tabDragOffset) * 0.08);
  const detailTabLabel = (key: DetailTabKey) => {
    if (key === "overview") {
      return pickLang(language, "Overview", "Uebersicht");
    }
    if (key === "incidents") {
      return pickLang(language, "Incidents", "Vorfaelle");
    }
    if (key === "analysis") {
      return pickLang(language, "Analysis", "Analyse");
    }
    return pickLang(language, "Sources", "Quellen");
  };

  const beginTabSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const rect = event.currentTarget.getBoundingClientRect();
    tabSwipeSessionRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      width: Math.max(1, rect.width),
      axisLock: null,
    };
    setIsTabDragging(false);
    setTabDragOffset(0);
  };

  const moveTabSwipe = (event: ReactTouchEvent<HTMLDivElement>) => {
    const session = tabSwipeSessionRef.current;
    if (!session || event.touches.length !== 1 || activeTabIndex < 0) {
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - session.startX;
    const dy = touch.clientY - session.startY;

    if (session.axisLock === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        return;
      }
      session.axisLock = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    if (session.axisLock !== "x") {
      return;
    }

    let nextOffset = -(dx / session.width);
    if (activeTabIndex === 0 && nextOffset < 0) {
      nextOffset *= 0.25;
    }
    if (activeTabIndex === lastTabIndex && nextOffset > 0) {
      nextOffset *= 0.25;
    }

    setIsTabDragging(true);
    setTabDragOffset(Math.max(-0.95, Math.min(0.95, nextOffset)));

    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const endTabSwipe = () => {
    const session = tabSwipeSessionRef.current;
    tabSwipeSessionRef.current = null;

    if (!session || session.axisLock !== "x") {
      setIsTabDragging(false);
      setTabDragOffset(0);
      return;
    }

    let nextIndex = activeTabIndex;
    if (tabDragOffset > 0.22) {
      nextIndex = Math.min(lastTabIndex, activeTabIndex + 1);
    } else if (tabDragOffset < -0.22) {
      nextIndex = Math.max(0, activeTabIndex - 1);
    }

    if (nextIndex >= 0 && nextIndex !== activeTabIndex) {
      setActiveTab(DETAIL_TABS[nextIndex].key);
    }

    setIsTabDragging(false);
    setTabDragOffset(0);
  };

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-10">
        <div className="flex items-center justify-between gap-3 pb-4 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="glass flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
              aria-label="Go back"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {pickLang(language, "Live Service Detail", "Live-Service-Detail")}
              </p>
              <p className="text-sm font-medium text-foreground">
                {detail?.service.name || (serviceId === "overwatch" ? "Overwatch" : "Sony PSN")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadDetail("refresh")}
            className="glass flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
            aria-label="Refresh detail"
          >
            <RefreshCw
              size={16}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {isLoading && !detail ? (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">Loading live service detail...</p>
            </div>
            <div className="glass rounded-2xl p-4 h-24" />
            <div className="glass rounded-2xl p-4 h-40" />
          </div>
        ) : null}

        {errorText && !detail ? (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert size={18} className="mt-0.5 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-foreground">Failed to load live data</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{errorText}</p>
              </div>
            </div>
          </div>
        ) : null}

        {detail ? (
          <div className="space-y-4">
            <section className="glass-heavy glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <ServiceIcon size={19} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                        {pickLang(language, "Live Status Monitor", "Live-Status-Monitor")}
                      </p>
                      <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
                        {detail.service.name}
                      </h1>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {latestIncidentTitle}
                      </p>
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <MiniSparkline data={sparklineData} />
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusBadge status={serviceStatus} size="md" />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {quickMetricLabel}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-foreground">
                      {trendScoreLabel}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>30-day signal trend</span>
                      <span>{incidentCount} active incidents</span>
                    </div>
                    <UptimeBar data={trendHistory} />
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {detail.payload.outage?.summary ||
                    detail.payload.official?.summary ||
                    "Live service signals loaded from the current status JSON pipeline."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}>
                    Status: {severityLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                    Confidence: {detail.sourceConfidenceText}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                    Updated: {formatDateTime(detail.payload.generated_at)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground">
                    Regions: {stableRegionCount} stable / {impactedRegionCount} impacted
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={resolveLegacyUrl(detail.service.legacyHref || detail.service.href)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
                  >
                    Open full legacy dashboard
                    <ExternalLink size={13} />
                  </a>
                  {detail.payload.outage?.url ? (
                    <a
                      href={detail.payload.outage.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
                    >
                      Open source
                      <ExternalLink size={13} />
                    </a>
                  ) : null}
                </div>
              </div>
            </section>

            {errorText ? (
              <div className="glass rounded-2xl p-3 text-xs text-amber-300">
                Refresh error: {errorText}
              </div>
            ) : null}

            <section className="glass glass-specular rounded-2xl p-2">
              <div
                className="relative grid grid-cols-4 gap-1"
                style={{ touchAction: "pan-y" }}
                onTouchStart={beginTabSwipe}
                onTouchMove={moveTabSwipe}
                onTouchEnd={endTabSwipe}
                onTouchCancel={endTabSwipe}
              >
                <span
                  className="pointer-events-none absolute bottom-1 top-1 rounded-xl border border-white/10 bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_8px_24px_rgba(0,0,0,0.22),0_0_18px_rgba(87,177,255,0.08)]"
                  style={{
                    left: "0.25rem",
                    width: "calc(25% - 0.5rem)",
                    opacity: 0.88 + Math.min(0.12, Math.abs(tabDragOffset) * 0.12),
                    transform: `translate3d(${indicatorVisualIndex * 100}%, 0, 0) scaleX(${indicatorStretch})`,
                    transition: isTabDragging
                      ? "none"
                      : "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease",
                  }}
                  aria-hidden="true"
                />
                {DETAIL_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative z-10 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors duration-200 ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {detailTabLabel(tab.key)}
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className="space-y-4"
              style={{ touchAction: "pan-y" }}
              onTouchStart={beginTabSwipe}
              onTouchMove={moveTabSwipe}
              onTouchEnd={endTabSwipe}
              onTouchCancel={endTabSwipe}
            >
            {activeTab === "overview" ? (
              <>
            <section className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Service Components
                </h2>
                <div className="mt-3 space-y-2">
                  {componentRows.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <SignalChartCard
              title="30-Day Signal Health"
              valueLabel={trendScoreLabel}
              subtitle="Derived from incidents across the last 30 days"
            >
              <UptimeBar data={trendHistory} />
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </SignalChartCard>

            <SignalChartCard
              title="Signal Activity (24h)"
              subtitle="Derived from incident/report/news timestamps (not latency)"
            >
              <SignalActivityChart data={sparklineData} />
            </SignalChartCard>

            <SignalChartCard
              title="Daily Signal %"
              subtitle="Derived daily health score from incident overlap"
            >
              <DailySignalBars values={dailySignalPercentages} />
            </SignalChartCard>

            <section className="grid grid-cols-2 gap-3">
              <MetricTile label="Severity Score" value={String(severityScore)} />
              <MetricTile label="Reports (24h)" value={String(reports24h)} />
              <MetricTile label="Sources" value={`${sourceOkCount}/${sourceTotalCount}`} />
              <MetricTile label="Model" value={String(modelVersion)} />
            </section>
              </>
            ) : null}

            {activeTab === "incidents" ? (
              <>
            <section className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Change Summary
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <MetricTile
                    label="New Reports"
                    value={String(changeSummary?.new_reports ?? 0)}
                    hint="Latest refresh delta"
                  />
                  <MetricTile
                    label="New Incidents"
                    value={String(changeSummary?.new_incidents ?? 0)}
                    hint="Latest refresh delta"
                  />
                  <MetricTile
                    label="Updated Incidents"
                    value={String(changeSummary?.updated_incidents ?? 0)}
                  />
                  <MetricTile
                    label="Resolved Incidents"
                    value={String(changeSummary?.resolved_incidents ?? 0)}
                  />
                </div>
              </div>
            </section>
            <section className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Recent Incidents
                </h2>
                <div className="mt-3 space-y-2.5">
                  {outageIncidents.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                      No recent incidents listed in the current outage payload.
                    </p>
                  ) : (
                    outageIncidents.map((incident, index) => (
                      <div
                        key={`${incident.title || "incident"}-${incident.started_at || index}`}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-foreground">
                              {incident.title || "Untitled incident"}
                            </p>
                            {incident.acknowledgement ? (
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {incident.acknowledgement}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              {incident.duration ? <span>{incident.duration}</span> : null}
                              {incident.started_at ? (
                                <span>
                                  {new Date(incident.started_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${incidentToneClass(incident)}`}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
              </>
            ) : null}

            {activeTab === "analysis" ? (
              <>
            <section className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Regional Snapshot
                </h2>
                <div className="mt-3 space-y-2.5">
                  {regionEntries.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                      No regional data in payload.
                    </p>
                  ) : (
                    regionEntries.map((region) => {
                      const regionToneKey =
                        region.severityKey === "major"
                          ? "bad"
                          : region.severityKey === "minor" || region.severityKey === "degraded"
                            ? "warn"
                            : region.severityKey === "stable"
                              ? "good"
                              : "unknown";
                      return (
                        <div
                          key={region.key}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${TONE_STYLES[regionToneKey].dot}`} aria-hidden="true" />
                            <span className="text-sm font-medium text-foreground">{region.key}</span>
                          </div>
                          <div className="text-right text-[11px] text-muted-foreground">
                            <p>{region.severityKey}</p>
                            <p>
                              score {region.score ?? "n/a"} | weight {region.weight ?? "n/a"}%
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-primary/80" />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Source Health
                  </h2>
                </div>
                <div className="mt-3 space-y-2.5">
                  {sources.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                      No source diagnostics in payload.
                    </p>
                  ) : (
                    sources.map((source, index) => (
                      <div
                        key={`${source.name || "source"}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {source.name || "Unknown source"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {(source.kind || "unknown").replace(/-/g, " ")}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              source.ok
                                ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300"
                                : "border-rose-300/20 bg-rose-300/10 text-rose-200"
                            }`}
                          >
                            {source.ok ? "OK" : "Error"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <span>freshness: {source.freshness || "unknown"}</span>
                          <span>age: {formatAgeMinutes(source.age_minutes)}</span>
                          {typeof source.item_count === "number" ? <span>items: {source.item_count}</span> : null}
                          {typeof source.duration_ms === "number" ? <span>fetch: {source.duration_ms}ms</span> : null}
                        </div>
                        {source.error ? (
                          <p className="mt-1 text-[11px] text-rose-200">{source.error}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
              </>
            ) : null}

            {activeTab === "sources" ? (
              <>
                <LinkListSection title="Official Updates" items={officialItems} emptyText="No official updates in payload." />
                <LinkListSection title="Reports" items={reportItems} emptyText="No report entries in payload." />
                <LinkListSection title="News" items={newsItems} emptyText="No news entries in payload." />
                <LinkListSection title="Social" items={socialItems} emptyText="No social entries in payload." />
                <LinkListSection title="Known Resources" items={knownItems} emptyText="No known resources in payload." />
              </>
            ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
};

export default ServerDetail;
