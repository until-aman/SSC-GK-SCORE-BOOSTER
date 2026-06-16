# Phase 10F3 — waitUntil Background Rollover Pre-Flight Validation Plan

**Date:** 2026-06-13
**Type:** Documentation / pre-flight plan only. **No flags enabled, no Sheet mutation, no Mentor trigger, no live rollover.**

This document is the safety gate and exact procedure to validate the Phase 10F2 `waitUntil` background rollover **before** any live background run (Phase 10F4).

---

## 1. `main` has the 10F2 code at `0e3feba`
Verified on `origin/main` (HEAD `0e3feba`, "Merge pull request #77 from until-aman/phase-10f2-waituntil"):
- `pages/api/mentor/plan.js`: eligible write factored into `runRollover()`; `if (isMentorDailyRolloverBackgroundEnabled()) runBackgroundTask(runRollover(), 'mentor-rollover-write')` else `await runRollover()`; `export const config = { maxDuration: 60 }`.
- `lib/mentor/util/backgroundTask.js`: `runBackgroundTask` + lazy/optional `require('@vercel/functions')` `waitUntil`.
- `lib/mentor/repository/featureFlags.js`: `isMentorDailyRolloverBackgroundEnabled()` (fail-closed exact `"true"`).
- `lib/mentor/read/v2MutationMonitor.js`: `rolloverEligiblePlansLagging` counter + `ROLLOVER_ELIGIBLE_PLANS_LAGGING` WARNING.

## 2. Production deploy for `0e3feba` must be Ready before any test
The `main` merge auto-triggers a Vercel Production deploy. **Before Phase 10F4, the founder must confirm the Production deployment built from `0e3feba` is Ready.** If the live deployment is older than `0e3feba`, the `waitUntil` path is not present and a background run would behave like the old fire-and-forget (truncation) — so do not proceed until `0e3feba` is the live build.

## 3. `@vercel/functions` is installed from the lockfile
`package.json` pins `@vercel/functions ^1.6.0` and **`package-lock.json` contains `node_modules/@vercel/functions`** (verified), so a Vercel `npm ci` build installs it deterministically. This matters: `runBackgroundTask` only uses real `waitUntil` when the package resolves; without it, it falls back to fire-and-forget (which Vercel truncates). Confirm the deploy build log shows `@vercel/functions` installed.

## 4. Current flag state (must hold through 10F3)
```
MENTOR_DAILY_ROLLOVER_V2        = false / unset     (master rollover gate — OFF)
MENTOR_DAILY_ROLLOVER_BACKGROUND = false / unset    (background mode — OFF / dark)
MENTOR_PENDING_LIFECYCLE_V2     = false / unset      (OFF)
MENTOR_DAILY_ROLLOVER_ALLOW_ALL = false / unset      (FORBIDDEN)
```
Background mode is doubly dark: the rollover block is gated by `MENTOR_DAILY_ROLLOVER_V2` (off → no rollover at all), and the background dispatch needs `MENTOR_DAILY_ROLLOVER_BACKGROUND=true` (unset). The 10F2 code is behavior-neutral in this state.

## 5. Monitor baseline expectations (flag off)
Read-only monitor should report:
```
ALERT STATUS: WARNING        (no CRITICAL)
dailyRolloverFlagEnabled = false
rolloverAllowAllEnabled  = false
duplicateRolloverIdempotencyKeys = 0
failedRolloverMutationRequests   = 0
quickChecksIncorrectlyPendingByRollover = 0
activeTaskCountOverLimit = 0
rolloverEligiblePlansLagging = 0     (lag counter dark while flag off)
```
Expected WARNINGs only: `ALLOW_ALL_ENABLED` (deliberate prod mode) and the known `ROLLOVER_LAST_PROCESSED_MISSING` residual from the old `MP_T9B2` test plan (benign, unrelated). Any CRITICAL ⇒ stop and investigate before 10F4.

## 6. Candidate requirements for 10F4
A **fresh, clean, non-affected** test plan owned by a designated test account:
- **NOT** `MP_1780920810055` (the affected/baseline plan).
- Active plan with **≥1 uncompleted active work task** (practice/revision/mistake_recovery/theory). 1 work + 2 quick-checks (the standard day shape) is ideal — it exercises POSTPONE **and** DEFER_CHECK.
- `TotalPlanDays > 0`.
- `calendarDay > LastProcessedCalendarDay` (e.g., generate the plan, then backdate `PlanStartLocalDate` to ≥ yesterday so today is calendarDay ≥ 2; keep `LastProcessedCalendarDay` blank/1 and `ActiveDayNumber` 1).
- **No prior `Action=ROLLOVER` row** for `mentor-rollover:{scope}:{planId}:{calendarDay}` and no `daily_rollover` events for the target tasks.
- The test account's scope hash goes in `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` (allowlist-only; never allow-all).

