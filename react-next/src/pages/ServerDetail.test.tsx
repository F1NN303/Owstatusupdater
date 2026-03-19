import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShellProvider } from "@/lib/appShell";

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/MiniSparkline", () => ({
  default: () => <div data-testid="mini-sparkline" />,
}));

vi.mock("@/components/PullToRefreshIndicator", () => ({
  default: () => null,
}));

vi.mock("@/components/ServiceIdentityIcon", () => ({
  default: () => null,
}));

vi.mock("@/components/StatusBadge", () => ({
  default: ({ status }: { status: string }) => <div>{status}</div>,
}));

vi.mock("@/components/UptimeBar", () => ({
  default: () => <div data-testid="uptime-bar" />,
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({
    distance: 0,
    isPullReady: false,
    isPullRefreshing: false,
    bind: {},
  }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/shareServiceDetail", () => ({
  shareServiceDetail: vi.fn().mockResolvedValue("copied"),
}));

const fetchLegacyServiceDetail = vi.fn();

vi.mock("@/lib/legacyServiceDetail", async () => {
  const actual = await vi.importActual<object>("@/lib/legacyServiceDetail");
  return {
    ...actual,
    fetchLegacyServiceDetail: (...args: unknown[]) => fetchLegacyServiceDetail(...args),
  };
});

import ServerDetail from "./ServerDetail";

const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

function makeDetail() {
  return {
    service: {
      id: "github",
      name: "GitHub",
      href: "/status/github",
      note: "GitHub live service status",
      statusPath: "/github/data/status.json",
      iconName: "Globe",
      category: "developer",
      priority: 1,
      tags: ["github"],
      aliases: [],
    },
    payload: {
      generated_at: "2026-03-19T19:00:00.000Z",
      health: "operational",
      components: [],
      services: [],
      analytics: {
        severity_key: "stable",
        severity_score: 98,
        source_ok_count: 1,
        source_total_count: 1,
        signal_metrics: {
          reports_24h: 0,
          recent_incidents_6h: 0,
          recent_incidents_24h: 0,
          cross_source: {
            combined_score: 98,
          },
        },
      },
      regions: {
        eu: { severity_key: "stable" },
        us: { severity_key: "stable" },
      },
      outage: {
        source: "Statuspage",
        url: "https://www.githubstatus.com/",
        summary: "All systems operational.",
        current_status: "operational",
        reports_24h: 0,
        components: [],
        services: [],
        incidents: [],
        scheduled_maintenances: [],
        top_reported_issues: [],
        service_health_24h: [],
        user_reports_24h: [],
      },
      official: {
        summary: "Officially operational.",
        updates: [],
      },
      reports: [],
      news: [],
      social: [],
      known_resources: [],
      sources: [],
      source_transparency: {
        overview: {
          confidence_tier: "high",
          source_ok: 1,
          source_total: 1,
          required_ok: 1,
          required_total: 1,
          required_met: true,
          scoring_ok: 1,
          scoring_total: 1,
          scoring_met: true,
        },
        decision: {
          health: "operational",
          severity_key: "stable",
          explanation: "Consensus across sources.",
        },
        sources: [],
      },
      changes: {
        summary: {
          new_incidents: 0,
          updated_incidents: 0,
          resolved_incidents: 0,
          new_reports: 0,
        },
      },
    },
    history: {
      updated_at: "2026-03-19T19:00:00.000Z",
      cadence_minutes: 60,
      retention_days: 7,
      points: [],
    },
    severity: "stable",
    tone: "good",
    sourceConfidenceText: "High confidence",
    cache: {
      statusSource: "network",
      statusCachedAt: null,
      historySource: null,
      historyCachedAt: null,
    },
  };
}

describe("Server detail favorites", () => {
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
      })
    );

    fetchLegacyServiceDetail.mockResolvedValue(makeDetail());

    class ResizeObserverMock {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("toggles the service as a favorite from the header", async () => {
    render(
      <MemoryRouter initialEntries={["/status/github"]}>
        <AppShellProvider>
          <Routes>
            <Route path="/status/:id" element={<ServerDetail />} />
          </Routes>
        </AppShellProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "GitHub" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add this service to favorites/i }));

    await waitFor(() => {
      expect(screen.getByText("Favorite pinned")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /remove this service from favorites/i })).toBeInTheDocument();

    const persisted = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    expect(persisted.favorites).toEqual(["github"]);
  });
});
