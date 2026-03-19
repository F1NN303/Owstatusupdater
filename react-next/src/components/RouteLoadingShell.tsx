import AppLayout from "@/components/AppLayout";
import { pickLang, useAppShell } from "@/lib/appShell";

const RouteLoadingShell = () => {
  const { language } = useAppShell();

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-6 pt-8">
        <div className="space-y-3 pb-5 pt-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                {pickLang(language, "Opening view", "Ansicht wird geoeffnet")}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {pickLang(language, "Loading the next page...", "Die naechste Seite wird geladen...")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pickLang(
                  language,
                  "The current route is being prepared without blocking the home feed boot path.",
                  "Die aktuelle Route wird vorbereitet, ohne den Start der Home-Ansicht zu blockieren."
                )}
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="h-4 w-28 rounded-full bg-white/10" />
            <div className="mt-3 h-10 rounded-2xl bg-white/5" />
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="h-4 w-20 rounded-full bg-white/10" />
            <div className="mt-3 h-24 rounded-2xl bg-white/5" />
          </div>
        </div>
      </main>
    </AppLayout>
  );
};

export default RouteLoadingShell;
