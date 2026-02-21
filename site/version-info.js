(function () {
  function formatVersionDate(date) {
    const locale = document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith("de")
      ? "de-DE"
      : "en-US";
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function hydrateVersionInfo() {
    const nodes = Array.from(document.querySelectorAll("[data-version-info]"));
    if (!nodes.length) {
      return;
    }
    const versionUrl =
      (document.body && document.body.dataset && document.body.dataset.versionUrl) || "./data/status.json";
    let label = "";
    try {
      const response = await fetch(versionUrl, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const raw = payload && (payload.generated_at || payload.generatedAt || payload.updated_at);
        const parsed = raw ? new Date(raw) : null;
        if (parsed && !Number.isNaN(parsed.getTime())) {
          label = `Version: ${formatVersionDate(parsed)}`;
        }
      }
    } catch (error) {
      // fallback below
    }
    if (!label) {
      const parsed = document.lastModified ? new Date(document.lastModified) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) {
        label = `Version: ${formatVersionDate(parsed)}`;
      } else {
        label = "Version: unknown";
      }
    }
    for (const node of nodes) {
      node.textContent = label;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateVersionInfo, { once: true });
  } else {
    hydrateVersionInfo();
  }
})();
