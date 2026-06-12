# UI Step 6 - Subject Selection + Quiz Setup SSC Quest Light Migration

## Scope

Migrated only:

- `pages/subjects.js`
- `pages/quiz-setup.js`

No Quiz Player, Result, History, Dashboard, API, Mentor, cache, auth, scoring, Google Sheets, route, or business logic files were changed.

## Files Inspected

- `pages/subjects.js`
- `pages/quiz-setup.js`
- `components/BackButton.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/RefreshStatus.js`
- `components/ui/Loader.jsx`
- `lib/designTokens.js`
- `styles/globals.css`
- `docs/ui-theme/STEP_02_THEME_TOKENS_REFERENCE.md`
- `docs/ui-theme/STEP_03_APP_SHELL_NAV_REPORT.md`
- `docs/ui-theme/STEP_04_SHARED_PRIMITIVES_REPORT.md`
- `docs/ui-theme/STEP_04B_SHARED_PRIMITIVE_STABILIZATION_REPORT.md`
- `docs/ui-theme/STEP_05_DASHBOARD_LIGHT_THEME_REPORT.md`
- `docs/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- `docs/UI_COMPONENT_INVENTORY.md`

## Files Changed

- `pages/subjects.js`
- `pages/quiz-setup.js`

## Subject Selection Sections Migrated

- Page background and local theme variables
- Header/back button
- Page title/subtitle
- Search input and focus ring
- Mixed GK Challenge featured card
- Subject cards and selected state
- Subject icon chips
- Question count pills
- Section labels
- Slow-fetch hint
- Error banner
- Empty search state
- Skeleton loading cards
- Fixed bottom CTA and disabled state

## Quiz Setup Sections Migrated

- Page background and local theme variables
- Back/header area
- Question count cards and selected state
- Subject picker trigger
- Topic picker trigger
- Available question count helper text
- Setup/info summary strip
- Refresh questions status area
- Start Quiz CTA
- Subject bottom sheet
- Topic bottom sheet
- Topic loading skeleton rows
- Retry/error helper text

## Sections Skipped

- Quiz Player was intentionally skipped for Step 7 because timer, answer, correct, wrong, and timeout states are high-risk.
- Other screens remain in their previous migration state.

## Exact Visual Changes

- Dark navy surfaces were replaced with SSC Quest Light white surfaces, soft teal-white background, soft borders, and soft shadows.
- Subject cards now use white surfaces with circular soft-accent icons.
- Selected states now use teal borders/soft fills instead of dark glows.
- Quiz Setup dropdown triggers and bottom sheets now use white/soft surfaces and navy/slate text.
- Disabled states use pale gray backgrounds and readable muted text.
- Orange remains reserved for the primary CTA.

## Step 4B CTA Radius Preservation

Preserved. The Quiz Setup primary CTA still includes:

- `rounded-[16px]`
- `borderRadius: 'var(--ssc-radius-button)'`

The CTA remains an orange rounded SSC Quest Light button when ready.

## Shared Components Changed

None.

## Mentor Deferred Confirmation

No Mentor-specific file was edited. Mentor remains deferred.

## Known Remaining Mixed-Theme Areas

- Quiz Player remains unmigrated until Step 7.
- Result, History, Saved, Leaderboard, Analysis, Profile, Landing, Onboarding, and Mentor remain outside this step.
- Shared modal/toast components remain scheduled for the later final UI phase.

## Rollback

Revert:

- `pages/subjects.js`
- `pages/quiz-setup.js`

Then delete this Step 6 report/checklist if the documentation checkpoint should also be removed.
