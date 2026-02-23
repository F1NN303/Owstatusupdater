import AppLayout from "@/components/AppLayout";
import { pickLang, useAppShell } from "@/lib/appShell";
import { resolveLegacyPath } from "@/lib/legacySite";
import {
  Bell,
  ExternalLink,
  Gamepad2,
  Settings,
  Star,
  Tv,
} from "lucide-react";
import { Link } from "react-router-dom";

interface FavoriteItem {
  title: string;
  subtitle: string;
  icon: typeof Gamepad2;
  to?: string;
  href?: string;
}

const favoriteItems: FavoriteItem[] = [
  {
    title: "Overwatch",
    subtitle: "React detail view with tabs and charts",
    icon: Gamepad2,
    to: "/status/overwatch",
  },
  {
    title: "Sony PSN",
    subtitle: "React detail view with incidents and analysis",
    icon: Tv,
    to: "/status/sony",
  },
  {
    title: "Alerts",
    subtitle: "Brevo signup and subscription config checks",
    icon: Bell,
    to: "/alerts",
  },
  {
    title: "Legacy Overwatch Dashboard",
    subtitle: "Open the original dashboard page",
    icon: ExternalLink,
    href: resolveLegacyPath("/legacy-overwatch.html"),
  },
];

const Favorites = () => {
  const { language } = useAppShell();
  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              {pickLang(language, "Favorites", "Favoriten")}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {pickLang(
                language,
                "Quick access to the most used status pages and tools",
                "Schnellzugriff auf die meistgenutzten Status-Seiten und Tools"
              )}
            </p>
          </div>
          <div className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Star size={18} className="text-primary" />
          </div>
        </div>

        <section className="glass glass-specular rounded-2xl p-4">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {pickLang(language, "Pinned Shortcuts", "Fixierte Kurzlinks")}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                {favoriteItems.length} {pickLang(language, "items", "Eintraege")}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {favoriteItems.map((item) => {
                const Icon = item.icon;

                if (item.to) {
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 transition-colors hover:bg-white/10 active:scale-[0.99]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Icon size={17} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {pickLang(language, "Open", "Oeffnen")}
                      </span>
                    </Link>
                  );
                }

                return (
                  <a
                    key={item.title}
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 transition-colors hover:bg-white/10 active:scale-[0.99]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <Icon size={17} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/"
            className="glass glass-specular rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="relative z-10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                <Gamepad2 size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {pickLang(language, "Service Home", "Status-Start")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pickLang(language, "Open live overview cards", "Live-Uebersichtskarten oeffnen")}
              </p>
            </div>
          </Link>
          <Link
            to="/settings"
            className="glass glass-specular rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="relative z-10">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                <Settings size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {pickLang(language, "Settings", "Einstellungen")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pickLang(language, "Preview preferences and links", "Preview-Einstellungen und Links")}
              </p>
            </div>
          </Link>
        </section>
      </main>
    </AppLayout>
  );
};

export default Favorites;
