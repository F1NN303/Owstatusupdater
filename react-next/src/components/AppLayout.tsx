import bgGradient from "@/assets/bg-gradient.jpg";
import BottomNav from "@/components/BottomNav";
import { useAppShell } from "@/lib/appShell";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { reduceMotion } = useAppShell();

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
      <div className="relative z-10 pb-[calc(5.25rem+env(safe-area-inset-bottom,8px))]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
