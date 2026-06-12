# Step 07 Quiz Player Visual Checklist

Expected result: only the Quiz Player should be migrated to SSC Quest Light. Other screens may still be mixed.

## Active Quiz

- Page background is soft teal-white.
- Subject/topic context is readable in slate.
- Question number is readable in deep navy.
- Earn Coins hint is orange, not dark-muted.
- Progress track is pale and progress fill is teal.
- Timer ring track is visible on light background.
- Scoring row is readable with clear +2 and -0.5 colors.

## Question And Bookmark

- Question card is white with soft border/shadow.
- Long questions wrap without horizontal overflow.
- Bookmark icon is visible in default and saved states.
- Guest bookmark banner is white/readable.

## Answer Options

- Default options are white cards with navy text.
- A/B/C/D chips are visible and teal-accented.
- Selected/correct answer state has success-soft background and check icon.
- Wrong selected answer state has danger-soft background and red chip.
- Disabled feedback options remain legible enough to understand context.
- Correct/wrong states are not color-only because the existing check indicator remains.

## Actions

- Skip action is subtle teal and reachable.
- Exit modal primary action is orange and rounded.
- Exit modal secondary action is light/red-soft and readable.

## Loading, Error, Resume

- Loading carousel uses light cards and readable slate text.
- Loading retry button is orange and readable.
- Error card is white with readable title/body.
- Resume/expired attempt prompt is white and readable.
- Result transition loader has readable navy text.

## Mobile Safety

- Check 390-430px width.
- No horizontal overflow.
- Long option text wraps.
- Touch targets remain comfortable.
- Content is not hidden by fixed elements.
- No white text on white cards.

## Smoke Routes

- `/quiz`
- `/dashboard`
- `/subjects`
- `/quiz-setup`
- `/result`
- `/history`
- `/leaderboard`
- `/analysis`
- `/profile`
- `/mentor`

## Manual Workflow Checks

- Answer one question correctly.
- Answer one question wrongly.
- Skip one question.
- Use bookmark/save icon.
- Open exit modal.
- Complete quiz and confirm result navigation still happens.
