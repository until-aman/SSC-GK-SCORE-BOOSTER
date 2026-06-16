# Phase 10D — First Live Daily Rollover on Test User

**Date:** 2026-06-13
**Outcome:** ⛔ **NO-GO** — the live rollover wrote the two pending moves correctly but finalized incorrectly. Post-run monitor is **CRITICAL**. Pilot flag must be turned **off** and two write-path bugs + one monitor gap fixed before any further live rollover.

---

## 1. Backup
- **Founder-confirmed fresh `.xlsx` backup taken** before the live run (Step 1 gate satisfied).
- Backup-time row baselines (counted from the live Sheet): `MentorPlans` 23 · `MentorTasks` 65 · `MentorTaskLogs` 99 · `MentorMutationRequests` 20.

## 2. Pilot user
- userScope **`u_1d929728f3beaa74`** (`an***@gmail.com`, dedicated test account).

## 3. Pilot plan
- **`MP_T9B2_1781154796908`** — confirmed **not** the affected real plan (`MP_1780920810055`).
- ⚠️ Structural note: this plan has **12 `MentorPlans` rows sharing the same `planId`** (sheetRows 7–18: 11 `invalid` old generations + 1 `active`, row 18), and many `MentorTasks` rows reuse the same `planId` across regenerations. This data shape is the root cause of all three defects below.

## 4. Pre-run Sheet state (canonical snapshot)
- calendarDay **3** · lastProcessedCalendarDay **1** · totalPlanDays **46** (populated, >0 ✓).
- currentTasks 4 → active 2, in_progress 0, scheduled 0; canonicalPending 1; quick-checks active 0.

## 5. Shadow prediction (NO-OP store, no writes)
- rolloverRequired **true**; movedToPending **2**; rescheduled **0**; diag `MULTI_DAY_GAP_PROCESSED`.
- would-be `LastProcessedCalendarDay` **3**; idempotencyKey `mentor-rollover:u_1d929728f3beaa74:MP_T9B2_1781154796908:3`.
- taskUpdates: `Polity_weak_1` (mistake_recovery, active→pending), `Daily Challenge_weak_3` (revision, active→pending), both `day_ended_incomplete`, RowVersion 1→2.

## 6. Env values used (founder-set, prod)
```
MENTOR_DAILY_ROLLOVER_V2=true
MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES=u_1d929728f3beaa74
MENTOR_DAILY_ROLLOVER_ALLOW_ALL=false
MENTOR_PENDING_LIFECYCLE_V2=false
```
Unchanged: `MENTOR_V2_MUTATION_ALLOW_ALL` (true, prod), `MENTOR_REPO_V2`, `CRON_SECRET`, Google creds. Vercel Production redeploy Ready before the trigger.

