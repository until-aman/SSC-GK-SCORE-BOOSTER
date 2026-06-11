# Phase 9B-Prep — V2 Mutation Cutover Readiness (Code Preparation) Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Code preparation for a future controlled V2 task-mutation cut-over. **No live mutation, no mutation flag enabled, no live Sheet write, no UI/deploy.**
**Date:** 2026-06-11
**Result:** ✅ Read overlay extracted + reused; inactive whitelisted V2 routing scaffolded (fails closed); fresh-plan V2-column gap audited; 284 tests + build green; live Sheet unchanged.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/read/serveCompatibleSnapshot.js` | **New** — shared CommonJS `applyRepoV2Compatibility` overlay (extracted verbatim from `plan.js`). |
| `lib/mentor/read/taskActionRouting.js` | **New** — pure routing gate: `V2_CUTOVER_ACTIONS` (`['snooze']`), `isV2TaskMutationActive` (all 3 mutation flags), `isWhitelistedForV2`, `shouldRouteActionThroughV2`. |
| `pages/api/mentor/plan.js` | Removed the inline overlay; now imports the shared one. Behaviour identical to Phase 8C. |
| `pages/api/mentor/task-action.js` | Added inactive, flag-gated, whitelisted V2 routing branch (`shouldRouteActionThroughV2(actionType)` → `handleV2TaskActionCutover`, a **fail-closed 501 scaffold**). Legacy write path unchanged. |
| `scripts/test-mentor-read-overlay.js` | **New** — 13 non-live tests (overlay + routing + fresh-plan read). |
| `package.json` | Added `test:mentor-read-overlay` script. |

## 2. Shared overlay extraction result
`applyRepoV2Compatibility` now lives in `lib/mentor/read/serveCompatibleSnapshot.js` (CommonJS, so both the ESM Mentor routes and the CJS test harnesses use one implementation). It: preserves all legacy response keys; preserves the rich legacy profile (same reference); filters to the repository's current-generation task IDs; hides historical tasks from the today view; keeps pending 0 for legacy snoozed; sets canonical day fields (`plan.dayNumber`, `activeDayNumber`, `canonicalCalendarDay`, `canonicalActivePlanDay`, `legacyActiveDayNumber`); returns a non-blank response when a plan exists; and **no-ops safely** when the legacy snapshot has no plan or the repository snapshot has no active plan. Verified by tests 1–7, 12.

## 3. GET `/api/mentor/plan` compatibility result
`plan.js` imports the shared overlay and calls it in the same flag-gated, try/catch-guarded spot as Phase 8C (legacy fallback on error). The served contract is unchanged: 3 current-generation tasks, Day 4, 12 historical hidden, pending 0, rich profile preserved. (Build compiles; the live read path was validated in Phase 8C and is logically identical here.)

## 4. Task-action V2 routing scaffolding
`task-action.js` now contains an **inactive** V2 branch placed after the shadow hook and before the legacy write:
```js
if (shouldRouteActionThroughV2(actionType)) {
  return handleV2TaskActionCutover({ res }); // fail-closed 501 scaffold (Phase 9B implements the real cut-over)
}
// ... legacy write path (unchanged) ...
```
`handleV2TaskActionCutover` **fails closed** (returns 501, does **not** fall back to the legacy write) so that once the flags are enabled a single action cuts over to V2 without dual-write. While the mutation flags are false the branch is **unreachable**, so the legacy behaviour is byte-for-byte unchanged.

## 5. Whitelist rule
`V2_CUTOVER_ACTIONS = ['snooze']` — only the legacy `snooze` action ("Maybe Later", which maps to V2 `POSTPONE`) is eligible for the V2 cut-over. `complete`, `response`, `launch_practice`, `resume`, and everything else always take the legacy path (tests 9–10). The whitelist keys are the legacy `actionType` strings the UI already sends, so no UI change is needed.

## 6. Mutation flag gating
`isV2TaskMutationActive()` requires **all three** mutation flags true: `MENTOR_TASK_MUTATIONS_V2` **and** `MENTOR_SHEETS_MUTATIONS_V2` **and** `MENTOR_MUTATION_IDEMPOTENCY_V2`. If **any** is false, `shouldRouteActionThroughV2` returns false → legacy path (test 11). All three are currently **false**, so no V2 mutation can execute. No live mutation adapter method is invoked in this phase.

## 7. Fresh-plan V2-column audit
`createMentorPlanSnapshot` (`lib/sheets.js`) writes new `MentorPlans` + `MentorTasks` rows via `appendMentorRows`/`buildHeaderRow`, supplying **only legacy columns**. It populates **none** of the V2 additive columns — plan row: `PlanVersion`, `GenerationId`, `TaskSetRevision`, `NextTaskNumber`, `RowVersion` left blank; task rows: `PlanVersion`, `GenerationId`, `TaskNumber`, `RowVersion`, `OriginalScheduledDay`, `ScheduledLocalDate` left blank.
- **Can a freshly generated plan be V2-mutated?** Yes, with the current adapter: `sheetsMutationAdapter` reads `Number(cell || 1)` for `PlanVersion`/`RowVersion`, so blanks default to `1`; the service's `getActivePlanPointer`/`getTaskForMutation` and `compareAndUpdateTask` therefore match (`expected 1` vs `blank→1`) and the first write sets `RowVersion=2`. Repository **reads** a fresh single-generation plan cleanly (1 generation, active; `TaskNumber`/`GenerationId` derived at read) — proven by test 13.
- **What Phase 9B must do:** either (a) rely on the documented blank→`1` default for the controlled single-action test cut-over (sufficient and verified), or (b) — preferred for production — add V2-field population to `createMentorPlanSnapshot` (`PlanVersion=1`, deterministic `GenerationId`, `TaskNumber`, `RowVersion=1`, `NextTaskNumber`) so fresh plans are first-class V2 rows.

## 8. Tests added
`scripts/test-mentor-read-overlay.js` — **13 non-live tests, all passing**: overlay preserves legacy keys (1); current-generation filter (2); canonical Day 4 fields (3); historical hidden (4); pending 0 for legacy snoozed (5); planless/no-active-plan no-op (6); rich profile preserved (7); future task-action response reuses the same overlay shape (12); routing stays legacy when flags false (8); only `snooze` routes when all 3 flags true (9); `complete`/others stay legacy even with flags true (10); no routing when any single flag false (11); fresh-plan with blank V2 columns reads cleanly under Repository V2 (13). Also added in Phase 9A: `test:mentor-mutation-service` (11 in-memory guard tests).

## 9. No-write confirmation
Read-only re-read of the live Sheet: `MentorTaskLogs` = 29 (unchanged), `MentorMutationRequests` = 0 (unchanged), `MentorTasks` = 15 (unchanged). No task status changed; no `PendingReason` written; no `StudentTopicState` change; no live mutation performed. All new tests use fake/in-memory data.

## 10. Tests / build results
`test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **284 passed, 0 failed**. `npx next build` (read flags on, mutation flags off) → **✓ Compiled successfully**.

