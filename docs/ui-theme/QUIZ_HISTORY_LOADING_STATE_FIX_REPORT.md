# Quiz History Loading State Fix Report

## Files inspected

- `components/ui/SmartHistoryLoader.jsx`
- `components/ui/Loader.jsx`
- `pages/history.js`
- `pages/history/quizzes.jsx`
- `pages/history/questions.jsx`
- `pages/history/mistakes.jsx`
- `pages/history/saved.jsx`
- `pages/history/coins.jsx`
- `pages/history/session/[sessionId].jsx`
- `pages/streak.js`
- `pages/analysis.jsx`
- `pages/saved.js`
- `styles/globals.css`
- `lib/designTokens.js`

## Files changed

- `components/ui/SmartHistoryLoader.jsx`
- `pages/history/quizzes.jsx`
- `pages/streak.js`
- `pages/analysis.jsx`

## What was wrong

The previous smart loader rendered as separate cards with a desktop-style two-column layout at wider breakpoints. On mobile this created a cramped, tall loading state with awkward text flow and extra scrolling. Progress was derived from a fixed active step, so it stayed at a static value instead of moving while data loaded.

## Preview usage

The attached `Quiz History Loading States` preview was used as the visual source of truth. The updated loader follows the phone mockup structure: existing header, short page subtitle where the page already has one, one white rounded loading card, centered illustration, title, subtitle, progress row, compact steps, tip card, and dot indicator.

## Final mobile layout

The loader is now a single compact card sized for 390px to 430px screens. It uses a 22px to 24px card radius, white surface, soft border, soft card shadow, navy/slate typography, and teal/orange/red/green/amber/violet context accents.

## Why the two-column layout was removed

The preview shows one phone card, not separate desktop panels. Removing the two-column media query keeps the loading state stable on mobile, prevents the step list from becoming a side column, and helps the card fit above the fixed bottom nav.

## Dynamic progress logic

`SmartHistoryLoader` now starts around 12% to 18%, increments every 360ms, and caps around 88% to 92% while loading. It also supports `isLoading` and `isReady`; when marked ready it animates to 100%.

## Step animation logic

The active step is mapped from progress:

- 0 to 25: step 1
- 26 to 45: step 2
- 46 to 65: step 3
- 66 to 85: step 4
- 86 to 100: step 5

Completed steps use a filled accent dot with a check. The active step uses a filled accent dot. Upcoming steps use muted outline dots.

## Page and filter aware copy

The component now contains context copy for quiz history, saved questions, repeated mistakes, coins history, streak history, reports, subject history, topic history, session review, wrong, correct, skipped, saved, repeated, and never-correct filters. Callers can still override `title`, `subtitle`, `steps`, `tip`, and `accent`.

## Pages where the loader is used

- Quiz History landing: `pages/history.js`
- Quiz-wise history: `pages/history/quizzes.jsx`
- Subject-wise history: `pages/history/quizzes.jsx`
- Topic-wise/question review loading: `pages/history/questions.jsx`
- Saved Questions: `pages/history/saved.jsx`
- Repeated Mistakes: `pages/history/mistakes.jsx`
- Coins History: `pages/history/coins.jsx`
- Streak History: `pages/streak.js`
- Reports: `pages/analysis.jsx`
- Session review: `pages/history/session/[sessionId].jsx`

## Viewport and bottom-nav checks

The card is capped at 430px wide, uses compact spacing, has a small-height media query, and keeps bottom safe-area padding. The loader no longer creates a multi-card/two-column layout, so it is designed to fit in one mobile viewport above the fixed bottom nav.

## API and data safety

No API files were changed. No Google Sheets logic, fetch logic, saved question logic, repeated mistake logic, score/history logic, quiz logic, mentor logic, auth logic, or backend data model was changed.

## Rollback instructions

Revert these files to restore the previous loading behavior:

- `components/ui/SmartHistoryLoader.jsx`
- `pages/history/quizzes.jsx`
- `pages/streak.js`
- `pages/analysis.jsx`
- `docs/ui-theme/QUIZ_HISTORY_LOADING_STATE_FIX_REPORT.md`
- `docs/ui-theme/QUIZ_HISTORY_LOADING_STATE_CHECKLIST.md`
