# Phase 8A — Legacy Snoozed / Rollover Pending Reconciliation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Reconcile the rollover/pending read model with Repository V2 so legacy `snoozed` rows stay hidden consistently. **Read-model code only — no live write, no flag, no UI, no status change.**
**Date:** 2026-06-11
**Result:** ✅ Rollover shadow pending **3 → 0**; repository canonical pending stays 0; 10 legacy snoozed hidden (3 current-generation). 260 mentor tests pass; build green; live Sheet unchanged.

---

## 1. Root cause of mismatch
`dailyRolloverService.listPendingTasks` filtered on `statusOf(task) === TASK_STATUS.PENDING`, where `statusOf` (the task-state-machine `normalizeTaskStatus`) maps legacy `snoozed → pending`. The repository's `currentTasks` projection (Phase 2 `isolateTasks`) does **not** carry `isLegacyHidden` — that flag is only added to the separate `hiddenLegacyTasks` collection. So the three current-generation (g5) legacy-snoozed rows passed the existing `isCurrentPlanTask` (`!isLegacyHidden`) check and were counted as pending (`pendingCount = 3`), while Repository V2 correctly reported canonical pending `= 0`. The confirmed root cause matches the Phase 7 hypothesis: *the rollover pending builder treated read-normalized pending tasks as backlog without checking whether they are legacy snoozed with blank `PendingReason`/`MovedToPendingAt`.*

## 2. Code files changed
| File | Change |
|---|---|
| `lib/mentor/services/dailyRolloverService.js` | Added `LEGACY_SNOOZED` const, `hasV2PendingEvidence(task)`, and the canonical predicate `isCanonicalPendingTask(task)`. Rewrote `listPendingTasks` to filter by `planId` + `isCanonicalPendingTask` (replacing the status/quick-check/terminal filter chain). Exported `isCanonicalPendingTask` + `hasV2PendingEvidence`. |
| `scripts/test-mentor-daily-rollover.js` | Added 12 Phase 8A tests (56–67) + imports for the repository orchestrator and legacy fixture. |

No repository, state-machine, schema, UI, or route code was changed (repository was already correct).

## 3. Predicate / rule added
```js
isCanonicalPendingTask(task) // true only if:
  - not hidden historical (task.isCurrentGeneration !== false)
  - not explicitly hidden (!task.isLegacyHidden)
  - not a quick-check / feedback type
  - statusOf(task) === 'pending'  (excludes completed/cancelled/expired/scheduled/active)
  - NOT (rawLegacyStatus === 'snoozed' AND no v2 pending evidence)
      where v2 pending evidence = non-empty PendingReason OR non-empty MovedToPendingAt
```
Applied product rule: legacy `Status = snoozed` ≠ canonical `pending`. A legacy snoozed row (including current-generation) is `visibility = hidden_legacy_snoozed`, `canonicalPending = false`, and is ineligible for rollover-pending, featured-pending, and nudge-tier — **unless** it carries explicit v2 pending evidence (`PendingReason`/`MovedToPendingAt`), which only an approved later migration/mutation would set. Genuine v2 pending tasks (no legacy snoozed marker, or with v2 evidence) remain fully supported. The predicate is pure and used consistently by the pending list, featured selection, pending count, nudge tier, rollover result, and snapshot extension.

## 4. Tests added (12: cases 56–67)
Legacy snoozed historical hidden; legacy snoozed current-gen hidden; blank-PendingReason not canonical pending; current-gen legacy snoozed not featured; current-gen legacy snoozed doesn't affect nudge tier (count 0 → `hidden`); v2 pending with `PendingReason` included; v2 pending with `MovedToPendingAt` included; genuine v2 pending still included; **migrated legacy fixture → repository canonical pending = 0 (10 hidden)**; **migrated legacy fixture → rollover shadow pending = 0, featured none, tier hidden**; completed/cancelled/expired never pending; quick-check pending never pending. All pass; the original 55 rollover tests still pass (no regression).

## 5. Live shadow validation result (read-only)
Against the live migrated Sheet (repository V2 read → rollover shadow, no-op idempotency store):
```text
repositoryCanonicalPending: 0
rolloverShadowPending: 0
hiddenLegacySnoozed: 10
currentGenLegacySnoozedHidden: 3
featuredPendingCandidate: none
pendingNudgeTier: hidden
```
No new `MentorMutationRequests`/`MentorTaskLogs` rows; no status change; no idempotency record written. (Temporary validation script removed after use.)

## 6. Pending count before / after
| Metric | Before | After |
|---|---|---|
| Repository canonical pending | 0 | 0 |
| Rollover shadow pending | **3** | **0** |
| Hidden legacy snoozed | 10 | 10 |
| Current-gen legacy snoozed hidden | (3 leaked into pending) | 3 (hidden) |

## 7. Featured pending result
Featured pending candidate after fix: **none** (no eligible canonical-pending task; the current-gen legacy snoozed rows are excluded). Nudge tier: **hidden**.

## 8. No-write confirmation
No live Google Sheet write performed. Row counts unchanged (2/5/15/29/4/0/1 verified in §5 re-read), no task status changed, no `PendingReason` written, no task event appended, no idempotency row written, no feature flag changed.

## 9. Tests / build results
`test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-state-machine` 45/45 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **260 passed, 0 failed**. Lint: 0 errors. `npx next build` → **✓ Compiled successfully**.

## 10. Can Phase 8B enable read-only flags?
**Yes.** The Phase 7 blocker is resolved: the rollover/pending read model now matches Repository V2 (both report canonical pending = 0 for the migrated legacy data, with all 10 legacy snoozed hidden). Phase 8B may, behind server-only flags and in a controlled order, enable read-only/shadow flags (`MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ`, and the rollover/state-machine shadow evaluators) without surfacing legacy snoozed tasks as pending.

## 11. Blocking items
- **Blocking for read-only V2 flags:** None.
- **Future (pending-lifecycle writes):** when a later approved phase intentionally migrates specific legacy snoozed rows into the pending backlog, it must set `PendingReason`/`MovedToPendingAt` (the v2 pending evidence the predicate keys on); until then all legacy snoozed remain hidden by design.

---

*Phase 8A complete — read-model reconciliation only. No live Sheet write, no status change, no `PendingReason` write, no event/idempotency write, no flag enabled, no UI change, no deploy, no commit/push.*
