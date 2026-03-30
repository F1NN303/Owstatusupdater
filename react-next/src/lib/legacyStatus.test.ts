import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchServiceManifestEntries = vi.fn();
const fetchCachedJson = vi.fn();

vi.mock("@/lib/serviceManifest", () => ({
  fetchServiceManifestEntries: (...args: unknown[]) => fetchServiceManifestEntries(...args),
}));

vi.mock("@/lib/cachedJson", () => ({
  fetchCachedJson: (...args: unknown[]) => fetchCachedJson(...args),
}));

import {
  fetchLegacyServiceSummary,
  getLegacyHomeServices,
  getLegacyLiveStatusServices,
} from "./legacyStatus";

describe("legacyStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps manifest entries into live services and filters missing status paths", async () => {
    fetchServiceManifestEntries.mockResolvedValue([
      {
        id: "github",
        label: "GitHub",
        name: "GitHub",
        detailPath: "/status/github",
        statusPath: "/github/data/status.json",
        legacyHref: "/github/",
        note: "GitHub live status",
        iconName: "Globe",
        category: "developer",
        priority: 240,
        tags: ["github"],
        aliases: ["github"],
      },
      {
        id: "broken",
        label: "Broken",
        name: "Broken",
        detailPath: "/status/broken",
        statusPath: "",
        legacyHref: "/broken/",
        note: "Broken entry",
        iconName: "Globe",
        category: "general",
        priority: 999,
        tags: ["broken"],
        aliases: ["broken"],
      },
    ]);

    await expect(getLegacyLiveStatusServices()).resolves.toEqual([
      {
        id: "github",
        name: "GitHub",
        href: "/status/github",
        legacyHref: "/github/",
        note: "GitHub live status",
        statusPath: "/github/data/status.json",
        iconName: "Globe",
        category: "developer",
        priority: 240,
        tags: ["github"],
        aliases: ["github"],
      },
    ]);
  });

  it("appends the alerts setup card after manifest-backed services", async () => {
    fetchServiceManifestEntries.mockResolvedValue([
      {
        id: "openai",
        label: "OpenAI (ChatGPT)",
        name: "OpenAI / ChatGPT",
        detailPath: "/status/openai",
        statusPath: "/openai/data/status.json",
        legacyHref: "/openai/",
        note: "OpenAI live status",
        iconName: "Cpu",
        category: "ai",
        priority: 210,
        tags: ["openai"],
        aliases: ["openai", "chatgpt"],
      },
    ]);

    const services = await getLegacyHomeServices();

    expect(services).toHaveLength(2);
    expect(services[0]).toMatchObject({
      id: "openai",
      href: "/status/openai",
    });
    expect(services[1]).toMatchObject({
      id: "email",
      href: "/email-alerts.html",
      note: "Alert account and e-mail delivery setup with secure provider opt-in.",
    });
  });

  it("returns setup state for entries without a status payload", async () => {
    await expect(
      fetchLegacyServiceSummary({
        id: "email",
        name: "Alerts",
        href: "/email-alerts.html",
        note: "Alert setup",
      }),
    ).resolves.toMatchObject({
      severity: "unknown",
      tone: "unknown",
      statusLabel: "Setup",
      error: false,
    });
    expect(fetchCachedJson).not.toHaveBeenCalled();
  });
});
