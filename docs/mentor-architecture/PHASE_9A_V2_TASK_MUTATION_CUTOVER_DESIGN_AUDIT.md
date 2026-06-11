# Phase 9A — Controlled V2 Task Mutation Cutover Design Audit

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Design/audit only for the first controlled V2 task mutation. **No mutation flag enabled, no live write, no UI/deploy.**
**Date:** 2026-06-11
**Current flags:** `MENTOR_REPO_V2`, `MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ`, `MENTOR_TASK_STATE_MACHINE_V2` = true; all five mutation/write flags = false.

---

## 1. Current legacy task-action write path (`pages/api/mentor/task-action.js`)
Per action (`complete`, `snooze`, `response`, `launch_practice`):
- **Input:** `taskId`, `planId`, `actionType`, `actionValue`, `subject`, `topic`.
- **Auth:** `getServerSession`; 401 if no `session.user.email`. Input validated (`taskId` + action in whitelist), else 400.
- **Shadow (flag-gated):** when `MENTOR_TASK_STATE_MACHINE_V2=true`, `shadowValidateTaskAction(...).catch(()=>{})` runs first — read + pure evaluate + log only (no write).
- **Status update:** for `complete`/`snooze`/`response` → `ACTION_TO_STATUS` → `updateMentorTaskStatus(sheets, email, taskId, {Status, CompletedAt, SnoozedUntil, [SnoozeCount:'__increment__']})`.
  - `updateMentorTaskStatus` finds the row by **`Email + TaskId`** (NOT PlanId), updates the row in place via `updateMentorRow`. **No RowVersion/optimistic-lock check → last-write-wins.** Runs **snooze-escalation side effects**: `SnoozeCount≥2` cuts `QuestionCount→10` + rewrites `WhyThisText`; `SnoozeCount≥3` flips `Status→active`, `Type→feedback_task`, rewrites action labels/message. Writes `UpdatedAt`.
- **StudentTopicState write:** `response` → `upsertStudentTopicState` (Theory/Confidence); `complete` with subject+topic → upsert `TheoryStatus=done`. (`.catch` wrapped.)
- **Log append:** every accepted action → `appendMentorTaskLog` appends one `MentorTaskLogs` row (LogId random). **No idempotency → duplicate calls append duplicate logs.**
- **Post-mutation response:** for non-`launch_practice`, rebuilds via `loadOrCreateMentorSnapshot(email)` (read-only for existing-plan users) and returns `{ success:true, snapshot }` (legacy shape — **the Phase 8C V2 read overlay is NOT applied here**, only on `GET /api/mentor/plan`). On snapshot-build failure returns `{ success:true }`.
- **Error handling:** any throw → 500.

**Weaknesses (today):** (a) **no idempotency** — double-submit appends duplicate logs and can double-increment snooze; (b) **no optimistic lock** — concurrent edits race (last-write-wins); (c) row matched by `Email+TaskId` only (works because TaskId is unique, but not plan/generation-scoped); (d) post-mutation snapshot shape diverges from the V2-served `GET /plan`.

## 2. V2 mutation adapter readiness (`sheetsMutationAdapter.js` + `taskMutationService.js`)
| Capability | Status |
|---|---|
| Schema marker enforcement (`assertSchemaReady`) | ✅ Ready (verified live: marker `mentor\|2` + required columns present) |
| Required-columns check (`validateRequiredColumns`) | ✅ Ready |
| RowVersion compare-and-update (`compareAndUpdateTask`) | ✅ Ready (checks PlanId/PlanVersion/Status/RowVersion; increments RowVersion) |
| Exact row match by `TaskId` + `PlanId` | ✅ Ready |
| Duplicate-row rejection | ✅ Ready (`DUPLICATE_TASK_ROWS`) |
| Idempotency read/write (`get/saveIdempotencyResult` on `MentorMutationRequests`) | ✅ Ready (payload-hash mismatch rejected) |
| Event append (`appendTaskEvent` → `MentorTaskLogs` with EventId/From/To/CanonicalAction) | ✅ Ready |
| Task-number reservation (`reserveTaskNumbers`) | ✅ Ready (atomic `NextTaskNumber`) |
| Service orchestration (`executeTaskMutation` guards) | ✅ Ready — now covered by 11 new in-memory tests (auth, active-plan, plan/version/rowVersion staleness, historical/hidden rejection, duplicate completion, idempotency, unsupported-action) |
| **Real Sheets gateway used live** | ⚠️ Not yet — adapter tested only against fake/in-memory workbook; the live `createSheetsMutationAdapter` write methods have **never executed against the live Sheet** |
| **Rollback** | ⚠️ Non-transactional (Sheets); backup-restore only |
| **Legacy snooze-escalation parity** | ⚠️ Gap — the V2 state machine does NOT replicate the legacy `SnoozeCount≥2/≥3` escalation (QuestionCount cut / feedback_task flip). A cut-over of `snooze`→`POSTPONE` changes this behaviour. |

