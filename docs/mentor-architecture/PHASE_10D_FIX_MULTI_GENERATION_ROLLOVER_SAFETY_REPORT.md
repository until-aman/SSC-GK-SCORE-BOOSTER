# Phase 10D-FIX — Daily Rollover Multi-Generation Plan Safety Fix

**Date:** 2026-06-13
**Type:** Code / test / report only. No live rollover, no flag enablement, no Sheet mutation, no env change, no deploy.

---

## 1. Root cause

All three Phase 10D defects share one root condition: the pilot plan `MP_T9B2_1781154796908` has **12 `MentorPlans` rows under a single reused `PlanId`** (11 `invalid` old generations + 1 `active`), and `GenerationId` / `PlanVersion` / `TaskSetRevision` are **all blank** on both plan and task rows. The rollover write path and the monitor resolved by `PlanId` alone, so they hit stale generations:
- **Bug A** — `setLastProcessedCalendarDay` took the *first* `planId+email` match (a stale `invalid` row).
- **Bug B** — the `Action=ROLLOVER` idempotency row didn't persist, and the failure was **swallowed** by `plan.js`'s `.catch(() => {})`, so it was invisible.
- **Bug C** — the monitor counted active tasks by `PlanId` across **all** generations (~20), false-firing `ACTIVE_TASK_LIMIT_EXCEEDED`.

The canonical generation rule already exists in `legacyGenerationAdapter`/`validateActivePlanPointer`: **the active generation is the newest `Status=active` plan row's `CreatedAt`; a task/marker belongs to it when its `CreatedAt >=` that timestamp.** All three fixes adopt this rule.

## 2. Files changed
| File | Fix |
|---|---|
| `lib/mentor/repository/sheetsMutationRepository.js` | Bug A — `createSheetsPlanWriter` resolves the active/current-generation row; fail-closed on ambiguity. |
| `lib/mentor/services/rolloverWriteExecutor.js` | Bug B — surface day-marker + finalization failures as `ok:false`; pass the active-plan hint; treat partial success as failure. |
| `pages/api/mentor/plan.js` | Bug B — log rollover write failures (`[mentor-rollover-write] FAILED`) and replace the silent `.catch(() => {})` with a logging catch. |
| `lib/mentor/read/v2MutationMonitor.js` | Bug C — scope `activeTaskCountOverLimit` and the missing-marker check to the current generation (active-row `CreatedAt` window). |
| `scripts/test-mentor-rollover-write.js` | Regression: A1–A5 (plan-writer) + B1–B4 (finalization visibility). |
| `scripts/test-mentor-monitor-alerts.js` | Regression: C1–C3 (generation scoping) + updated R8/R8b fixtures. |

## 3. Plan-row resolution fix (Bug A)
`createSheetsPlanWriter` now resolves a unique target row via `resolvePlanRowIndex`:
1. candidates = exact `PlanId` (+ `Email` when known);
2. narrow by an exact `GenerationId` / `PlanVersion` hint **only when both the hint and the column are populated** (blank columns are ignored — the live case);
3. **prefer `Status=active`**; **never** select an `invalid`/superseded row when an active one exists;
4. disambiguate multiple active rows by newest `CreatedAt`, then highest `PlanVersion`, then latest `UpdatedAt`;
5. **fail closed** — `PLAN_ROW_AMBIGUOUS` (indistinguishable actives) or `PLAN_ROW_NO_ACTIVE` (none active) → **no write**.
`getLastProcessedCalendarDay` uses the same resolver (reads the active row, ignores stale-row values).

## 4. Idempotency finalization visibility fix (Bug B)
- The executor passes `{ planVersion, generationId }` from `activePlan` to the writer.
- A day-marker result of `PLAN_ROW_NOT_FOUND` / `PLAN_ROW_NO_ACTIVE` / `PLAN_ROW_AMBIGUOUS` ⇒ **`ok:false ROLLOVER_DAY_MARKER_UNRESOLVED`**, and the idempotency row is **not** finalized (a corrected re-run resumes). `LAST_PROCESSED_COLUMN_MISSING` is still tolerated (Phase 10C contract).
- The day-marker write and the idempotency `save` are wrapped: a throw ⇒ **`ok:false ROLLOVER_DAY_MARKER_FAILED` / `ROLLOVER_FINALIZE_FAILED`** (no silent partial success).
- `plan.js` now logs `[mentor-rollover-write] FAILED` with `code/reason/error/applied/lastProcessedWritten`, and the rollover chain ends in `.catch(err => console.error('[mentor-rollover] unhandled', …))` instead of an empty swallow — so a finalization failure is **visible in the Vercel logs**.
- Root-cause note: in the live run the day-marker write **succeeded on the wrong (stale) row** and the subsequent `save` did not persist; because the old code never surfaced the failure, the exact trigger (transient Sheets error vs. exception) couldn't be confirmed from logs. The fix makes any recurrence visible and converts it into an explicit, resumable failure rather than a silent partial success.

