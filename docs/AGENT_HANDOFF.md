# Agent Handoff

Last updated: 2026-03-24
Current branch: `main`
Latest known commit at handoff update: `47a3752e`

## Current Priority State (2026-03-22)

This handoff was refreshed after the site was rebranded toward `Status Radar` and after the first public AI assistant integration shipped.

### What this project is now
- Public GitHub Pages status site for multiple services, not only Overwatch.
- React frontend is the real live app.
- Existing public JSON status outputs remain the source of truth.
- AI is an optional public assistant layered on top of those public JSON/site-help sources.

### Live URLs
- Live site:
  - `https://f1nn303.github.io/Owstatusupdater/`
- React preview copy:
  - `https://f1nn303.github.io/Owstatusupdater/next/`
- Public AI base URL:
  - configured outside the repo via the `AI_API_BASE_URL` GitHub repo variable
  - do not commit the live Funnel URL into tracked docs or frontend config

### AI architecture
- Frontend repo:
  - `Owstatusupdater`
- Backend repo:
  - `owstbcknd`
- Runtime:
  - Ollama and the Node wrapper run locally on the AI host PC
  - default model `qwen3.5:4b`
  - public exposure is via a stable Tailscale Funnel URL kept out of the public repo
- Trusted AI data source:
  - public generated site JSON plus public site-help context only
- Public AI contract used by the site:
  - `GET /health`
  - `POST /api/ask-status/stream`

### AI safety / behavior rules
- Do not let the AI invent status logic.
- Deterministic site logic still comes from the public JSON files.
- AI should summarize, explain, and answer help questions only from approved public data.
- If the backend is offline, the site must show `AI unavailable` and keep the rest of the site working.
- Frontend must not assume the AI is always reachable.

### Current recent UI changes
- AI assistant sheet was redesigned into a cleaner, more premium mobile sheet.
- Settings page was redesigned with a calmer hierarchy and a public changelog entry point.
- Settings alert-account flicker bug was fixed:
  - root cause was unstable effect dependencies in `react-next/src/lib/alertAccount.tsx`
  - account state no longer flips between `Connected` and `Local only` during reload/checking
- Mobile AI sheet overlap was fixed:
  - it now tracks the visible mobile viewport more closely instead of relying on a short fixed-height bottom sheet

### Recent important commits
- `fe8fbb50` - `docs: add cross-agent project snapshot`
- `905ddf4d` - `fix(ui): tighten mobile settings layout`
- `b5548c7a` - `fix(ci): serialize update-site-data runs`
- `0a1a0e60` - `feat(ui): refine settings and detail hierarchy`

### Files future agents should read first
- `react-next/src/components/AiStatusAssistant.tsx`
- `react-next/src/lib/aiStatusChat.ts`
- `react-next/src/lib/alertAccount.tsx`
- `react-next/src/pages/SettingsPage.tsx`
- `react-next/src/components/AiFormattedMessage.tsx`
- `.github/workflows/deploy-pages.yml`
- `react-next/.env.example`

### Do / Don't
- Do keep the site static on GitHub Pages if possible.
- Do keep AI answers grounded in public JSON/site-help content.
- Do expect `origin/main` to move because scheduled status-data refreshes push regularly.
- Do rebase before pushing UI changes.
- Don't commit real secrets or local `.env` values.
- Don't bake temporary public backend URLs into tracked frontend config.
- Don't turn the AI into a source of truth for uptime/status.

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
- Browser cache/deploy hardening shipped in working tree:
  - `react-next/public/sw.js` cache version was bumped to force a cleaner service-worker asset refresh after recent deploys
  - `react-next/src/pages/EmailAlerts.tsx` German UI copy was normalized to ASCII-safe strings to eliminate mojibake from previously corrupted literals
  - `react-next/src/pages/SettingsPage.tsx` now shows account-aware storage text instead of always claiming only local browser storage
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
- New alert-account phase is now wired in the working tree:
  - Supabase browser auth via magic-link sign-in
  - account/session bootstrap in `react-next/src/lib/alertAccount.tsx`
  - alert preference save/load against `profiles` + `alert_preferences`
  - Alerts page now shows connected e-mail, account status, delivery-sync status, last saved/synced timestamps, and save/sign-out actions
  - the Alerts screen now follows a 3-step flow (`account -> choose alerts -> delivery`) instead of mixing account, watchlist, and provider details into repeated blocks
  - `/alerts` is now the canonical route and `/email-alerts` is only a redirect for backwards compatibility
  - the long service watchlist now has search plus a selected-only filter to make large lists easier to manage
  - Settings now surfaces the connected alert-account summary instead of describing alerts as local-only when a session exists
  - `react-next/src/lib/supabase.ts` must use explicit `import.meta.env.VITE_SUPABASE_*` access for production builds; dynamic key access does not survive Vite env replacement
