import type { Status } from "@/data/servers";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
  label?: string;
}

const statusConfig: Record<Status, { label: string; dotClass: string; bgClass: string }> = {
  online: {
    label: "Operational",
    dotClass: "bg-status-online status-pulse-online",
    bgClass: "bg-status-online/10",
  },
  degraded: {
    label: "Degraded",
    dotClass: "bg-status-degraded",
    bgClass: "bg-status-degraded/10",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-status-offline status-pulse-offline",
    bgClass: "bg-status-offline/10",
  },
};

const StatusBadge = ({ status, size = "sm", label }: StatusBadgeProps) => {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  if (size === "md") {
    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${config.bgClass}`}>
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span className={`text-xs font-semibold text-status-${status}`}>
          {displayLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      <span className={`text-[11px] font-medium text-status-${status}`}>
        {displayLabel}
      </span>
    </div>
  );
};

export default StatusBadge;
