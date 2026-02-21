# Mobile Menu Stabilization (February 21, 2026)

## Scope
- Stabilize top navigation menu open/close behavior on mobile layouts.
- Reduce state desync risk where menu content could stay visible while logically closed.
- Align email alerts page menu behavior with dashboard menu state model.

## Files Changed
- `site/app.js`
- `site/email-alerts.html`
- `site/styles.css`

## What Changed
1. Dashboard menu close flow (`site/app.js`)
- Removed delayed close timer logic.
- `closeTopNavMenu()` now always enforces a hard closed state immediately:
  - `aria-expanded="false"`
  - remove `.is-open`
  - `panel.hidden = true`
  - `data-menu-open="false"` via `setMenuOpenState(false)`

2. Email alerts page menu controller (`site/email-alerts.html`)
- Updated inline menu logic to use the same mobile mode detection strategy as dashboard:
  - compact width and coarse-pointer detection
  - body `data-menu-mode` synchronization
- Removed fixed-body scroll position mutation logic to match dashboard behavior.
- Added strict reset routine (`resetMenuState`) used by close/visibility/pageshow/pagehide flows.
- Added viewport and lifecycle listeners for mode changes and safe reset:
  - `resize`
  - `visualViewport.resize` (when available)
  - `orientationchange`
  - `hashchange`
  - `visibilitychange`
  - `pageshow`
  - `pagehide`

3. CSS guardrail (`site/styles.css`)
- Added explicit hidden rule in sheet mode:
  - `body[data-menu-mode="sheet"] .menu-panel.menu-panel--sheet[hidden] { display: none !important; ... }`
- Purpose: prevent rendering edge cases where hidden panel could still appear in mobile sheet mode.

## Why
- Menu state was managed across several flags/classes (`hidden`, `aria-expanded`, `.is-open`, body dataset).
- Any delayed or mode-dependent close path increased the chance of visual/semantic mismatch, especially on iOS Safari.
- Consolidating toward immediate close semantics and aligned mode handling reduces race conditions and repeated regressions.

## Validation Performed
- JavaScript syntax check:
  - `node --check site/app.js`
- Inline script parse check for email menu script block:
  - evaluated via Node `Function(...)` compilation after extraction from `site/email-alerts.html`

## Post-Deploy Manual Retest (Recommended)
1. iPhone Safari (or iOS simulator): open/close menu repeatedly on:
   - `index.html`
   - `sony/index.html`
   - `email-alerts.html`
2. With menu open, rotate portrait/landscape and confirm closed state remains consistent.
3. Interleave search focus and menu open/close interactions.
4. Navigate away/back (history) and verify menu is closed on return.

## Notes
- This change does not alter data generation pipelines.
- Public subscription configuration (`site/data/subscription.json`) remains unchanged and secret-safe.

## Follow-Up Patch (Same Day)
- Symptom still reported on mobile Safari: menu trigger showed open (`X`) state while panel appeared closed.
- Additional hardening applied:
  - In `site/app.js` and `site/email-alerts.html`, menu open now sets `.is-open` immediately after `hidden = false` (synchronous), instead of waiting for `requestAnimationFrame`.
- Root cause fix applied in `site/styles.css`:
  - `body[data-menu-mode="sheet"] .menu-panel.menu-panel--sheet` set `opacity: 0` with higher specificity than `.menu-panel.is-open`, so the panel stayed visually hidden in sheet mode.
  - Added a specific open override:
    - `body[data-menu-mode="sheet"] .menu-panel.menu-panel--sheet.is-open { opacity: 1; pointer-events: auto; }`
- Rationale:
  - Removes visual dependency on delayed frame scheduling for panel visibility.
  - Prevents "trigger open, panel not visible" mismatch under Safari timing quirks.

## Follow-Up Unification Pass (Same Day)
- User feedback: behavior stable, but mobile menu UI felt inconsistent between dashboard pages and email page.
- Changes:
  - Removed email-page-only in-menu search block to match dashboard menu complexity and reduce cognitive load.
  - Tuned mobile sheet menu spacing/tap targets for easier one-handed navigation.
  - Added viewport-driven sheet fallback CSS so mobile sheet layout is enforced by media query in addition to body mode attributes.
  - Added reduced-motion handling for menu and reveal effects.
- Files:
  - `site/email-alerts.html`
  - `site/styles.css`
  - `docs/mobile-ui-unification-plan-2026-02-21.md`

## Phase 2 Shared Controller (Same Day)
- Goal: remove remaining menu-controller drift between dashboard and email pages.
- Changes:
  - Added `site/menu.js` as the single shared menu behavior controller.
  - Wired dashboard pages to shared controller by loading `menu.js` before `app.js`.
  - Refactored `site/app.js` to consume shared controller and removed duplicated menu open/close event orchestration.
  - Replaced email inline menu controller with lightweight shared-controller initialization.
- Files:
  - `site/menu.js`
  - `site/app.js`
  - `site/index.html`
  - `site/sony/index.html`
  - `site/email-alerts.html`
