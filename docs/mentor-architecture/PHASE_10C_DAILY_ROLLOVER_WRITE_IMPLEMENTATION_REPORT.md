# Phase 10C — Daily Rollover Write Implementation (Behind Flag)

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Implement the V2 daily-rollover **write** path behind flags. **No live rollover, no flag enablement, no production Sheet mutation, no deploy.**
**Date:** 2026-06-12
**Result:** ✅ Rollover write executor + dedicated cohort gates + real user scope + `LastProcessedCalendarDay` writer (column-tolerant) + gated `plan.js` wiring, all fail-closed. 21/21 write tests + full suite (478) + build green. Flags remain OFF; the write branch is dead code in production.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/featureFlags.js` | Added rollover cohort gates: `getDailyRolloverAllowedUserHashes`, `isMentorDailyRolloverAllowAllEnabled`, `isMentorDailyRolloverUserAllowed` (master gate + allow-all/allowlist, fail-closed). |
| `lib/mentor/services/dailyRolloverService.js` | `processDailyRollover` now returns a persist-ready `taskUpdates` change set (+ `rolloverEvent`) alongside the existing plan. Additive; existing behaviour unchanged. |
| `lib/mentor/services/rolloverWriteExecutor.js` | **New** — `executeDailyRolloverWrite(...)`: compute-plan → per-task `compareAndUpdateTask` + event rows → `LastProcessedCalendarDay` → finalize idempotency LAST. |
| `lib/mentor/repository/sheetsMutationRepository.js` | Added `createSheetsPlanWriter` (`get/setLastProcessedCalendarDay`) — additive, **tolerates a missing column**. |
| `pages/api/mentor/plan.js` | Real `userScope` (`u_<sha256>`, no email in keys/logs); gated WRITE branch (`isMentorDailyRolloverUserAllowed`) calling the executor; SHADOW log path retained for the non-eligible case. |
| `scripts/test-mentor-rollover-write.js` | **New** — 21 fake/in-memory write tests. |
| `package.json` | Added `test:mentor-rollover-write`. |

## 2. Rollover gates added (independent of action mutations)
- **Master:** `MENTOR_DAILY_ROLLOVER_V2` (existing) — if false, **no rollover writes**.
- **Allow-all:** `MENTOR_DAILY_ROLLOVER_ALLOW_ALL` (new, exact `"true"`).
- **Allowlist:** `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` (new, comma-separated `u_` hashes).
- `isMentorDailyRolloverUserAllowed(scope)` = master ON **and** (allow-all → any authenticated scope, else allowlist contains scope). Empty/unset ⇒ **fail-closed**. **Does NOT reuse** `MENTOR_V2_MUTATION_ALLOW_ALL`/`MENTOR_V2_MUTATION_ALLOWED_USER_HASHES`, so rollover pilots independently of POSTPONE/RESUME/COMPLETE.

## 3. Real userScope
`plan.js` now derives `userScope = userScopeFromIdentity({ email: session.user.email })` → `u_<sha256(lowercased email).slice(0,16)>` (same helper as task-action). The placeholder `'authenticated'` is gone. Full emails never appear in the idempotency key (`mentor-rollover:<scope>:<plan>:<calendarDay>`), in logs, or in monitor output.

## 4. LastProcessedCalendarDay storage (design + status)
`createSheetsPlanWriter.setLastProcessedCalendarDay(planId, day)` writes the additive `MentorPlans.LastProcessedCalendarDay` column. **It is column-tolerant**: if the column is absent it returns `{written:false, reason:'LAST_PROCESSED_COLUMN_MISSING'}` and writes nothing (never alters schema). **Status:** the column is **not yet added to the live Sheet** — per the strict rules this phase does not mutate the production Sheet. A `10C-schema-prep`/`10D` step must add the additive column (same pattern as Phase 6C) before the first live rollover; until then the executor records the diagnostic and the planner falls back to legacy `activeDayNumber` for `previousProcessed`.

## 5. Write executor behaviour
`executeDailyRolloverWrite({ snapshot, userScope, activePlan, now, mutationRepository, idempotencyStore, planWriter, totalPlanDays })`:
1. `idempotencyStore.get(key)` → if present, return `{idempotent:true, ...}` (no writes).
2. `processDailyRollover` with a **no-op store** to get the plan + `taskUpdates` (executor owns persistence ordering).
3. `rolloverRequired:false` → no-op return.
4. **Final-day policy** (see §9).
5. For each `taskUpdate`: `compareAndUpdateTask` (RowVersion-guarded, whitelisted columns) then `appendTaskEvent` (`task_postponed`/`POSTPONE` or `task_deferred`/`DEFER`, `source:'daily_rollover'`, `idempotencyKey`). A `STALE_*`/`TASK_NOT_FOUND` is **benign** (already moved) → skipped; any other error **aborts** without finalizing.
6. `setLastProcessedCalendarDay`.
7. **Finalize the rollover idempotency row LAST** (`MentorMutationRequests`, `Action=ROLLOVER`).
**No net-new tasks** are generated (executor only transitions existing ids).

## 6. Idempotency behaviour
- Key `mentor-rollover:<userScope>:<planId>:<calendarDay>`. Replay → `idempotent:true`, zero writes (verified).
- Finalized **only after** all task writes + the day-marker succeed → a partial failure leaves the key absent, so a re-run **resumes**; already-applied tasks fail RowVersion and are skipped (no duplicate moves, no duplicate event rows).

## 7. Event / log behaviour
Per-task events reuse existing canonical actions: work→pending = `task_postponed`/`POSTPONE` (reason `day_ended_incomplete`/`in_progress_abandoned`); quick-check = `task_deferred`/`DEFER` (→ `scheduled` + `NextEligibleAt`). Each carries the rollover `idempotencyKey` + `source:'daily_rollover'`. The day-level idempotency row uses `Action=ROLLOVER`. No new enum names were invented.

## 8. Replacement activation decision
**Conservative — NOT added in this phase.** Rollover moves unfinished work to pending and reschedules checks; it does **not** promote `scheduled → active`. `materializeTasksForPlanDay` still caps active at 3, and the executor never activates beyond the cap. New-day activation continues to come from the existing generate/read flow. (Revisit as an explicit future option with its own tests if product wants auto-refill to 3.)

## 9. Final-day policy
**Implemented:** if `calendarDay >= totalPlanDays`, the executor does **not** move work to pending (`finalDay:true`, `movedToPendingCount:0`, diagnostic `FINAL_DAY_NO_PENDING_MOVE`) — it only surfaces the existing backlog. If `totalPlanDays` is unavailable it emits `FINAL_DAY_POLICY_UNKNOWN` (a pre-live blocker) and does not special-case. The snapshot exposes `totalPlanDays`, which `plan.js` passes through.

## 10. Tests / build result
`test:mentor-rollover-write` **21/21** (gates 1–6; persist-to-pending; in_progress reason; quick-check reschedule; RowVersion++; stale-skip; one event per applied; idempotency finalize/replay; partial-failure no-finalize; LastProcessedCalendarDay incl. missing-column; already-processed no-op; plan.js gate source-assert; ≤3 active; no net-new ids; final-day). Full suite **478 passed, 0 failed** (incl. rollover-dry-run 11, daily-rollover 67, state-machine 45, plan-day 25, monitor-alerts 9, allow-all 10, route-readiness 12, v2-complete/resume/postpone, read-overlay, mutation-service, repo, sheets, sheets-writer, cron-monitor, monitor-workflow, optimization). `npx next build` → **✓ Compiled successfully**.

## 11. No-live-write confirmation
The executor was exercised **only** against fake/in-memory repositories. The production Sheet was **not** mutated; `processDailyRollover`/the executor were **not** run live this phase. `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` / the new rollover flags remain **false/unset** in production, so the `plan.js` write branch is dead code. No env change, no deploy, no commit/push.

## 12. Still required before Phase 10D (first live test)
1. **Add the additive `MentorPlans.LastProcessedCalendarDay` column** to the live Sheet (10C-schema-prep, Phase-6C pattern) — without it, the day-marker write no-ops and "once per day" relies on legacy `activeDayNumber`.
2. **Fresh `.xlsx` backup** before the first live rollover.
3. **Confirm `totalPlanDays`** is populated in the repo snapshot for the test user (else `FINAL_DAY_POLICY_UNKNOWN`).
4. **Decide the rollover monitor counters** (Phase 10E) — keep `MENTOR_DAILY_ROLLOVER_V2=true` CRITICAL until then (unchanged).
5. **Pick the pilot user** via `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` (the test-user hash), not allow-all, for the first live run.
6. **Commit + deploy** this code to `main` (Vercel) so the gated path exists in production before enabling the flag.

## 13. Blocking items
- **Blocking for live 10D:** the `LastProcessedCalendarDay` column must exist in the live Sheet; `totalPlanDays` must be present for the pilot plan (final-day policy); the code must be on `main`/deployed. None block this code-only phase.
- **Monitor:** `MENTOR_DAILY_ROLLOVER_V2=true` stays **CRITICAL** in the monitor until Phase 10E (intentional guardrail) — confirmed unchanged.

---

*Phase 10C complete — daily-rollover write path implemented behind fail-closed flags, with real user scope, idempotent resumable persistence, column-tolerant day-marker, and a conservative final-day/replacement policy. No live write, no flag enablement, no deploy, no commit/push.*
