import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShellProvider } from "@/lib/appShell";

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/OnboardingHints", () => ({
  default: () => null,
}));

vi.mock("@/components/OverallStatus", () => ({
  default: () => null,
}));

vi.mock("@/components/PullToRefreshIndicator", () => ({
  default: () => null,
}));

vi.mock("@/components/ServerCard", () => ({
  default: ({ server }: { server: { name: string } }) => <div>{server.name}</div>,
}));

vi.mock("@/components/ServiceIdentityIcon", () => ({
  default: () => null,
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({
    distance: 0,
    isPullReady: false,
    isPullRefreshing: false,
    bind: {},
  }),
}));

const getLegacyLiveStatusServices = vi.fn();
const fetchLegacyServiceDetail = vi.fn();

vi.mock("@/lib/legacyStatus", () => ({
  getLegacyLiveStatusServices: (...args: unknown[]) => getLegacyLiveStatusServices(...args),
}));

vi.mock("@/lib/legacyServiceDetail", () => ({
  fetchLegacyServiceDetail: (...args: unknown[]) => fetchLegacyServiceDetail(...args),
}));

import Index from "./Index";

const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

function makeDetail(id: string, name: string, tone: "good" | "warn" | "bad") {
  return {
    service: {
      id,
      name,
      href: `/status/${id}`,
      note: `${name} live service status`,
      statusPath: `/${id}/data/status.json`,
      iconName: "Globe",
      category: id === "github" ? "developer" : "ai",
      priority: 1,
      tags: [id],
      aliases: [],
    },
    payload: {
      generated_at: "2026-03-19T19:00:00.000Z",
      reports: [],
      news: [],
      sources: [],
      analytics: {
        source_ok_count: 1,
        source_total_count: 1,
        signal_metrics: {
          cross_source: {
            combined_score: 0,
          },
        },
      },
      outage: {
        incidents: [],
        scheduled_maintenances: [],
      },
    },
    history: null,
    severity: tone === "good" ? "stable" : tone === "warn" ? "degraded" : "major",
    tone,
    sourceConfidenceText: "1/1",
    cache: {
      statusSource: "network",
      statusCachedAt: null,
      historySource: null,
      historyCachedAt: null,
    },
  };
}

describe("Index favorites filter", () => {
  beforeEach(() => {
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
          watchedServiceIds: [],
          severityThreshold: "major",
        },
        onboarding: {
          homeHintsDismissed: true,
        },
      })
    );

    getLegacyLiveStatusServices.mockResolvedValue([
      { id: "github" },
      { id: "openai" },
    ]);
    fetchLegacyServiceDetail.mockImplementation(async (serviceId: string) => {
      if (serviceId === "github") {
        return makeDetail("github", "GitHub", "good");
      }
      return makeDetail("openai", "OpenAI / ChatGPT", "warn");
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows a quick favorites chip and filters the home cards", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShellProvider>
          <Index />
        </AppShellProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("OpenAI / ChatGPT")).toBeInTheDocument();

    const favoritesOnlyButton = screen.getByRole("button", { name: /favorites only/i });
    fireEvent.click(favoritesOnlyButton);

    expect(screen.getByText("Showing 1/2 services")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("OpenAI / ChatGPT")).not.toBeInTheDocument();

    fireEvent.click(favoritesOnlyButton);

    expect(screen.getByText("Showing 2/2 services")).toBeInTheDocument();
    expect(screen.getByText("OpenAI / ChatGPT")).toBeInTheDocument();
  });
});
