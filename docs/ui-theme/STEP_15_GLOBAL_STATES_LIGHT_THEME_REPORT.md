# UI Step 15: Global States, Modals, Toasts, and Popups Light Theme Report

## Scope

Step 15 migrated shared/global UI states and reusable global patterns only:

- global toast surface
- notification reminder modal
- WhatsApp/community tooltip and modal
- Dashboard inline waitlist/notify modal surfaces
- Dashboard notify toast
- global helper classes for future modals, toasts, empty states, error states, icon chips, and state cards

No API routes, fetch logic, retry logic, auth logic, notification permission logic, WhatsApp URL logic, feedback/share logic, quiz logic, scoring logic, cache logic, Google Sheets logic, route names, localStorage/sessionStorage behavior, or Mentor-specific files were changed.

## Preview Usage

The attached Step 15 preview was used as visual direction for:

- white modal/toast cards
- soft overlay
- soft borders and shadows
- navy/slate text hierarchy
- orange primary CTAs
- teal info/action accents
- green success, amber warning, red danger state surfaces
- mobile-first overlay spacing
- consistent reusable state layouts

The existing app code remained the source of truth. No preview-only modals, fake data, fake toasts, or new routes were added.

## Files Inspected

- `styles/globals.css`
- `lib/designTokens.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/ui/PageLoader.jsx`
- `components/ui/RefreshStatus.js`
- `components/GoogleSignInCard.js`
- `components/CoinsToast.js`
- `components/NotificationBell.js`
- `components/WhatsAppBell.jsx`
- `pages/dashboard.js`
- key migrated page files for inline modal/toast/state inventory
- Step 2 through Step 14 UI-theme reports
- `docs/ui-theme/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- `docs/ui-theme/UI_COMPONENT_INVENTORY.md`

## Files Changed

- `styles/globals.css`
- `components/CoinsToast.js`
- `components/NotificationBell.js`
- `components/WhatsAppBell.jsx`
- `pages/dashboard.js`

## Global State Surfaces Migrated

- Coins toast
- Notification bell button
- Notification reminder modal
- Notification unsupported/blocked/enabled/saved states
- WhatsApp coach-mark tooltip
- WhatsApp community modal
- Dashboard notify/waitlist modal surfaces
- Dashboard notify toast
- Shared bottom sheet overlay backdrop
- Shared toast progress indicator

## Shared Components Migrated

### `CoinsToast`

The toast now uses a white card, soft border, floating shadow, navy/slate text, amber streak chip, and safe bottom spacing above the bottom navigation. Visibility, props, timing, and trigger behavior were not changed.

### `NotificationBell`

The bell button and reminder modal now use SSC Quest Light surfaces, overlay, close button, state cards, chips, disabled button state, and danger/success/info styling. Permission, scheduling, saving, and disable logic were not changed.

### `WhatsAppBell`

The coach-mark tooltip and portal modal now use white surfaces, soft border/shadow, navy/slate text, teal chips, and shared overlay styling. The community URL, localStorage prompt flags, open/close logic, and `window.open` behavior were not changed.

## Inline Page States Migrated

`pages/dashboard.js` was touched only for inline global-state styling:

- guest sign-in prompt override now uses `--ssc-surface`
- discover waitlist modal now uses `--ssc-surface`
- waitlist loading button uses the shared disabled token treatment
- notify toast now uses a white toast card with semantic state icon chips

Dashboard layout, data fetching, Daily Challenge, leaderboard, notification interest API call, and routing behavior were not changed.

## Reusable Global Patterns Created

Added to `styles/globals.css`:

- `.ssc-modal-overlay`
- `.ssc-modal-card`
- `.ssc-toast-card`
- `.ssc-state-card`
- `.ssc-empty-state`
- `.ssc-error-state`
- `.ssc-icon-chip`

Updated:

- `.toast-progress`
- `.sheet-overlay`

## Future UI Reuse Rules

Before creating any new UI pattern, check Step 15 global UI rules and reuse the existing SSC Quest Light layout system instead of inventing a new one.

1. Modals/dialogs: use a soft overlay equivalent to `.ssc-modal-overlay`, a white `.ssc-modal-card`, 22-24px radius, soft border, floating shadow, navy title, slate body copy, and close/cancel affordances with 44px touch targets where practical.
2. Toasts/snackbars: use `.ssc-toast-card`, white surface, semantic icon chip, navy/slate text, and bottom spacing above fixed navigation. Do not use dark or saturated full-width toast backgrounds.
3. Empty states: use `.ssc-empty-state`, a friendly icon chip, navy title, slate explanation, and one clear action. Keep the tone calm and helpful.
4. Loading/skeleton states: use `Loader`, `.skeleton`, or `.ssc-light-skeleton`; keep pale teal/slate shimmer, teal spinner, and slate loading text.
5. Error/retry states: use `.ssc-error-state`, soft danger or warning icon treatment, clear explanation, and orange/teal retry CTA. Do not hide errors or rely only on red.
6. Confirmation dialogs: follow the modal pattern; primary action orange, cancel/secondary white or soft teal, destructive action soft danger/red only when genuinely destructive.
7. Buttons: primary CTA is orange gradient with `--ssc-radius-button`; secondary is white/teal outlined; disabled uses `--ssc-disabled-bg` and `--ssc-disabled-text`.
8. Chips/badges: use pill radius, soft state background, and semantic color roles: teal/info, success, warning, danger, gold, or violet sparingly.
9. Inputs/selects: use `.ssc-light-input`: white surface, soft border, navy text, slate placeholder, teal focus ring.
10. Status colors: success is green/teal, warning is amber, danger is soft red, info is teal/blue, rewards use gold, rank/achievement uses violet sparingly.
11. Mobile spacing: cards and overlays should fit 390-430px width, avoid horizontal overflow, and keep comfortable tap targets.
12. Bottom-nav-safe spacing: fixed toasts and CTAs should sit above the bottom nav, usually `bottom-24` or equivalent safe-area spacing.

## Sections Skipped

- Mentor inline modals/toasts were intentionally not migrated because Mentor remains deferred.
- Some page-local empty/error states already migrated in their page-specific steps were not revisited.
- `pages/personal-ai-analysis.jsx`, Streak History, and Coins History remain known mixed-theme follow-ups from earlier reports.
- Legacy dark CSS variables/classes remain for backward compatibility with not-yet-migrated surfaces.

## Known Remaining Mixed-Theme Areas

- Mentor tab and Mentor setup
- `pages/personal-ai-analysis.jsx`
- Streak History
- Coins History
- Some legacy compatibility classes in `styles/globals.css`

## Mentor Deferred Confirmation

No Mentor tab files or Mentor-specific component files were edited. Mentor may inherit shared loader/skeleton/global CSS behavior, but Mentor-specific UI was not redesigned.

## Rollback

To roll back Step 15 only, revert:

- `styles/globals.css`
- `components/CoinsToast.js`
- `components/NotificationBell.js`
- `components/WhatsAppBell.jsx`
- the Step 15 state-surface changes in `pages/dashboard.js`
- `docs/ui-theme/STEP_15_GLOBAL_STATES_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_15_GLOBAL_STATES_VISUAL_CHECKLIST.md`

Do not revert Step 12, Step 13, Step 14, or earlier SSC Quest Light work unless intentionally rolling back the broader UI migration.
