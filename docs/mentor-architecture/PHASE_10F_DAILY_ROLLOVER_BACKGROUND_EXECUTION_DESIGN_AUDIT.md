# Phase 10F — Daily Rollover Background Execution Design Audit

**Date:** 2026-06-13
**Type:** Design audit only. No code, no env, no flags, no Sheet writes, no deploy.

---

## 1. Current state
- The gated daily-rollover write path is **proven in production** (Phase 10D-R2/FIX-3): work→pending, quick-checks→scheduled, `LastProcessedCalendarDay` written to the active row, `Action=ROLLOVER/completed` finalized, affected plan untouched, monitor `WARNING`/no CRITICAL.
- `MENTOR_DAILY_ROLLOVER_V2=false`, `MENTOR_PENDING_LIFECYCLE_V2=false`, rollover allow-all forbidden. Allowlist-only.
- Hardenings on `main`: Bug A (active-row targeting), Bug B (visible finalization), Bug C (current-gen monitor scoping), FIX-2 (transient-write retry/backoff), **FIX-3 (await the rollover write before `res.json`)**.

## 2. Why this phase exists
FIX-3 made the rollover correct by **awaiting** the write before the response — but that re-adds latency to `GET /api/mentor/plan` for eligible users. That's fine for a 1-user pilot, but blocks the read path as the cohort grows. This audit picks the safest way to move the write **off the blocking page-load path** before cohort expansion, without losing any guarantee.

## 3. Current blocking rollover flow (Step 1)
- **Trigger:** `GET /api/mentor/plan` ([pages/api/mentor/plan.js](pages/api/mentor/plan.js)). The block runs when `isMentorDailyRolloverV2Enabled() || isMentorPendingLifecycleV2Enabled()`.
- **Eligibility:** `isMentorDailyRolloverUserAllowed(userScope)` — pure env check: master flag true AND (allow-all OR scope in `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES`). Fail-closed.
- **FIX-3 split:** eligible users → `await executeDailyRolloverWrite(...)` **before** `res.json` (blocking); non-eligible → shadow path stays fire-and-forget (no writes).
- **Executor** ([rolloverWriteExecutor.js](lib/mentor/services/rolloverWriteExecutor.js)) ordering: (1) idempotency `get` → replay if present; (2) `processDailyRollover` (in-memory, no writes); (3) final-day policy; (4) per-task `compareAndUpdateTask` + `appendTaskEvent` (RowVersion-guarded; STALE/NOT_FOUND/DUP = benign skip; other error → `ROLLOVER_PARTIAL_FAILURE`, **no finalize**); (5) `setLastProcessedCalendarDay` on the active row; (6) finalize `Action=ROLLOVER` idempotency row **last**.
- **On write failure:** caught/logged (`[mentor-rollover-write] FAILED/threw`), **never fails the plan response** (still 200). Idempotency not finalized → re-run resumes; RowVersion guards prevent double-moves.
- **Monitor sees:** `rolloverMutationRequestCount`, `duplicateRolloverIdempotencyKeys`, `failedRolloverMutationRequests`, `quickChecksIncorrectlyPendingByRollover`, `activeTaskCountOverLimit` (current-gen scoped), `rolloverPlansMissingLastProcessedCalendarDay`, plus flag-state guardrails (pilot WARNING / allow-all CRITICAL / pending-lifecycle CRITICAL).

## 4. Latency & reliability risk (Step 2)
Per rollover with **N** task updates, the Sheets I/O (each `compareAndUpdateTask`/`appendTaskEvent`/`setLastProcessedCalendarDay`/idempotency op re-reads a whole tab via `createSheetsIo`):

| Step | Reads | Writes |
|---|---|---|
| snapshot build (`getMentorSnapshotData`) | ~4–6 | 0 |
| idempotency `get` | 1 | 0 |
| per task × N (`compareAndUpdate` + `appendEvent`) | 2N | 2N |
| `setLastProcessedCalendarDay` | 1 | 1 |
| idempotency `save` | 1 | 1 |
| **Total (N=3)** | **~14** | **~8** (~22 API calls) |

- At ~150–300 ms/call sequential ⇒ **~3–6.5 s** per first-of-day rollover, **plus** FIX-2 retry/backoff (up to ~+4 s/transient write).
- **OK for 1 pilot user:** once/day; subsequent same-day loads are idempotent replay = **1 read** (fast).
- **Risky for many users:** (a) every eligible user's first daily load blocks ~3–6 s → poor UX and Vercel function-duration pressure (Hobby ~10 s default; a slow Sheets window + retries can approach the limit → 500 + truncation); (b) Google Sheets write quota (~60 writes/min/project) — 8 writes/rollover means ~7 concurrent first-loads/min saturates the quota → 429 cascades (FIX-2 retries help but extend duration).
- **Secondary finding:** `compareAndUpdateTask`/`appendTaskEvent` re-read the entire `MentorTasks`/`MentorTaskLogs` tab on every call — redundant; a read-once/cache pass would cut ~2N reads. Optimization, not required for correctness.

## 5. Background options comparison (Step 3)

