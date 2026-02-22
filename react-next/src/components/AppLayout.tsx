import bgGradient from "@/assets/bg-gradient.jpg";
import BottomNav from "@/components/BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${bgGradient})` }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
      <div className="relative z-10">{children}</div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
