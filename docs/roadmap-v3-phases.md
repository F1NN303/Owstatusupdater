# Overwatch Radar v3 - Phased Implementation Plan

## Scope
This plan implements all pending features:
- Regional status split (`EU`, `NA`, `APAC`)
- Alert subscriptions (browser + Discord/Telegram webhooks)
- Incident change detection (`new`, `updated`, `resolved`)
- Trend badges (`Improving`, `Stable`, `Worsening`)
- Analytics overlays (baseline + anomaly band)
- Official signal channel (separate from community sources)
- Public machine-readable feed (`summary.json` + RSS)
- Mobile quick-view mode

## Phase 1 - Data Model and Source Foundations
### Goal
Establish stable data contracts and source layering needed by all later phases.

### Deliverables
- Extend `site/data/status.json` with per-region status block:
  - `regions.eu`, `regions.na`, `regions.apac`
  - each with `severity_key`, `severity_score`, `report_weight`
- Add official-signal section:
  - `official.updates[]` (Blizzard forum blue-post/official update links)
  - `official.last_statement_at`
- Add public compact feed:
  - `site/data/summary.json`
  - `site/data/rss.xml`
- Keep strict fallback behavior on partial fetch failures.

### Implementation Areas
- `services/ow_aggregator.py`
- `scripts/build_site_data.py`
- `.github/workflows/update-site-data.yml`

### Acceptance Criteria
- Data files generate without schema breaks.
- Existing UI still renders if new fields are missing.
- `summary.json` and `rss.xml` update on each successful run.

## Phase 2 - Incident Intelligence and Alerts
### Goal
Make incident status changes explicit and actionable.

### Deliverables
- Change detection engine:
  - computes `new`, `updated`, `resolved` incident states between snapshots
  - stores lightweight state in `site/data/state.json`
- Alert triggers on severity transitions and major incident deltas.
- Browser notification support (user opt-in).
- Webhook relay payload generation for:
  - Discord
  - Telegram

### Implementation Areas
- `scripts/build_site_data.py`
- `site/app.js`
- `site/data/*.json` contracts

### Acceptance Criteria
- Users can see new/resolved status in incidents view.
- Alert noise is rate-limited.
- No alerts fire from unchanged snapshots.

## Phase 3 - Advanced Analytics and Trend Semantics
### Goal
Improve signal confidence and explain trend direction.

### Deliverables
- Add trend badge near top status:
  - `Improving`
  - `Stable`
  - `Worsening`
- Analytics chart overlays:
  - rolling baseline
  - anomaly band (dynamic threshold)
- Add region selector for charts (Global/EU/NA/APAC).

### Implementation Areas
- `site/app.js`
- `site/styles.css`
- `site/data/history.json` point enrichment

### Acceptance Criteria
- Badge reflects last 2h/6h slope reliably.
- Charts stay readable on sparse and dense history.
- Legend and badge color semantics remain consistent.

## Phase 4 - UX Hardening and Mobile Quick View
### Goal
Improve usability on mobile and fast-glance workflows.

### Deliverables
- Mobile quick-view mode:
  - compact status header
  - swipe/tab shortcut
  - condensed incident cards
- Quick filters:
  - `All`, `Official`, `Community`, `High impact`
- Final accessibility pass:
  - keyboard
  - contrast
  - screen-reader labels

### Implementation Areas
- `site/index.html`
- `site/styles.css`
- `site/app.js`

### Acceptance Criteria
- Core state readable in under 5 seconds on mobile.
- No layout breakpoints cause clipped cards or controls.
- Lighthouse accessibility score remains high.

## Release Strategy
- Phase 1 and 2 behind incremental commits on `main` with GitHub Pages deploy checks.
- Phase 3 enabled after at least 7 days of history accumulation.
- Phase 4 final polish and release tagging.

## Operational Notes
- Cadence remains every 30 minutes.
- Retention remains 30 days unless explicitly changed.
- New fields must be additive and backward-compatible for static pages.
