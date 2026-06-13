# UI Step 11: Leaderboard Visual Checklist

## Leaderboard

- Open `/leaderboard`.
- Confirm page background is soft teal-white.
- Confirm fixed header is light and readable.
- Confirm back/close control is visible on light background.
- Confirm Leaderboard title uses deep navy.
- Confirm Weekly / All Time tabs are visible.
- Confirm active tab is orange and inactive tab text is readable.
- Switch tabs and confirm data changes without layout breakage.
- Confirm loading state uses readable light loader/card.
- Confirm error state has readable retry action.
- Confirm empty state has readable copy and trophy marker.
- Confirm guest sign-in prompt still appears when applicable.
- Confirm no-rank prompt is white/light and readable.
- Confirm Your Rank card uses a soft teal/white surface.
- Confirm rank number is prominent.
- Confirm name, level, and coins are readable.
- Confirm Practice action routes visually as orange CTA.
- Confirm Top 3 Champions card is white with soft dividers.
- Confirm rank 1/2/3 labels are clear.
- Confirm top avatars/images still render or fall back cleanly.
- Confirm current user indicator still appears when applicable.
- Confirm normal rank rows are white cards with navy text.
- Confirm current-user row has a soft teal highlight.
- Confirm coins/score values are readable.
- Confirm refresh/updated status remains usable.
- Confirm fixed Practice to climb rank CTA is rounded, orange, and does not overlap bottom nav.
- Confirm long names truncate/wrap cleanly without horizontal overflow.
- Confirm the page is usable at 390-430px mobile width.
- Confirm no white text appears on white cards.
- Confirm no dark leaderboard cards remain unless intentionally outside visible Step 11 scope.

## Regression Smoke

- `/dashboard` still renders.
- `/subjects` still renders.
- `/quiz-setup` still renders.
- `/quiz` still renders.
- `/result` still renders.
- `/history` still renders.
- `/saved` still renders.
- `/history/saved` still renders.
- `/history/mistakes` still renders.
- `/leaderboard` still renders.
- `/analysis` still renders.
- `/profile` still renders.
- `/mentor` smoke-renders only; no Mentor redesign should be caused by Step 11.