- Subscriber-aware outbound mail dispatch is now wired in the working tree:
  - `scripts/send_brevo_major_alert.py` now loads all configured service `status.json` files instead of targeting a single hard-coded service
  - the sender now fetches `profiles` + `alert_preferences` from Supabase and filters deliveries per subscriber by watched services plus severity threshold
  - subscriber mail state is tracked in `.bot_state/email_alert_state.json` so duplicate snapshots and cooldown spam are suppressed per user and per service
  - successful sends update `brevo_sync_status`, `last_synced_at`, and `last_delivery_at` in Supabase; failures mark the subscriber as `error`
  - `ALERT_EMAIL_TO` remains only as a legacy/manual fallback path for direct test sends
- Required local/frontend env for the new alert-account flow:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Browser auth now also has committed public defaults in `react-next/src/lib/supabase.ts`:
  - `https://adijigutpkibobwczbic.supabase.co`
  - `sb_publishable_GzehFO0uWtjYMHotTPZi-g_HzDSMwMZ`
- Reason:
  - the Supabase publishable URL/key are safe to ship in the frontend, and this removes fragile Pages build-time secret dependency for browser auth
- Required GitHub Actions secrets for subscriber-aware dispatch:
  - `BREVO_API_KEY`
  - `ALERT_EMAIL_FROM`
  - `ALERT_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Optional GitHub Actions overrides for the Pages React build:
  - `VITE_SUPABASE_ANON_KEY`
  - `ALERT_SUPABASE_URL` reused as `VITE_SUPABASE_URL` during `deploy-pages.yml`
  - these are no longer required for browser auth because the public defaults are committed
- Current limitation:
  - subscriber filtering now works server-side, but it sends transactional Brevo mail directly per recipient instead of managing Brevo contact lists or provider-side segment state
- First-launch onboarding now appears on home as a dismissible hint layer covering:
  - favorites
  - pull-to-refresh
  - share on detail pages
- Settings now shows alert-watchlist summary and exposes a "show onboarding again" action.
- Home now links to the broader Alerts flow rather than describing the screen as only a newsletter signup page.
- Mobile smoothness hardening shipped in working tree:
  - shared app background layers now use `absolute` positioning on small screens instead of always forcing fixed full-viewport compositing
  - coarse-pointer devices now use reduced glass blur/shadow intensity
  - iOS coarse-pointer devices now fall back to opaque glass surfaces instead of expensive `backdrop-filter` layers for the shared cards and bottom nav
  - intent: keep the current visual hierarchy while reducing scroll jank on the Alerts route and other mobile screens that stack many glass cards
- Alerts mobile readability pass shipped in working tree:
  - the Alerts flow summary and final delivery status cards now stack vertically on narrow screens instead of forcing cramped 3-column mini-cards
  - the delivery CTAs now become full-width stacked actions on phones so the secure Brevo entry point reads as the primary action
  - the embedded Brevo form remains available in-app, with a slightly shorter default mobile iframe height and clearer guidance that the direct secure form is usually smoother on phones
- Alerts setup modernization shipped in working tree:
  - the Alerts page now behaves like a one-time setup until account connection plus Brevo delivery sync are both complete
  - the hero now shows all three setup steps at once, but only the current step section expands below it instead of keeping all three full sections open
  - once setup is complete, the page switches into a calmer settings workspace with compact summary stats, watchlist chips, and delivery/account controls without step numbering
  - account and delivery notices now sit directly under the hero instead of being buried inside the first card
  - synced accounts with no real send yet now show a clearer `No e-mail yet` state instead of the more ambiguous pending label

Key files:
- `react-next/src/lib/supabase.ts`
- `react-next/src/lib/alertAccount.tsx`
- `react-next/src/lib/appShell.tsx`
- `react-next/src/components/AppLayout.tsx`
- `react-next/src/pages/EmailAlerts.tsx`
- `react-next/src/pages/Index.tsx`
- `react-next/src/pages/ServerDetail.tsx`
- `react-next/src/pages/SettingsPage.tsx`
- `react-next/src/components/OnboardingHints.tsx`
- `react-next/src/index.css`
- `react-next/src/main.tsx`
- `react-next/package.json`
- `scripts/send_brevo_major_alert.py`
- `.github/workflows/update-site-data.yml`
- `.github/workflows/send-test-email.yml`
- `tests/test_url_safety.py`

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
- Home now exposes a quick `Favorites only` chip on `/` when at least one service is starred, so users can collapse the main feed to watched cards without opening the full filter select.

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
- `working tree` - `fix(alerts-ui): uncramp mobile delivery and flow status cards`
- `working tree` - `feat(home): add quick favorites-only filter chip`
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
2. Add lightweight tests for favorites persistence and star toggle behavior.
3. Add one screenshot-based QA checklist entry for `/next` preview path regressions.

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

## Latest Validation Snapshot (Mobile-First UX Roadmap Pass)
- Scope:
  - Added route-level lazy loading for non-home routes in `react-next/src/App.tsx`.
  - Added a mobile route transition shell in `react-next/src/components/RouteLoadingShell.tsx` so non-home navigation no longer flashes blank content.
  - Extended home feed refinement UX in `react-next/src/pages/Index.tsx`:
    - active filter/search summary with one-tap reset
    - favorites-only chip remains available when starred services exist
    - empty state now points users at clearing active refinements
  - Tightened service detail mobile hierarchy in `react-next/src/pages/ServerDetail.tsx`:
    - added header favorite toggle
    - added visible pinned-favorite state
    - moved confidence/region/source spread into a collapsible signal-context block
    - made tab active state more obvious on small screens
  - Clarified settings ownership/storage copy in `react-next/src/pages/SettingsPage.tsx` with explicit `This Device` and `Alerts Account` summary cards.
  - Added UI regression coverage:
    - `react-next/src/pages/Index.test.tsx`
    - `react-next/src/pages/Favorites.test.tsx`
    - `react-next/src/pages/ServerDetail.test.tsx`
  - Regenerated checked-in React artifacts so root and `/next` stay aligned:
    - `site/`
    - `site/next/`
- Validation:
  - `npm.cmd run test` in `react-next` -> passed
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/build_react_artifacts.py` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
  - `py -3 scripts/verify_next_preview_artifact.py` -> passed
  - Manual mobile QA at ~`390x844` -> passed for:
    - `/Owstatusupdater/` home feed, impacted filter summary/reset, favorite chip visibility
    - `/Owstatusupdater/favorites` starred entry open/remove flow
    - `/Owstatusupdater/status/github` favorite header action, pinned-state pill, tab readability
    - `/Owstatusupdater/alerts` secure delivery form CTA hierarchy
    - `/Owstatusupdater/settings` local-vs-account storage readability
    - `/Owstatusupdater/next/` preview root render parity
  - Saved screenshots:
    - `output/playwright/home-root-mobile.png`
    - `output/playwright/detail-root-mobile.png`
    - `output/playwright/alerts-root-mobile.png`
    - `output/playwright/settings-root-mobile.png`
    - `output/playwright/favorites-root-mobile.png`
    - `output/playwright/home-next-mobile.png`
