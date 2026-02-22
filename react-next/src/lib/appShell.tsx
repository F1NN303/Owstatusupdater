import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLanguage = "en" | "de";

const STORAGE_KEY = "owstatusupdater.react.lang";

interface AppShellContextValue {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  toggleLanguage: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function detectInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "de") {
    return stored;
  }

  const browserLang = String(window.navigator.language || "").toLowerCase();
  return browserLang.startsWith("de") ? "de" : "en";
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(detectInitialLanguage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<AppShellContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage((prev) => (prev === "en" ? "de" : "en")),
    }),
    [language]
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

