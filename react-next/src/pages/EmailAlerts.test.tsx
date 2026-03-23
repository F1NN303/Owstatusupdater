import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShellProvider } from "@/lib/appShell";

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ServiceIdentityIcon", () => ({
  default: () => null,
}));

const getLegacyLiveStatusServices = vi.fn();
const fetchLegacySubscriptionConfig = vi.fn();
const useAlertAccountMock = vi.fn();

vi.mock("@/lib/legacyStatus", () => ({
  getLegacyLiveStatusServices: (...args: unknown[]) => getLegacyLiveStatusServices(...args),
}));

vi.mock("@/lib/legacySubscription", () => ({
  fetchLegacySubscriptionConfig: (...args: unknown[]) => fetchLegacySubscriptionConfig(...args),
  providerLabel: (provider: unknown) => (String(provider || "").trim().toLowerCase() === "brevo" ? "Brevo" : "Unknown"),
}));

vi.mock("@/lib/alertAccount", () => ({
  useAlertAccount: () => useAlertAccountMock(),
}));

import EmailAlerts from "./EmailAlerts";

const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";
const DELIVERY_PROGRESS_STORAGE_KEY = "owstatusupdater.alerts.delivery-follow-up.v1";

describe("Email alerts delivery follow-up", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        language: "en",
        reduceMotion: false,
        favorites: [],
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
          watchedServiceIds: [],
          severityThreshold: "major",
        },
        onboarding: {
          homeHintsDismissed: true,
        },
      }),
    );

    getLegacyLiveStatusServices.mockResolvedValue([]);
    fetchLegacySubscriptionConfig.mockResolvedValue({
      status: "ready",
      config: {
        provider: "brevo",
      },
      parsedUrl: new URL("https://56556b51.sibforms.com/example"),
      source: "network",
      cachedAt: null,
    });
    useAlertAccountMock.mockReturnValue({
      configured: true,
      status: "connected",
      isLoading: false,
      isSaving: false,
      isConnected: true,
      isDirty: false,
      profile: {
        brevoSyncStatus: "not_synced",
        providerContactId: null,
        lastSyncedAt: null,
        lastDeliveryAt: null,
      },
      savedPreferences: null,
      sessionEmail: "alerts@example.com",
      requestMagicLink: vi.fn(),
      signOut: vi.fn(),
      reload: vi.fn(),
      savePreferences: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("restores the provider follow-up state from local storage on remount", async () => {
    const view = render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Open delivery")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Show embedded form here" }));
    window.localStorage.setItem(DELIVERY_PROGRESS_STORAGE_KEY, new Date().toISOString());

    view.unmount();

    render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Confirming")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Check delivery status" })).toBeInTheDocument();
  });
});
