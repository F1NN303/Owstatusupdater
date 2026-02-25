# Agent Handoff

Last updated: 2026-02-25
Current branch: `main`
Latest known commit at handoff update: `3246472`

## Purpose
This file is the persistent handoff for future agents. It captures the current project state, recent major changes, deployment behavior, known issues, and the recommended next steps.

## Current Live Architecture (Important)
- Public site is now React-first at project root:
  - `https://f1nn303.github.io/Owstatusupdater/`
- React preview copy is still published at:
  - `https://f1nn303.github.io/Owstatusupdater/next/`
- Legacy pages are preserved as fallbacks (not primary UI):
  - `site/legacy-home.html`
  - `site/legacy-overwatch.html`
  - `site/sony/legacy-index.html`
- Public entry pages route into React:
  - `site/index.html` -> React app
  - `site/overwatch.html` -> React route wrapper
  - `site/sony/index.html` -> React route wrapper

## Build / Deploy Model (Changed)
- React artifacts for root and `/next` are built in CI, not manually committed as part of normal UI work.
- CI injects build metadata (commit SHA) so footer version should match deployed commit.
- Relevant files:
  - `.github/workflows/deploy-pages.yml`
  - `scripts/build_react_artifacts.py`
  - `scripts/verify_next_preview_artifact.py`
  - `react-next/vite.config.ts`

## Data Pipeline / Reliability State

### Runtime State Privacy (Important)
- Runtime workflow state is intended to persist via GitHub Actions cache (`.bot_state` path), not via tracked files in the public repo.
- `.bot_state/*` should not be committed.
- Public exposure checks are enforced in workflows via `scripts/check_public_exposure.py`.

### Overwatch
- Primary outage source: StatusGator
- Secondary outage/report fallback: IsDown
- Cached outage fallback is implemented to preserve outage data if StatusGator fails temporarily.
- `StatusGator top reported issues` are parsed and shown in UI.
- `StatusGator service health (24h)` series is parsed and shown as a real source-backed chart (not fake latency).
- Fallback source unavailability is shown in UI with a red marker/badge.

Key files:
- `services/ow_aggregator.py`
- `scripts/build_site_data.py`
- `react-next/src/pages/ServerDetail.tsx`
- `react-next/src/lib/legacyServiceDetail.ts`

### Sony PSN
- Fixed stale historical Sony rows being counted as active incidents.
- Sony issue labels now have improved visibility using official feed-derived top issue labels (historical/active context aware).

Key file:
- `services/sony_aggregator.py`

### Freshness / Scheduling
- UI shows stale-data warning if payload age exceeds threshold.
- Watchdog workflow auto-triggers data refresh if data gets stale.

Key files:
- `scripts/watch_data_freshness.py`
- `.github/workflows/watch-data-freshness.yml`

## Security State (Recent Audit)
- Public internal state files were removed from public site paths and moved to `.bot_state/`.
- `.bot_state` persistence is now workflow-cache based and should not be tracked in Git.
- Public `state.json` endpoints should no longer be exposed.
- React runtime dependency vulnerabilities were cleaned up (runtime `npm audit --omit=dev` was brought to zero at the time of fix).

Key files:
- `scripts/build_site_data.py`
- `scripts/send_brevo_major_alert.py`
- `.github/workflows/update-site-data.yml`
- `.github/workflows/send-test-email.yml`
- `react-next/package.json`

## UI State (React)

### Mobile / Detail Pages
- Detail pages use compact tabbed sections:
  - `Overview`, `Incidents`, `Analysis`, `Sources`
- Liquid-glass style tab switcher is implemented with swipe support and pixel-measured indicator positioning.
- Multiple mobile spacing passes were applied to reduce wasted space.
- Source unavailable markers (red badge) are shown when source health is partial.
- `API` vs `Derived` badges are shown on metrics/charts for data transparency.

Key file:
- `react-next/src/pages/ServerDetail.tsx`

### Home
- Uses uploaded design style + live JSON-backed status cards for Overwatch / Sony.
- No fake fallback cards are shown on API failure.

Key file:
- `react-next/src/pages/Index.tsx`

### Settings
- Cleaned up to user-facing controls only:
  - language
  - reduced motion
  - notifications shortcut
  - about/version
- Internal migration/planning/legacy links removed from user-facing settings UI.
- Added public-facing `Terms & Ownership` link.

Key file:
- `react-next/src/pages/SettingsPage.tsx`

### Alerts / Newsletter
- React Alerts page now embeds the Brevo signup form inline (iframe) using `subscription.json`.
- Includes config validation and fallback direct-link button if embed loading is slow or blocked.

Key files:
- `react-next/src/pages/EmailAlerts.tsx`
- `react-next/src/lib/legacySubscription.ts`
- `site/data/subscription.json`

### Legal / Ownership UI
- Public in-app legal page is available at `/terms`.
- Shared footer link to `Terms & Ownership` is visible across React pages.

Key file:
- `react-next/src/pages/TermsPage.tsx`

## Recent Important Commits (Context)
- `3246472` - Add public terms page and legal footer link
- `78dc269` - Harden public repo privacy and stop tracking runtime state
- `404be53` - Simplified settings page and embedded Brevo alerts form
- `223232d` - Tightened mobile detail layout spacing and labels
- `0fcd008` - CI builds React artifacts + version SHA injection improvements
- `4bc5b9a` - Security audit fixes (public state file exposure + dependency updates)

## Known Operational Issue (Git Push Rejections)
This repo frequently gets `git push` non-fast-forward rejections because scheduled GitHub Actions commit refreshed data to `main` while UI work is in progress.

Why:
- Multiple writers push to `main`:
  - auto data refresh workflow
  - freshness watchdog-triggered refreshes
  - manual UI commits

Expected workflow for agents:
1. Commit local work
2. `git fetch origin`
3. `git rebase origin/main`
4. `git push origin main`

This is normal with current workflow design.

## Ownership / Reuse Policy (Repo)
- Repository is public but proprietary (not open source).
- See `LICENSE` and `NOTICE.md` for usage restrictions and ownership notice.
- Public app also exposes a visible `/terms` page for users.

## Local Workspace Note (Do Not Accidentally Commit)
There may be leftover untracked built artifacts from local builds. Example:
- `site/assets/index-C7y6_Lob.js`
- `site/assets/index-CC7hTBnL.css`
- `site/next/assets/index-CC7hTBnL.css`
- `site/next/assets/index-QCvhW3mY.js`

These are local leftovers and should not be committed unless intentionally rebuilding/publishing artifacts manually.

## Recommended Next Steps (UI / Product)
1. Optional sticky mini header on detail pages (status + last update while scrolling)
2. More aggressive mobile-only typography compaction in `Overview`
3. Further simplify `Analysis` / `Sources` wording for non-technical users
4. (Larger feature) real response-time/latency time-series pipeline if true latency graphs are desired
5. Optional stronger freshness alerting to humans (webhook/email) if watchdog auto-recovery fails repeatedly

## Quick Validation Checklist For Any Future UI Change
- `npm.cmd run build` in `react-next`
- confirm no fake/example data was reintroduced
- confirm source unavailable red marker still appears for partial source failures
- confirm mobile layout does not overlap bottom nav/tab switcher
- push and allow CI to rebuild root + `/next`

