import { RefreshCw, Share2, Sparkles, Star, X } from "lucide-react";
import { pickLang, type AppLanguage } from "@/lib/appShell";

interface OnboardingHintsProps {
  language: AppLanguage;
  open: boolean;
  onDismiss: () => void;
  onOpenFavorites: () => void;
}

function hintCopy(language: AppLanguage) {
  return [
    {
      icon: Star,
      title: pickLang(language, "Star services you care about", "Markiere wichtige Services"),
      body: pickLang(
        language,
        "Favorites stay pinned near the top so the services you track are always easy to reach.",
        "Favoriten bleiben weit oben, damit du deine Services sofort erreichst."
      ),
    },
    {
      icon: RefreshCw,
      title: pickLang(language, "Pull down to refresh", "Zum Aktualisieren nach unten ziehen"),
      body: pickLang(
        language,
        "Home and detail pages support pull-to-refresh when you want a manual live check.",
        "Start- und Detailseiten unterstützen Pull-to-Refresh für eine manuelle Live-Prüfung."
      ),
    },
    {
      icon: Share2,
      title: pickLang(language, "Share a live detail page", "Live-Detailseite teilen"),
      body: pickLang(
        language,
        "Use the share button on service detail pages to send the exact status view to someone else.",
        "Nutze den Teilen-Button in Service-Details, um genau diese Statusansicht weiterzugeben."
      ),
    },
  ];
}

const OnboardingHints = ({
  language,
  open,
  onDismiss,
  onOpenFavorites,
}: OnboardingHintsProps) => {
  if (!open) {
    return null;
  }

  const hints = hintCopy(language);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(4,8,18,0.72)] px-4 pb-[calc(6.8rem+env(safe-area-inset-bottom,8px))] pt-8 backdrop-blur-md sm:items-center sm:pb-8">
      <div className="glass glass-specular relative w-full max-w-md rounded-[1.8rem] p-4 sm:p-5">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label={pickLang(language, "Dismiss onboarding", "Hinweise schließen")}
        >
          <X size={15} />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/85">
                {pickLang(language, "Quick start", "Kurzstart")}
              </p>
              <h2 className="text-lg font-bold text-foreground">
                {pickLang(language, "A few useful tips", "Ein paar nützliche Hinweise")}
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {hints.map((hint) => {
              const Icon = hint.icon;
              return (
                <div
                  key={hint.title}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{hint.title}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        {hint.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onOpenFavorites}
              className="flex-1 rounded-2xl border border-primary/25 bg-primary/12 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/18"
            >
              {pickLang(language, "Open favorites", "Favoriten öffnen")}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
            >
              {pickLang(language, "Got it", "Verstanden")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingHints;
