# Phase 9B1 — V2 Postpone Cutover Handler Implementation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Implement the real V2 cut-over handler for the whitelisted `snooze → POSTPONE` action, behind the existing flag gate. **No mutation flag enabled, no live Sheet write, no live task-action call, no UI/deploy.**
**Date:** 2026-06-11
**Result:** ✅ Handler implemented + fully exercised through a fake in-memory Sheets client; gated/inactive in the live env; live Sheet unchanged; 304 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/sheetsMutationRepository.js` | **New** — live Sheets-backed mutation repository (`createSheetsMutationRepository`) + idempotency store (`createSheetsIdempotencyStore`) implementing the `executeTaskMutation` contract; injectable `sheets` client (fully testable with a fake). |
| `lib/mentor/read/v2TaskActionHandler.js` | **New** — `executeV2TaskActionCutover` orchestration: `snooze→POSTPONE` map, stable `clientOperationId`, guarded `executeTaskMutation`, fail-closed error mapping, shared-overlay response. |
| `pages/api/mentor/task-action.js` | Replaced the 501 scaffold with the real `handleV2TaskActionCutover` (gated by `shouldRouteActionThroughV2`, fail-closed, no legacy fallback once entered); passes `sheets`/`email`/ids. |
| `scripts/test-mentor-v2-postpone.js` | **New** — 20 fake-client tests (routing, POSTPONE behaviour, idempotency, guards, response shape, fresh-plan, env safety). |
| `package.json` | Added `test:mentor-v2-postpone`. |

## 2. Handler implementation summary
On the gated branch (`shouldRouteActionThroughV2('snooze')` true → all three mutation flags + whitelist), `handleV2TaskActionCutover`:
1. reads a **Repository V2 snapshot** to obtain `currentGenerationTaskIds` + `hiddenTaskIds` (generation isolation);
2. builds a **Sheets-backed mutation repository** + **idempotency store** (real adapter via injected `sheets`);
3. calls `executeV2TaskActionCutover` → maps `snooze→POSTPONE`, derives a stable `clientOperationId`, runs the guarded `executeTaskMutation`;
4. on success, builds the response via the **shared overlay** (`applyRepoV2Compatibility(legacy, repoSnapshot)` — same as `GET /api/mentor/plan`);
5. **fails closed** on any error (`500`/4xx), never falling back to the legacy write after entering the V2 branch.

## 3. Flag gate behaviour
The V2 branch is reachable only when `isV2TaskMutationActive()` (all of `MENTOR_TASK_MUTATIONS_V2` + `MENTOR_SHEETS_MUTATIONS_V2` + `MENTOR_MUTATION_IDEMPOTENCY_V2`) is true. All three are **false**, so the branch is unreachable in the live env and the legacy write path remains the sole active path (tests 1–2). When all three are true, only `snooze` routes (test 3).

## 4. Whitelist behaviour
`V2_CUTOVER_ACTIONS = ['snooze']`. `complete`/`response`/`launch_practice`/`resume`/unknown always take the legacy path even with all mutation flags true (test 4). Within the handler, a non-whitelisted `actionType` returns `ACTION_NOT_WHITELISTED_FOR_V2` before any mutation.

## 5. POSTPONE mutation behaviour (fake-client, verified)
`active → pending` (test 5); `PendingReason = user_postponed` (6); `MovedToPendingAt` set (7); `RowVersion` incremented `1→2` via optimistic compare-and-update (8). Only whitelisted canonical columns are written — the repository **never adds columns** for unmapped fields (unlike the generic adapter). The physical `Status` becomes canonical `pending` (with v2 pending evidence), so the task is correctly counted as canonical pending by the Phase 8A predicate going forward.

## 6. Idempotency behaviour
One idempotency row written to `MentorMutationRequests` (test 10). Replay with the same `clientOperationId` returns `idempotent:true` and writes **no** second event/idempotency row and does **not** bump RowVersion again (test 11). Same key + different payload → `IDEMPOTENCY_PAYLOAD_MISMATCH` (test 12). The store persists `executeTaskMutation`'s precomputed `payloadHash` verbatim for exact comparison.

## 7. Event / log behaviour
Exactly one canonical event row appended to `MentorTaskLogs` (test 9) with `CanonicalAction=POSTPONE`, `FromStatus=active`, `ToStatus=pending`, plus `EventId`/`IdempotencyKey`/`RequestId`/`EventPayloadJSON`. Legacy `appendMentorTaskLog` is **not** used on the V2 path (no duplicate legacy log).

## 8. Response compatibility result
The success response uses the **shared overlay** (`lib/mentor/read/serveCompatibleSnapshot.js`), preserving `exists`, `profile`, `plan`, `activeTasks`, `completedToday`, `deferredTasks`, `pendingTasks`, `progress`, `mentorMessage`, `lastSyncAt`, and applying canonical day + current-generation visibility + hidden historical + pending consistent with V2 rules (test 17). This matches the `GET /api/mentor/plan` contract, resolving the Phase 8C divergence.

## 9. Fresh-plan blank V2 column handling
A freshly generated plan (blank `PlanVersion`/`GenerationId`/`TaskNumber`/`RowVersion`) still mutates correctly: the repository reads `Number(cell || 1)`, so blank `PlanVersion`/`RowVersion` default to `1`, the compare-and-update matches, and `RowVersion` becomes `2` (test 19). **Conclusion:** Phase 9B2's live test **can rely** on this default for the controlled single-action cut-over; populating V2 columns at plan generation is **optional** (recommended later for production cleanliness) and is **not** required by tests, so live plan generation was not changed.

## 10. No-live-write confirmation
Read-only re-read of the live Sheet: `MentorTaskLogs` = 29 (unchanged), `MentorMutationRequests` = 0 (unchanged), `MentorTasks` = 15 (unchanged); task status distribution `{completed:5, snoozed:10}` unchanged; `PendingReason` non-blank count = 0. No live task-action call, no live mutation, no new plan generated. All tests use a fake in-memory Sheets client (test 19/20 confirm no live gateway + forbidden flags unset).

## 11. Tests / build results
`test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **304 passed, 0 failed**. `npx next build` (read flags on, mutation flags off) → **✓ Compiled successfully**.

