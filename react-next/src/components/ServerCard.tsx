import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import UptimeBar from "./UptimeBar";
import MiniSparkline from "./MiniSparkline";
import type { ServerService } from "@/data/servers";
import { getIconComponent } from "@/data/servers";
import { pickLang, useAppShell } from "@/lib/appShell";

interface ServerCardProps {
  server: ServerService;
  index: number;
}

const ServerCard = ({ server, index }: ServerCardProps) => {
  const { language } = useAppShell();
  const navigate = useNavigate();
  const IconComp = getIconComponent(server.icon);
  const trendLabel = server.trendLabel || pickLang(language, "30-day uptime", "30-Tage-Uptime");
  const trendValueLabel = server.trendValueLabel || `${server.uptime}%`;
  const sourceUnavailableCount =
    typeof server.sourceUnavailableCount === "number" ? Math.max(server.sourceUnavailableCount, 0) : 0;
  const hasSourceUnavailable = sourceUnavailableCount > 0;
  const sourceUnavailableLabel = pickLang(
    language,
    sourceUnavailableCount === 1 ? "1 source unavailable" : `${sourceUnavailableCount} sources unavailable`,
    sourceUnavailableCount === 1 ? "1 Quelle nicht verfuegbar" : `${sourceUnavailableCount} Quellen nicht verfuegbar`
  );

  return (
    <button
      type="button"
      onClick={() => navigate(`/status/${server.id}`)}
      className="glass glass-specular w-full rounded-2xl p-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] active:brightness-90"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
              <IconComp size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{server.name}</h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={server.status} />
                {server.metricLabel ? (
                  <span className="text-[11px] text-muted-foreground">{server.metricLabel}</span>
                ) : server.latency !== undefined ? (
                  <span className="text-[11px] text-muted-foreground">· {server.latency}ms</span>
                ) : null}
                {hasSourceUnavailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-offline/30 bg-status-offline/10 px-1.5 py-0.5 text-[10px] font-medium text-status-offline">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-offline" />
                    {sourceUnavailableLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MiniSparkline data={server.responseHistory} />
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {trendLabel}
            </span>
            <span className="text-[11px] font-semibold text-foreground">{trendValueLabel}</span>
          </div>
          <UptimeBar data={server.uptimeHistory} />
        </div>
      </div>
    </button>
  );
};

export default ServerCard;
