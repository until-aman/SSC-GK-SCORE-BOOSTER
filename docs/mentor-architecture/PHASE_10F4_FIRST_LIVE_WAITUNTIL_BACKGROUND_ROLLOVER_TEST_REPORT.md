# Phase 10F4 — First Live waitUntil Background Daily Rollover Test

**Date:** 2026-06-15
**Outcome:** ✅ **Background completion validated** on the live build (rollover write ran to completion with **no truncation**). ⚠️ The **non-blocking** (`waitUntil` vs awaited) distinction was **not definitively log-confirmed** for the run (runtime log on a since-rotated deployment; response latency ambiguous but leaning non-blocking). Net: the critical proof (background write completes, no fire-and-forget truncation) is achieved; one clean latency/log confirmation is recommended before cohort rollout.

---

## 1. Deploy / version
- Live build commit **`1582885`** (on `origin/main`, `SSC-GK-SCORE-BOOSTER-V2`) — verified to contain the 10F2 code: `lib/mentor/util/backgroundTask.js` present, `plan.js` dual-mode dispatch (`isMentorDailyRolloverBackgroundEnabled` ×3), `maxDuration: 60`.
- Build log confirmed `@vercel/functions` installed ("added 435 packages") and `/api/mentor/plan` compiled. Deploy completed.

## 2. Pre-run flag state
`MENTOR_DAILY_ROLLOVER_V2=false`, `MENTOR_DAILY_ROLLOVER_BACKGROUND=false`, pending-lifecycle off, allow-all off. Baseline monitor `WARNING`, no CRITICAL, `rolloverEligiblePlansLagging=0`.

## 3. Candidate
- `amanantil.pm@gmail.com` (`u_5d2ffe7c1f2d0473`), plan **`MP_1781498125933`** — fresh, single-generation, **not** the affected plan / not MP_T9B2 / no prior rollover artifacts.
- Founder generated the plan, backdated `PlanStartLocalDate=2026-06-14` → `calendarDay 2`, `lastProcessed 1`. Day shape: **2 `coverage_check` tasks** (no work task — the generated day-1 plan had only quick-checks). Accepted (Option A) to validate the multi-write sequence; the work→pending path is already proven (10D-R2/FIX-3, same executor).

## 4. Shadow prediction (exact)
`rolloverRequired=true`, **`moved=0`, `rescheduled=2`**; both coverage-checks `active→scheduled` (DEFER_CHECK, rv blank→2); `LastProcessedCalendarDay→2`; key `mentor-rollover:u_5d2ffe7c1f2d0473:MP_1781498125933:2`; one `Action=ROLLOVER` row.

## 5. Backup
Founder-confirmed fresh `.xlsx` backup before enabling flags.

## 6. Env enable
Founder set (Production, + redeploy): `MENTOR_DAILY_ROLLOVER_V2=true`, `MENTOR_DAILY_ROLLOVER_BACKGROUND=true`, `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES=u_5d2ffe7c1f2d0473`. Allow-all + pending-lifecycle kept off.

