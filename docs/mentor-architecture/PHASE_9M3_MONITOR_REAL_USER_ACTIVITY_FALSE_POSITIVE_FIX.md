# Phase 9M3 — Monitor False-Positive Fix for Real-User Plan Activity

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Stop the Vercel-cron monitor from raising CRITICAL on normal real-user Mentor activity. **No Sheet mutation, no route/routing change, no cron-schedule change, no env change.**
**Date:** 2026-06-12
**Result:** ✅ Exact frozen-count drift CRITICAL retired; replaced with a data-loss floor; `affectedRealPlanStatus` kept informational. Authorized monitor now returns **200 / WARNING / ALLOW_ALL_ENABLED**. Tests + build green. Not committed/pushed (awaiting approval).

---

## 1. Root cause
The first authorized cron check returned **HTTP 500 / CRITICAL** with `AFFECTED_REAL_PLAN_DRIFT`. The affected real plan `MP_1780920810055` (owner `ba***@gmail.com`, a **real** user — not the test user) read `{completed:5, snoozed:10, active:3}` instead of the baseline `{completed:5, snoozed:10}`. The 3 active tasks (`MT_1781261112536/537_*`, created `2026-06-12 10:45 UTC`, `RowVersion` blank) came from **normal plan generation** when that real user opened Mentor — **not** a V2 mutation, not corruption, and not caused by any test action (those only ever touched the `an***` test user).

## 2. Why the old guardrail became invalid
`AFFECTED_REAL_PLAN_DRIFT` hard-coded `affectedRealPlanStatus === {completed:5, snoozed:10}` (exact match). That was a **rollout-period canary** — valid only while no real users were active and that plan had to stay frozen to detect unintended writes. Once `MENTOR_V2_MUTATION_ALLOW_ALL=true` went live, real users legitimately change their own plans (new generations, active tasks, resume/complete), so any aggregate change is expected. A fixed baseline therefore **cries wolf** and would mask a genuine CRITICAL.

## 3. New monitor behavior
`affectedRealPlanStatus` is now **informational** (still reported), with a narrow **data-loss floor** instead of exact-match drift (`evaluateMonitorAlerts`):
- **Growth** (new/active tasks, higher counts) → **no alert**.
- `completed < 5` (historical floor) → **CRITICAL** `AFFECTED_REAL_PLAN_DATA_LOSS` (original completed records should never disappear).
- `snoozed < 10` (historical floor) → **WARNING** `AFFECTED_REAL_PLAN_SNOOZED_DROP` (usually a legitimate resume/complete; flagged for visibility, not a failure).
- Skipped entirely when the affected plan isn't present in the audit (fixture audits).

All real CRITICALs are unchanged: `duplicateIdempotencyKeys > 0`; `failedMutationRequests ≥ 3`; `MENTOR_DAILY_ROLLOVER_V2`/`MENTOR_PENDING_LIFECYCLE_V2 = true`; `unexpectedMutationsOutsideAllowlist > 0` while allow-all is off. `ALLOW_ALL_ENABLED` remains the expected **WARNING**.

## 4. Tests changed
- `scripts/test-mentor-monitor-alerts.js`: test 7 now asserts real-plan **growth → OK / no real-plan alert**; new test 7b asserts the **data-loss floor** (`completed<5 → CRITICAL`, `snoozed<10 → WARNING`, growth → OK). (9 tests.)
- `scripts/test-mentor-cron-monitor.js`: test 5 adds `completed<5 → 500`; test 5b keeps real-user growth → **200**. (11 tests.)
- `lib/mentor/read/v2MutationMonitor.js`: `evaluateMonitorAlerts` signature dropped the unused `expectedAffectedRealPlan` param; drift block replaced with the floor logic.

## 5. Authorized read-only monitor result (current production data)
```text
HTTP 200 | alertStatus WARNING | alerts: ALLOW_ALL_ENABLED
duplicateIdempotencyKeys 0 | failedMutationRequests 0 | rollover/pending false/false
affectedRealPlan {completed:5, snoozed:10, active:3}   (informational; floor OK)
```
This matches the expected healthy allow-all state. No live writes were performed (read-only audit only).

## 6. Build result
`npx next build` → **✓ Compiled successfully** (`/api/internal/mentor-v2-monitor` registered). Tests: `test:mentor-monitor-alerts` 9/9, `test:mentor-cron-monitor` 11/11, `test:mentor-monitor-workflow` 11/11, `test:mentor-allow-all` 10/10, `test:mentor-route-readiness` 12/12; full mentor suite green.

## 7. Will the cron now return 200?
**Yes.** Against current production data the route returns `200 / WARNING / ALLOW_ALL_ENABLED`. It will return `500` only on a genuine CRITICAL (duplicate idempotency keys, ≥3 failed mutations, a rollover/pending write flag turned on, or `completed` dropping below the historical floor = data loss). This fix ships in code, so it takes effect on the next deploy of `main`.

## 8. Blocking items
- **To take effect in production:** commit → merge to `main` → Vercel redeploys (the route logic updates; `vercel.json`/schedule/`CRON_SECRET` unchanged). **On your approval.**
- **Not done (per rules):** no Sheet mutation, no V2 routing change, no cron-schedule change, no env change, no commit/push without approval. `MENTOR_REPO_V2` / `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` untouched/off.

---

*Phase 9M3 complete — monitor no longer false-positives on normal real-user plan activity; data-loss floor retained; affected plan informational. No live mutation, no route/routing/schedule/env change, no commit/push without approval.*