**Not ready / gaps:** live execution of the real Sheets mutation gateway is unproven; no automatic rollback; legacy snooze-escalation semantics are not reproduced by V2; the live affected plan has **no V2-actionable task** (see §4); post-mutation response shape not yet unified.

## 3. Dual-write vs cut-over — recommendation: **CUT-OVER (one whitelisted action)**
- **Option A (dual-write):** legacy stays authoritative, V2 mirrors. *Pros:* easy rollback. *Cons:* two writers on a **non-transactional** Sheet writing **different column sets** (legacy: Status/SnoozedUntil/SnoozeCount escalation; V2: Status/PendingReason/MovedToPendingAt/RowVersion) → guaranteed row divergence, double writes, double log rows, RowVersion meaningless. **Rejected.**
- **Option B (cut-over one low-risk action):** V2 is the sole writer for exactly one whitelisted action. *Pros:* single consistent writer, real RowVersion + idempotency, clean state. *Cons:* higher first-write risk; needs solid backup/rollback + unified response. **Recommended** — code audit confirms dual-write is unsafe on Sheets and the V2 path already has the guards/idempotency/locking that make a single-action cut-over the cleaner first step.

## 4. Selected first mutation action — **`postpone` (Maybe Later), reversible**
Evaluation: `complete` (terminal, irreversible without manual revert), `resume`/`start` (need a pending/active task), `cancel`/`expire` (terminal), `manual recovery` (needs evidence). **`postpone` (active→pending)** is **non-terminal and reversible** (via `resume` back to active), has no completion/coin semantics, and is fully guarded + idempotent in V2 → **safest first cut-over**.

