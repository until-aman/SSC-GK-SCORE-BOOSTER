# UI Step 12: Analysis Visual Checklist

Use this checklist for the Analysis tab after Step 12.

## Route

- Open `/analysis` at mobile width around 390-430px.
- Confirm the page background is soft teal-white.
- Confirm bottom nav spacing remains safe.
- Confirm no horizontal page overflow.

## Header

- Header uses a light translucent surface.
- Title is deep navy and readable.
- Premium badge is readable and not too loud.
- WhatsApp/community bell remains usable.

## Guest State

- Guest benefit list uses white cards and navy/slate text.
- Locked preview remains visually clear on light background.
- Unlock modal uses light card, soft overlay, readable copy, and working close button.
- Google sign-in button remains readable and functional.

## Loading / Empty

- Session loading spinner appears on soft light background.
- Activity loading state is readable.
- No-history card is white and readable.
- Start Quiz CTA remains orange and routes as before.

## Real Activity / Journey

- GK Journey card uses white surface and soft shadow.
- Quizzes, Questions, and Coins metric tiles are readable.
- Long user names do not overflow.
- Most practiced and last quiz lines remain readable.

## Reveal / Sample Analysis

- Preview gate card is light and readable.
- See My Analysis Preview CTA is orange and rounded.
- Sample Analysis label is readable after reveal.

## Subject Health

- Horizontal subject cards scroll without page overflow.
- Selected subject card is visually clear.
- Strong, Good, Improve, and Focus status pills are readable.
- Percentages have enough contrast.

## Practice Plan

- Plan card is light, not dark.
- Current accuracy, target, progress track, and target marker are readable.
- Marks recoverable insight uses soft warning/orange, not harsh red.
- Practice CTA is orange, rounded, and readable.
- Practice CTA route/action still works if clicked in a safe test session.

## Topic Recommendations

- Filter chips show selected and inactive states clearly.
- Topic cards are white with navy titles and slate metadata.
- Strong, weak, improve-fast, and high-weightage tags are readable.
- Progress rings are visible on light background.
- Practice 25Q action remains orange and usable.
- View More action remains visible.

## Premium Locked Section

- Premium AI card is light with subtle teal/premium treatment.
- Checklist items are readable.
- View Detailed Analysis locked CTA remains readable and scrolls to interest CTA.
- Premium remains locked.

## Interest / Notify CTA

- Default notify card is light and readable.
- Notify CTA is orange and rounded.
- Guest sign-in state is readable.
- Recorded state uses teal success treatment.
- Error text uses danger color and remains legible.
- Interest validation logic is unchanged.

## Regression Smoke

- `/dashboard` still renders.
- `/subjects` still renders.
- `/quiz-setup` still renders.
- `/quiz` still renders.
- `/result` still renders.
- `/history` still renders.
- `/saved` still renders.
- `/leaderboard` still renders.
- `/profile` still renders.
- `/mentor` smoke-renders; Mentor is not redesigned.

## Watch For

- White text on white surfaces.
- Dark Analysis cards left behind.
- Long topic names overflowing.
- CTAs hidden behind bottom nav.
- Color-only state indicators without labels.
- Any changed API, notify, premium, or practice route behavior.
