import { RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  distance: number;
  isPullReady: boolean;
  isRefreshing: boolean;
  pullLabel: string;
  releaseLabel: string;
  refreshingLabel: string;
}

const PullToRefreshIndicator = ({
  distance,
  isPullReady,
  isRefreshing,
  pullLabel,
  releaseLabel,
  refreshingLabel,
}: PullToRefreshIndicatorProps) => {
  const visible = isRefreshing || distance > 0;
  const progress = isRefreshing ? 1 : Math.max(0, Math.min(1, distance / 72));
  const label = isRefreshing ? refreshingLabel : isPullReady ? releaseLabel : pullLabel;
  const translateY = isRefreshing ? 0 : -16 + progress * 16;
  const rotate = isRefreshing ? undefined : `rotate(${progress * 180}deg)`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[70] flex justify-center px-4">
      <div
        aria-hidden="true"
        className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-foreground shadow-lg transition-all duration-150"
        style={{
          opacity: visible ? Math.max(0, progress) : 0,
          transform: `translateY(${translateY}px) scale(${0.94 + progress * 0.06})`,
        }}
      >
        <RefreshCw
          size={13}
          className={isRefreshing ? "animate-spin text-primary" : "text-primary"}
          style={rotate ? { transform: rotate } : undefined}
        />
        <span>{label}</span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
