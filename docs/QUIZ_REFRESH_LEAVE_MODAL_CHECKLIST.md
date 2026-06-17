# Quiz Refresh Leave Modal Checklist

## Entry points

- [ ] Daily Challenge refresh.
- [ ] Subject quiz refresh.
- [ ] Topic quiz refresh.
- [ ] PYQ refresh.
- [ ] Saved practice refresh.
- [ ] Repeated mistakes refresh.
- [ ] Quiz history re-attempt refresh.
- [ ] Mentor task refresh.

## Modal behavior

- [x] Browser reload detection added.
- [x] Active unfinished quiz detection uses existing persisted quiz session.
- [x] Refresh recovery shows `Leave quiz?`.
- [x] Attempted count displays even at `0 / N attempted`.
- [x] Progress bar displays.
- [x] `Continue Quiz` restores stored session.
- [x] `End & See Result` uses stored attempt result logic.
- [x] No generic restart path added.

## Safety

- [x] No modal on first start when no active stored session exists.
- [x] No modal on result page.
- [x] No modal on quiz setup page.
- [x] No API changes.
- [x] No scoring logic changes.
- [x] No Google Sheets logic changes.
- [ ] Manual no duplicate history write verification.

## Validation

- [x] `npm run test:quiz-refresh-leave-modal`
- [x] `npm run lint`
- [x] `npm run build`
