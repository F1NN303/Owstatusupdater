import AppLayout from "@/components/AppLayout";
import { appBuildMeta, formatBuildLabel, pickLang, useAppShell } from "@/lib/appShell";
import {
  ExternalLink,
  Info,
  Mail,
  MonitorSmartphone,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function sanitizeCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

const SettingsPage = () => {
  const {
    language,
    setLanguage,
    reduceMotion,
    setReduceMotion,
    homeDefaultFilter,
    setHomeDefaultFilter,
    homeDefaultSort,
    setHomeDefaultSort,
    homeRefreshIntervalSec,
    setHomeRefreshIntervalSec,
    homeCompactCards,
    setHomeCompactCards,
    timeDisplayMode,
    setTimeDisplayMode,
    resetSettings,
  } = useAppShell();
  const buildMeta = appBuildMeta();
  const versionLabel = formatBuildLabel(language);
  const compactBuildId = buildMeta.id ? buildMeta.id.slice(0, 7) : pickLang(language, "unknown", "unbekannt");
  const buildTimeLabel = buildMeta.stamp || pickLang(language, "Unknown", "Unbekannt");

  const initialCategory = useMemo(() => {
    if (!homeDefaultFilter.startsWith("category:")) {
      return "";
    }
    return homeDefaultFilter.slice("category:".length);
  }, [homeDefaultFilter]);
  const [categoryDraft, setCategoryDraft] = useState(initialCategory);
  useEffect(() => {
    setCategoryDraft(initialCategory);
  }, [initialCategory]);

  const defaultFilterMode = homeDefaultFilter.startsWith("category:") ? "category" : homeDefaultFilter;

  const applyCategoryDraft = (rawValue: string) => {
    const normalized = sanitizeCategory(rawValue);
    setCategoryDraft(normalized);
    if (normalized) {
      setHomeDefaultFilter(`category:${normalized}`);
    }
  };

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
                "Display, feed, and notification preferences for this device",
                "Anzeige-, Feed- und Benachrichtigungseinstellungen für dieses Gerät"
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

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {pickLang(language, "Home Feed Defaults", "Home-Feed-Standards")}
            </h2>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Default Filter", "Standardfilter")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { key: "all", en: "All", de: "Alle" },
                  { key: "issues", en: "Issues", de: "Probleme" },
                  { key: "healthy", en: "Healthy", de: "Stabil" },
                  { key: "category", en: "Category", de: "Kategorie" },
                ].map((option) => {
                  const active = defaultFilterMode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        if (option.key === "category") {
                          const nextCategory = sanitizeCategory(categoryDraft) || "gaming";
                          setCategoryDraft(nextCategory);
                          setHomeDefaultFilter(`category:${nextCategory}`);
                          return;
                        }
                        setHomeDefaultFilter(option.key as "all" | "issues" | "healthy");
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {pickLang(language, option.en, option.de)}
                    </button>
                  );
                })}
              </div>
              {defaultFilterMode === "category" ? (
                <input
                  type="text"
                  value={categoryDraft}
                  onChange={(event) => applyCategoryDraft(event.target.value)}
                  placeholder={pickLang(language, "category slug (e.g. gaming)", "Kategorie-Slug (z. B. gaming)")}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
                />
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Default Sort", "Standardsortierung")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { key: "impact", en: "Impact", de: "Impact" },
                  { key: "name", en: "Name", de: "Name" },
                  { key: "updated", en: "Updated", de: "Aktualisiert" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setHomeDefaultSort(option.key as "impact" | "name" | "updated")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      homeDefaultSort === option.key
                        ? "border-primary/35 bg-primary/15 text-primary"
                        : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {pickLang(language, option.en, option.de)}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Auto Refresh", "Auto-Aktualisierung")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[30, 60, 120].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setHomeRefreshIntervalSec(seconds as 30 | 60 | 120)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      homeRefreshIntervalSec === seconds
                        ? "border-primary/35 bg-primary/15 text-primary"
                        : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {pickLang(language, "Compact Cards", "Kompakte Karten")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pickLang(
                      language,
                      "Reduce card spacing in the home feed.",
                      "Reduziert Kartenabstände im Home-Feed."
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={homeCompactCards}
                  onClick={() => setHomeCompactCards(!homeCompactCards)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                    homeCompactCards ? "border-primary/40 bg-primary/20" : "border-white/10 bg-white/5"
                  }`}
                >
                  <span
                    className={`absolute h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      homeCompactCards ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {pickLang(language, "Time Format", "Zeitformat")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "relative", en: "Relative", de: "Relativ" },
                { key: "absolute", en: "Absolute", de: "Absolut" },
                { key: "both", en: "Both", de: "Beides" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTimeDisplayMode(option.key as "relative" | "absolute" | "both")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    timeDisplayMode === option.key
                      ? "border-primary/35 bg-primary/15 text-primary"
                      : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pickLang(language, option.en, option.de)}
                </button>
              ))}
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
                  "Verwalte Störungs-E-Mail-Alarme im Tab \"Alarme\". Das Anmeldeformular ist direkt in die App eingebettet."
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
                      "Only local UI settings are stored in your browser.",
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

              <button
                type="button"
                onClick={resetSettings}
                className="flex w-full items-center justify-between rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/15"
              >
                <span>{pickLang(language, "Reset Device Preferences", "Gerateinstellungen zurucksetzen")}</span>
                <RotateCcw size={14} />
              </button>

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
