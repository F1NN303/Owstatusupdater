# Agent Handoff

Last updated: 2026-03-09
Current branch: `main`
Latest known commit at handoff update: `78f8705`

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
  - `site/epic/index.html`
  - `site/m365/index.html`
  - `site/openai/index.html`
  - `site/claude/index.html`
  - `site/discord/index.html`
  - `site/slack/index.html`
  - `site/reddit/index.html`
  - `site/github/index.html`
  - `site/cloudflare/index.html`
  - `site/steam/index.html`
  - `site/legacy-home.html`
  - `site/legacy-overwatch.html`
  - `site/sony/legacy-index.html`

## Build and Deploy Model
- React artifacts are built in CI and copied into:
  - `site/` (root app)
  - `site/next/` (preview app)
- Build metadata (commit SHA) is injected for Settings version display.
- Route UX hardening shipped in working tree:
  - production React router now prefers clean browser routes instead of defaulting to hash routes
  - `react-next/public/404.html` now captures GitHub Pages deep-link misses and redirects them back into the app
  - app boot recovers redirected deep links and also migrates legacy `#/status/...` links into clean paths
- Offline resilience shipped in working tree:
  - a lightweight service worker now caches the app shell and last-known JSON responses
  - React data fetchers now fall back to cached manifest/status/subscription payloads when live fetches fail
  - home and detail pages now surface a visible "last known data" banner when cached payloads are being used
- Important fix shipped:
  - `scripts/build_react_artifacts.py` now syncs all top-level `dist/` public entries (not only `assets` + a small static file list).
  - This ensures `public/brands/*` files are deployed to both root and preview artifacts.
- Guardrail shipped:
  - `scripts/verify_next_preview_artifact.py` now verifies service brand assets declared in `react-next/src/lib/serviceBranding.ts` exist in both `site/` and `site/next/`.
- Deploy hotfix after `78f8705`:
  - `scripts/verify_next_preview_artifact.py` was still enforcing the old `HashRouter`-only production contract.
  - The live app now uses clean browser routes plus `404.html` + `routerRecovery.ts` for GitHub Pages recovery, so the deploy workflow failed even though the app build was valid.
  - The verifier now checks for the current router recovery contract instead of the old hash-router default.

## Data Pipeline and Reliability
- Source transparency and reliability ledger are active in payload and detail analysis UI.
- 24h source agreement trend is shown in detail analysis.
- Existing outage/status data contracts stay compatible with current frontend.
- Detail payload sanitization now preserves component/service breakdown arrays on both the top-level payload and `outage`.
- This fixes missing API component rows on service detail pages for providers like OpenAI and Claude where the live JSON already includes `outage.components`.
- Bug-hunt fix shipped in working tree:
  - source transparency percentage fields (`confidence_score`, `success_rate`, `stale_rate`, `cache_hit_rate`) are now sanitized as percentages, not incorrectly clamped to `0..1`
  - the detail header confidence chip no longer mixes German labels with English body text
  - source role / criticality values are rendered as user-facing labels instead of raw backend values like `provider` / `supporting`
- UI behavior fix shipped in working tree:
  - `Favorites First` is now the default home behavior for fresh installs, resets, and a one-time migration for pre-v3 stored settings
  - API component lists now sort impacted components ahead of healthy ones so degraded/offline entries stay visible without forcing `Show all`
- iOS/mobile UX fix shipped in working tree:
  - root React HTML viewport now uses `viewport-fit=cover` so the app fully respects iPhone safe-area insets
  - home and service detail now support pull-to-refresh using a shared mobile touch hook + top refresh indicator
  - service detail header now includes native share with clipboard fallback when `navigator.share` is unavailable
- Scheduled maintenance surfacing shipped in working tree:
  - Statuspage-based providers now extract future or active scheduled maintenance incidents into `outage.scheduled_maintenances`
  - Slack's custom official parser now exposes the same normalized maintenance rows
  - the home screen now shows compact scheduled-maintenance cards near the top when at least one provider publishes an active or upcoming maintenance window
  - current local verification builds for GitHub and Slack returned empty maintenance arrays, so the new home section is working but not expected to appear unless live provider data includes maintenance entries

Key files:
- `services/core/source_runner.py`
- `scripts/build_site_data.py`
- `react-next/src/lib/legacyServiceDetail.ts`
- `react-next/src/pages/ServerDetail.tsx`
- `react-next/src/pages/Index.tsx`
- `services/adapters/statuspage_json.py`
- `services/claude_aggregator.py`
- `config/services/claude.yaml`
- `site/claude/data/*`

