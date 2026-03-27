import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShellProvider } from "@/lib/appShell";

const useIsMobileMock = vi.fn(() => false);

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => useIsMobileMock(),
}));

vi.mock("@/lib/alertAccount", () => ({
  useAlertAccount: () => ({
    status: "connected",
    isConnected: true,
    profile: {
      brevoSyncStatus: "synced",
    },
    sessionEmail: "alerts@example.com",
  }),
}));

import SettingsPage from "./SettingsPage";

const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

describe("Settings page", () => {
  beforeEach(() => {
    useIsMobileMock.mockReturnValue(false);
    window.localStorage.clear();
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        language: "en",
        reduceMotion: false,
        favorites: ["github"],
        home: {
          defaultFilter: "all",
          defaultSort: "impact",
          refreshIntervalSec: 60,
          compactCards: false,
          favoritesFirst: true,
        },
        time: {
          displayMode: "both",
        },
        alerts: {
          watchedServiceIds: ["github", "openai"],
          severityThreshold: "major",
        },
        onboarding: {
          homeHintsDismissed: true,
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("persists updated display and feed defaults locally", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppShellProvider>
          <SettingsPage />
        </AppShellProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Current defaults")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Reduce interface motion" }));
    fireEvent.click(screen.getByRole("button", { name: "Issues" }));
    fireEvent.click(screen.getByRole("button", { name: "30s" }));
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
      expect(persisted.language).toBe("de");
      expect(persisted.reduceMotion).toBe(true);
      expect(persisted.home.defaultFilter).toBe("issues");
      expect(persisted.home.refreshIntervalSec).toBe(30);
    });
  });

  it("shows the latest public changelog entry and uses a full-screen mobile sheet", async () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppShellProvider>
          <SettingsPage />
        </AppShellProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /what's new|was ist neu/i }));

    expect((await screen.findAllByText("Inbox delivery polish")).length).toBeGreaterThan(0);
    expect(screen.getByText("The update notes now open as a true full-screen sheet on mobile.")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Recent changes" });
    expect(dialog.className).toContain("top-0");
    expect(dialog.className).toContain("h-[100dvh]");
    expect(dialog.className).toContain("rounded-none");
  });
});
