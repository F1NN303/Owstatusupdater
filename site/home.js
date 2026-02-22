"use strict";

const HOME_SERVICES = [
  {
    id: "overwatch",
    name: "Overwatch",
    href: "./overwatch.html",
    statusUrl: "./data/status.json",
  },
  {
    id: "sony",
    name: "Sony PSN",
    href: "./sony/index.html",
    statusUrl: "./sony/data/status.json",
  },
];

const SEVERITY_LABELS = {
  stable: "Stable",
  minor: "Warning",
  degraded: "Warning",
  major: "Outage",
  unknown: "Unknown",
};

function normalizeSeverity(value) {
  const key = String(value || "").toLowerCase();
  if (key === "stable" || key === "minor" || key === "degraded" || key === "major") {
    return key;
  }
  return "unknown";
}

function severityTone(severity) {
  if (severity === "stable") {
    return "good";
  }
  if (severity === "minor" || severity === "degraded") {
    return "warn";
  }
  if (severity === "major") {
    return "bad";
  }
  return "unknown";
}

function getSeverityFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }
  const analyticsSeverity = payload.analytics?.severity_key;
  if (analyticsSeverity) {
    return normalizeSeverity(analyticsSeverity);
  }
  return normalizeSeverity(payload.severity_key || payload.status || payload.health);
}

function formatUpdatedTime(isoString) {
  if (!isoString) {
    return "Updated: unknown";
  }
  const parsed = new Date(isoString);
  if (!Number.isFinite(parsed.getTime())) {
    return "Updated: unknown";
  }
  return `Updated: ${parsed.toLocaleString()}`;
}

function createServiceRow(service) {
  const item = document.createElement("li");
  item.className = "home-service-item";

  const link = document.createElement("a");
  link.className = "home-service-link";
  link.href = service.href;

  const main = document.createElement("span");
  main.className = "home-service-main";

  const name = document.createElement("span");
  name.className = "home-service-name";
  name.textContent = service.name;

  const note = document.createElement("span");
  note.className = "home-service-note";
  note.textContent = "Status: Loading...";

  main.append(name, note);

  const meta = document.createElement("span");
  meta.className = "home-service-meta";

  const dot = document.createElement("span");
  dot.className = "home-service-dot home-tone-unknown";
  dot.setAttribute("aria-hidden", "true");

  const updated = document.createElement("span");
  updated.className = "home-service-updated";
  updated.textContent = "Updated: --";

  meta.append(dot, updated);
  link.append(main, meta);
  item.append(link);

  return { item, note, dot, updated };
}

async function loadServiceStatus(service, refs) {
  try {
    const response = await fetch(`${service.statusUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const payload = await response.json();
    const severity = getSeverityFromPayload(payload);
    const tone = severityTone(severity);
    refs.note.textContent = `Status: ${SEVERITY_LABELS[severity] || SEVERITY_LABELS.unknown}`;
    refs.dot.className = `home-service-dot home-tone-${tone}`;
    refs.updated.textContent = formatUpdatedTime(payload.generated_at);
  } catch (_error) {
    refs.note.textContent = "Status: Unavailable";
    refs.dot.className = "home-service-dot home-tone-unknown";
    refs.updated.textContent = "Updated: unknown";
  }
}

async function initHomeStatusList() {
  const list = document.getElementById("homeServiceList");
  if (!list) {
    return;
  }

  const rows = HOME_SERVICES.map((service) => {
    const refs = createServiceRow(service);
    list.append(refs.item);
    return { service, refs };
  });

  await Promise.all(rows.map(({ service, refs }) => loadServiceStatus(service, refs)));
}

document.addEventListener("DOMContentLoaded", () => {
  initHomeStatusList();
});
