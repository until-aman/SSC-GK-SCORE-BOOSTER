# Phase 10D-FIX-3 — Await Rollover Write Before the HTTP Response

**Date:** 2026-06-13
**Type:** Code + test + report. No live rollover, no flag change, no Sheet mutation, no env change, no deploy.

---

## 1. Root cause (the real one)
Every live rollover run (10D, R1, R2, R2-retry) truncated mid-write. In `pages/api/mentor/plan.js` the rollover ran as a **fire-and-forget `.then()` chain that was never awaited** before `return res.status(200).json(snapshot)`. On Vercel, **the serverless function is frozen/reclaimed once the HTTP response is sent**, so the rollover's ~10–17 sequential Sheets calls were killed partway through.

Evidence this — not a Sheets reliability issue — was the cause:
- **Partial at a different point each trigger** (timing-dependent freeze), e.g. R2: task moved but no event; R2-retry: 1 work move + 1 of 2 quick-checks, no marker, no `ROLLOVER` row.
- **FIX-2 retry/backoff didn't help** — the function is *terminated*, not erroring; nothing to retry.
- **No `[mentor-rollover-write]` log line** — execution stops before the log.
- **A second trigger backfilled the next write and stalled again** — each pass completes a few more writes before re-freezing.
- The runs that "succeeded" (R1) only needed ~3 writes and finished inside the freeze window; the 10D first run moved 2 tasks then truncated before the marker — same signature.

## 2. Fix
`pages/api/mentor/plan.js`: the **eligible-cohort WRITE path is now AWAITED before the response is sent** (moved out of the un-awaited `.then`). The eligibility check `isMentorDailyRolloverUserAllowed(userScope)` is a pure env/flag check (no I/O), so it gates *before* any awaited work:
- **Eligible (allowlisted) user:** `await repo.getMentorSnapshotData` → `await executeDailyRolloverWrite(...)` inline, then `res.json`. The multi-write sequence completes within the function's active lifetime. Wrapped in try/catch so a write failure is logged (`[mentor-rollover-write] FAILED` / `threw`) but **never fails the user's plan response** (still 200).
- **Non-eligible user:** the **SHADOW path stays fire-and-forget** — it does no writes, so a truncated shadow is harmless and adds no response latency.

Scope/perf: only the narrow allowlisted cohort awaits, and only the first eligible load of the day does heavy work (subsequent loads are idempotent replay = one read), so the added latency is bounded and acceptable for the pilot. For a broad rollout, switch to Vercel `waitUntil` / a cron job to avoid user-facing latency — noted as future work; awaiting is the correct, simple fix for the controlled pilot. FIX-2's retry/backoff stays (still a valid defense against genuine transient errors).

## 3. Files changed
| File | Change |
|---|---|
| `pages/api/mentor/plan.js` | Eligible rollover write awaited before `res.json`; shadow path left fire-and-forget; write errors caught/logged, never 500. |
| `scripts/test-mentor-rollover-write.js` | `R-FIX3` asserts the eligible write is awaited *before* `res.json` and not inside a `.then(`; widened test 15's gate-proximity window for the new comment. |

## 4. Tests / build
- `R-FIX3` passes: eligible branch `await executeDailyRolloverWrite`, not in `.then(`, positioned before `return res.status(200).json(snapshot)`, with a caught/logged failure path.
- `rollover-write` **33/33**, `monitor-alerts` 26/26, `rollover-dry-run` 11/11, `route-readiness` 12/12, `sheets-retry` 9/9. **Build ✓.**

## 5. Next steps
1. Merge this PR to `main`; confirm the Vercel deploy is Ready.
2. Re-enable the narrow pilot (`MENTOR_DAILY_ROLLOVER_V2=true`, allowlist `u_3fa204273ffb0b96`) + redeploy.
3. One trigger as `malikmadhu555` → with the await, the rollover now **completes in one pass**; the existing partial state resumes and finalizes (Geography → scheduled, `LastProcessedCalendarDay=2`, `Action=ROLLOVER` row). I verify Sheet + monitor, then disable.

## 6. Residual
The `malikmadhu555` plan (`MP_1781339252731`) is currently mid-rollover (work task pending, 1 quick-check scheduled, 1 still active, no marker/ROLLOVER row). No restore needed — a single post-deploy trigger will finalize it cleanly via idempotent resume.
