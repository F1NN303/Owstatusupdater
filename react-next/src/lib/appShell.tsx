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
export type AppFavoriteServiceId = string;

const LANGUAGE_STORAGE_KEY = "owstatusupdater.react.lang";
const REDUCED_MOTION_STORAGE_KEY = "owstatusupdater.react.reduceMotion";
const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

interface AppSettingsV2 {
  schemaVersion: 3;
  language: AppLanguage;
  reduceMotion: boolean;
  favorites: AppFavoriteServiceId[];
  home: {
    defaultFilter: AppHomeDefaultFilter;
    defaultSort: AppHomeSortKey;
    refreshIntervalSec: AppHomeRefreshIntervalSec;
    compactCards: boolean;
    favoritesFirst: boolean;
  };
  time: {
    displayMode: AppTimeDisplayMode;
  };
}

interface AppSettingsV2Payload {
  schemaVersion?: unknown;
  language?: unknown;
  reduceMotion?: unknown;
  favorites?: unknown;
  home?: {
    defaultFilter?: unknown;
    defaultSort?: unknown;
    refreshIntervalSec?: unknown;
    compactCards?: unknown;
    favoritesFirst?: unknown;
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
  favoriteServiceIds: AppFavoriteServiceId[];
  isFavoriteService: (serviceId: string) => boolean;
  setFavoriteService: (serviceId: string, next: boolean) => void;
  toggleFavoriteService: (serviceId: string) => void;
  homeDefaultFilter: AppHomeDefaultFilter;
  setHomeDefaultFilter: (next: AppHomeDefaultFilter) => void;
  homeDefaultSort: AppHomeSortKey;
  setHomeDefaultSort: (next: AppHomeSortKey) => void;
  homeRefreshIntervalSec: AppHomeRefreshIntervalSec;
  setHomeRefreshIntervalSec: (next: AppHomeRefreshIntervalSec) => void;
  homeCompactCards: boolean;
  setHomeCompactCards: (next: boolean) => void;
  homeFavoritesFirst: boolean;
  setHomeFavoritesFirst: (next: boolean) => void;
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

function normalizeFavoriteServiceId(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, 64);
}

function normalizeFavoriteServiceIds(value: unknown, fallback: AppFavoriteServiceId[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const next: AppFavoriteServiceId[] = [];
  for (const item of value) {
    const normalized = normalizeFavoriteServiceId(item);
    if (!normalized || next.includes(normalized)) {
      continue;
    }
    next.push(normalized);
    if (next.length >= 64) {
      break;
    }
  }
  return next;
}

function buildDefaultSettings(): AppSettingsV2 {
  return {
    schemaVersion: 3,
    language: detectBrowserLanguage(),
    reduceMotion: detectSystemReducedMotion(),
    favorites: [],
    home: {
      defaultFilter: "all",
      defaultSort: "impact",
      refreshIntervalSec: 60,
      compactCards: false,
      favoritesFirst: true,
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
    favorites: [...defaults.favorites],
  };
}

function sanitizeSettings(raw: AppSettingsV2Payload | null, fallback: AppSettingsV2): AppSettingsV2 {
  const rawSchemaVersion = Number.parseInt(String(raw?.schemaVersion ?? "").trim(), 10);
  const shouldMigrateFavoritesFirst = !Number.isFinite(rawSchemaVersion) || rawSchemaVersion < 3;
  return {
    schemaVersion: 3,
    language: normalizeLanguage(raw?.language, fallback.language),
    reduceMotion: normalizeBoolean(raw?.reduceMotion, fallback.reduceMotion),
    favorites: normalizeFavoriteServiceIds(raw?.favorites, fallback.favorites),
    home: {
      defaultFilter: normalizeHomeFilter(raw?.home?.defaultFilter, fallback.home.defaultFilter),
      defaultSort: normalizeHomeSort(raw?.home?.defaultSort, fallback.home.defaultSort),
      refreshIntervalSec: normalizeRefreshInterval(
        raw?.home?.refreshIntervalSec,
        fallback.home.refreshIntervalSec
      ),
      compactCards: normalizeBoolean(raw?.home?.compactCards, fallback.home.compactCards),
      favoritesFirst: shouldMigrateFavoritesFirst
        ? true
        : normalizeBoolean(raw?.home?.favoritesFirst, fallback.home.favoritesFirst),
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
      favoriteServiceIds: settings.favorites,
      isFavoriteService: (serviceId) => {
        const normalized = normalizeFavoriteServiceId(serviceId);
        if (!normalized) {
          return false;
        }
        return settings.favorites.includes(normalized);
      },
      setFavoriteService: (serviceId, next) =>
        setSettings((prev) => {
          const normalized = normalizeFavoriteServiceId(serviceId);
          if (!normalized) {
            return prev;
          }
          const alreadyFavorite = prev.favorites.includes(normalized);
          if (next && alreadyFavorite) {
            return prev;
          }
          if (!next && !alreadyFavorite) {
            return prev;
          }
          const favorites = next
            ? [normalized, ...prev.favorites.filter((item) => item !== normalized)]
            : prev.favorites.filter((item) => item !== normalized);
          return {
            ...prev,
            favorites,
          };
        }),
      toggleFavoriteService: (serviceId) =>
        setSettings((prev) => {
          const normalized = normalizeFavoriteServiceId(serviceId);
          if (!normalized) {
            return prev;
          }
          const alreadyFavorite = prev.favorites.includes(normalized);
          const favorites = alreadyFavorite
            ? prev.favorites.filter((item) => item !== normalized)
            : [normalized, ...prev.favorites.filter((item) => item !== normalized)];
          return {
            ...prev,
            favorites,
          };
        }),
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
      homeFavoritesFirst: settings.home.favoritesFirst,
      setHomeFavoritesFirst: (next) =>
        setSettings((prev) => ({
          ...prev,
          home: {
            ...prev.home,
            favoritesFirst: Boolean(next),
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
