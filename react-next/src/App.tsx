import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ServerDetail from "./pages/ServerDetail";
import EmailAlerts from "./pages/EmailAlerts";
import Favorites from "./pages/Favorites";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const useHashRouter = import.meta.env.VITE_ROUTER_MODE === "hash";
const Router = useHashRouter ? HashRouter : BrowserRouter;
const routerBasename = (import.meta.env.VITE_ROUTER_BASENAME as string | undefined) || undefined;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router basename={routerBasename}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/status/:id" element={<ServerDetail />} />
          <Route path="/alerts" element={<EmailAlerts />} />
          <Route path="/email-alerts" element={<EmailAlerts />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