| Option | How it works | Pros | Cons | Risk | Complexity | Verdict |
|---|---|---|---|---|---|---|
| **A. `waitUntil`** | Wrap the existing FIX-3 awaited write in Vercel `waitUntil(promise)`; response returns immediately, runtime keeps the function alive until the rollover promise resolves | Minimal change to the **proven** executor (same ordering/guarantees); restores page latency; Hobby-compatible; idempotent replay keeps repeat loads cheap | Adds dep `@vercel/functions`; still bounded by function `maxDuration`; still **tied to page load** (a user who never opens Mentor isn't persisted — but they don't need it until they open it); spawns background work on each eligible load | Function duration overrun on big N/quota windows | **Low** | ✅ **Recommended (near-term)** |
| **B. Cron-driven processor** | Scheduled endpoint (reuse `CRON_SECRET` auth) scans eligible plans, processes rollovers in batches, fully decoupled from page load | Zero page-load latency; persists even for users who don't open Mentor; central rate control | Hobby = **once/day cron, slot taken by the monitor**; single UTC time can't hit each user's local midnight; discovery scan cost; **stale-persisted-state** window until cron runs (see note); more code | Cron timing vs local day; quota on batch bursts | **Medium–High** | ◻️ **Recommended (end-state for all-users)** |
| **C. Queue table + worker** | `GET /plan` enqueues a rollover request row; a worker/cron drains the queue | Decoupled; explicit retry/dedupe | Adds a **queue tab on Sheets** (more Sheets load on the same constrained backend); dedupe/UI-state complexity | Sheets-as-queue contention | **High** | ❌ Not recommended (over-engineered for Sheets + small cohort) |
| **D. Keep awaited write (allowlist only)** | Current FIX-3 state | Zero new work; proven | ~3–6 s page latency for eligible users; doesn't scale past a tiny cohort | Latency/timeout as cohort grows | **None** | ◻️ Acceptable **only** for the current ≤~handful pilot; must retire |

**Stale-state note (Option B):** the READ path surfaces canonical-day + "Previously Pending" partly from read-derived logic, but the durable task `Status` (active→pending) and the once/day marker come from the WRITE. Whether a user sees correct pending state **before** the cron persists it must be verified against `serveCompatibleSnapshot`/the pending-surfacing read model before relying on B for all-users. This is an open question gating B.

## 6. Recommended path (Step 4)
**Adopt Option A (`waitUntil`) now; keep Option B (cron) as the documented end-state for all-users.**

Rationale: the executor is already proven and carries every guarantee; the *only* problem is response blocking. `waitUntil` removes the blocking with the smallest, safest change and no new persistence model. It is the "simplest safe design" the constraints ask for. B is more robust for scale but heavier and has unresolved timing/stale-state questions — defer until A is proven and the cohort actually needs page-load-independent processing.

**Exact recommended architecture (Option A):**
- **Route change:** in `plan.js`, for the eligible branch, build the rollover promise and pass it to `waitUntil(...)` instead of `await`; return `res.json` immediately. Keep the try/catch logging inside the promise (failures logged, never affect the response). Non-eligible shadow path unchanged.
- **Dependency:** add `@vercel/functions`; `import { waitUntil } from '@vercel/functions'`. Guard for local/dev (where `waitUntil` is absent) by falling back to `await` or a fire-and-forget that's awaited in tests.
- **Function config:** set `export const config = { maxDuration: 60 }` on the plan route (Hobby-supported) so the background rollover has headroom over the default ~10 s.
- **Flags:** unchanged — `MENTOR_DAILY_ROLLOVER_V2` (master), `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES` (cohort), allow-all stays forbidden. Optionally add `MENTOR_DAILY_ROLLOVER_BACKGROUND=true` to toggle waitUntil vs the FIX-3 await as a safety switch.
- **Idempotency model:** unchanged — key `mentor-rollover:{userScope}:{planId}:{calendarDay}`; finalized **last**, after task updates/events and the marker.
- **Recovery:** unchanged — partial failure leaves the idempotency row absent; the next eligible load re-runs and resumes (RowVersion guards prevent double-apply).
- **Rate limiting / batch size:** N/A for A (one user/request); FIX-2 backoff handles transient 429s. (Batch sizing belongs to B.)
- **Logging:** keep `[mentor-rollover-write]` lines; add a `backgroundMode` marker so logs distinguish awaited vs waitUntil execution.
- **Monitor changes:** mostly reuse. Add nothing required for A, but recommended: a **"rollover-eligible plan rolled over today"** lag counter — plans where `calendarDay > LastProcessedCalendarDay` for an *eligible* cohort and no `ROLLOVER` row for the day (detects background work that never completed). This is the key new visibility B will also need.
- **Rollout plan:** ship A behind the existing allowlist; expand the allowlist in small increments watching the monitor; only consider B when the cohort outgrows page-load-triggered processing (or all-users is desired).
- **Fallback plan:** the `MENTOR_DAILY_ROLLOVER_BACKGROUND` switch reverts to the FIX-3 awaited write; disabling `MENTOR_DAILY_ROLLOVER_V2` stops all rollover writes instantly (proven kill-switch).

