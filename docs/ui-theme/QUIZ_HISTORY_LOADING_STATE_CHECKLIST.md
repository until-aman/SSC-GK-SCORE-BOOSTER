# Quiz History Loading State Checklist

## Screens

- [ ] Quiz History loading uses `SmartHistoryLoader`.
- [ ] Quiz-wise history loading uses `SmartHistoryLoader`.
- [ ] Saved Questions loading uses saved-specific copy.
- [ ] Repeated Mistakes loading uses repeated-mistake-specific copy.
- [ ] Coins History loading uses coins-specific copy.
- [ ] Streak History loading uses streak-specific copy.
- [ ] Reports loading uses reports-specific copy.
- [ ] Wrong filter loading uses wrong-answer copy.
- [ ] Correct filter loading uses correct-question copy.
- [ ] Skipped filter loading uses skipped-question copy.
- [ ] Subject-wise loading uses subject-aware copy.
- [ ] Topic-wise loading uses topic-aware copy.
- [ ] Session review loading uses review-session copy.

## Progress

- [ ] Progress does not stay fixed at 40%.
- [ ] Progress starts around 12% to 18%.
- [ ] Progress moves gradually every few hundred milliseconds.
- [ ] Progress caps below completion while still loading.
- [ ] Progress can animate to 100% when `isReady` is passed.
- [ ] Processing step state changes as progress advances.

## Mobile layout

- [ ] Loader is a compact single-card mobile layout.
- [ ] Loader does not use a two-column layout.
- [ ] Loader fits in one 390px to 430px mobile screen.
- [ ] No scroll is needed just to view the loading state.
- [ ] Bottom nav remains visible.
- [ ] Loader content does not overlap the bottom nav.
- [ ] Title and subtitle do not wrap badly.
- [ ] Step rows are compact and readable.
- [ ] Tip card remains inside the main card.
- [ ] Dot indicator appears below the tip card.

## Performance and safety

- [ ] No heavy GIF is used.
- [ ] No Lottie file is used.
- [ ] No large image asset is added.
- [ ] Loader uses lightweight SVG and CSS animation only.
- [ ] No API files changed.
- [ ] No Google Sheets logic changed.
- [ ] No auth logic changed.
- [ ] No quiz/session data logic changed.

## Validation

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Slow network simulation confirms Quiz History loader matches preview.
- [ ] Slow network simulation confirms Saved Questions copy.
- [ ] Slow network simulation confirms Repeated Mistakes copy.
- [ ] Slow network simulation confirms wrong filter copy.
- [ ] Slow network simulation confirms correct filter copy.
- [ ] Slow network simulation confirms skipped filter copy.
- [ ] Actual content appears once data is ready.
