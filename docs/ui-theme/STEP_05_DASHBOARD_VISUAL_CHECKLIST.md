# UI Step 5 - Dashboard Visual Checklist

## Dashboard Full Screen

- App shell should show the SSC Quest Light soft teal-white background.
- Dashboard content should not hide behind the fixed bottom nav.
- No horizontal overflow at 390-430px mobile width.

## Header And Greeting

- Top bar should be light, not dark navy.
- App title should be deep navy and readable.
- WhatsApp bell should remain functional.
- Greeting should use navy/slate hierarchy.

## Daily Challenge

- Hero card should be white/soft orange.
- Metadata pills should be readable on light background.
- Primary CTA should stay orange and rounded.
- Click should still open the existing daily quiz route.

## Coins / Streak / Rank

- Three stat cards should be white with soft borders/shadows.
- Coins should use teal/gold reward feeling.
- Streak should use orange/amber.
- Rank should use violet.
- Values should not change.

## Streak Habit Section

- Card should be light.
- Completed/today/future states should remain distinguishable.
- Streak action should still route to `/streak`.

## Discover Quizzes

- SSC PYQs and Parmar SSC cards should be white.
- Badges should be readable.
- Existing routes/actions should remain unchanged.
- Coming-soon behavior should remain unchanged.

## Weekly Champions

- Weekly Champions card should be light.
- Winner row should have soft accent surface.
- Rank and active/play-to-rank-up states should remain readable.
- Refresh status should still work.

## Guest State

- Guest sign-in nudge should remain visible and functional.
- Google sign-in flow should not change.

## Dashboard Modals / Toasts

- Low-question modal should be light and readable.
- Coming-soon modal should be light and readable.
- Parmar waitlist modal should be light and readable.
- Notify toast should remain readable above bottom nav.
- Shared WhatsApp modal may remain dark until the later modal/toast phase.

## Loading State

- Dashboard loading skeleton should render on the light shell.
- No white text on white background.

## Mentor Smoke

- `/mentor` should still render.
- No Mentor-specific screen redesign should be visible from this step beyond shared app shell/nav work already completed in earlier steps.

## Regression

- `/dashboard` builds and renders.
- `/subjects`, `/quiz-setup`, `/quiz`, `/result`, `/history`, `/leaderboard`, `/analysis`, `/profile`, and `/mentor` should still route/build.
- No API, quiz, scoring, auth, cache, Google Sheets, or route behavior should change.
