import AppLayout from "@/components/AppLayout";
import { GlassSection, PageIntro, PageShell } from "@/components/PageScaffold";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAlertAccount } from "@/lib/alertAccount";
import { appBuildMeta, pickLang, useAppShell } from "@/lib/appShell";
import { formatPublicChangelogDate, publicChangelogEntries } from "@/lib/publicChangelog";
import { cn } from "@/lib/utils";
import {
  BellRing,
  BookOpenText,
  ChevronRight,
  ExternalLink,
  HardDriveDownload,
  History,
  MonitorSmartphone,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  WandSparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function sanitizeCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function formatBuildStamp(value: string | undefined, language: "en" | "de") {
  if (!value) {
    return pickLang(language, "Unknown", "Unbekannt");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function SettingsSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SegmentGroup<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1", className)}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              active
                ? "bg-primary/20 text-primary shadow-[0_0_0_1px_rgba(56,189,248,0.14)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
        checked ? "border-primary/40 bg-primary/20" : "border-white/10 bg-white/5",
      )}
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function SummaryChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-300">
      <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className={cn("truncate font-medium text-slate-100", valueClassName)}>{value}</span>
    </span>
  );
}

function SettingsGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SettingsSurface className={cn("overflow-hidden p-0", className)}>
      <div className="divide-y divide-white/8">{children}</div>
    </SettingsSurface>
  );
}

