const els = {
  healthPill: document.getElementById("healthPill"),
  generatedAt: document.getElementById("generatedAt"),
  refreshBtn: document.getElementById("refreshBtn"),
  outageSummary: document.getElementById("outageSummary"),
  reports24h: document.getElementById("reports24h"),
  outageSourceLink: document.getElementById("outageSourceLink"),
  incidentList: document.getElementById("incidentList"),
  reportList: document.getElementById("reportList"),
  newsList: document.getElementById("newsList"),
  socialList: document.getElementById("socialList"),
  sourceChips: document.getElementById("sourceChips"),
};

const REFRESH_INTERVAL_MS = 60_000;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeExternalHref(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function formatDateTime(iso) {
  if (!iso) {
    return "No timestamp";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeFromNow(iso) {
  if (!iso) {
    return "";
  }
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return "";
  }
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (Math.abs(diffMin) < 1) {
    return "just now";
  }
  if (Math.abs(diffMin) < 60) {
    return `${diffMin}m ago`;
  }
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) {
    return `${diffH}h ago`;
  }
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}

function setHealth(health) {
  const map = {
    ok: { text: "Healthy", className: "good" },
    degraded: { text: "Degraded", className: "warn" },
    error: { text: "Error", className: "bad" },
  };
  const setting = map[health] || { text: "Unknown", className: "neutral" };
  els.healthPill.textContent = setting.text;
  els.healthPill.className = `pill ${setting.className}`;
}

function renderFeedList(target, items, emptyLabel) {
  if (!items || items.length === 0) {
    target.innerHTML = `<li class="empty">${escapeHtml(emptyLabel)}</li>`;
    return;
  }

  target.innerHTML = items
    .map((item) => {
      const title = escapeHtml(item.title || "Untitled");
      const safeUrl = safeExternalHref(item.url);
      const metaParts = [item.source, item.meta, relativeFromNow(item.published_at)]
        .filter(Boolean)
        .map((part) => escapeHtml(part));
      const linkMarkup = safeUrl
        ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${title}</a>`
        : `<span class="feed-item-title">${title}</span>`;

      return `
        <li class="feed-item">
          ${linkMarkup}
          <p class="feed-meta">${metaParts.join(" | ")}</p>
        </li>
      `;
    })
    .join("");
}

function renderIncidents(incidents) {
  if (!incidents || incidents.length === 0) {
    els.incidentList.innerHTML = '<li class="empty">No recent incidents listed.</li>';
    return;
  }

  els.incidentList.innerHTML = incidents
    .map((incident) => {
      const title = escapeHtml(incident.title || "Incident");
      const startedAt = formatDateTime(incident.started_at);
      const duration = escapeHtml(incident.duration || "n/a");
      const ack = incident.acknowledgement ? ` | ${escapeHtml(incident.acknowledgement)}` : "";
      return `
        <li class="feed-item">
          <span class="feed-item-title">${title}</span>
          <p class="feed-meta">${escapeHtml(startedAt)} | ${duration}${ack}</p>
        </li>
      `;
    })
    .join("");
}

function renderSources(sources) {
  if (!sources || sources.length === 0) {
    els.sourceChips.innerHTML = '<span class="chip bad">No source state available</span>';
    return;
  }
  els.sourceChips.innerHTML = sources
    .map((source) => {
      const cls = source.ok ? "ok" : "bad";
      const label = source.ok ? "OK" : "FAILED";
      const title = source.error ? ` title="${escapeHtml(source.error)}"` : "";
      return `<span class="chip ${cls}"${title}>${escapeHtml(source.name)}: ${label}</span>`;
    })
    .join("");
}

function render(data) {
  setHealth(data.health);
  els.generatedAt.textContent = `Last update: ${formatDateTime(data.generated_at)}`;

  const outage = data.outage || {};
  els.outageSummary.textContent = outage.summary || "Outage summary unavailable.";
  els.reports24h.textContent =
    typeof outage.reports_24h === "number" ? outage.reports_24h.toLocaleString() : "--";
  const safeOutageUrl = safeExternalHref(outage.url);
  if (safeOutageUrl) {
    els.outageSourceLink.href = safeOutageUrl;
    els.outageSourceLink.target = "_blank";
    els.outageSourceLink.rel = "noopener noreferrer";
  } else {
    els.outageSourceLink.removeAttribute("href");
    els.outageSourceLink.removeAttribute("target");
    els.outageSourceLink.removeAttribute("rel");
  }
  els.outageSourceLink.textContent = `Source: ${outage.source || "N/A"}`;

  renderIncidents(outage.incidents || []);
  renderFeedList(els.reportList, data.reports, "No report topics available.");
  renderFeedList(els.newsList, data.news, "No official news found.");
  renderFeedList(els.socialList, data.social, "No social updates available.");
  renderSources(data.sources);
}

async function loadStatus(forceRefresh = false) {
  els.refreshBtn.disabled = true;
  try {
    const endpoint = forceRefresh ? "/api/status?refresh=1" : "/api/status";
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    render(payload);
  } catch (error) {
    setHealth("error");
    els.generatedAt.textContent = "Last update: fetch failed";
    els.outageSummary.textContent = "Failed to load source data. Try again in a moment.";
  } finally {
    els.refreshBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadStatus();
  els.refreshBtn.addEventListener("click", () => loadStatus(true));
  window.setInterval(() => loadStatus(false), REFRESH_INTERVAL_MS);
});
