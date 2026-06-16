# Phase 10F4B — Definitive waitUntil Non-Blocking Confirmation

**Date:** 2026-06-15
**Outcome:** ✅ **CONFIRMED.** The production runtime log shows **`backgroundMode: 'waitUntil'`** with `/api/mentor/plan` returning 200, and the background rollover write **completed after the response** without truncation. This closes the open item from 10F4: the daily-rollover write runs **non-blocking** in production via Vercel `waitUntil`.

---

## 1. Deploy / version
- `origin/main` HEAD **`f2facc5`** — verified to contain the 10F2 code: `runBackgroundTask` dispatch in `plan.js` (×3), `lib/mentor/util/backgroundTask.js`, `maxDuration: 60`, and `@vercel/functions` in `package-lock.json`. Founder confirmed Production deploy Ready.

## 2. Pre-run flags / monitor
Baseline (flags off) monitor: `WARNING`, no CRITICAL; `dailyRolloverFlagEnabled=false`, `rolloverEligiblePlansLagging=0`, `duplicate/failed/quickCheck/activeOverLimit=0`. (Benign residuals: `ALLOW_ALL_ENABLED`, and `ROLLOVER_LAST_PROCESSED_MISSING` for old MP_T9B2 + the regenerated amanantil.pm — unrelated.)

## 3. Candidate
- `malikmadhu555@gmail.com` (`u_3fa204273ffb0b96`), plan **`MP_1781339252731`** — not affected, not MP_T9B2.

## 4. Candidate stability / regeneration check
- **Stable: 1 `MentorPlans` row, last generated 2026-06-13**; it did **not** regenerate across the FIX-3 loads or this run (still 1 row after the trigger) — unlike the fresh `amanantil.pm` (3 generations). This stability is why it was chosen over a fresh account: clean, no plan-generation noise.

## 5. Baseline latency
- A separate flags-off baseline was **not** captured: the founder had already enabled the pilot flags before loading Mentor, so the "baseline" load was in fact the live trigger. Non-blocking is instead proven by the **preferred proof** (the runtime `backgroundMode='waitUntil'` log) rather than a latency A/B — which the phase accepts as definitive.

## 6. Shadow prediction (exact, matched)
`rolloverRequired=true`, **`moved=0`, `rescheduled=2`** (both coverage-checks `scheduled→scheduled` re-defer), `MULTI_DAY_GAP_PROCESSED`, marker→4, key `mentor-rollover:u_3fa204273ffb0b96:MP_1781339252731:4`.

## 7. Backup
Founder-confirmed fresh `.xlsx` backup before the run.

## 8. Env enable
Production (founder, + redeploy): `MENTOR_DAILY_ROLLOVER_V2=true`, `MENTOR_DAILY_ROLLOVER_BACKGROUND=true`, `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES=u_3fa204273ffb0b96`. Allow-all + pending-lifecycle off.

## 9. Post-enable monitor
`WARNING`, no CRITICAL; `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1, `rolloverAllowAllEnabled=false`, pending-lifecycle false.

## 10. Runtime log proof — the decisive result
Captured from production runtime logs for the `/api/mentor/plan` request (`malikmadhu555`):
```
[mentor-rollover-write] {
  backgroundMode: 'waitUntil',
  ok: true,
  idempotent: undefined,
  rolloverRequired: true,
  applied: 2,
  finalDay: false,
  lastProcessedWritten: true,
  diagnostics: [ 'MULTI_DAY_GAP_PROCESSED' ]
}
```
**`backgroundMode: 'waitUntil'`** — the rollover ran via Vercel `waitUntil` (registered after the response, function kept alive to completion), with `ok: true`, `applied: 2`, `lastProcessedWritten: true`.

## 11. DevTools response-time measurement
`GET /api/mentor/plan` returned **200**. A precise ms figure was not recorded for this load (it doubled as the trigger), but the `waitUntil` log establishes the response was sent independently of the write — the definitive non-blocking signal.

## 12. Non-blocking conclusion
**PROVEN (preferred proof).** Per the phase's success criteria, the runtime log `backgroundMode='waitUntil'` + a 200 response + the write completing after the response confirms the rollover write does not block the plan response in production.

## 13. Sheet write completion verification (read-only)
- `Polity_coverage_2`, `Geography_coverage_3`: `scheduled` with `nextEligibleAt`, RowVersion 3→**4** / 2→**3** ✓
- work task `Daily Challenge_weak_1`: unchanged (`pending`, rv2) ✓ (no work move expected)
- active plan row `LastProcessedCalendarDay = 4` ✓
- exactly one `MentorMutationRequests` `Action=ROLLOVER / Status=completed` for `…:4` (no duplicate, no failed) ✓
- exactly one `DEFER_CHECK / daily_rollover` event per task for `…:4` (no duplicates) ✓
- affected plan `MP_1780920810055` untouched; non-pilot users untouched ✓

## 14. Post-run monitor
`WARNING`, no CRITICAL; `duplicateRollover=0`, `failedRollover=0`, `quickChecksIncorrectlyPending=0`, `activeTaskCountOverLimit=0`, `rolloverEligiblePlansLagging=0`.

## 15. Flag disable / final baseline
Founder set `MENTOR_DAILY_ROLLOVER_V2=false`, `MENTOR_DAILY_ROLLOVER_BACKGROUND=false`, redeployed. Final baseline monitor: `WARNING`, no CRITICAL, `dailyRolloverFlagEnabled=false`, `rolloverEligiblePlansLagging=0`, write path dead.

## 16. Success / failure conclusion
**SUCCESS.** `waitUntil` background execution is confirmed in production: non-blocking response + complete background write + no truncation + clean monitor. Combined with 10F4 (completion proof) and the unit/structural tests, the background-execution model is validated end-to-end.

## 17. Ready for small cohort rollout?
**Yes — with the standard controlled-rollout discipline.** The background path is proven (waitUntil non-blocking + complete). Expand by **allowlist increments only**, watching the monitor (incl. `rolloverEligiblePlansLagging`) after each increment; keep `MENTOR_DAILY_ROLLOVER_ALLOW_ALL` forbidden and `MENTOR_PENDING_LIFECYCLE_V2` off. Recommended first increment: a small handful of real allowlisted users, then review.

## 18. Residuals / blocking items
- Process note: the trigger occurred during what was intended as a flags-off baseline (flags were enabled first), so a clean latency A/B wasn't captured — not needed, as the `waitUntil` log is the definitive proof. For future cohort steps, capture a response-time sample for ongoing latency monitoring.
- The fresh-account **plan-regeneration-on-load** behavior (seen with `amanantil.pm`, not `malikmadhu555`) remains an unrelated app concern worth a separate look.
- Old `MP_T9B2` + regenerated `amanantil.pm` `ROLLOVER_LAST_PROCESSED_MISSING` residuals persist (benign).
- **No blocking items** for proceeding to a small allowlist cohort.

## 19. Safety confirmation
Only the expected writes on the pilot plan occurred (2 quick-checks re-scheduled, day-marker, one `ROLLOVER` row, 2 events). No non-pilot/affected writes, no hand-edits, no backup restore. Flags returned to off; final baseline clean. Backup taken before the run (founder-confirmed).
