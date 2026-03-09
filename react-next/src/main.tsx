import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AlertAccountProvider } from "./lib/alertAccount.tsx";
import { AppShellProvider } from "./lib/appShell.tsx";
import { recoverAppRoute } from "./lib/routerRecovery.ts";
import "./index.css";

if (typeof window !== "undefined") {
  recoverAppRoute(window, import.meta.env.BASE_URL as string | undefined);
}

createRoot(document.getElementById("root")!).render(
  <AppShellProvider>
    <AlertAccountProvider>
      <App />
    </AlertAccountProvider>
  </AppShellProvider>
);

if (import.meta.env.PROD && typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL as string}sw.js`,
      { scope: import.meta.env.BASE_URL as string }
    );
  });
}
