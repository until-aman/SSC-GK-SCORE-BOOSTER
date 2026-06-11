# Phase 9D — First Controlled Live V2 RESUME Mutation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Add the `resume → RESUME` V2 action and perform exactly **one** live RESUME on the Phase 9B2 test task (allowlisted test user only). The affected real plan was not touched.
**Date:** 2026-06-11
**Result:** ✅ Live V2 RESUME succeeded: task `pending → active`, pending fields cleared, `RowVersion 2→3`, +1 RESUME event, +1 RESUME idempotency row, idempotent replay safe; test user `pendingTasks 1→0`, `activeTasks 0→1`; real plan untouched. 341 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/domain/taskStateMachine.js` | RESUME transition now **clears** `pendingReason` + `movedToPendingAt` (pending → active) so a resumed task is no longer canonical pending. |
| `lib/mentor/read/taskActionRouting.js` | `V2_CUTOVER_ACTIONS = ['snooze','resume']`. |
| `lib/mentor/read/v2TaskActionHandler.js` | `LEGACY_TO_V2_ACTION = { snooze: POSTPONE, resume: RESUME }`; context is action-specific (only POSTPONE sets `pendingReason`). |
| `pages/api/mentor/task-action.js` | Accepts `resume` as a valid `actionType`. |
| `lib/mentor/read/v2MutationMonitor.js` | Added `resumeMutationCount` + `canonicalResumeEvents`. |
| `scripts/test-mentor-v2-resume.js` | **New** — 18 fake-client RESUME tests. |
| `scripts/test-mentor-read-overlay.js`, `scripts/test-mentor-v2-cohort.js` | Updated two assertions (resume is now V2-whitelisted, not legacy). |
| `package.json` | Added `test:mentor-v2-resume`. |

## 2. RESUME mapping and whitelist
- Legacy `resume` → canonical V2 `RESUME`.
- `resume` routes to V2 **only** when all three mutation flags are true **and** the user is allowlisted (cohort gate). Non-allowlisted `resume` → legacy. `complete`/`response`/`launch_practice` remain legacy for everyone. `snooze` remains V2 for allowlisted users. Unknown actions remain 400.

## 3. Field-behaviour contract (chosen + documented)
```text
RESUME (pending -> active):
  Status         = active
  PendingReason  = blank   (cleared)
  MovedToPendingAt = blank  (cleared)
  RowVersion     = previous + 1
```
Rationale: clearing the pending evidence prevents a task from being `active` while still appearing pending (it would otherwise fail the canonical-pending predicate's evidence check inconsistently). After RESUME the task is correctly **not** canonical pending (Status≠pending) and appears as active.

## 4. Backup confirmation
Founder confirmed in-chat that a **fresh `.xlsx` backup** (capturing the post-POSTPONE state) was taken before the live RESUME. The service account is `spreadsheets`-scoped (no Drive export), so the backup is founder-performed and is the rollback anchor.

## 5. Selected task pre-state
```text
TaskId: T9B2_1781154796908   PlanId: MP_T9B2_1781154796908
Status: pending   RowVersion: 2   PendingReason: user_postponed   MovedToPendingAt: 2026-06-11T05:15:26.094Z
Repository V2 (test user): canonicalPendingTasks = 1
Baseline: MentorMutationRequests 1, MentorTaskLogs 30, MentorTasks 16; real plan {completed:5, snoozed:10}; allowlist u_1d929728f3beaa74; rollover/pending flags false.
```

## 6. Live RESUME mutation result
Executed via the route handler logic (`shouldRouteActionThroughV2ForUser('resume', testUser)=true` → V2 used, legacy bypassed): `actionType=resume`, `clientOperationId=phase9d-resume-op-1`. Result `ok:true`, `idempotent:false`. Post-state (re-read from Sheet):
```text
Status: active        PendingReason: ""    MovedToPendingAt: ""    RowVersion: 3    UpdatedAt: changed
```

## 7. Event row verification
`MentorTaskLogs` 30 → **31** (+1):
```text
CanonicalAction: RESUME   FromStatus: pending   ToStatus: active
TaskId: T9B2_1781154796908   PlanId: MP_T9B2_1781154796908
IdempotencyKey: mentor-task:u_1d929728f3beaa74:MP_T9B2_1781154796908:T9B2_…:RESUME:phase9d-resume-op-1
```

## 8. Idempotency row verification
`MentorMutationRequests` 1 → **2** (+1): `Action=RESUME`, `Status=completed`, `TaskId=T9B2_…`, `PlanId=MP_T9B2_…`.

## 9. Idempotent replay result
Re-sent the same `resume` with the same `clientOperationId`: `ok:true`, `idempotent:true`; `MentorTaskLogs` 31→31, `MentorMutationRequests` 2→2, `RowVersion` 3→3 — **no second write**. Replay safe.

## 10. Read model after RESUME
- **Test user:** `canonicalPendingTasks = 0`, served `pendingTasks = 0`, `activeTasks = 1`, `plan.tasks = 1`.
- The postpone→resume loop is now fully consistent: POSTPONE surfaced the task as pending (Phase 9C), RESUME removed it from pending and restored it to active.

## 11. Affected real plan verification
- **Real user:** `canonicalPendingTasks = 0`, served `pendingTasks = 0`, legacy snoozed hidden = 10; real plan `MP_1780920810055` status `{completed:5, snoozed:10}` **unchanged**.

## 12. Monitor result
```text
totalMutationRequests: 2   completedMutationRequests: 2   failedMutationRequests: 0
postponeMutationCount: 1   resumeMutationCount: 1
canonicalPostponeEvents: 1 canonicalResumeEvents: 1
duplicateIdempotencyKeys: 0  unexpectedMutationsOutsideAllowlist: 0
pendingUserPostponedTasks: 0  canonicalPendingTaskRows: 0  legacySnoozedHiddenCount: 10
mentorTaskLogsCount: 31   affectedRealPlanStatus: {completed:5, snoozed:10}
```
Exactly the two test mutations (1 POSTPONE + 1 RESUME); no duplicates; nothing outside the allowlist; affected real plan unchanged.

## 13. Tests / build results
`test:mentor-v2-resume` 18/18 · `test:mentor-pending-surfacing` 11/11 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **341 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 14. Recommendation for the next phase
The reversible **postpone ↔ resume** loop is now live, cohort-scoped, idempotent, and read-consistent. Next options (each behind the same allowlist + per-action whitelist + fresh backup):
1. **Mentor pending UI** — wire the now-correct `pendingTasks` (and a Resume control) into the Mentor tab "Previously Pending" surface (UI phase; the data contract is ready).
2. **`complete` cut-over (design first)** — the only remaining common action; needs a defined safe completion source (`quiz_sync` vs manual-recovery evidence) and is terminal (not reversible) — design + a single controlled test before enabling.
3. **Broaden the cohort** — once UI + complete are validated, consider expanding `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` with alerting on `unexpectedMutationsOutsideAllowlist > 0`.
Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` write flags false until a controlled rollover-write phase is designed.

## 15. Blocking items
- **Blocking for this phase:** None.
- **For the next phase (non-blocking):** define the safe completion source before any `complete` cut-over; build the pending/resume UI (no UI was changed here); optional cleanup of the `MP_T9B2_…` test plan/task (now `active` again).

---

*Phase 9D complete — first controlled live V2 RESUME on the allowlisted test user. Exactly one task mutated (pending→active), one event row, one idempotency row; idempotent replay safe; affected real plan untouched; rollover/pending writes not enabled; no deploy, no commit/push.*
