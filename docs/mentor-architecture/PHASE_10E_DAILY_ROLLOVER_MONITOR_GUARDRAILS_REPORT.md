# Phase 10E — Daily Rollover Monitor Counters / Guardrails

**Date:** 2026-06-12
**Type:** Monitor / read-only implementation. No rollover execution, no flag enablement, no Sheet mutation, no env change, no deploy.

---

## 0. Summary

The production V2 mutation monitor is now **rollover-aware**. The old behavior — `MENTOR_DAILY_ROLLOVER_V2=true` ⇒ CRITICAL purely because the flag was on — is replaced with **stage-aware** flag rules and **data-driven anomaly counters** read from the existing sheets. A narrow allowlisted Phase 10D pilot now yields **WARNING** (not CRITICAL); only real rollover anomalies (or rollover allow-all) are CRITICAL. Verified against live data (read-only): all rollover counters are `0` pre-pilot, no false positives.

## 1. Files changed

| File | Change |
|---|---|
| `lib/mentor/read/v2MutationMonitor.js` | Added rollover constants + `isRolloverKey`/`parseRolloverKey`; added read-only rollover counters to `auditV2Mutations` (now also reads `MentorPlans`); replaced the flag-only `ROLLOVER_WRITE_ENABLED` CRITICAL with stage-aware rules + 7 anomaly alerts; `cronMonitorResult` now surfaces a `rollover` block + rollover flags. |
| `scripts/mentor-v2-mutation-monitor.js` | Builds rollover flag state (`MENTOR_DAILY_ROLLOVER_ALLOW_ALL`, `rolloverAllowlistCount`) and prints a `Rollover:` CLI block. |
| `pages/api/internal/mentor-v2-monitor.js` | Vercel-cron route passes rollover flag state into `cronMonitorResult`. |
| `scripts/test-mentor-monitor-alerts.js` | Extended fixtures (Type column, `MentorPlans`, rollover keys); added 14 rollover cases (`R1`–`R12` + `R7b`/`R8b`). |
| `scripts/test-mentor-allow-all.js` | Updated test 10 to the new alert codes (`DAILY_ROLLOVER_FLAG_NO_COHORT`, `PENDING_LIFECYCLE_WRITE_ENABLED`). |
| `docs/mentor-architecture/MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md` | New §5b documenting rollover flag stages, anomaly thresholds, the false-positive guard, and the expected pre-pilot / pilot monitor state. |

## 2. Counters added (read-only, from existing sheets)

From `MentorMutationRequests` (rollover rows = `Action=ROLLOVER` / `IdempotencyKey` `mentor-rollover:*`):
- `rolloverMutationRequestCount`, `duplicateRolloverIdempotencyKeys`, `failedRolloverMutationRequests`

From `MentorTaskLogs` (`SourcePage=daily_rollover`):
- `rolloverTaskEventCount`, `tasksMovedToPendingByRollover`

From `MentorTasks` (scoped to rollover-processed plans where it matters):
- `quickChecksIncorrectlyPendingByRollover`, `activeTaskCountOverLimit`, `maxPendingBacklogByPlan` (+ `pendingBacklogByPlan` map)

From `MentorPlans` cross-referenced with rollover events:
- `rolloverPlansMissingLastProcessedCalendarDay`, `mentorPlansCount`

Flag state surfaced: `dailyRolloverFlagEnabled`, `rolloverAllowAllEnabled`, `rolloverAllowlistedUsersCount`.

## 3. Alert rules changed

**Replaced:** `MENTOR_DAILY_ROLLOVER_V2=true ⇒ CRITICAL ROLLOVER_WRITE_ENABLED` → stage-aware:
- allow-all on → **CRITICAL** `DAILY_ROLLOVER_ALLOW_ALL_ENABLED`
- flag on + allowlist non-empty (allow-all off) → **WARNING** `DAILY_ROLLOVER_PILOT_ENABLED`
- flag on + no cohort → **CRITICAL** `DAILY_ROLLOVER_FLAG_NO_COHORT`

**New CRITICAL (data-driven):** `DUPLICATE_ROLLOVER_IDEMPOTENCY_KEYS`, `FAILED_ROLLOVER_MUTATIONS`, `QUICK_CHECK_PENDING_ANOMALY`, `ACTIVE_TASK_LIMIT_EXCEEDED`.
**New WARNING:** `PENDING_BACKLOG_HIGH` (>25), `ROLLOVER_PENDING_VOLUME_HIGH` (>50), `ROLLOVER_LAST_PROCESSED_MISSING`.

**Kept unchanged:** `ALLOW_ALL_ENABLED` (WARNING), `UNEXPECTED_OUTSIDE_ALLOWLIST` (CRITICAL, suppressed under allow-all), `DUPLICATE_IDEMPOTENCY_KEYS` (CRITICAL), `FAILED_MUTATIONS` (WARNING/CRITICAL), `AFFECTED_REAL_PLAN_DATA_LOSS` (CRITICAL) / `AFFECTED_REAL_PLAN_SNOOZED_DROP` (WARNING), `PENDING_LIFECYCLE_WRITE_ENABLED` (CRITICAL).

