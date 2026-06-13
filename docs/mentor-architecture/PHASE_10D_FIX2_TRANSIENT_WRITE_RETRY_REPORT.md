# Phase 10D-FIX-2 — Transient Sheets-Write Retry/Backoff Hardening

**Date:** 2026-06-13
**Type:** Code + tests + report. No live rollover, no flag change, no Sheet mutation, no env change, no deploy.

---

## 1. Why
Phase 10D-R2 (clean full-move test) hit a **PARTIAL FAILURE**: one of three current-generation work tasks moved (status→pending), but its `appendTaskEvent` threw a **transient Google Sheets write error** mid-batch, so the executor returned `ROLLOVER_PARTIAL_FAILURE` before the remaining tasks, the day-marker, and finalization. Diagnosis ruled out logic bugs (no duplicate rows, clean single active plan row). Root cause: the rapid sequential-write burst is **not resilient to transient 429/5xx/network blips**, and the Bug B fix correctly surfaced it (visible, resumable) — but a transient blip should not abort the batch in the first place.

## 2. Fix
Added bounded **retry with exponential backoff + jitter** to the Sheets IO layer (`createSheetsIo` in `lib/mentor/repository/sheetsMutationRepository.js`), wrapping `read` / `updateRow` / `appendRow`:
- `isRetriableSheetsError(err)` — retries **transient** errors only: HTTP **429/500/502/503/504** (via `err.code` / `err.status` / `err.response.status`) and common **network** failures (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, `ENOTFOUND`, `EPIPE`, "socket hang up", failed-request messages).
- **Never retries** deterministic/domain errors: any other 4xx, and the repository's own optimistic-lock signals (`STALE_*`, `TASK_NOT_FOUND`, `DUPLICATE_TASK_ROWS`, `PLAN_ROW_*`) — those must surface to the caller unchanged (domain check wins even over a 429-shaped error).
- `withRetry(fn, { attempts=4, baseMs=250, maxMs=2000, sleep })` — bounded attempts, exponential backoff capped at 2s + jitter; `sleep` is injectable for fast tests. Runs inside the existing fire-and-forget rollover path, so the added latency never blocks the user response.

This makes each per-task write (status update **and** its event) survive a transient blip, so a single transient error no longer orphans a moved task or aborts the rollover batch. Deterministic optimistic-lock behavior (the idempotent-resume guarantee) is preserved.

## 3. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/sheetsMutationRepository.js` | `isRetriableSheetsError` + `withRetry`; `createSheetsIo` wraps read/update/append with retry; both helpers exported. |
| `scripts/test-mentor-sheets-retry.js` (new) | 9 unit tests for classification + retry behavior (injected no-op sleep; no real delays). |
| `scripts/test-mentor-rollover-write.js` | `R-FIX2a/b` — **executor-level** orphan-prevention tests over a real repository + fake Sheet that injects one transient `append` failure. |
| `package.json` | `test:mentor-sheets-retry` script. |
| `docs/.../PHASE_10D_R2_...md`, `PHASE_10D_FIX2_...md` | R2 outcome + this report. |

## 4. Tests / build
- `test:mentor-sheets-retry` **9/9** (transient HTTP retriable; network retriable; 4xx not retriable; domain errors never retriable; succeeds after 2 transient failures; no retry on deterministic; exhausts bounded attempts; immediate success).
- **Orphan-prevention (the R2 scenario), `test:mentor-rollover-write` R-FIX2a:** the real `createSheetsMutationRepository`/`PlanWriter`/`IdempotencyStore` run over a fake Sheet whose **first `append` throws a 503** — exactly a transient failure on the task's event write right after its status update. Asserts the moved task ends up `pending` **with exactly one `daily_rollover` event** (not orphaned, not duplicated), RowVersion incremented once, the active-row `LastProcessedCalendarDay` written, and the `ROLLOVER` row finalized. `R-FIX2b` is the no-failure control (clean single pass).
- Regression: `rollover-write` **32/32**, `monitor-alerts` 26/26, `rollover-dry-run` 11/11, `route-readiness` 12/12, `sheets-writer` 23/23, `state-machine` 45/45, `plan-day` 25/25, `allow-all` 10/10, `api-optimization` 42/42. **Build ✓.**

## 5. Scope / safety
No behavior change for the success path or for deterministic failures; only transient errors are now retried (bounded). No env, no flags, no deploy, no Sheet writes in this phase.

## 6. Next steps (Phase 10D-R2-retry)
1. Merge this PR to `main`; confirm the Vercel deploy is Ready.
2. **Founder-approved restore** of the R2 candidate plan from the fresh backup (revert the partial task-1 move to active) for a clean slate.
3. Fresh backup, then **clean full-move retry** (narrow allowlist, `u_7bbf57cf905a5df3` or another non-affected test plan), with a boring shadow first.
4. (Separately) decide whether to retire/repoint the monitor's hardcoded affected-plan baseline now that `MP_1780920810055` has been used as a rollover test subject.
