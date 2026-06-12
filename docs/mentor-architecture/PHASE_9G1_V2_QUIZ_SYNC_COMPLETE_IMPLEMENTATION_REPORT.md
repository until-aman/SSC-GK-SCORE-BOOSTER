# Phase 9G1 — V2 Quiz-Sync COMPLETE Path Implementation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Implement the V2 `COMPLETE` path for the **quiz-return flow only** (`quiz_sync` + evidence), gated to the allowlisted test user. **Implementation + fake/in-memory tests only — no live COMPLETE mutation.**
**Date:** 2026-06-11
**Result:** ✅ Quiz-sync COMPLETE implemented + fully fake-tested; evidence-enforcement gap closed; manual `complete` stays legacy; gated/inactive in live; live Sheet unchanged (COMPLETE events = 0). 384 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/domain/taskStateMachine.js` | `completeTask` now enforces evidence for quiz tasks: `quiz_sync` (or verified `manual_recovery`) only, **rejecting the default/`mentor_response`**, and requires a non-empty `linkedQuizSessionId` for `quiz_sync`; sets `linkedQuizSessionId`; clears `pendingReason`/`movedToPendingAt` on completion. |
| `lib/mentor/repository/sheetsMutationRepository.js` | Added `linkedQuizSessionId → LinkedQuizSessionId` to the write whitelist (`TASK_UPDATE_COLUMNS`). |
| `lib/mentor/read/taskActionRouting.js` | Added `shouldRouteQuizCompletionThroughV2(identity)` (flags + cohort allowlist; **not** the snooze/resume whitelist). |
| `lib/mentor/read/v2TaskActionHandler.js` | Added `executeV2QuizComplete(...)` (guarded COMPLETE with `quiz_sync`+`linkedQuizSessionId` + StudentTopicState side-effect via injected callback) and `classifyQuizResult`. |
| `pages/api/mentor/quiz-return.js` | Gated V2 quiz-complete branch (allowlisted only); legacy behaviour unchanged when the gate is false; fail-closed once entered. |
| `lib/mentor/read/v2MutationMonitor.js` | Added `completeMutationCount`, `canonicalCompleteEvents`, `completedQuizSyncTaskCount`. |
| `scripts/test-mentor-v2-complete.js` | **New** — 21 fake-client quiz-sync COMPLETE tests. |
| `scripts/test-mentor-task-state-machine.js`, `scripts/test-mentor-v2-complete-design.js` | Updated assertions for the new evidence rule (the "gap" test now asserts the gap is **closed**; quiz_sync cases pass `linkedQuizSessionId`). |
| `package.json` | Added `test:mentor-v2-complete`. |

## 2. Evidence-enforcement fix (Phase 9F gap closed)
Previously a quiz task with **no** completion source completed via the default `mentor_response` (no evidence). Now `completeTask` rejects quiz-task completion unless the source is explicitly `quiz_sync` (or verified `manual_recovery`), and `quiz_sync` additionally requires a non-empty `linkedQuizSessionId`. Verified: `INVALID_COMPLETION_SOURCE` for no-source / `mentor_response`; `LINKED_QUIZ_SESSION_REQUIRED` for `quiz_sync` without a session id. Non-quiz tasks (theory via `mentor_response`, checks via `mentor_response`) are unchanged.

## 3. Quiz-return V2 gate
`shouldRouteQuizCompletionThroughV2(identity)` requires all three mutation flags **and** the user's scope hash in `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` (fail-closed if empty). It is independent of the manual `snooze`/`resume` whitelist. Verified: passes for the allowlisted test user; fails closed with no allowlist; manual `complete` is **not** whitelisted for V2.

## 4. Manual complete legacy confirmation
`task-action.js` accepts `complete` only on the **legacy** path; `complete` is **not** in `V2_CUTOVER_ACTIONS` (`['snooze','resume']`) and `shouldRouteActionThroughV2('complete')` is `false` even with all flags on. The manual "mark done" / response completion stays legacy.

## 5. LinkedQuizSessionId write support
`TASK_UPDATE_COLUMNS` maps `linkedQuizSessionId → LinkedQuizSessionId`; the repository writes only the whitelisted COMPLETE fields (`Status`, `CompletedAt`, `CompletionSource`, `LinkedQuizSessionId`, `PendingReason`, `MovedToPendingAt`, `RowVersion`) and never adds unmapped columns. Verified in fake tests (LinkedQuizSessionId = `QS1` written; pending fields blank).

## 6. StudentTopicState side-effect support
`executeV2QuizComplete` derives a practice update from the quiz score (`classifyQuizResult` mirrors the legacy quiz-return logic) and calls the injected `upsertTopicState` (wired in the route to the existing `upsertStudentTopicState`) with `PracticeStatus`, `RecentAccuracy`, `ConfidenceLevel`, `LastPracticeUpdatedAt`, `LastQuizAttemptAt`. It runs **once** (only on a fresh, non-idempotent completion), never resets fields, and does not touch XP/coins. Verified: upsert called exactly once with the expected practice fields; not called on idempotent replay.

## 7. Fake COMPLETE mutation results (in-memory)
`active → completed`; `CompletedAt` set; `CompletionSource=quiz_sync`; `LinkedQuizSessionId=QS1`; `PendingReason`/`MovedToPendingAt` blank; `RowVersion 1→2`; **+1** canonical `COMPLETE` event (`FromStatus=active`, `ToStatus=completed`); **+1** idempotency row (`Action=COMPLETE`); idempotent replay writes no second event/idempotency row and does not re-bump RowVersion; duplicate completion with a new op id → `DUPLICATE_COMPLETION`; historical/hidden tasks rejected; missing `quizSessionId` → `LINKED_QUIZ_SESSION_REQUIRED`.

## 8. Monitor changes
Added `completeMutationCount`, `canonicalCompleteEvents`, `completedQuizSyncTaskCount` to the read-only audit (verified counting a fake completed quiz_sync task). No writes; the audit runs even when `update`/`append` are wired to throw.

## 9. Read-only live validation
No live mutation. Monitor on the live Sheet:
```text
MentorMutationRequests: 2   MentorTaskLogs: 31
POSTPONE events: 1   RESUME events: 1   COMPLETE events: 0
duplicateIdempotencyKeys: 0   unexpectedMutationsOutsideAllowlist: 0
affectedRealPlanStatus: { completed: 5, snoozed: 10 }   (unchanged)
rollover/pending lifecycle flags: false
```

## 10. Tests / build results
`test:mentor-v2-complete` 21/21 · `test:mentor-v2-complete-design` 13/13 · `test:mentor-state-machine` 45/45 · `test:mentor-mutation-service` 11/11 · `test:mentor-v2-resume` 18/18 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-pending-ui` 9/9 · `test:mentor-pending-surfacing` 11/11 · `test:mentor-read-overlay` 13/13 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **384 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 11. Phase 9G2 live test readiness
**Ready.** The quiz-sync COMPLETE path is implemented + fake-validated end-to-end and gated to the allowlisted test user (manual complete stays legacy). Phase 9G2 (first live COMPLETE) needs only operational steps:
1. fresh `.xlsx` backup;
2. a **fresh active practice_task** for the test user (the `T9B2_…` task is active after 9D and reusable) + a test `quizSessionId`;
3. one live quiz-return for that task; verify `Status=completed`, `CompletedAt`, `CompletionSource=quiz_sync`, `LinkedQuizSessionId`, pending cleared, `RowVersion+1`, +1 COMPLETE event, +1 idempotency row, one StudentTopicState upsert; idempotent replay + duplicate-completion guard; real plan untouched.

## 12. Blocking items
- **Blocking for this phase:** None.
- **Operational for Phase 9G2 (not code):** founder fresh backup; a fresh active test task + test quiz session; perform exactly one live quiz-sync COMPLETE on the test user only.
- **Non-blocking:** the quiz-return V2 response currently returns `{success, idempotent}` (not the overlay snapshot) — the result page doesn't consume a snapshot today, so this is acceptable; can be unified later. Optional cleanup of the `MP_T9B2_…` test plan.

---

*Phase 9G1 complete — V2 quiz-sync COMPLETE implemented + fake-tested. Manual complete stays legacy; evidence enforced; no live COMPLETE, no live Sheet write, no flag change, affected real plan untouched, rollover/pending writes not enabled, no deploy, no commit/push.*
