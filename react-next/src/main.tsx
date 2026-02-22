import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppShellProvider } from "./lib/appShell.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppShellProvider>
    <App />
  </AppShellProvider>
);
