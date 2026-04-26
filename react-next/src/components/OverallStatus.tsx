import { CheckCircle, AlertTriangle, XCircle, Activity } from "lucide-react";

type OverallState = "all-good" | "minor-issues" | "some-issues" | "major-outage";

interface OverallStatusProps {
  state: OverallState;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
  impactedCount: number;
  totalCount: number;
  onShowImpacted?: () => void;
}

const config: Record<OverallState, { icon: React.ReactNode; title: string; gradient: string; glow: string }> = {
  "all-good": {
    icon: <CheckCircle size={22} />,
    title: "All Systems Operational",
    gradient: "from-status-online/20 to-transparent",
    glow: "bg-status-online",
  },
  "minor-issues": {
    icon: <Activity size={22} />,
    title: "Monitoring Active",
    gradient: "from-primary/20 to-transparent",
    glow: "bg-primary",
  },
  "some-issues": {
    icon: <AlertTriangle size={22} />,
    title: "Partial Service Impact",
    gradient: "from-status-degraded/20 to-transparent",
    glow: "bg-status-degraded",
  },
  "major-outage": {
    icon: <XCircle size={22} />,
    title: "Major Outage Detected",
    gradient: "from-status-offline/20 to-transparent",
    glow: "bg-status-offline",
  },
};

const OverallStatus = ({
  state,
  onlineCount,
  degradedCount,
  offlineCount,
  impactedCount,
  totalCount,
  onShowImpacted,
}: OverallStatusProps) => {
  const { icon, title, gradient, glow } = config[state];
  const color =
    state === "all-good"
      ? "text-status-online"
      : state === "minor-issues"
        ? "text-primary"
        : state === "some-issues"
          ? "text-status-degraded"
          : "text-status-offline";

  const subtitle =
    state === "major-outage"
      ? `${offlineCount}/${totalCount} services down`
      : state === "some-issues"
        ? `${impactedCount}/${totalCount} services impacted`
        : state === "minor-issues"
          ? impactedCount > 0
            ? `${degradedCount} minor issue${degradedCount === 1 ? "" : "s"} detected`
            : `${onlineCount}/${totalCount} services online`
          : `${onlineCount}/${totalCount} services online`;

  return (
    <div className="glass glass-specular overflow-hidden rounded-2xl">
      <div className={`bg-gradient-to-r ${gradient} p-4 sm:p-5`}>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex min-w-0 items-center gap-3 ${color}`}>
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20">
                <span className={`absolute inset-2 rounded-full ${glow} opacity-20 blur-md`} />
                <span className="relative">{icon}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
              {impactedCount > 0 && onShowImpacted ? (
                <button
                  type="button"
                  onClick={onShowImpacted}
                  className="hidden rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-white/10 sm:inline-flex"
                >
                  View impacted
                </button>
              ) : null}
              <Activity size={14} />
              <span className="text-[11px] font-medium">Live</span>
              <span className="h-1.5 w-1.5 rounded-full bg-status-online status-pulse-online" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Online", value: onlineCount, tone: "text-status-online" },
              { label: "Degraded", value: degradedCount, tone: "text-status-degraded" },
              { label: "Down", value: offlineCount, tone: "text-status-offline" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-black/15 px-2.5 py-2">
                <p className={`text-lg font-extrabold leading-none ${item.tone}`}>{item.value}</p>
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {impactedCount > 0 && onShowImpacted ? (
            <div className="mt-3 sm:hidden">
              <button
                type="button"
                onClick={onShowImpacted}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-white/10"
              >
                View impacted
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default OverallStatus;
