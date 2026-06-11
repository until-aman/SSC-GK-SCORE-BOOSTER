# Phase 9G2 — First Controlled Live V2 Quiz-Sync COMPLETE Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Perform exactly **one** real live V2 `COMPLETE` (quiz_sync) through the quiz-return path, on the allowlisted test user's active test task. The affected real plan was not touched.
**Date:** 2026-06-11
**Result:** ✅ Live quiz-sync COMPLETE succeeded: `active → completed`, `CompletionSource=quiz_sync`, `LinkedQuizSessionId` set, `RowVersion 3→4`, +1 COMPLETE event, +1 idempotency row, StudentTopicState upserted once; idempotent replay + duplicate-completion guard safe; real plan untouched. 384 tests + build green.

---

## 1. Selected test task pre-state
```text
TaskId: T9B2_1781154796908   PlanId: MP_T9B2_1781154796908
Status: active   Type: practice_task   RowVersion: 3
CompletionSource: ""   LinkedQuizSessionId: ""   CompletedAt: ""
PendingReason: ""   MovedToPendingAt: ""   Subject: Polity   Topic: Phase9B2 Test Topic
Repository V2: current-generation, isCurrentGeneration=true, isLegacyHidden=false → SAFE TO COMPLETE
```
Owned by the allowlisted test user (`u_1d929728f3beaa74`); the V2 quiz-completion gate returned `true`.

## 2. Backup confirmation
Founder confirmed a **fresh `.xlsx` backup** of the live Sheet was taken before this COMPLETE (which is terminal/non-reversible). The service account is `spreadsheets`-scoped (no Drive export); the backup is founder-performed and is the rollback anchor.

## 3. Mutation request details
```text
Path: quiz-return V2 (shouldRouteQuizCompletionThroughV2(testUser)=true → V2 used; legacy quiz-return write bypassed)
taskId: T9B2_1781154796908   planId: MP_T9B2_1781154796908
quizSessionId: phase9g2-quizsession-1   completionSource: quiz_sync
score: correct 20, incorrect 3, skipped 2, total 25 (accuracy 80%)
clientOperationId: phase9g2-complete-op-1
```
Result: `ok:true`, `idempotent:false`, `topicStateUpdated:true`. Manual `task-action` complete was **not** involved.

## 4. Task post-state verification (re-read from Sheet)
```text
Status: completed                         ✓ active → completed
CompletedAt: 2026-06-11T10:07:34.699Z     ✓ non-empty
CompletionSource: quiz_sync               ✓
LinkedQuizSessionId: phase9g2-quizsession-1  ✓
PendingReason: ""   MovedToPendingAt: ""  ✓ cleared
RowVersion: 4                             ✓ 3 → 4 (optimistic compare-and-update)
UpdatedAt: changed                        ✓
```

## 5. Event row verification
`MentorTaskLogs` 31 → **32** (+1):
```text
CanonicalAction: COMPLETE   FromStatus: active   ToStatus: completed
TaskId: T9B2_1781154796908   PlanId: MP_T9B2_1781154796908
IdempotencyKey: mentor-task:u_1d929728f3beaa74:MP_T9B2_1781154796908:…:phase9g2-complete-op-1
EventPayloadJSON: present
```
**No** legacy `return_from_quiz` log was written for this task (count 0) — the legacy write path was bypassed.

## 6. Idempotency row verification
`MentorMutationRequests` 2 → **3** (+1): `Action=COMPLETE`, `Status=completed`, `TaskId=T9B2_…`, `PlanId=MP_T9B2_…`, `ResultJSON` present, `PayloadHash` present.

## 7. StudentTopicState verification
`StudentTopicState` 4 → **5** (one upsert for the test subject/topic):
```text
Subject: Polity   Topic: Phase9B2 Test Topic
PracticeStatus: enough_practice   RecentAccuracy: 80   ConfidenceLevel: strong
LastQuizAttemptAt: 2026-06-11T10:07:34.699Z
```
Upserted **once**; no unrelated fields reset; **no XP/coins** written by the side-effect.