- Notes:
  - `npm.cmd run build` still reports the existing Vite chunk-size warning for the main bundle.
  - Vitest still reports the existing React Router v7 future-flag warnings during route tests.

## Latest Validation Snapshot (Settings Layout + Nav Glass Follow-Up)
- Scope:
  - Fixed the settings intro summary cards in `react-next/src/pages/SettingsPage.tsx` so they stack again inside the existing `max-w-md` shell instead of forcing a cramped two-column split.
  - Restored the old liquid-glass bottom-nav appearance in `react-next/src/index.css` by removing the nav-specific coarse-pointer/iOS flattening fallback while keeping the heavier mobile fallback on general glass cards.
  - Regenerated `site/` and `site/next/` artifacts after the CSS/layout correction.
- Validation:
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/build_react_artifacts.py` -> passed
  - `py -3 scripts/verify_next_preview_artifact.py` -> passed
- Notes:
  - This follow-up was triggered by a post-push visual regression report on the live settings page and bottom nav.

## Latest Validation Snapshot (Non-AI Bundle Isolation + Shared Page Shell)
- Scope:
  - Moved `AlertAccountProvider` out of the global app boot path and into route-scoped wrappers:
    - `react-next/src/pages/EmailAlertsRoute.tsx`
    - `react-next/src/pages/SettingsPageRoute.tsx`
  - Removed the unused global `react-query` provider and the unused global `Sonner` mount from `react-next/src/App.tsx`.
  - Added shared narrow-shell layout primitives in `react-next/src/components/PageScaffold.tsx`.
  - Updated:
    - `react-next/src/components/RouteLoadingShell.tsx`
    - `react-next/src/pages/SettingsPage.tsx`
    - `react-next/src/pages/EmailAlerts.tsx`
    so settings/alerts/loading now share the same intro and glass-section structure.
- Validation:
  - `npm.cmd run build` in `react-next` -> passed
  - `npm.cmd run test` in `react-next` -> passed
- Notes:
  - This intentionally avoids AI-specific files and keeps the AI integration untouched.
  - Production build size improved from roughly `619 kB` initial JS to roughly `376 kB`, with alert-account code moved into its own lazy chunk.

## Latest Validation Snapshot (Settings Hierarchy Refresh + Detail Hero Compaction)
- Scope:
  - Refined `react-next/src/pages/SettingsPage.tsx` into calmer grouped preference rows instead of a stack of small cards:
    - added reusable local settings helpers for grouped rows
    - added a clearer current-defaults summary near the top
    - removed the risky narrow-shell two-column splits inside settings
    - expanded alert summary copy in the alerts quick link
    - fixed the broken build-meta separator rendering in the hero
    - added explicit switch labels for motion, compact cards, and favorites-first controls
  - Added focused settings regression coverage in:
    - `react-next/src/pages/SettingsPage.test.tsx`
  - Reused the earlier non-AI detail pass in `react-next/src/pages/ServerDetail.tsx`:
    - reduced first-screen density in the service hero
    - replaced the heavier hero narrative stack with a lighter status snapshot
    - kept deeper analytics and charts lower in the detail view
- Validation:
  - `npm.cmd run build` in `react-next` -> passed
  - `npm.cmd run test` in `react-next` -> passed
  - Manual mobile browser QA at ~`390x844` -> passed for `/Owstatusupdater/next/settings` via in-app navigation from the preview home route
- Notes:
  - The local QA run used a temporary `react-next/node_modules` junction to the original checkout so the clean synced worktree could reuse the existing dependency install.
  - Preview console still showed local data/fetch 404s on the root preview route because this clean worktree was validated against `vite preview`, not a regenerated `site/next` artifact tree with live JSON beside it.

## Latest Validation Snapshot (Update-Site-Data Concurrency Guard)
- Scope:
  - Added a top-level workflow concurrency guard to `.github/workflows/update-site-data.yml`.
  - New scheduled/manual `Update Site Data` runs now serialize per ref instead of racing each other to push refreshed data back to `main`.
  - This specifically addresses the March 23, 2026 overlap where run `#861` succeeded and near-simultaneous run `#862` failed in the final push step.
