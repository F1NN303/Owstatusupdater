import AppLayout from "@/components/AppLayout";
import ServiceIdentityIcon from "@/components/ServiceIdentityIcon";
import { pickLang, useAppShell } from "@/lib/appShell";
import {
  fetchLegacyServiceSummary,
  getLegacyLiveStatusServices,
  type LegacyHomeServiceConfig,
  type LegacyServiceSummary,
  type LegacyTone,
} from "@/lib/legacyStatus";
import { Home, RefreshCw, Settings, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

interface FavoriteServiceEntry {
  id: string;
  name: string;
  note: string;
  iconName?: string;
  detailPath: string;
  tone: LegacyTone;
  generatedAt: string | null;
  error: boolean;
}

function toneChipClass(tone: LegacyTone) {
  if (tone === "good") {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  }
  if (tone === "warn") {
    return "border-amber-300/20 bg-amber-300/10 text-amber-200";
  }
  if (tone === "bad") {
    return "border-rose-300/20 bg-rose-300/10 text-rose-200";
  }
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function toneLabel(language: "en" | "de", tone: LegacyTone) {
  if (tone === "good") {
    return pickLang(language, "Operational", "Stabil");
  }
  if (tone === "warn") {
    return pickLang(language, "Degraded", "Beeinträchtigt");
  }
  if (tone === "bad") {
    return pickLang(language, "Outage", "Ausfall");
  }
  return pickLang(language, "Unknown", "Unbekannt");
}

function mapSummaryToFavoriteEntry(summary: LegacyServiceSummary): FavoriteServiceEntry {
  return {
    id: summary.service.id,
    name: summary.service.name,
    note: summary.service.note || "Live service status and incident summary.",
    iconName: summary.service.iconName,
    detailPath: `/status/${summary.service.id}`,
    tone: summary.tone,
    generatedAt: summary.generatedAt,
    error: summary.error,
  };
}

function mapServiceToFallbackEntry(service: LegacyHomeServiceConfig): FavoriteServiceEntry {
  return {
    id: service.id,
    name: service.name,
    note: service.note || "Live service status and incident summary.",
    iconName: service.iconName,
    detailPath: `/status/${service.id}`,
    tone: "unknown",
    generatedAt: null,
    error: true,
  };
}

function mapUnknownFavoriteEntry(serviceId: string): FavoriteServiceEntry {
  return {
    id: serviceId,
    name: serviceId,
    note: "Unknown or removed service id.",
    iconName: "Globe",
    detailPath: `/status/${serviceId}`,
    tone: "unknown",
    generatedAt: null,
    error: true,
  };
}

const Favorites = () => {
  const { language, favoriteServiceIds, setFavoriteService } = useAppShell();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [entries, setEntries] = useState<FavoriteServiceEntry[]>([]);

  const hasFavorites = favoriteServiceIds.length > 0;

  const loadFavorites = async () => {
    if (!hasFavorites) {
      setEntries([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const services = await getLegacyLiveStatusServices();
      const byId = new Map(services.map((service) => [service.id, service]));
      const unknownIds = favoriteServiceIds.filter((id) => !byId.has(id));
      const targetServices = favoriteServiceIds
        .map((id) => byId.get(id))
        .filter((service): service is LegacyHomeServiceConfig & { statusPath: string } => Boolean(service));

      const results = await Promise.allSettled(
        targetServices.map((service) => fetchLegacyServiceSummary(service))
      );

      const next: FavoriteServiceEntry[] = [];
      for (let i = 0; i < targetServices.length; i += 1) {
        const result = results[i];
        const service = targetServices[i];
        if (!service) {
          continue;
        }
        if (result?.status === "fulfilled") {
          next.push(mapSummaryToFavoriteEntry(result.value));
          continue;
        }
        next.push(mapServiceToFallbackEntry(service));
      }
      for (const unknownId of unknownIds) {
        next.push(mapUnknownFavoriteEntry(unknownId));
      }
      setEntries(next);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, [hasFavorites, language, favoriteServiceIds.join("|")]);

  const countLabel = useMemo(
    () =>
      pickLang(
        language,
        `${favoriteServiceIds.length} ${favoriteServiceIds.length === 1 ? "service" : "services"}`,
        `${favoriteServiceIds.length} ${favoriteServiceIds.length === 1 ? "Service" : "Services"}`
      ),
    [favoriteServiceIds.length, language]
  );

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Favorites", "Favoriten")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pickLang(
                language,
                "Starred services with quick open and live status overview",
                "Markierte Services mit Schnellzugriff und Live-Statusüberblick"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadFavorites()}
            className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
            aria-label={pickLang(language, "Refresh favorites", "Favoriten aktualisieren")}
          >
            <RefreshCw
              size={18}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <section className="glass glass-specular rounded-2xl p-4">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Starred Services", "Markierte Services")}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                {countLabel}
              </span>
            </div>

            {!hasFavorites ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {pickLang(language, "No favorites yet", "Noch keine Favoriten")}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {pickLang(
                    language,
                    "Use the star button on the home service cards to pin services here.",
                    "Nutze den Stern auf den Service-Karten der Startseite, um Services hier anzupinnen."
                  )}
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                {entries.map((entry) => (
                  <div key={entry.id} className="relative">
                    <Link
                      to={entry.detailPath}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 transition-colors hover:bg-white/10 active:scale-[0.99]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ServiceIdentityIcon
                          serviceId={entry.id}
                          iconName={entry.iconName}
                          size={17}
                          containerClassName="h-10 w-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${toneChipClass(entry.tone)}`}>
                              {toneLabel(language, entry.tone)}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">
                              {entry.error
                                ? pickLang(language, "Live data unavailable", "Live-Daten nicht verfügbar")
                                : entry.note}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {pickLang(language, "Open", "Öffnen")}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setFavoriteService(entry.id, false);
                      }}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/15 text-amber-200 transition-colors hover:bg-amber-300/25"
                      aria-label={pickLang(language, "Remove from favorites", "Aus Favoriten entfernen")}
                    >
                      <Star size={14} className="fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/"
            className="glass glass-specular rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="relative z-10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                <Home size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {pickLang(language, "Service Home", "Status-Start")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pickLang(language, "Open live overview cards", "Live-Übersichtskarten öffnen")}
              </p>
            </div>
          </Link>
          <Link
            to="/settings"
            className="glass glass-specular rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="relative z-10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                <Settings size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {pickLang(language, "Settings", "Einstellungen")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pickLang(language, "App preferences and links", "App-Einstellungen und Links")}
              </p>
            </div>
          </Link>
        </section>
      </main>
    </AppLayout>
  );
};

export default Favorites;
