# Phase 9E — Mentor Pending UI Read Integration Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Surface `pendingTasks` in the Mentor UI (a compact "Previously Pending" section with a Resume CTA). **UI/read integration only — no new mutation action, no backend write-model change, no live mutation, no flag change.**
**Date:** 2026-06-11
**Result:** ✅ Pending section added (hidden when empty), Resume reuses the existing `task-action` flow with `actionType=resume`; backend scoping unchanged; real plan untouched. 350 tests + build green.

---

## 1. UI files changed
| File | Change |
|---|---|
| `pages/mentor.js` | Added `handleResume(task)` (reuses `runTaskAction(task, 'resume')`); added a `resume → 'active'` case to `getGuestTaskStatus` (guest optimistic path); added the **"Previously Pending"** `<section>` after `<TodaysPlanCard>`, rendered only when `snapshot.pendingTasks.length > 0`, with a Resume button per task. |
| `scripts/test-mentor-pending-ui.js` | **New** — 9 source-assertion + data-shape tests (no React test harness exists in the repo). |
| `package.json` | Added `test:mentor-pending-ui`. |

No backend files were changed (the read model + overlay from Phase 9C already provide `pendingTasks`; `resume` was already accepted by `task-action.js` from Phase 9D).

## 2. Pending section behaviour
- **Source of data:** `snapshot.pendingTasks` (the canonical V2 pending list produced by the shared overlay in Phase 9C; the client also recomputes `pendingTasks = tasks.filter(status==='pending')`, which is consistent because V2-postponed tasks are physically `Status=pending` while legacy snoozed are `Status=snoozed`).
- **Visibility:** rendered only when `pendingTasks.length > 0`; **hidden when empty** (so the test user after the 9D RESUME — `pendingTasks=0` — and the affected real user both see no section).
- **No duplication:** pending tasks are `Status=pending`; `<TodaysPlanCard>` receives only `activeTasks` (active) and `deferredTasks` (snoozed), so a pending task never appears in both. The overlay also excludes pending ids from `deferredTasks`.
- **Legacy snoozed never shown as pending:** legacy snoozed rows are `Status=snoozed` (deferred), not `pending`, and lack v2 evidence — they are excluded from `canonicalPendingTasks` and from this section.
- **Copy (no guilt):** heading "Previously Pending"; sub "Tasks you paused for later. Resume when you're ready."; per-task chip "Paused for later" + "Continue when you want." No "missed/failed/overdue" language (asserted by test).

## 3. Resume CTA behaviour
- Primary action **Resume** → `handleResume(task)` → `runTaskAction(task, 'resume')`, which POSTs `/api/mentor/task-action` with `{ taskId, planId, actionType: 'resume' }`.
- The **backend decides** V2 vs legacy (cohort allowlist + flags); the frontend stays unaware of V2 flags.
- Loading state: button shows "Resuming…" and is disabled while `busyTaskId === task.taskId`.
- On success the route returns the updated snapshot; `runTaskAction` calls `setSnapshot(sanitizeSnapshot(data.snapshot))`, so the resumed task leaves the pending section and reappears as an active/current task. Failure surfaces a simple error message. No direct Sheet writes.

## 4. Backend scoping verification (read-only)
Confirmed unchanged: `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES = [u_1d929728f3beaa74]` (test user only); `MENTOR_DAILY_ROLLOVER_V2=false`; `MENTOR_PENDING_LIFECYCLE_V2=false`. Only the allowlisted test user routes `resume`/`snooze` to V2; the real affected user routes them to legacy; `complete`/`response`/`launch_practice` remain legacy for everyone (verified by the routing tests). No mutation flag was changed in this phase.

## 5. Live read-only validation
No mutation performed. Live reads:
- **Test user:** `canonicalPendingTasks = 0`, `currentTasks = 1` (the 9D-resumed task is now active → section correctly hidden).
- **Affected real user:** `canonicalPendingTasks = 0`, legacy snoozed hidden = 10, real plan `{completed:5, snoozed:10}` unchanged.
- The pending-render path (section visible with a task) is covered by a fake fixture in tests (test 9: `pendingTasks=1`), per the rule not to perform a live POSTPONE just to view the UI.

## 6. Tests / build results
`test:mentor-pending-ui` 9/9 · `test:mentor-pending-surfacing` 11/11 · `test:mentor-v2-resume` 18/18 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **350 passed, 0 failed**. `npx next build` → **✓ Compiled successfully** (mentor page 17.3 kB).

> UI test note: the repo has no React/DOM test harness, so the pending-UI tests are source-assertion (section gating, `snapshot.pendingTasks` mapping, Resume→`handleResume`→`runTaskAction('resume')`, guest `resume→active`, route accepts `resume`, no-guilt copy) plus shared-overlay data-shape checks (legacy snoozed excluded; V2 pending not duplicated into deferred). A real render-level test would need adding a frontend test setup — flagged for a future phase.

## 7. Next-phase recommendation
The pending read + Resume loop is now visible and usable for allowlisted users. Recommended next: **`complete` cut-over design** (the only remaining common action). It is **terminal/non-reversible**, so it needs an explicit safe completion-source decision (`quiz_sync` for quiz tasks vs verified manual-recovery for others) and a single controlled test before enabling — design first, then one live test like POSTPONE/RESUME. A lighter alternative is **featured-pending / nudge-tier surfacing** (read-only) from `dailyRolloverService` if a stronger "previously pending" prompt is wanted before the complete cut-over. Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` write flags false until a controlled rollover-write phase is designed.

## 8. Blocking items
- **Blocking for this phase:** None.
- **Non-blocking:** no React render-test harness exists (UI verified by source assertions + build); add one before deeper UI phases. Optional cleanup of the `MP_T9B2_…` test plan/task (currently active). Define safe completion source before any `complete` cut-over.

---

*Phase 9E complete — pending UI read integration (Previously Pending + Resume). No new mutation action, no backend write-model change, no live mutation, no flag change, affected real plan untouched, no deploy, no commit/push.*