- Validation:
  - `py -3 scripts/check_public_exposure.py` -> passed
- Notes:
  - This is a workflow-only safety fix; it does not change the status-data build logic itself.
  - `Deploy GitHub Pages #1009` for commit `0a1a0e60` already succeeded before this fix; the concurrency guard is for future overlapping `Update Site Data` runs.

## Latest Validation Snapshot (Settings Mobile Cleanup + Non-Intrusive AI Trigger)
- Scope:
  - Refined `react-next/src/pages/SettingsPage.tsx` to reduce mobile density:
    - compacted the settings hero into summary chips instead of mini dashboard tiles
    - moved changelog access down into the system/update area
    - tightened German-facing settings copy so the page reads more naturally in the public UI
    - kept the existing grouped settings rows for display, feed, and system controls
  - Updated `react-next/src/components/AiStatusAssistant.tsx` so the floating assistant launcher no longer overlays the mobile settings screen:
    - desktop still uses the larger floating pill
    - mobile uses the compact launcher on other routes
    - the floating launcher is hidden on `/settings` mobile to avoid covering form content
- Validation:
  - `npm.cmd run build` in `react-next` -> passed
  - `npm.cmd run test` in `react-next` -> passed
  - Manual mobile browser QA at `393x852` via `vite preview` -> passed for `/Owstatusupdater/next/settings`
