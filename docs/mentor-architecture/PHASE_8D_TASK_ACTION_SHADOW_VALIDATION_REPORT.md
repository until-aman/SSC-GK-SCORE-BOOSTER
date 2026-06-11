# Phase 8D — Task-Action State-Machine Shadow Validation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Enable `MENTOR_TASK_STATE_MACHINE_V2=true` — **shadow validation/logging only** around the task-action route. The legacy task-action write path stays the real active write path. **No V2 mutation, no Sheet write, no UI/deploy.**
**Date:** 2026-06-11
**Result:** ✅ Shadow validation enabled; legacy write path preserved; all state-machine shadow checks pass on live data; repository V2 read still serves Day 4 / 3 current; live Sheet unchanged; 260 tests + build green.

---

## 1. Task-action route inspection result — Pass
`pages/api/mentor/task-action.js` + the Phase 4 shadow hook were inspected:
- `MENTOR_TASK_STATE_MACHINE_V2` gates **only** `await shadowValidateTaskAction({...}).catch(() => {})`, which runs before — and independently of — the real legacy write.
- `shadowValidateTaskAction` performs a **read** (`getActiveMentorPlan`) + a **pure** `evaluateTaskTransition` + a `console.info('[mentor-task-sm-v2:shadow]', …)` log of non-sensitive aggregates (action/status/decision). It does **not**: call the V2 mutation adapter, write `MentorMutationRequests`, append V2 task events, or change any task status.
- The real writes remain the legacy `updateMentorTaskStatus` + `upsertStudentTopicState` + `appendMentorTaskLog` — **unchanged**.
- The hook is `.catch`-wrapped, so a shadow failure cannot break the legacy task-action flow.

Confirmed: the flag enables shadow validation only; it does not replace legacy behaviour, does not invoke the mutation adapter, and does not write.

## 2. Pre-activation baseline (flag off)
| Metric | Value |
|---|---|
| Enabled flags | `MENTOR_REPO_V2`, `MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ` (Phase 8C) |
| `MENTOR_TASK_STATE_MACHINE_V2` | false (before this phase) |
| Forbidden flags | all false |
| MentorTaskLogs rows | 29 |
| MentorMutationRequests rows | 0 |
| Task status distribution | 5 completed, 10 snoozed |
| PendingReason non-blank | 0 |
| Current-generation tasks | 3 |
| Canonical pending | 0 |
| Repository read works | Yes (active gen 5, day 4, not blank) |
| Task-action legacy route (tests) | Pass (state-machine 45/45) |
No writes.

## 3. Flags enabled
Set in **`.env.local`** (server-only):
```text
MENTOR_TASK_STATE_MACHINE_V2=true   ← new this phase
MENTOR_REPO_V2=true            (kept)
MENTOR_SHEETS_SCHEMA_V2=true   (kept)
MENTOR_REPO_V2_SHADOW=true     (kept)
MENTOR_CANONICAL_DAY_READ=true (kept)
```

## 4. Forbidden flags confirmation
Verified `false` after activation: `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`. None enabled.

## 5. Shadow task-action validation result
The state-machine evaluator (`evaluateTaskTransition`) was exercised on **live** repository tasks + representative synthetic cases (pure; no mutation, no write):
| Check | Result |
|---|---|
| current-generation task action evaluated (synthetic active → START → in_progress) | Pass |
| historical-generation task rejected | Pass (`HISTORICAL_TASK_NOT_ACTIONABLE`) |
| hidden legacy snoozed task rejected | Pass |
| completed terminal task cannot reactivate | Pass (`TERMINAL_TASK`) |
| quick-check cannot enter pending | Pass (`ACTION_NOT_ALLOWED_FOR_TASK_TYPE`) |
| manual recovery requires evidence | Pass (`MANUAL_RECOVERY_NOT_VERIFIED`) |
| task type immutable across transition | Pass |
| shadow failures do not break legacy route | Pass (`.catch`-wrapped hook) |
| V2 mutation method invoked | **No** |
The 45 `test:mentor-state-machine` assertions cover these transition rules in the controlled test environment and all pass.

## 6. Repository read validation result
With `MENTOR_TASK_STATE_MACHINE_V2=true`: Mentor repository read still works; response not blank; current-generation tasks **3**; historical hidden (**12**); canonical pending **0**; rollover shadow pending **0**; canonical **Day 4** still used; second MentorProfile row without a plan handled (repository read, no `activePlan`, no crash, no generation/write). No write occurred.

## 7. No-write confirmation
Live Sheet re-read after validation: row counts unchanged (2/5/15/29/4/0/1); **MentorTaskLogs 29 (unchanged)**; **MentorMutationRequests 0 (unchanged)**; task statuses unchanged (5 completed / 10 snoozed); `PendingReason` blank for legacy snoozed; `StudentTopicState` unchanged; schema marker unchanged. (Temporary validation harness removed after use.)

## 8. Tests / build results
`test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **260 passed, 0 failed**. `npx next build` (all 5 read/shadow flags on) → **✓ Compiled successfully**.

## 9. Can Phase 9 plan controlled V2 task mutations?
**Yes — planning may begin.** All read + shadow layers are now live-validated and side-effect-free: Repository V2 reads serve correctly; the state machine, mutation-service guards, idempotency tab, and the gated Sheets mutation adapter exist and pass tests against the migrated live schema; and the task-action shadow validation runs without touching live data. Phase 9 should **design** controlled V2 task mutations behind the still-false flags, in a careful order:
1. enable `MENTOR_MUTATION_IDEMPOTENCY_V2` (idempotency record writes) first, validated on a single low-risk action;
2. then `MENTOR_SHEETS_MUTATIONS_V2` + `MENTOR_TASK_MUTATIONS_V2` to route one task action (e.g., `complete`) through the guarded compare-and-update adapter with `RowVersion` checks + event append;
3. only later `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2`.
Each step needs a fresh backup, a dry/shadow comparison of the V2 write vs legacy write, and a rollback plan — because these are the first **real** live mutations.

## 10. Blocking items
- **Blocking for this shadow phase:** None (complete).
- **Before Phase 9 real mutations (non-blocking now):**
  1. Decide the dual-write vs cut-over strategy for `task-action` (currently legacy writes are authoritative; the V2 adapter is validated but not wired to write).
  2. Establish a fresh `.xlsx` backup + rollback procedure for the first live mutation.
  3. Unify the post-mutation snapshot shape (the `task-action` response is still legacy-shaped; the V2 read overlay currently applies only to `GET /api/mentor/plan`).

---

## Files changed
| File | Change |
|---|---|
| `.env.local` | Added `MENTOR_TASK_STATE_MACHINE_V2=true` (kept the four Phase 8B/8C read/shadow flags; no forbidden flag added). |

No source code was changed this phase — the shadow hook already existed (Phase 4) and is gated by the flag.

*Phase 8D complete — task-action state-machine shadow validation enabled (shadow/logging only). Legacy write path preserved; no V2 mutation adapter invoked; no live Sheet write; no status/event/idempotency write; no UI change; no deploy; no commit/push.*