**Critical live constraint:** the affected real plan has **current-generation = 3, all legacy snoozed/hidden, active = 0, canonical pending = 0** → there is **no V2-actionable task on the real plan**. Therefore the first live mutation must **not** use the affected plan. **Strategy:** use a **dedicated test user/profile** (e.g., the founder's second test login or a throwaway test account), generate a **fresh plan** (creates an `active` task), then perform the single `postpone` cut-over on that fresh active task. **Do not perform this in Phase 9A.** (Caveat: legacy plan generation does not populate the new V2 columns — `PlanVersion`/`GenerationId`/`TaskNumber`/`RowVersion` write blank; the adapter tolerates blank RowVersion as `1`, but Phase 9B must verify a freshly generated plan reads/mutates cleanly, or add V2-field population to generation first.)

## 5. Required Phase 9B flags & order (do NOT enable now)
```text
1. MENTOR_MUTATION_IDEMPOTENCY_V2=true   # validate MentorMutationRequests writes on the test action first
2. MENTOR_SHEETS_MUTATIONS_V2=true       # enable the live Sheets mutation adapter
3. MENTOR_TASK_MUTATIONS_V2=true         # route ONLY the whitelisted `postpone` action through executeTaskMutation
```
Must remain **false** throughout Phase 9B: `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`. Phase 9B must also implement an **action whitelist** so only `postpone` routes through V2 while every other action keeps the legacy path.

## 6. Backup & rollback plan for Phase 9B (first real mutation)
- **Fresh `.xlsx` backup required:** Yes — before any write; record filename + timestamp.
- **Record row counts:** MentorProfile, MentorPlans, MentorTasks, MentorTaskLogs, MentorMutationRequests (current 0), StudentTopicState.
- **Selected task row:** the single fresh active test-user task (record `TaskId`, `PlanId`, `RowVersion`, `Status`).
- **Expected pre-state:** `Status=active`, `RowVersion=N`, `PendingReason` blank.
- **Expected post-state:** `Status=pending`, `PendingReason=user_postponed`, `MovedToPendingAt` set, `RowVersion=N+1`.
- **Expected idempotency row:** one `MentorMutationRequests` row (key `mentor-task:<scope>:<plan>:<task>:POSTPONE:<op>`, Status completed, ResultJSON).
- **Expected event/log row:** one `MentorTaskLogs` row with `EventId`, `FromStatus=active`, `ToStatus=pending`, `CanonicalAction=POSTPONE`.
- **Rollback (honest):** Google Sheets is **not transactional**. Rollback = **restore the fresh `.xlsx` backup**, OR — only if a narrow manual revert plan is pre-approved — manually set the one task row back to `Status=active`/`RowVersion=N`/clear `PendingReason`/`MovedToPendingAt` and delete the single appended log + idempotency rows. **No automatic rollback exists.**
- **Stop conditions:** schema marker missing, duplicate task row, RowVersion conflict, idempotency payload mismatch, post-write verification mismatch, or any unexpected row-count delta → stop, do not continue, restore backup.

## 7. Live test user/task strategy
Do **not** mutate the affected real plan. Use a **dedicated test profile** with a freshly generated plan that contains a real `active` task; perform the single guarded `postpone` against it; verify pre/post state + idempotency + event rows; then exercise idempotent replay (same key → no second write). Keep all rollover/pending flags false. (Not executed in Phase 9A.)

## 8. Post-mutation response compatibility plan — **apply the V2 overlay to the response**
Options: (a) apply the same `applyRepoV2Compatibility` overlay before returning the task-action response; (b) tell the client to re-fetch `GET /api/mentor/plan`; (c) hand-patch legacy fields. **Recommended: (a)** — **extract `applyRepoV2Compatibility` from `plan.js` into a shared module** (e.g., `lib/mentor/read/serveCompatibleSnapshot.js`) and have both `GET /api/mentor/plan` and the V2 task-action response use it, so the post-mutation snapshot matches the served read exactly (same keys, current-generation tasks, canonical day). This removes the Phase 8C divergence without a redesign or an extra round-trip.

## 9. Tests / build results
Added `scripts/test-mentor-mutation-service.js` (11 non-mutating in-memory tests) + `package.json` script. Suite: state-machine 45/45 · rollover 67/67 · repo 22/22 · sheets 36/36 · sheets-writer 23/23 · plan-day 25/25 · **mutation-service 11/11** · optimization 42/42 — **271 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**. No live write; no mutation flag enabled.

## 10. Exact Phase 9B recommendation
1. Extract the V2 read overlay into a shared module; have the V2 task-action response reuse it.
2. Implement a strict **action whitelist** routing only `postpone` through `executeTaskMutation` (real Sheets gateway), every other action staying legacy.
3. Take a fresh `.xlsx` backup + record row counts.
4. On a **dedicated test user** with a freshly generated active task, enable in order `MENTOR_MUTATION_IDEMPOTENCY_V2` → `MENTOR_SHEETS_MUTATIONS_V2` → `MENTOR_TASK_MUTATIONS_V2`, then perform **one** `postpone`; verify pre/post state, the idempotency row, the event row, and an idempotent replay.
5. Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` false; do not touch the affected real plan.

## 11. Blocking items
- **Blocking for Phase 9B (must resolve first):**
  1. **No V2-actionable task exists on the real plan** → Phase 9B needs a dedicated test user + freshly generated active task.
  2. **Legacy plan generation does not populate V2 columns** (`PlanVersion`/`GenerationId`/`TaskNumber`/`RowVersion` blank) → verify a fresh plan reads/mutates cleanly under V2, or add V2-field population to generation before the cut-over.
  3. **Post-mutation response not unified** → extract/reuse the V2 overlay (recommendation §8/§10.1).
- **Non-blocking but must be decided:** legacy **snooze-escalation parity** — V2 `POSTPONE` does not reproduce the `SnoozeCount≥2/≥3` QuestionCount-cut / feedback_task flip; confirm this behaviour change is acceptable for the cut-over action (it likely is, since escalation is a legacy heuristic the V2 pending lifecycle replaces).

---

## Files changed (audit only)
| File | Change |
|---|---|
| `scripts/test-mentor-mutation-service.js` | New: 11 non-mutating in-memory tests for `executeTaskMutation` guards. |
| `package.json` | Added `test:mentor-mutation-service` script. |
No flag changed, no source logic changed, no live Sheet write.

*Phase 9A complete — design/audit only. No mutation flag enabled, no live Sheet write, no status/event/idempotency write, no UI change, no deploy, no commit/push.*
