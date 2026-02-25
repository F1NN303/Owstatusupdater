import bgGradient from "@/assets/bg-gradient.jpg";
import BottomNav from "@/components/BottomNav";
import { pickLang, useAppShell } from "@/lib/appShell";
import { Link } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { reduceMotion, language } = useAppShell();

  return (
    <div className="relative min-h-screen bg-background" data-app-motion={reduceMotion ? "reduced" : "full"}>
      {reduceMotion ? (
        <style>
          {`
            [data-app-motion="reduced"] * {
              transition-duration: 0ms !important;
              animation-duration: 0ms !important;
              animation-iteration-count: 1 !important;
              scroll-behavior: auto !important;
            }
          `}
        </style>
      ) : null}
      <div
        className="fixed inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${bgGradient})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
      <div className="relative z-10 pb-[calc(6.1rem+env(safe-area-inset-bottom,8px))]">
        {children}
        <footer className="mx-auto max-w-md px-4 pt-1 text-center">
          <Link
            to="/terms"
            className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            {pickLang(language, "Terms & Ownership", "Nutzung & Eigentum")}
          </Link>
        </footer>
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