## 11. Phase 9B live mutation readiness
The cut-over scaffolding is in place and inert. Phase 9B can now implement the real V2 cut-over inside `handleV2TaskActionCutover`:
1. provision a **dedicated test user** and generate a **fresh active task** (do not touch the affected real plan);
2. take a fresh `.xlsx` backup + record row counts;
3. enable flags in order `MENTOR_MUTATION_IDEMPOTENCY_V2` → `MENTOR_SHEETS_MUTATIONS_V2` → `MENTOR_TASK_MUTATIONS_V2`;
4. wire `handleV2TaskActionCutover` to `executeTaskMutation` (real Sheets mutation adapter) for `POSTPONE`, then return the response via the **shared overlay** (`applyRepoV2Compatibility`) so the post-mutation shape matches `GET /plan`;
5. perform **one** `postpone`, verify pre/post state + idempotency row + event row + idempotent replay, with the documented backup-restore rollback.

## 12. Remaining blockers
- **Code prep blockers (now resolved):** overlay extraction ✅, GET-plan reuse ✅, whitelisted inactive routing ✅, response-shape reuse helper ✅.
- **Remaining for Phase 9B live mutation (operational, not code):**
  1. dedicated test user + freshly generated active task (the affected real plan has 0 V2-actionable tasks);
  2. fresh `.xlsx` backup + rollback procedure for the first real write;
  3. implement `handleV2TaskActionCutover` (currently a fail-closed 501 scaffold) wired to `executeTaskMutation` + shared overlay response;
  4. decide whether to populate V2 columns at plan generation (§7b) — optional for the test cut-over, recommended before production rollout.
- **Non-blocking decision:** V2 `POSTPONE` does not reproduce legacy snooze-escalation (`SnoozeCount≥2/≥3`); confirm acceptable for the cut-over action.

---

*Phase 9B-Prep complete — code preparation only. No mutation flag enabled, no live Sheet write, no status/event/idempotency write, no live task-action call, no UI change, no deploy, no commit/push.*
