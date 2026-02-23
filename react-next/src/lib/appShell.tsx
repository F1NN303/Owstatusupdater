import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLanguage = "en" | "de";

const LANGUAGE_STORAGE_KEY = "owstatusupdater.react.lang";
const REDUCED_MOTION_STORAGE_KEY = "owstatusupdater.react.reduceMotion";

interface AppShellContextValue {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  toggleLanguage: () => void;
  reduceMotion: boolean;
  setReduceMotion: (next: boolean) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function detectInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "de") {
    return stored;
  }

  const browserLang = String(window.navigator.language || "").toLowerCase();
  return browserLang.startsWith("de") ? "de" : "en";
}

function detectInitialReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
  if (stored === "1") {
    return true;
  }
  if (stored === "0") {
    return false;
  }

  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(detectInitialLanguage);
  const [reduceMotion, setReduceMotion] = useState<boolean>(detectInitialReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, reduceMotion ? "1" : "0");
    document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
  }, [reduceMotion]);

  const value = useMemo<AppShellContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((prev) => (prev === "en" ? "de" : "en")),
      reduceMotion,
      setReduceMotion,
    }),
    [language, reduceMotion]
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
    return `${prefix}: Preview`;
  }

  const shortId = id ? id.slice(0, 7) : "";
  if (stamp && shortId) {
    return `${prefix}: ${stamp} · ${shortId}`;
  }
  if (stamp) {
    return `${prefix}: ${stamp}`;
  }
  return `${prefix}: ${shortId}`;
}
