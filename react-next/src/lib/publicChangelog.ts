export interface PublicChangelogEntry {
  id: string;
  updatedAt: string;
  badgeEn: string;
  badgeDe: string;
  titleEn: string;
  titleDe: string;
  summaryEn: string;
  summaryDe: string;
  bulletsEn: string[];
  bulletsDe: string[];
}

export const publicChangelogEntries: PublicChangelogEntry[] = [
  {
    id: "2026-03-29-delivery-and-refresh-reliability",
    updatedAt: "2026-03-29",
    badgeEn: "Latest update",
    badgeDe: "Letztes Update",
    titleEn: "Delivery and refresh reliability",
    titleDe: "Zustellung und Update-Stabilitaet",
    summaryEn:
      "Alert delivery and app refresh behavior were tightened so the first inbox steps and post-update browsing feel more reliable.",
    summaryDe:
      "Alarm-Zustellung und App-Aktualisierung wurden gestrafft, damit die ersten Postfach-Schritte und das Weiterbrowsen nach Updates verlaesslicher wirken.",
    bulletsEn: [
      "The alert flow now gives clearer inbox recovery guidance when the first message lands in Spam or Junk.",
      "The mailbox help overlay now behaves more cleanly on phones.",
      "Fresh app updates recover more reliably if an older browser cache still points at removed files.",
    ],
    bulletsDe: [
      "Der Alarm-Ablauf gibt jetzt klarere Hinweise, falls die erste Mail in Spam oder Junk landet.",
      "Die Postfach-Hilfe verhaelt sich auf dem Handy jetzt sauberer.",
      "Frische App-Updates erholen sich zuverlaessiger, falls ein aelterer Browser-Cache noch auf entfernte Dateien zeigt.",
    ],
  },
  {
    id: "2026-03-27-alerts-and-mobile-sheet",
    updatedAt: "2026-03-27",
    badgeEn: "Latest update",
    badgeDe: "Letztes Update",
    titleEn: "Inbox delivery polish",
    titleDe: "Postfach-Feinschliff",
    summaryEn:
      "Alert mails and the delivery flow were tightened so the first inbox experience feels clearer on phones and in the app.",
    summaryDe:
      "Alarmmails und der Zustellungsablauf wurden gestrafft, damit sich die erste Postfach-Erfahrung auf dem Handy und in der App klarer anfuehlt.",
    bulletsEn: [
      "Alert mails now use a cleaner branded layout with clearer call-to-action links.",
      "Alerts now include a quick inbox help flow when the first message lands in Spam or Junk.",
      "The update notes now open as a true full-screen sheet on mobile.",
    ],
    bulletsDe: [
      "Alarmmails nutzen jetzt ein klareres Branding mit deutlichere Aktionslinks.",
      "Alarme enthalten jetzt eine schnelle Postfach-Hilfe, falls die erste Mail in Spam oder Junk landet.",
      "Die Update-Hinweise oeffnen sich auf dem Handy jetzt als echtes Vollbild-Sheet.",
    ],
  },
  {
    id: "2026-03-23-mobile-settings-polish",
    updatedAt: "2026-03-23",
    badgeEn: "Latest update",
    badgeDe: "Letztes Update",
    titleEn: "Mobile polish pass",
    titleDe: "Mobiler Feinschliff",
    summaryEn:
      "Several phone-sized layouts and setup cues were tightened so key actions are easier to read and follow.",
    summaryDe:
      "Mehrere Ansichten und Setup-Hinweise fuer Smartphones wurden gestrafft, damit wichtige Aktionen ruhiger und leichter lesbar bleiben.",
    bulletsEn: [
      "The home overview fits more cleanly on narrow screens.",
      "Alert setup gives clearer follow-up cues after signup steps.",
    ],
    bulletsDe: [
      "Die Start-Uebersicht sitzt auf schmalen Displays kompakter.",
      "Die Alarm-Einrichtung gibt nach Anmeldeschritten klarere Rueckmeldungen.",
    ],
  },
  {
    id: "2026-03-22-premium-ui-pass",
    updatedAt: "2026-03-22",
    badgeEn: "Latest update",
    badgeDe: "Letztes Update",
    titleEn: "Cleaner assistant and settings surfaces",
    titleDe: "Klarere Assistent- und Einstellungsoberflaechen",
    summaryEn:
      "The mobile assistant and settings areas were simplified so the app feels calmer and easier to scan on phones.",
    summaryDe:
      "Die mobile Assistent- und Einstellungsansicht wurde vereinfacht, damit die App auf dem Smartphone ruhiger und leichter lesbar wirkt.",
    bulletsEn: [
      "Less visual noise in the AI sheet and settings page.",
      "Improved spacing, readability, and mobile behavior.",
      "Small reliability and interaction fixes.",
    ],
    bulletsDe: [
      "Weniger visuelle Unruhe im KI-Sheet und auf der Einstellungsseite.",
      "Bessere Abstaende, Lesbarkeit und mobiles Verhalten.",
      "Kleine Zuverlaessigkeits- und Interaktionsverbesserungen.",
    ],
  },
  {
    id: "2026-03-22-status-radar-branding",
    updatedAt: "2026-03-22",
    badgeEn: "Brand refresh",
    badgeDe: "Brand-Refresh",
    titleEn: "Status Radar branding rollout",
    titleDe: "Status-Radar-Branding ausgerollt",
    summaryEn:
      "The public wording now presents the project more broadly as a general service-status monitor.",
    summaryDe:
      "Die oeffentliche Wortwahl praesentiert das Projekt jetzt breiter als allgemeinen Service-Status-Monitor.",
    bulletsEn: [
      "Public labels now align better with multi-service monitoring.",
      "The site and assistant use more consistent product language.",
    ],
    bulletsDe: [
      "Oeffentliche Bezeichnungen passen jetzt besser zu mehreren Diensten.",
      "Seite und Assistent nutzen eine konsistentere Produktsprache.",
    ],
  },
  {
    id: "2026-03-21-grounded-assistant",
    updatedAt: "2026-03-21",
    badgeEn: "Assistant update",
    badgeDe: "Assistent-Update",
    titleEn: "Grounded status answers",
    titleDe: "Verlaessliche Statusantworten",
    summaryEn:
      "Assistant replies stay tied to public status data and clear site-help context instead of inventing status logic.",
    summaryDe:
      "Antworten des Assistenten bleiben an oeffentliche Statusdaten und klare Seitenhilfen gebunden, statt Statuslogik zu erfinden.",
    bulletsEn: [
      "Answers focus on summaries, incidents, history, and site help.",
      "If the assistant is offline, the normal status site keeps working.",
    ],
    bulletsDe: [
      "Antworten konzentrieren sich auf Zusammenfassungen, Vorfaelle, Verlauf und Seitenhilfe.",
      "Wenn der Assistent offline ist, funktioniert die normale Statusseite weiter.",
    ],
  },
];

export function formatPublicChangelogDate(value: string, language: "en" | "de") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