## 7. Post-enable monitor
`WARNING`, no CRITICAL: `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1, `rolloverAllowAllEnabled=false`, pending-lifecycle false, `duplicate/failed/quickCheck/activeOverLimit=0`.

## 8. DevTools response-time measurement
Founder reported `GET /api/mentor/plan` ≈ **4 seconds**, status 200. Interpretation is **ambiguous**: for this fresh account the plan **re-generates on each load** (3 generations observed), an expensive operation, so ~4 s is plausibly the plan-generation baseline with the rollover running in the background. An *awaited* run would have been baseline **+** ~2–3 s rollover (≈ 5–7 s); 4 s being under that **leans non-blocking** — but is not conclusive on its own.

## 9. Sheet write verification (the key proof)
Read-only verification confirmed the **full sequence completed**:
- `Polity_coverage_1`, `Geography_coverage_2`: `active→scheduled`, `nextEligibleAt` set, **rv 2** ✓
- active plan row `LastProcessedCalendarDay = 2` ✓
- `MentorMutationRequests`: exactly one `Action=ROLLOVER / Status=completed` for key `…:2` ✓ (no duplicate, no failed)
- `MentorTaskLogs`: one `DEFER_CHECK / daily_rollover` event per task (no duplicates) ✓
- Affected plan `MP_1780920810055` untouched (0 rollover events); non-pilot users untouched ✓
**This rules out fire-and-forget truncation** — the background write ran to completion on the live build.

## 10. Post-run monitor
`WARNING`, no CRITICAL: `duplicateRollover=0`, `failedRollover=0`, `quickChecksIncorrectlyPending=0`, `activeTaskCountOverLimit=0`, `rolloverEligiblePlansLagging=0` (candidate's `ROLLOVER` row + marker present → not lagging).

## 11. Flag disable / final baseline
Founder set `MENTOR_DAILY_ROLLOVER_V2=false`, `MENTOR_DAILY_ROLLOVER_BACKGROUND=false`, redeployed. Final baseline monitor: `WARNING`, no CRITICAL, `dailyRolloverFlagEnabled=false`, `rolloverEligiblePlansLagging=0`, write path dead.

## 12. backgroundMode log (not located)
The `[mentor-rollover-write] { backgroundMode: … }` runtime line could not be located: Vercel runtime logs are **per-deployment**, and the production deployment that served the trigger has since been replaced (a UI PR merge created a newer deployment). The current deployment's logs show no `/api/mentor/plan` request in the window. The line would be in the **project-level** logs (Observability → Logs) on the older deployment.

## 13. Success / failure conclusion
- **Background completion: SUCCESS** — the multi-write rollover ran to completion on the live build with no truncation; deployed code has the `waitUntil` dual-mode + `@vercel/functions`. This is the decisive proof that the fire-and-forget truncation bug is resolved end-to-end in production.
- **Non-blocking (waitUntil vs awaited): INDICATED, NOT CONFIRMED** — the 4 s latency leans non-blocking (under the awaited estimate for a plan-generating account), but the definitive `backgroundMode` runtime line wasn't captured.

## 14. waitUntil proven?
**Partially.** Completion-without-truncation is proven; the non-blocking benefit is strongly indicated but pending a definitive `backgroundMode=waitUntil` reading (or a clean latency A/B).

## 15. Residuals
- The candidate plan `MP_1781498125933` regenerated after the test (3 generation rows; current active row has blank `PlanStartLocalDate` → `calendarDay 1`, hence the UI "day 1 of 60"). The rolled-over generation (row 27, `LPCD=2`) is now `invalid`. This is the legacy plan engine re-generating on load — unrelated to the rollover and harmless; no new rollover fired (nothing owed).
- Old `MP_T9B2` `ROLLOVER_LAST_PROCESSED_MISSING` residual still present (benign).

## 16. Next recommendation
1. **Definitively confirm non-blocking** before cohort rollout: on the next live background rollover, immediately capture the **project-level** `[mentor-rollover-write] { backgroundMode: 'waitUntil' }` log, **or** run a clean latency A/B (rollover-load vs normal-load on a stable plan that doesn't regenerate). A plan that doesn't regenerate-on-load would also remove the 4 s baseline ambiguity.
2. Until confirmed, keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_DAILY_ROLLOVER_BACKGROUND` off; allowlist-only; allow-all forbidden.
3. (Separate) investigate the fresh-account plan **regenerating on every load** — it complicates clean rollover testing and may warrant a look independent of the rollover work.

## 17. Safety confirmation
Only the expected writes on the pilot plan occurred (2 quick-checks→scheduled, day-marker, one `ROLLOVER` row, 2 events). No non-pilot/affected-plan writes, no hand-edits, no backup restore. Flags returned to off after the run; final baseline clean.
