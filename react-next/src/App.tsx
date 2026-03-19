import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RouteLoadingShell from "./components/RouteLoadingShell";

const ServerDetail = lazy(() => import("./pages/ServerDetail"));
const EmailAlerts = lazy(() => import("./pages/EmailAlerts"));
const Favorites = lazy(() => import("./pages/Favorites"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
const routerModeEnv = (import.meta.env.VITE_ROUTER_MODE as string | undefined)?.trim().toLowerCase();
const useHashRouter = routerModeEnv === "hash";
const Router = useHashRouter ? HashRouter : BrowserRouter;
const baseUrl = (import.meta.env.BASE_URL as string | undefined) || "/";
const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
const envBasename = (import.meta.env.VITE_ROUTER_BASENAME as string | undefined)?.trim();
const routerBasename =
  envBasename && envBasename.length > 0
    ? envBasename
    : !useHashRouter && normalizedBaseUrl && normalizedBaseUrl !== "/"
      ? normalizedBaseUrl
      : undefined;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router basename={routerBasename}>
        <Suspense fallback={<RouteLoadingShell />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/status/:id" element={<ServerDetail />} />
            <Route path="/alerts" element={<EmailAlerts />} />
            <Route path="/email-alerts" element={<Navigate to="/alerts" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
