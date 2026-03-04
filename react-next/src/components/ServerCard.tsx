import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import UptimeBar from "./UptimeBar";
import MiniSparkline from "./MiniSparkline";
import ServiceIdentityIcon from "./ServiceIdentityIcon";
import type { ServerService } from "@/data/servers";
import { pickLang, useAppShell } from "@/lib/appShell";

interface ServerCardProps {
  server: ServerService;
  compact?: boolean;
  reserveTopRightSpace?: boolean;
}

const ServerCard = ({ server, compact = false, reserveTopRightSpace = false }: ServerCardProps) => {
  const { language } = useAppShell();
  const navigate = useNavigate();
  const trendLabel = server.trendLabel || pickLang(language, "30-day uptime", "30-Tage-Uptime");
  const trendValueLabel = server.trendValueLabel || `${server.uptime}%`;
  const sourceUnavailableCount =
    typeof server.sourceUnavailableCount === "number" ? Math.max(server.sourceUnavailableCount, 0) : 0;
  const hasSourceUnavailable = sourceUnavailableCount > 0;
  const staleSourceCount =
    typeof server.staleSourceCount === "number" ? Math.max(server.staleSourceCount, 0) : 0;
  const hasStaleSources = staleSourceCount > 0;
  const sourceUnavailableLabel = pickLang(
    language,
    sourceUnavailableCount === 1 ? "1 source unavailable" : `${sourceUnavailableCount} sources unavailable`,
    sourceUnavailableCount === 1 ? "1 Quelle nicht verfügbar" : `${sourceUnavailableCount} Quellen nicht verfügbar`
  );
  const staleSourcesLabel = pickLang(
    language,
    staleSourceCount === 1 ? "1 stale source" : `${staleSourceCount} stale sources`,
    staleSourceCount === 1 ? "1 veraltete Quelle" : `${staleSourceCount} veraltete Quellen`
  );

  return (
    <button
      type="button"
      onClick={() => navigate(`/status/${server.id}`)}
      className={`glass glass-specular w-full rounded-2xl text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] active:brightness-90 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ServiceIdentityIcon
              serviceId={server.id}
              iconName={server.icon}
              size={compact ? 16 : 18}
              containerClassName={compact ? "h-9 w-9" : "h-10 w-10"}
            />
            <div>
              <h3 className={`font-semibold text-foreground ${compact ? "text-[13px]" : "text-sm"}`}>
                {server.name}
              </h3>
              <div className={`mt-0.5 flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>
                <StatusBadge status={server.status} label={server.statusLabel} />
                {server.metricLabel ? (
                  <span className={`text-muted-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>
                    {server.metricLabel}
                  </span>
                ) : server.latency !== undefined ? (
                  <span className={`text-muted-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>
                    · {server.latency}ms
                  </span>
                ) : null}
                {hasSourceUnavailable ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border border-status-offline/30 bg-status-offline/10 font-medium text-status-offline ${
                      compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-status-offline" />
                    {sourceUnavailableLabel}
                  </span>
                ) : null}
                {hasStaleSources ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 font-medium text-amber-200 ${
                      compact ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    {staleSourcesLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div
            className={`flex items-center ${compact ? "gap-1.5" : "gap-2"} ${
              reserveTopRightSpace ? "mr-10" : ""
            }`}
          >
            <MiniSparkline data={server.responseHistory} />
            <ChevronRight size={16} className="text-muted-foreground" />
          </div>
        </div>

        <div className={compact ? "mt-2" : "mt-3"}>
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className={`font-medium uppercase tracking-wider text-muted-foreground ${
                compact ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {trendLabel}
            </span>
            <span className={`font-semibold text-foreground ${compact ? "text-[10px]" : "text-[11px]"}`}>
              {trendValueLabel}
            </span>
          </div>
          <UptimeBar data={server.uptimeHistory} />
        </div>
      </div>
    </button>
  );
};

export default ServerCard;
