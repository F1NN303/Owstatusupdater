import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const fetchLegacyServiceSummary = vi.fn();
const fetchLegacySubscriptionConfig = vi.fn();
const useAlertAccountMock = vi.fn();
const invokeFunctionMock = vi.fn();
const getSupabaseClientMock = vi.fn();

vi.mock("@/lib/legacyStatus", () => ({
  getLegacyLiveStatusServices: (...args: unknown[]) => getLegacyLiveStatusServices(...args),
  fetchLegacyServiceSummary: (...args: unknown[]) => fetchLegacyServiceSummary(...args),
}));

vi.mock("@/lib/legacySubscription", () => ({
  fetchLegacySubscriptionConfig: (...args: unknown[]) => fetchLegacySubscriptionConfig(...args),
  providerLabel: (provider: unknown) => (String(provider || "").trim().toLowerCase() === "brevo" ? "Brevo" : "Unknown"),
}));

vi.mock("@/lib/alertAccount", () => ({
  useAlertAccount: () => useAlertAccountMock(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => getSupabaseClientMock(),
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
          watchedServiceIds: ["cloudflare"],
          severityThreshold: "major",
        },
        onboarding: {
          homeHintsDismissed: true,
        },
      }),
    );

    getLegacyLiveStatusServices.mockResolvedValue([
      {
        id: "cloudflare",
        name: "Cloudflare",
        href: "/status/cloudflare",
        legacyHref: "/cloudflare/",
        note: "Cloudflare live status",
        statusPath: "/cloudflare/data/status.json",
      },
    ]);
    fetchLegacyServiceSummary.mockResolvedValue({
      service: {
        id: "cloudflare",
        name: "Cloudflare",
        href: "/status/cloudflare",
        legacyHref: "/cloudflare/",
        note: "Cloudflare live status",
        statusPath: "/cloudflare/data/status.json",
      },
      severity: "stable",
      tone: "good",
      statusLabel: "Stable",
      updatedText: "Updated: now",
      generatedAt: "2026-03-27T20:00:00.000Z",
      error: false,
      source: "network",
      cachedAt: null,
    });
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
    invokeFunctionMock.mockResolvedValue({
      data: {
        synced: true,
        contactFound: true,
        contactId: "123",
      },
      error: null,
    });
    getSupabaseClientMock.mockReturnValue({
      functions: {
        invoke: (...args: unknown[]) => invokeFunctionMock(...args),
      },
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

  it("invokes the Brevo sync function from the delivery status button", async () => {
    render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Check delivery status" }));

    await waitFor(() => {
      expect(invokeFunctionMock).toHaveBeenCalledWith("sync-brevo-contact", { body: {} });
    });
    expect(
      await screen.findByText("Delivery status synced. Account was checked against Brevo.")
    ).toBeInTheDocument();
  });

  it("switches into settings mode once delivery is synced", async () => {
    useAlertAccountMock.mockReturnValue({
      configured: true,
      status: "connected",
      isLoading: false,
      isSaving: false,
      isConnected: true,
      isDirty: false,
      profile: {
        brevoSyncStatus: "synced",
        providerContactId: "123",
        lastSyncedAt: "2026-03-24T00:29:33.645Z",
        lastDeliveryAt: null,
      },
      savedPreferences: null,
      sessionEmail: "alerts@example.com",
      requestMagicLink: vi.fn(),
      signOut: vi.fn(),
      reload: vi.fn(),
      savePreferences: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alert settings")).toBeInTheDocument();
    expect(screen.getByText("Alerts are active")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Watchlist & threshold" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inbox delivery" })).toBeInTheDocument();
    expect(screen.getByText("Delivery readiness")).toBeInTheDocument();
    expect(
      screen.getAllByText("No watched service currently meets the major only alert threshold.").length
    ).toBeGreaterThan(0);
  });

  it("shows a spam and junk help dialog once inbox delivery is active", async () => {
    useAlertAccountMock.mockReturnValue({
      configured: true,
      status: "connected",
      isLoading: false,
      isSaving: false,
      isConnected: true,
      isDirty: false,
      profile: {
        brevoSyncStatus: "synced",
        providerContactId: "123",
        lastSyncedAt: "2026-03-24T00:29:33.645Z",
        lastDeliveryAt: null,
      },
      savedPreferences: null,
      sessionEmail: "alerts@example.com",
      requestMagicLink: vi.fn(),
      signOut: vi.fn(),
      reload: vi.fn(),
      savePreferences: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Missing the first alert? Check Spam or Junk once.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show inbox tips" }));

    expect(
      screen.getByRole("dialog", { name: "Find the first alert fast" })
    ).toBeInTheDocument();
    expect(screen.getByText("1. Search the usual folders")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Find the first alert fast" })
      ).not.toBeInTheDocument();
    });
  });

  it("shows a softer browser network warning when the delivery re-check cannot reach the edge function", async () => {
    invokeFunctionMock.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to fetch",
      },
    });
    useAlertAccountMock.mockReturnValue({
      configured: true,
      status: "connected",
      isLoading: false,
      isSaving: false,
      isConnected: true,
      isDirty: false,
      profile: {
        brevoSyncStatus: "synced",
        providerContactId: "123",
        lastSyncedAt: "2026-03-24T00:29:33.645Z",
        lastDeliveryAt: null,
      },
      savedPreferences: null,
      sessionEmail: "alerts@example.com",
      requestMagicLink: vi.fn(),
      signOut: vi.fn(),
      reload: vi.fn(),
      savePreferences: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/alerts"]}>
        <AppShellProvider>
          <EmailAlerts />
        </AppShellProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Re-check delivery" }));

    expect(
      await screen.findByText(
        "This browser could not reach the delivery check service just now. Your current synced delivery state stays unchanged."
      )
    ).toBeInTheDocument();
  });
});
