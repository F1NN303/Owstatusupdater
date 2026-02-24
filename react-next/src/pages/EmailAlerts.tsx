import AppLayout from "@/components/AppLayout";
import { pickLang, useAppShell } from "@/lib/appShell";
import {
  fetchLegacySubscriptionConfig,
  providerLabel,
  type LegacySubscriptionLoadResult,
} from "@/lib/legacySubscription";
import { ExternalLink, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NoticeTone = "neutral" | "good" | "warn" | "bad";

function formatHost(url: URL | null) {
  return url ? url.hostname : "-";
}

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

const STATUS_CLASS: Record<NoticeTone, string> = {
  neutral: "border-white/10 bg-white/5 text-muted-foreground",
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  bad: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

const EmailAlerts = () => {
  const { language } = useAppShell();
  const [configResult, setConfigResult] = useState<LegacySubscriptionLoadResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedTimedOut, setEmbedTimedOut] = useState(false);

  const t = (en: string, de: string) => pickLang(language, en, de);

  const statusText = (result: LegacySubscriptionLoadResult | null) => {
    if (!result || result.status === "loading") {
      return t("Loading subscription config...", "Lade Abo-Konfiguration...");
    }
    if (result.status === "ready") {
      return `${t("Ready", "Bereit")} · ${providerLabel(result.config?.provider)} ${t("form verified", "Formular geprüft")}`;
    }
    if (result.status === "missing") {
      return t("Subscription form is not configured", "Abo-Formular ist nicht konfiguriert");
    }
    if (result.status === "invalid") {
      return t("Subscription config is invalid", "Abo-Konfiguration ist ungültig");
    }
    return t("Could not load subscription config", "Abo-Konfiguration konnte nicht geladen werden");
  };

  const loadConfig = async () => {
    setIsRefreshing(true);
    setConfigResult((previous) => previous ?? { status: "loading", config: null, parsedUrl: null });
    const result = await fetchLegacySubscriptionConfig();
    setConfigResult(result);
    setLastCheckedAt(new Date().toISOString());
    setIsRefreshing(false);
  };

  useEffect(() => {
    void loadConfig();
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

  const checkedLabel = useMemo(() => {
    if (!lastCheckedAt) {
      return t("Pending", "Ausstehend");
    }
    const date = new Date(lastCheckedAt);
    if (!Number.isFinite(date.getTime())) {
      return t("Pending", "Ausstehend");
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastCheckedAt, language]);

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
                "Secure outage notifications via Brevo with captcha and double opt-in",
                "Sichere Störungs-Benachrichtigungen via Brevo mit Captcha und Double-Opt-In"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
            aria-label={t("Refresh subscription config", "Abo-Konfiguration aktualisieren")}
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
                    {t("Subscription Configuration", "Abo-Konfiguration")}
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

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Mail size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("Newsletter Signup", "Newsletter-Anmeldung")}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Embedded Brevo form using the same subscription.json config",
                    "Eingebettetes Brevo-Formular mit derselben subscription.json-Konfiguration"
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
                    title={t("Brevo newsletter signup", "Brevo-Newsletter-Anmeldung")}
                    className="block h-[720px] w-full bg-white"
                    loading="lazy"
                    onLoad={() => {
                      setEmbedLoaded(true);
                      setEmbedTimedOut(false);
                    }}
                  />
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t(
                    "Captcha and double opt-in are handled inside the embedded Brevo form.",
                    "Captcha und Double-Opt-In werden direkt im eingebetteten Brevo-Formular verarbeitet."
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
                {configResult?.message || t("Subscription form is not available right now.", "Abo-Formular ist aktuell nicht verfügbar.")}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("Config Details", "Konfigurationsdetails")}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Provider</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{provider}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Host</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {formatHost(configResult?.parsedUrl || null)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Source", "Quelle")}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">/data/subscription.json</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Checked", "Geprüft")}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">{checkedLabel}</p>
                </div>
              </div>
              {configResult?.message ? (
                <p className="mt-3 text-[11px] text-muted-foreground">{configResult.message}</p>
              ) : null}
            </div>
          </div>

          {configResult?.parsedUrl ? (
            <div className="glass glass-specular rounded-2xl p-4">
              <div className="relative z-10 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Fallback", "Fallback")}
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
