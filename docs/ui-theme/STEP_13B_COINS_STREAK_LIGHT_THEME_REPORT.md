# UI Step 13B: Coins History and Streak History Light Theme Report

## Scope

Step 13B migrated only the remaining History-family subpages:

- Coins History route: `/history/coins`
- Streak History route: `/streak`

The work was UI-only. Coins calculation, coins history fetching, streak calculation, streak history fetching, milestone/reward logic, routing, auth, cache, Google Sheets behavior, and Mentor files were not changed.

## Files Inspected

- `pages/history.js`
- `pages/history/coins.jsx`
- `pages/streak.js`
- `components/SessionRow.js`
- `components/HistoryTopBar.js`
- `components/BackButton.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `lib/designTokens.js`
- `styles/globals.css`
- `docs/ui-theme/STEP_09_HISTORY_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_10_SAVED_MISTAKES_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_13_PROFILE_DREAM_STREAK_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_15_GLOBAL_STATES_LIGHT_THEME_REPORT.md`
- `docs/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- `docs/UI_COMPONENT_INVENTORY.md`

## Files Changed

- `pages/history/coins.jsx`
- `pages/streak.js`
- `components/SessionRow.js`

## Route Files Identified

- Coins History: `pages/history/coins.jsx`, linked from History landing as `/history/coins`
- Streak History: `pages/streak.js`, linked from History landing as `/streak`

## Coins History Sections Migrated

- Loading shell
- Guest/sign-in shell
- Page header and refresh button
- Total coins and level/progress card
- Progress-to-next-level track/fill
- How to earn coins accordion/table
- Empty state
- Recent Sessions heading
- Session rows through `components/SessionRow.js`
- Show more/show less control
- Practice CTA kept orange and rounded

## Streak History Sections Migrated

- Loading shell
- Page background and bottom spacing
- Current streak hero card
- Protected/at-risk status pill
- Best streak pill
- Next milestone progress track
- Activity card
- Week/month segmented control
- Weekly day circles
- Month calendar controls and day cells
- Next milestone card
- Upcoming rewards rows
- Achieved rewards rows
- Bonus coins explanation strip
- Sticky practice/protect-streak CTA background

## States Preserved

- Authenticated and unauthenticated Coins History states
- Loading states for both pages
- Empty Coins History state
- Earn-coins accordion open/closed state
- Show all/collapse sessions state
- Week/month streak calendar state
- Month navigation state
- Played-today/protected and at-risk streak states
- Upcoming, achieved, and all-milestones-unlocked states
- Sticky streak CTA reveal behavior

## Loading, Empty, and Error States

- Coins loading now uses the SSC Quest Light page background and readable navy title.
- Coins guest state now uses the light page shell while retaining `GoogleSignInCard` behavior.
- Coins empty state now uses a white card, soft border, soft shadow, navy title, slate helper copy, and orange CTA.
- Streak loading now uses the SSC Quest Light page background and existing skeleton system.
- No fetch/retry/auth logic was changed.

## Exact Visual Changes

- Replaced dark app backgrounds with `--ssc-bg`.
- Replaced dark cards with white or soft orange/teal SSC Quest Light cards.
- Replaced dark borders with `--ssc-border-soft`.
- Added soft card shadows with `--ssc-shadow-card`.
- Updated primary text to `--ssc-text-primary`.
- Updated secondary/muted text to `--ssc-text-secondary` and `--ssc-text-muted`.
- Used gold/orange for coins and streak motivation.
- Used teal for progress, protected, completed, and review accents.
- Preserved orange primary CTAs with white text.
- Updated bottom padding to use the global bottom-nav-safe padding variable where applicable.

## Shared Components Changed

- `components/SessionRow.js` was migrated because Coins History renders its recent sessions through this shared history row component.
- The component API, props, date formatting, subject lookup, milestone branching, and displayed values were preserved.
- Possible indirect visual impact: any other screen using `SessionRow` will now receive the light SSC Quest row style. This is intentional for History-family consistency.

## Mentor Deferred Confirmation

No Mentor-specific files were edited. Mentor remains deferred and should only receive a smoke check.

## Known Remaining Mixed-Theme Areas

- Mentor remains intentionally deferred.
- Any future or hidden one-off history state not rendered by `/history/coins` or `/streak` should reuse the Step 15 global state rules.

## Rollback Instructions

To roll back Step 13B only, revert these files:

- `pages/history/coins.jsx`
- `pages/streak.js`
- `components/SessionRow.js`
- `docs/ui-theme/STEP_13B_COINS_STREAK_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_13B_COINS_STREAK_VISUAL_CHECKLIST.md`

Do not revert unrelated dirty files from previous UI steps or parallel workstreams.
