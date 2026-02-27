import { Bell, Home, Settings, Star } from "lucide-react";
import { pickLang, useAppShell } from "@/lib/appShell";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  {
    icon: Home,
    labelKey: "home",
    path: "/",
    matches: ["/", "/status"],
  },
  { icon: Star, labelKey: "favorites", path: "/favorites", matches: ["/favorites"] },
  { icon: Bell, labelKey: "alerts", path: "/alerts", matches: ["/alerts", "/email-alerts"] },
  { icon: Settings, labelKey: "settings", path: "/settings", matches: ["/settings"] },
];

const BottomNav = () => {
  const { language } = useAppShell();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";

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
      <div className="glass-nav mx-auto flex max-w-md items-center justify-around rounded-[1.6rem] px-1 py-1">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeIndex === i;

          return (
            <button
              key={`${item.labelKey}-${i}`}
              type="button"
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1.5 transition-all duration-200 ${
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