## 7. Fresh backup requirement
A fresh `.xlsx` backup of the live Sheet **must** be taken immediately before enabling the flags in 10F4 (hard gate). Record filename + timestamp + row counts (MentorPlans / MentorTasks / MentorTaskLogs / MentorMutationRequests). Do not proceed without it.

## 8. Exact 10F4 live-test steps
0. Confirm deploy `0e3feba` Ready (§2) and monitor baseline clean (§5).
1. Fresh `.xlsx` backup (§7).
2. Read-only **shadow** of the candidate → record exact `moved` / `rescheduled` / task ids / `LastProcessedCalendarDay` / idempotency key.
3. **Set env + redeploy** (founder): `MENTOR_DAILY_ROLLOVER_V2=true`, `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES=<test scope>`, **`MENTOR_DAILY_ROLLOVER_BACKGROUND=true`**. Keep `MENTOR_DAILY_ROLLOVER_ALLOW_ALL` and `MENTOR_PENDING_LIFECYCLE_V2` off. Wait until Ready.
4. Post-enable monitor (read-only): expect `WARNING`, `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1, no CRITICAL; `rolloverEligiblePlansLagging` may show the owed plan (expected — not yet processed).
5. **One trigger** (founder): hard reload the Mentor page as the test account only (single `GET /api/mentor/plan`, 200, not cached). No refresh; no other account.
6. **Measure the response time** (§9).
7. Read-only Sheet verification (founder waits ~5–15 s for the background write, then I read): work→pending, quick-checks→scheduled, `LastProcessedCalendarDay = calendarDay`, one `Action=ROLLOVER/completed` row, one event per task, no duplicates, affected plan untouched.
8. Post-run monitor: `WARNING`, no CRITICAL; `rolloverEligiblePlansLagging` clears once the write completes; `duplicate/failedRollover=0`.
9. **Disable** (founder): `MENTOR_DAILY_ROLLOVER_V2=false` (and `MENTOR_DAILY_ROLLOVER_BACKGROUND=false`), redeploy; I confirm baseline.

## 9. Response-time measurement requirement (DevTools)
On the single 10F4 trigger, the founder must capture **DevTools → Network → `GET /api/mentor/plan`** timing:
- **Background (waitUntil) success:** response returns **fast** — comparable to a normal plan load (~hundreds of ms), **not** the ~3–6 s blocking of the awaited path. Record the actual ms.
- Compare against a normal (non-rollover) plan load as the reference. The whole point of 10F2 is that the rollover no longer blocks this response.

## 10. Success / failure criteria
**Success (all must hold):**
- `GET /api/mentor/plan` returns fast (not blocked on the rollover) — proves background dispatch.
- The rollover **still completes** end-to-end (tasks moved/rescheduled, marker written, `ROLLOVER/completed` row) within a short window after the response — proves `waitUntil` kept the function alive (no truncation).
- No duplicate task events / no duplicate idempotency key; affected plan untouched; monitor stays `WARNING` (no CRITICAL); lag clears.

**Failure (stop + rollback):**
- Response is slow (~seconds) → background dispatch not taking effect (deploy/flag/`@vercel/functions` issue).
- Rollover partial/truncated (missing marker or `ROLLOVER` row) after a reasonable wait → `waitUntil` not keeping the function alive (likely `@vercel/functions` not installed in the live build) → fall back to awaited mode.
- Any CRITICAL alert, duplicate idempotency key, or affected-plan change → stop, investigate, restore from backup if data changed.

## 11. Rollback steps
1. **Stop background, keep proven path:** `MENTOR_DAILY_ROLLOVER_BACKGROUND=false` + redeploy → reverts to the FIX-3 **awaited** write (proven in 10D-R2). Rollover still works, just blocking.
2. **Stop all rollover:** `MENTOR_DAILY_ROLLOVER_V2=false` + redeploy → no rollover writes at all (proven kill-switch).
3. **Data rollback:** restore the fresh `.xlsx` backup, or narrowly revert the affected task/plan/log/mutation rows. Idempotency + RowVersion make a corrected re-run safe.

## 12. 10F3 confirmation — no write / no env / no live trigger
This phase (10F3) performed **only** repository inspection of `main` and a read-only monitor reading, and authored this plan. **No flag enabled, no production env changed, no Sheet mutated, no Mentor page triggered, no rollover run, no deploy, no residual cleanup.** Production remains: rollover off, background off, pending-lifecycle off, allow-all off.
