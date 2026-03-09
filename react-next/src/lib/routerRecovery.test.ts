import {
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
});