## 12. Phase 9B2 live test readiness
**Ready.** The live cut-over path is implemented and fully validated against a fake Sheets client. Phase 9B2 (first real live mutation) needs only operational steps:
1. provision a **dedicated test user**; generate a **fresh plan** with a real `active` task (do not touch the affected real plan);
2. take a fresh `.xlsx` backup + record row counts;
3. enable flags in order `MENTOR_MUTATION_IDEMPOTENCY_V2` → `MENTOR_SHEETS_MUTATIONS_V2` → `MENTOR_TASK_MUTATIONS_V2`;
4. perform **one** `snooze` (Maybe Later) on the test task; verify the task row (`Status=pending`, `PendingReason`, `MovedToPendingAt`, `RowVersion=2`), one `MentorTaskLogs` event row, one `MentorMutationRequests` idempotency row, and an idempotent replay; rollback = restore backup or narrow manual revert.

## 13. Blocking items
- **Code blockers (resolved):** handler implemented ✅, shared overlay reused ✅, fail-closed ✅, idempotency/event/RowVersion ✅, fresh-plan default ✅.
- **Operational (Phase 9B2, not code):** dedicated test user + fresh active task; fresh `.xlsx` backup + rollback; enable the three mutation flags in order on the test account only.
- **Non-blocking decision:** V2 `POSTPONE` writes canonical `Status=pending` (not legacy `snoozed`) and does **not** run the legacy `SnoozeCount≥2/≥3` escalation; confirm acceptable (it is — the V2 pending lifecycle replaces that heuristic).

---

*Phase 9B1 complete — V2 postpone cut-over handler implemented + fake-tested. No mutation flag enabled, no live Sheet write, no live task-action call, no new plan generated, no UI change, no deploy, no commit/push.*