## 8. Idempotent replay result
Re-sent the same quiz-return with the same `clientOperationId`: `ok:true`, `idempotent:true`, `topicStateUpdated:false`. `MentorTaskLogs` 32→32, `MentorMutationRequests` 3→3, `StudentTopicState` 5→5, `RowVersion` 4→4, StudentTopicState upserts during replay = 0. No second write.

## 9. Duplicate-completion guard result
Re-sent the same COMPLETE with a **different** `clientOperationId` (`phase9g2-complete-op-2`): `ok:false`, `code=DUPLICATE_COMPLETION`. No task update, no new event row, no new idempotency row (counts unchanged).

## 10. Read model after COMPLETE
- **Test user:** `activeTasks = 0`, `pendingTasks = 0`, `completedToday = 1`, `canonicalPendingTasks = 0` (the completed task moved out of active/pending into completed).
- **Affected real user:** `pendingTasks = 0`, `canonicalPendingTasks = 0`, legacy snoozed hidden = 10.

## 11. Monitor result
```text
MentorMutationRequests: 3   MentorTaskLogs: 32
POSTPONE events: 1   RESUME events: 1   COMPLETE events: 1
completedQuizSyncTaskCount: 1
duplicateIdempotencyKeys: 0   unexpectedMutationsOutsideAllowlist: 0
affectedRealPlanStatus: { completed: 5, snoozed: 10 }   (unchanged)
```
Exactly the three test mutations (1 POSTPONE + 1 RESUME + 1 COMPLETE); no duplicates; nothing outside the allowlist.

## 12. Affected real plan verification
`MP_1780920810055` status `{completed:5, snoozed:10}` **unchanged**; MentorTasks total 16 (the test plan's row, unchanged count). Exactly one task row changed (`T9B2_…`); only one event row + one idempotency row + one StudentTopicState row added; `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` stayed false (no rollover/pending write).

## 13. Tests / build results
`test:mentor-v2-complete` 21/21 · `test:mentor-v2-complete-design` 13/13 · `test:mentor-pending-ui` 9/9 · `test:mentor-pending-surfacing` 11/11 · `test:mentor-v2-resume` 18/18 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **384 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 14. Rollback note
Google Sheets is **not transactional**; COMPLETE is terminal. If rollback is needed: restore the founder's fresh `.xlsx` backup, **or** (pre-approved narrow revert only) set the one task row back to `Status=active`/`RowVersion=3`, clear `CompletedAt`/`CompletionSource`/`LinkedQuizSessionId`, and delete the one `MentorTaskLogs` COMPLETE row + one `MentorMutationRequests` row + the one new `StudentTopicState` row. No automatic rollback exists. The mutation touched only test-user rows; the affected real plan needs no rollback.

## 15. Recommendation for next phase
All three core task actions are now live, cohort-scoped, idempotent, and read-consistent: **POSTPONE** (pause), **RESUME** (un-pause), **COMPLETE** (quiz-sync, evidence-backed). Recommended next:
1. **Wire the real routes for the test cohort end-to-end** — drive POSTPONE/RESUME/COMPLETE through the actual authenticated HTTP routes (not the handler replica) for the allowlisted test user, to validate session + UI round-trips.
2. **Then a controlled cohort expansion** — add a second test user to `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` with alerting on `unexpectedMutationsOutsideAllowlist > 0`, before any general rollout.
3. **Design the daily-rollover write phase** (`MENTOR_DAILY_ROLLOVER_V2`) separately and carefully — it is the last major write surface (auto pending on day-end) and is currently shadow-only.
Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` write flags false until that phase.

## 16. Blocking items
- **Blocking for this phase:** None.
- **Operational (next phases):** founder backup before each new live write; decide cohort-expansion criteria + monitoring/alerting; design the rollover-write phase before enabling it.
- **Non-blocking:** the quiz-return V2 response returns `{success, idempotent}` (the result page consumes no snapshot today) — can be unified with the overlay later; optional cleanup of the `MP_T9B2_…` test plan (now a completed test task).

---

*Phase 9G2 complete — first controlled live V2 quiz-sync COMPLETE on the allowlisted test user. Exactly one task mutated (active→completed), one event row, one idempotency row, one StudentTopicState upsert; idempotent replay + duplicate-completion guard safe; manual complete untouched; affected real plan untouched; rollover/pending writes not enabled; no deploy, no commit/push.*
