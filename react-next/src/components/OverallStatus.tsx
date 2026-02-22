import { CheckCircle, AlertTriangle, XCircle, Activity } from "lucide-react";

type OverallState = "all-good" | "some-issues" | "major-outage";

interface OverallStatusProps {
  state: OverallState;
  onlineCount: number;
  totalCount: number;
}

const config: Record<OverallState, { icon: React.ReactNode; title: string; gradient: string }> = {
  "all-good": {
    icon: <CheckCircle size={22} />,
    title: "All Systems Operational",
    gradient: "from-status-online/20 to-transparent",
  },
  "some-issues": {
    icon: <AlertTriangle size={22} />,
    title: "Some Systems Degraded",
    gradient: "from-status-degraded/20 to-transparent",
  },
  "major-outage": {
    icon: <XCircle size={22} />,
    title: "Major Outage Detected",
    gradient: "from-status-offline/20 to-transparent",
  },
};

const OverallStatus = ({ state, onlineCount, totalCount }: OverallStatusProps) => {
  const { icon, title, gradient } = config[state];
  const color = state === "all-good" ? "text-status-online" : state === "some-issues" ? "text-status-degraded" : "text-status-offline";

  return (
    <div className={`glass glass-specular rounded-2xl overflow-hidden`}>
      <div className={`bg-gradient-to-r ${gradient} p-4`}>
        <div className="relative z-10 flex items-center justify-between">
          <div className={`flex items-center gap-3 ${color}`}>
            {icon}
            <div>
              <h2 className="text-sm font-bold">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {onlineCount}/{totalCount} services online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
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
