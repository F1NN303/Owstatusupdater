import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RouteLoadingShell from "./components/RouteLoadingShell";

const loadServerDetail = () => import("./pages/ServerDetail");
const loadEmailAlerts = () => import("./pages/EmailAlertsRoute");
const loadFavorites = () => import("./pages/Favorites");
const loadSettingsPage = () => import("./pages/SettingsPageRoute");
const loadTermsPage = () => import("./pages/TermsPage");
const loadNotFound = () => import("./pages/NotFound");

const ServerDetail = lazy(loadServerDetail);
const EmailAlerts = lazy(loadEmailAlerts);
const Favorites = lazy(loadFavorites);
const SettingsPage = lazy(loadSettingsPage);
const TermsPage = lazy(loadTermsPage);
const NotFound = lazy(loadNotFound);
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

const routePreloaders = [
  loadFavorites,
  loadEmailAlerts,
  loadSettingsPage,
  loadTermsPage,
  loadServerDetail,
  loadNotFound,
];

const RoutePreloader = () => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preload = () => {
      routePreloaders.forEach((loadRoute) => {
        void loadRoute();
      });
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(preload, { timeout: 1800 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(preload, 900);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return null;
};

const App = () => (
  <TooltipProvider>
    <Toaster />
    <RoutePreloader />
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
);

export default App;
