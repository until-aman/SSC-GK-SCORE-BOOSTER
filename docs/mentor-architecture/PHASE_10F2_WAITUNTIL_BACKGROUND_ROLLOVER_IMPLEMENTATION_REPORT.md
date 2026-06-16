# Phase 10F2 — waitUntil Background Daily Rollover (Behind Dead Flag)

**Date:** 2026-06-13
**Type:** Code + tests + report. No env change, no Sheet mutation, no live rollover, no deploy. Background mode is **dark** (flag off by default).

---

## 1. Current baseline (Step 1)
- FIX-3: the eligible rollover write was **awaited** before `res.json` (proven correct in production, but blocks the response).
- Non-eligible/shadow path is no-write (fire-and-forget, harmless).
- Rollover failures are logged (`[mentor-rollover-write] FAILED/threw`) and never fail the plan response.
- Idempotency key unchanged: `mentor-rollover:{userScope}:{planId}:{calendarDay}`.

## 2. Files changed / added
| File | Change |
|---|---|
| `lib/mentor/repository/featureFlags.js` | `isMentorDailyRolloverBackgroundEnabled()` — fail-closed, exact `"true"`; exported. |
| `lib/mentor/util/backgroundTask.js` (new) | `runBackgroundTask(promise, label, {waitUntil})` — uses Vercel `waitUntil` (lazy/optional `require('@vercel/functions')`), test-injectable, never throws/rejects; logs failures. |
| `pages/api/mentor/plan.js` | Eligible write factored into `runRollover()`; **background flag on → `runBackgroundTask(runRollover())` (non-blocking)**; flag off → `await runRollover()` (FIX-3 fallback). `backgroundMode` in logs. Added `export const config = { maxDuration: 60 }`. |
| `lib/mentor/read/v2MutationMonitor.js` | New **`rolloverEligiblePlansLagging`** counter + `ROLLOVER_ELIGIBLE_PLANS_LAGGING` WARNING; inline scope-hash (no service coupling); computes calendarDay via `planDay`. |
| `scripts/mentor-v2-mutation-monitor.js`, `pages/api/internal/mentor-v2-monitor.js` | Pass `rolloverAllowedUserHashes` + `rolloverFlagOn` into the audit. |
| `package.json` | Added `@vercel/functions ^1.5.0` dependency; `test:mentor-background-rollover` script. |
| `scripts/test-mentor-background-rollover.js` (new), `scripts/test-mentor-monitor-alerts.js` | New tests (below). |

## 3. Dependency added
`@vercel/functions` (`^1.5.0`) for `waitUntil`. **Imported lazily** inside `runBackgroundTask` (optional `require` in try/catch), so build/tests pass whether or not it is installed. **Before enabling background mode in production**, run `npm install` so the package is present (otherwise `runBackgroundTask` falls back to fire-and-forget, which on Vercel would re-introduce truncation). The exact version may need pinning to the latest available `@vercel/functions` at install time.

## 4. Background flag behavior
`MENTOR_DAILY_ROLLOVER_BACKGROUND` → `true` **only** for the exact string `"true"`; unset/blank/`false`/`TRUE`/`1` ⇒ false. It **never** widens eligibility — the master gate `MENTOR_DAILY_ROLLOVER_V2` + the rollover allowlist still decide WHO; this flag only decides AWAITED vs BACKGROUND for already-eligible users.

## 5. Plan-route behavior by mode (Step 4)
| Condition | Behavior |
|---|---|
| `MENTOR_DAILY_ROLLOVER_V2` off (master) | rollover block doesn't run; no write; no waitUntil; response normal |
| Eligible + `MENTOR_DAILY_ROLLOVER_BACKGROUND=true` | `runBackgroundTask(runRollover())` registers the write with `waitUntil`; **response returns without awaiting the write**; `backgroundMode=waitUntil` |
| Eligible + background flag off | `await runRollover()` — FIX-3 awaited fallback; `backgroundMode=awaited` |
| Not eligible (flag on, not allowlisted) | shadow path only (no writes), unchanged |
Executor ordering, idempotency key, RowVersion guards, finalize-last, and "failure never 500s the response" are all **unchanged** — only WHEN the write runs relative to the response changed.

## 6. Function duration config (Step 5)
`export const config = { maxDuration: 60 }` added to the plan route (valid Next.js Pages Router API config; Hobby supports up to 60s). Gives the awaited/background write headroom over the ~10s default.

## 7. Monitor lag counter (Step 6)
`rolloverEligiblePlansLagging` = active plans whose owner scope is in the **rollover allowlist**, where `calendarDay > LastProcessedCalendarDay` and **no completed `ROLLOVER` row** exists for `mentor-rollover:{scope}:{planId}:{calendarDay}`.
- Computed **only** when `rolloverFlagOn` (= `MENTOR_DAILY_ROLLOVER_V2` true) **and** a rollover allowlist is supplied → **0 when the flag is off** (verified live), and **never** counts non-allowlisted users.
- Skips plans with unknown `PlanStartLocalDate`/`TotalPlanDays` (no guessed lag).
- **WARNING-only**, never CRITICAL (a brief background lag is expected). Diagnostics carry `{planId, userScope, calendarDay}` — scope hash, **never raw email**.
- Old `MP_T9B2` residual cannot create a CRITICAL (the counter is WARNING and dark while the flag is off).

## 8. Tests (Step 7) / build (Step 8)
- `test:mentor-background-rollover` (new) **9/9**: flag parser (exact `"true"`); `runBackgroundTask` registers via injected `waitUntil`; fire-and-forget fallback; rejected task logged-not-thrown; plan.js background branch uses `runBackgroundTask(runRollover())`; awaited fallback `await runRollover()`; gate intact; failure-logged-not-500; `maxDuration` present.
- `test:mentor-monitor-alerts` **27/27** incl. **C4**: eligible owed plan → WARNING; completed `ROLLOVER` row → none; flag off → none; non-allowlisted → none.
- Regression: `rollover-write` 33/33 (R-FIX3 + gate test survive the refactor), `route-readiness` 12/12, `rollover-dry-run` 11/11, `sheets-retry` 9/9, `allow-all` 10/10. **Build ✓.**
- Live read-only monitor (flag off): `rolloverEligiblePlansLagging=0`, no CRITICAL.

## 9. No env / no Sheet / no live-trigger confirmation
No production env changed, no Sheet mutated, no rollover triggered, no Mentor page driven, no deploy, no residual cleanup. Background mode is inactive by default (`MENTOR_DAILY_ROLLOVER_BACKGROUND` unset).

## 10. Rollout recommendation
Ready for **Phase 10F3** (dry-run/shadow validation) and then 10F4 (one allowlisted live background rollover). Before any live enable: `npm install` so `@vercel/functions` is present; keep `MENTOR_DAILY_ROLLOVER_V2`/`MENTOR_DAILY_ROLLOVER_BACKGROUND` off until 10F4; allowlist-only; allow-all forbidden.

## 11. Blocking items
1. `npm install` `@vercel/functions` (and pin to the installed version) before enabling background mode — else waitUntil silently falls back to fire-and-forget on Vercel.
2. 10F3 dry-run to confirm (in a deployed preview/staging) that the plan response returns immediately and the background write completes via waitUntil.
3. Keep all rollover flags off; expand by allowlist only.
