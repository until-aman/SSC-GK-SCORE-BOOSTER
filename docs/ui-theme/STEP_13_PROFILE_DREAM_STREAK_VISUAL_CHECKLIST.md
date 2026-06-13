# UI Step 13: Profile, Dream Post, and Streak Visual Checklist

Use this checklist for Profile and Dream Post after Step 13.

## Profile Route

- Open `/profile` at mobile width around 390-430px.
- Confirm soft teal-white page background.
- Confirm content is not hidden behind bottom navigation.
- Confirm no horizontal overflow.

## Profile Header

- Header title is deep navy.
- Profile hero card is white with soft border/shadow.
- Avatar/image renders correctly.
- Fallback initial avatar is readable on soft teal.
- User name is navy and readable.
- Email handle/member-since metadata is slate and readable.
- Level and coins badges are visible and not harsh.

## Profile Stats

- Total Coins card is white and uses gold accent.
- Day Streak card is white and uses amber/orange accent.
- Level card is white and uses violet/rank accent.
- Labels are muted but readable.
- Tap targets still route/open as before.

## Dream Post

- Loading state uses light card and skeleton.
- Fetch error state is readable.
- No Dream Post state uses white card and orange setup CTA.
- Existing Dream Post card uses white surface.
- Dream Post title/name does not overflow.
- Progress percent is readable.
- Progress bar uses teal fill and pale track.
- Coins-needed text is readable.
- Edit action is teal and visible.

## Dream Post Edit / Setup Form

- Select input has white/soft surface and navy text.
- Custom input has readable placeholder.
- Validation error uses danger color.
- Save CTA is orange and readable.
- Cancel action is light/secondary and readable.
- Save/cancel/loading logic remains unchanged.

## Dream Post Unlocked

- Unlocked state uses white card.
- Gold/coin accent is readable.
- Full progress bar is visible.
- Edit action still works.

## Achievements

- Section title is navy.
- Achievement count is muted but readable.
- Unlocked badges are colorful but soft.
- Locked badges are pale/disabled but readable.
- Horizontal scroll works without page overflow.

## Quick Links / Account

- Streak History row is white and readable.
- Coins History row is white and readable.
- Chevrons are visible.
- Sign out remains danger-colored but calm.
- Sign out behavior is unchanged.

## Level Modal

- Overlay appears correctly.
- Bottom sheet is white with rounded top corners.
- Level rows are readable.
- Current level highlight uses violet softly.
- Got it button is readable and closes the modal.
- Modal does not overflow small screens.

## Skipped For Step 13B

- `/streak` still needs a dedicated light-theme migration.
- `/history/coins` still needs a dedicated light-theme migration.

## Regression Smoke

- `/profile` builds and renders.
- `/streak` builds and renders, even though not redesigned.
- `/history/coins` builds and renders, even though not redesigned.
- `/mentor` smoke-renders; Mentor is not redesigned.

## Watch For

- White text on white cards.
- Long emails or Dream Post names overflowing.
- Modal overflow on small screens.
- Quick-link route changes.
- Dream Post save/validation behavior changes.
- Accidental changes to Streak/Coins logic.
