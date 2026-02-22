import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import UptimeBar from "./UptimeBar";
import MiniSparkline from "./MiniSparkline";
import type { ServerService } from "@/data/servers";
import { getIconComponent } from "@/data/servers";

interface ServerCardProps {
  server: ServerService;
  index: number;
}

const ServerCard = ({ server, index }: ServerCardProps) => {
  const navigate = useNavigate();
  const IconComp = getIconComponent(server.icon);

  return (
    <button
      onClick={() => navigate(`/status/${server.id}`)}
      className="glass glass-specular w-full rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] active:brightness-90"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <IconComp size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{server.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={server.status} />
                {server.latency !== undefined && (
                  <span className="text-[11px] text-muted-foreground">· {server.latency}ms</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MiniSparkline data={server.responseHistory} />
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>

        {/* Uptime bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">30-day uptime</span>
            <span className="text-[11px] font-semibold text-foreground">{server.uptime}%</span>
          </div>
          <UptimeBar data={server.uptimeHistory} />
        </div>
      </div>
    </button>
  );
};

export default ServerCard;
