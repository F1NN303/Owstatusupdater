import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getFallbackServiceManifestEntries } from "./serviceManifest";

async function readPublishedManifestIds() {
  const manifestPath = resolve(process.cwd(), "..", "site", "data", "services-manifest.json");
  const raw = await readFile(manifestPath, "utf-8");
  const parsed = JSON.parse(raw) as {
    services?: Array<{
      id?: unknown;
    }>;
  };

  return (parsed.services ?? [])
    .map((entry) => String(entry.id ?? "").trim().toLowerCase())
    .filter(Boolean);
}

describe("serviceManifest fallback", () => {
  it("stays aligned with the published manifest service order", async () => {
    const fallbackIds = getFallbackServiceManifestEntries().map((entry) => entry.id);
    await expect(readPublishedManifestIds()).resolves.toEqual(fallbackIds);
  });

  it("derives stable local routes and unique aliases", () => {
    const entries = getFallbackServiceManifestEntries();

    for (const entry of entries) {
      expect(entry.detailPath).toBe(`/status/${entry.id}`);
      expect(entry.statusPath).toBe(`/${entry.id}/data/status.json`);
      expect(entry.aliases[0]).toBe(entry.id);
      expect(new Set(entry.aliases).size).toBe(entry.aliases.length);
      expect(entry.tags).toContain(entry.id);
    }
  });
});
