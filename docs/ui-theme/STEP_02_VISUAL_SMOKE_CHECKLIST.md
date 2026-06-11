# Step 02 Visual Smoke Checklist

Expected result after Step 2: the app may still look mostly dark. This is correct because no screen migration has started.

## Pages To Inspect Later

- Landing/login
- Dashboard/Home
- Subject selection
- Quiz setup
- Quiz player
- Result
- Detailed result
- Leaderboard
- History landing
- Quiz history
- Saved questions
- Repeated mistakes
- Coins history
- Streak history
- Analysis
- Profile
- Mentor

## Expected Checks

- App still loads with the current dark theme.
- Bottom navigation still renders and routes correctly.
- Existing dark cards/buttons still look unchanged.
- Loading states still render.
- No new light utility class is visible unless a future page opts into it.
- Mentor still renders but is not redesigned.
- No API route behaviour changes.
- No quiz/scoring/timer behaviour changes.
- No Google Sheets logic changes.

## Mentor Smoke Check

Mentor-specific files are intentionally untouched in Step 2. The smoke check for this phase is build/render safety only, not visual redesign approval.