## 7. Implementation phases (Step 5)
- **10F1** — Finalize this design (decide A-now/B-later; confirm `maxDuration` + dep policy + the lag counter).
- **10F2** — Implement `waitUntil` background execution behind a dead flag (`MENTOR_DAILY_ROLLOVER_BACKGROUND`), with the dev/test fallback; add the rollover-lag monitor counter. No live enable.
- **10F3** — Shadow/dry-run: prove (tests + a read-only run) that waitUntil path runs the same executor and the page returns immediately; no writes while flags off.
- **10F4** — One allowlisted live background rollover (fresh clean plan, fresh backup, narrow allowlist) — verify completion + fast response + monitor.
- **10F5** — Small cohort rollout via allowlist increments, watching the lag counter + guardrails.
- **10F6** — (If/when all-users needed) design+build Option B cron processor; resolve the stale-state read question; retire page-load rollover. Otherwise keep A as the steady state for the foreseeable cohort.

## 8. Required flags/env (Step 7 input)
Unchanged set + optional `MENTOR_DAILY_ROLLOVER_BACKGROUND` (toggle waitUntil vs await). No allow-all. `CRON_SECRET` only relevant if B is later built.

## 9. Required monitor updates
- Reuse all Phase 10E counters.
- **New (recommended):** rollover-lag counter — eligible plans with `calendarDay > LastProcessedCalendarDay` and no `ROLLOVER` row for `calendarDay` (i.e., background rollover owed-but-not-done). WARNING if > 0 beyond a grace window; helps catch a waitUntil/cron that silently didn't finish.
- Keep: failed rollover requests, duplicate idempotency keys, missing `LastProcessedCalendarDay` after a completed rollover, quick-checks incorrectly pending, active-count-over-limit (current-gen), rollover flag unsafe states, allow-all CRITICAL.

## 10. Test plan (Step 6)
- Background eligibility (only allowlisted + flag on).
- Idempotency: replay after a completed `ROLLOVER` row → no writes.
- Duplicate/concurrent page loads for same user/plan/day → single finalize, no double-move (RowVersion + idempotency).
- Partial-failure recovery: transient error mid-batch → resumes on next run, no orphan (extends the FIX-2 `R-FIX2a` test to the waitUntil path).
- Transient Sheets retry (existing `sheets-retry` 9/9).
- Monitor counters incl. the new lag counter (off→no alert; owed-but-not-done→WARNING).
- No rollover when `MENTOR_DAILY_ROLLOVER_V2` off.
- No non-allowlisted writes.
- **Plan page returns without awaiting the write** when background mode is on (structural test: eligible branch uses `waitUntil(...)`, response not gated on the rollover promise) — the inverse of `R-FIX3`.
- Cron/background endpoint auth (only if B).
- Replay after completed rollover; old partial states still recoverable.

## 11. Risk register (Step 7)
| Risk | Impact | Likelihood | Mitigation | Owner phase |
|---|---|---|---|---|
| Sheets write quota (≈60/min) on bursts | 429 cascades, slow/failed rollover | Med (grows with cohort) | FIX-2 backoff; cohort increments; B batch pacing; read-once optimization | 10F5 / 10F6 |
| Duplicate/concurrent execution (multi page-load) | Double work | Low | Idempotency key + RowVersion guards (already proven) | 10F2 |
| Stale persisted state before background completes | User sees yesterday's tasks until write lands | Med | A persists on the user's first load (immediate); lag monitor; verify read-derived view | 10F3 |
| Partial writes (transient/duration cut) | Incomplete rollover | Low (post-FIX-3) | Idempotent resume; finalize-last ordering; lag counter | 10F2 |
| Vercel function `maxDuration` overrun | Background killed mid-write | Low–Med | `maxDuration: 60`; small N; FIX-2 bounded retries | 10F2 |
| Cron auth bypass (if B) | Unauthorized rollover trigger | Low | Reuse fail-closed `CRON_SECRET` (`isValidCronRequest`) | 10F6 |
| User-triggered duplicate page loads | Redundant background spawns | Med | Idempotent replay = 1 read; harmless | 10F2 |
| Monitor false positives (generation/baseline) | Noise / wasted stops | Med | Current-gen scoping (Bug C); retire affected-plan baseline; lag grace window | 10F2 |
| Accidental allow-all | All-users rollover unproven path | Low | Allow-all forbidden + CRITICAL alert; allowlist-only gate | standing |

## 12. No-write / no-env-change confirmation
This phase performed **only reads/inspection** (code, `package.json`, `vercel.json`, cron route) and authored this document. **No Sheet mutation, no env change, no flag enablement, no rollover trigger, no deploy, no residual cleanup, no code change.**

## 13. Final recommendation
**Option A (`waitUntil`)** as the next implementation step (Phases 10F2–10F5): smallest safe change that removes page-load blocking while preserving every proven guarantee. **Option B (cron processor)** documented as the end-state for all-users / page-independent processing (Phase 10F6), gated on resolving the stale-persisted-state read question and the Hobby cron-slot constraint. Do **not** enable rollover allow-all until a background path is proven; expand by allowlist only.
