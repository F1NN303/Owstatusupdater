# Agent Handoff

Last updated: 2026-03-02
Current branch: `main`
Latest known commit at handoff update: `6f2ad53`

## Purpose
This file is the persistent handoff for future agents. It captures the current project state, recent changes, deployment behavior, known risks, and recommended next steps.

## Current Live Architecture
- Public site root (React-first):
  - `https://f1nn303.github.io/Owstatusupdater/`
- React preview copy:
  - `https://f1nn303.github.io/Owstatusupdater/next/`
- React routes in use:
  - `/`
  - `/favorites`
  - `/status/:id`
  - `/alerts` (canonical)
  - `/email-alerts` (compat alias to Alerts page)
  - `/settings`
  - `/terms`
- Legacy wrappers/fallbacks still exist for direct service entry points:
  - `site/overwatch.html`
  - `site/sony/index.html`
  - `site/m365/index.html`
  - `site/openai/index.html`
  - `site/steam/index.html`
  - `site/legacy-home.html`
  - `site/legacy-overwatch.html`
  - `site/sony/legacy-index.html`

## Build and Deploy Model
- React artifacts are built in CI and copied into:
  - `site/` (root app)
  - `site/next/` (preview app)
- Build metadata (commit SHA) is injected for Settings version display.
- Important fix shipped:
  - `scripts/build_react_artifacts.py` now syncs all top-level `dist/` public entries (not only `assets` + a small static file list).
  - This ensures `public/brands/*` files are deployed to both root and preview artifacts.
- Guardrail shipped:
  - `scripts/verify_next_preview_artifact.py` now verifies service brand assets declared in `react-next/src/lib/serviceBranding.ts` exist in both `site/` and `site/next/`.

## Data Pipeline and Reliability
- Source transparency and reliability ledger are active in payload and detail analysis UI.
- 24h source agreement trend is shown in detail analysis.
- Existing outage/status data contracts stay compatible with current frontend.

Key files:
- `services/core/source_runner.py`
- `scripts/build_site_data.py`
- `react-next/src/lib/legacyServiceDetail.ts`
- `react-next/src/pages/ServerDetail.tsx`

## UI State (Current)

### Service Icons (Brand Logos)
- Real brand logos are used for key services with fallback to Lucide icons.
- Brand assets live in:
  - `react-next/public/brands/`
- Mapping and resolver:
  - `react-next/src/lib/serviceBranding.ts`
- Shared renderer:
  - `react-next/src/components/ServiceIdentityIcon.tsx`
- Wired in:
  - home cards (`react-next/src/components/ServerCard.tsx`)
  - detail header (`react-next/src/pages/ServerDetail.tsx`)
- Sources/trademark note doc:
  - `docs/brand-assets.md`

### Favorites (Now Functional)
- Favorites are no longer static shortcuts.
- Users can star/unstar services on home cards.
- Starred services are persisted in browser-local settings state.
- `/favorites` now renders starred services dynamically with live summary status and unstar action.

Key files:
- `react-next/src/lib/appShell.tsx`
- `react-next/src/pages/Index.tsx`
- `react-next/src/pages/Favorites.tsx`
- `react-next/src/components/ServerCard.tsx`

### Alerts Exposure Hardening
- Alerts page no longer displays internal-looking config details to end users (for example raw host/source path or raw technical error detail).
- User-facing status/capability messaging remains.

Key file:
- `react-next/src/pages/EmailAlerts.tsx`

### Legal Text
- Terms page includes third-party trademark/logo clarification.
- `NOTICE.md` includes matching third-party marks statement.

Key files:
- `react-next/src/pages/TermsPage.tsx`
- `NOTICE.md`

## Recent Important Commits
- `6f2ad53` - `fix(ui): uncramp favorite star on service cards`
- `4749029` - `feat(favorites): add persistent service starring and harden alerts info exposure`
- `bf6581b` - `fix(deploy): include public brand assets in root and preview artifacts`
- `f987ec4` - `feat(ui): use real brand logos for service icons`
- `f443dc0` - `feat(meta): add ios icon and social preview image with reliability fallback`
- `e9ff19e` - `feat(reliability): add 24h source agreement trend to detail view`
- `8582b6e` - `feat(reliability): add source transparency and rolling reliability ledger`
- `37f8de4` - `feat(settings): ship settings v2 and tighten public exposure guards`

## Known Operational Reality
- Push races with scheduled data refreshes are normal.
- Standard recovery flow:
  1. `git fetch origin`
  2. `git rebase origin/main`
  3. `git push origin main`

## Ownership / Policy
- Repo is public but proprietary (not open source).
- See:
  - `LICENSE`
  - `NOTICE.md`
  - in-app `/terms`

## Validation Checklist (Before Shipping)
- React UI changes: `npm.cmd run build` in `react-next`
- Optional sanity tests: `npm.cmd run test` in `react-next`
- Security-sensitive/data/deploy changes: `py -3 scripts/check_public_exposure.py`
- Confirm in-app Settings version matches deployed commit SHA.
- Confirm `/next` and root both load brand icons without `404`.
- Confirm new changes are documented here before push.

## Recommended Next Steps
1. Add a small visual "starred" indicator in service detail header for favorited services.
2. Add a quick "show favorites only" filter chip on home.
3. Add lightweight tests for favorites persistence and star toggle behavior.
4. Add one screenshot-based QA checklist entry for `/next` preview path regressions.
