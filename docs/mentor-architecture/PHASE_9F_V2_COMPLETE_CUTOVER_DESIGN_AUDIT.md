# Phase 9F — V2 COMPLETE Cutover Design Audit

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Design the safest V2 `COMPLETE` cut-over. **Design/audit only — no live mutation, no whitelist change, no flag change, no write.**
**Date:** 2026-06-11
**Result:** ✅ Recommendation: first V2 COMPLETE = **`quiz_sync` via the quiz-return flow** (evidence-backed), not the manual button. One material gap found in the state machine. 363 tests + build green.

---

## 1. Current legacy COMPLETE behaviour
There are **two** completion paths today, both writing directly with no optimistic lock and no idempotency:

**(a) Manual complete — `pages/api/mentor/task-action.js`, `actionType=complete`:**
- Payload: `{ taskId, planId, actionType:'complete', subject, topic }`; auth via session.
- Task lookup: `updateMentorTaskStatus(sheets, email, taskId, …)` — matched by **Email+TaskId** (no PlanId/RowVersion).
- Writes: `Status=completed`, `CompletedAt=now`; if `subject`+`topic` → `upsertStudentTopicState(TheoryStatus='done')`; `appendMentorTaskLog(actionType='complete')`; returns the legacy snapshot.
- **No quiz evidence required**, **no RowVersion check** (last-write-wins), **no idempotency** → repeated complete appends duplicate logs and re-writes status. Intended for theory/“mark done”.

**(b) Quiz-return — `pages/api/mentor/quiz-return.js` (separate route):**
- Payload: `{ taskId, planId, quizSessionId, subject, topic, correct, incorrect, skipped, totalQuestions }`.
- Writes: `Status=completed`, `CompletedAt=now`; `upsertStudentTopicState(PracticeStatus, RecentAccuracy, ConfidenceLevel, LastQuizAttemptAt)`; `appendMentorTaskLog(actionType='return_from_quiz', quizSessionId, scores)`; returns `{success:true}` (no snapshot).
- **Evidence-backed** (quiz session id + score breakdown) but still no RowVersion/idempotency; repeated return rewrites completed + appends duplicate logs.

## 2. Quiz / practice completion flow audit
- A practice/quiz task is launched via `launch_practice` (task-action), navigates to the quiz, and on the result page calls **`/api/mentor/quiz-return`** with `taskId`, `planId`, `quizSessionId`, and the score breakdown — so **taskId/planId/quizSessionId/score evidence all exist** at completion time.
- A theory/check task is completed via the **manual** `complete`/`response` action (no quiz).
- So completion is a **mix**: quiz tasks complete through the quiz-return callback (evidence), non-quiz tasks through manual taps.

## 3. Recommended completion source — **`quiz_sync` first (not manual button)**
| Option | Verdict |
|---|---|
| A — Manual complete button | **Not first.** Terminal/non-reversible with no evidence; weak learning integrity. |
| B — **Quiz-sync completion** | **Recommended first.** Evidence-backed (real practice + score), `taskId`/`planId`/`quizSessionId` already available in quiz-return; terminal completion is justified. |
| C — Manual recovery with evidence | Useful fallback later; needs `manualRecoveryVerified` product logic; not the first cut-over. |

Code confirms the design: the state machine **already rejects** `COMPLETE` of a quiz task with an explicit `mentor_response` source (`INVALID_COMPLETION_SOURCE`), and requires verified evidence for `manual_recovery`. So `quiz_sync` is the natural, enforced-by-type first source. **First V2 COMPLETE should be wired into the quiz-return flow for the allowlisted test user only.**

> **GAP found (must fix in 9G):** `evaluateTaskTransition(COMPLETE)` defaults the source to `mentor_response`, and the type policy only rejects when `mentor_response` is passed **explicitly**. So a quiz task completed with **no** source slips through via the default and completes **without evidence** (test `2b`). Phase 9G must **require an explicit `quiz_sync` + non-empty `LinkedQuizSessionId`** for quiz-task completion (reject default/empty source).

## 4. V2 COMPLETE field contract (proposed)
```text
Status              = completed
CompletedAt         = now
CompletionSource    = quiz_sync   (manual_recovery only with verified evidence)
LinkedQuizSessionId = <quizSessionId>   (REQUIRED for quiz_sync; reject if blank)
RowVersion          = N + 1            (optimistic compare-and-update)
PendingReason       = ""   (cleared)
MovedToPendingAt    = ""   (cleared)
```
- `sheetsMutationRepository.TASK_UPDATE_COLUMNS` already maps `status`, `completedAt`, `completionSource`, `pendingReason`, `movedToPendingAt` — **add `linkedQuizSessionId → LinkedQuizSessionId`**.
- `completeTask` in the state machine should additionally **clear `pendingReason`/`movedToPendingAt`** (mirror RESUME) and **require `linkedQuizSessionId` for `quiz_sync`**.
- The task **leaves the active list** (status completed → `completedToday`); completed tasks are not shown as active/pending; the overlay's `completedToday`/`progress` reflect it.