function SettingsRow({
  eyebrow,
  title,
  description,
  control,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{description}</p>
        </div>
        {control ? <div className="shrink-0 pt-0.5">{control}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function PublicChangelogSheet({
  language,
  compactBuildId,
  buildTimeLabel,
}: {
  language: "en" | "de";
  compactBuildId: string;
  buildTimeLabel: string;
}) {
  const isMobile = useIsMobile();
  const latestEntry = publicChangelogEntries[0];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-start justify-between gap-3 rounded-[22px] border border-primary/20 bg-primary/10 px-4 py-3.5 text-left transition-all duration-200 hover:bg-primary/15"
        >
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              {pickLang(language, "What's new", "Was ist neu")}
            </p>
            <p className="mt-1 max-w-[15.5rem] text-sm font-semibold leading-5 text-foreground sm:max-w-none">
              {language === "de" ? latestEntry.titleDe : latestEntry.titleEn}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {formatPublicChangelogDate(latestEntry.updatedAt, language)}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
        </button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(7,12,24,0.98),rgba(7,12,24,0.94))] p-0 text-foreground",
          isMobile
            ? "inset-x-0 bottom-0 top-0 h-[100dvh] max-h-[100dvh] rounded-none border-x-0 border-b-0 shadow-[0_-24px_64px_rgba(2,8,23,0.5)]"
            : "h-full sm:max-w-[420px] sm:rounded-none sm:border-l",
        )}
      >
        <div className="relative flex h-full min-h-0 flex-col">
          {isMobile ? <div className="mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] h-1.5 w-12 rounded-full bg-white/15" /> : null}

          <SheetHeader className="border-b border-white/8 px-4 pb-4 pt-3 pr-14 text-left sm:px-6 sm:pb-4 sm:pt-5 sm:pr-16">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
                <History size={18} />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-[17px] font-semibold tracking-[-0.02em]">
                  {pickLang(language, "Recent changes", "Letzte Aenderungen")}
                </SheetTitle>
                <SheetDescription className="mt-1 max-w-[15.5rem] text-[13px] leading-6 text-muted-foreground sm:max-w-[18rem]">
                  {pickLang(
                    language,
                    "Short public notes about visible updates.",
                    "Kurze oeffentliche Hinweise zu sichtbaren Updates.",
                  )}
                </SheetDescription>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300">
                v {compactBuildId}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300">
                {buildTimeLabel}
              </span>
            </div>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="space-y-4">
              {publicChangelogEntries.map((entry) => {
                const badge = language === "de" ? entry.badgeDe : entry.badgeEn;
                const title = language === "de" ? entry.titleDe : entry.titleEn;
                const summary = language === "de" ? entry.summaryDe : entry.summaryEn;
                const bullets = language === "de" ? entry.bulletsDe : entry.bulletsEn;

                return (
                  <div
                    key={entry.id}
                    className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4"
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        {badge}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatPublicChangelogDate(entry.updatedAt, language)}
                      </span>
                    </div>

                    <div className="mt-3 max-w-[18rem] sm:max-w-none">
                      <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
                      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{summary}</p>
                    </div>
                    <ul className="mt-3 max-w-[18rem] space-y-2 pl-4 text-[13px] leading-6 text-slate-200 marker:text-primary sm:max-w-none">
                      {bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
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
    homeFavoritesFirst,
    setHomeFavoritesFirst,
    timeDisplayMode,
    setTimeDisplayMode,
    alertServiceIds,
    alertSeverityThreshold,
    homeHintsDismissed,
    reopenHomeHints,
    resetSettings,
  } = useAppShell();
  const {
    status: alertAccountStatus,
    isConnected: alertAccountConnected,
    profile: alertAccountProfile,
    sessionEmail,
  } = useAlertAccount();

  const buildMeta = appBuildMeta();
  const compactBuildId = buildMeta.id ? buildMeta.id.slice(0, 7) : pickLang(language, "unknown", "unbekannt");
  const buildTimeLabel = formatBuildStamp(buildMeta.stamp, language);
  const syncStatusLabel =
    alertAccountProfile?.brevoSyncStatus === "synced"
      ? pickLang(language, "Synced", "Synchronisiert")
      : alertAccountProfile?.brevoSyncStatus === "error"
        ? pickLang(language, "Sync issue", "Sync-Problem")
        : alertAccountProfile?.providerContactId
          ? pickLang(language, "Checking signup", "Anmeldung wird geprueft")
        : pickLang(language, "Not connected", "Nicht verbunden");

  const alertsSummary = pickLang(
    language,
    alertAccountStatus === "checking"
      ? "Alert account state is being checked. Local browser selections stay in place while the connection is verified."
      : alertAccountStatus === "error"
        ? "The alert account could not be verified right now. Local alert selections stay on this device until the connection is healthy again."
        : alertAccountConnected
      ? `Alerts are managed on the Alerts page. Connected as ${sessionEmail || "unknown"}, watching ${alertServiceIds.length} services. Sync: ${syncStatusLabel}.`
      : `Alerts are managed on the Alerts page. ${alertServiceIds.length} services are currently selected only on this device. Threshold: ${
          alertSeverityThreshold === "degraded" ? "degraded+" : "major only"
        }.`,
    alertAccountStatus === "checking"
      ? "Der Status des Alarm-Kontos wird gerade geprueft. Lokale Browser-Auswahlen bleiben bestehen, waehrend die Verbindung verifiziert wird."
      : alertAccountStatus === "error"
        ? "Das Alarm-Konto konnte gerade nicht verifiziert werden. Lokale Alarm-Auswahlen bleiben auf diesem Geraet, bis die Verbindung wieder gesund ist."
        : alertAccountConnected
      ? `Alarme werden auf der Alarm-Seite verwaltet. Verbunden als ${sessionEmail || "unbekannt"}, ${alertServiceIds.length} Services werden beobachtet. Sync: ${syncStatusLabel}.`
      : `Alarme werden auf der Alarm-Seite verwaltet. ${alertServiceIds.length} Services sind aktuell nur auf diesem Geraet ausgewaehlt. Schwelle: ${
          alertSeverityThreshold === "degraded" ? "beeintraechtigt+" : "nur groessere"
        }.`,
  );
  const storageSummary = pickLang(
    language,
    alertAccountConnected
      ? "Local UI settings stay in your browser. Alert account preferences are also saved to Supabase."
      : "Only local UI settings are stored in your browser.",
    alertAccountConnected
      ? "Lokale UI-Einstellungen bleiben im Browser. Alarm-Konto-Einstellungen werden zusaetzlich in Supabase gespeichert."
      : "Es werden nur lokale UI-Einstellungen im Browser gespeichert.",
  );
  const heroDescription = pickLang(
    language,
    "Adjust display, home feed, and alert defaults saved in this browser.",
    "Passe Anzeige-, Startseiten- und Alarm-Standards an, die in diesem Browser gespeichert sind.",
  );
  const heroTitle = pickLang(
    language,
    "Defaults for this browser.",
    "Standards fuer diesen Browser.",
  );
  const heroEyebrow = pickLang(language, "This browser", "Dieser Browser");
  const alertStatusValue =
    alertAccountStatus === "checking"
      ? pickLang(language, "Checking", "Pruefe")
      : alertAccountStatus === "error"
        ? pickLang(language, "Issue", "Problem")
        : alertAccountConnected
          ? pickLang(language, "Connected", "Verbunden")
          : pickLang(language, "Local only", "Nur lokal");
  const alertStatusValueClassName =
    alertAccountStatus === "checking"
      ? "text-amber-200"
      : alertAccountStatus === "error"
        ? "text-rose-200"
        : alertAccountConnected
          ? "text-emerald-300"
          : undefined;
  const motionValue = reduceMotion
    ? pickLang(language, "Reduced motion", "Weniger Bewegung")
    : pickLang(language, "Full motion", "Volle Bewegung");
  const buildMetaLabel = pickLang(language, "Build", "Build");

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
  const defaultFilterLabel =
    defaultFilterMode === "issues"
      ? pickLang(language, "Issues", "Probleme")
      : defaultFilterMode === "healthy"
        ? pickLang(language, "Healthy", "Stabil")
        : defaultFilterMode === "category"
          ? pickLang(language, "Category", "Kategorie")
          : pickLang(language, "All", "Alle");
  const defaultSortLabel =
    homeDefaultSort === "name"
      ? pickLang(language, "Name", "Name")
      : homeDefaultSort === "updated"
        ? pickLang(language, "Updated", "Aktualisiert")
        : pickLang(language, "Impact", "Impact");
  const refreshLabel = `${homeRefreshIntervalSec}s`;
  const feedStatValue = `${defaultSortLabel} / ${refreshLabel}`;
  const homeDefaultsSummary = pickLang(
    language,
    `Home opens with ${defaultFilterLabel.toLowerCase()} items, ${defaultSortLabel.toLowerCase()} sorting, and a ${refreshLabel} refresh cadence.`,
    `Start zeigt standardmaessig ${defaultFilterLabel.toLowerCase()}, sortiert nach ${defaultSortLabel.toLowerCase()}, mit ${refreshLabel} Aktualisierung.`,
  );
  const applyCategoryDraft = (rawValue: string) => {
    const normalized = sanitizeCategory(rawValue);
    setCategoryDraft(normalized);
    if (normalized) {
      setHomeDefaultFilter(`category:${normalized}`);
    }
  };

  return (
    <AppLayout>
      <PageShell className="pb-8">
        <PageIntro
          title={pickLang(language, "Settings", "Einstellungen")}
          description={pickLang(
            language,
            "Display, home feed, and alert defaults for this browser",
            "Anzeige, Startseite und Alarm-Standards fuer diesen Browser",
          )}
          action={
            <div className="glass flex h-12 w-12 items-center justify-center rounded-2xl">
              <Settings size={18} className="text-primary" />
            </div>
          }
        />

        <GlassSection className="overflow-hidden border-white/12 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(8,15,29,0.92))]" contentClassName="space-y-4">
          <div className="min-w-0">
            <div className="min-w-0 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">{heroEyebrow}</p>
                <h2 className="mt-2 max-w-[14rem] text-[24px] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground">
                  {heroTitle}
                </h2>
                <p className="mt-2 max-w-[24rem] text-[13px] leading-6 text-muted-foreground">{heroDescription}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <SummaryChip label={buildMetaLabel} value={`v ${compactBuildId}`} />
                <SummaryChip label={pickLang(language, "Updated", "Aktualisiert")} value={buildTimeLabel} />
                <SummaryChip label={pickLang(language, "Language", "Sprache")} value={language === "de" ? "Deutsch" : "English"} />
                <SummaryChip
                  label={pickLang(language, "Alerts", "Alarme")}
                  value={alertStatusValue}
                  valueClassName={alertStatusValueClassName}
                />
                <SummaryChip label={pickLang(language, "Feed", "Feed")} value={feedStatValue} />
                <SummaryChip label={pickLang(language, "Motion", "Bewegung")} value={motionValue} />
              </div>

              <SettingsSurface className="border-primary/15 bg-black/20">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                  {pickLang(language, "Current defaults", "Aktuelle Standards")}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{homeDefaultsSummary}</p>
              </SettingsSurface>
            </div>
          </div>
        </GlassSection>

        <section className="mt-4 grid gap-4">
          <GlassSection contentClassName="space-y-4">
            <SectionHeading
              icon={<MonitorSmartphone size={18} />}
              eyebrow={pickLang(language, "Display", "Anzeige")}
              title={pickLang(language, "Display and time", "Ansicht und Zeit")}
              description={pickLang(
                language,
                "Language, motion, and time labels for this browser.",
                "Sprache, Bewegung und Zeitangaben fuer diesen Browser.",
              )}
            />

            <SettingsGroup>
              <SettingsRow
                eyebrow={pickLang(language, "Language", "Sprache")}
                title={pickLang(language, "Status page language", "Sprache der Statusseite")}
                description={pickLang(
                  language,
                  "Choose the primary language used across the site.",
                  "Lege die Hauptsprache fuer die gesamte Statusseite fest.",
                )}
              >
                <SegmentGroup
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { key: "en", label: "English" },
                    { key: "de", label: "Deutsch" },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                eyebrow={pickLang(language, "Time format", "Zeitformat")}
                title={pickLang(language, "Timestamp style", "Zeitangaben")}
                description={pickLang(
                  language,
                  "Choose whether status updates should look relative, absolute, or combined.",
                  "Lege fest, ob Statusupdates relativ, absolut oder kombiniert erscheinen.",
                )}
              >
                <SegmentGroup
                  value={timeDisplayMode}
                  onChange={setTimeDisplayMode}
                  options={[
                    { key: "relative", label: pickLang(language, "Relative", "Relativ") },
                    { key: "absolute", label: pickLang(language, "Absolute", "Absolut") },
                    { key: "both", label: pickLang(language, "Both", "Beides") },
                  ]}
                />
              </SettingsRow>

              <SettingsRow
                eyebrow={pickLang(language, "Motion", "Bewegung")}
                title={pickLang(language, "Reduce interface motion", "Weniger Bewegung")}
                description={pickLang(
                  language,
                  "Use calmer transitions across the app on this device.",
                  "Nutzt in diesem Browser ruhigere Uebergaenge in der gesamten App.",
                )}
                control={
                  <ToggleSwitch
                    checked={reduceMotion}
                    onCheckedChange={setReduceMotion}
                    ariaLabel={pickLang(language, "Reduce interface motion", "Weniger Bewegung")}
                  />
                }
              />
            </SettingsGroup>
          </GlassSection>

          <GlassSection contentClassName="space-y-4">
            <SectionHeading
              icon={<SlidersHorizontal size={18} />}
              eyebrow={pickLang(language, "Home feed", "Home-Feed")}
              title={pickLang(language, "Default feed behavior", "Standardverhalten des Feeds")}
              description={pickLang(
                language,
                "Choose how the start view should look before you filter anything.",
                "Lege fest, wie die Startansicht aussieht, bevor du filterst.",
              )}
            />

            <div className="grid gap-3">
              <SettingsSurface className="bg-white/[0.035]">
                <div className="flex flex-wrap gap-2">
                  <SummaryChip label={pickLang(language, "Filter", "Filter")} value={defaultFilterLabel} />
                  <SummaryChip label={pickLang(language, "Sort", "Sortierung")} value={defaultSortLabel} />
                  <SummaryChip label={pickLang(language, "Refresh", "Refresh")} value={refreshLabel} />
                </div>
              </SettingsSurface>

              <SettingsGroup>
                <SettingsRow
                  eyebrow={pickLang(language, "Default filter", "Standardfilter")}
                  title={pickLang(language, "Choose the first feed view", "Erste Feed-Ansicht waehlen")}
                  description={pickLang(
                    language,
                    "Pick what the home page should emphasize before you use manual filters.",
                    "Lege fest, was die Startseite betonen soll, bevor du manuell filterst.",
                  )}
                >
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: pickLang(language, "All", "Alle") },
                      { key: "issues", label: pickLang(language, "Issues", "Probleme") },
                      { key: "healthy", label: pickLang(language, "Healthy", "Stabil") },
                      { key: "category", label: pickLang(language, "Category", "Kategorie") },
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
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                            active
                              ? "border-primary/35 bg-primary/15 text-primary"
                              : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {defaultFilterMode === "category" ? (
                    <input
                      type="text"
                      aria-label={pickLang(language, "Default category slug", "Standard-Kategorie-Slug")}
                      value={categoryDraft}
                      onChange={(event) => applyCategoryDraft(event.target.value)}
                      placeholder={pickLang(language, "category slug (e.g. gaming)", "Kategorie-Slug (z. B. gaming)")}
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/40"
                    />
                  ) : null}
                </SettingsRow>

                <SettingsRow
                  eyebrow={pickLang(language, "Default sort", "Standardsortierung")}
                  title={pickLang(language, "Order the home feed", "Home-Feed sortieren")}
                  description={pickLang(
                    language,
                    "Keep impact first, alphabetical, or freshest updates near the top.",
                    "Lege Impact, Alphabet oder die frischesten Updates nach vorne.",
                  )}
                >
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "impact", label: pickLang(language, "Impact", "Impact") },
                      { key: "name", label: pickLang(language, "Name", "Name") },
                      { key: "updated", label: pickLang(language, "Updated", "Aktualisiert") },
                    ].map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setHomeDefaultSort(option.key as "impact" | "name" | "updated")}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                          homeDefaultSort === option.key
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </SettingsRow>

                <SettingsRow
                  eyebrow={pickLang(language, "Auto refresh", "Auto-Aktualisierung")}
                title={pickLang(language, "Refresh cadence", "Aktualisierungsrhythmus")}
                description={pickLang(
                  language,
                  "Choose how often the home feed should refresh live data.",
                  "Lege fest, wie oft der Home-Feed Live-Daten aktualisieren soll.",
                )}
              >
                  <div className="flex flex-wrap gap-2">
                    {[30, 60, 120].map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => setHomeRefreshIntervalSec(seconds as 30 | 60 | 120)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                          homeRefreshIntervalSec === seconds
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                </SettingsRow>
              </SettingsGroup>

              <SettingsGroup>
                <SettingsRow
                  eyebrow={pickLang(language, "Compact cards", "Kompakte Karten")}
                  title={pickLang(language, "Reduce card spacing", "Weniger Kartenabstand")}
                  description={pickLang(
                    language,
                    "Fits more services into the first viewport.",
                    "Bringt mehr Services in den ersten Viewport.",
                  )}
                  control={
                    <ToggleSwitch
                      checked={homeCompactCards}
                      onCheckedChange={setHomeCompactCards}
                      ariaLabel={pickLang(language, "Reduce card spacing", "Weniger Kartenabstand")}
                    />
                  }
                />

                <SettingsRow
                  eyebrow={pickLang(language, "Favorites first", "Favoriten zuerst")}
                  title={pickLang(language, "Keep starred services near the top", "Markierte Services oben halten")}
                  description={pickLang(
                    language,
                    "Helpful if you mainly track a smaller set of services.",
                    "Hilfreich, wenn du vor allem eine kleinere Auswahl verfolgst.",
                  )}
                  control={
                    <ToggleSwitch
                      checked={homeFavoritesFirst}
                      onCheckedChange={setHomeFavoritesFirst}
                      ariaLabel={pickLang(language, "Keep starred services near the top", "Markierte Services oben halten")}
                    />
                  }
                />
              </SettingsGroup>
            </div>
          </GlassSection>

          <GlassSection contentClassName="space-y-4">
            <SectionHeading
              icon={<BookOpenText size={18} />}
              eyebrow={pickLang(language, "System", "System")}
              title={pickLang(language, "Storage, alerts, and updates", "Speicher, Alarme und Updates")}
              description={pickLang(
                language,
                "Quick links and controls for this browser and your connected alert account.",
                "Schnelle Links und Steuerungen fuer diesen Browser und dein verbundenes Alarm-Konto.",
              )}
            />

            <SettingsGroup>
              <SettingsRow
                eyebrow={pickLang(language, "This browser", "Dieser Browser")}
                title={pickLang(language, "Local storage", "Lokaler Speicher")}
                description={storageSummary}
                control={<HardDriveDownload size={16} className="text-primary/80" aria-hidden="true" />}
              />

              <SettingsRow
                eyebrow={pickLang(language, "Alerts", "Alarme")}
                title={pickLang(language, "Alert account", "Alarm-Konto")}
                description={alertsSummary}
                control={<BellRing size={16} className="text-primary/80" aria-hidden="true" />}
              >
                <Link
                  to="/alerts"
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-black/30"
                >
                  {pickLang(language, "Open alerts center", "Alarm-Center oeffnen")}
                  <ChevronRight size={14} />
                </Link>
              </SettingsRow>
            </SettingsGroup>

            <div className="grid gap-2">
              <PublicChangelogSheet language={language} compactBuildId={compactBuildId} buildTimeLabel={buildTimeLabel} />

              <button
                type="button"
                onClick={reopenHomeHints}
                className="flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {homeHintsDismissed
                      ? pickLang(language, "Show onboarding tips again", "Hinweise erneut anzeigen")
                      : pickLang(language, "Onboarding tips are active", "Hinweise sind aktiv")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    {pickLang(
                      language,
                      "Restore the quick guidance shown to first-time visitors.",
                      "Stellt die kurze Anleitung fuer Erstbesucher wieder her.",
                    )}
                  </p>
                </div>
                <WandSparkles size={16} className="shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={resetSettings}
                className="flex w-full items-center justify-between rounded-[22px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-left transition-colors hover:bg-amber-300/15"
              >
                <div>
                  <p className="text-sm font-medium text-amber-100">
                    {pickLang(language, "Reset browser defaults", "Browser-Standards zuruecksetzen")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-amber-100/75">
                    {pickLang(
                      language,
                      "Clears local defaults for this browser without touching the public site.",
                      "Setzt lokale Standards fuer diesen Browser zurueck, ohne die oeffentliche Seite zu veraendern.",
                    )}
                  </p>
                </div>
                <RotateCcw size={16} className="shrink-0 text-amber-100" />
              </button>

              <a
                href="https://github.com/F1NN303/Owstatusupdater"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {pickLang(language, "Open GitHub repository", "GitHub-Repository oeffnen")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    {pickLang(language, "Public project page and code history.", "Oeffentliche Projektseite und Code-Historie.")}
                  </p>
                </div>
                <ExternalLink size={16} className="shrink-0 text-muted-foreground" />
              </a>

              <Link
                to="/terms"
                className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {pickLang(language, "Terms & ownership", "Nutzung & Eigentum")}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    {pickLang(language, "Project scope, usage notes, and ownership info.", "Projektumfang, Nutzungsnotizen und Eigentumsinfos.")}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </Link>
            </div>
          </GlassSection>
        </section>
      </PageShell>
    </AppLayout>
  );
};

export default SettingsPage;
