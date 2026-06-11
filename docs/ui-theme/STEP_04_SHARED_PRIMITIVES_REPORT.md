# Step 04 Shared Primitives Report

Theme: SSC Quest Light  
Date: 2026-06-11  
Scope: shared primitive defaults only. No full screen migration.

## Files Changed

Source files:

- `lib/designTokens.js`
- `styles/globals.css`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `components/ui/SectionHeader.js`
- `components/BackButton.js`
- `components/GoogleSignInCard.js`

Documentation files:

- `docs/ui-theme/STEP_04_SHARED_PRIMITIVES_REPORT.md`
- `docs/ui-theme/STEP_04_PRIMITIVE_VISUAL_CHECKLIST.md`

## Primitives Migrated

### Shared Cards

- `cardStyles.base` now uses white surface, soft border, deep navy text, and soft SSC Quest Light shadow.
- `cardStyles.premium` now uses white elevated surface and floating shadow.
- Added `cardStyles.soft` for soft nested cards.
- `AppCard` props and render structure were not changed.

### Shared Buttons

- `buttonStyles.primary` now uses orange gradient, inverse text, rounded 16px corners, CTA shadow, and disabled state classes.
- `buttonStyles.secondary` now uses white surface, soft border, slate text, and disabled state classes.
- Added `buttonStyles.ghost`.
- `AppButton` now recognizes `ghost`; existing `primary` and `secondary` variants remain.
- Button props, click handlers, type behavior, and caller `className` merging remain unchanged.

### Loaders And Skeletons

- `Loader` spinner track and arc now use light-theme colors.
- Loader label uses `text-ssc-text-secondary`.
- Full-screen overlay uses the shared light overlay value.
- Card-framed loader uses white surface, soft border, and card shadow.
- Global `.skeleton` shimmer now uses pale teal/slate instead of dark navy.

### Section Headers

- `SectionHeader` title now defaults to deep navy text.
- `SectionHeader` subtitle now defaults to slate secondary text.
- Existing title/subtitle className overrides remain supported.

### Refresh Status

- `RefreshStatus` now uses slate text and teal refresh action.
- Added focus ring class to the refresh button.
- Refresh handlers, disabled behavior, and timestamp formatting remain unchanged.

### Shared Helper Classes

Added or improved:

- `.ssc-light-badge`
- `.ssc-light-progress-track`
- `.ssc-light-progress-fill`
- `.ssc-light-input`
- `.ssc-light-disabled`
- `.ssc-state-success-soft`
- `.ssc-state-warning-soft`
- `.ssc-state-danger-soft`
- `.ssc-focus-ring`

### Optional Primitive-Level Components

`BackButton`

- Migrated to white circular surface, soft border, shadow, and navy icon.
- Back/fallback behavior unchanged.

`GoogleSignInCard`

- Migrated the shared sign-in card to white surface, soft border, shadow, navy title, slate subtitle.
- Google sign-in behavior and callback handling unchanged.

## Primitives Skipped

`CoinsToast`

- Skipped in Step 4 because the file currently contains mojibake/encoded visible copy. To avoid accidental copy corruption, this toast should be migrated in a later toast/modal polish step with visual review.

`PageLoader`

- No direct change needed. It already delegates to `Loader`, so it inherits the light loader treatment.

`AppCard`

- No direct file change needed. It already consumes `cardStyles` from `lib/designTokens.js`, so it inherits the migrated defaults.

## Additive Or Replacing Shared Defaults

This step replaces shared primitive defaults where the component is intentionally centralized, such as `cardStyles`, `buttonStyles`, `Loader`, `SectionHeader`, and `RefreshStatus`.

It does not globally remap old `.app-card`, `.app-button-primary`, or page-local duplicated dark styles.

## Expected Visual Impact

- Pages using `AppCard` may show white shared cards.
- Pages using `AppButton` may show orange/white shared buttons.
- Shared loaders and skeletons should look light.
- Shared sign-in cards and back buttons should look light.
- Page-local dark cards remain dark until later page-specific steps.

## Mentor Deferred Confirmation

No Mentor-specific files were edited.

Indirect Mentor impact risk:

- Mentor uses `Loader` and `RefreshStatus`, so those shared pieces may appear lighter.
- Mentor content cards, task cards, setup screens, and copy were not redesigned.

## Rollback Instructions

To roll back Step 4 only:

1. Revert the Step 4 portions of:
   - `lib/designTokens.js`
   - `styles/globals.css`
   - `components/ui/AppButton.js`
   - `components/ui/Loader.jsx`
   - `components/ui/RefreshStatus.js`
   - `components/ui/SectionHeader.js`
   - `components/BackButton.js`
   - `components/GoogleSignInCard.js`
2. Remove:
   - `docs/ui-theme/STEP_04_SHARED_PRIMITIVES_REPORT.md`
   - `docs/ui-theme/STEP_04_PRIMITIVE_VISUAL_CHECKLIST.md`

Do not revert unrelated Mentor/API worktree changes.

## User Visual Checks Requested

- Verify mixed-theme pages remain usable.
- Check shared loader readability on Dashboard, History, Quiz Setup, and Mentor.
- Check shared sign-in cards in guest states.
- Check AppCard/AppButton usage on Quiz Setup, Quiz, Result, and Leaderboard.

