# UI Step 13: Profile, Dream Post, and Streak Light Theme Report

## Scope

Step 13 migrated the Profile screen and Dream Post component only:

- `pages/profile.js`
- `components/DreamPostCard.jsx`

Streak History and Coins History were inspected but skipped for a follow-up Step 13B because they are separate, larger routes with many independent calendar/reward/session states.

No API routes, profile fetching, auth/session handling, sign-out behavior, Dream Post save logic, coins calculation, streak calculation, level calculation, achievement unlock logic, cache logic, Google Sheets logic, scoring logic, route names, or Mentor-specific files were changed.

## Preview Usage

The attached Step 13 preview was used as visual direction for:

- soft teal-white page background
- white profile cards with soft borders and shadows
- navy/slate typography
- gold coin accents
- amber/orange streak accents
- teal progress accents
- violet level/achievement accents
- calm personal-progress profile feeling
- aspirational Dream Post progress treatment

The existing Profile and Dream Post code remained the source of truth. No preview names, avatars, ranks, coins, streaks, levels, dream posts, dates, achievements, or sample data were hardcoded.

## Files Inspected

- `pages/profile.js`
- `components/DreamPostCard.jsx`
- `pages/streak.js`
- `pages/history/coins.jsx`
- `components/BackButton.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `components/GoogleSignInCard.js`
- `lib/designTokens.js`
- `styles/globals.css`
- Step 2 through Step 12 UI-theme reports
- `docs/ui-theme/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- `docs/ui-theme/UI_COMPONENT_INVENTORY.md`

## Files Changed

- `pages/profile.js`
- `components/DreamPostCard.jsx`

## Profile Sections Migrated

- Profile page background
- Header title
- Avatar/profile hero card
- User name, email handle, and member-since metadata
- Level and coins badges
- Total coins, day streak, and level stat cards
- Achievements heading and achievement cards
- Quick links for Streak History and Coins History
- Account/sign-out section
- Level Progress bottom sheet/modal
- Profile loading skeleton shell remains intact

## Dream Post Sections Migrated

- Loading state
- Fetch error state
- No Dream Post setup state
- Edit/set form state
- Select and custom input controls
- Save/cancel buttons
- Existing Dream Post progress card
- Progress bar and handle
- Coins-needed text
- Unlocked Dream Post state

## States Preserved

- Guest redirect behavior
- Guest display state where reachable
- Authenticated profile state
- Profile loading state
- Profile cache-backed fetch behavior
- Dream Post loading/error/setup/edit/saving/unlocked states
- Level modal open/close state
- Sign out action
- Quick-link routing
- Achievement unlock conditions

## Profile Stat Card Styling

Profile stats now use white cards, soft borders, and soft shadows. Coin count uses gold, streak uses amber/orange, and level uses violet/rank accent while labels use muted slate.

## Dream Post Progress / Form Styling

Dream Post cards now use white surfaces, soft borders, teal progress fill, muted progress track, orange save/setup actions, and readable navy/slate text. Inputs use soft surfaces with teal focus borders. Existing Dream Post save and validation logic was not changed.

## Achievement Styling

Achievements now sit on light cards. Unlocked badges retain their established accent colors and glow in a softer way; locked badges use pale disabled surfaces and muted text.

## Quick Links / Account Styling

Profile quick links now use white list cards with soft shadows and navy text. Sign out remains visually danger-coded but calm.

## Streak History

Skipped for Step 13B. `pages/streak.js` was inspected and remains unchanged because it is a standalone screen with week/month calendar, milestone, reward, and sticky CTA states that should be migrated in one dedicated pass.

## Coins History

Skipped for Step 13B. `pages/history/coins.jsx` was inspected and remains unchanged because it is a standalone screen with level progress, earn-coins accordion, session history, empty state, and sticky CTA states.

## Loading / Error / Empty States

Profile loading skeleton remains functional. Dream Post loading, fetch error, setup, and edit validation states were migrated to light surfaces. Streak and Coins states were not changed.

## Shared Components

No shared UI primitives were changed. `GoogleSignInCard` is consumed as before.

## Mentor Deferred Confirmation

No Mentor tab files or Mentor-specific component files were edited.

## Known Remaining Mixed-Theme Areas

Outside Step 13 scope, Streak History, Coins History, Landing/onboarding, `pages/personal-ai-analysis.jsx`, and Mentor may still contain dark or mixed-theme UI.

## Rollback

To roll back Step 13 only, revert:

- `pages/profile.js`
- `components/DreamPostCard.jsx`
- `docs/ui-theme/STEP_13_PROFILE_DREAM_STREAK_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_13_PROFILE_DREAM_STREAK_VISUAL_CHECKLIST.md`

Do not revert Step 12 or previous SSC Quest Light steps unless intentionally rolling back the broader UI migration.
