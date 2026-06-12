# UI Step 6 - Subject Selection + Quiz Setup Visual Checklist

## Subject Selection

- Page header and title use deep navy/slate text on light background.
- Back button is readable and touch-safe.
- Search input is white, readable, and has a teal focus ring.
- Mixed GK Challenge card uses a soft light gradient, not dark navy.
- Subject cards are white with soft border/shadow.
- Subject icon chips are circular and readable.
- Subject titles use deep navy.
- Subtitles and counts use slate/teal hierarchy.
- Selected subject state uses teal border/fill.
- Category labels are readable.
- Loading skeletons are light, not dark.
- Error banner text is readable.
- Empty search state is readable.
- Fixed bottom CTA does not overlap bottom nav.
- Disabled CTA is pale gray and readable.
- 390-430px width has no horizontal overflow.
- No white text appears on white cards.

## Quiz Setup

- Back/header area uses light surfaces and navy/slate text.
- Question count cards are white with soft border/shadow.
- Selected count state uses teal.
- Subject dropdown trigger is white and readable.
- Topic dropdown trigger is white and readable.
- Available question count text uses teal/slate and remains readable.
- Setup/info summary card is white with soft border/shadow.
- Refresh questions link/status remains functional and readable.
- Start Quiz CTA is orange, rounded, and readable.
- Step 4B radius fix remains visible.
- Disabled/no-question state is pale gray and readable.
- Subject bottom sheet is light.
- Topic bottom sheet is light.
- Loading/error states remain readable.
- Bottom spacing is safe above fixed bottom nav.
- 390-430px width has no horizontal overflow.

## Regression

- `/subjects` builds and renders.
- `/quiz-setup` builds and renders.
- `/dashboard` still renders after Step 5.
- `/mentor` smoke-renders with no Mentor-specific redesign.
- Quiz Player is not visually migrated in this step.
- API, auth, cache, scoring, Google Sheets, and route behavior remain unchanged.
