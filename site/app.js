const els = {
  severityBadge: document.getElementById("severityBadge"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  headlineText: document.getElementById("headlineText"),
  generatedAt: document.getElementById("generatedAt"),
  nextRefresh: document.getElementById("nextRefresh"),
  refreshBtn: document.getElementById("refreshBtn"),
  impactList: document.getElementById("impactList"),
  systemGrid: document.getElementById("systemGrid"),
  outageSummary: document.getElementById("outageSummary"),
  reports24h: document.getElementById("reports24h"),
  outageSourceLink: document.getElementById("outageSourceLink"),
  incidentList: document.getElementById("incidentList"),
  reportList: document.getElementById("reportList"),
  newsList: document.getElementById("newsList"),
  socialList: document.getElementById("socialList"),
  sourceConfidenceText: document.getElementById("sourceConfidenceText"),
  sourceChips: document.getElementById("sourceChips"),
};

const REFRESH_INTERVAL_MS = 60_000;
const DATA_URL = "./data/status.json";
let nextRefreshAt = 0;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function renderFeedList(target, items, emptyLabel) {
  if (!items || items.length === 0) {
    target.innerHTML = `<li class="empty">${escapeHtml(emptyLabel)}</li>`;
    return;
  }

  target.innerHTML = items
    .map((item) => {
      const title = escapeHtml(item.title || "Untitled");
      const url = escapeHtml(item.url || "#");
      const metaParts = [item.source, item.meta, relativeFromNow(item.published_at)]
        .filter(Boolean)
        .map((part) => escapeHtml(part));

      return `
        <li class="feed-item">
          <a href="${url}" target="_blank" rel="noreferrer">${title}</a>
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
          <div class="feed-item-title">${title}</div>
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

function getSignalCorpus(data) {
  const parts = [];
  parts.push(data?.outage?.summary || "");
  for (const item of data?.outage?.incidents || []) {
    parts.push(item.title || "");
  }
  for (const item of data?.reports || []) {
    parts.push(item.title || "");
  }
  return parts.join(" ").toLowerCase();
}

function computeSeverity(data) {
  const corpus = getSignalCorpus(data);
  const incidents = data?.outage?.incidents || [];
  const reports24h = Number(data?.outage?.reports_24h || 0);
  const sourceState = data?.health || "error";

  let score = 0;
  if (sourceState === "degraded") {
    score += 1;
  } else if (sourceState === "error") {
    score += 2;
  }

  if (reports24h >= 700) {
    score += 2;
  } else if (reports24h >= 350) {
    score += 1;
  }

  if (incidents.length >= 5) {
    score += 2;
  } else if (incidents.length >= 2) {
    score += 1;
  }

  const hardKeywords = ["service down", "major outage", "unavailable", "cannot connect", "unable to connect"];
  const mediumKeywords = ["lag", "latency", "disconnect", "queue", "degraded"];
  if (hardKeywords.some((word) => corpus.includes(word))) {
    score += 2;
  }
  if (mediumKeywords.some((word) => corpus.includes(word))) {
    score += 1;
  }

  if ((data?.outage?.current_status || "").toLowerCase().includes("operational")) {
    score -= 1;
  }
  score = Math.max(score, 0);

  if (score <= 1) {
    return {
      key: "stable",
      label: "Stable",
      css: "sev-stable",
      headline: "Live signals indicate Overwatch services are broadly stable right now.",
      impacts: [
        "Most players should be able to log in and queue normally.",
        "Brief hiccups can still occur during peak traffic.",
        "Keep this page open for rapid changes in live conditions.",
      ],
    };
  }

  if (score <= 3) {
    return {
      key: "minor",
      label: "Minor Disruption",
      css: "sev-minor",
      headline: "Intermittent service friction is possible for some players.",
      impacts: [
        "Queue entry and match start times may be slower than usual.",
        "A second login attempt may be needed in busy regions.",
        "If problems continue, wait a few minutes before retrying.",
      ],
    };
  }

  if (score <= 5) {
    return {
      key: "degraded",
      label: "Degraded",
      css: "sev-degraded",
      headline: "Service reliability is under pressure and noticeable disruptions are likely.",
      impacts: [
        "Login, matchmaking, and game joins may fail intermittently.",
        "Latency spikes and disconnects are more likely than normal.",
        "Avoid time-sensitive ranked sessions until stability improves.",
      ],
    };
  }

  return {
    key: "major",
    label: "Major Outage",
    css: "sev-major",
    headline: "Widespread instability indicators are active across core Overwatch services.",
    impacts: [
      "Many players may be unable to connect or stay in matches.",
      "Queueing, game starts, and progression updates can be unreliable.",
      "If possible, postpone sessions and monitor for recovery updates.",
    ],
  };
}

function computeConfidence(sources) {
  const total = sources?.length || 0;
  if (!total) {
    return { label: "Confidence Low", css: "conf-low", ratio: 0 };
  }
  const healthy = sources.filter((source) => source.ok).length;
  const ratio = healthy / total;
  if (ratio >= 0.8) {
    return { label: "Confidence High", css: "conf-high", ratio };
  }
  if (ratio >= 0.5) {
    return { label: "Confidence Medium", css: "conf-medium", ratio };
  }
  return { label: "Confidence Low", css: "conf-low", ratio };
}

function detectSystems(data) {
  const text = getSignalCorpus(data);
  const systems = [
    {
      name: "Login and Authentication",
      state: "ok",
      detail: "No direct login failure trend detected.",
      tests: ["login", "sign in", "unable to connect", "cannot connect", "authentication"],
    },
    {
      name: "Matchmaking and Queueing",
      state: "ok",
      detail: "Queue flow appears normal from current signals.",
      tests: ["matchmaking", "queue", "game modes unavailable", "finding game"],
    },
    {
      name: "In-Game Stability",
      state: "ok",
      detail: "No broad gameplay instability pattern detected.",
      tests: ["lag", "latency", "disconnect", "packet loss", "rubberband"],
    },
    {
      name: "Store and Rewards",
      state: "ok",
      detail: "No major store or reward outage signal right now.",
      tests: ["shop", "store", "reward", "battlepass", "mythic prism", "purchase"],
    },
  ];

  for (const system of systems) {
    const hitCount = system.tests.reduce(
      (count, word) => (text.includes(word) ? count + 1 : count),
      0
    );
    if (hitCount >= 2) {
      system.state = "bad";
      system.detail = "Multiple recent reports indicate active disruption risk.";
    } else if (hitCount === 1) {
      system.state = "warn";
      system.detail = "Some recent reports mention intermittent issues here.";
    }
  }

  return systems;
}

function renderImpactList(impacts) {
  if (!impacts || !impacts.length) {
    els.impactList.innerHTML = "<li>No clear player-impact guidance available.</li>";
    return;
  }
  els.impactList.innerHTML = impacts.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function renderSystems(systems) {
  if (!systems.length) {
    els.systemGrid.innerHTML = '<p class="empty">No system status available.</p>';
    return;
  }
  els.systemGrid.innerHTML = systems
    .map((system) => {
      const stateLabel = system.state === "bad" ? "Elevated risk" : system.state === "warn" ? "Watch closely" : "Monitoring";
      return `
        <article class="system-tile ${system.state}">
          <div class="system-title">${escapeHtml(system.name)}</div>
          <div class="system-state">${escapeHtml(stateLabel)}</div>
          <div class="feed-meta">${escapeHtml(system.detail)}</div>
        </article>
      `;
    })
    .join("");
}

function updateRefreshEta() {
  if (!nextRefreshAt) {
    els.nextRefresh.textContent = "Next refresh: --";
    return;
  }
  const msLeft = Math.max(nextRefreshAt - Date.now(), 0);
  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  els.nextRefresh.textContent = `Next refresh: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function render(data) {
  const severity = computeSeverity(data);
  const confidence = computeConfidence(data.sources || []);
  const systems = detectSystems(data);

  els.severityBadge.textContent = severity.label;
  els.severityBadge.className = `badge ${severity.css}`;
  els.confidenceBadge.textContent = confidence.label;
  els.confidenceBadge.className = `badge ${confidence.css}`;
  els.headlineText.textContent = severity.headline;
  renderImpactList(severity.impacts);
  renderSystems(systems);

  els.generatedAt.textContent = `Last update: ${formatDateTime(data.generated_at)}`;

  const outage = data.outage || {};
  els.outageSummary.textContent = outage.summary || "Outage summary unavailable.";
  els.reports24h.textContent =
    typeof outage.reports_24h === "number" ? outage.reports_24h.toLocaleString() : "--";
  els.outageSourceLink.href = outage.url || "#";
  els.outageSourceLink.textContent = `Source: ${outage.source || "N/A"}`;

  renderIncidents(outage.incidents || []);
  renderFeedList(els.reportList, data.reports, "No report topics available.");
  renderFeedList(els.newsList, data.news, "No official news found.");
  renderFeedList(els.socialList, data.social, "No social updates available.");
  renderSources(data.sources);
  const okSources = (data.sources || []).filter((source) => source.ok).length;
  const totalSources = (data.sources || []).length || 0;
  const ratioText = totalSources ? `${okSources}/${totalSources}` : "--";
  els.sourceConfidenceText.textContent = `Source agreement is ${ratioText}. Higher agreement means higher confidence in the severity estimate.`;
}

async function loadStatus() {
  els.refreshBtn.disabled = true;
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    render(payload);
    nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
    updateRefreshEta();
  } catch (error) {
    els.severityBadge.textContent = "Unknown";
    els.severityBadge.className = "badge sev-unknown";
    els.confidenceBadge.textContent = "Confidence Low";
    els.confidenceBadge.className = "badge conf-low";
    els.headlineText.textContent = "Live feed is temporarily unavailable; service state cannot be confirmed.";
    els.generatedAt.textContent = "Last update: data fetch failed";
    els.nextRefresh.textContent = "Next refresh: waiting for successful poll";
    els.outageSummary.textContent = "Failed to load status.json. Check GitHub Actions data refresh.";
  } finally {
    els.refreshBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadStatus();
  updateRefreshEta();
  els.refreshBtn.addEventListener("click", () => loadStatus());
  window.setInterval(() => loadStatus(), REFRESH_INTERVAL_MS);
  window.setInterval(updateRefreshEta, 1000);
});