- Notes:
  - This was a follow-up to live mobile screenshots showing the `KI fragen` trigger overlapping settings content.
  - The AI backend contract and deployment wiring were not changed; only the trigger's mobile behavior and settings-page presentation were adjusted.

## Cross-Agent Status Snapshot (2026-03-23)
- Current remote `main` head at handoff time:
  - `fe8fbb50` `docs: add cross-agent project snapshot`
- Recent shipped commits that materially changed the site:
  - `fe8fbb50` `docs: add cross-agent project snapshot`
  - `905ddf4d` `fix(ui): tighten mobile settings layout`
  - `b5548c7a` `fix(ci): serialize update-site-data runs`
  - `0a1a0e60` `feat(ui): refine settings and detail hierarchy`
- Current public data/docs sync state:
  - `site/data/assistant-profile.json` is committed public assistant context and should stay public-safe
  - the handoff header and live URL section now reflect the real root-vs-preview GitHub Pages layout
  - `app.py` + `render.yaml` still exist as a legacy Flask/Render side path and are not part of the GitHub Pages deploy flow
- Current non-AI frontend state:
  - settings uses a lighter mobile-first hierarchy with grouped rows and compact summary chips
  - service detail uses a lighter first-screen summary with the denser chart content pushed lower
  - alerts/settings load their alert-account provider lazily instead of loading that code during initial app boot
  - `Update Site Data` workflow runs are serialized to avoid overlapping push races on `main`
- Current AI-related state:
  - the AI assistant is already integrated into the main site UI
  - the backend / deployment side is owned by a separate agent/workstream
  - do not change AI backend contract or deploy wiring casually
  - frontend-only AI adjustment already shipped here:
    - mobile `/settings` hides the floating assistant trigger to avoid overlaying form content
    - desktop and non-settings mobile routes still keep the assistant launcher
- Known AI ownership boundary in this repo:
  - AI UI files most likely to conflict if edited in parallel:
    - `react-next/src/components/AiStatusAssistant.tsx`
    - `react-next/src/components/AiFormattedMessage.tsx`
    - `react-next/src/lib/aiStatusChat.ts`
  - avoid touching those unless the task is explicitly about the assistant
- Known operational caveats:
  - the public AI backend is not the stable part of this repo; availability depends on external runtime and tunnel state
  - untracked local artifact folders like `output/` and `react-next/.playwright-cli/` are validation byproducts and should not be committed
- Recommended next non-AI focus areas:
  - continue tightening mobile hierarchy on remaining dense pages
  - reduce remaining mixed EN/DE wording in user-facing labels
  - keep validating important phone routes with real browser QA after layout changes

## Latest Validation Snapshot (Assistant Profile Copy + Handoff Sync)
- Scope:
  - verified that `site/data/assistant-profile.json` remains committed public assistant context and public-safe under the repo exposure rules
  - refreshed the `docs/AGENT_HANDOFF.md` header, live URL section, and cross-agent snapshot to match the actual `origin/main` head and the root-vs-preview Pages deployment split
  - clarified in the snapshot that `app.py` + `render.yaml` are a legacy side path, not the active Pages deployment contract
