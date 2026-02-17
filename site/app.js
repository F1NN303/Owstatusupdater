const I18N = {
  en: {
    pageTitle: "Overwatch Service Radar",
    ui: {
      eyebrow: "Live Overwatch Monitor",
      title: "Service Radar",
      refresh: "Refresh now",
      languageAria: "Switch language",
      menu: {
        brand: "Service Radar",
        button: "Menu",
        primary: "Navigation",
        tools: "Tools",
        home: "Dashboard",
        emailAlerts: "Email alerts",
        rss: "RSS feed",
        github: "GitHub",
      },
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
        subscribe: "Email Outage Alerts",
        kpi: "Service KPIs",
        regionSnapshot: "Regional Snapshot",
        sourceReliability: "Source Reliability (7d)",
        known: "Known Resources",
        advanced: "Advanced diagnostics",
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
      kpi: {
        regionHint: "Region scope: {region}",
        uptime24: "Uptime signal (24h)",
        uptime7: "Uptime signal (7d)",
        topSystem: "Top affected system",
        topSystemNone: "None",
        topSystemHintOk: "No subsystem is showing elevated disruption risk right now.",
        topSystemHintWarn: "{system} is showing intermittent risk signals.",
        topSystemHintBad: "{system} is currently showing the strongest disruption signals.",
      },
      regionSnapshot: {
        hint: "Comparing the latest 24h report density across regions.",
        reports: "24h reports",
        deltaUp: "{n} vs 24h ago",
        deltaDown: "{n} vs 24h ago",
        deltaFlat: "No change vs 24h ago",
      },
      sourceReliability: {
        hint: "Reliability is estimated from historical source availability and freshness.",
        score: "Reliability: {pct}",
        sample: "{ok}/{total} healthy polls",
        unavailable: "Not enough source history yet.",
      },
      subscribe: {
        hint: "Get outage updates by email via a secure Brevo form with captcha and double opt-in.",
        loading: "Loading secure signup form...",
        ready: "Secure signup is ready ({provider}).",
        missing: "Signup form is not configured yet. Open the setup guide to connect Brevo.",
        invalid: "Configured signup form URL is invalid. Open the setup guide.",
        openGuide: "Open setup guide",
        openExternal: "Open secure signup in new tab",
        emailLabel: "Email address",
        emailPlaceholder: "you@example.com",
        emailHelp: "Your email is collected on Brevo's secure page.",
        captchaNote: "Captcha and double opt-in are completed in the secure step.",
        cta: "Continue secure signup",
        invalidEmail: "Please enter a valid email address.",
        opening: "Secure signup opened in a new tab.",
        providers: {
          brevo: "Brevo",
          generic: "secure provider",
        },
      },
      impactQuick: {
        stable: "Playable conditions look normal for most players.",
        minor: "Short disruptions are possible for some players.",
        degraded: "Noticeable service issues are likely right now.",
        major: "Widespread disruption is likely across core services.",
        unknown: "Live status confidence is limited at the moment.",
      },
      details: {
        advancedSummary: "Show diagnostics",
        impactSummary: "Show recommendations",
        sourceSummary: "Show source diagnostics",
        howToSummary: "Show guidance",
      },
      sort: {
        label: "Sort by",
        recent: "Most recent",
        impact: "Highest impact",
      },
      incidents: {
        exportCsv: "Export incidents CSV",
        tags: {
          login: "Login",
          matchmaking: "Queue",
          stability: "Stability",
          store: "Store",
          general: "General",
        },
      },
      changes: {
        none: "No incident changes in the latest refresh.",
        summary: "Changes: +{newInc} new, ~{updInc} updated, -{resInc} resolved, +{newRep} new reports",
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
        history: "Not enough history points yet.",
        regionSnapshot: "Regional history is not available yet.",
      },
      csv: {
        noIncidents: "No incidents available to export yet.",
        filenamePrefix: "ow-incidents",
        headers: {
          startedAt: "started_at",
          title: "title",
          duration: "duration",
          acknowledgement: "acknowledgement",
          source: "source_url",
          severity: "severity",
        },
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
        inline: "Confidence: {level}",
        short: {
          high: "High",
          medium: "Medium",
          low: "Low",
          neutral: "--",
        },
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
      trend: {
        improving: "Trend improving",
        stable: "Trend stable",
        worsening: "Trend worsening",
        unknown: "Trend unavailable",
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
      sourceMethod:
        "False-positive guards active: recency decay, operational dampening, and cross-source corroboration.",
      safeguards: {
        prefix: "Safeguards: {list}",
        operational_dampening: "operational dampening",
        cross_source_guard: "cross-source guard",
        low_volume_guard: "low-volume filter",
        major_cap_applied: "major-state cap",
        false_positive_cap_applied: "false-positive cap",
        recency_decay: "recency decay",
      },
      sourceDetails: {
        noSources: "No source diagnostics available.",
        items: "{n} items",
        latency: "{n} ms",
        fetched: "fetched {age}",
        freshness: {
          fresh: "fresh",
          warm: "aging",
          stale: "stale",
          unknown: "unknown",
        },
      },
      relative: {
        now: "just now",
        minute: "{n}m ago",
        hour: "{n}h ago",
        day: "{n}d ago",
      },
      analytics: {
        subtitle7: "Rolling trend from 30-minute points.",
        regionLabel: "Region",
        regions: {
          global: "Global",
          eu: "EU",
          na: "NA",
          apac: "APAC",
        },
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
        baselineSeries: "Baseline",
        anomalyBand: "Expected range",
        tooltip: {
          reports: "Reports (24h)",
          severity: "Severity",
          sources: "Source agreement",
          region: "Region",
        },
      },
      errors: {
        loadJson: "Failed to load status.json. Check GitHub Actions data refresh.",
      },
    },
  },
  de: {
    pageTitle: "Overwatch Service-Radar",
    ui: {
      eyebrow: "Live-Overwatch-Monitor",
      title: "Service-Radar",
      refresh: "Jetzt aktualisieren",
      languageAria: "Sprache wechseln",
      menu: {
        brand: "Service-Radar",
        button: "Menü",
        primary: "Navigation",
        tools: "Tools",
        home: "Dashboard",
        emailAlerts: "E-Mail-Alarme",
        rss: "RSS-Feed",
        github: "GitHub",
      },
      tabs: {
        overview: "Übersicht",
        incidents: "Vorfälle",
        analytics: "Analyse",
      },
      sections: {
        impact: "Das bedeutet aktuell für dich",
        systems: "Möglicherweise betroffene Systeme",
        outage: "Störungsübersicht",
        sourceConfidence: "Quellenvertrauen",
        subscribe: "E-Mail-Störungsalarme",
        kpi: "Service-Kennzahlen",
        regionSnapshot: "Regionenvergleich",
        sourceReliability: "Quellenzuverlässigkeit (7 Tage)",
        known: "Bekannte Ressourcen",
        advanced: "Erweiterte Diagnosen",
        timeline: "Vorfall-Zeitleiste",
        reports: "Statusberichte",
        news: "Offizielle Neuigkeiten",
        social: "Soziale Updates",
        analytics24: "Servicezustand (24h)",
        analytics7: "Trend (7 Tage)",
        howTo: "So liest du diese Seite",
      },
      labels: {
        reports24h: "Meldungen (24h)",
        source: "Quelle: {source}",
      },
      kpi: {
        regionHint: "Region: {region}",
        uptime24: "Stabilitätssignal (24h)",
        uptime7: "Stabilitätssignal (7 Tage)",
        topSystem: "Am stärksten betroffenes System",
        topSystemNone: "Keines",
        topSystemHintOk: "Aktuell zeigt kein Subsystem ein erhöhtes Störungsrisiko.",
        topSystemHintWarn: "{system} zeigt zeitweise Risikosignale.",
        topSystemHintBad: "{system} zeigt derzeit die stärksten Störungssignale.",
      },
      regionSnapshot: {
        hint: "Vergleich der aktuellen 24h-Meldungsdichte über alle Regionen.",
        reports: "Meldungen (24h)",
        deltaUp: "{n} ggü. vor 24h",
        deltaDown: "{n} ggü. vor 24h",
        deltaFlat: "Keine Änderung ggü. vor 24h",
      },
      sourceReliability: {
        hint: "Die Zuverlässigkeit wird aus historischer Quellenverfügbarkeit und Frische geschätzt.",
        score: "Zuverlässigkeit: {pct}",
        sample: "{ok}/{total} erfolgreiche Abfragen",
        unavailable: "Noch nicht genug Quellenverlauf vorhanden.",
      },
      subscribe: {
        hint: "Erhalte Störungsupdates per E-Mail über ein sicheres Brevo-Formular mit Captcha und Double-Opt-In.",
        loading: "Sicheres Anmeldeformular wird geladen...",
        ready: "Sichere Anmeldung ist bereit ({provider}).",
        missing: "Anmeldeformular ist noch nicht konfiguriert. Öffne die Setup-Anleitung für Brevo.",
        invalid: "Die konfigurierte Formular-URL ist ungültig. Öffne die Setup-Anleitung.",
        openGuide: "Setup-Anleitung öffnen",
        openExternal: "Sichere Anmeldung in neuem Tab öffnen",
        emailLabel: "E-Mail-Adresse",
        emailPlaceholder: "du@beispiel.de",
        emailHelp: "Deine E-Mail wird auf der sicheren Brevo-Seite erfasst.",
        captchaNote: "Captcha und Double-Opt-in erfolgen im sicheren Schritt.",
        cta: "Zur sicheren Anmeldung",
        invalidEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
        opening: "Sichere Anmeldung wurde in einem neuen Tab geöffnet.",
        providers: {
          brevo: "Brevo",
          generic: "sicherer Anbieter",
        },
      },
      impactQuick: {
        stable: "Für die meisten Spieler wirkt der Dienst derzeit normal spielbar.",
        minor: "Kurzzeitige Störungen sind für einzelne Spieler möglich.",
        degraded: "Spürbare Serviceprobleme sind aktuell wahrscheinlich.",
        major: "In zentralen Diensten sind derzeit größere Störungen wahrscheinlich.",
        unknown: "Die Live-Einschätzung ist aktuell nur eingeschränkt belastbar.",
      },
      details: {
        advancedSummary: "Diagnose anzeigen",
        impactSummary: "Empfehlungen anzeigen",
        sourceSummary: "Quelldiagnose anzeigen",
        howToSummary: "Hinweise anzeigen",
      },
      sort: {
        label: "Sortieren nach",
        recent: "Neueste zuerst",
        impact: "Höchste Auswirkung",
      },
      incidents: {
        exportCsv: "Vorfälle als CSV exportieren",
        tags: {
          login: "Login",
          matchmaking: "Warteschlange",
          stability: "Stabilität",
          store: "Shop",
          general: "Allgemein",
        },
      },
      changes: {
        none: "Keine Änderungen seit der letzten Aktualisierung.",
        summary: "Änderungen: +{newInc} neu, ~{updInc} aktualisiert, -{resInc} behoben, +{newRep} neue Meldungen",
      },
      guidance: [
        "Die obere Statuszeile erklärt die erwartete Auswirkung auf Spieler in klarer Sprache.",
        "Der Schweregrad kombiniert Ausfallvolumen, Vorfalltext und Quellenverfügbarkeit.",
        "Das Vertrauen steigt, wenn mehrere unabhängige Quellen übereinstimmen.",
      ],
      footnote:
        "Externe Plattformen können automatisierte Zugriffe drosseln. Dieses Dashboard nutzt stabile öffentliche Quellen und macht deren Qualität transparent.",
      loadingHeadline: "Live-Signale werden gesammelt...",
      loadingMarker: "Status: Live-Telemetrie wird geprüft...",
      loadingImpact: "Warte auf Live-Statusdaten...",
      empty: {
        incidents: "Keine aktuellen Vorfälle gelistet.",
        reports: "Keine Statusmeldungen verfügbar.",
        news: "Keine offiziellen News gefunden.",
        social: "Keine Social-Updates verfügbar.",
        systems: "Keine Systemdaten verfügbar.",
        sourceState: "Keine Quellenlage verfügbar",
        impact: "Keine klare Auswirkungsbeschreibung verfügbar.",
        known: "Derzeit keine bekannten Ressourcen verfügbar.",
        chart24: "Noch keine 24h-Chartdaten verfügbar.",
        chart7: "Noch keine 7d-Trenddaten verfügbar.",
        history: "Noch nicht genug Verlaufsdaten vorhanden.",
        regionSnapshot: "Noch keine Regionsverlaufdaten verfügbar.",
      },
      csv: {
        noIncidents: "Noch keine Vorfälle für den Export verfügbar.",
        filenamePrefix: "ow-vorfaelle",
        headers: {
          startedAt: "started_at",
          title: "titel",
          duration: "dauer",
          acknowledgement: "bestätigung",
          source: "quelle_url",
          severity: "schweregrad",
        },
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
        high: "Vertrauen hoch",
        medium: "Vertrauen mittel",
        low: "Vertrauen niedrig",
        neutral: "Vertrauen --",
        inline: "Vertrauen: {level}",
        short: {
          high: "Hoch",
          medium: "Mittel",
          low: "Niedrig",
          neutral: "--",
        },
        explanation:
          "Quellen-Übereinstimmung: {ratio}. Höhere Übereinstimmung bedeutet höheres Vertrauen in die Einschätzung.",
      },
      severity: {
        stable: "Stabil",
        minor: "Leichte Störung",
        degraded: "Beeinträchtigt",
        major: "Große Störung",
        unknown: "Unklar",
      },
      marker: {
        stable: "Status: Keine Probleme erkannt.",
        minor: "Status: Leichte Störung erkannt.",
        degraded: "Status: Servicequalität reduziert.",
        major: "Status: Deutliche Ausfälle erkannt.",
        unknown: "Status: Aktueller Servicezustand unklar.",
      },
      trend: {
        improving: "Trend verbessert sich",
        stable: "Trend stabil",
        worsening: "Trend verschlechtert sich",
        unknown: "Trend derzeit unklar",
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
          "Die meisten Spieler sollten sich normal anmelden und in die Warteschlange gehen können.",
          "Kurze Aussetzer können zu Stoßzeiten trotzdem auftreten.",
          "Lass diese Seite geöffnet, um schnelle Änderungen sofort zu sehen.",
        ],
        minor: [
          "Einstieg in die Warteschlange und Match-Start können langsamer als üblich sein.",
          "In stark ausgelasteten Regionen kann ein zweiter Login-Versuch nötig sein.",
          "Wenn Probleme bestehen bleiben, warte einige Minuten und versuche es erneut.",
        ],
        degraded: [
          "Login, Matchmaking und Spielbeitritte können zeitweise fehlschlagen.",
          "Latenzspitzen und Disconnects sind wahrscheinlicher als normal.",
          "Vermeide zeitkritische Ranked-Sessions, bis sich die Lage stabilisiert.",
        ],
        major: [
          "Viele Spieler können sich eventuell nicht verbinden oder im Match bleiben.",
          "Warteschlange, Spielstarts und Fortschrittsupdates können unzuverlässig sein.",
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
        matchmaking: "Matchmaking und Warteschlange",
        stability: "Ingame-Stabilität",
        store: "Shop und Belohnungen",
        state: {
          ok: "Unauffällig",
          warn: "Beobachten",
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
      sourceMethod:
        "Schutz gegen Fehlalarme aktiv: zeitliche Abwertung, Dämpfung bei „operational“ und Quellenabgleich.",
      safeguards: {
        prefix: "Schutzmechanismen: {list}",
        operational_dampening: "Dämpfung bei „operational“",
        cross_source_guard: "Quellenabgleich-Schutz",
        low_volume_guard: "Niedrigvolumen-Schutz",
        major_cap_applied: "Kappung für Großstörung",
        false_positive_cap_applied: "Fehlalarm-Kappung",
        recency_decay: "zeitliche Abwertung",
      },
      sourceDetails: {
        noSources: "Keine Quelldiagnosen verfügbar.",
        items: "{n} Einträge",
        latency: "{n} ms",
        fetched: "abgerufen: {age}",
        freshness: {
          fresh: "frisch",
          warm: "älter werdend",
          stale: "veraltet",
          unknown: "unklar",
        },
      },
      relative: {
        now: "gerade eben",
        minute: "vor {n} Min",
        hour: "vor {n} Std",
        day: "vor {n} T",
      },
      analytics: {
        subtitle7: "Rollender Trend aus 30-Minuten-Datenpunkten.",
        regionLabel: "Region",
        regions: {
          global: "Global",
          eu: "EU",
          na: "NA",
          apac: "APAC",
        },
        dataAge: "Datenalter: {age} ({points} Punkte)",
        dataAgeUnknown: "Datenalter: unbekannt",
        legend: {
          stable: "Service verfügbar",
          minor: "Mögliche Störung",
          degraded: "Wahrscheinliche Störung",
          major: "Größere Störung",
        },
        reportsSeries: "Meldungen (24h)",
        trendSeries: "Meldungstrend",
        avgSeries: "Gleitender Mittelwert",
        baselineSeries: "Basislinie",
        anomalyBand: "Erwartungsbereich",
        tooltip: {
          reports: "Meldungen (24h)",
          severity: "Schweregrad",
          sources: "Quellen-Übereinstimmung",
          region: "Region",
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
  menuBrandText: document.getElementById("menuBrandText"),
  menuTrigger: document.getElementById("menuTrigger"),
  menuPanel: document.getElementById("menuPanel"),
  menuButtonText: document.getElementById("menuButtonText"),
  menuPrimaryLabel: document.getElementById("menuPrimaryLabel"),
  menuToolsLabel: document.getElementById("menuToolsLabel"),
  menuHomeLink: document.getElementById("menuHomeLink"),
  menuEmailAlertsLink: document.getElementById("menuEmailAlertsLink"),
  menuRssLink: document.getElementById("menuRssLink"),
  menuGithubLink: document.getElementById("menuGithubLink"),
  eyebrowText: document.getElementById("eyebrowText"),
  titleText: document.getElementById("titleText"),
  severityBadge: document.getElementById("severityBadge"),
  trendBadge: document.getElementById("trendBadge"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  headlineText: document.getElementById("headlineText"),
  statusMarker: document.getElementById("statusMarker"),
  statusMarkerText: document.getElementById("statusMarkerText"),
  statusInlineConfidence: document.getElementById("statusInlineConfidence"),
  generatedAt: document.getElementById("generatedAt"),
  nextRefresh: document.getElementById("nextRefresh"),
  refreshBtn: document.getElementById("refreshBtn"),
  languageBtn: document.getElementById("languageBtn"),
  tabOverviewBtn: document.getElementById("tabOverviewBtn"),
  tabIncidentsBtn: document.getElementById("tabIncidentsBtn"),
  tabAnalyticsBtn: document.getElementById("tabAnalyticsBtn"),
  impactTitle: document.getElementById("impactTitle"),
  impactQuickText: document.getElementById("impactQuickText"),
  advancedDiagnosticsTitle: document.getElementById("advancedDiagnosticsTitle"),
  advancedDiagnosticsToggle: document.getElementById("advancedDiagnosticsToggle"),
  advancedDiagnosticsSummary: document.getElementById("advancedDiagnosticsSummary"),
  impactDetailsToggle: document.getElementById("impactDetailsToggle"),
  impactDetailsSummary: document.getElementById("impactDetailsSummary"),
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
  sourceMethodText: document.getElementById("sourceMethodText"),
  sourceDetailsToggle: document.getElementById("sourceDetailsToggle"),
  sourceDetailsSummary: document.getElementById("sourceDetailsSummary"),
  sourceDetailsList: document.getElementById("sourceDetailsList"),
  subscribeTitle: document.getElementById("subscribeTitle"),
  subscribeHint: document.getElementById("subscribeHint"),
  subscribeWidget: document.getElementById("subscribeWidget"),
  subscribeWidgetText: document.getElementById("subscribeWidgetText"),
  subscribeStateText: document.getElementById("subscribeStateText"),
  subscribeActionLink: document.getElementById("subscribeActionLink"),
  kpiTitle: document.getElementById("kpiTitle"),
  kpiRegionHint: document.getElementById("kpiRegionHint"),
  kpiUptime24Label: document.getElementById("kpiUptime24Label"),
  kpiUptime24Value: document.getElementById("kpiUptime24Value"),
  kpiUptime7Label: document.getElementById("kpiUptime7Label"),
  kpiUptime7Value: document.getElementById("kpiUptime7Value"),
  kpiTopSystemLabel: document.getElementById("kpiTopSystemLabel"),
  kpiTopSystemValue: document.getElementById("kpiTopSystemValue"),
  kpiTopSystemHint: document.getElementById("kpiTopSystemHint"),
  regionSnapshotTitle: document.getElementById("regionSnapshotTitle"),
  regionSnapshotHint: document.getElementById("regionSnapshotHint"),
  regionSnapshotGrid: document.getElementById("regionSnapshotGrid"),
  sourceReliabilityTitle: document.getElementById("sourceReliabilityTitle"),
  sourceReliabilityHint: document.getElementById("sourceReliabilityHint"),
  sourceReliabilityList: document.getElementById("sourceReliabilityList"),
  knownTitle: document.getElementById("knownTitle"),
  knownList: document.getElementById("knownList"),
  changeSummary: document.getElementById("changeSummary"),
  sortLabel: document.getElementById("sortLabel"),
  sortSelect: document.getElementById("sortSelect"),
  exportIncidentsBtn: document.getElementById("exportIncidentsBtn"),
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
  analyticsRegionLabel: document.getElementById("analyticsRegionLabel"),
  analyticsRegionSelect: document.getElementById("analyticsRegionSelect"),
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
  howToDetails: document.getElementById("howToDetails"),
  howToSummary: document.getElementById("howToSummary"),
  guideLine1: document.getElementById("guideLine1"),
  guideLine2: document.getElementById("guideLine2"),
  guideLine3: document.getElementById("guideLine3"),
  footnoteText: document.getElementById("footnoteText"),
};

const REFRESH_INTERVAL_MS = 60_000;
const DATA_URLS = {
  status: "./data/status.json",
  history: "./data/history.json",
  subscription: "./data/subscription.json",
};
const STORAGE_KEYS = {
  lang: "ow_radar_lang",
  tab: "ow_radar_tab",
  sort: "ow_radar_sort",
  analyticsRegion: "ow_radar_analytics_region",
};
const VALID_TABS = ["overview", "incidents", "analytics"];
const VALID_SORT_MODES = ["recent", "impact"];
const VALID_REGIONS = ["global", "eu", "na", "apac"];
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
let latestSubscriptionConfig = null;
let subscriptionConfigLoaded = false;
let currentLang = detectInitialLanguage();
let currentTab = detectInitialTab();
let sortMode = detectInitialSortMode();
let analyticsRegion = detectInitialAnalyticsRegion();
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

function detectInitialAnalyticsRegion() {
  const stored = safeGetLocalStorage(STORAGE_KEYS.analyticsRegion);
  return VALID_REGIONS.includes(stored) ? stored : "global";
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
  const fixes = {
    "Ã¤": "ä",
    "Ã¶": "ö",
    "Ã¼": "ü",
    "Ã„": "Ä",
    "Ã–": "Ö",
    "Ãœ": "Ü",
    "ÃŸ": "ß",
    "â€“": "-",
    "â€”": "-",
    "â€™": "'",
    "â€œ": '"',
    "â€": '"',
    "Â ": " ",
  };
  for (const [broken, repaired] of Object.entries(fixes)) {
    text = text.split(broken).join(repaired);
  }
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

function closeTopNavMenu(focusTrigger = false) {
  if (!els.menuTrigger || !els.menuPanel) {
    return;
  }
  els.menuTrigger.setAttribute("aria-expanded", "false");
  els.menuPanel.hidden = true;
  if (focusTrigger) {
    els.menuTrigger.focus();
  }
}

function openTopNavMenu() {
  if (!els.menuTrigger || !els.menuPanel) {
    return;
  }
  els.menuTrigger.setAttribute("aria-expanded", "true");
  els.menuPanel.hidden = false;
}

function setupTopNavMenu() {
  if (!els.menuTrigger || !els.menuPanel) {
    return;
  }
  closeTopNavMenu(false);

  els.menuTrigger.addEventListener("click", () => {
    const isOpen = els.menuTrigger.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeTopNavMenu(false);
      return;
    }
    openTopNavMenu();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!els.menuPanel.hidden && !els.menuPanel.contains(target) && !els.menuTrigger.contains(target)) {
      closeTopNavMenu(false);
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!els.menuPanel.hidden && !els.menuPanel.contains(target) && !els.menuTrigger.contains(target)) {
      closeTopNavMenu(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTopNavMenu(true);
    }
  });

  for (const link of Array.from(els.menuPanel.querySelectorAll("a"))) {
    link.addEventListener("click", () => closeTopNavMenu(false));
  }
}

function parseHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function isLikelyEmail(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 320) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isAllowedSubscriptionHost(parsedUrl, config) {
  const host = String(parsedUrl?.hostname || "").toLowerCase();
  if (!host) {
    return false;
  }

  const explicitHosts = Array.isArray(config?.allowed_hosts)
    ? config.allowed_hosts.map((item) => String(item || "").toLowerCase().trim()).filter(Boolean)
    : [];
  if (explicitHosts.length) {
    return explicitHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }

  const providerKey = String(config?.provider || "brevo").trim().toLowerCase();
  if (providerKey === "brevo") {
    return host === "sibforms.com" || host.endsWith(".sibforms.com");
  }
  return true;
}

function providerLabel(providerKey) {
  const normalized = String(providerKey || "").trim().toLowerCase();
  if (normalized === "brevo") {
    return t("ui.subscribe.providers.brevo");
  }
  return t("ui.subscribe.providers.generic");
}

function renderSubscribeWidget(config = latestSubscriptionConfig) {
  if (!els.subscribeWidget || !els.subscribeStateText || !els.subscribeActionLink) {
    return;
  }
  if (els.subscribeTitle) {
    els.subscribeTitle.textContent = t("ui.sections.subscribe");
  }
  if (els.subscribeHint) {
    els.subscribeHint.textContent = t("ui.subscribe.hint");
  }
  const guideHref = "./email-alerts.html";
  const rawUrl = String(config?.form_url || "").trim();
  const providerKey = String(config?.provider || "brevo").trim().toLowerCase();
  const provider = providerLabel(providerKey);

  els.subscribeWidget.innerHTML = "";
  if (!subscriptionConfigLoaded) {
    if (els.subscribeWidgetText) {
      els.subscribeWidget.appendChild(els.subscribeWidgetText);
      els.subscribeWidgetText.textContent = t("ui.subscribe.loading");
    }
    els.subscribeStateText.textContent = t("ui.subscribe.loading");
    els.subscribeActionLink.href = guideHref;
    els.subscribeActionLink.target = "_self";
    els.subscribeActionLink.rel = "";
    els.subscribeActionLink.textContent = t("ui.subscribe.openGuide");
    return;
  }

  const parsedUrl = parseHttpsUrl(rawUrl);
  if (!rawUrl) {
    els.subscribeStateText.textContent = t("ui.subscribe.missing");
    els.subscribeActionLink.href = guideHref;
    els.subscribeActionLink.target = "_self";
    els.subscribeActionLink.rel = "";
    els.subscribeActionLink.textContent = t("ui.subscribe.openGuide");
    return;
  }
  if (!parsedUrl) {
    els.subscribeStateText.textContent = t("ui.subscribe.invalid");
    els.subscribeActionLink.href = guideHref;
    els.subscribeActionLink.target = "_self";
    els.subscribeActionLink.rel = "";
    els.subscribeActionLink.textContent = t("ui.subscribe.openGuide");
    return;
  }
  if (!isAllowedSubscriptionHost(parsedUrl, config)) {
    els.subscribeStateText.textContent = t("ui.subscribe.invalid");
    els.subscribeActionLink.href = guideHref;
    els.subscribeActionLink.target = "_self";
    els.subscribeActionLink.rel = "";
    els.subscribeActionLink.textContent = t("ui.subscribe.openGuide");
    return;
  }

  const form = document.createElement("form");
  form.className = "newsletter-shell";
  form.noValidate = true;

  const label = document.createElement("label");
  label.className = "newsletter-label";
  label.setAttribute("for", "subscribeEmailInput");
  label.textContent = t("ui.subscribe.emailLabel");

  const input = document.createElement("input");
  input.className = "newsletter-input";
  input.type = "email";
  input.id = "subscribeEmailInput";
  input.name = "email";
  input.placeholder = t("ui.subscribe.emailPlaceholder");
  input.required = true;
  input.autocomplete = "email";

  const help = document.createElement("p");
  help.className = "newsletter-help";
  help.textContent = t("ui.subscribe.emailHelp");

  const captcha = document.createElement("p");
  captcha.className = "newsletter-note";
  captcha.textContent = t("ui.subscribe.captchaNote");

  const button = document.createElement("button");
  button.className = "newsletter-submit";
  button.type = "submit";
  button.textContent = t("ui.subscribe.cta");

  form.appendChild(label);
  form.appendChild(input);
  form.appendChild(help);
  form.appendChild(captcha);
  form.appendChild(button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = String(input.value || "").trim();
    if (!isLikelyEmail(email)) {
      els.subscribeStateText.textContent = t("ui.subscribe.invalidEmail");
      input.focus();
      return;
    }
    const targetUrl = new URL(parsedUrl.toString());
    targetUrl.searchParams.set("email", email);
    window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
    els.subscribeStateText.textContent = t("ui.subscribe.opening");
  });
  els.subscribeWidget.appendChild(form);

  els.subscribeStateText.textContent = t("ui.subscribe.ready", { provider });
  els.subscribeActionLink.href = parsedUrl.toString();
  els.subscribeActionLink.target = "_blank";
  els.subscribeActionLink.rel = "noreferrer";
  els.subscribeActionLink.textContent = t("ui.subscribe.openExternal");
}

async function loadSubscriptionConfig() {
  if (!els.subscribeWidget) {
    return;
  }
  try {
    const response = await fetch(`${DATA_URLS.subscription}?t=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      latestSubscriptionConfig = await response.json();
    } else {
      latestSubscriptionConfig = null;
    }
  } catch (error) {
    latestSubscriptionConfig = null;
  } finally {
    subscriptionConfigLoaded = true;
    renderSubscribeWidget(latestSubscriptionConfig);
  }
}

function renderChangeSummary(changes) {
  if (!els.changeSummary) {
    return;
  }
  const summary = changes?.summary || {};
  const newInc = clampNumber(summary.new_incidents, 0, 999, 0);
  const updInc = clampNumber(summary.updated_incidents, 0, 999, 0);
  const resInc = clampNumber(summary.resolved_incidents, 0, 999, 0);
  const newRep = clampNumber(summary.new_reports, 0, 999, 0);
  const total = newInc + updInc + resInc + newRep;
  if (total === 0) {
    els.changeSummary.textContent = t("ui.changes.none");
    return;
  }
  els.changeSummary.textContent = t("ui.changes.summary", {
    newInc,
    updInc,
    resInc,
    newRep,
  });
}

function applyMenuTexts() {
  if (els.menuBrandText) {
    els.menuBrandText.textContent = t("ui.menu.brand");
  }
  if (els.menuButtonText) {
    els.menuButtonText.textContent = t("ui.menu.button");
  }
  if (els.menuPrimaryLabel) {
    els.menuPrimaryLabel.textContent = t("ui.menu.primary");
  }
  if (els.menuToolsLabel) {
    els.menuToolsLabel.textContent = t("ui.menu.tools");
  }
  if (els.menuHomeLink) {
    els.menuHomeLink.textContent = t("ui.menu.home");
  }
  if (els.menuEmailAlertsLink) {
    els.menuEmailAlertsLink.textContent = t("ui.menu.emailAlerts");
  }
  if (els.menuRssLink) {
    els.menuRssLink.textContent = t("ui.menu.rss");
  }
  if (els.menuGithubLink) {
    els.menuGithubLink.textContent = t("ui.menu.github");
  }
}

function applyHeroTexts() {
  if (els.eyebrowText) {
    els.eyebrowText.textContent = t("ui.eyebrow");
  }
  if (els.titleText) {
    els.titleText.textContent = t("ui.title");
  }
  if (els.refreshBtn) {
    els.refreshBtn.textContent = t("ui.refresh");
  }
  if (els.tabOverviewBtn) {
    els.tabOverviewBtn.textContent = t("ui.tabs.overview");
  }
  if (els.tabIncidentsBtn) {
    els.tabIncidentsBtn.textContent = t("ui.tabs.incidents");
  }
  if (els.tabAnalyticsBtn) {
    els.tabAnalyticsBtn.textContent = t("ui.tabs.analytics");
  }
}

function applySectionTexts() {
  els.impactTitle.textContent = t("ui.sections.impact");
  if (els.advancedDiagnosticsTitle) {
    els.advancedDiagnosticsTitle.textContent = t("ui.sections.advanced");
  }
  if (els.advancedDiagnosticsSummary) {
    els.advancedDiagnosticsSummary.textContent = t("ui.details.advancedSummary");
  }
  if (els.impactDetailsSummary) {
    els.impactDetailsSummary.textContent = t("ui.details.impactSummary");
  }
  els.systemsTitle.textContent = t("ui.sections.systems");
  els.outageTitle.textContent = t("ui.sections.outage");
  els.reports24hLabel.textContent = t("ui.labels.reports24h");
  els.sourceConfidenceTitle.textContent = t("ui.sections.sourceConfidence");
  if (els.sourceMethodText) {
    els.sourceMethodText.textContent = t("ui.sourceMethod");
  }
  if (els.sourceDetailsSummary) {
    els.sourceDetailsSummary.textContent = t("ui.details.sourceSummary");
  }
  els.kpiTitle.textContent = t("ui.sections.kpi");
  els.kpiUptime24Label.textContent = t("ui.kpi.uptime24");
  els.kpiUptime7Label.textContent = t("ui.kpi.uptime7");
  els.kpiTopSystemLabel.textContent = t("ui.kpi.topSystem");
  if (els.regionSnapshotTitle) {
    els.regionSnapshotTitle.textContent = t("ui.sections.regionSnapshot");
  }
  if (els.regionSnapshotHint) {
    els.regionSnapshotHint.textContent = t("ui.regionSnapshot.hint");
  }
  if (els.sourceReliabilityTitle) {
    els.sourceReliabilityTitle.textContent = t("ui.sections.sourceReliability");
  }
  if (els.sourceReliabilityHint) {
    els.sourceReliabilityHint.textContent = t("ui.sourceReliability.hint");
  }
  els.knownTitle.textContent = t("ui.sections.known");
  els.sortLabel.textContent = t("ui.sort.label");
  if (els.exportIncidentsBtn) {
    els.exportIncidentsBtn.textContent = t("ui.incidents.exportCsv");
  }
  els.timelineTitle.textContent = t("ui.sections.timeline");
  els.reportsTitle.textContent = t("ui.sections.reports");
  els.newsTitle.textContent = t("ui.sections.news");
  els.socialTitle.textContent = t("ui.sections.social");
  els.analytics24Title.textContent = t("ui.sections.analytics24");
  els.analytics7Title.textContent = t("ui.sections.analytics7");
  els.analytics7Subtitle.textContent = t("ui.analytics.subtitle7");
  if (els.analyticsRegionLabel) {
    els.analyticsRegionLabel.textContent = t("ui.analytics.regionLabel");
  }
  if (els.analyticsRegionSelect) {
    for (const option of Array.from(els.analyticsRegionSelect.options)) {
      option.textContent = t(`ui.analytics.regions.${option.value}`);
    }
    els.analyticsRegionSelect.value = analyticsRegion;
  }
  els.legendStable.textContent = t("ui.analytics.legend.stable");
  els.legendMinor.textContent = t("ui.analytics.legend.minor");
  els.legendDegraded.textContent = t("ui.analytics.legend.degraded");
  els.legendMajor.textContent = t("ui.analytics.legend.major");
  els.chart24Empty.textContent = t("ui.empty.chart24");
  els.chart7Empty.textContent = t("ui.empty.chart7");
  els.howToTitle.textContent = t("ui.sections.howTo");
  if (els.howToSummary) {
    els.howToSummary.textContent = t("ui.details.howToSummary");
  }
  const recentOption = els.sortSelect.querySelector('option[value="recent"]');
  const impactOption = els.sortSelect.querySelector('option[value="impact"]');
  if (recentOption) {
    recentOption.textContent = t("ui.sort.recent");
  }
  if (impactOption) {
    impactOption.textContent = t("ui.sort.impact");
  }
}

function applyStaticTexts() {
  document.documentElement.lang = currentLang;
  document.title = t("pageTitle");

  applyMenuTexts();
  applyHeroTexts();
  applySectionTexts();

  const guidance = ta("ui.guidance");
  els.guideLine1.textContent = guidance[0] || "";
  els.guideLine2.textContent = guidance[1] || "";
  els.guideLine3.textContent = guidance[2] || "";
  els.footnoteText.textContent = t("ui.footnote");
  if (!latestPayload) {
    renderChangeSummary(null);
    if (els.impactQuickText) {
      els.impactQuickText.textContent = t("ui.loadingImpact");
    }
    renderRegionSnapshot(null);
    renderSourceReliability(null, null);
  }
  renderSubscribeWidget(latestSubscriptionConfig);

  updateKpis(latestHistory, []);
  updateTrendBadge(latestHistory);
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

function classifyIncidentTag(title) {
  const text = normalizeText(title || "").toLowerCase();
  if (/(login|auth|sign in|cannot connect|unable to connect)/.test(text)) {
    return "login";
  }
  if (/(queue|matchmaking|finding game|game mode)/.test(text)) {
    return "matchmaking";
  }
  if (/(lag|latency|disconnect|server|stability|rubberband)/.test(text)) {
    return "stability";
  }
  if (/(store|shop|reward|battlepass|prism|purchase)/.test(text)) {
    return "store";
  }
  return "general";
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
      const tagKey = classifyIncidentTag(incident.title || "");
      const tagLabel = t(`ui.incidents.tags.${tagKey}`);
      return `
        <li class="feed-item">
          <div class="incident-head">
            <div class="feed-item-title">${title}</div>
            <span class="incident-tag">${escapeHtml(tagLabel)}</span>
          </div>
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
    if (els.sourceDetailsList) {
      els.sourceDetailsList.innerHTML = `<li class="empty">${escapeHtml(t("ui.sourceDetails.noSources"))}</li>`;
    }
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

  if (!els.sourceDetailsList) {
    return;
  }

  els.sourceDetailsList.innerHTML = sources
    .map((source) => {
      const ok = !!source?.ok;
      const pillClass = ok ? "ok" : "bad";
      const pillLabel = ok ? t("ui.sourceChip.ok") : t("ui.sourceChip.failed");
      const name = escapeHtml(normalizeText(source?.name || "Source"));
      const freshnessKey = ["fresh", "warm", "stale", "unknown"].includes(source?.freshness) ? source.freshness : "unknown";
      const freshness = t(`ui.sourceDetails.freshness.${freshnessKey}`);
      const itemCount = clampNumber(source?.item_count, 0, 9999, 0);
      const durationMs = clampNumber(source?.duration_ms, 0, 999_999, 0);
      const fetchedAge = relativeFromNow(source?.fetched_at);
      const ageText = fetchedAge || t("ui.meta.noTimestamp");
      const bits = [
        t("ui.sourceDetails.items", { n: formatNumber(itemCount) }),
        freshness,
        t("ui.sourceDetails.latency", { n: formatNumber(durationMs) }),
        t("ui.sourceDetails.fetched", { age: ageText }),
      ];
      const errorText = source?.error ? `<div class="row-meta error">${escapeHtml(normalizeText(source.error))}</div>` : "";
      return `
        <li class="source-detail-item">
          <div class="row-top">
            <strong>${name}</strong>
            <span class="source-pill ${pillClass}">${escapeHtml(pillLabel)}</span>
          </div>
          <div class="row-meta">${escapeHtml(bits.join(" | "))}</div>
          ${errorText}
        </li>
      `;
    })
    .join("");
}

function updateSourceMethod(analytics) {
  if (!els.sourceMethodText) {
    return;
  }
  const safeguards = analytics?.safeguards && typeof analytics.safeguards === "object" ? analytics.safeguards : null;
  if (!safeguards) {
    els.sourceMethodText.textContent = t("ui.sourceMethod");
    return;
  }
  const active = Object.entries(safeguards)
    .filter((entry) => entry[1])
    .map((entry) => t(`ui.safeguards.${entry[0]}`))
    .filter((label) => !label.startsWith("ui.safeguards."));
  if (!active.length) {
    els.sourceMethodText.textContent = t("ui.sourceMethod");
    return;
  }
  els.sourceMethodText.textContent = t("ui.safeguards.prefix", { list: active.join(", ") });
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

function setDetailOpenState(element, open) {
  if (!element || element.dataset.userInteracted === "1") {
    return;
  }
  element.open = !!open;
}

function applyDetailDefaults(severityKey, confidenceKey) {
  setDetailOpenState(els.impactDetailsToggle, severityKey === "major" || severityKey === "degraded" || severityKey === "unknown");
  setDetailOpenState(els.sourceDetailsToggle, confidenceKey === "low");
  setDetailOpenState(els.howToDetails, false);
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

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return `${value.toLocaleString(currentLang === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function computeUptimeMetrics(history, region) {
  const points = selectRegionPoints(history?.points || [], region);
  const evaluate = (sample) => {
    if (!sample.length) {
      return { value: null, count: 0 };
    }
    const healthy = sample.filter((point) => point.severity_key === "stable" || point.severity_key === "minor").length;
    return { value: (healthy / sample.length) * 100, count: sample.length };
  };
  return {
    last24h: evaluate(points.slice(-48)),
    last7d: evaluate(points.slice(-336)),
  };
}

function topSystemState(systems) {
  if (!Array.isArray(systems) || !systems.length) {
    return { key: null, state: "ok" };
  }
  const rank = { ok: 0, warn: 1, bad: 2 };
  const sorted = [...systems].sort((left, right) => (rank[right.state] || 0) - (rank[left.state] || 0));
  const top = sorted[0];
  if (!top || top.state === "ok") {
    return { key: null, state: "ok" };
  }
  return { key: top.key, state: top.state };
}

function updateKpis(history, systems) {
  if (!els.kpiRegionHint) {
    return;
  }
  const regionLabel = t(`ui.analytics.regions.${analyticsRegion}`);
  els.kpiRegionHint.textContent = t("ui.kpi.regionHint", { region: regionLabel });

  const metrics = computeUptimeMetrics(history, analyticsRegion);
  els.kpiUptime24Value.textContent = formatPercent(metrics.last24h.value);
  els.kpiUptime7Value.textContent = formatPercent(metrics.last7d.value);

  const top = topSystemState(systems);
  if (!top.key) {
    els.kpiTopSystemValue.textContent = t("ui.kpi.topSystemNone");
    els.kpiTopSystemHint.textContent =
      metrics.last24h.count || metrics.last7d.count ? t("ui.kpi.topSystemHintOk") : t("ui.empty.history");
    return;
  }

  const systemName = t(`ui.systems.${top.key}`);
  els.kpiTopSystemValue.textContent = systemName;
  if (top.state === "bad") {
    els.kpiTopSystemHint.textContent = t("ui.kpi.topSystemHintBad", { system: systemName });
  } else {
    els.kpiTopSystemHint.textContent = t("ui.kpi.topSystemHintWarn", { system: systemName });
  }
}

function renderRegionSnapshot(history) {
  if (!els.regionSnapshotGrid) {
    return;
  }
  const points = history?.points || [];
  if (!points.length) {
    els.regionSnapshotGrid.innerHTML = `<p class="empty">${escapeHtml(t("ui.empty.regionSnapshot"))}</p>`;
    return;
  }

  const latestPoint = points[points.length - 1];
  const baselineIndex = points.length > 48 ? points.length - 49 : 0;
  const baselinePoint = points[baselineIndex] || latestPoint;

  const tiles = VALID_REGIONS.map((region) => {
    const latest = mapHistoryPointForRegion(latestPoint, region);
    const baseline = mapHistoryPointForRegion(baselinePoint, region);
    const delta = latest.reports_24h - baseline.reports_24h;
    let deltaText = t("ui.regionSnapshot.deltaFlat");
    if (delta > 0) {
      deltaText = t("ui.regionSnapshot.deltaUp", { n: `+${formatNumber(delta)}` });
    } else if (delta < 0) {
      deltaText = t("ui.regionSnapshot.deltaDown", { n: formatNumber(delta) });
    }
    const regionLabel = t(`ui.analytics.regions.${region}`);
    const severityLabel = t(`ui.severity.${latest.severity_key}`);
    return `
      <article class="region-tile">
        <div class="region-head">
          <span class="region-name">${escapeHtml(regionLabel)}</span>
          <span class="badge sev-${escapeHtml(latest.severity_key)}">${escapeHtml(severityLabel)}</span>
        </div>
        <div class="region-reports">${escapeHtml(formatNumber(latest.reports_24h))}</div>
        <div class="row-meta">${escapeHtml(t("ui.regionSnapshot.reports"))}</div>
        <div class="region-trend">${escapeHtml(deltaText)}</div>
      </article>
    `;
  });

  els.regionSnapshotGrid.innerHTML = tiles.join("");
}

function computeSourceReliabilityRows(history, payload) {
  const points = (history?.points || []).slice(-336);
  const aggregates = new Map();

  for (const point of points) {
    const sourceStates = point?.source_states || {};
    for (const [name, state] of Object.entries(sourceStates)) {
      if (!aggregates.has(name)) {
        aggregates.set(name, { ok: 0, total: 0, stale: 0, warm: 0 });
      }
      const agg = aggregates.get(name);
      agg.total += 1;
      if (state?.ok) {
        agg.ok += 1;
      }
      if (state?.freshness === "stale") {
        agg.stale += 1;
      } else if (state?.freshness === "warm") {
        agg.warm += 1;
      }
    }
  }

  if (!aggregates.size && Array.isArray(payload?.sources)) {
    for (const source of payload.sources) {
      const name = normalizeText(source?.name || "");
      if (!name) {
        continue;
      }
      aggregates.set(name, { ok: source?.ok ? 1 : 0, total: 1, stale: 0, warm: 0 });
    }
  }

  const rows = [...aggregates.entries()].map(([name, agg]) => {
    if (!agg.total) {
      return null;
    }
    const okRatio = agg.ok / agg.total;
    const stalePenalty = (agg.stale / agg.total) * 8;
    const warmPenalty = (agg.warm / agg.total) * 3;
    const score = Math.max(Math.min((okRatio * 100) - stalePenalty - warmPenalty, 100), 0);
    const tone = score >= 85 ? "high" : score >= 65 ? "medium" : "low";
    return {
      name,
      ok: agg.ok,
      total: agg.total,
      score,
      tone,
    };
  }).filter(Boolean);

  rows.sort((left, right) => right.score - left.score || right.total - left.total || left.name.localeCompare(right.name));
  return rows;
}

function renderSourceReliability(history, payload) {
  if (!els.sourceReliabilityList) {
    return;
  }
  const rows = computeSourceReliabilityRows(history, payload);
  if (!rows.length) {
    els.sourceReliabilityList.innerHTML = `<li class="empty">${escapeHtml(t("ui.sourceReliability.unavailable"))}</li>`;
    return;
  }
  els.sourceReliabilityList.innerHTML = rows
    .slice(0, 6)
    .map((row) => {
      const scoreText = t("ui.sourceReliability.score", { pct: formatPercent(row.score) });
      const sampleText = t("ui.sourceReliability.sample", {
        ok: formatNumber(row.ok),
        total: formatNumber(row.total),
      });
      return `
        <li class="source-reliability-item">
          <div class="row-main">
            <span class="source-name">${escapeHtml(row.name)}</span>
            <span class="score score-${escapeHtml(row.tone)}">${escapeHtml(scoreText)}</span>
          </div>
          <div class="row-meta">${escapeHtml(sampleText)}</div>
        </li>
      `;
    })
    .join("");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportIncidentsCsv() {
  const incidents = sortByDate(latestPayload?.outage?.incidents || [], "started_at");
  if (!incidents.length) {
    if (els.changeSummary) {
      els.changeSummary.textContent = t("ui.csv.noIncidents");
    }
    return;
  }
  const severityKey = computeSeverity(latestPayload).key;
  const sourceUrl = String(latestPayload?.outage?.url || "");
  const rows = [];
  rows.push(
    [
      t("ui.csv.headers.startedAt"),
      t("ui.csv.headers.title"),
      t("ui.csv.headers.duration"),
      t("ui.csv.headers.acknowledgement"),
      t("ui.csv.headers.source"),
      t("ui.csv.headers.severity"),
    ].join(",")
  );
  for (const incident of incidents) {
    rows.push(
      [
        csvCell(incident.started_at || ""),
        csvCell(normalizeText(incident.title || "")),
        csvCell(normalizeText(incident.duration || "")),
        csvCell(normalizeText(incident.acknowledgement || "")),
        csvCell(sourceUrl),
        csvCell(severityKey),
      ].join(",")
    );
  }

  const csv = `${rows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
  const fileName = `${t("ui.csv.filenamePrefix")}-${stamp}.csv`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
  if (els.statusInlineConfidence) {
    const confidenceShort = t(`ui.confidence.short.${confidence.key}`);
    els.statusInlineConfidence.textContent = t("ui.confidence.inline", { level: confidenceShort });
  }
  els.headlineText.textContent = t(`ui.headlines.${severity.key}`);
  if (els.impactQuickText) {
    els.impactQuickText.textContent = t(`ui.impactQuick.${severity.key}`);
  }

  renderImpactList(ta(`ui.impacts.${severity.key}`));
  renderSystems(systems);
  updateKpis(latestHistory, systems);
  renderRegionSnapshot(latestHistory);
  renderSourceReliability(latestHistory, data);
  applyDetailDefaults(severity.key, confidence.key);

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
  updateSourceMethod(data?.analytics || null);
  renderChangeSummary(data?.changes);

  const ratioText = confidence.total ? `${confidence.ok}/${confidence.total}` : "--";
  els.sourceConfidenceText.textContent = t("ui.confidence.explanation", { ratio: ratioText });
}

function renderLoadingState() {
  els.severityBadge.textContent = t("ui.severity.unknown");
  els.severityBadge.className = "badge sev-unknown";
  if (els.trendBadge) {
    els.trendBadge.textContent = t("ui.trend.unknown");
    els.trendBadge.className = "badge trend-neutral";
  }
  els.confidenceBadge.textContent = t("ui.confidence.neutral");
  els.confidenceBadge.className = "badge conf-neutral";
  els.statusMarker.className = "status-marker marker-unknown";
  els.statusMarkerText.textContent = t("ui.loadingMarker");
  if (els.statusInlineConfidence) {
    const confidenceShort = t("ui.confidence.short.neutral");
    els.statusInlineConfidence.textContent = t("ui.confidence.inline", { level: confidenceShort });
  }
  els.headlineText.textContent = t("ui.loadingHeadline");
  if (els.impactQuickText) {
    els.impactQuickText.textContent = t("ui.loadingImpact");
  }
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
  updateSourceMethod(null);
  updateKpis(null, []);
  renderRegionSnapshot(null);
  renderSourceReliability(null, null);
  renderChangeSummary(null);
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
    const sourceStates = {};
    const rawSourceStates = point?.source_states && typeof point.source_states === "object" ? point.source_states : {};
    for (const [sourceName, state] of Object.entries(rawSourceStates)) {
      if (!sourceName || !state || typeof state !== "object") {
        continue;
      }
      const freshness = ["fresh", "warm", "stale", "unknown"].includes(state?.freshness) ? state.freshness : "unknown";
      sourceStates[sourceName] = {
        ok: !!state?.ok,
        freshness,
        item_count: clampNumber(state?.item_count, 0, 9999, 0),
        kind: normalizeText(state?.kind || "unknown"),
      };
    }
    const regions = {};
    const rawRegions = point?.regions && typeof point.regions === "object" ? point.regions : {};
    for (const [regionKey, regionValue] of Object.entries(rawRegions)) {
      if (!VALID_REGIONS.includes(regionKey) || !regionValue || typeof regionValue !== "object") {
        continue;
      }
      const regionSeverity = VALID_SEVERITY.includes(regionValue?.severity_key) ? regionValue.severity_key : severityKey;
      regions[regionKey] = {
        reports_24h: clampNumber(regionValue?.reports_24h, 0, 999_999, 0),
        severity_key: regionSeverity,
        severity_score: clampNumber(regionValue?.severity_score, 0, 999, 0),
        report_weight: clampNumber(regionValue?.report_weight, 0, 1, 0),
      };
    }
    if (!regions.global) {
      regions.global = {
        reports_24h: clampNumber(point?.reports_24h, 0, 999_999, 0),
        severity_key: severityKey,
        severity_score: clampNumber(point?.severity_score, 0, 999, 0),
        report_weight: 1,
      };
    }
    byTimestamp.set(tIso, {
      t: tIso,
      reports_24h: clampNumber(point?.reports_24h, 0, 999_999, 0),
      severity_key: severityKey,
      severity_score: clampNumber(point?.severity_score, 0, 999, 0),
      source_ok: sourceOk,
      source_total: sourceTotal,
      regions,
      source_states: sourceStates,
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

function severityRank(key) {
  if (key === "major") {
    return 3;
  }
  if (key === "degraded") {
    return 2;
  }
  if (key === "minor") {
    return 1;
  }
  if (key === "stable") {
    return 0;
  }
  return 1.5;
}

function getRegionSnapshot(point, region) {
  const globalSnapshot = point?.regions?.global || {
    reports_24h: clampNumber(point?.reports_24h, 0, 999_999, 0),
    severity_key: VALID_SEVERITY.includes(point?.severity_key) ? point.severity_key : "unknown",
    severity_score: clampNumber(point?.severity_score, 0, 999, 0),
    report_weight: 1,
  };
  if (region === "global") {
    return globalSnapshot;
  }
  const regionSnapshot = point?.regions?.[region];
  if (!regionSnapshot || typeof regionSnapshot !== "object") {
    return globalSnapshot;
  }
  return {
    reports_24h: clampNumber(regionSnapshot.reports_24h, 0, 999_999, globalSnapshot.reports_24h),
    severity_key: VALID_SEVERITY.includes(regionSnapshot.severity_key) ? regionSnapshot.severity_key : globalSnapshot.severity_key,
    severity_score: clampNumber(regionSnapshot.severity_score, 0, 999, globalSnapshot.severity_score),
    report_weight: clampNumber(regionSnapshot.report_weight, 0, 1, globalSnapshot.report_weight),
  };
}

function mapHistoryPointForRegion(point, region) {
  const snapshot = getRegionSnapshot(point, region);
  return {
    t: point?.t,
    region,
    reports_24h: snapshot.reports_24h,
    severity_key: snapshot.severity_key,
    severity_score: snapshot.severity_score,
    source_ok: clampNumber(point?.source_ok, 0, 999, 0),
    source_total: clampNumber(point?.source_total, 0, 999, 0),
  };
}

function selectRegionPoints(points, region) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points.map((point) => mapHistoryPointForRegion(point, region));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function computeTrendState(points, region) {
  const regionPoints = selectRegionPoints(points, region).filter((point) => point && Number.isFinite(point.reports_24h));
  if (regionPoints.length < 12) {
    return "unknown";
  }
  const recent = regionPoints.slice(-12);
  const prior = regionPoints.slice(-24, -12);
  if (!prior.length) {
    return "unknown";
  }
  const recentAvg = average(recent.map((point) => point.reports_24h));
  const priorAvg = average(prior.map((point) => point.reports_24h));
  const recentSeverity = average(recent.map((point) => severityRank(point.severity_key)));
  const priorSeverity = average(prior.map((point) => severityRank(point.severity_key)));
  const reportRatio = (recentAvg - priorAvg) / Math.max(priorAvg, 100);
  const severityDelta = recentSeverity - priorSeverity;

  if (reportRatio >= 0.22 || severityDelta >= 0.42) {
    return "worsening";
  }
  if (reportRatio <= -0.22 || severityDelta <= -0.42) {
    return "improving";
  }
  return "stable";
}

function updateTrendBadge(history) {
  if (!els.trendBadge) {
    return;
  }
  const trendState = computeTrendState(history?.points || [], analyticsRegion);
  const classMap = {
    improving: "trend-improving",
    stable: "trend-stable",
    worsening: "trend-worsening",
    unknown: "trend-neutral",
  };
  els.trendBadge.className = `badge ${classMap[trendState] || "trend-neutral"}`;
  els.trendBadge.textContent = t(`ui.trend.${trendState}`);
}

function buildAnomalyBand(values, baselineWindow = 24, spreadWindow = 24) {
  const baseline = movingAverage(values, baselineWindow);
  const residual = values.map((value, index) => Math.abs(value - baseline[index]));
  const spread = movingAverage(residual, spreadWindow).map((value) => Math.max(value, 12));
  const lower = baseline.map((value, index) => Math.max(value - spread[index], 0));
  const upper = baseline.map((value, index) => value + spread[index]);
  return { baseline, lower, upper };
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
      const regionLabel = t(`ui.analytics.regions.${point.region || "global"}`);
      return [
        `${t("ui.analytics.tooltip.severity")}: ${t(`ui.severity.${point.severity_key}`)}`,
        `${t("ui.analytics.tooltip.sources")}: ${ratio}`,
        `${t("ui.analytics.tooltip.region")}: ${regionLabel}`,
      ];
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
  if (els.analyticsRegionSelect && els.analyticsRegionSelect.value !== analyticsRegion) {
    els.analyticsRegionSelect.value = analyticsRegion;
  }
  if (typeof window.Chart === "undefined" || !latestHistory?.points?.length) {
    destroyCharts();
    els.chart24Empty.hidden = false;
    els.chart7Empty.hidden = false;
    console.info("[ow-radar] history points:", latestHistory?.points?.length || 0, "region:", analyticsRegion, "chart init status:", "empty");
    return;
  }

  const raw24 = latestHistory.points.slice(-48);
  const raw7 = latestHistory.points.slice(-336);
  const points24 = selectRegionPoints(raw24, analyticsRegion);
  const points7 = selectRegionPoints(raw7, analyticsRegion);
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
          tooltip: {
            callbacks: tooltipCallbacks((chart, index) => chart.$meta?.[index]),
          },
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
    const rolling = movingAverage(values, 8);
    const { baseline, lower, upper } = buildAnomalyBand(values, 24, 24);
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
            data: rolling,
            borderColor: "#facc15",
            fill: false,
            tension: 0.2,
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 1.6,
          },
          {
            label: t("ui.analytics.baselineSeries"),
            data: baseline,
            borderColor: "#67e8f9",
            fill: false,
            tension: 0.18,
            borderDash: [3, 4],
            pointRadius: 0,
            borderWidth: 1.4,
          },
          {
            label: "_lowerBand",
            data: lower,
            borderColor: "rgba(0, 0, 0, 0)",
            backgroundColor: "rgba(0, 0, 0, 0)",
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 0,
            skipLegend: true,
            skipTooltip: true,
          },
          {
            label: t("ui.analytics.anomalyBand"),
            data: upper,
            borderColor: "rgba(0, 0, 0, 0)",
            backgroundColor: rgba("#38bdf8", 0.1),
            fill: "-1",
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 0,
            skipTooltip: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        scales: chartScales(),
        plugins: {
          legend: {
            labels: {
              color: "#9caec5",
              boxWidth: 12,
              boxHeight: 12,
              filter(item, data) {
                const dataset = data?.datasets?.[item.datasetIndex];
                return !dataset?.skipLegend;
              },
            },
          },
          tooltip: {
            filter(context) {
              const dataset = context?.dataset || {};
              return !dataset.skipTooltip && context.datasetIndex === 0;
            },
            callbacks: tooltipCallbacks((chart, index) => chart.$meta?.[index]),
          },
        },
      },
    });
    chart7.$meta = points7;
    els.chart7Empty.hidden = true;
  } else {
    els.chart7Empty.hidden = false;
  }

  const lastPoint = latestHistory.points[latestHistory.points.length - 1];
  console.info(
    "[ow-radar] history points:",
    latestHistory.points.length,
    "region:",
    analyticsRegion,
    "last update age:",
    lastPoint ? relativeFromNow(lastPoint.t) : "unknown",
    "chart init status:",
    chart24 || chart7 ? "ready" : "partial"
  );
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
    updateTrendBadge(latestHistory);
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
    if (els.statusInlineConfidence) {
      const confidenceShort = t("ui.confidence.short.low");
      els.statusInlineConfidence.textContent = t("ui.confidence.inline", { level: confidenceShort });
    }
    els.headlineText.textContent = t("ui.headlines.unknown");
    if (els.impactQuickText) {
      els.impactQuickText.textContent = t("ui.impactQuick.unknown");
    }
    renderImpactList(ta("ui.impacts.unknown"));
    els.generatedAt.textContent = t("ui.meta.fetchFailed");
    els.nextRefresh.textContent = t("ui.meta.nextRefreshError");
    els.outageSummary.textContent = t("ui.errors.loadJson");
    updateTrendBadge(latestHistory);
    updateKpis(latestHistory, []);
    renderRegionSnapshot(latestHistory);
    renderSourceReliability(latestHistory, null);
    renderChangeSummary(null);
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
  setupTopNavMenu();
  setupTabs();
  loadSubscriptionConfig();
  for (const toggle of [els.advancedDiagnosticsToggle, els.impactDetailsToggle, els.sourceDetailsToggle, els.howToDetails]) {
    if (!toggle) {
      continue;
    }
    toggle.addEventListener("toggle", () => {
      toggle.dataset.userInteracted = "1";
    });
  }
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
  if (els.analyticsRegionSelect) {
    els.analyticsRegionSelect.value = analyticsRegion;
    els.analyticsRegionSelect.addEventListener("change", (event) => {
      const selected = String(event.target.value || "").toLowerCase();
      analyticsRegion = VALID_REGIONS.includes(selected) ? selected : "global";
      safeSetLocalStorage(STORAGE_KEYS.analyticsRegion, analyticsRegion);
      updateTrendBadge(latestHistory);
      if (latestPayload) {
        const severity = computeSeverity(latestPayload);
        const systems = detectSystems(latestPayload, severity.key);
        updateKpis(latestHistory, systems);
      } else {
        updateKpis(latestHistory, []);
      }
      if (currentTab === "analytics") {
        initChartsIfNeeded();
      }
    });
  }
  if (els.exportIncidentsBtn) {
    els.exportIncidentsBtn.addEventListener("click", exportIncidentsCsv);
  }
  setActiveTab(currentTab, false);
  renderLoadingState();
  loadDashboardData();
  updateRefreshEta();

  if (els.refreshBtn) {
    els.refreshBtn.addEventListener("click", () => loadDashboardData());
  }
  if (els.languageBtn) {
    els.languageBtn.addEventListener("click", toggleLanguage);
  }

  window.setInterval(() => loadDashboardData(), REFRESH_INTERVAL_MS);
  window.setInterval(updateRefreshEta, 1000);
});
