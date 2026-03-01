import { pickLang, type AppLanguage, type AppTimeDisplayMode } from "@/lib/appShell";

interface TimeDisplayOptions {
  language: AppLanguage;
  mode: AppTimeDisplayMode;
  absoluteFormat?: Intl.DateTimeFormatOptions;
  fallbackText?: string;
}

export function parseIsoDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatRelativeLabel(date: Date, language: AppLanguage) {
  const diffSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSec < 15) {
    return pickLang(language, "just now", "gerade eben");
  }
  if (diffSec < 60) {
    return pickLang(language, `${diffSec}s ago`, `vor ${diffSec}s`);
  }

  const totalMin = Math.round(diffSec / 60);
  if (totalMin < 60) {
    return pickLang(language, `${totalMin}m ago`, `vor ${totalMin}m`);
  }

  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    if (mins > 0) {
      return pickLang(language, `${hours}h ${mins}m ago`, `vor ${hours}h ${mins}m`);
    }
    return pickLang(language, `${hours}h ago`, `vor ${hours}h`);
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (remHours > 0) {
    return pickLang(language, `${days}d ${remHours}h ago`, `vor ${days}d ${remHours}h`);
  }
  return pickLang(language, `${days}d ago`, `vor ${days}d`);
}

function formatAbsoluteLabel(date: Date, language: AppLanguage, options?: Intl.DateTimeFormatOptions) {
  const locale = language === "de" ? "de-DE" : "en-US";
  return date.toLocaleString(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatTimestampByMode(value: string | null | undefined, options: TimeDisplayOptions) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return options.fallbackText || pickLang(options.language, "Unknown", "Unbekannt");
  }

  const relative = formatRelativeLabel(parsed, options.language);
  const absolute = formatAbsoluteLabel(parsed, options.language, options.absoluteFormat);

  if (options.mode === "relative") {
    return relative;
  }
  if (options.mode === "absolute") {
    return absolute;
  }
  return `${absolute} (${relative})`;
}
