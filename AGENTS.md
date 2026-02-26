# AGENTS.md - Owstatusupdater (Public-Safe Agent Guide)

Last updated: 2026-02-25

## 0) Public Repo Hard Rule (Do Not Violate)
- This repository is public. Treat all committed files as public.
- The deployed `site/` directory is public web output.
- Do not commit secrets, tokens, credentials, internal runtime state, or private notes.
- Runtime workflow state must not be tracked in Git. Use non-public persistence (GitHub Actions cache/artifacts).
- Run `scripts/check_public_exposure.py` when changing data/build/deploy/security-sensitive files.

## 1) Start Here (New Agent)
Read these first, in order:
1. `docs/AGENT_HANDOFF.md` (current project state, recent changes, backlog)
2. `AGENTS.md` (this file - rules + workflow expectations)
3. `git log --oneline -20`

## 2) Canonical Repo / Paths
- Repo root (local): `Owstatusupdater-main/project/mc-regeln-main`
- Public repo: `https://github.com/F1NN303/Owstatusupdater`
- Live site: `https://f1nn303.github.io/Owstatusupdater/`
- React preview copy: `https://f1nn303.github.io/Owstatusupdater/next/`

Important:
- Work in this repo's `site/` and `react-next/` only.
- There may be another sibling `site/` folder outside this repo root. Ignore it.

## 3) Current Architecture (High-Level)
- Frontend (primary): React app in `react-next/`
- Deployed root app artifacts are built in CI into `site/`
- `/next/` preview artifacts are also built in CI into `site/next/`
- Legacy HTML pages still exist as fallbacks (`site/legacy-*.html`, `site/sony/legacy-index.html`)
- Data pipeline: Python scripts generate JSON/XML into `site/data` and `site/sony/data`
- Hosting: GitHub Pages via GitHub Actions

## 4) Data / Security Guardrails
- `site/data/subscription.json` is public-safe config only (provider/form URL/allowed hosts)
- `.bot_state/` is workflow runtime state and must remain untracked
- Public output must not contain:
  - `state.json` runtime files
  - `.env*`
  - source maps (`*.map`) unless intentionally allowed
  - secret markers / credentials

Validation script:
- `py -3 scripts/check_public_exposure.py`

## 5) CI/CD Workflows (Current)
- `update-site-data.yml`
  - builds Overwatch + Sony + Microsoft 365 data
  - sends major outage Brevo alert (via GitHub secrets)
  - commits public data outputs only
  - restores/saves `.bot_state` via Actions cache
- `watch-data-freshness.yml`
  - watches deployed payload freshness
  - dispatches recovery refresh if stale
- `send-test-email.yml`
  - manual forced alert test
  - restores/saves `.bot_state` via Actions cache
- `deploy-pages.yml`
  - builds React root + `/next` artifacts in CI
  - validates artifact paths + exposure rules
  - deploys `site/` to GitHub Pages

## 6) Known Operational Reality (Git Push Rejections)
`git push` rejections are expected because auto refresh workflows also push to `main`.

Normal resolution:
1. `git fetch origin`
2. `git rebase origin/main`
3. `git push origin main`

If conflict involves `.bot_state/*`, keep them untracked/deleted from Git.

## 7) Product / UX Priorities (User)
- Mobile-first UI quality
- Compact layout / low cognitive load
- No fake/example data shown as real
- Clear source availability (red marker when a source fails)
- No public leakage of internal info

## 8) Validation Checklist Before Shipping
- React UI changes: `npm.cmd run build` in `react-next`
- Security-sensitive/data/deploy changes: `py -3 scripts/check_public_exposure.py`
- Confirm no fake/example data reintroduced
- Confirm source-unavailable red marker still appears when source health is partial
- Confirm mobile layout does not overlap tab switcher / bottom nav
- After pushing, verify the in-app Settings page version updates to the new deployed commit SHA (new commit = new visible version).
- In agent progress updates, append the current short commit SHA/version so the user can cross-check quickly.

## 9) Local Workspace Cleanup Warning
There may be untracked local build leftovers like `site/assets/index-*.js` and `site/next/assets/index-*.js`.
Do not commit them unless intentionally doing a manual artifact publish (normally CI handles artifacts).

## 10) Ownership / Public Repo Notice
- Repo is public but proprietary (not open source)
- See `LICENSE`, `NOTICE.md`, and the in-app `/terms` page
- Public availability does not grant reuse or re-hosting rights
