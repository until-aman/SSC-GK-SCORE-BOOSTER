# Bottom Navigation Scroll-Safe Visual Checklist

## Main Checks

- Bottom navigation remains fixed at the bottom.
- Nav pill remains centered within the 430px mobile frame.
- Nav remains readable over scrolling content.
- Content can scroll behind the nav without looking abruptly cut off.
- Last card/content on each page can be fully scrolled above the nav.
- Bottom fade/scrim is visible but subtle.
- Scrim does not block taps or scroll gestures.
- Safe-area spacing works at 390-430px mobile width.

## Routes To Check

- `/dashboard`
- `/subjects`
- `/quiz-setup`
- `/quiz`
- `/result`
- `/result/detailed`
- `/history`
- `/history/quizzes`
- `/history/saved`
- `/history/mistakes`
- `/history/coins`
- `/streak`
- `/leaderboard`
- `/analysis`
- `/profile`
- `/mentor` smoke only

## Sticky CTA Checks

- Quiz setup CTA remains reachable.
- Quiz player controls remain reachable.
- Result actions remain reachable.
- History filters/actions remain reachable.
- Profile bottom content remains visible.

## Regression Checks

- Bottom nav route list unchanged.
- Active tab logic unchanged.
- Icons and labels unchanged.
- No API/auth/quiz/scoring/Google Sheets logic changed.
- Mentor-specific UI not redesigned.
