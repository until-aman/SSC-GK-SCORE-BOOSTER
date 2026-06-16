# Phase 10G — Rollover Idempotency Concurrency Fix (No Duplicate ROLLOVER Rows)

**Date:** 2026-06-15
**Type:** Code + tests + report. No env change, no Sheet mutation, no live rollover, no deploy.

---

## 1. Bug
During the 10F5 all-user rollout, the monitor flagged **`DUPLICATE_ROLLOVER_IDEMPOTENCY_KEYS`** (a duplicate `mentor-rollover:*` row). Root cause: **Google Sheets has no atomic compare-and-set**, so the executor's idempotency guard (`get(key)` → run → `save(key)` append) has a race window. Two **concurrent** rollovers for the same plan/day — a hard reload firing two `/api/mentor/plan` requests, a React double-render, SWR revalidation, or two tabs — both pass the step-1 `get` (no row yet) and both `append` the `ROLLOVER` row → **duplicate**.

**Severity:** the *task* writes are RowVersion-guarded, so the loser's task moves all STALE-skip — **no double task-move, no data loss.** The artifact is the duplicate idempotency row (+ a harmless re-written marker). It's an integrity-guarantee/monitoring bug, not corruption.

## 2. Fix (layered — robust on a Sheets backend)
`lib/mentor/services/rolloverWriteExecutor.js`:
1. **Per-instance in-flight guard** — a module-level `Map<key, Promise>`. `executeDailyRolloverWrite` checks it before running; a second concurrent call for the same key **awaits the first's result** (returns it with `coalesced: true`) instead of re-running. Catches the common same-instance double-fire (the body was split into `runRolloverWrite`).
2. **Re-check before finalize** — right before the step-6 append, `get(key)` again; if a cross-instance winner finalized in the meantime, **skip the append** and return `{ idempotent: true, raced: true, ... }`. Catches most cross-instance races (the loser, having RowVersion-skipped the task work, re-checks after the winner finalized).
3. **Dedupe-on-read** — `createSheetsIdempotencyStore.get` already returns the first matching row, so any residual duplicate is read as one (canonical).

**Honest limit:** without atomic CAS, Sheets can't give a 100% guarantee — layers 1–3 make a duplicate *very rare* and *harmless* (RowVersion already guarantees task integrity). A fully airtight claim would need an atomic store (Vercel KV / Upstash Redis) — a larger, separate change; documented as the future option, not done here.

## 3. Files changed
| File | Change |
|---|---|
| `lib/mentor/services/rolloverWriteExecutor.js` | In-flight coalescing guard + `runRolloverWrite` split + re-check before finalize. Ordering/idempotency-key/RowVersion behavior otherwise unchanged. |
| `scripts/test-mentor-rollover-write.js` | `G1` (concurrent coalesce → one finalize), `G2` (recheck skips duplicate append), `G3` (lone run finalizes once — no regression). |

## 4. Tests / build
- `rollover-write` **36/36** (incl. G1–G3). Regression: `rollover-dry-run` 11/11, `monitor-alerts` 27/27, `route-readiness` 12/12, `sheets-retry` 9/9, `background-rollover` 9/9, `sheets-writer` 23/23. **Build ✓.**

## 5. Net effect
- Same-instance concurrent rollovers (the common case) now **coalesce** → exactly one finalize, no duplicate.
- Cross-instance races are caught by the recheck (most) and rendered harmless by dedupe-on-read (residual).
- No change to the idempotency key, finalize-last ordering, RowVersion guards, or the awaited/waitUntil dispatch.

## 6. Next
1. Merge + deploy; re-attempt the controlled rollover under load to confirm no duplicate ROLLOVER rows.
2. Separately, the **regenerate-on-load** behavior (a plan spinning up a new generation mid/after a rollover) is the *other* unfixed issue behind the 10F5 partial — worth its own investigation.
3. If a 100% atomic guarantee is ever required (true high-concurrency real-user load), move the rollover claim to an atomic store (KV/Redis).