## 5. Monitor scoping fix (Bug C)
The audit computes, per plan, the **active-generation row** (newest `Status=active`, else newest row) and its `CreatedAt`:
- `activeTaskCountOverLimit` now counts only active tasks (on rollover-processed plans) whose `CreatedAt >=` the active-generation `CreatedAt`. Stale generations are excluded.
- `rolloverPlansMissingLastProcessedCalendarDay` now reads the marker from the **active-generation row** (a marker on a stale row no longer counts).
- Verified on **live** post-pilot data (read-only): `activeTaskCountOverLimit` 1→**0**; monitor CRITICAL→**WARNING** (only `ALLOW_ALL_ENABLED` + `ROLLOVER_LAST_PROCESSED_MISSING`).

## 6. Regression tests added
- **rollover-write (30/30):** A1 active-row-only write among 12 same-PlanId rows (invalid rows unchanged); A2 no-active → fail closed; A3 ambiguous → fail closed; A4 newest-active wins; A5 getter reads active row; B1 unresolved marker → `ok:false` not finalized; B2 finalization throw → `ROLLOVER_FINALIZE_FAILED`; B3 success still finalizes `Action=ROLLOVER`; B4 plan.js surfaces failures.
- **monitor-alerts (26/26):** C1 multi-gen old>3 / current≤3 → `activeTaskCountOverLimit=0`, OK; C2 current-gen >3 → CRITICAL; C3 stale-row marker but blank active row → still WARNING; updated R8/R8b with generation-aware fixtures.
- All tests use **fake/in-memory** sheets; writers throw on accidental writes. No live writer is exercised.

## 7. Partial pilot-state recommendation
The Phase 10D run left a partial state on the **test plan only**: 2 tasks pending, 2 `daily_rollover` POSTPONE events, `LastProcessedCalendarDay=3` on a stale `invalid` row, blank on the active row, no `ROLLOVER` idempotency row. **Do not hand-edit** (phase rule). Options, in order of preference:
1. **Restore the test plan rows from the founder's `.xlsx` backup** before the retry (cleanest — clears the residual `ROLLOVER_LAST_PROCESSED_MISSING` WARNING).
2. **Use a fresh, clean test plan** for the retry.
3. A controlled repair script in a separate approved phase.
Until then, the production cron monitor returns **WARNING** (no longer CRITICAL after this fix deploys), with `ROLLOVER_LAST_PROCESSED_MISSING` as the honest residual signal.

## 8. Tests / build
| Suite | Result |
|---|---|
| `test:mentor-rollover-write` | 30/30 |
| `test:mentor-monitor-alerts` | 26/26 |
| `test:mentor-rollover-dry-run` | 11/11 |
| `test:mentor-route-readiness` | 12/12 |
| `test:mentor-sheets-writer` | 23/23 |
| `test:mentor-state-machine` | 45/45 |
| `test:mentor-plan-day` | 25/25 |
| `test:mentor-allow-all` | 10/10 |
| `test-mentor-api-optimization` | 42/42 |
| **Build** | ✓ Compiled successfully |

## 9. Ready for Phase 10D retry?
**Code-ready, pending prerequisites.** Bugs A–C are fixed with regression coverage and validated read-only against the live shape. Before a retry: (1) merge + deploy this PR; (2) restore/replace the test plan's partial state from backup; (3) fresh backup; (4) re-shadow on a plan that reproduces the multi-row `PlanId` shape; (5) confirm monitor WARNING baseline.

## 10. Blocking items before Phase 10D retry
1. Merge this PR to `main` and confirm the Vercel deploy is Ready (cron uses the fixed monitor; the executor uses the fixed writer).
2. Resolve the test plan's partial state (restore from backup, or a fresh clean test plan) — founder action; **not** hand-edited.
3. Fresh `.xlsx` backup immediately before the retry.
4. Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` **off** until the retry; pilot via `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` only; never rollover allow-all.
5. Re-run the read-only shadow prediction so it is boring/exact before flipping the pilot flag.
