# Phase 8C — Repository V2 Read Path Enablement Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Enable `MENTOR_REPO_V2=true` so Mentor reads serve from Repository V2 (generation isolation + canonical day) via a compatibility overlay. **No mutation/rollover/pending/Sheet-write flag enabled. No live write. No UI redesign. No deploy.**
**Date:** 2026-06-11
**Result:** ✅ V2 read path serving; response non-blank & compatible; Day 1 → canonical Day 4; historical hidden; pending 0; live Sheet unchanged; 260 tests + build green.

---

## 1. Baseline before enabling `MENTOR_REPO_V2`
| Metric | Value |
|---|---|
| Enabled read-only flags | `MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ` (Phase 8B) |
| `MENTOR_REPO_V2` | **false** (before this phase) |
| Forbidden flags | all false |
| Legacy reader task count | 15 |
| Legacy display day | 1 (frozen) |
| Repository V2: active gen / current / historical / hidden / canonical pending | 5 / 3 / 12 / 10 / 0 |
| Canonical day | calendarDay 4, activePlanDay 4 |
| Rollover shadow pending | 0 |
| Row counts | 2 / 5 / 15 / 29 / 4 / 0 / 1 |
| MentorTaskLogs rows | 29 |
| MentorMutationRequests rows | 0 |
No writes.

## 2. Flags enabled
Set in **`.env.local`** (server-only):
```text
MENTOR_REPO_V2=true            ← new this phase
MENTOR_SHEETS_SCHEMA_V2=true   (kept)
MENTOR_REPO_V2_SHADOW=true     (kept)
MENTOR_CANONICAL_DAY_READ=true (kept)
```
`MENTOR_TASK_STATE_MACHINE_V2` not enabled (not needed for read-only validation).

## 3. Forbidden flags confirmation
Verified `false` after activation: `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2` (and `MENTOR_TASK_STATE_MACHINE_V2`). None enabled.