## UI State (Current)

### Alerts + Onboarding (Working Tree)
- Alerts now include device-local watchlist controls:
  - per-service watchlist selection
  - severity threshold (`major` only vs `degraded + major`)
  - quick import from favorites
- The Brevo signup remains global; the new watchlist controls are explicitly local UI preferences until provider-side filtering exists.
- First-launch onboarding now appears on home as a dismissible hint layer covering:
  - favorites
  - pull-to-refresh
  - share on detail pages
- Settings now shows alert-watchlist summary and exposes a "show onboarding again" action.

Key files:
- `react-next/src/lib/appShell.tsx`
- `react-next/src/pages/EmailAlerts.tsx`
- `react-next/src/pages/Index.tsx`
- `react-next/src/pages/ServerDetail.tsx`
- `react-next/src/pages/SettingsPage.tsx`
- `react-next/src/components/OnboardingHints.tsx`

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
- Added service brand assets for:
  - `slack`
  - `reddit`
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

### Epic Games Service - Added
- New service id: `epic`
- New detail route: `/status/epic`
- New legacy wrapper: `site/epic/index.html`
- New generated data path: `site/epic/data/*`
- Source strategy:
  - official required: Epic Games Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `epic` endpoint.

Key files:
- `services/epic_aggregator.py`
- `config/services/epic.yaml`
- `site/epic/data/*`
- `react-next/src/lib/serviceManifest.ts`
- `scripts/watch_data_freshness.py`
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

### Slack Service - Added
- New service id: `slack`
- New detail route: `/status/slack`
- New legacy wrapper: `site/slack/index.html`
- New generated data path: `site/slack/data/*`
- Source strategy:
  - official required: Slack Status API (`/api/v2.0.0/current`, `/api/v2.0.0/history`) plus official status page component snapshot
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `slack` endpoint.

Key files:
- `services/slack_aggregator.py`
- `config/services/slack.yaml`
- `site/slack/data/*`
- `react-next/src/lib/serviceManifest.ts`
- `scripts/watch_data_freshness.py`
- `tests/test_payload_contracts.py`
- `tests/test_resilience.py`

### Reddit Service - Added
- New service id: `reddit`
- New detail route: `/status/reddit`
- New legacy wrapper: `site/reddit/index.html`
- New generated data path: `site/reddit/data/*`
- Source strategy:
  - official required: Reddit Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `reddit` endpoint.

Key files:
- `services/reddit_aggregator.py`
- `config/services/reddit.yaml`
- `site/reddit/data/*`
- `react-next/src/lib/serviceManifest.ts`
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

### Cloudflare Service - Added
- New service id: `cloudflare`
- New detail route: `/status/cloudflare`
- New legacy wrapper: `site/cloudflare/index.html`
- New generated data path: `site/cloudflare/data/*`
- Source strategy:
  - official required: Cloudflare Statuspage API (`/api/v2/status.json`, `/components.json`, `/incidents.json`)
  - supporting corroboration: StatusGator + IsDown
- Freshness monitor now includes `cloudflare` endpoint.

Key files:
- `services/cloudflare_aggregator.py`
- `config/services/cloudflare.yaml`
- `site/cloudflare/data/*`
- `react-next/src/lib/serviceManifest.ts`
- `react-next/src/lib/serviceBranding.ts`
- `react-next/public/brands/cloudflare.svg`
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
- `working tree` - `feat(routes/offline): recover clean deep links on GitHub Pages and cache last-known status payloads`
- `working tree` - `feat(alerts): add per-service local watchlist controls and first-launch onboarding hints`
- `working tree` - `test(mobile): add pull-to-refresh, share, and router recovery regression coverage`
- `working tree` - `fix(ui): correct source transparency percentage scaling and localize source confidence labels`
- `working tree` - `fix(ui): preserve sanitized component lists so detail API component status renders`
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

## Latest Validation Snapshot (Cross-Service Reliability Hardening)
- Scope:
  - Ran full end-to-end validation across all services and artifacts.
  - Hardened snapshot freshness semantics for StatusGator in:
    - `openai`, `claude`, `discord`, `github`, `m365`
  - Change: freshness for those StatusGator adapters now uses successful fetch time (snapshot semantics), not latest incident timestamp, to prevent false stale reliability degradation during quiet periods.
  - Added regression tests:
    - `SnapshotFreshnessSemanticsTests` in `tests/test_resilience.py`
    - Verifies `_statusgator_last_item_at` uses `_utc_now_iso()` across all five services.
