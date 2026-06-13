# UI Step 10: Saved Questions + Repeated Mistakes Light Theme Report

## Scope

Step 10 migrated only the real Saved Questions and Repeated Mistakes screens:

- `pages/history/saved.jsx`
- `pages/history/mistakes.jsx`

`pages/saved.js` was inspected and left unchanged because it is only a redirect to `/history?section=saved`. No standalone `pages/repeated-mistakes.js` route exists in this repository; the real screen is `/history/mistakes`.

## Preview Usage

The attached Step 10 preview was used as visual direction for:

- soft teal-white page backgrounds
- white question cards with soft borders and shadows
- navy question text and slate metadata
- teal saved/revision accents
- orange primary revision/practice CTAs
- soft danger styling for repeated mistake emphasis
- compact filter chips and mobile-first spacing

The existing app structure, data, actions, routes, and state handling remained the source of truth. No preview question text, counts, subjects, topics, dates, or sample data were hardcoded.

## Files Inspected

- `pages/saved.js`
- `pages/history/saved.jsx`
- `pages/history/mistakes.jsx`
- `components/HistoryTopBar.js`
- `components/ui/Loader.jsx`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/RefreshStatus.js`
- `lib/designTokens.js`
- `styles/globals.css`

## Files Changed

- `pages/history/saved.jsx`
- `pages/history/mistakes.jsx`

## Saved Questions Sections Migrated

- Saved Questions page background
- Shared History top bar integration
- Subtitle/header area
- Guest sign-in banner placement retained
- Empty saved questions state
- Search input
- Filter chips
- Sort dropdown
- Saved question cards
- Subject/topic tags
- Saved date metadata
- Bookmark/unsave icon button
- View action
- Sticky Start Revision CTA
- Full-screen revision overlay
- Revision option states
- Correct answer and explanation panel
- Mark as Revised / Remove from Saved actions

## Repeated Mistakes Sections Migrated

- Repeated Mistakes page background
- Shared History top bar integration
- Intro subtitle
- Subject/source chips
- Topic chips
- Active filter summary
- Repeated question count card
- Repeated mistake cards
- Smart status pill tones
- Wrong/skipped counters
- Expanded answer detail
- Practice Again CTA
- Open/Close secondary action
- Save question icon action
- Empty/loading/error panels

## States Preserved

- Saved Questions loading state
- Saved Questions empty state
- Saved Questions search-empty state
- Guest and authenticated states
- Saved question unsave action
- Saved revision reveal/check-answer state
- Saved revision selected/correct/wrong option states
- Mark as revised state
- Repeated Mistakes loading state
- Repeated Mistakes error state
- Repeated Mistakes empty state
- Subject/topic filter states
- Expanded/collapsed repeated question state
- Save/unsave repeated question state
- Practice all and practice-one actions

## Filter/Search/Sort Styling

Saved Questions search now uses a white input with a soft border and navy text. Saved filter chips use teal when active and white surfaces when inactive. Sort remains the same native select and uses light surface styling.

Repeated Mistakes subject/topic chips use the same light chip language, with teal selected states and white inactive states.

## Card Styling

Saved question cards now use white surfaces, soft borders, soft shadows, navy question text, teal subject chips, slate metadata, and a soft teal bookmark chip.

Repeated mistake cards now use white surfaces, navy question text, teal subject/topic metadata, soft danger/warning/success status pills, and light expanded answer panels.

## CTA Styling

Primary actions remain orange:

- Saved Questions empty-state Start Practice
- Saved Questions sticky Start Revision
- Saved revision Check Answer when an option is selected
- Repeated Mistakes Practice All
- Repeated Mistakes Practice Again

Secondary actions use white or soft teal surfaces with teal/navy text.

## Shared Components

No generic shared primitives were changed in Step 10. `HistoryTopBar` was already migrated in Step 9 and is reused here.

## Sections Skipped

- `pages/saved.js` redirect logic was intentionally unchanged.
- Coins History and Streak History remain deferred.
- Leaderboard, Analysis, Profile, Landing/onboarding, and Mentor remain deferred.

## Mentor Deferred Confirmation

No Mentor tab files or Mentor-specific component files were edited.

## Known Remaining Mixed-Theme Areas

Outside Step 10 scope, Coins History, Streak History, Leaderboard, Analysis, Profile, Landing/onboarding, and Mentor may still contain dark or mixed-theme sections.

## Rollback

To roll back Step 10 only, revert:

- `pages/history/saved.jsx`
- `pages/history/mistakes.jsx`
- `docs/ui-theme/STEP_10_SAVED_MISTAKES_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/STEP_10_SAVED_MISTAKES_VISUAL_CHECKLIST.md`

Do not revert earlier SSC Quest Light steps unless intentionally rolling back the full UI migration branch.
