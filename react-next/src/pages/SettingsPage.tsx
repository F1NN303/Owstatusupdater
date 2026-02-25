import AppLayout from "@/components/AppLayout";
import { appBuildMeta, formatBuildLabel, pickLang, useAppShell } from "@/lib/appShell";
import { ExternalLink, Info, Mail, MonitorSmartphone, Settings, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const SettingsPage = () => {
  const { language, setLanguage, reduceMotion, setReduceMotion } = useAppShell();
  const buildMeta = appBuildMeta();
  const versionLabel = formatBuildLabel(language);
  const compactBuildId = buildMeta.id ? buildMeta.id.slice(0, 7) : pickLang(language, "unknown", "unbekannt");
  const buildTimeLabel = buildMeta.stamp || pickLang(language, "Unknown", "Unbekannt");

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Settings", "Einstellungen")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pickLang(
                language,
                "Display and notification preferences for this device",
                "Anzeige- und Benachrichtigungseinstellungen für dieses Gerät"
              )}
            </p>
          </div>
          <div className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Settings size={18} className="text-primary" />
          </div>
        </div>

        <section className="glass glass-specular rounded-2xl p-4">
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <MonitorSmartphone size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Display", "Anzeige")}
              </h2>
            </div>

            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Language", "Sprache")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pickLang(
                    language,
                    "Choose the interface language for this browser.",
                    "Wähle die Sprache der Oberfläche für diesen Browser."
                  )}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      language === "en"
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("de")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      language === "de"
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Deutsch
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {pickLang(language, "Motion", "Bewegung")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pickLang(
                        language,
                        "Reduce UI animations and transitions across the app.",
                        "Reduziert UI-Animationen und Übergänge in der gesamten App."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reduceMotion}
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                      reduceMotion ? "border-primary/40 bg-primary/20" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span
                      className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        reduceMotion ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Notifications", "Benachrichtigungen")}
                </h2>
              </div>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                {pickLang(
                  language,
                  "Manage outage e-mail alerts in the Alerts tab. The signup form is embedded directly in the app.",
                  "Verwalte Störungs-E-Mail-Alarme im Tab „Alarme“. Das Anmeldeformular ist direkt in die App eingebettet."
                )}
              </p>
              <Link
                to="/alerts"
                className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <span>{pickLang(language, "Open Alerts", "Alarme öffnen")}</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "About", "Info")}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {pickLang(language, "Version", "Version")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground" title={versionLabel}>
                    v {compactBuildId}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{buildTimeLabel}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {pickLang(language, "Storage", "Speicher")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {pickLang(
                      language,
                      "Only local UI preferences are stored in your browser.",
                      "Es werden nur lokale UI-Einstellungen im Browser gespeichert."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Info size={14} className="mt-0.5 shrink-0 text-primary/80" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {pickLang(
                    language,
                    "Status and outage data are loaded from the public JSON APIs used by the site.",
                    "Status- und Störungsdaten werden aus den öffentlichen JSON-APIs der Website geladen."
                  )}
                </p>
              </div>

              <a
                href="https://github.com/F1NN303/Owstatusupdater"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>{pickLang(language, "Open GitHub repository", "GitHub-Repository öffnen")}</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <Link
                to="/terms"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>{pickLang(language, "Terms & Ownership", "Nutzung & Eigentum")}</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
};

export default SettingsPage;
