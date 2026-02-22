import { Bell, Gamepad2, Home, Tv } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { resolveLegacyPath } from "@/lib/legacySite";

const navItems = [
  { icon: Home, label: "Home", path: "/", kind: "route" as const },
  { icon: Gamepad2, label: "OW", path: "/overwatch.html", kind: "legacy" as const },
  { icon: Tv, label: "PSN", path: "/sony/index.html", kind: "legacy" as const },
  { icon: Bell, label: "E-Mail", path: "/email-alerts.html", kind: "legacy" as const },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";

  const activeIndex = navItems.findIndex((item) => {
    if (item.path === "/overwatch.html" && normalizedPath.startsWith("/status/overwatch")) {
      return true;
    }
    if (item.path === "/sony/index.html" && normalizedPath.startsWith("/status/sony")) {
      return true;
    }
    const targetPath =
      item.kind === "route" ? item.path : resolveLegacyPath(item.path);
    const normalizedTarget = targetPath.replace(/\/+$/, "") || "/";
    return normalizedPath === normalizedTarget;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-0">
      <div className="glass-nav mx-auto flex max-w-md items-center justify-around rounded-[1.75rem] px-1 py-1.5">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeIndex === i;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.kind === "route") {
                  navigate(item.path);
                  return;
                }
                window.location.href = resolveLegacyPath(item.path);
              }}
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
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
