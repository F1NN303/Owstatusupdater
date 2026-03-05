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

const config: Record<OverallState, { icon: React.ReactNode; title: string; gradient: string }> = {
  "all-good": {
    icon: <CheckCircle size={22} />,
    title: "All Systems Operational",
    gradient: "from-status-online/20 to-transparent",
  },
  "minor-issues": {
    icon: <Activity size={22} />,
    title: "Monitoring Active",
    gradient: "from-primary/20 to-transparent",
  },
  "some-issues": {
    icon: <AlertTriangle size={22} />,
    title: "Partial Service Impact",
    gradient: "from-status-degraded/20 to-transparent",
  },
  "major-outage": {
    icon: <XCircle size={22} />,
    title: "Major Outage Detected",
    gradient: "from-status-offline/20 to-transparent",
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
  const { icon, title, gradient } = config[state];
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
    <div className={`glass glass-specular rounded-2xl overflow-hidden`}>
      <div className={`bg-gradient-to-r ${gradient} p-4`}>
        <div className="relative z-10 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${color}`}>
            {icon}
            <div>
              <h2 className="text-sm font-bold">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {impactedCount > 0 && onShowImpacted ? (
              <button
                type="button"
                onClick={onShowImpacted}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-white/10"
              >
                View impacted
              </button>
            ) : null}
            <Activity size={14} />
            <span className="text-[11px] font-medium">Live</span>
            <span className="h-1.5 w-1.5 rounded-full bg-status-online status-pulse-online" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverallStatus;
