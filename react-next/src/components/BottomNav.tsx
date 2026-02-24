import { Bell, Home, Settings, Star } from "lucide-react";
import { appBuildMeta, formatBuildLabel, pickLang, useAppShell } from "@/lib/appShell";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  {
    icon: Home,
    labelKey: "home",
    path: "/",
    matches: ["/", "/status/overwatch", "/status/sony"],
  },
  { icon: Star, labelKey: "favorites", path: "/favorites", matches: ["/favorites"] },
  { icon: Bell, labelKey: "alerts", path: "/alerts", matches: ["/alerts", "/email-alerts"] },
  { icon: Settings, labelKey: "settings", path: "/settings", matches: ["/settings"] },
];

const BottomNav = () => {
  const { language, setLanguage } = useAppShell();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const versionLabel = formatBuildLabel(language);
  const buildMeta = appBuildMeta();
  const compactVersionLabel = buildMeta.id
    ? `v ${buildMeta.id.slice(0, 7)}`
    : pickLang(language, "v unknown", "v unbekannt");

  const navLabel = (key: string) => {
    if (key === "home") {
      return pickLang(language, "Home", "Start");
    }
    if (key === "favorites") {
      return pickLang(language, "Favorites", "Favoriten");
    }
    if (key === "alerts") {
      return pickLang(language, "Alerts", "Alarme");
    }
    if (key === "settings") {
      return pickLang(language, "Settings", "Einst.");
    }
    return key;
  };

  const activeIndex = navItems.findIndex((item) => {
    return item.matches.some((matchPath) => {
      const normalizedMatch = matchPath.replace(/\/+$/, "") || "/";
      if (normalizedMatch === "/") {
        return normalizedPath === "/";
      }
      return (
        normalizedPath === normalizedMatch ||
        normalizedPath.startsWith(`${normalizedMatch}/`)
      );
    });
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-0">
      <div className="pointer-events-none mx-auto mb-1.5 flex max-w-md items-center justify-center px-1">
        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-1.5 py-1 shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`rounded-full px-2 py-1 text-[10px] font-semibold transition-colors ${
              language === "en"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Switch language to English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage("de")}
            className={`rounded-full px-2 py-1 text-[10px] font-semibold transition-colors ${
              language === "de"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Sprache auf Deutsch wechseln"
          >
            DE
          </button>
          <span className="h-3.5 w-px bg-white/10" aria-hidden="true" />
          <div
            className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] text-muted-foreground"
            title={versionLabel}
            aria-label={versionLabel}
          >
            {compactVersionLabel}
          </div>
        </div>
      </div>
      <div className="glass-nav mx-auto flex max-w-md items-center justify-around rounded-[1.75rem] px-1 py-1.5">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeIndex === i;

          return (
            <button
              key={`${item.labelKey}-${i}`}
              type="button"
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-5 py-2 transition-all duration-200 ${
                isActive ? "" : "active:scale-95"
              }`}
            >
              {isActive ? (
                <span className="absolute inset-0 rounded-2xl bg-[rgba(255,255,255,0.1)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),inset_0_-1px_0_0_rgba(255,255,255,0.05)]" />
              ) : null}
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
                className={`relative z-10 transition-colors duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`relative z-10 text-[10px] font-medium transition-colors duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {navLabel(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