- Result impact:
  - Removed false `stale_source_data` reliability warnings for healthy services (`claude`, `m365`) caused by old incident timestamps despite fresh fetches.
- `py -3 scripts/validate_services.py` -> passed
- `py -3 scripts/check_public_exposure.py` -> passed
- `py -3 scripts/build_site_data.py --service all` -> passed
- `py -3 -m py_compile services/openai_aggregator.py services/claude_aggregator.py services/discord_aggregator.py services/github_aggregator.py services/m365_aggregator.py tests/test_resilience.py` -> passed
- `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (27 tests)
- `npm.cmd run build` in `react-next` -> passed
- `py -3 scripts/verify_next_preview_artifact.py` -> passed

## Latest Validation Snapshot (Source Reliability Hardening + Sony Expansion)
- Scope:
  - Added Sony provider corroboration sources (supporting, scoring-enabled):
    - `statusgator_playstation` -> `https://statusgator.com/services/playstation`
    - `isdown_playstation_network` -> `https://isdown.app/status/playstation-network`
  - Kept Sony official regional feeds as primary truth; provider signals merge as corroboration/fallback.
  - Added Steam endpoint to freshness monitor:
    - `https://f1nn303.github.io/Owstatusupdater/steam/data/status.json`
  - Added new source reliability audit script:
    - `scripts/audit_source_endpoints.py`
    - checks HTTP status, latency bucket, StatusGator canonical mismatch fallback.
    - default exit policy: fail only on required/official endpoint failures.
  - Added reliability tests:
    - `tests/test_audit_source_endpoints.py`
    - `SonyAggregatorResilienceTests` in `tests/test_resilience.py`
    - Sony provider source-id assertion in `tests/test_payload_contracts.py`
- Validation:
  - `py -3 scripts/validate_services.py` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
  - `py -3 scripts/build_site_data.py --service all` -> passed
  - `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (35 tests)
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/build_react_artifacts.py` -> passed
  - `py -3 scripts/verify_next_preview_artifact.py` -> passed
  - `py -3 scripts/watch_data_freshness.py --dry-run` -> passed (all monitored endpoints fresh)
- `py -3 scripts/audit_source_endpoints.py` -> passed (33/33 endpoints OK)
- Implementation commit: `9f40c11`

## Latest Validation Snapshot (Cloudflare Service)
- Scope:
  - Added new service `cloudflare` using official-first architecture:
    - Python aggregator with required official Statuspage API + supporting provider corroboration.
    - Config-driven registration + generated static artifacts.
    - React fallback manifest, branding, alias routing, and legacy wrapper route.
  - Added Cloudflare to freshness watchdog endpoint list.
  - Added Cloudflare resilience tests and payload contract coverage.
- Validation:
  - `py -3 scripts/validate_services.py` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
  - `py -3 scripts/build_site_data.py --service cloudflare` -> passed
  - `py -3 -m unittest discover -s tests -p "test_*.py" -v` -> passed (38 tests)
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/build_react_artifacts.py` -> passed
  - `py -3 scripts/verify_next_preview_artifact.py` -> passed
  - `py -3 scripts/audit_source_endpoints.py --service cloudflare` -> passed
- `py -3 scripts/watch_data_freshness.py --dry-run` -> cloudflare endpoint reported `HTTP 404` pre-deploy (expected until GitHub Pages publish completes)
- Implementation commit: `9418895`

## Latest Validation Snapshot (Slack Service)
- Scope:
  - Added new service `slack` using official-first architecture:
    - Python aggregator with required official Slack Status API plus official component snapshot from the Slack status page.
    - Supporting provider corroboration from StatusGator and IsDown.
    - Config-driven registration, generated static artifacts, React fallback manifest entry, and legacy wrapper route.
  - Added Slack to freshness watchdog endpoint list.
  - Added Slack payload contract coverage and resilience tests.
- Validation:
  - `py -3 -m py_compile services/slack_aggregator.py tests/test_resilience.py tests/test_payload_contracts.py scripts/watch_data_freshness.py` -> passed
  - `py -3 -m unittest tests.test_resilience.SlackAggregatorResilienceTests -v` -> passed
  - `py -3 -m unittest tests.test_resilience.SnapshotFreshnessSemanticsTests -v` -> passed
  - `py -3 scripts/build_site_data.py --service slack` -> passed
  - `py -3 scripts/validate_services.py` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
  - `py -3 -m unittest tests.test_payload_contracts tests.test_services_manifest -v` -> passed
  - `npm.cmd run build` in `react-next` -> passed

## Latest Validation Snapshot (Reddit Service)
- Scope:
  - Added new service `reddit` using official-first architecture:
    - Python aggregator with required official Reddit Statuspage API and supporting provider corroboration.
    - Config-driven registration, generated static artifacts, React fallback manifest entry, and legacy wrapper route.
  - Added Reddit to freshness watchdog endpoint list.
  - Added Reddit payload contract coverage and resilience tests.
- Validation:
  - `py -3 -m py_compile services/reddit_aggregator.py tests/test_resilience.py tests/test_payload_contracts.py scripts/watch_data_freshness.py` -> passed
  - `py -3 -m unittest tests.test_resilience.RedditAggregatorResilienceTests -v` -> passed
  - `py -3 -m unittest tests.test_resilience.SnapshotFreshnessSemanticsTests -v` -> passed
  - `py -3 scripts/build_site_data.py --service reddit` -> passed

## Latest Validation Snapshot (Slack + Reddit Brand Assets)
- Scope:
  - Added brand SVG assets for `slack` and `reddit`.
  - Wired new brand asset mappings and aliases through `react-next/src/lib/serviceBranding.ts`.
  - Updated `docs/brand-assets.md` with the new asset sources.
- Validation:
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/build_react_artifacts.py` -> passed
  - `py -3 scripts/verify_next_preview_artifact.py` -> passed

