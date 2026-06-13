# Bottom Navigation Scroll-Safe Polish Report

## Scope

This polish pass adjusted only the shared app shell and bottom navigation visual layer so migrated SSC Quest Light pages end cleanly above the fixed navigation.

No navigation routes, active-tab logic, icons, labels, API logic, auth logic, quiz logic, scoring logic, cache logic, Google Sheets logic, Mentor logic, or business logic were changed.

## Files Inspected

- `pages/_app.js`
- `components/BottomNav.js`
- `styles/globals.css`
- `lib/designTokens.js`
- migrated route wrappers and prior UI-theme reports

## Files Changed

- `components/BottomNav.js`
- `styles/globals.css`

## Bottom Nav Behavior Changed

- Bottom nav remains fixed at the bottom.
- The nav pill remains centered at the app mobile width.
- A non-interactive bottom scrim/fade was added behind the nav.
- The nav inner wrapper now uses safe-area-aware bottom padding.
- The scrim uses `pointer-events: none`, so it does not block taps or scrolling.

## Bottom Padding Rule

Added shared CSS variables:

- `--ssc-bottom-nav-height: 86px`
- `--ssc-bottom-nav-breathing-space: 44px`
- `--ssc-bottom-nav-safe-padding: calc(var(--ssc-bottom-nav-height) + var(--ssc-bottom-nav-breathing-space) + env(safe-area-inset-bottom))`

Updated `.ssc-app-frame-with-nav` to use:

```css
padding-bottom: var(--ssc-bottom-nav-safe-padding);
```

This gives every route that shows BottomNav enough scroll ending room for the final card/content to be reachable above the fixed nav.

## Safe-Area Handling

The nav content wrapper now applies:

```css
padding-bottom: calc(7px + env(safe-area-inset-bottom));
```

The outer safe-area class no longer duplicates safe-area padding.

## Fade / Blur / Scrim

Added `.ssc-bottom-nav-scrim`, a fixed, centered, non-interactive gradient layer behind the nav. It creates a ChatGPT-style content ending so cards can scroll underneath the fixed layer without looking abruptly cut off.

The existing nav pill keeps its white translucent surface, soft border, shadow, rounded shape, and backdrop blur.

## Pages Checked

Route smoke checks should cover:

- `/dashboard`
- `/subjects`
- `/quiz-setup`
- `/quiz`
- `/result`
- `/history`
- `/history/quizzes`
- `/history/saved`
- `/history/mistakes`
- `/history/coins`
- `/streak`
- `/leaderboard`
- `/analysis`
- `/profile`
- `/mentor`

`/repeated-mistakes` is not an existing route in this branch; repeated mistakes live at `/history/mistakes`.

## Pages Needing Special Handling

No page-specific padding changes were added. Pages with their own fixed CTAs should still be visually checked during final QA, but the global reserved padding should handle the normal bottom-nav overlap.

## Mentor Deferred Confirmation

No Mentor-specific files were edited. Mentor only inherits the shared fixed navigation polish and should be smoke-checked.

## Rollback

To roll back this polish only, revert:

- `components/BottomNav.js`
- the bottom-nav variable/scrim/padding changes in `styles/globals.css`
- `docs/ui-theme/BOTTOM_NAV_SCROLL_SAFE_POLISH_REPORT.md`
- `docs/ui-theme/BOTTOM_NAV_SCROLL_SAFE_VISUAL_CHECKLIST.md`
