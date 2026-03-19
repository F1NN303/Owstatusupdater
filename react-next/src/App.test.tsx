import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShellProvider } from "@/lib/appShell";

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./pages/Index", () => ({
  default: () => <div>Home Page</div>,
}));

vi.mock("./pages/ServerDetail", () => ({
  default: () => <div>Service Detail Page</div>,
}));

vi.mock("./pages/EmailAlerts", () => ({
  default: () => <div>Alerts Page</div>,
}));

vi.mock("./pages/Favorites", () => ({
  default: () => <div>Favorites Page</div>,
}));

vi.mock("./pages/SettingsPage", () => ({
  default: () => <div>Settings Page</div>,
}));

vi.mock("./pages/TermsPage", () => ({
  default: () => <div>Terms Page</div>,
}));

vi.mock("./pages/NotFound", () => ({
  default: () => <div>Not Found Page</div>,
}));

import App from "./App";

describe("App routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the canonical alerts route", async () => {
    window.history.replaceState({}, "", "/alerts");
    render(
      <AppShellProvider>
        <App />
      </AppShellProvider>
    );
    expect(await screen.findByText("Alerts Page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/alerts");
  });

  it("redirects the legacy email alerts route to alerts", async () => {
    window.history.replaceState({}, "", "/email-alerts");
    render(
      <AppShellProvider>
        <App />
      </AppShellProvider>
    );
    expect(await screen.findByText("Alerts Page")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/alerts");
    });
  });
});
