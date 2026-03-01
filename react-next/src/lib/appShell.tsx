import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLanguage = "en" | "de";
export type AppHomeSortKey = "impact" | "name" | "updated";
export type AppTimeDisplayMode = "relative" | "absolute" | "both";
export type AppHomeDefaultFilter = "all" | "issues" | "healthy" | `category:${string}`;
export type AppHomeRefreshIntervalSec = 30 | 60 | 120;

const LANGUAGE_STORAGE_KEY = "owstatusupdater.react.lang";
const REDUCED_MOTION_STORAGE_KEY = "owstatusupdater.react.reduceMotion";
const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

interface AppSettingsV2 {
  schemaVersion: 2;
  language: AppLanguage;
  reduceMotion: boolean;
  home: {
    defaultFilter: AppHomeDefaultFilter;
    defaultSort: AppHomeSortKey;
    refreshIntervalSec: AppHomeRefreshIntervalSec;
    compactCards: boolean;
  };
  time: {
    displayMode: AppTimeDisplayMode;
  };
}

interface AppSettingsV2Payload {
  schemaVersion?: unknown;
  language?: unknown;
  reduceMotion?: unknown;
  home?: {
    defaultFilter?: unknown;
    defaultSort?: unknown;
    refreshIntervalSec?: unknown;
    compactCards?: unknown;
  } | null;
  time?: {
    displayMode?: unknown;
  } | null;
}

interface AppShellContextValue {
  settings: AppSettingsV2;
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  toggleLanguage: () => void;
  reduceMotion: boolean;
  setReduceMotion: (next: boolean) => void;
  homeDefaultFilter: AppHomeDefaultFilter;
  setHomeDefaultFilter: (next: AppHomeDefaultFilter) => void;
  homeDefaultSort: AppHomeSortKey;
  setHomeDefaultSort: (next: AppHomeSortKey) => void;
  homeRefreshIntervalSec: AppHomeRefreshIntervalSec;
  setHomeRefreshIntervalSec: (next: AppHomeRefreshIntervalSec) => void;
  homeCompactCards: boolean;
  setHomeCompactCards: (next: boolean) => void;
  timeDisplayMode: AppTimeDisplayMode;
  setTimeDisplayMode: (next: AppTimeDisplayMode) => void;
  resetSettings: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function detectBrowserLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const browserLang = String(window.navigator.language || "").toLowerCase();
  return browserLang.startsWith("de") ? "de" : "en";
}

function detectSystemReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function normalizeLanguage(value: unknown, fallback: AppLanguage) {
  return value === "de" || value === "en" ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "1" || value === "true") {
    return true;
  }
  if (value === "0" || value === "false") {
    return false;
  }
  return fallback;
}

function normalizeHomeSort(value: unknown, fallback: AppHomeSortKey) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "impact" || normalized === "name" || normalized === "updated") {
    return normalized;
  }
  return fallback;
}

function normalizeHomeFilter(value: unknown, fallback: AppHomeDefaultFilter) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "all" || normalized === "issues" || normalized === "healthy") {
    return normalized;
  }
  if (normalized.startsWith("category:")) {
    const category = normalized.slice("category:".length).trim();
    if (category) {
      return `category:${category}`;
    }
  }
  return fallback;
}

function normalizeRefreshInterval(value: unknown, fallback: AppHomeRefreshIntervalSec) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (parsed === 30 || parsed === 60 || parsed === 120) {
    return parsed;
  }
  return fallback;
}

function normalizeTimeDisplayMode(value: unknown, fallback: AppTimeDisplayMode) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "relative" || normalized === "absolute" || normalized === "both") {
    return normalized;
  }
  return fallback;
}

function buildDefaultSettings(): AppSettingsV2 {
  return {
    schemaVersion: 2,
    language: detectBrowserLanguage(),
    reduceMotion: detectSystemReducedMotion(),
    home: {
      defaultFilter: "all",
      defaultSort: "impact",
      refreshIntervalSec: 60,
      compactCards: false,
    },
    time: {
      displayMode: "both",
    },
  };
}

function migrateLegacySettings(defaults: AppSettingsV2): AppSettingsV2 {
  if (typeof window === "undefined") {
    return defaults;
  }

  const legacyLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const legacyReducedMotion = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);

  return {
    ...defaults,
    language: normalizeLanguage(legacyLanguage, defaults.language),
    reduceMotion: normalizeBoolean(legacyReducedMotion, defaults.reduceMotion),
  };
}

