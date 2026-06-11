# Phase 8B — Controlled Read-Only Mentor V2 Flag Activation Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Enable only the safe **read-only / shadow** Mentor V2 flags and verify the live read paths behave safely. **No mutation/rollover-write/pending-write/Sheet-write flag enabled. No live write. No UI change. No deploy.**
**Date:** 2026-06-11
**Result:** ✅ 3 read-only flags enabled; all forbidden flags remain false; live reads + shadow comparison + canonical day validated; live Sheet unchanged; 260 tests + build green.

---

## 1. Pre-activation baseline (flags all false)
Read-only validation before enabling anything:
| Metric | Value |
|---|---|
| Row counts | MentorProfile 2, MentorPlans 5, MentorTasks 15, MentorTaskLogs 29, StudentTopicState 4, MentorMutationRequests 0, MentorSchema 1 |
| Schema marker | `mentor \| 2 \| 2026-06-11T01:49:04.128Z \| b31fe07b…` (valid) |
| Active generation | 5 |
| Current-generation tasks | 3 |
| Historical tasks | 12 |
| Hidden legacy snoozed | 10 |
| Canonical pending | 0 |
| Rollover shadow pending | 0 |
| Canonical day | calendarDay 4, activePlanDay 4 (date-based; **not** frozen at legacy ActiveDayNumber 1) |
| Legacy reader | 15 tasks returned (dashboard not blank) |
| Mentor V2 flags enabled | None |
No writes performed.

## 2. Flags enabled
Set in **`.env.local`** (server-only; no client toggle; appended without printing secrets):
```text
MENTOR_SHEETS_SCHEMA_V2=true
MENTOR_REPO_V2_SHADOW=true
MENTOR_CANONICAL_DAY_READ=true
```
`MENTOR_TASK_STATE_MACHINE_V2` was **not** enabled (its task-action hook is shadow-only, but it was left false per the phase's caution; not required for this read-only milestone).

## 3. Forbidden flags confirmed false
Verified `false` after activation: `MENTOR_REPO_V2`, `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2` (and `MENTOR_TASK_STATE_MACHINE_V2`). None enabled.

> Note: `MENTOR_SHEETS_SCHEMA_V2` is currently a **no-op flag** — it is defined in `featureFlags.js` but no route/write path consumes it yet (verified by code search). Enabling it is safe and forward-compatible.

## 4. Plan / API read validation (flags on)
The plan-read code paths the flags gate were exercised against the live migrated Sheet (the ESM route file can't be required from a node harness, so the same underlying CommonJS modules were run faithfully; the `loadOrCreateMentorSnapshot` generate-write path was deliberately avoided for the planless second profile):
- Existing legacy reader (`getActiveMentorPlan`) remains compatible — returns **15 tasks** (no crash, **no blank dashboard**); the added columns are ignored by the header-based legacy reader.
- Schema marker accepted; active generation resolves as **g5**; current-generation tasks **3**; historical tasks hidden (**12**); hidden legacy snoozed **10**; canonical pending **0**; rollover shadow pending **0**; featured none; nudge tier hidden.
- Canonical day included/computed correctly (calendarDay 4, activePlanDay 4); legacy `ActiveDayNumber=1` does **not** freeze the day (`LEGACY_ACTIVE_DAY_IGNORED`).
- The **second MentorProfile row without a plan** does not break the repository read.
No task-action mutation was triggered.

## 5. Repository shadow comparison result
With `MENTOR_REPO_V2_SHADOW=true`, the shadow comparison ran and logged **non-sensitive aggregates only** (no emails/question content):
```text
adapter: { activePlanId: MP_1780920810055, canonicalCalendarDay: 4, totalTaskCount: 15,
           currentTaskCount: 3, historicalCount: 12, completedCount: 5, hiddenSnoozedCount: 10,
           topicStateCount: 4 }
diffs: []   expectedLegacyDivergence: true
```
`expectedLegacyDivergence` reflects the intended legacy 15-vs-current-3 isolation. No response was altered; no write occurred.

## 6. Canonical day result
`calendarDay=4`, `activePlanDay=4`, `totalPlanDays=46`, `timezone=Asia/Kolkata`, `planStartLocalDate=2026-06-08` (source `canonical_plan_start` — the Phase 6C backfilled value), legacy `ActiveDayNumber=1` ignored. Day is server-time/IST date-based, not frozen.

## 7. Pending / rollover shadow result
Repository canonical pending **0**; rollover shadow pending **0**; hidden legacy snoozed **10** (3 current-generation, hidden per Phase 8A); featured pending none; nudge tier hidden. Consistent before and after activation.

## 8. No-write confirmation
Live Sheet re-read after validation: row counts unchanged (2/5/15/29/4/0/1); **no** new rows in `MentorMutationRequests` or `MentorTaskLogs`; no task status changed; no `PendingReason` written; `StudentTopicState` unchanged; schema marker unchanged. (Temporary validation script removed after use.)

## 9. Tests / build results
`test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-state-machine` 45/45 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **260 passed, 0 failed**. `npx next build` (with flags on in `.env.local`) → **✓ Compiled successfully**.

## 10. Can Phase 8C enable the repository V2 read path?
**Recommendation: remain in shadow for one more controlled step, then enable read.** The repository V2 + canonical day read paths are proven correct and side-effect-free against live data, and the shadow comparison shows the expected isolation with `diffs: []`. Phase 8C may:
1. optionally enable `MENTOR_TASK_STATE_MACHINE_V2` (shadow-only task-action validation logging) to broaden shadow coverage; then
2. enable `MENTOR_REPO_V2` to make the repository V2 read path **serve** Mentor reads — but only after deciding the **user-facing day-display** contract (the UI currently shows the legacy frozen day; switching to canonical day 4 is a visible change that should be a deliberate product/UI decision, not a silent flag flip).

**Still keep false:** all mutation/rollover-write/pending-lifecycle/Sheet-write/idempotency flags.

## 11. Blocking items
- **Blocking for read-only/shadow activation:** None (this phase complete).
- **Before Phase 8C `MENTOR_REPO_V2` read-serve:** confirm the user-facing Mentor **day-display** decision (legacy frozen day vs canonical day), since enabling the canonical day in the UI is a visible behavior change. No data/mutation blocker.

---

*Phase 8B complete — only read-only/shadow flags enabled (`MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ`). No mutation/write flag enabled, no live Sheet write, no status/event/idempotency write, no UI change, no deploy, no commit/push.*
