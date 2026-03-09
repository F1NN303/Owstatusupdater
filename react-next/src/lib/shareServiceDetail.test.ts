import {
  buildServiceDetailShareUrl,
  shareServiceDetail,
} from "@/lib/shareServiceDetail";

describe("shareServiceDetail", () => {
  it("normalizes legacy hash links into clean status routes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    const result = await shareServiceDetail({
      currentUrl: "https://f1nn303.github.io/Owstatusupdater/#/status/openai",
      serviceId: "openai",
      serviceName: "OpenAI / ChatGPT",
      statusLabel: "Degraded",
      summary: "API latency elevated",
      share,
    });

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://f1nn303.github.io/Owstatusupdater/status/openai",
      })
    );
  });

  it("falls back to clipboard when native share is unavailable", async () => {
    const clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    const result = await shareServiceDetail({
      currentUrl: "https://f1nn303.github.io/Owstatusupdater/status/claude",
      serviceId: "claude",
      serviceName: "Claude / Anthropic",
      statusLabel: "Degraded",
      summary: "Desktop app unresponsive",
      clipboard,
    });

    expect(result).toBe("copied");
    expect(clipboard.writeText).toHaveBeenCalledWith(
      "https://f1nn303.github.io/Owstatusupdater/status/claude"
    );
  });

  it("treats user-cancelled shares as cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));

    const result = await shareServiceDetail({
      currentUrl: "https://f1nn303.github.io/Owstatusupdater/status/reddit",
      serviceId: "reddit",
      serviceName: "Reddit",
      statusLabel: "Operational",
      share,
    });

    expect(result).toBe("cancelled");
  });

  it("preserves preview-base clean URLs", () => {
    const shareUrl = buildServiceDetailShareUrl(
      "https://f1nn303.github.io/Owstatusupdater/next/status/slack",
      "slack"
    );

    expect(shareUrl.toString()).toBe(
      "https://f1nn303.github.io/Owstatusupdater/next/status/slack"
    );
  });
});
