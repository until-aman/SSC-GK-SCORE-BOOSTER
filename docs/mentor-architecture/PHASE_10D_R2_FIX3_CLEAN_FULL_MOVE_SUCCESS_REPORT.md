# Phase 10D-R2 / FIX-3 — Clean Full Rollover Completed in Production (SUCCESS)

**Date:** 2026-06-13
**Outcome:** ✅ **SUCCESS.** After fixing the true root cause (FIX-3), a live daily rollover completed the **entire** write sequence in a single un-truncated pass on a fresh clean test plan: work task → pending, both quick-checks → scheduled, `LastProcessedCalendarDay` written to the active row, and the `Action=ROLLOVER` idempotency row finalized. Monitor stayed `WARNING` (no CRITICAL) throughout; the pilot flag was turned off after the run.

---

## 1. The real root cause (FIX-3)
Every prior live rollover (10D, R1, R2, first R2-retry) truncated mid-write. Cause: in `pages/api/mentor/plan.js` the rollover ran as a **fire-and-forget `.then()` never awaited** before `res.status(200).json(...)`. On Vercel the serverless function is frozen once the response is sent, killing the rollover's ~10–17 sequential Sheets calls partway. FIX-2's retry/backoff couldn't help (the function was terminated, not erroring). Diagnostic signatures: different abort point each trigger, no `[mentor-rollover-write]` log, each re-trigger backfilling one more write then re-freezing, and the only "successful" prior run (R1) needed just ~3 writes.

**Fix (PR #74, merged → `main` `4ffe349`):** the eligible-cohort write is now **awaited before the response**; the no-write shadow path stays fire-and-forget; write failures are caught/logged and never fail the user's plan (still 200). FIX-2 retry stays as defense against genuine transient errors. Test `R-FIX3` guards that the eligible write is awaited before `res.json` and not inside a `.then(`.

## 2. Candidate
- Prior candidates rejected: `backupofpocox3`/`MP_1780920810055` (the monitor's affected baseline + actively drifting), `aman.iitkgp00` (no active work), the old `MP_T9B2` partial plan.
- **Fresh dedicated test plan:** `malikmadhu555@gmail.com` (`u_3fa204273ffb0b96`), plan **`MP_1781339252731`** — not the affected plan. Founder generated it and **backdated `PlanStartLocalDate=2026-06-12`** so `calendarDay=2 > lastProcessed=1`. Single generation, `TotalPlanDays=31`, no prior rollover state. Standard day-1 shape: **1 work task + 2 quick-checks**.

## 3. Shadow (pre-trigger, exact)
`rolloverRequired=true`, `moved=1` (`Daily Challenge_weak_1`, mistake_recovery → pending), `rescheduled=2` (`Polity_coverage_2`, `Geography_coverage_3` → scheduled), `LastProcessedCalendarDay=2`, key `mentor-rollover:u_3fa204273ffb0b96:MP_1781339252731:2`. Exercises **both** rollover paths (POSTPONE + DEFER_CHECK), matching the R2 objective ("work → pending; quick-checks → scheduled").

## 4. Run sequence
1. Two triggers on the **pre-FIX-3** build truncated (1 work move + partial reschedule; no marker/ROLLOVER row) — this is what surfaced the root cause.
2. FIX-3 merged + deployed (`4ffe349`); pilot re-enabled (`MENTOR_DAILY_ROLLOVER_V2=true`, allowlist `u_3fa204273ffb0b96`).
3. **One trigger on the FIX-3 build → completed in one pass.**

## 5. Final verified state (read-only)
| Item | Result |
|---|---|
| `Daily Challenge_weak_1` | **pending**, `day_ended_incomplete`, rv2 ✓ |
| `Geography_coverage_3` | **scheduled**, `nextEligibleAt` set, rv2 ✓ |
| `Polity_coverage_2` | **scheduled**, `nextEligibleAt` set, rv3 (2 `DEFER_CHECK` events — see §7) |
| active plan row `LastProcessedCalendarDay` | **2** ✓ — *first time this ever landed* |
| `MentorMutationRequests` | one `Action=ROLLOVER`, `Status=completed`, `PlanId=MP_1781339252731` ✓ — *first time this ever landed* |
| affected plan `MP_1780920810055` | untouched, 0 rollover events ✓ |

## 6. Monitor before / during / after
| Stage | Status |
|---|---|
| Pre-enable (flag off) | WARNING, no CRITICAL |
| After enable (flag on) | WARNING — `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1 |
| Post-run (flag on) | WARNING — `dup=0, failed=0, quickCheckPending=0, activeOverLimit=0`, `rolloverMutationRequestCount=2` |
| Final baseline (flag off) | WARNING — `dailyRolloverFlagEnabled=false`; only `ALLOW_ALL_ENABLED` + the old-`MP_T9B2` `ROLLOVER_LAST_PROCESSED_MISSING` residual |
No CRITICAL at any point. `malikmadhu555`'s marker is written, so it is **not** in the missing count.

## 7. Residuals (benign, not FIX-3 issues)
- `Polity_coverage_2`: 2 `DEFER_CHECK` events / rv3 — leftover of the pre-FIX-3 truncated run that had already rescheduled it once; the completing run re-deferred it. Task final state is correct (scheduled). Future triggers idempotent-replay (ROLLOVER row present) → no further changes.
- Old `MP_T9B2` test plan still shows `ROLLOVER_LAST_PROCESSED_MISSING` (regenerated with a blank marker); unrelated to this test. Optional cleanup later.

## 8. Idempotency
The `ROLLOVER` row for `…:MP_1781339252731:2` is finalized, so any further `malikmadhu555` plan load this calendar day replays (no writes). Verified by design + unit tests (`rollover-write` 33/33); a live replay was not separately triggered (not needed).

## 9. Safety confirmation
Only the expected writes on the pilot plan occurred (1 work→pending, 2 quick-checks→scheduled, day-marker, one ROLLOVER row, task events). No non-pilot user touched; affected plan untouched by rollover; no hand-edits to task rows; flag returned to off after the run.

## 10. Net result & readiness
The gated daily-rollover write path is now **proven end-to-end in production**: correct task transitions, current-generation scoping (Bug C), idempotent finalization (Bug B), multi-generation-safe plan-row targeting (Bug A), transient-write resilience (FIX-2), and — the decisive fix — **completion without serverless truncation (FIX-3)**.

**Before any cohort expansion / always-on rollover:**
1. Replace the awaited write with a non-blocking background mechanism (Vercel `waitUntil` or a scheduled cron) so always-on rollover doesn't add per-request latency at scale. (Await is correct for the narrow pilot; not ideal for all-users on the plan-load path.)
2. Decide whether to retire/repoint the monitor's hardcoded affected-plan baseline (`MP_1780920810055`).
3. Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` off and rollover allow-all forbidden until that background mechanism lands; expand by allowlist only.
4. Optionally tidy the `MP_T9B2` / `Polity` residuals.
