const I18N = {
  en: {
    pageTitle: "Overwatch Service Radar",
    ui: {
      eyebrow: "Live Overwatch Monitor",
      title: "Service Radar",
      refresh: "Refresh now",
      languageAria: "Switch language",
      tabs: {
        overview: "Overview",
        incidents: "Incidents",
        analytics: "Analytics",
      },
      sections: {
        impact: "What This Means Right Now",
        systems: "Potentially Affected Systems",
        outage: "Outage Snapshot",
        sourceConfidence: "Source Confidence",
        known: "Known Resources",
        timeline: "Incident Timeline",
        reports: "Status Reports",
        news: "Official News",
        social: "Social Feed",
        analytics24: "24h Service Health Bars",
        analytics7: "7d Trend Line",
        howTo: "How To Read This Page",
      },
      labels: {
        reports24h: "24h reports",
        source: "Source: {source}",
      },
      sort: {
        label: "Sort by",
        recent: "Most recent",
        impact: "Highest impact",
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
        known: "No known-resource links available.",
        chart24: "No 24h chart data available yet.",
        chart7: "No 7d trend data available yet.",
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
        stable: "Status: No problems detected.",
        minor: "Status: Minor disruption detected.",
        degraded: "Status: Service quality reduced.",
        major: "Status: Significant outage detected.",
        unknown: "Status: Service status currently unclear.",
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
      analytics: {
        subtitle7: "Rolling trend from 30-minute points.",
        dataAge: "Data age: {age} ({points} points)",
        dataAgeUnknown: "Data age: unknown",
        legend: {
          stable: "Service up",
          minor: "Possible outage",
          degraded: "Likely outage",
          major: "Major outage",
        },
        reportsSeries: "24h reports",
        trendSeries: "Reports trend",
        avgSeries: "Rolling average",
        tooltip: {
          reports: "Reports (24h)",
          severity: "Severity",
          sources: "Source agreement",
        },
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
      tabs: {
        overview: "Uebersicht",
        incidents: "Vorfaelle",
        analytics: "Analytik",
      },
      sections: {
        impact: "Was Das Jetzt Für Dich Bedeutet",
        systems: "Möglicherweise Betroffene Systeme",
        outage: "Störungsübersicht",
        sourceConfidence: "Quellenvertrauen",
        known: "Bekannte Ressourcen",
        timeline: "Vorfall-Zeitleiste",
        reports: "Statusmeldungen",
        news: "Offizielle News",
        social: "Social Feed",
        analytics24: "24h Service-Balken",
        analytics7: "7d Trendlinie",
        howTo: "So Liest Du Diese Seite",
      },
      labels: {
        reports24h: "Meldungen (24h)",
        source: "Quelle: {source}",
      },
      sort: {
        label: "Sortieren nach",
        recent: "Neueste zuerst",
        impact: "Hoechster Einfluss",
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
        known: "Aktuell keine bekannten Ressourcen verfügbar.",
        chart24: "Noch keine 24h-Chartdaten verfügbar.",
        chart7: "Noch keine 7d-Trenddaten verfügbar.",
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
        stable: "Status: Keine Probleme erkannt.",
        minor: "Status: Leichte Stoerung erkannt.",
        degraded: "Status: Servicequalitaet reduziert.",
        major: "Status: Deutliche Ausfallbedingungen erkannt.",
        unknown: "Status: Aktueller Servicezustand unklar.",
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
      analytics: {
        subtitle7: "Rollender Trend aus 30-Minuten-Punkten.",
        dataAge: "Datenalter: {age} ({points} Punkte)",
        dataAgeUnknown: "Datenalter: unbekannt",
        legend: {
          stable: "Service verfuegbar",
          minor: "Moegliche Stoerung",
          degraded: "Wahrscheinliche Stoerung",
          major: "Groessere Stoerung",
        },
        reportsSeries: "Meldungen (24h)",
        trendSeries: "Meldungstrend",
        avgSeries: "Gleitender Durchschnitt",
        tooltip: {
          reports: "Meldungen (24h)",
          severity: "Schweregrad",
          sources: "Quellen-Uebereinstimmung",
        },
      },
      errors: {
        loadJson: "status.json konnte nicht geladen werden. Prüfe den GitHub-Actions-Refresh.",
      },
    },
  },
};

const els = {
  tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
  tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
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
  tabOverviewBtn: document.getElementById("tabOverviewBtn"),
  tabIncidentsBtn: document.getElementById("tabIncidentsBtn"),
  tabAnalyticsBtn: document.getElementById("tabAnalyticsBtn"),
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
  knownTitle: document.getElementById("knownTitle"),
  knownList: document.getElementById("knownList"),
  sortLabel: document.getElementById("sortLabel"),
  sortSelect: document.getElementById("sortSelect"),
  timelineTitle: document.getElementById("timelineTitle"),
  incidentList: document.getElementById("incidentList"),
  reportsTitle: document.getElementById("reportsTitle"),
  reportList: document.getElementById("reportList"),
  newsTitle: document.getElementById("newsTitle"),
  newsList: document.getElementById("newsList"),
  socialTitle: document.getElementById("socialTitle"),
  socialList: document.getElementById("socialList"),
  analytics24Title: document.getElementById("analytics24Title"),
  analytics7Title: document.getElementById("analytics7Title"),
  analytics7Subtitle: document.getElementById("analytics7Subtitle"),
  analyticsDataAge: document.getElementById("analyticsDataAge"),
  legendStable: document.getElementById("legendStable"),
  legendMinor: document.getElementById("legendMinor"),
  legendDegraded: document.getElementById("legendDegraded"),
  legendMajor: document.getElementById("legendMajor"),
  chart24h: document.getElementById("chart24h"),
  chart7d: document.getElementById("chart7d"),
  chart24Empty: document.getElementById("chart24Empty"),
  chart7Empty: document.getElementById("chart7Empty"),
  howToTitle: document.getElementById("howToTitle"),
  guideLine1: document.getElementById("guideLine1"),
  guideLine2: document.getElementById("guideLine2"),
  guideLine3: document.getElementById("guideLine3"),
  footnoteText: document.getElementById("footnoteText"),
};

const REFRESH_INTERVAL_MS = 60_000;
const DATA_URLS = {
  status: "./data/status.json",
  history: "./data/history.json",
};
const STORAGE_KEYS = {
  lang: "ow_radar_lang",
  tab: "ow_radar_tab",
  sort: "ow_radar_sort",
};
const VALID_TABS = ["overview", "incidents", "analytics"];
const VALID_SORT_MODES = ["recent", "impact"];
const VALID_SEVERITY = ["stable", "minor", "degraded", "major", "unknown"];
const SEVERITY_COLORS = {
  stable: "#22c55e",
  minor: "#f59e0b",
  degraded: "#f97316",
  major: "#ef4444",
  unknown: "#7b8ea8",
};

let nextRefreshAt = 0;
let latestPayload = null;
let latestHistory = null;
let currentLang = detectInitialLanguage();
let currentTab = detectInitialTab();
let sortMode = detectInitialSortMode();
let isLoading = false;
let chart24 = null;
let chart7 = null;

function detectInitialLanguage() {
  const stored = safeGetLocalStorage(STORAGE_KEYS.lang);
  if (stored === "de" || stored === "en") {
    return stored;
  }
  const browserLang = (navigator.language || "en").toLowerCase();
  return browserLang.startsWith("de") ? "de" : "en";
}

function detectInitialTab() {
  const stored = safeGetLocalStorage(STORAGE_KEYS.tab);
  return VALID_TABS.includes(stored) ? stored : "overview";
}

function detectInitialSortMode() {
  const stored = safeGetLocalStorage(STORAGE_KEYS.sort);
  return VALID_SORT_MODES.includes(stored) ? stored : "recent";
}

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // ignore storage failures
  }
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

function parseIso(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeText(value) {
  let text = String(value || "");
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function clampNumber(value, min, max, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(Math.max(num, min), max);
}

function sortByDate(items, fields) {
  const fieldList = Array.isArray(fields) ? fields : [fields];
  return [...items].sort((left, right) => {
    const leftField = fieldList.find((field) => left?.[field]);
    const rightField = fieldList.find((field) => right?.[field]);
    const leftTime = parseIso(leftField ? left[leftField] : null)?.getTime() || 0;
    const rightTime = parseIso(rightField ? right[rightField] : null)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

function scoreImpact(item) {
  const corpus = `${item?.title || ""} ${item?.meta || ""}`.toLowerCase();
  let score = 0;
  for (const critical of ["service down", "major outage", "cannot connect", "unable to connect", "unavailable", "queue"]) {
    if (corpus.includes(critical)) {
      score += 3;
    }
  }
  for (const moderate of ["disconnect", "latency", "lag", "maintenance", "degraded", "reward"]) {
    if (corpus.includes(moderate)) {
      score += 1;
    }
  }
  const iso = item?.started_at || item?.published_at || item?.t;
  const date = parseIso(iso);
  if (date) {
    const ageHours = Math.max((Date.now() - date.getTime()) / 3_600_000, 0);
    if (ageHours <= 6) {
      score += 3;
    } else if (ageHours <= 24) {
      score += 2;
    } else if (ageHours <= 72) {
      score += 1;
    }
  }
  return score;
}

function sortByImpact(items) {
  return [...items].sort((left, right) => {
    const diff = scoreImpact(right) - scoreImpact(left);
    if (diff !== 0) {
      return diff;
    }
    const leftTime = parseIso(left?.started_at || left?.published_at)?.getTime() || 0;
    const rightTime = parseIso(right?.started_at || right?.published_at)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

function sortCollection(items, fields) {
  if (!Array.isArray(items)) {
    return [];
  }
  return sortMode === "impact" ? sortByImpact(items) : sortByDate(items, fields);
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString(currentLang === "de" ? "de-DE" : "en-US");
}

function formatTick(iso, longLabel = false) {
  const date = parseIso(iso);
  if (!date) {
    return "--";
  }
  const locale = currentLang === "de" ? "de-DE" : "en-US";
  if (longLabel) {
    return date.toLocaleString(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function rgba(hex, alpha) {
  const normalized = String(hex || "").replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(123, 142, 168, ${alpha})`;
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  els.tabOverviewBtn.textContent = t("ui.tabs.overview");
  els.tabIncidentsBtn.textContent = t("ui.tabs.incidents");
  els.tabAnalyticsBtn.textContent = t("ui.tabs.analytics");

  els.impactTitle.textContent = t("ui.sections.impact");
  els.systemsTitle.textContent = t("ui.sections.systems");
  els.outageTitle.textContent = t("ui.sections.outage");
  els.reports24hLabel.textContent = t("ui.labels.reports24h");
  els.sourceConfidenceTitle.textContent = t("ui.sections.sourceConfidence");
  els.knownTitle.textContent = t("ui.sections.known");
  els.sortLabel.textContent = t("ui.sort.label");
  els.timelineTitle.textContent = t("ui.sections.timeline");
  els.reportsTitle.textContent = t("ui.sections.reports");
  els.newsTitle.textContent = t("ui.sections.news");
  els.socialTitle.textContent = t("ui.sections.social");
  els.analytics24Title.textContent = t("ui.sections.analytics24");
  els.analytics7Title.textContent = t("ui.sections.analytics7");
  els.analytics7Subtitle.textContent = t("ui.analytics.subtitle7");
  els.legendStable.textContent = t("ui.analytics.legend.stable");
  els.legendMinor.textContent = t("ui.analytics.legend.minor");
  els.legendDegraded.textContent = t("ui.analytics.legend.degraded");
  els.legendMajor.textContent = t("ui.analytics.legend.major");
  els.chart24Empty.textContent = t("ui.empty.chart24");
  els.chart7Empty.textContent = t("ui.empty.chart7");
  els.howToTitle.textContent = t("ui.sections.howTo");
  const recentOption = els.sortSelect.querySelector('option[value="recent"]');
  const impactOption = els.sortSelect.querySelector('option[value="impact"]');
  if (recentOption) {
    recentOption.textContent = t("ui.sort.recent");
  }
  if (impactOption) {
    impactOption.textContent = t("ui.sort.impact");
  }

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
      const title = escapeHtml(normalizeText(item.title || "Untitled"));
      const url = escapeHtml(item.url || "#");
      const metaParts = [normalizeText(item.source || ""), normalizeText(item.meta || ""), relativeFromNow(item.published_at || item.started_at)]
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

function renderKnownResources(resources) {
  if (!resources || resources.length === 0) {
    els.knownList.innerHTML = `<li class="empty">${escapeHtml(t("ui.empty.known"))}</li>`;
    return;
  }
  els.knownList.innerHTML = resources
    .map((item) => {
      const title = escapeHtml(normalizeText(item.title || "Resource"));
      const url = escapeHtml(item.url || "#");
      const metaParts = [normalizeText(item.source || ""), normalizeText(item.meta || ""), relativeFromNow(item.published_at)]
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
  parts.push(normalizeText(data?.outage?.summary || ""));
  for (const item of data?.outage?.incidents || []) {
    parts.push(normalizeText(item.title || ""));
  }
  for (const item of data?.reports || []) {
    parts.push(normalizeText(item.title || ""));
  }
  return parts.join(" ").toLowerCase();
}

function computeSeverity(data) {
  if (!data) {
    return { key: "unknown", css: "sev-unknown", score: 0, sourceOk: 0, sourceTotal: 0 };
  }

  const analytics = data.analytics || {};
  if (VALID_SEVERITY.includes(analytics.severity_key)) {
    return {
      key: analytics.severity_key,
      css: `sev-${analytics.severity_key}`,
      score: clampNumber(analytics.severity_score, 0, 999, 0),
      sourceOk: clampNumber(analytics.source_ok_count, 0, 999, 0),
      sourceTotal: clampNumber(analytics.source_total_count, 0, 999, 0),
    };
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
  if (reports24h >= 1500) {
    score += 3;
  } else if (reports24h >= 900) {
    score += 2;
  } else if (reports24h >= 450) {
    score += 1;
  }

  for (const incident of incidents) {
    const ageHours = Math.max((Date.now() - (parseIso(incident.started_at)?.getTime() || Date.now())) / 3_600_000, 0);
    if (ageHours <= 6) {
      score += 2;
    } else if (ageHours <= 24) {
      score += 1.2;
    } else if (ageHours <= 72) {
      score += 0.5;
    } else {
      score += 0.2;
    }
  }

  const hardKeywords = ["service down", "major outage", "unavailable", "cannot connect", "unable to connect"];
  const mediumKeywords = ["lag", "latency", "disconnect", "queue", "degraded"];
  if (hardKeywords.some((word) => corpus.includes(word))) {
    score += 1.2;
  } else if (mediumKeywords.some((word) => corpus.includes(word))) {
    score += 0.6;
  }
  if ((data?.outage?.current_status || "").toLowerCase().includes("operational")) {
    score -= 1.2;
  }
  score = Math.max(score, 0);

  if (score < 2.4) {
    return { key: "stable", css: "sev-stable", score: Math.round(score), sourceOk: 0, sourceTotal: 0 };
  }
  if (score < 4.6) {
    return { key: "minor", css: "sev-minor", score: Math.round(score), sourceOk: 0, sourceTotal: 0 };
  }
  if (score < 7.2) {
    return { key: "degraded", css: "sev-degraded", score: Math.round(score), sourceOk: 0, sourceTotal: 0 };
  }
  return { key: "major", css: "sev-major", score: Math.round(score), sourceOk: 0, sourceTotal: 0 };
}

function computeConfidence(sources, severity) {
  let total = severity?.sourceTotal || 0;
  let healthy = severity?.sourceOk || 0;
  if (!total) {
    total = sources?.length || 0;
    healthy = sources?.filter((source) => source.ok).length || 0;
  }
  if (!total) {
    return { key: "neutral", css: "conf-neutral", ratio: 0, ok: 0, total: 0 };
  }
  const ratio = healthy / total;
  if (ratio >= 0.8) {
    return { key: "high", css: "conf-high", ratio, ok: healthy, total };
  }
  if (ratio >= 0.5) {
    return { key: "medium", css: "conf-medium", ratio, ok: healthy, total };
  }
  return { key: "low", css: "conf-low", ratio, ok: healthy, total };
}

function detectSystems(data, severityKey) {
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

  if (severityKey === "major") {
    for (const system of systems) {
      if (system.state === "ok") {
        system.state = "warn";
      }
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
  const confidence = computeConfidence(data?.sources || [], severity);
  const systems = detectSystems(data, severity.key);

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
  els.outageSummary.textContent = normalizeText(outage.summary || t("ui.empty.incidents"));
  els.reports24h.textContent =
    typeof outage.reports_24h === "number" ? formatNumber(outage.reports_24h) : "--";

  const sourceName = normalizeText(outage.source || "N/A");
  els.outageSourceLink.href = outage.url || "#";
  els.outageSourceLink.textContent = t("ui.labels.source", { source: sourceName });

  renderIncidents(sortCollection(outage.incidents || [], "started_at"));
  renderFeedList(els.reportList, sortCollection(data?.reports || [], "published_at"), t("ui.empty.reports"));
  renderFeedList(els.newsList, sortCollection(data?.news || [], "published_at"), t("ui.empty.news"));
  renderFeedList(els.socialList, sortCollection(data?.social || [], "published_at"), t("ui.empty.social"));
  renderKnownResources(sortCollection(data?.known_resources || [], "published_at"));
  renderSources(data?.sources || []);

  const ratioText = confidence.total ? `${confidence.ok}/${confidence.total}` : "--";
  els.sourceConfidenceText.textContent = t("ui.confidence.explanation", { ratio: ratioText });
}

function renderLoadingState() {
  els.severityBadge.textContent = t("ui.severity.unknown");
  els.severityBadge.className = "badge sev-unknown";
  els.confidenceBadge.textContent = t("ui.confidence.neutral");
  els.confidenceBadge.className = "badge conf-neutral";
  els.statusMarker.className = "status-marker marker-unknown";
  els.statusMarkerText.textContent = t("ui.loadingMarker");
  els.headlineText.textContent = t("ui.loadingHeadline");
  renderImpactList([t("ui.loadingImpact")]);
  els.generatedAt.textContent = t("ui.meta.lastUpdate", { time: "--" });
  els.nextRefresh.textContent = t("ui.meta.nextRefreshUnknown");
  els.outageSummary.textContent = t("ui.loadingImpact");
  els.reports24h.textContent = "--";
  renderKnownResources([]);
  renderIncidents([]);
  renderFeedList(els.reportList, [], t("ui.empty.reports"));
  renderFeedList(els.newsList, [], t("ui.empty.news"));
  renderFeedList(els.socialList, [], t("ui.empty.social"));
  renderSources([]);
  els.chart24Empty.hidden = false;
  els.chart7Empty.hidden = false;
  els.analyticsDataAge.textContent = t("ui.analytics.dataAgeUnknown");
}

function normalizeHistoryPayload(history) {
  if (!history || typeof history !== "object" || !Array.isArray(history.points)) {
    return null;
  }
  const byTimestamp = new Map();
  for (const point of history.points) {
    const parsed = parseIso(point?.t);
    if (!parsed) {
      continue;
    }
    const tIso = parsed.toISOString();
    const severityKey = VALID_SEVERITY.includes(point?.severity_key) ? point.severity_key : "unknown";
    const sourceTotal = clampNumber(point?.source_total, 0, 999, 0);
    const sourceOk = clampNumber(point?.source_ok, 0, sourceTotal || 999, 0);
    byTimestamp.set(tIso, {
      t: tIso,
      reports_24h: clampNumber(point?.reports_24h, 0, 999_999, 0),
      severity_key: severityKey,
      source_ok: sourceOk,
      source_total: sourceTotal,
    });
  }
  const points = [...byTimestamp.values()].sort((left, right) => {
    const leftTime = parseIso(left.t)?.getTime() || 0;
    const rightTime = parseIso(right.t)?.getTime() || 0;
    return leftTime - rightTime;
  });
  return {
    updated_at: history.updated_at || points[points.length - 1]?.t || null,
    points,
  };
}

function movingAverage(values, windowSize) {
  return values.map((_value, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const sample = values.slice(start, index + 1);
    const total = sample.reduce((sum, item) => sum + item, 0);
    return sample.length ? total / sample.length : 0;
  });
}

function chartScales() {
  return {
    x: {
      grid: { color: "rgba(100, 116, 139, 0.16)" },
      ticks: { color: "#9caec5", autoSkip: true, maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(100, 116, 139, 0.2)" },
      ticks: {
        color: "#9caec5",
        callback: (value) => formatNumber(value),
      },
    },
  };
}

function destroyCharts() {
  if (chart24) {
    chart24.destroy();
    chart24 = null;
  }
  if (chart7) {
    chart7.destroy();
    chart7 = null;
  }
}

function tooltipCallbacks(metaAccessor) {
  return {
    title(items) {
      if (!items || !items.length) {
        return "";
      }
      const point = metaAccessor(items[0].chart, items[0].dataIndex);
      return point ? formatDateTime(point.t) : "";
    },
    label(context) {
      return `${t("ui.analytics.tooltip.reports")}: ${formatNumber(context.raw)}`;
    },
    afterLabel(context) {
      const point = metaAccessor(context.chart, context.dataIndex);
      if (!point) {
        return "";
      }
      const ratio = point.source_total ? `${point.source_ok}/${point.source_total}` : "--";
      return [`${t("ui.analytics.tooltip.severity")}: ${t(`ui.severity.${point.severity_key}`)}`, `${t("ui.analytics.tooltip.sources")}: ${ratio}`];
    },
  };
}

function updateAnalyticsDataAge(history) {
  const points = history?.points || [];
  if (!points.length) {
    els.analyticsDataAge.textContent = t("ui.analytics.dataAgeUnknown");
    return;
  }
  const latest = history.updated_at || points[points.length - 1].t;
  els.analyticsDataAge.textContent = t("ui.analytics.dataAge", { age: relativeFromNow(latest), points: formatNumber(points.length) });
}

function initChartsIfNeeded() {
  if (currentTab !== "analytics") {
    return;
  }
  updateAnalyticsDataAge(latestHistory);
  if (typeof window.Chart === "undefined" || !latestHistory?.points?.length) {
    destroyCharts();
    els.chart24Empty.hidden = false;
    els.chart7Empty.hidden = false;
    console.info("[ow-radar] history points:", latestHistory?.points?.length || 0, "chart init status:", "empty");
    return;
  }

  const points24 = latestHistory.points.slice(-48);
  const points7 = latestHistory.points.slice(-336);
  destroyCharts();

  if (points24.length) {
    chart24 = new window.Chart(els.chart24h.getContext("2d"), {
      type: "bar",
      data: {
        labels: points24.map((point) => formatTick(point.t, false)),
        datasets: [
          {
            label: t("ui.analytics.reportsSeries"),
            data: points24.map((point) => point.reports_24h),
            backgroundColor: points24.map((point) => rgba(SEVERITY_COLORS[point.severity_key] || SEVERITY_COLORS.unknown, 0.9)),
            borderRadius: 2,
            borderSkipped: false,
            maxBarThickness: 16,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: chartScales(),
        plugins: {
          legend: { display: false },
          tooltip: tooltipCallbacks((chart, index) => chart.$meta?.[index]),
        },
      },
    });
    chart24.$meta = points24;
    els.chart24Empty.hidden = true;
  } else {
    els.chart24Empty.hidden = false;
  }

  if (points7.length > 1) {
    const values = points7.map((point) => point.reports_24h);
    chart7 = new window.Chart(els.chart7d.getContext("2d"), {
      type: "line",
      data: {
        labels: points7.map((point) => formatTick(point.t, true)),
        datasets: [
          {
            label: t("ui.analytics.trendSeries"),
            data: values,
            borderColor: "#60a5fa",
            backgroundColor: rgba("#60a5fa", 0.14),
            fill: true,
            tension: 0.24,
            borderWidth: 2,
            pointRadius: 1.6,
            pointHoverRadius: 2.4,
            pointBackgroundColor: points7.map((point) => rgba(SEVERITY_COLORS[point.severity_key] || SEVERITY_COLORS.unknown, 0.95)),
            pointBorderWidth: 0,
          },
          {
            label: t("ui.analytics.avgSeries"),
            data: movingAverage(values, 8),
            borderColor: "#facc15",
            fill: false,
            tension: 0.2,
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 1.6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: chartScales(),
        plugins: {
          legend: {
            labels: { color: "#9caec5", boxWidth: 12, boxHeight: 12 },
          },
          tooltip: tooltipCallbacks((chart, index) => chart.$meta?.[index]),
        },
      },
    });
    chart7.$meta = points7;
    els.chart7Empty.hidden = true;
  } else {
    els.chart7Empty.hidden = false;
  }

  const lastPoint = latestHistory.points[latestHistory.points.length - 1];
  console.info("[ow-radar] history points:", latestHistory.points.length, "last update age:", lastPoint ? relativeFromNow(lastPoint.t) : "unknown", "chart init status:", chart24 || chart7 ? "ready" : "partial");
}

function setActiveTab(tab, persist = true, focus = false) {
  if (!VALID_TABS.includes(tab)) {
    return;
  }
  currentTab = tab;
  for (const button of els.tabButtons) {
    const active = button.dataset.tabTarget === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
    if (active && focus) {
      button.focus();
    }
  }
  for (const panel of els.tabPanels) {
    const active = panel.dataset.tabPanel === tab;
    panel.classList.toggle("active", active);
    if (active) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  }
  if (persist) {
    safeSetLocalStorage(STORAGE_KEYS.tab, tab);
  }
  if (tab === "analytics") {
    initChartsIfNeeded();
  }
}

function setupTabs() {
  for (const button of els.tabButtons) {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget, true, false));
    button.addEventListener("keydown", (event) => {
      const index = els.tabButtons.findIndex((candidate) => candidate === event.currentTarget);
      if (index < 0) {
        return;
      }
      let nextIndex = null;
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % els.tabButtons.length;
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + els.tabButtons.length) % els.tabButtons.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = els.tabButtons.length - 1;
      }
      if (nextIndex === null) {
        return;
      }
      event.preventDefault();
      setActiveTab(els.tabButtons[nextIndex].dataset.tabTarget, true, true);
    });
  }
}

async function loadDashboardData() {
  if (isLoading) {
    return;
  }
  isLoading = true;
  els.refreshBtn.disabled = true;
  try {
    const [statusResult, historyResult] = await Promise.allSettled([
      fetch(`${DATA_URLS.status}?t=${Date.now()}`, { cache: "no-store" }),
      fetch(`${DATA_URLS.history}?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (statusResult.status !== "fulfilled" || !statusResult.value.ok) {
      throw new Error("status fetch failed");
    }
    latestPayload = await statusResult.value.json();

    if (historyResult.status === "fulfilled" && historyResult.value.ok) {
      const historyJson = await historyResult.value.json();
      latestHistory = normalizeHistoryPayload(historyJson);
    } else if (!latestHistory) {
      latestHistory = null;
    }

    render(latestPayload);
    nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;
    updateRefreshEta();
    initChartsIfNeeded();
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
    isLoading = false;
    els.refreshBtn.disabled = false;
  }
}

function toggleLanguage() {
  currentLang = currentLang === "de" ? "en" : "de";
  safeSetLocalStorage(STORAGE_KEYS.lang, currentLang);
  applyStaticTexts();
  if (latestPayload) {
    render(latestPayload);
    initChartsIfNeeded();
  } else {
    renderLoadingState();
  }
  updateRefreshEta();
}

document.addEventListener("DOMContentLoaded", () => {
  applyStaticTexts();
  setupTabs();
  if (els.sortSelect) {
    els.sortSelect.value = sortMode;
    els.sortSelect.addEventListener("change", (event) => {
      sortMode = VALID_SORT_MODES.includes(event.target.value) ? event.target.value : "recent";
      safeSetLocalStorage(STORAGE_KEYS.sort, sortMode);
      if (latestPayload) {
        render(latestPayload);
        initChartsIfNeeded();
      }
    });
  }
  setActiveTab(currentTab, false);
  renderLoadingState();
  loadDashboardData();
  updateRefreshEta();

  els.refreshBtn.addEventListener("click", () => loadDashboardData());
  if (els.languageBtn) {
    els.languageBtn.addEventListener("click", toggleLanguage);
  }

  window.setInterval(() => loadDashboardData(), REFRESH_INTERVAL_MS);
  window.setInterval(updateRefreshEta, 1000);
});
