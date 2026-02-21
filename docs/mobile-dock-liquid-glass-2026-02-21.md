# Mobile Dock + Liquid Glass Tabs (2026-02-21)

## Goal
Replace the removed menu with a consistent mobile navigation pattern and improve touch-based tab switching on dashboard pages.

## Implemented
- Added a fixed mobile bottom dock (`Overwatch`, `Sony PSN`, `E-Mail`, `RSS`) on:
  - `site/index.html`
  - `site/sony/index.html`
  - `site/email-alerts.html`
- Added shared runtime `site/mobile-dock.js`:
  - Moves a liquid-glass active indicator under the current dock item.
  - Detects active route and keeps `aria-current` in sync.
  - Adds touch swipe switching for dashboard tabs (`Overview`, `Incidents`, `Analytics`) by triggering the existing tab buttons.
  - Adds liquid indicator animation to dashboard tab rows.
- Updated `site/styles.css`:
  - New liquid-glass styles for `.mobile-dock` and `.mobile-dock-indicator`.
  - New `.tab-liquid-indicator` style for dashboard tabs.
  - Mobile safe-area spacing so content/version footer remain visible above the fixed dock.
  - Hides old top quick-link cluster on mobile to avoid duplicated navigation and inconsistent behavior.
- Updated `site/app.js` to localize dock labels with existing EN/DE menu translation keys.

## Notes
- Desktop quick links remain available.
- Mobile now has one consistent nav type across dashboard and email pages.
- Version footer support remains active via `version-info.js`.
