# Mobile UI Unification Plan (February 21, 2026)

## Objective
- Make navigation behavior and mobile layout consistent across:
  - `site/index.html`
  - `site/sony/index.html`
  - `site/email-alerts.html`
- Prioritize reliable one-handed use, clear hierarchy, and smooth interaction on iPhone Safari.

## Target UX Rules
1. Menu always opens in a full-screen sheet on mobile-sized viewports.
2. Menu controls and tap targets are easy to reach and at least thumb-friendly.
3. No page-specific behavior drift for open/close/focus/escape/outside-click handling.
4. Motion is subtle and predictable, with reduced-motion fallback.

## Work Plan
1. Stabilize behavior baseline.
- Keep a single open/close state model (`aria-expanded`, `hidden`, `.is-open`, `data-menu-open`).
- Ensure panel visibility does not depend on fragile timing.

2. Unify mobile sheet layout by viewport.
- Enforce mobile sheet styling with viewport media queries, not only body mode attributes.
- Keep sheet card full-width with safe-area spacing and sticky menu head.

3. Simplify divergent page UX.
- Remove email-page-only in-menu search to match dashboard menu complexity and reduce interaction noise.
- Keep menu sections consistent: Services, Navigation, Tools.

4. Improve touch and readability.
- Increase menu link tap area and spacing in sheet mode.
- Keep close action clear and sticky in mobile menu head.

5. Accessibility and performance hardening.
- Add reduced-motion mode for menu/reveal animations.
- Maintain keyboard escape and tab loop behavior in sheet mode.

## Acceptance Criteria
1. Same open/close behavior on all three pages in mobile viewport.
2. No partial-width or clipped menu sheet on iOS Safari.
3. No "button open but panel invisible" state.
4. Menu navigation is usable with one hand and low cognitive load.

## Implementation Status
- Phase 1-4 implemented in this branch:
  - `site/styles.css` mobile sheet fallback + touch target tuning + reduced motion.
  - `site/email-alerts.html` menu simplification and aligned menu behavior script.
- Next phase (optional hard unification):
  - Extract shared menu controller into dedicated JS file and remove remaining duplication between dashboard and email scripts.
