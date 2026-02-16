const I18N = {
  en: {
    pageTitle: "Overwatch Service Radar",
    ui: {
      eyebrow: "Live Overwatch Monitor",
      title: "Service Radar",
      refresh: "Refresh now",
      languageAria: "Switch language",
      sections: {
        impact: "What This Means Right Now",
        systems: "Potentially Affected Systems",
        outage: "Outage Snapshot",
        sourceConfidence: "Source Confidence",
        timeline: "Incident Timeline",
        reports: "Status Reports",
        news: "Official News",
        social: "Social Feed",
        howTo: "How To Read This Page",
      },
      labels: {
        reports24h: "24h reports",
        source: "Source: {source}",
      },
      guidance: [
        "The top status line explains expected player impact in plain language.",
        "Severity combines outage volume, incident wording, and source availability.",
        "Confidence increases when independent sources agree.",
      ],
      footnote:
        "External platforms can throttle automated access. This dashboard favors stable public sources and exposes source health so reliability remains visible.",
      loadingHeadline: "Collecting live service signals...",
      loadingMarker: "Status: Checking live telemetry...",
      loadingImpact: "Waiting for live status data...",
      empty: {
        incidents: "No recent incidents listed.",
        reports: "No report topics available.",
        news: "No official news found.",
        social: "No social updates available.",
        systems: "No system status available.",
        sourceState: "No source state available",
        impact: "No clear player-impact guidance available.",
      },
      meta: {
        lastUpdate: "Last update: {time}",
        nextRefresh: "Next refresh: {eta}",
        nextRefreshUnknown: "Next refresh: --",
        nextRefreshError: "Next refresh: waiting for successful poll",
        fetchFailed: "Last update: data fetch failed",
        noTimestamp: "No timestamp",
      },
      confidence: {
        high: "Confidence High",
        medium: "Confidence Medium",
        low: "Confidence Low",
        neutral: "Confidence --",
        explanation:
          "Source agreement is {ratio}. Higher agreement means higher confidence in the severity estimate.",
      },
      severity: {
        stable: "Stable",
        minor: "Minor Disruption",
        degraded: "Degraded",
        major: "Major Outage",
        unknown: "Unknown",
      },
      marker: {
        stable: "Status: No widespread problems detected.",
        minor: "Status: Minor service disruption signals detected.",
        degraded: "Status: Service quality is currently reduced.",
        major: "Status: Significant outage conditions detected.",
        unknown: "Status: Live service state is currently unclear.",
      },
      headlines: {
        stable: "Live signals indicate Overwatch services are broadly stable right now.",
        minor: "Intermittent service friction is possible for some players.",
        degraded: "Service reliability is under pressure and noticeable disruptions are likely.",
        major: "Widespread instability indicators are active across core Overwatch services.",
        unknown: "Live feed is temporarily unavailable; service state cannot be confirmed.",
      },
      impacts: {
        stable: [
          "Most players should be able to log in and queue normally.",
          "Brief hiccups can still occur during peak traffic.",
          "Keep this page open for rapid changes in live conditions.",
        ],
        minor: [
          "Queue entry and match start times may be slower than usual.",
          "A second login attempt may be needed in busy regions.",
          "If problems continue, wait a few minutes before retrying.",
        ],
        degraded: [
          "Login, matchmaking, and game joins may fail intermittently.",
          "Latency spikes and disconnects are more likely than normal.",
          "Avoid time-sensitive ranked sessions until stability improves.",
        ],
        major: [
          "Many players may be unable to connect or stay in matches.",
          "Queueing, game starts, and progression updates can be unreliable.",
          "If possible, postpone sessions and monitor for recovery updates.",
        ],
        unknown: [
          "The monitoring feed is currently unavailable.",
          "Treat status signals as uncertain until the next successful refresh.",
          "Retry shortly for a fresh service estimate.",
        ],
      },
      systems: {
        login: "Login and Authentication",
        matchmaking: "Matchmaking and Queueing",
        stability: "In-Game Stability",
        store: "Store and Rewards",
        state: {
          ok: "Monitoring",
          warn: "Watch closely",
          bad: "Elevated risk",
        },
        detail: {
          ok: "No direct disruption trend detected in current reports.",
          warn: "Some recent reports mention intermittent issues here.",
          bad: "Multiple recent reports indicate active disruption risk.",
        },
      },
      sourceChip: {
        ok: "OK",
        failed: "FAILED",
      },
      relative: {
        now: "just now",
        minute: "{n}m ago",
        hour: "{n}h ago",
        day: "{n}d ago",
      },
      errors: {
        loadJson: "Failed to load status.json. Check GitHub Actions data refresh.",
      },
    },
  },
  de: {
    pageTitle: "Overwatch Service Radar",
    ui: {
      eyebrow: "Live Overwatch Monitor",
      title: "Service Radar",
      refresh: "Jetzt aktualisieren",
      languageAria: "Sprache wechseln",
      sections: {
        impact: "Was Das Jetzt Für Dich Bedeutet",
        systems: "Möglicherweise Betroffene Systeme",
        outage: "Störungsübersicht",
        sourceConfidence: "Quellenvertrauen",
        timeline: "Vorfall-Zeitleiste",
        reports: "Statusmeldungen",
        news: "Offizielle News",
        social: "Social Feed",
        howTo: "So Liest Du Diese Seite",
      },
      labels: {
        reports24h: "Meldungen (24h)",
        source: "Quelle: {source}",
      },
      guidance: [
        "Die obere Statuszeile erklärt die erwartete Spieler-Auswirkung in klarer Sprache.",
        "Der Schweregrad basiert auf Ausfallvolumen, Vorfalltexten und Quellenverfügbarkeit.",
        "Das Vertrauen steigt, wenn unabhängige Quellen übereinstimmen.",
      ],
      footnote:
        "Externe Plattformen können automatisierte Zugriffe drosseln. Dieses Dashboard bevorzugt stabile öffentliche Quellen und zeigt die Quellenlage transparent an.",
      loadingHeadline: "Live-Signale werden gesammelt...",
      loadingMarker: "Status: Live-Telemetrie wird geprüft...",
      loadingImpact: "Warte auf aktuelle Statusdaten...",
      empty: {
        incidents: "Keine aktuellen Vorfälle gelistet.",
        reports: "Keine Statusmeldungen verfügbar.",
        news: "Keine offiziellen News gefunden.",
        social: "Keine Social-Updates verfügbar.",
        systems: "Keine Systemdaten verfügbar.",
        sourceState: "Keine Quellenlage verfügbar",
        impact: "Keine klare Auswirkungsbeschreibung verfügbar.",
      },
      meta: {
        lastUpdate: "Zuletzt aktualisiert: {time}",
        nextRefresh: "Nächste Aktualisierung: {eta}",
        nextRefreshUnknown: "Nächste Aktualisierung: --",
        nextRefreshError: "Nächste Aktualisierung: warte auf erfolgreiche Abfrage",
        fetchFailed: "Zuletzt aktualisiert: Datenabruf fehlgeschlagen",
        noTimestamp: "Kein Zeitstempel",
      },
      confidence: {
        high: "Vertrauen Hoch",
        medium: "Vertrauen Mittel",
        low: "Vertrauen Niedrig",
        neutral: "Vertrauen --",
        explanation:
          "Quellen-Übereinstimmung: {ratio}. Höhere Übereinstimmung bedeutet höheres Vertrauen in die Einschätzung.",
      },
      severity: {
        stable: "Stabil",
        minor: "Leichte Störung",
        degraded: "Eingeschränkt",
        major: "Große Störung",
        unknown: "Unklar",
      },
      marker: {
        stable: "Status: Keine weitreichenden Probleme erkannt.",
        minor: "Status: Leichte Störungssignale erkannt.",
        degraded: "Status: Die Servicequalität ist aktuell eingeschränkt.",
        major: "Status: Deutliche Ausfallbedingungen erkannt.",
        unknown: "Status: Der Live-Zustand ist derzeit unklar.",
      },
      headlines: {
        stable: "Live-Signale zeigen aktuell einen weitgehend stabilen Overwatch-Service.",
        minor: "Für einige Spieler sind zeitweise Reibungen möglich.",
        degraded: "Die Servicezuverlässigkeit steht unter Druck; spürbare Störungen sind wahrscheinlich.",
        major: "Mehrere starke Instabilitätssignale sind für zentrale Overwatch-Dienste aktiv.",
        unknown: "Der Live-Feed ist vorübergehend nicht verfügbar; der Servicezustand kann nicht sicher bestimmt werden.",
      },
      impacts: {
        stable: [
          "Die meisten Spieler sollten sich normal einloggen und queueen können.",
          "Kurze Aussetzer können zu Stoßzeiten trotzdem auftreten.",
          "Lass diese Seite offen, um schnelle Änderungen sofort zu sehen.",
        ],
        minor: [
          "Queue-Einstieg und Match-Start können langsamer als üblich sein.",
          "In stark ausgelasteten Regionen kann ein zweiter Login-Versuch nötig sein.",
          "Wenn Probleme bleiben, warte ein paar Minuten und versuche es erneut.",
        ],
        degraded: [
          "Login, Matchmaking und Spielbeitritte können zeitweise fehlschlagen.",
          "Latenzspitzen und Disconnects sind wahrscheinlicher als normal.",
          "Vermeide zeitkritische Ranked-Sessions, bis sich die Lage stabilisiert.",
        ],
        major: [
          "Viele Spieler können sich eventuell nicht verbinden oder im Match bleiben.",
          "Queueing, Spielstarts und Fortschrittsupdates können unzuverlässig sein.",
          "Wenn möglich, Session verschieben und auf Erholungsupdates warten.",
        ],
        unknown: [
          "Der Monitoring-Feed ist aktuell nicht verfügbar.",
          "Betrachte Statussignale als unsicher bis zur nächsten erfolgreichen Aktualisierung.",
          "Bitte in Kürze erneut prüfen.",
        ],
      },
      systems: {
        login: "Login und Authentifizierung",
        matchmaking: "Matchmaking und Queueing",
        stability: "Ingame-Stabilität",
        store: "Shop und Belohnungen",
        state: {
          ok: "Beobachtung",
          warn: "Genau beobachten",
          bad: "Erhöhtes Risiko",
        },
        detail: {
          ok: "In aktuellen Meldungen ist kein direkter Störungstrend erkennbar.",
          warn: "Einige aktuelle Meldungen nennen hier zeitweise Probleme.",
          bad: "Mehrere aktuelle Meldungen deuten auf aktive Störungsrisiken hin.",
        },
      },
      sourceChip: {
        ok: "OK",
        failed: "FEHLER",
      },
      relative: {
        now: "gerade eben",
        minute: "vor {n} Min",
        hour: "vor {n} Std",
        day: "vor {n} T",
      },
      errors: {
        loadJson: "status.json konnte nicht geladen werden. Prüfe den GitHub-Actions-Refresh.",
      },
    },
  },
};

