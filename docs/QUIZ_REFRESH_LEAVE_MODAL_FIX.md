# Quiz Refresh Leave Modal Fix

## Files inspected

- `pages/quiz.js`
- `pages/result.js`
- `pages/quiz-setup.js`
- `scripts/test-quiz-refresh-leave-modal.js`
- `pages/api/quiz-session/complete.js`
- `pages/api/score.js`
- `pages/api/history/reattempt.js`
- `pages/api/history/reattempt-filtered.js`
- GitHub PR #105 / #106 deployment metadata

## Files changed

- `pages/quiz.js`
- `package.json`
- `scripts/test-quiz-refresh-leave-modal.js`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_FIX.md`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_CHECKLIST.md`

## Production / merge verification

- Previous refresh fix commit: `489a02e929f3c706ed258006cd3b2696e668da9c`
- Previous refresh fix PR: #105
- Previous refresh fix merge commit on `main`: `4fb38f263e6d587576fbd38d24ba4f0a3d9310b5`
- Latest checked `origin/main`: `56a61f7cd82cb145015f74edd9ca428d729efe16`
- GitHub deployments showed Production deployed `56a61f7cd82cb145015f74edd9ca428d729efe16` successfully.

Conclusion: production was running a commit that contained the previous refresh fix. The issue was implementation reliability, not a missing merge.

## What was wrong with the previous implementation

- `beforeunload` still called `event.preventDefault()` and set `event.returnValue`, which relies on the browser-native reload prompt instead of the SSC Quest Light modal flow.
- The app relied mostly on `performance.getEntriesByType('navigation')[0]?.type === 'reload'` after reload. That is useful, but not enough as the only signal in production browser flows.
- The quiz setup/dashboard fallback redirect could run before persisted active-session recovery finished. If the refreshed URL did not have enough query params, the user could be redirected before the Leave Quiz modal had a chance to render.

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

`pages/quiz.js` now uses a two-signal approach:

- `performance.getEntriesByType('navigation')[0]?.type === 'reload'`
- legacy fallback: `performance.navigation?.type === 1`
- `sessionStorage` marker: `ssc_active_quiz_reload_pending`

Before unload, the active quiz session is persisted and the marker is written. The handler does not block the browser with a native prompt. After reload, the marker is consumed once and the recovery prompt becomes `reload_exit`.

## Active unfinished quiz detection

The app continues to use the existing `ssc_active_quiz_session` localStorage state:

- `status === 'in_progress'`
- valid `questions` array
- not expired
- not already completed

## Restored state preservation

On reload, the stored active quiz session is not discarded and no new question set is fetched. The recovery prompt type becomes `reload_exit`, which shows the same Leave Quiz UI and waits for the user choice.

The dashboard/setup fallback redirect now waits until active-session recovery has completed, so it cannot preempt a restored quiz.

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

## Modal loop protection

- The reload marker is consumed and removed during recovery.
- `Continue Quiz` writes the restored session and closes the recovery prompt.
- `End & See Result` clears the active quiz session before navigating to result.
- If the user refreshes again during the same active quiz, `beforeunload` writes a fresh marker and the modal appears again after reload.

## Local production-like validation

Ran `npm run build` and started `next start` locally with `NEXTAUTH_SECRET` on port 3057.

Manual full-path quiz reproduction was blocked in this environment:

- `/quiz?subject=Polity&topic=Constitution&count=5` showed `Couldn't load quiz`.
- `/quiz?mode=daily` showed `Couldn't load quiz`.
- In-app browser automation blocks direct `localStorage/sessionStorage` seeding through the read-only evaluation sandbox and also blocks `javascript:` URL seeding by browser security policy.

Because of that, the full click-through entry-point matrix remains pending for a real environment with quiz data/API access. The implemented recovery path is covered by `scripts/test-quiz-refresh-leave-modal.js`, which checks reload detection, interrupted-session marker behavior, no native `beforeunload` prompt, redirect gating, and reuse of existing stored-session handlers.

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

Native browser toolbar refresh cannot show a custom React modal before the browser unloads the page. The fixed behavior is: persist session, mark interrupted reload, allow reload, restore state, then show the custom Leave Quiz modal immediately. The app no longer intentionally triggers the browser-native refresh confirmation.

## Rollback instructions

Revert:

- `pages/quiz.js`
- `package.json`
- `scripts/test-quiz-refresh-leave-modal.js`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_FIX.md`
- `docs/QUIZ_REFRESH_LEAVE_MODAL_CHECKLIST.md`
