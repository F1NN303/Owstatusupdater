import {
  CHUNK_RECOVERY_STORAGE_KEY,
  isRecoverableChunkLoadError,
  recoverFailedRouteChunk,
  recoverAppRoute,
  ROUTE_REDIRECT_STORAGE_KEY,
} from "@/lib/routerRecovery";

describe("recoverAppRoute", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/Owstatusupdater/");
  });

  it("restores a redirected GitHub Pages deep link from session storage", () => {
    window.sessionStorage.setItem(
      ROUTE_REDIRECT_STORAGE_KEY,
      "/Owstatusupdater/status/openai?tab=analysis"
    );

    const changed = recoverAppRoute(window, "/Owstatusupdater/");

    expect(changed).toBe(true);
    expect(window.location.pathname).toBe("/Owstatusupdater/status/openai");
    expect(window.location.search).toBe("?tab=analysis");
    expect(window.sessionStorage.getItem(ROUTE_REDIRECT_STORAGE_KEY)).toBeNull();
  });

  it("converts legacy hash routes into clean browser routes", () => {
    window.history.replaceState(
      null,
      "",
      "/Owstatusupdater/#/status/claude"
    );

    const changed = recoverAppRoute(window, "/Owstatusupdater/");

    expect(changed).toBe(true);
    expect(window.location.pathname).toBe("/Owstatusupdater/status/claude");
    expect(window.location.hash).toBe("");
  });

  it("detects recoverable lazy-route chunk errors", () => {
    expect(
      isRecoverableChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://f1nn303.github.io/Owstatusupdater/assets/SettingsPageRoute-old.js"
        )
      )
    ).toBe(true);
    expect(isRecoverableChunkLoadError("ChunkLoadError: Loading chunk 12 failed.")).toBe(true);
    expect(isRecoverableChunkLoadError(new Error("Network request failed"))).toBe(false);
  });

  it("clears owstatus caches and reloads once for a stale chunk failure", async () => {
    const storage = new Map<string, string>();
    const unregister = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();
    const deleteCache = vi.fn().mockResolvedValue(true);

    const fakeWindow = {
      location: {
        pathname: "/Owstatusupdater/settings",
        search: "",
        hash: "",
        reload,
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      navigator: {
        serviceWorker: {
          getRegistrations: vi.fn().mockResolvedValue([
            {
              scope: "https://f1nn303.github.io/Owstatusupdater/",
              unregister,
            },
          ]),
        },
      },
      caches: {
        keys: vi.fn().mockResolvedValue([
          "owstatus-app-shell-root-old",
          "other-cache",
        ]),
        delete: deleteCache,
      },
    } as unknown as Window;

    await expect(recoverFailedRouteChunk(fakeWindow, "/Owstatusupdater/")).resolves.toBe(true);

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith("owstatus-app-shell-root-old");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.get(CHUNK_RECOVERY_STORAGE_KEY)).toContain("/Owstatusupdater/settings");

    await expect(recoverFailedRouteChunk(fakeWindow, "/Owstatusupdater/")).resolves.toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