## 5. StudentTopicState handling recommendation
Preserve the existing evidence-rich `upsertStudentTopicState` write (PracticeStatus / RecentAccuracy / ConfidenceLevel / LastQuizAttemptAt) that quiz-return already performs, but run it as the V2 mutation's **side effect** (the state machine exposes `sideEffects.updateTopicState` + `topicStateUpdate`; add `repository.updateStudentTopicState` backed by the existing `upsertStudentTopicState`). XP/coins are **not** affected here (the state machine sets `awardCoins:false`; coins/XP remain on the quiz result path). StudentTopicState must never be reset — only upserted.

## 6. First live test strategy (future Phase 9G — do NOT run now)
- Use a **fresh active practice_task** for the allowlisted test user (the existing `T9B2_…` is active again after 9D and is usable, or generate a new one) — **not** the affected real plan.
- Provide a **test `quizSessionId`** (e.g., `phase9g-quizsession-1`) as `LinkedQuizSessionId`, `completionSource=quiz_sync`, with a small score payload.
- **Backup:** founder fresh `.xlsx` backup required before the write.
- **Verify post-state:** `Status=completed`, `CompletedAt` set, `CompletionSource=quiz_sync`, `LinkedQuizSessionId=<session>`, `RowVersion N→N+1`, `PendingReason`/`MovedToPendingAt` blank; **+1** `MentorTaskLogs` (CanonicalAction `COMPLETE`/`task_completed`, from active→completed); **+1** `MentorMutationRequests` (Action COMPLETE, completed); a `StudentTopicState` upsert for the test subject/topic.
- **Idempotent replay:** same `clientOperationId` → no second task update/event/idempotency row; **duplicate-completion** guard (`getCompletedEvent`) also blocks a different-op re-complete.
- Affected real plan unchanged; rollover/pending write flags stay false.

## 7. Required future code changes (Phase 9G)
1. Wire **quiz-return** (not the snooze/resume whitelist) to the V2 path for allowlisted users — a dedicated `shouldRouteQuizCompletionThroughV2(userScopeHash)` gate (or extend the existing cohort gate), keeping the manual `complete` button on legacy.
2. Map quiz-return → V2 `COMPLETE` with `completionSource=quiz_sync`, `linkedQuizSessionId=quizSessionId`, score context.
3. **Enforce evidence:** `completeTask` requires `quiz_sync` + non-empty `linkedQuizSessionId` for quiz tasks (close the §3 gap); reject default/empty source for quiz tasks.
4. `completeTask` clears `pendingReason`/`movedToPendingAt`.
5. `sheetsMutationRepository`: add `LinkedQuizSessionId` to `TASK_UPDATE_COLUMNS`; add `updateStudentTopicState` (reuse `upsertStudentTopicState`) and wire the side effect.
6. **Monitor:** add `completeMutationCount` + `canonicalCompleteEvents`.
7. Tests; keep `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` = test user only; keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` false; do **not** add manual `complete` to the V2 whitelist.

## 8. Tests / build results
Added `scripts/test-mentor-v2-complete-design.js` (13 non-live tests): complete not whitelisted; quiz+explicit-mentor_response rejected; **gap 2b** (quiz+no-source defaults to mentor_response — to fix); quiz_sync allowed→completed; CompletedAt+CompletionSource set; check task source rules; theory via mentor_response; manual_recovery needs evidence; service quiz_sync RowVersion+1+event; duplicate-completion blocked; hidden/historical rejects; completed-twice rejected; affected real plan tasks hidden/non-completable. Full suite: **363 passed, 0 failed** (v2-complete-design 13, pending-ui 9, pending-surfacing 11, v2-resume 18, v2-cohort 8, v2-postpone 20, read-overlay 13, mutation-service 11, state-machine 45, rollover 67, repo 22, sheets 36, sheets-writer 23, plan-day 25, optimization 42). `npx next build` → **✓ Compiled successfully**.

## 9. Phase 9G readiness
**Ready to implement** (behind flags, allowlisted, not executed live yet). The building blocks exist and are tested; the cut-over is well-scoped to `quiz_sync` via quiz-return. Implement the §7 changes (especially the §3 evidence-enforcement gap) + fake tests first, then one controlled live test (§6) with a fresh backup.

## 10. Blocking items
- **Blocking for this phase:** None.
- **Must address in Phase 9G before the live test:**
  1. **Evidence-enforcement gap** — require explicit `quiz_sync` + non-empty `LinkedQuizSessionId` for quiz-task completion (default `mentor_response` currently slips through).
  2. Decide the cut-over surface (quiz-return route vs a new completion gate) and keep manual `complete` on legacy.
  3. `LinkedQuizSessionId` column write + StudentTopicState side-effect wiring + monitor COMPLETE counters.
- **Non-blocking:** no React render-test harness; optional cleanup of the `MP_T9B2_…` test plan.

---

*Phase 9F complete — design/audit only. No `complete` added to the V2 whitelist, no live mutation, no flag change, no write, affected real plan untouched, no deploy, no commit/push.*
