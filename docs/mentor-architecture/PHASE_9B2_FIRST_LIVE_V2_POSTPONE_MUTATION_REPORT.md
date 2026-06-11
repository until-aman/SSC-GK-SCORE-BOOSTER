# Phase 9B2 — First Controlled Live V2 POSTPONE Mutation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Perform exactly **one** real live V2 mutation (`snooze → POSTPONE`) on a **dedicated test user** with a **fresh active task**. The affected real plan was not touched.
**Date:** 2026-06-11
**Result:** ✅ Live V2 POSTPONE succeeded: task `active → pending`, `RowVersion 1→2`, +1 event row, +1 idempotency row, idempotent replay safe, real plan untouched. 304 tests + build green.

---

## 1. Dedicated test user confirmation
- Mutation performed **only** on the dedicated test user `an***@gmail.com` (user scope hash `u_1d929728f3beaa74`). Founder-confirmed as the second test login.
- The **affected real plan** owner `ba***@gmail.com` / `MP_1780920810055` was **never** targeted (script aborts unless the selected task id starts with the `T9B2_` test prefix and the test user owns no pre-existing plans).
- Founder approvals obtained in-chat before any write: fresh `.xlsx` backup taken; approval to generate a fresh test plan.

## 2. Backup confirmation
Founder confirmed a **fresh `.xlsx` backup** of the live Sheet was downloaded and recorded before this phase. (The service account is scoped to `spreadsheets` only — no Drive export — so the backup is founder-performed; it is the rollback anchor.)

## 3. Selected task pre-state
A fresh test plan `MP_T9B2_1781154796908` was generated for the test user via `createMentorPlanSnapshot` with exactly one active `practice_task`. Verified pre-mutation:
```text
TaskId: T9B2_1781154796908
PlanId: MP_T9B2_1781154796908
Status: active            Type: practice_task (POSTPONE-eligible; not quick-check)
RowVersion: "" (blank → effective 1)   PlanVersion: "" (blank → effective 1)
PendingReason: ""   MovedToPendingAt: ""
Repository V2: activeGeneration 1, currentTasks 1, isCurrentGeneration true, isLegacyHidden false
```
Post-generation baseline: MentorProfile 2, MentorPlans 6, MentorTasks 16, MentorTaskLogs 29, MentorMutationRequests 0, StudentTopicState 4, MentorSchema 1.

## 4. Flags enabled
Enabled in `.env.local` in the exact required order (after confirming the five read/shadow flags already true):
```text
1. MENTOR_MUTATION_IDEMPOTENCY_V2=true
2. MENTOR_SHEETS_MUTATIONS_V2=true
3. MENTOR_TASK_MUTATIONS_V2=true
```
Kept **false**: `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`. Verified `shouldRouteActionThroughV2('snooze')=true` and `('complete')=false`.

## 5. Mutation request details
```text
actionType: snooze        (UI "Maybe Later")
V2 action: POSTPONE
taskId: T9B2_1781154796908
planId: MP_T9B2_1781154796908
clientOperationId: phase9b2-postpone-op-1
route fidelity: shouldRouteActionThroughV2('snooze') = true  → V2 used, legacy write path bypassed
```
Executed through the exact route handler logic (`createSheetsMentorRepository` for generation isolation → `createSheetsMutationRepository` + `createSheetsIdempotencyStore` → `executeV2TaskActionCutover`), since the authenticated HTTP route can't be driven headless. Result: `ok:true`, `idempotent:false`.

## 6. Post-state verification (re-read from live Sheet)
```text
Status: pending                       ✓ active → pending
PendingReason: user_postponed         ✓
MovedToPendingAt: 2026-06-11T05:15:26.094Z  ✓ non-empty
RowVersion: 2                         ✓ 1 → 2 (optimistic compare-and-update)
SnoozeCount: 1                        ✓
UpdatedAt: changed                    ✓
```

## 7. Event row verification
`MentorTaskLogs` 29 → **30** (+1). New row:
```text
EventId: evt_20260611051526094_T9B2_1781154796908
TaskId: T9B2_1781154796908   PlanId: MP_T9B2_1781154796908
CanonicalAction: POSTPONE    FromStatus: active   ToStatus: pending
IdempotencyKey: mentor-task:u_1d929728f3beaa74:MP_T9B2_1781154796908:T9B2_1781154796908:POSTPONE:phase9b2-postpone-op-1
EventPayloadJSON: present    CreatedAt: 2026-06-11T05:15:26.094Z
```

## 8. Idempotency row verification
`MentorMutationRequests` 0 → **1** (+1). New row:
```text
IdempotencyKey: mentor-task:u_1d929728f3beaa74:...:POSTPONE:phase9b2-postpone-op-1
PlanId: MP_T9B2_1781154796908   TaskId: T9B2_1781154796908
Action: POSTPONE   Status: completed   PayloadHash: 55a691bc…   ResultJSON: present
```