## Latest Validation Snapshot (Home/Detail UX Refinements)
- Scope:
  - Fixed iOS Safari input auto-zoom behavior:
    - Ensured search/form input font-size does not trigger Safari focus zoom.
    - Implementation commit: `bfbe33a`
  - Softened home banner severity behavior to reduce alert fatigue:
    - Replaced binary warning escalation with threshold-based global-state logic.
    - Added `minor-issues` state and neutral "Monitoring Active" banner treatment.
    - Added "View impacted" quick action in top banner.
    - Implementation commit: `5226dac`
  - Added Incident Replay in service detail `Incidents` tab:
    - 24h/7d replay window switch.
    - Play/Pause timeline playback and manual scrub.
    - Event synthesis from history snapshots + outage incident start/recovery timestamps.
    - Compact replay event feed for recent transitions.
    - Implementation commit: `5eb8e6c`
- Validation:
  - `npm.cmd run build` in `react-next` -> passed (for each of the above commits)

## Latest Validation Snapshot (Alerts Workflow + Public Copy Cleanup)
- Scope:
  - Fixed `scripts/send_brevo_major_alert.py` so `python scripts/send_brevo_major_alert.py` works from the repo root in GitHub Actions.
  - Confirmed the `Update Site Data` workflow failure was in the Brevo email step, not the status-data build step.
  - Added a saved `Favorites First` home-feed setting.
  - Removed public-facing detail/feed wording that exposed implementation terms like `Payload`, `API payload`, `fallback`, raw source errors, and SLA/quorum phrasing.
- Validation:
  - `python scripts/send_brevo_major_alert.py` -> passed (`[brevo] skip send (not_major) severity=stable`)
  - `python -m unittest tests.test_url_safety -v` -> passed
  - `npm.cmd run build` in `react-next` -> passed
  - `python scripts/check_public_exposure.py` -> passed

## Latest Validation Snapshot (Major Alert Cooldown Guard)
- Scope:
  - Extracted the major-alert send decision into a dedicated helper in `scripts/send_brevo_major_alert.py`.
  - Added test coverage for duplicate snapshots, cooldown-active repeats, forced test sends, and invalid cooldown parsing.
  - Current automatic send behavior remains:
    - only for `major` severity
    - only for a new status snapshot
    - only when entering `major` or after cooldown expiry
    - forced test send still requires explicit `ALERT_FORCE_SEND`
- Validation:
  - `python -m unittest tests.test_url_safety -v` -> passed
  - `python scripts/send_brevo_major_alert.py` -> passed (`[brevo] skip send (not_major) severity=stable`)

## Latest Validation Snapshot (Data Deploy Trigger Fix)
- Scope:
  - Root cause found for stale live data after successful `Send Test Email Alert` runs:
    - the workflow pushed refreshed `site/data/*` to `main`
    - but `Deploy GitHub Pages` only auto-ran after `Update Site Data`, not after `Send Test Email Alert`
    - pushes made by `github-actions[bot]` did not trigger the `push` workflow path
  - `deploy-pages.yml` now also listens to successful `Send Test Email Alert` `workflow_run` events.
- Validation:
  - Verified remote refresh commit `c8ba7fd` exists on `main`
  - Verified live site was still serving older JSON before this workflow fix
