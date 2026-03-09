import AppLayout from "@/components/AppLayout";
import ServiceIdentityIcon from "@/components/ServiceIdentityIcon";
import { pickLang, useAppShell } from "@/lib/appShell";
import { getLegacyLiveStatusServices, type LegacyHomeServiceConfig } from "@/lib/legacyStatus";
import {
  fetchLegacySubscriptionConfig,
  providerLabel,
  type LegacySubscriptionLoadResult,
} from "@/lib/legacySubscription";
import { formatTimestampByMode } from "@/lib/timeDisplay";
import { BellRing, ExternalLink, Mail, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NoticeTone = "neutral" | "good" | "warn" | "bad";

const STATUS_CLASS: Record<NoticeTone, string> = {
  neutral: "border-white/10 bg-white/5 text-muted-foreground",
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  bad: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

function statusTone(result: LegacySubscriptionLoadResult | null): NoticeTone {
  if (!result || result.status === "loading") {
    return "neutral";
  }
  if (result.status === "ready") {
    return "good";
  }
  if (result.status === "missing" || result.status === "invalid") {
    return "warn";
  }
  return "bad";
}

function compareServices(a: LegacyHomeServiceConfig, b: LegacyHomeServiceConfig) {
  const aPriority = typeof a.priority === "number" ? a.priority : 1000;
  const bPriority = typeof b.priority === "number" ? b.priority : 1000;
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  return a.name.localeCompare(b.name);
}

const EmailAlerts = () => {
  const {
    language,
    timeDisplayMode,
    favoriteServiceIds,
    alertServiceIds,
    isAlertService,
    toggleAlertService,
    replaceAlertServices,
    alertSeverityThreshold,
    setAlertSeverityThreshold,
  } = useAppShell();
  const [configResult, setConfigResult] = useState<LegacySubscriptionLoadResult | null>(null);
  const [availableServices, setAvailableServices] = useState<LegacyHomeServiceConfig[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedTimedOut, setEmbedTimedOut] = useState(false);

  const t = (en: string, de: string) => pickLang(language, en, de);
  const favoriteServiceIdSet = useMemo(() => new Set(favoriteServiceIds), [favoriteServiceIds]);
  const alertServiceIdSet = useMemo(() => new Set(alertServiceIds), [alertServiceIds]);

  const statusText = (result: LegacySubscriptionLoadResult | null) => {
    if (!result || result.status === "loading") {
      return t("Preparing alert signup...", "Alarm-Anmeldung wird vorbereitet...");
    }
    if (result.status === "ready") {
      return `${t("Ready", "Bereit")} | ${providerLabel(result.config?.provider)} ${t("signup active", "Anmeldung aktiv")}`;
    }
    if (result.status === "missing" || result.status === "invalid") {
      return t("Alert signup is currently unavailable", "Alarm-Anmeldung ist aktuell nicht verfügbar");
    }
    return t("Could not load alert signup right now", "Alarm-Anmeldung konnte aktuell nicht geladen werden");
  };

  const loadConfig = async () => {
    setIsRefreshing(true);
    setConfigResult(
      (previous) =>
        previous ?? {
          status: "loading",
          config: null,
          parsedUrl: null,
          source: "network",
          cachedAt: null,
        }
    );
    const result = await fetchLegacySubscriptionConfig();
    setConfigResult(result);
    setLastCheckedAt(new Date().toISOString());
    setIsRefreshing(false);
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getLegacyLiveStatusServices()
      .then((services) => {
        if (cancelled) {
          return;
        }
        setAvailableServices([...services].sort(compareServices));
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableServices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const embedUrl = configResult?.status === "ready" ? configResult.parsedUrl?.toString() ?? "" : "";
  const canEmbed = Boolean(embedUrl);

  useEffect(() => {
    setEmbedLoaded(false);
    setEmbedTimedOut(false);

    if (!canEmbed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setEmbedTimedOut(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [canEmbed, embedUrl]);

  const provider = providerLabel(configResult?.config?.provider);
  const currentTone = statusTone(configResult);
  const usingCachedConfig = configResult?.source === "cache";
  const selectedServiceCount = alertServiceIds.length;
  const sortedServices = useMemo(() => {
    return [...availableServices].sort((left, right) => {
      const leftAlert = alertServiceIdSet.has(left.id);
      const rightAlert = alertServiceIdSet.has(right.id);
      if (leftAlert !== rightAlert) {
        return leftAlert ? -1 : 1;
      }

      const leftFavorite = favoriteServiceIdSet.has(left.id);
      const rightFavorite = favoriteServiceIdSet.has(right.id);
      if (leftFavorite !== rightFavorite) {
        return leftFavorite ? -1 : 1;
      }

      return compareServices(left, right);
    });
  }, [alertServiceIdSet, availableServices, favoriteServiceIdSet]);

  const checkedLabel = lastCheckedAt
    ? formatTimestampByMode(lastCheckedAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Pending", "Ausstehend"),
      })
    : t("Pending", "Ausstehend");
  const cachedConfigLabel = configResult?.cachedAt
    ? formatTimestampByMode(configResult.cachedAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Stored", "Gespeichert"),
      })
    : null;

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {t("E-Mail Alerts", "E-Mail-Alarme")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t(
                "Keep a simple outage signup, plus a local watchlist for the services that matter most to you.",
                "Behalte eine einfache Störungs-Anmeldung und zusätzlich eine lokale Watchlist für die Services, die dir am wichtigsten sind."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
            aria-label={t("Refresh alert setup", "Alarm-Einrichtung aktualisieren")}
          >
            <RefreshCw
              size={18}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <section className="glass glass-specular overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-primary/15 to-transparent p-4">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-foreground">
                    {t("Alert Setup", "Alarm-Einrichtung")}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{statusText(configResult)}</p>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_CLASS[currentTone]}`}>
                {provider}
              </span>
            </div>
          </div>
        </section>

        {usingCachedConfig ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-[11px] text-amber-200">
            <p className="font-semibold">
              {t("Showing last known signup settings", "Letzte bekannte Anmelde-Einstellungen werden angezeigt")}
            </p>
            <p className="mt-0.5 opacity-90">
              {cachedConfigLabel
                ? t(
                    `Stored configuration from ${cachedConfigLabel} is being used while the connection recovers.`,
                    `Gespeicherte Konfiguration von ${cachedConfigLabel} wird verwendet, während sich die Verbindung erholt.`
                  )
                : t(
                    "A previously saved configuration is being used while the connection recovers.",
                    "Eine zuvor gespeicherte Konfiguration wird verwendet, während sich die Verbindung erholt."
                  )}
            </p>
          </div>
        ) : null}

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <BellRing size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("Alert Watchlist", "Alarm-Watchlist")}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Choose the services you care about on this device. Your provider signup remains global for now.",
                    "Wähle die Services, die dir auf diesem Gerät wichtig sind. Deine Anbieter-Anmeldung bleibt vorerst global."
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Watching", "Beobachtet")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{selectedServiceCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Favorites", "Favoriten")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{favoriteServiceIds.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Threshold", "Schwelle")}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {alertSeverityThreshold === "degraded"
                    ? t("Degraded+", "Beeinträchtigt+")
                    : t("Major only", "Nur größere")}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Alert threshold", "Alarm-Schwelle")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  {
                    key: "major" as const,
                    label: t("Major only", "Nur größere"),
                    note: t("Only larger outages should stand out.", "Nur größere Ausfälle sollen hervorstechen."),
                  },
                  {
                    key: "degraded" as const,
                    label: t("Degraded + major", "Beeinträchtigt + größer"),
                    note: t("Also flag smaller degraded states.", "Auch kleinere Beeinträchtigungen hervorheben."),
                  },
                ].map((option) => {
                  const active = alertSeverityThreshold === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAlertSeverityThreshold(option.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {alertSeverityThreshold === "degraded"
                  ? t(
                      "Smaller degraded states will be treated as watchlist-worthy in the UI.",
                      "Kleinere Beeinträchtigungen gelten in der UI ebenfalls als watchlist-relevant."
                    )
                  : t(
                      "The watchlist stays focused on the most severe outages.",
                      "Die Watchlist konzentriert sich auf die schwerwiegendsten Ausfälle."
                    )}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => replaceAlertServices(favoriteServiceIds)}
                className="flex-1 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                {t("Use favorites", "Favoriten übernehmen")}
              </button>
              <button
                type="button"
                onClick={() => replaceAlertServices([])}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
              >
                {t("Clear", "Leeren")}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {sortedServices.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-muted-foreground">
                  {t(
                    "Service watchlist controls will appear as soon as the live service catalog loads.",
                    "Die Service-Watchlist erscheint, sobald der Live-Servicekatalog geladen ist."
                  )}
                </div>
              ) : (
                sortedServices.map((service) => {
                  const selected = isAlertService(service.id);
                  const favorite = favoriteServiceIdSet.has(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleAlertService(service.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? "border-primary/25 bg-primary/12"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ServiceIdentityIcon
                          serviceId={service.id}
                          iconName={service.iconName}
                          size={16}
                          containerClassName="h-9 w-9 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">{service.name}</p>
                            {favorite ? <Star size={12} className="text-amber-200" /> : null}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {service.note || t("Live service status and incident summary.", "Live-Service-Status und Vorfallübersicht.")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          selected
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-white/10 bg-black/20 text-muted-foreground"
                        }`}
                      >
                        {selected ? t("Watching", "Beobachtet") : t("Off", "Aus")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Mail size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("Alert Signup", "Alarm-Anmeldung")}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Complete your secure Brevo signup directly in the form below.",
                    "Schließe deine sichere Brevo-Anmeldung direkt im Formular unten ab."
                  )}
                </p>
              </div>
            </div>

            {canEmbed ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {!embedLoaded ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                      <p className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                        {t("Loading secure signup form...", "Lade sicheres Anmeldeformular...")}
                      </p>
                    </div>
                  ) : null}
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title={t("Brevo alert signup", "Brevo-Alarm-Anmeldung")}
                    className="block h-[720px] w-full bg-white"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                    onLoad={() => {
                      setEmbedLoaded(true);
                      setEmbedTimedOut(false);
                    }}
                  />
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t(
                    "Brevo handles captcha and double opt-in directly in the signup flow.",
                    "Brevo verarbeitet Captcha und Double-Opt-In direkt im Anmeldeablauf."
                  )}
                </p>

                {embedTimedOut && !embedLoaded ? (
                  <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-200">
                    <p>
                      {t(
                        "The embedded form is taking too long to load. You can open the secure provider form directly.",
                        "Das eingebettete Formular lädt zu lange. Du kannst das sichere Formular direkt beim Anbieter öffnen."
                      )}
                    </p>
                    <a
                      href={embedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-200/20 bg-amber-200/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-100"
                    >
                      {t("Open Brevo form directly", "Brevo-Formular direkt öffnen")}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-muted-foreground">
                {t(
                  "Subscription form is not available right now. Please try again later.",
                  "Abo-Formular ist aktuell nicht verfügbar. Bitte versuche es später erneut."
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Signup Safety", "Anmeldesicherheit")}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Provider</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{provider}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Checked", "Geprüft")}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">{checkedLabel}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t(
                  "Your signup is handled through Brevo with secure standards and regular reliability checks.",
                  "Deine Anmeldung läuft über Brevo mit sicheren Standards und regelmäßigen Zuverlässigkeitsprüfungen."
                )}
              </p>
            </div>
          </div>

          {configResult?.parsedUrl ? (
            <div className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Alternative", "Alternative")}
                </h2>
                <a
                  href={configResult.parsedUrl.toString()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
                >
                  <span>{t("Open Brevo form directly", "Brevo-Formular direkt öffnen")}</span>
                  <ExternalLink size={14} className="text-muted-foreground" />
                </a>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </AppLayout>
  );
};

export default EmailAlerts;