## 9. Idempotent replay verification
Re-sent the same `snooze` with the same `clientOperationId`:
```text
ok: true   idempotent: true
MentorTaskLogs: 30 → 30 (no new row)
MentorMutationRequests: 1 → 1 (no new row)
Task RowVersion: 2 → 2 (unchanged)
```
**Replay safe** — no second task update, event, or idempotency row.

## 10. Response compatibility result
The success response used the **shared overlay** (`applyRepoV2Compatibility`): `exists:true`, `repositoryServed:true`, rich legacy `profile` preserved, canonical `plan.dayNumber` present (Day 2), current-generation visibility (`plan.tasks` = 1), historical hidden. Non-blank and shape-compatible with `GET /api/mentor/plan`.
- **Known limitation (documented, expected):** the overlay's `pendingTasks` showed **0** even though the task is now `Status=pending`. This is because the repository's `canonicalPendingTasks` is a Phase-2 placeholder (`[]`) and the **pending lifecycle** that surfaces postponed tasks as backlog is intentionally still gated off (`MENTOR_PENDING_LIFECYCLE_V2=false`). The task is **not lost** — it is persisted as `pending` in the Sheet and present in `plan.tasks`. Surfacing it in the `pendingTasks` bucket is a later phase's job.

## 11. No-extra-mutation confirmation
- Exactly **one** task row changed (`T9B2_…`); the real plan `MP_1780920810055` status distribution unchanged (`{completed:5, snoozed:10}`).
- Exactly **+1** `MentorTaskLogs` row and **+1** `MentorMutationRequests` row.
- `StudentTopicState` unchanged (4); `MentorSchema` unchanged (1). No unexpected `StudentTopicState` write.
- `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` stayed false — daily rollover / pending lifecycle did **not** run.
- Final counts: Profiles 2, Plans 6, Tasks 16, Logs 30, MutationRequests 1, TopicState 4, Schema 1 (all deltas accounted for: +1 test plan & task from generation; +1 log & +1 idempotency from the single mutation).

## 12. Tests / build results
`test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **304 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 13. Rollback note
Google Sheets is **not transactional**. If rollback is needed: restore the founder's fresh `.xlsx` backup (removes the test plan + the mutation), **or** narrow manual revert of the single test task row (`Status=active`, `RowVersion=1`, clear `PendingReason`/`MovedToPendingAt`/`SnoozeCount`) and delete the one `MentorTaskLogs` + one `MentorMutationRequests` row. No automatic rollback exists. The mutation touched only test-user rows; the affected real plan needs no rollback.

> **Test data left in place:** the test plan `MP_T9B2_1781154796908` + task `T9B2_1781154796908` (now `pending`) remain on the test user. They can be cleaned later or removed by restoring the backup.

> **Production note:** the three mutation flags remain enabled in `.env.local`, so the live `task-action` route now routes the whitelisted `snooze` action through V2 for all users. In practice the real user has no V2-actionable (active) task, so their experience is unaffected; Phase 9C should decide on monitoring / per-cohort scoping before broad reliance.

## 14. Can Phase 9C expand V2 task mutations?
**Ready.** The first real live V2 mutation is proven end-to-end: optimistic-locked compare-and-update, canonical event log, idempotency record, idempotent replay, generation-guarded rejection, and shared-overlay response — all on live data with the real plan untouched. Phase 9C can extend the whitelist to additional reversible actions (e.g., `resume`, then `complete` via `quiz_sync`/manual-recovery completion source) one at a time, each with: a fresh backup, a single controlled test on the test user, post-state + idempotency verification, and the pending-lifecycle decision (§10) before surfacing pending backlog in the UI.

## 15. Blocking items
- **Blocking for this phase:** None (completed successfully).
- **For Phase 9C (non-blocking now):**
  1. **Pending lifecycle surfacing** — enable/validate the pending read model so postponed tasks appear in `pendingTasks` (currently placeholder `[]`); decide UI treatment.
  2. **Production scope** — decide whether to keep V2 `snooze` enabled globally or scope to test cohorts during expansion; add monitoring of `MentorMutationRequests`/`MentorTaskLogs` for V2 events.
  3. **Completion source for `complete`** — define the safe completion source (`quiz_sync` vs manual recovery evidence) before cutting `complete` over to V2.
  4. **Test-data cleanup** — optionally remove the `MP_T9B2_…` test plan after validation.

---

*Phase 9B2 complete — first controlled live V2 POSTPONE on a dedicated test user. Exactly one task mutated, one event row, one idempotency row; idempotent replay safe; affected real plan untouched; rollover/pending writes not run; no deploy, no commit/push.*