function sanitizeSettings(raw: AppSettingsV2Payload | null, fallback: AppSettingsV2): AppSettingsV2 {
  return {
    schemaVersion: 2,
    language: normalizeLanguage(raw?.language, fallback.language),
    reduceMotion: normalizeBoolean(raw?.reduceMotion, fallback.reduceMotion),
    home: {
      defaultFilter: normalizeHomeFilter(raw?.home?.defaultFilter, fallback.home.defaultFilter),
      defaultSort: normalizeHomeSort(raw?.home?.defaultSort, fallback.home.defaultSort),
      refreshIntervalSec: normalizeRefreshInterval(
        raw?.home?.refreshIntervalSec,
        fallback.home.refreshIntervalSec
      ),
      compactCards: normalizeBoolean(raw?.home?.compactCards, fallback.home.compactCards),
    },
    time: {
      displayMode: normalizeTimeDisplayMode(raw?.time?.displayMode, fallback.time.displayMode),
    },
  };
}

function detectInitialSettings(): AppSettingsV2 {
  const defaults = migrateLegacySettings(buildDefaultSettings());
  if (typeof window === "undefined") {
    return defaults;
  }

  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(stored) as AppSettingsV2Payload;
    return sanitizeSettings(parsed, defaults);
  } catch {
    return defaults;
  }
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsV2>(detectInitialSettings);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    window.localStorage.removeItem(REDUCED_MOTION_STORAGE_KEY);
    document.documentElement.dataset.motion = settings.reduceMotion ? "reduced" : "full";
  }, [settings]);

  const value = useMemo<AppShellContextValue>(
    () => ({
      settings,
      language: settings.language,
      setLanguage: (next) =>
        setSettings((prev) => ({
          ...prev,
          language: normalizeLanguage(next, prev.language),
        })),
      toggleLanguage: () =>
        setSettings((prev) => ({
          ...prev,
          language: prev.language === "en" ? "de" : "en",
        })),
      reduceMotion: settings.reduceMotion,
      setReduceMotion: (next) =>
        setSettings((prev) => ({
          ...prev,
          reduceMotion: Boolean(next),
        })),
      homeDefaultFilter: settings.home.defaultFilter,
      setHomeDefaultFilter: (next) =>
        setSettings((prev) => ({
          ...prev,
          home: {
            ...prev.home,
            defaultFilter: normalizeHomeFilter(next, prev.home.defaultFilter),
          },
        })),
      homeDefaultSort: settings.home.defaultSort,
      setHomeDefaultSort: (next) =>
        setSettings((prev) => ({
          ...prev,
          home: {
            ...prev.home,
            defaultSort: normalizeHomeSort(next, prev.home.defaultSort),
          },
        })),
      homeRefreshIntervalSec: settings.home.refreshIntervalSec,
      setHomeRefreshIntervalSec: (next) =>
        setSettings((prev) => ({
          ...prev,
          home: {
            ...prev.home,
            refreshIntervalSec: normalizeRefreshInterval(next, prev.home.refreshIntervalSec),
          },
        })),
      homeCompactCards: settings.home.compactCards,
      setHomeCompactCards: (next) =>
        setSettings((prev) => ({
          ...prev,
          home: {
            ...prev.home,
            compactCards: Boolean(next),
          },
        })),
      timeDisplayMode: settings.time.displayMode,
      setTimeDisplayMode: (next) =>
        setSettings((prev) => ({
          ...prev,
          time: {
            ...prev.time,
            displayMode: normalizeTimeDisplayMode(next, prev.time.displayMode),
          },
        })),
      resetSettings: () => setSettings(buildDefaultSettings()),
    }),
    [settings]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return ctx;
}

export function pickLang<T>(language: AppLanguage, en: T, de: T): T {
  return language === "de" ? de : en;
}

export function appBuildMeta() {
  const stamp =
    (import.meta.env.VITE_BUILD_STAMP as string | undefined) ||
    (import.meta.env.VITE_BUILD_TIME as string | undefined) ||
    "";
  const id =
    (import.meta.env.VITE_BUILD_ID as string | undefined) ||
    (import.meta.env.VITE_GIT_SHA as string | undefined) ||
    "";
  return { stamp, id };
}

export function formatBuildLabel(language: AppLanguage) {
  const { stamp, id } = appBuildMeta();
  const prefix = language === "de" ? "Version" : "Version";

  if (!stamp && !id) {
    return `${prefix}: ${language === "de" ? "unbekannt" : "unknown"}`;
  }

  const shortId = id ? id.slice(0, 7) : "";
  if (stamp && shortId) {
    return `${prefix}: ${stamp} | ${shortId}`;
  }
  if (stamp) {
    return `${prefix}: ${stamp}`;
  }
  return `${prefix}: ${shortId}`;
}
