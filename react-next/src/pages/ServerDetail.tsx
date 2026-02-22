import AppLayout from "@/components/AppLayout";
import { resolveLegacyUrl } from "@/lib/legacySite";
import {
  fetchLegacyServiceDetail,
  type LegacyDetailServiceId,
  type LegacyLinkItem,
  type LegacyOutageIncident,
  type LegacyServiceDetailResult,
  type LegacySourceHealth,
} from "@/lib/legacyServiceDetail";
import { ArrowLeft, ExternalLink, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serviceId = normalizeDetailId(id);
  const [detail, setDetail] = useState<LegacyServiceDetailResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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
                React Detail
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
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                      Live Status Monitor
                    </p>
                    <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground">
                      {detail.service.name}
                    </h1>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {detail.payload.outage?.summary ||
                        detail.payload.official?.summary ||
                        "Live service signals loaded from the current status JSON pipeline."}
                    </p>
                  </div>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                </div>

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

            <section className="grid grid-cols-2 gap-3">
              <MetricTile label="Severity Score" value={String(severityScore)} />
              <MetricTile label="Reports (24h)" value={String(reports24h)} />
              <MetricTile label="Sources" value={`${sourceOkCount}/${sourceTotalCount}`} />
              <MetricTile label="Model" value={String(modelVersion)} />
            </section>

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
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Active Incidents
                </h2>
                <div className="mt-3 space-y-2.5">
                  {outageIncidents.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground">
                      No active incidents listed in the current outage payload.
                    </p>
                  ) : (
                    outageIncidents.map((incident, index) => (
                      <div
                        key={`${incident.title || "incident"}-${incident.started_at || index}`}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                      >
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {incident.title || "Untitled incident"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          {incident.started_at ? <span>Started: {formatDateTime(incident.started_at)}</span> : null}
                          {incident.duration ? <span>Duration: {incident.duration}</span> : null}
                          {incident.acknowledgement ? <span>{incident.acknowledgement}</span> : null}
                        </div>
                      </div>
                    ))
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

            <LinkListSection title="Official Updates" items={officialItems} emptyText="No official updates in payload." />
            <LinkListSection title="Reports" items={reportItems} emptyText="No report entries in payload." />
            <LinkListSection title="News" items={newsItems} emptyText="No news entries in payload." />
            <LinkListSection title="Social" items={socialItems} emptyText="No social entries in payload." />
            <LinkListSection title="Known Resources" items={knownItems} emptyText="No known resources in payload." />
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
};

export default ServerDetail;