- Validation:
  - `py -3 scripts/check_public_exposure.py` -> passed
- Notes:
  - no runtime routes or frontend component behavior changed in this pass

## Latest Validation Snapshot (Mobile Settings + Changelog Sheet Polish)
- Scope:
  - refined the mobile `Was ist neu` trigger in `react-next/src/pages/SettingsPage.tsx` so the latest title no longer depends on a single-line truncation on narrow screens
  - tightened the mobile changelog sheet top spacing, reserved more room for the close action, and increased the bottom-sheet height so the sheet sits higher on phones
  - reduced the mobile changelog text measure and refreshed the latest public changelog entry in `react-next/src/lib/publicChangelog.ts` to keep the copy shorter and more public-safe
- Validation:
  - `npm.cmd run test` in `react-next` -> passed
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
- Notes:
  - this pass is layout/content polish only; it does not change routes, data contracts, or AI backend wiring

## Latest Validation Snapshot (Mobile Home Hero + Alerts Delivery Follow-Up)
- Scope:
  - tightened the mobile home hero in `react-next/src/pages/Index.tsx` so the first status block uses less vertical space on phone widths:
    - smaller/tighter mobile typography and spacing
    - a wider mobile headline measure so the German hero wraps less aggressively
    - denser metric-card spacing without changing desktop layout
  - refined alert delivery status handling in `react-next/src/pages/EmailAlerts.tsx`:
    - step 3 no longer treats every non-synced state as the same static `Setup offen` message
    - once the secure provider form is opened, the page keeps a local follow-up state, re-checks alert-account delivery status when the user returns, and offers an explicit `Status pruefen` action
    - settings summary wording in `react-next/src/pages/SettingsPage.tsx` now also reflects a pending provider signup when a provider contact exists
  - broadened the latest public changelog copy in `react-next/src/lib/publicChangelog.ts` so the public note covers the mobile hero + alert setup polish without exposing internal rollout detail
- Validation:
  - `npm.cmd run test` in `react-next` -> passed
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
  - Manual mobile browser QA at `393x852` via local Vite dev server -> passed for `/` and unauthenticated `/alerts`
- Notes:
  - the auth-dependent step-3 follow-up state could not be fully end-to-end verified locally without a live connected alert account plus provider sync callback data
  - the frontend now has a clearer pending/check-again path, but final `Active` status still depends on alert-account profile data reaching `brevo_sync_status = synced`

## Latest Validation Snapshot (Brevo Manual Sync Hookup)
- Scope:
  - wired the existing `Zustellungsstatus pruefen` action in `react-next/src/pages/EmailAlerts.tsx` to invoke the deployed Supabase Edge Function `sync-brevo-contact`
  - added explicit account notices for successful sync, missing Brevo contact, and transient sync failures
  - added focused regression coverage in `react-next/src/pages/EmailAlerts.test.tsx` for the manual sync button path
- Validation:
  - `npm.cmd run test` in `react-next` -> passed
  - `npm.cmd run build` in `react-next` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
- Notes:
  - this pass assumes the Supabase Edge Function `sync-brevo-contact` is already deployed with a valid `BREVO_API_KEY` secret
  - the frontend still depends on the signed-in alert account matching the Brevo contact e-mail

## Latest Validation Snapshot (Subscriber Test Email Targeting)
- Scope:
  - extended `scripts/send_brevo_major_alert.py` so manual forced test runs can target one synced subscriber via a private `ALERT_TEST_SUBSCRIBER_EMAIL` secret while keeping the legacy fixed-recipient fallback intact
  - updated `.github/workflows/send-test-email.yml` to pass the optional subscriber-test secret into the manual test workflow
  - added focused Python coverage in `tests/test_send_brevo_major_alert.py` for subscriber filtering and forced subscriber-test mode selection
- Validation:
  - `py -3 -m unittest tests.test_send_brevo_major_alert` -> passed
  - `py -3 scripts/check_public_exposure.py` -> passed
- Notes:
  - the new subscriber-test path still requires a private repo secret and matching synced alert account state; it does not expose target e-mail addresses in committed workflow config
