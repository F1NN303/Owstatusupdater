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

vi.mock("@/lib/legacyStatus", () => ({
  getLegacyLiveStatusServices: (...args: unknown[]) => getLegacyLiveStatusServices(...args),
  fetchLegacyServiceSummary: (...args: unknown[]) => fetchLegacyServiceSummary(...args),
}));

import Favorites from "./Favorites";

const SETTINGS_STORAGE_KEY = "owstatusupdater.react.settings.v2";

function makeSummary(id: string, name: string, tone: "good" | "warn" | "bad" = "good") {
  return {
    service: {
      id,
      name,
      note: `${name} live service status`,
      iconName: "Globe",
    },
    tone,
    generatedAt: "2026-03-19T19:00:00.000Z",
    error: false,
  };
}

describe("Favorites page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 4,
        language: "en",
        reduceMotion: false,
        favorites: ["github", "openai"],
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
      { id: "github", name: "GitHub", statusPath: "/github/data/status.json" },
      { id: "openai", name: "OpenAI / ChatGPT", statusPath: "/openai/data/status.json" },
    ]);
    fetchLegacyServiceSummary.mockImplementation(async (service: { id: string }) => {
      if (service.id === "github") {
        return makeSummary("github", "GitHub");
      }
      return makeSummary("openai", "OpenAI / ChatGPT", "warn");
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("removes a favorite and persists the change", async () => {
    render(
      <MemoryRouter initialEntries={["/favorites"]}>
        <AppShellProvider>
          <Favorites />
        </AppShellProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("OpenAI / ChatGPT")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /remove from favorites/i })[0]);

    await waitFor(() => {
      expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
    });

    const persisted = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    expect(persisted.favorites).toEqual(["openai"]);
  });
});