**Step 6 (post-enable monitor, prod `main` code):** `WARNING` — `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1, allow-all=false, pending-lifecycle=false, all rollover counters 0. Not CRITICAL → proceeded.

## 7. Live trigger
- Exactly one authenticated `GET /api/mentor/plan` in the `an***@gmail.com` browser session (founder-driven). No refresh; no other account opened.

## 8. Task rows changed (correct ✓)
| Task | from→to | PendingReason | MovedToPendingAt | SnoozeCount | RowVersion |
|---|---|---|---|---|---|
| `MT_1781233784793_Polity_weak_1` | active→pending | day_ended_incomplete | SET | 1 | 2 |
| `MT_1781233784793_Daily Challenge_weak_3` | active→pending | day_ended_incomplete | SET | 1 | 2 |

TaskId/PlanId unchanged; no net-new task ids; already-pending `Chemistry_weak_2` and completed `..._practice` untouched. **Matches the shadow prediction exactly.**

## 9. Plan row changed (BUG A ✗)
- `LastProcessedCalendarDay=3` was written to **sheetRow 7 (`status=invalid`, oldest generation)** instead of the active row 18 (still blank). `LastDailyRolloverAt` not written on any row.
- **Root cause:** `createSheetsPlanWriter.setLastProcessedCalendarDay` (lib/mentor/repository/sheetsMutationRepository.js) selects the row by `planId + email` via `findIndex` — the first match — with no `Status=active` / current-generation disambiguation. With 12 same-`planId` rows it hit a dead generation.

## 10. Log rows added (correct ✓)
- 2 `MentorTaskLogs` rows: `CanonicalAction=POSTPONE`, `ToStatus=pending`, `SourcePage=daily_rollover`, `IdempotencyKey=mentor-rollover:…:3` — one per moved task. Logs 99→101. Canonical POSTPONE events 11→13.

## 11. Mutation request row added (BUG B ✗)
- **No `Action=ROLLOVER` idempotency row persisted** — `MentorMutationRequests` still 20; `rolloverMutationRequestCount=0`.
- Executor ordering finalizes the idempotency row **last** (after the day-marker write). The day-marker write returned `{written:true}` (no throw) yet the subsequent `idempotencyStore.save` did not append. **Root cause to confirm from Vercel function logs** (plan.js wraps the executor in `.catch(()=>{})`, so any late exception is swallowed). Likely an exception or transient Sheets error at the finalization step; possibly related to the same multi-row `planId` shape. Must be root-caused, not assumed transient.

## 12. Idempotency replay check
- **NOT performed.** Phase rule: do not replay until the first result is fully understood, and the result is not clean. Because the idempotency row is absent, a replay would not short-circuit on the idempotency key; it would rely on RowVersion STALE-skips for the two tasks (now RowVersion 2 vs expected 1 → benign skip, no double-move) but would **re-attempt** the wrong-row day-marker write and re-attempt finalization — so replay is unsafe until Bug A/B are fixed.

## 13. Monitor before / after
- **Before (Step 4):** WARNING — `ALLOW_ALL_ENABLED` only; all rollover counters 0.
- **After (Step 10): CRITICAL.**
  - `ACTIVE_TASK_LIMIT_EXCEEDED` (CRITICAL) — **BUG C (monitor):** `activeTaskCountOverLimit` aggregates active tasks by `planId` across **all generations** (~20 old-gen rows on this plan), so it false-fires even though current-generation active ≤ 3. Needs current-generation scoping.
  - `ROLLOVER_LAST_PROCESSED_MISSING` (WARNING) — direct symptom of Bug A (active row's marker blank).
  - `tasksMovedToPendingByRollover=2`, `quickChecksIncorrectlyPendingByRollover=0`, `duplicate/failedRollover=0`, `rolloverMutationRequestCount=0`, `maxPendingBacklogByPlan=4`.

## 14. Flag turned off after test (✓ done)
- **Founder set `MENTOR_DAILY_ROLLOVER_V2=false` and redeployed.** Confirmed via monitor: `dailyRolloverFlagEnabled=false`, `rollover/pending write flags: false/false`. The write branch is now **dead** — no further rollover writes can occur. Production is safe.
- **However, the monitor is still `CRITICAL` after disabling** — by design. The anomaly counters are **data-driven, not flag-gated**: the test plan still carries the 2 `daily_rollover` log events from the live run, so it remains "rollover-processed", and `activeTaskCountOverLimit=1` (Bug C, generation-blind aggregation) + `ROLLOVER_LAST_PROCESSED_MISSING` (Bug A symptom) persist. **The daily Vercel cron will return 500/CRITICAL each run until this is cleared.**
- **To restore a clean monitor baseline, one of:** (a) fix **Bug C** so the active-limit counts only current-generation tasks (clears the CRITICAL; the `ROLLOVER_LAST_PROCESSED_MISSING` WARNING remains until the marker is corrected); or (b) **restore the test plan rows from the founder's backup** (removes the 2 `daily_rollover` events + the row-7 marker → the plan is no longer rollover-processed → both alerts clear). Do not hand-edit the rows (phase rule); use the backup. Recommended: do both in the Phase 10D-fix cycle.

## 15. Non-pilot user safety (✓)
- Affected real plan `MP_1780920810055`: status counts unchanged `{completed:6, snoozed:10, pending:4, active:4}`; **0 rollover events**. No rollover events for any non-pilot plan.

## 16. Tests / build
- `test:mentor-rollover-write` 21/21 · `rollover-dry-run` 11/11 · `monitor-alerts` (codex suite) 9/9 · `route-readiness` 12/12 · **build ✓**.
- **Test gap:** all rollover fixtures use a single, unique `planId` per plan, so none exercise the multi-generation / duplicate-`planId` condition that produced Bugs A–C. Add a fixture with several same-`planId` rows (mixed `invalid`/`active`) before re-piloting.

## 17. Go / No-Go recommendation
**NO-GO for Phase 10E-onward expansion.** Before re-running a live pilot (Phase 10D-retry):
1. **Fix Bug A** — `setLastProcessedCalendarDay` (and any plan-row resolution) must target the **active / current-generation** row, not the first `planId+email` match. Mirror the snapshot's active-plan selection.
2. **Fix Bug B** — root-cause the missing idempotency finalization (inspect Vercel logs; make finalization failures surface instead of being swallowed by plan.js `.catch`). Consider writing the idempotency row before/independently so a day-marker failure can't drop finalization.
3. **Fix Bug C (monitor)** — scope `activeTaskCountOverLimit` to current-generation active tasks (not all rows by `planId`).
4. **Add regression fixtures** for the multi-generation `planId` shape (Bugs A–C).
5. Decide whether to **clean up** the partial state on the test plan from backup (2 tasks now pending + row-7 marker) — do not hand-edit per phase rules; restore from the founder's backup if a clean slate is wanted for the retry.
6. Keep `MENTOR_DAILY_ROLLOVER_V2` **off** until the above land and a fresh shadow prediction is boring/exact on a plan that reproduces the multi-row shape.