## 4. Mentor read/API validation (Repository V2 serving)
Implemented a flag-gated **compatibility overlay** in `pages/api/mentor/plan.js` (`applyRepoV2Compatibility`, applied only when `isMentorRepoV2Enabled()` and the snapshot exists; wrapped in try/catch that falls back to the unchanged legacy snapshot on any error). The plan-read code paths were exercised against the live migrated Sheet (the ESM route can't be required from a node harness, so the exact `buildSnapshot` + overlay logic was mirrored on live data). Results:
- Read/API does not crash; response is **not blank** (`exists:true`, `plan` present, `profile` preserved).
- Current-generation tasks returned: **3**; historical (12) **hidden** from today; hidden legacy snoozed do **not** appear as pending.
- Canonical pending count **0**; rollover shadow pending **0**.
- Schema marker accepted; active generation resolves as **g5**.
- Active day uses **canonical Day 4**; legacy `ActiveDayNumber=1` retained only as `legacyActiveDayNumber` (debug), not the primary display day.
- Second MentorProfile row without a plan: handled via the **repository read** (no `activePlan`, no crash). No plan generation was triggered for it during validation (the validator uses the repository read, never `loadOrCreateMentorSnapshot`).
No task-action endpoint was called.

## 5. Response compatibility result
The overlay **preserves the existing response shape** — same top-level keys (`exists`, `profile`, `plan`, `activeTasks`, `completedToday`, `deferredTasks`, `pendingTasks`, `progress`, `mentorMessage`, `lastSyncAt`) — and only corrects values:
- `plan.tasks` → 3 current-generation tasks (full legacy UI shape, filtered from the legacy 15 by Repository V2 `taskId`s), so historical tasks never render as today's tasks.
- `plan.dayNumber`/`activeDayNumber` → canonical `activePlanDay` (4); `daysTotal` → canonical `totalPlanDays` (46).
- `activeTasks` 0, `completedToday` 0, `deferredTasks` 3 (the current-generation snoozed tasks), `pendingTasks` **0** (legacy snoozed never enter pending).
- `profile` is the **legacy rich profile** (onboarding/subject/topic fields) — unchanged, so the dashboard's profile-dependent rendering is intact.
- Additive debug fields: `legacyActiveDayNumber`, `canonicalCalendarDay`, `canonicalActivePlanDay`, `repositoryServed:true`, `activeGeneration`, `historicalTaskCount`.

## 6. Canonical day result
Display day decision applied: **canonical Day 4** (was frozen legacy Day 1). `activePlanDay=4`, `calendarDay=4`, `totalPlanDays=46`, `timezone=Asia/Kolkata`. The frozen legacy day no longer drives the UI day field.

## 7. Task visibility result
Today view shows the **3 current-generation** tasks; the **12 historical** tasks are hidden from today; the legacy snoozed tasks are not surfaced as pending backlog. (For the affected plan, the 3 current-generation tasks are all snoozed, so today shows 0 active / 3 deferred — the true current-generation state, pending plan regeneration in a later phase.)

## 8. Pending result
Canonical pending **0**; rollover shadow pending **0**; featured pending none; nudge tier hidden — consistent with Phase 8A reconciliation.

## 9. Second profile handling
The planless second MentorProfile row is handled safely by the repository read (returns a snapshot with no `activePlan`, no crash). The overlay is a no-op for it (guards on `repoSnapshot.activePlan`). No plan generation/write was triggered during validation.

## 10. No-write confirmation
Live Sheet re-read after validation: row counts unchanged (2/5/15/29/4/0/1); **MentorTaskLogs 29 (unchanged)**; **MentorMutationRequests 0 (unchanged)**; no task status changed; `PendingReason` blank for legacy snoozed; `StudentTopicState` unchanged; schema marker unchanged. (Temporary validation script removed after use.)

## 11. Tests / build results
`test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-state-machine` 45/45 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **260 passed, 0 failed**. Lint: 0 errors. `npx next build` (overlay + flags on) → **✓ Compiled successfully**.

## 12. Can Phase 8D enable task-action shadow validation?
**Yes.** The repository V2 read path now serves Mentor reads safely and compatibly with no live writes. Phase 8D may enable `MENTOR_TASK_STATE_MACHINE_V2=true` — which, per Phase 4, only adds a `.catch`-wrapped **shadow validation log** to `/api/mentor/task-action` and does **not** route mutations through V2 or change the existing write — to broaden shadow coverage before any real mutation phase.

**Keep false:** `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`.

## 13. Blocking items
- **Blocking for read enablement:** None (complete).
- **Notes for later phases (non-blocking):**
  1. The legacy `task-action` route still returns a legacy-shaped post-mutation snapshot (the overlay is applied only on `GET /api/mentor/plan`); when task mutations move to V2 this should be unified.
  2. For the affected plan, today's current generation is 3 snoozed tasks (0 active) — a fresh plan generation (a future, separately-approved write phase) would populate active tasks; until then the Mentor tab correctly shows Day 4 with the current-generation tasks and no pending backlog.
  3. The planless second profile will still trigger legacy plan generation on its own first Mentor load (pre-existing app behavior, flag-independent) — out of scope here.

---

## Files changed
| File | Change |
|---|---|
| `pages/api/mentor/plan.js` | Added `isMentorRepoV2Enabled` import + `applyRepoV2Compatibility` overlay + flag-gated, try/catch-guarded wiring in the GET handler. Read-only; legacy fallback on error; no task-action/mutation route changed. |
| `.env.local` | Added `MENTOR_REPO_V2=true` (kept the three Phase 8B read-only/shadow flags; no forbidden flag added). |

*Phase 8C complete — Repository V2 read path serving Mentor reads via a compatibility overlay. No mutation/write flag enabled, no live Sheet write, no status/event/idempotency write, no UI redesign, no deploy, no commit/push.*
