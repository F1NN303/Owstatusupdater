# Agent Handoff

Last updated: 2026-03-03
Current branch: `main`
Latest known commit at handoff update: `391bcc3`

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
  - `site/claude/index.html`
  - `site/discord/index.html`
  - `site/github/index.html`
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
- `services/claude_aggregator.py`
- `config/services/claude.yaml`
- `site/claude/data/*`

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

### Claude Service (Anthropic) - Added
- New service id: `claude`
- New detail route: `/status/claude`
- New legacy wrapper: `site/claude/index.html`
- New generated data path: `site/claude/data/*`
- Source strategy:
  - official required: Anthropic Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `claude` endpoint.

Key files:
- `services/claude_aggregator.py`
- `config/services/claude.yaml`
- `react-next/src/lib/serviceManifest.ts`
- `react-next/src/lib/serviceBranding.ts`
- `react-next/public/brands/claude.svg`
- `scripts/watch_data_freshness.py`
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

### Discord Service - Added
- New service id: `discord`
- New detail route: `/status/discord`
- New legacy wrapper: `site/discord/index.html`
- New generated data path: `site/discord/data/*`
- Source strategy:
  - official required: Discord Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `discord` endpoint.

Key files:
- `services/discord_aggregator.py`
- `config/services/discord.yaml`
- `site/discord/data/*`
- `react-next/src/lib/serviceManifest.ts`
- `react-next/src/lib/serviceBranding.ts`
- `react-next/public/brands/discord.svg`
- `scripts/watch_data_freshness.py`
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

### GitHub Service - Added
- New service id: `github`
- New detail route: `/status/github`
- New legacy wrapper: `site/github/index.html`
- New generated data path: `site/github/data/*`
- Source strategy:
  - official required: GitHub Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `github` endpoint.

Key files:
- `services/github_aggregator.py`
- `config/services/github.yaml`
- `site/github/data/*`
- `react-next/src/lib/serviceManifest.ts`
- `react-next/src/lib/serviceBranding.ts`
- `react-next/public/brands/github.svg`
- `scripts/watch_data_freshness.py`
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

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

## Latest Validation Snapshot (Discord Service)
- `py -3 scripts/validate_services.py` -> passed
- `py -3 scripts/check_public_exposure.py` -> passed
- `py -3 scripts/build_site_data.py --service discord` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (22 tests)
- `npm.cmd run build` in `react-next` -> passed
- `py -3 scripts/verify_next_preview_artifact.py` -> passed

## Latest Validation Snapshot (GitHub Service)
- Implementation commit: `084d161`
- `py -3 scripts/validate_services.py` -> passed
- `py -3 scripts/check_public_exposure.py` -> passed
- `py -3 scripts/build_site_data.py --service github` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (26 tests)
- `npm.cmd run build` in `react-next` -> passed
- `py -3 scripts/build_react_artifacts.py` -> passed
- `py -3 scripts/verify_next_preview_artifact.py` -> passed

## Latest Validation Snapshot (Reliability Tuning)
- Implementation commit: `391bcc3`
- Scope:
  - Applied official-first scoring safeguards to Microsoft 365 (`scoring_profile=official_first_v1`).
  - Added non-impact filtering for Microsoft Graph advisory-style issues before active incident counting.
  - Aligned IsDown parsing for `minor outage` on `m365`, `steam`, and `overwatch`.
- `py -3 -m py_compile services/m365_aggregator.py services/steam_aggregator.py services/ow_aggregator.py` -> passed
- `py -3 scripts/validate_services.py` -> passed
- `py -3 scripts/check_public_exposure.py` -> passed
- `py -3 scripts/build_site_data.py --service all` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (26 tests)
- `npm.cmd run build` in `react-next` -> passed
- `py -3 scripts/build_react_artifacts.py` -> passed
- `py -3 scripts/verify_next_preview_artifact.py` -> passed

## Recommended Next Steps
1. Add a small visual "starred" indicator in service detail header for favorited services.
2. Add a quick "show favorites only" filter chip on home.
3. Add lightweight tests for favorites persistence and star toggle behavior.
4. Add one screenshot-based QA checklist entry for `/next` preview path regressions.

## Latest Validation Snapshot (Freshness + Degraded Signal Fix)
- Scope:
  - Home cards now count stale-source warning chips only for sources explicitly marked `freshness=stale` (no longer for `unknown` freshness).
  - Overwatch source tuning:
    - StatusGator criticality changed from `required` to `supporting`.
    - Snapshot freshness for StatusGator, Overwatch News, and X mirror feed now uses successful fetch time, not latest post/incident recency.
  - Sony source tuning:
    - Region status snapshot freshness now uses successful fetch time, not latest incident recency.
  - Pipeline hardening:
    - Scheduled `update-site-data` workflow now runs `build_site_data.py --service all --allow-partial-success` to avoid full refresh stalls when one service build fails.
  - German copy correction:
    - `Aktualität` fixed in source freshness label.
- Root cause identified for "not updated":
  - Local workspace was behind `origin/main` by 18 commits.
  - Scheduled full-build workflow previously failed hard on any single service build error.
- `git pull --ff-only` -> passed (workspace synced to latest upstream)
- `py -3 scripts/build_site_data.py --service all` -> passed
- `npm.cmd run build` in `react-next` -> passed
- `py -3 scripts/validate_services.py` -> passed
- `py -3 scripts/check_public_exposure.py` -> passed
- `py -3 scripts/build_react_artifacts.py` -> passed
- `py -3 scripts/verify_next_preview_artifact.py` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (26 tests)

## Latest Validation Snapshot (GitHub Partial-Outage Severity Guard)
- Scope:
  - Adjusted GitHub severity scoring context so a limited-scope "Partial System Outage" does not force service-level `major/offline`.
  - Condition: official status resolves to `major outage` but description indicates partial outage and only a small component subset is impacted.
  - Added safeguard marker in analytics: `official_partial_scope_cap_applied`.
- `py -3 scripts/build_site_data.py --service github` -> passed
- `py -3 scripts/validate_services.py` -> passed
- `py -3 -m py_compile services/github_aggregator.py` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (26 tests)
