# Agent Handoff: Owstatusupdater

Last updated: 2026-02-21

## Public Repo Hard Rule (Do Not Violate)
- This repository is public. Treat **all committed files** as public.
- The deployed `site/` directory is public web output. Do not expose secrets, runtime state, internal operational data, or private notes in `site/` or tracked files.
- If state persistence is needed for workflows, prefer non-public persistence (for example Actions cache/artifacts) over committing state files.

## 1) Canonical Repo + Deployment
- Canonical repo path (local): `Owstatusupdater-main/project/mc-regeln-main`
- GitHub repo: `https://github.com/F1NN303/Owstatusupdater`
- Live site: `https://f1nn303.github.io/Owstatusupdater/`
- Sony page: `https://f1nn303.github.io/Owstatusupdater/sony/`
- Email alerts page: `https://f1nn303.github.io/Owstatusupdater/email-alerts.html`

Note: There is another sibling `site/` folder outside this repo root. Do not edit that by mistake. Work inside `project/mc-regeln-main/site`.

## 2) Stack / Architecture
- Frontend: static HTML + CSS + vanilla JS.
- No React/Vue/Next build pipeline.
- Data generation: Python scripts write JSON/XML into `site/data` and `site/sony/data`.
- Hosting: GitHub Pages via Actions deploy.

Main frontend files:
- `site/index.html` (Overwatch dashboard)
- `site/sony/index.html` (Sony PSN dashboard)
- `site/email-alerts.html` (Brevo signup page + local menu logic)
- `site/styles.css`
- `site/app.js` (shared dashboard logic for Overwatch + Sony)

Data files:
- Overwatch: `site/data/*.json`, `site/data/rss.xml`
- Sony: `site/sony/data/*.json`, `site/sony/data/rss.xml`

## 3) CI/CD Workflows
- `update-site-data.yml`
  - Runs every 30 min.
  - Executes:
    - `python scripts/build_site_data.py --service overwatch`
    - `python scripts/build_site_data.py --service sony`
  - Sends major outage mail via Brevo using repo secrets.
  - Commits generated data files with retry/rebase logic.

- `send-test-email.yml`
  - Manual run for test email.
  - Force sends via `ALERT_FORCE_SEND=1`.

- `deploy-pages.yml`
  - Deploys `site/` folder to GitHub Pages on `main` push and successful data workflow.

## 4) Security Notes (Public Repo)
- Secrets are expected only in GitHub Actions secrets:
  - `BREVO_API_KEY`
  - `ALERT_EMAIL_FROM`
  - `ALERT_EMAIL_TO`
- Public file `site/data/subscription.json` contains:
  - provider
  - hosted Brevo form URL
  - allowed host list
  This is public-safe and contains no secret keys.
- Email sending script avoids persisting full provider response payload.

## 5) User Priorities / Product Direction
User repeatedly requested:
- Mobile-first UI quality.
- Clear service identity (Overwatch vs Sony with proper logos).
- Reduced cognitive load and simpler UI.
- Working menu/search behavior on iPhone Safari.
- No secret leakage in public repo.

## 6) Current Known Problems (Important)
### P0: Mobile menu glitch still unresolved per user
User reports menu still visually broken/overlaying content on mobile even after recent patches.
Symptoms from screenshots:
- Menu content appears stuck at top when it should be closed.
- UI overlaps hero and tab area.
- Search + menu state conflicts on iOS Safari.

### P1: Menu logic split across two implementations
- Dashboard pages use `site/app.js`.
- `site/email-alerts.html` has a separate inline menu implementation with its own breakpoints, scroll lock, and filtering logic.
- This drift is high risk for repeated regressions.

### P1: iOS Safari behavior/caching
- User tests mostly on iPhone simulation and Safari.
- Hard reload/querystring was used, but issue still reported.

## 7) Recent Commits to Inspect First
- `df7ec75` - "Fix mobile menu sheet behavior and refresh site data"
  - Touched menu mode/state logic and CSS sheet rules.
- `3f82342` - "Restore data snapshots from upstream"
  - Reintroduced upstream-generated data after rebase conflict.

If menu bug persists, start by reviewing/reverting part of `df7ec75` (menu-specific hunks only).

## 8) Practical Debug Runbook
1. Pull latest:
```powershell
git pull origin main
```

2. Run local static preview:
```powershell
python -m http.server 8000 --directory site
```

3. Reproduce on mobile viewport:
- Open `http://127.0.0.1:8000/index.html`
- Open/close menu repeatedly.
- Focus search field before/after menu open.
- Rotate viewport / trigger resize.
- Navigate to Sony and repeat.

4. Inspect live state in devtools console:
```js
document.body.dataset.menuMode
document.body.dataset.menuOpen
document.getElementById('menuTrigger')?.getAttribute('aria-expanded')
document.getElementById('menuPanel')?.hidden
```

5. Validate no data/security regressions:
```powershell
python scripts/build_site_data.py --service overwatch
python scripts/build_site_data.py --service sony
python -c "import json; [json.load(open(p,encoding='utf-8')) for p in ['site/data/status.json','site/data/history.json','site/sony/data/status.json','site/sony/data/history.json']]; print('ok')"
```

## 9) Recommended Next Fix Strategy (for next AI)
1. Stabilize before redesign:
  - Temporarily disable fullscreen-sheet behavior for mobile and use one simple anchored dropdown that always closes on blur/navigation.
  - Confirm bug disappears.

2. Unify menu implementation:
  - Remove inline menu JS from `site/email-alerts.html`.
  - Reuse a shared menu controller from one JS source.

3. Enforce hard closed state:
  - Keep `panel.hidden = true` + `aria-expanded=false` as single source of truth.
  - Avoid mixed CSS visibility conditions that can render despite hidden state.

4. Add temporary debug telemetry:
  - `console.debug('[menu]', { mode, open, expanded, hidden })` on every open/close.
  - Remove once stable.

5. Only after stable:
  - Continue mobile visual overhaul.
  - Keep functionality changes and visual changes in separate commits.

## 10) High-Risk Files
- `site/app.js` (large monolith, ~3500 lines)
- `site/styles.css` (large style sheet, ~1900 lines)
- `site/email-alerts.html` (inline menu logic diverges from app.js)

## 11) Data/Service Implementation Notes
- Data builder supports both services via `--service`.
- Service configs in `scripts/build_site_data.py`:
  - Overwatch data dir: `site/data`
  - Sony data dir: `site/sony/data`
- Alert script currently reads `site/data/status.json` (Overwatch-major flow).

## 12) Guardrails for Next AI
- Do not commit secrets or credentials.
- Do not remove/overwrite user custom branding text blindly.
- Keep EN/DE functionality intact.
- Keep generated data updates separate from UI fixes when possible (smaller reviews, easier rollback).

