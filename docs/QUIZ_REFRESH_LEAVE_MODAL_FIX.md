# Quiz Refresh Leave Modal Fix

## Files inspected

- `pages/quiz.js`
- `pages/result.js`
- `pages/quiz-setup.js`
- `pages/api/quiz-session/complete.js`
- `pages/api/score.js`
- `pages/api/history/reattempt.js`
- `pages/api/history/reattempt-filtered.js`

## Files changed

- `pages/quiz.js`
- `package.json`
- `scripts/test-quiz-refresh-leave-modal.js`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_FIX.md`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_CHECKLIST.md`

## Existing back-button modal handler found

The active quiz back/route-change guard already uses `showExitModal` with:

- `handleContinueQuiz`
- `handleEndQuiz`
- the existing `finishQuiz(..., { partial: true })` result path

Stored active quiz recovery already uses:

- `handleResumeStoredQuiz`
- `handleDiscardStoredAttempt`
- `showStoredSessionResult`

The refresh fix reuses those stored-session handlers instead of creating a new completion path.

## Refresh/reload detection

`pages/quiz.js` now uses `wasPageReload()`:

- `performance.getEntriesByType('navigation')[0]?.type === 'reload'`
- legacy fallback: `performance.navigation?.type === 1`

## Active unfinished quiz detection

The app continues to use the existing `ssc_active_quiz_session` localStorage state:

- `status === 'in_progress'`
- valid `questions` array
- not expired
- not already completed

## Restored state preservation

On reload, the stored active quiz session is not discarded and no new question set is fetched. The recovery prompt type becomes `reload_exit`, which shows the same Leave Quiz UI and waits for the user choice.

## Continue Quiz behavior

`Continue Quiz` calls `handleResumeStoredQuiz`, restoring:

- questions
- answers
- answer times
- current question index
- quiz session id
- Mentor/history/saved/source context

## End & See Result behavior

`End & See Result` calls `handleDiscardStoredAttempt`. If there are attempted answers, it routes through `showStoredSessionResult(..., { partial: true })`, which calculates the result from stored answers and navigates to the result page.

## Duplicate write protection

The existing frontend completion guard is preserved:

- active quiz session is cleared before navigating to result
- `quizComplete` is set
- the same stored `quizSessionId` is reused
- no new backend API or score/history write path was added

Result-page behavior remains unchanged.

## Quiz entry points covered

This applies to every quiz entry point because all active quizzes persist through the same `ssc_active_quiz_session` and restore through `pages/quiz.js`:

- Daily Challenge
- Subject quiz
- Topic quiz
- PYQ quiz
- Saved practice
- Repeated mistakes practice
- Quiz history re-attempt
- Mentor task
- Analysis CTA practice
- other existing quiz launches using `/quiz`

## Known limitations

Native browser toolbar refresh cannot show a custom React modal before the browser unloads the page. The browser may still show its own native unload prompt. After the reload, the app restores the active quiz session and shows the custom Leave Quiz modal immediately.

## Rollback instructions

Revert:

- `pages/quiz.js`
- `package.json`
- `scripts/test-quiz-refresh-leave-modal.js`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_FIX.md`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_CHECKLIST.md`
