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
