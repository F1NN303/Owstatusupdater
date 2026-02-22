import AppLayout from "@/components/AppLayout";
import {
  HOME_SERVICES,
  fetchLegacyHomeSummaries,
  type LegacyServiceSummary,
} from "@/lib/legacyStatus";
import { getLegacyOrigin, resolveLegacyUrl } from "@/lib/legacySite";
import { AlertCircle, ArrowUpRight, Bell, Gamepad2, RefreshCw, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const SERVICE_ICONS = {
  overwatch: Gamepad2,
  sony: Tv,
  email: Bell,
} as const;

const TONE_DOT: Record<LegacyServiceSummary["tone"], string> = {
  good: "bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.35)]",
  warn: "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]",
  bad: "bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.35)]",
  unknown: "bg-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.22)]",
};

const TONE_CHIP: Record<LegacyServiceSummary["tone"], string> = {
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  bad: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  unknown: "border-white/10 bg-white/5 text-slate-300",
};

function makeInitialRows(): LegacyServiceSummary[] {
  return HOME_SERVICES.map((service) => ({
    service,
    severity: "unknown",
    tone: "unknown",
    statusLabel: service.statusPath ? "Loading..." : "Setup",
    updatedText: service.statusPath ? "Updated: --" : "Updated: n/a",
    generatedAt: null,
    error: false,
  }));
}

const Index = () => {
  const [rows, setRows] = useState<LegacyServiceSummary[]>(() => makeInitialRows());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const loadRows = async () => {
    setIsRefreshing(true);
    try {
      const nextRows = await fetchLegacyHomeSummaries();
      setRows(nextRows);
      setLastRefreshAt(new Date().toISOString());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadRows();
    const timer = window.setInterval(() => {
      void loadRows();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overall = useMemo(() => {
    const monitoredRows = rows.filter((row) => Boolean(row.service.statusPath));
    if (monitoredRows.some((row) => row.tone === "bad")) {
      return { title: "Outage signals detected", tone: "bad" as const };
    }
    if (monitoredRows.some((row) => row.tone === "warn")) {
      return { title: "Warnings detected", tone: "warn" as const };
    }
    if (monitoredRows.length > 0 && monitoredRows.every((row) => row.tone === "good")) {
      return { title: "All monitored services stable", tone: "good" as const };
    }
    return { title: "Waiting for live status data", tone: "unknown" as const };
  }, [rows]);

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-10">
        <div className="flex items-end justify-between pb-5 pt-6">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              Status Home
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              React migration reads the current site JSON and progressively replaces legacy pages
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="glass flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
            aria-label="Refresh status list"
          >
            <RefreshCw
              size={16}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <section className="glass-heavy glass-specular mb-4 rounded-3xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                Migration Phase 1
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                {overall.title}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Home is React-based. Overwatch and PSN detail routes are now React-backed. E-Mail still uses the current site page.
              </p>
            </div>
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[overall.tone]}`} aria-hidden="true" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              API source: {getLegacyOrigin() || "same-origin"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              {lastRefreshAt
                ? `Refresh: ${new Date(lastRefreshAt).toLocaleTimeString()}`
                : "Refresh: pending"}
            </span>
          </div>
        </section>

        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle size={14} className="text-primary/80" />
          <span>Service cards use the same JSON endpoints as the current static dashboard.</span>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => {
            const Icon = SERVICE_ICONS[row.service.id];
            const isReactRoute = row.service.href.startsWith("/status/");
            const cardHref = isReactRoute ? row.service.href : resolveLegacyUrl(row.service.href);
            const cardClasses =
              "glass group block rounded-3xl p-4 transition-all duration-200 hover:bg-white/10 hover:shadow-[0_12px_34px_rgba(0,0,0,0.35)] active:scale-[0.99]";
            return (
              <div
                key={row.service.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
              >
                {isReactRoute ? (
                  <Link to={cardHref} className={cardClasses}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted-foreground group-hover:text-foreground">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                            {row.service.name}
                          </h3>
                          <ArrowUpRight
                            size={16}
                            className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          />
                        </div>

                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {row.service.note}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[row.tone]}`}
                              aria-hidden="true"
                            />
                            <span
                              className={`truncate rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CHIP[row.tone]}`}
                            >
                              Status: {row.statusLabel}
                            </span>
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {row.service.statusPath ? "Open status" : "Open setup"}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] text-muted-foreground">{row.updatedText}</p>
                        {row.error && row.service.statusPath ? (
                          <p className="mt-1 text-[11px] text-amber-300">
                            Could not load {resolveLegacyUrl(row.service.statusPath)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ) : (
                <a href={cardHref} className={cardClasses}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted-foreground group-hover:text-foreground">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                          {row.service.name}
                        </h3>
                        <ArrowUpRight
                          size={16}
                          className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {row.service.note}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[row.tone]}`}
                            aria-hidden="true"
                          />
                          <span
                            className={`truncate rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_CHIP[row.tone]}`}
                          >
                            Status: {row.statusLabel}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {row.service.statusPath ? "Open status" : "Open setup"}
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] text-muted-foreground">{row.updatedText}</p>
                      {row.error && row.service.statusPath ? (
                        <p className="mt-1 text-[11px] text-amber-300">
                          Could not load {resolveLegacyUrl(row.service.statusPath)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </a>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </AppLayout>
  );
};

export default Index;
