# Phase 9C — Pending Surfacing Read Model for V2 POSTPONE Tasks Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Surface true V2 pending tasks in the read model + response (replace the `canonicalPendingTasks = []` placeholder). **Read-model only — no mutation, no write, no flag change, no action expanded.**
**Date:** 2026-06-11
**Result:** ✅ Test user now shows `canonicalPendingTasks=1` / `pendingTasks=1`; affected real user stays `0` with 10 legacy snoozed hidden; live Sheet unchanged. 323 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/parsers.js` | `parseTasks` now reads the V2 pending-evidence columns: `PendingReason`, `MovedToPendingAt`, `RowVersion` (blank for legacy rows). |
| `lib/mentor/repository/mentorRepository.js` | `buildSnapshotFromRawData` computes `canonicalPendingTasks = currentTasks.filter(isCanonicalPendingTask)` (reusing the Phase 8A predicate from `dailyRolloverService`) instead of the placeholder `[]`. |
| `lib/mentor/read/serveCompatibleSnapshot.js` | Overlay `pendingTasks` = current-gen tasks whose ids are in `repoSnapshot.canonicalPendingTasks` (legacy-shaped); `deferredTasks` excludes those ids (no duplication). |
| `lib/mentor/read/v2MutationMonitor.js` | Added `canonicalPendingTaskRows` + `legacySnoozedHiddenCount` to the read-only audit. |
| `scripts/test-mentor-pending-surfacing.js` | **New** — 11 fake/in-memory tests for the pending read model. |
| `package.json` | Added `test:mentor-pending-surfacing`. |

## 2. Canonical pending rule (reused, not duplicated)
The existing Phase 8A predicate `isCanonicalPendingTask(task)` (from `lib/mentor/services/dailyRolloverService.js`) is the single source of truth. A task is canonical pending **only** if:
- normalized `status = pending`,
- **not** hidden historical (`isCurrentGeneration !== false`),
- **not** explicitly hidden (`!isLegacyHidden`),
- **not** a quick-check/feedback type,
- has **V2 pending evidence**: `PendingReason` non-empty **OR** `MovedToPendingAt` non-empty.

This excludes: legacy `Status=snoozed`, read-normalized snoozed→pending **without** v2 evidence, completed/cancelled/expired, hidden historical tasks, and quick-check deferred tasks.

## 3. Repository `canonicalPendingTasks` result
`buildSnapshotFromRawData` filters the **current-generation** tasks through `isCanonicalPendingTask`:
- Fresh V2-postponed task (`Status=pending`, `PendingReason=user_postponed`) → **included** (canonicalPendingTasks = 1).
- Affected real plan (legacy fixture, 10 snoozed without evidence) → **excluded** (canonicalPendingTasks = 0; hidden = 10).
Only current-generation pending is surfaced; older-generation rows stay historical (Phase 1C contract).

## 4. Shared overlay `pendingTasks` result
The overlay maps `canonicalPendingTasks` ids back to the legacy-shaped current-generation tasks, so the response `pendingTasks` is UI-compatible and consistent with `plan.tasks`. `deferredTasks` (legacy snoozed) **excludes** any id already in `pendingTasks` — no task appears in both. Historical tasks remain hidden from the today view.

## 5. Monitor result (live, read-only)
The monitor now reports `canonicalPendingTaskRows` and `legacySnoozedHiddenCount` alongside the existing aggregates. Live read after the change: `canonicalPostponeEvents=1`, `pendingUserPostponedTasks=1`, `canonicalPendingTaskRows=1`, `legacySnoozedHiddenCount` reflects the affected plan's 10 snoozed, `unexpectedMutationsOutsideAllowlist=0`, `MentorMutationRequests=1`, `MentorTaskLogs=30`.

## 6. Test-user live read result
```text
canonicalPendingTasks: 1     served pendingTasks: 1
pending task: T9B2_1781154796908  Status=pending  PendingReason=user_postponed  RowVersion=2
```

## 7. Affected real plan live read result
```text
canonicalPendingTasks: 0     served pendingTasks: 0     hidden legacy snoozed: 10
real plan MP_1780920810055 status: { completed: 5, snoozed: 10 }  (unchanged)
```

## 8. No-write confirmation
This phase changed only read-model code. Live re-read: `MentorMutationRequests=1` (unchanged), `MentorTaskLogs=30` (unchanged), `MentorTasks=16` (unchanged), task statuses unchanged, no `PendingReason` written, no rollover/pending-lifecycle write enabled. All unit tests use fake/in-memory data; the monitor and validation use `values.get` only (the monitor test proves it runs even when `update`/`append` throw).

## 9. Tests / build results
`test:mentor-pending-surfacing` 11/11 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **323 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 10. Recommendation for the next phase
The V2 pending lifecycle read path is now complete and consistent (mutation → persisted pending → surfaced in the read model/response). Next phase options, each behind the same cohort allowlist + per-action whitelist and a fresh backup:
1. **`resume` cut-over** — add `resume` to the whitelist so a postponed task can be undone (pending → active), validated on the test user. This makes the postpone/resume loop fully V2.
2. **Pending UI** — wire the now-correct `pendingTasks` into the Mentor tab "Previously Pending" surface (a UI phase; the data contract is ready).
3. **Featured pending / nudge tiers** — surface `selectFeaturedPendingTask` + `pendingNudgeTier` from `dailyRolloverService` in the response (still read-only; rollover writes stay off).
Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` **write** flags false until a controlled rollover-write phase is designed.

## 11. Blocking items
- **Blocking for this phase:** None.
- **For the next phase (non-blocking):** decide whether `pendingTasks` should also carry the canonical fields (`pendingReason`, `movedToPendingAt`, age/nudge) for the UI; add alerting on `unexpectedMutationsOutsideAllowlist > 0`; optional cleanup of the `MP_T9B2_…` test plan.

---

*Phase 9C complete — pending surfacing read model implemented. No live mutation, no task-status/PendingReason write, no event/idempotency write, no flag change, no action expanded, affected real plan untouched, no deploy, no commit/push.*