const els = {
  eyebrowText: document.getElementById("eyebrowText"),
  titleText: document.getElementById("titleText"),
  severityBadge: document.getElementById("severityBadge"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  headlineText: document.getElementById("headlineText"),
  statusMarker: document.getElementById("statusMarker"),
  statusMarkerText: document.getElementById("statusMarkerText"),
  generatedAt: document.getElementById("generatedAt"),
  nextRefresh: document.getElementById("nextRefresh"),
  refreshBtn: document.getElementById("refreshBtn"),
  languageBtn: document.getElementById("languageBtn"),
  impactTitle: document.getElementById("impactTitle"),
  impactList: document.getElementById("impactList"),
  systemsTitle: document.getElementById("systemsTitle"),
  systemGrid: document.getElementById("systemGrid"),
  outageTitle: document.getElementById("outageTitle"),
  outageSummary: document.getElementById("outageSummary"),
  reports24hLabel: document.getElementById("reports24hLabel"),
  reports24h: document.getElementById("reports24h"),
  outageSourceLink: document.getElementById("outageSourceLink"),
  sourceConfidenceTitle: document.getElementById("sourceConfidenceTitle"),
  sourceConfidenceText: document.getElementById("sourceConfidenceText"),
  sourceChips: document.getElementById("sourceChips"),
  timelineTitle: document.getElementById("timelineTitle"),
  incidentList: document.getElementById("incidentList"),
  reportsTitle: document.getElementById("reportsTitle"),
  reportList: document.getElementById("reportList"),
  newsTitle: document.getElementById("newsTitle"),
  newsList: document.getElementById("newsList"),
  socialTitle: document.getElementById("socialTitle"),
  socialList: document.getElementById("socialList"),
  howToTitle: document.getElementById("howToTitle"),
  guideLine1: document.getElementById("guideLine1"),
  guideLine2: document.getElementById("guideLine2"),
  guideLine3: document.getElementById("guideLine3"),
  footnoteText: document.getElementById("footnoteText"),
};

const REFRESH_INTERVAL_MS = 60_000;
const DATA_URL = "./data/status.json";

let nextRefreshAt = 0;
let latestPayload = null;
let currentLang = detectInitialLanguage();

function detectInitialLanguage() {
  const browserLang = (navigator.language || "en").toLowerCase();
  return browserLang.startsWith("de") ? "de" : "en";
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function t(key, vars = {}) {
  const primary = getByPath(I18N[currentLang], key);
  const fallback = getByPath(I18N.en, key);
  const value = primary !== undefined ? primary : fallback;
  if (typeof value !== "string") {
    return typeof value === "undefined" ? key : value;
  }
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
}

function ta(key) {
  const primary = getByPath(I18N[currentLang], key);
  const fallback = getByPath(I18N.en, key);
  const value = primary !== undefined ? primary : fallback;
  return Array.isArray(value) ? value : [];
}

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
    return t("ui.meta.noTimestamp");
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const locale = currentLang === "de" ? "de-DE" : "en-US";
  return date.toLocaleString(locale, {
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
    return t("ui.relative.now");
  }
  if (Math.abs(diffMin) < 60) {
    return t("ui.relative.minute", { n: Math.abs(diffMin) });
  }
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) {
    return t("ui.relative.hour", { n: Math.abs(diffH) });
  }
  const diffD = Math.round(diffH / 24);
  return t("ui.relative.day", { n: Math.abs(diffD) });
}

function updateLanguageButtonLabel() {
  if (!els.languageBtn) {
    return;
  }
  els.languageBtn.textContent = currentLang === "de" ? "EN" : "DE";
  els.languageBtn.setAttribute("aria-label", t("ui.languageAria"));
}

function applyStaticTexts() {
  document.documentElement.lang = currentLang;
  document.title = t("pageTitle");

  els.eyebrowText.textContent = t("ui.eyebrow");
  els.titleText.textContent = t("ui.title");
  els.refreshBtn.textContent = t("ui.refresh");

  els.impactTitle.textContent = t("ui.sections.impact");
  els.systemsTitle.textContent = t("ui.sections.systems");
  els.outageTitle.textContent = t("ui.sections.outage");
  els.reports24hLabel.textContent = t("ui.labels.reports24h");
  els.sourceConfidenceTitle.textContent = t("ui.sections.sourceConfidence");
  els.timelineTitle.textContent = t("ui.sections.timeline");
  els.reportsTitle.textContent = t("ui.sections.reports");
  els.newsTitle.textContent = t("ui.sections.news");
  els.socialTitle.textContent = t("ui.sections.social");
  els.howToTitle.textContent = t("ui.sections.howTo");

  const guidance = ta("ui.guidance");
  els.guideLine1.textContent = guidance[0] || "";
  els.guideLine2.textContent = guidance[1] || "";
  els.guideLine3.textContent = guidance[2] || "";
  els.footnoteText.textContent = t("ui.footnote");

  updateLanguageButtonLabel();
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
    els.incidentList.innerHTML = `<li class="empty">${escapeHtml(t("ui.empty.incidents"))}</li>`;
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
    els.sourceChips.innerHTML = `<span class="chip bad">${escapeHtml(t("ui.empty.sourceState"))}</span>`;
    return;
  }
  els.sourceChips.innerHTML = sources
    .map((source) => {
      const cls = source.ok ? "ok" : "bad";
      const label = source.ok ? t("ui.sourceChip.ok") : t("ui.sourceChip.failed");
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
  if (!data) {
    return { key: "unknown", css: "sev-unknown" };
  }

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
    return { key: "stable", css: "sev-stable" };
  }
  if (score <= 3) {
    return { key: "minor", css: "sev-minor" };
  }
  if (score <= 5) {
    return { key: "degraded", css: "sev-degraded" };
  }
  return { key: "major", css: "sev-major" };
}

function computeConfidence(sources) {
  const total = sources?.length || 0;
  if (!total) {
    return { key: "low", css: "conf-low", ratio: 0 };
  }
  const healthy = sources.filter((source) => source.ok).length;
  const ratio = healthy / total;
  if (ratio >= 0.8) {
    return { key: "high", css: "conf-high", ratio };
  }
  if (ratio >= 0.5) {
    return { key: "medium", css: "conf-medium", ratio };
  }
  return { key: "low", css: "conf-low", ratio };
}

function detectSystems(data) {
  const text = getSignalCorpus(data);
  const systems = [
    {
      key: "login",
      state: "ok",
      tests: ["login", "sign in", "unable to connect", "cannot connect", "authentication"],
    },
    {
      key: "matchmaking",
      state: "ok",
      tests: ["matchmaking", "queue", "game modes unavailable", "finding game"],
    },
    {
      key: "stability",
      state: "ok",
      tests: ["lag", "latency", "disconnect", "packet loss", "rubberband"],
    },
    {
      key: "store",
      state: "ok",
      tests: ["shop", "store", "reward", "battlepass", "mythic prism", "purchase"],
    },
  ];

  for (const system of systems) {
    const hitCount = system.tests.reduce((count, word) => (text.includes(word) ? count + 1 : count), 0);
    if (hitCount >= 2) {
      system.state = "bad";
    } else if (hitCount === 1) {
      system.state = "warn";
    }
  }

  return systems;
}

function renderImpactList(impacts) {
  if (!impacts || !impacts.length) {
    els.impactList.innerHTML = `<li>${escapeHtml(t("ui.empty.impact"))}</li>`;
    return;
  }
  els.impactList.innerHTML = impacts.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

function renderSystems(systems) {
  if (!systems.length) {
    els.systemGrid.innerHTML = `<p class="empty">${escapeHtml(t("ui.empty.systems"))}</p>`;
    return;
  }
  els.systemGrid.innerHTML = systems
    .map((system) => {
      const systemName = t(`ui.systems.${system.key}`);
      const stateLabel = t(`ui.systems.state.${system.state}`);
      const detail = t(`ui.systems.detail.${system.state}`);
      return `
        <article class="system-tile ${system.state}">
          <div class="system-title">${escapeHtml(systemName)}</div>
          <div class="system-state">${escapeHtml(stateLabel)}</div>
          <div class="feed-meta">${escapeHtml(detail)}</div>
        </article>
      `;
    })
    .join("");
}

function updateRefreshEta() {
  if (!nextRefreshAt) {
    els.nextRefresh.textContent = t("ui.meta.nextRefreshUnknown");
    return;
  }
  const msLeft = Math.max(nextRefreshAt - Date.now(), 0);
  const totalSeconds = Math.floor(msLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const eta = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  els.nextRefresh.textContent = t("ui.meta.nextRefresh", { eta });
}

function render(data) {
  const severity = computeSeverity(data);
  const confidence = computeConfidence(data?.sources || []);
  const systems = detectSystems(data);

  els.severityBadge.textContent = t(`ui.severity.${severity.key}`);
  els.severityBadge.className = `badge ${severity.css}`;

  els.confidenceBadge.textContent = t(`ui.confidence.${confidence.key}`);
  els.confidenceBadge.className = `badge ${confidence.css}`;

  els.statusMarker.className = `status-marker marker-${severity.key}`;
  els.statusMarkerText.textContent = t(`ui.marker.${severity.key}`);
  els.headlineText.textContent = t(`ui.headlines.${severity.key}`);

  renderImpactList(ta(`ui.impacts.${severity.key}`));
  renderSystems(systems);

  els.generatedAt.textContent = t("ui.meta.lastUpdate", { time: formatDateTime(data?.generated_at) });

  const outage = data?.outage || {};
  els.outageSummary.textContent = outage.summary || t("ui.empty.incidents");
  els.reports24h.textContent =
    typeof outage.reports_24h === "number" ? outage.reports_24h.toLocaleString(currentLang === "de" ? "de-DE" : "en-US") : "--";

  const sourceName = outage.source || "N/A";
  els.outageSourceLink.href = outage.url || "#";
  els.outageSourceLink.textContent = t("ui.labels.source", { source: sourceName });

  renderIncidents(outage.incidents || []);
  renderFeedList(els.reportList, data?.reports || [], t("ui.empty.reports"));
  renderFeedList(els.newsList, data?.news || [], t("ui.empty.news"));
  renderFeedList(els.socialList, data?.social || [], t("ui.empty.social"));
  renderSources(data?.sources || []);

  const okSources = (data?.sources || []).filter((source) => source.ok).length;
  const totalSources = (data?.sources || []).length || 0;
  const ratioText = totalSources ? `${okSources}/${totalSources}` : "--";
  els.sourceConfidenceText.textContent = t("ui.confidence.explanation", { ratio: ratioText });
}

function renderLoadingState() {
  els.statusMarker.className = "status-marker marker-unknown";
  els.statusMarkerText.textContent = t("ui.loadingMarker");
  els.headlineText.textContent = t("ui.loadingHeadline");
  renderImpactList([t("ui.loadingImpact")]);
  els.generatedAt.textContent = t("ui.meta.lastUpdate", { time: "--" });
  els.nextRefresh.textContent = t("ui.meta.nextRefreshUnknown");
}

async function loadStatus() {
  els.refreshBtn.disabled = true;
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    latestPayload = payload;
    render(payload);
    nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
    updateRefreshEta();
  } catch (error) {
    latestPayload = null;
    els.severityBadge.textContent = t("ui.severity.unknown");
    els.severityBadge.className = "badge sev-unknown";
    els.confidenceBadge.textContent = t("ui.confidence.low");
    els.confidenceBadge.className = "badge conf-low";
    els.statusMarker.className = "status-marker marker-unknown";
    els.statusMarkerText.textContent = t("ui.marker.unknown");
    els.headlineText.textContent = t("ui.headlines.unknown");
    renderImpactList(ta("ui.impacts.unknown"));
    els.generatedAt.textContent = t("ui.meta.fetchFailed");
    els.nextRefresh.textContent = t("ui.meta.nextRefreshError");
    els.outageSummary.textContent = t("ui.errors.loadJson");
  } finally {
    els.refreshBtn.disabled = false;
  }
}

function toggleLanguage() {
  currentLang = currentLang === "de" ? "en" : "de";
  applyStaticTexts();
  if (latestPayload) {
    render(latestPayload);
  } else {
    renderLoadingState();
  }
  updateRefreshEta();
}

document.addEventListener("DOMContentLoaded", () => {
  applyStaticTexts();
  renderLoadingState();
  loadStatus();
  updateRefreshEta();

  els.refreshBtn.addEventListener("click", () => loadStatus());
  if (els.languageBtn) {
    els.languageBtn.addEventListener("click", toggleLanguage);
  }

  window.setInterval(() => loadStatus(), REFRESH_INTERVAL_MS);
  window.setInterval(updateRefreshEta, 1000);
});