**False-positive guard (Phase 9M3 lesson reapplied):** `activeTaskCountOverLimit` and `quickChecksIncorrectlyPendingByRollover` are scoped to **plans rollover actually processed**. This was caught against live data — 2 real plans have >3 active tasks from the normal generator while rollover has never run; an unscoped counter would have falsely fired CRITICAL. Scoped ⇒ pre-pilot value is `0`.

## 4. Test fixtures added

`scripts/test-mentor-monitor-alerts.js` (now **23/23**): added `Type` column + `MentorPlans` tab + `rKey()` rollover-key helper. New cases:
- R1 flag off ⇒ OK · R2 flag on + cohort ⇒ WARNING only · R3 flag on + no cohort ⇒ CRITICAL · R4 allow-all ⇒ CRITICAL
- R5 duplicate rollover key ⇒ CRITICAL · R6 failed rollover mutation ⇒ CRITICAL
- R7 quick-check pending on rollover plan ⇒ CRITICAL · **R7b** quick-check pending on non-rollover plan ⇒ no anomaly
- R8 >3 active on rollover plan ⇒ CRITICAL · **R8b** >3 active on non-rollover plan ⇒ OK (false-positive guard)
- R9 rollover events + blank `LastProcessedCalendarDay` ⇒ WARNING (and populated ⇒ none)
- R10 pending-lifecycle flag ⇒ CRITICAL · R11 action allow-all stays WARNING · R12 general dup/failed alerts still fire (and no rollover false-fire)

## 5. Expected pre-pilot monitor output (rollover flags off)

```
Rollover:
  dailyRolloverFlagEnabled=false  rolloverAllowAllEnabled=false  rolloverAllowlistedUsersCount=0
  rolloverMutationRequestCount=0  duplicateRolloverIdempotencyKeys=0  failedRolloverMutationRequests=0
  tasksMovedToPendingByRollover=0  quickChecksIncorrectlyPendingByRollover=0  activeTaskCountOverLimit=0
  maxPendingBacklogByPlan=2  rolloverPlansMissingLastProcessedCalendarDay=0
```
Overall status is driven only by existing mutation guardrails (`WARNING ALLOW_ALL_ENABLED` under prod's allow-all). **Confirmed against live data** (read-only) — all rollover counters `0`, `activeTaskCountOverLimit=0` after scoping.

## 6. Expected pilot monitor output (Phase 10D: flag on + 1 allowlisted test user, allow-all off)

`WARNING DAILY_ROLLOVER_PILOT_ENABLED`, `rolloverAllowlistedUsersCount=1`, all anomaly counters `0`, `rolloverPlansMissingLastProcessedCalendarDay=0` once the day-marker writes. Any CRITICAL rollover code ⇒ stop and roll back per checklist §4.

## 7. Confirmation: no writes / env / deploy

- **No Sheet mutation** — monitor performs only `values.get`; test fakes throw on `update`/`append`.
- **No flag enablement** — `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_DAILY_ROLLOVER_ALLOW_ALL` untouched (off/unset).
- **No rollover executed**, **no production env change**, **no deploy**. Live runs were read-only audits.

## 8. Verification

| Suite | Result |
|---|---|
| `test:mentor-monitor-alerts` | 23/23 |
| `test:mentor-monitor-workflow` | 11/11 |
| `test:mentor-rollover-write` | 21/21 |
| `test:mentor-rollover-dry-run` | 11/11 |
| `test:mentor-route-readiness` | 12/12 |
| `test:mentor-allow-all` | 10/10 |
| `test:mentor-v2-complete` / `-resume` / `-postpone` | 21 / 18 / 20 |
| `test:mentor-state-machine` / `-plan-day` / `-sheets-writer` | 45 / 25 / 23 |
| `test-mentor-api-optimization` | 42 |
| **Build** | ✓ Compiled successfully |

## 9. Readiness for Phase 10D

Monitor readiness — the last blocker before Phase 10D — is **satisfied**. Enabling `MENTOR_DAILY_ROLLOVER_V2=true` for a narrow allowlisted test user (allow-all off) now produces a **WARNING**, not a CRITICAL, while preserving CRITICAL detection for true rollover anomalies and for rollover allow-all.

## 10. Blocking items before Phase 10D first live run

1. **Fresh `.xlsx` backup** immediately before the first live rollover.
2. **Confirm `TotalPlanDays`** populated for the pilot plan (final-day policy; else `FINAL_DAY_POLICY_UNKNOWN`).
3. **Pick the pilot user** via `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` (test-user hash) — **not** allow-all; keep `MENTOR_DAILY_ROLLOVER_ALLOW_ALL` off (CRITICAL).
4. Keep `MENTOR_PENDING_LIFECYCLE_V2` **off**.
5. This phase's monitor change must be **merged to `main` and deployed** so the cron/route uses the new rules before the pilot flag is flipped. (`LastProcessedCalendarDay` column already present — Phase 10C2.)
