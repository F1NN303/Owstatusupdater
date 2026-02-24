import AppLayout from "@/components/AppLayout";
import { pickLang, useAppShell } from "@/lib/appShell";
import { resolveLegacyPath } from "@/lib/legacySite";
import {
  ExternalLink,
  Globe,
  Info,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const runtimeMode = import.meta.env.MODE;

const SettingsPage = () => {
  const { language, setLanguage, reduceMotion, setReduceMotion } = useAppShell();
  const builtAt = new Date().toLocaleString();

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Settings", "Einstellungen")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pickLang(
                language,
                "App controls, links, and migration diagnostics",
                "App-Steuerung, Links und Migrationsdiagnose"
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
              <Wrench size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "App State", "App-Status")}
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Runtime", "Laufzeit")}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">{runtimeMode}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Render", "Darstellung")}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {pickLang(language, "React App", "React-App")}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Session Opened", "Sitzung gestartet")}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">{builtAt}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <Wrench size={14} className="text-primary/80" />
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Preferences", "Einstellungen")}
              </h2>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Language", "Sprache")}
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
                      "Reduziert UI-Animationen und Uebergaenge in der gesamten App."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reduceMotion}
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                    reduceMotion
                      ? "border-primary/40 bg-primary/20"
                      : "border-white/10 bg-white/5"
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
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Navigation", "Navigation")}
                </h2>
              </div>
              <a
                href={resolveLegacyPath("/legacy-home.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>{pickLang(language, "Open legacy home", "Legacy-Startseite oeffnen")}</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <a
                href={resolveLegacyPath("/legacy-overwatch.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>{pickLang(language, "Open legacy Overwatch dashboard", "Legacy-Overwatch-Dashboard oeffnen")}</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              <a
                href={resolveLegacyPath("/sony/legacy-index.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>{pickLang(language, "Open legacy Sony PSN dashboard", "Legacy-Sony-PSN-Dashboard oeffnen")}</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary/80" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {pickLang(language, "Migration Notes", "Migrationshinweise")}
                </h2>
              </div>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {pickLang(
                  language,
                  "Bottom navigation now uses the app-style shell (`Home`, `Favorites`, `Alerts`, `Settings`). Service detail pages remain under Home and use compact tabbed sections.",
                  "Die untere Navigation nutzt jetzt die App-Leiste (`Start`, `Favoriten`, `Alarme`, `Einst.`). Service-Details bleiben unter Start und verwenden kompakte Tab-Bereiche."
                )}
              </p>
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {pickLang(
                  language,
                  "EN/DE toggle and persistent version footer are integrated in the app shell.",
                  "EN/DE-Umschalter und Versionsanzeige sind in die App-Leiste integriert."
                )}
              </p>
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 flex items-center gap-2">
              <Info size={14} className="text-primary/80" />
              <p className="text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "This page changes local UI preferences and links only. Backend status pipelines continue to run in GitHub Actions.",
                  "Diese Seite aendert nur lokale UI-Einstellungen und Links. Die Backend-Status-Pipelines laufen weiter in GitHub Actions."
                )}
              </p>
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
};

export default SettingsPage;
