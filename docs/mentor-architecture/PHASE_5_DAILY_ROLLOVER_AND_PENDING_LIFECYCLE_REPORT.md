# Phase 5 - Daily Rollover and Pending Lifecycle Report

**Project:** SSC Mentor / SSC GK Score Booster  
**Active app folder:** `festive-engelbart-5368c8`  
**Scope:** Backend/domain foundation for canonical daily rollover, pending backlog lifecycle, featured pending selection, snapshot fields, shadow evaluation, tests.  
**Date:** 2026-06-10

---

## 1. Files Created

1. `lib/mentor/services/dailyRolloverService.js`
   - Pure/idempotent daily rollover service foundation.
   - Moves eligible current-generation active/in-progress work tasks to canonical pending through the Phase 4 state machine.
   - Reschedules quick checks without putting them in pending.
   - Implements pending query, featured pending selection, pending age, nudge tier, maximum active-task materialisation helper, and snapshot extension.

2. `scripts/test-mentor-daily-rollover.js`
   - Phase 5 no-write test harness with 55 tests.

3. `docs/mentor-architecture/PHASE_5_DAILY_ROLLOVER_AND_PENDING_LIFECYCLE_REPORT.md`
   - This report.

## 2. Files Modified

1. `lib/mentor/domain/enums.js`
   - Added pending reason `sync_unconfirmed` for future quiz reconciliation compatibility.

2. `lib/mentor/domain/types.js`
   - Extended canonical snapshot shape with pending/featured/rollover fields.

3. `lib/mentor/domain/invariants.js`
   - Added pending snapshot invariants:
     - pending count integrity
     - no active/pending duplicate
     - no hidden legacy pending leak
     - no terminal task in pending
     - featured task must be present in pending collection.

4. `lib/mentor/repository/featureFlags.js`
   - Added Phase 5 flags:
     - `MENTOR_DAILY_ROLLOVER_V2`
     - `MENTOR_PENDING_LIFECYCLE_V2`
   - Both default false.

5. `pages/api/mentor/plan.js`
   - Added default-off read-only rollover shadow evaluation.
   - Existing response remains unchanged while flags are false.
   - No Sheet write path is called.

6. `package.json`
   - Added `test:mentor-rollover`.

## 3. Rollover Algorithm

`processDailyRollover({ userScope, activePlan, repositorySnapshot, currentServerTime, idempotencyKey })`:

1. Uses Phase 3 canonical `calendarDay` from the repository snapshot.
2. Compares it with `lastProcessedCalendarDay`.
3. Returns a no-op result when no day change is required.
4. Uses deterministic key:

```text
mentor-rollover:<userScope>:<planId>:<calendarDay>
```

5. Processes only current-generation tasks from the active plan.
6. Moves only eligible unfinished active/in-progress work tasks to pending.
7. Reschedules quick checks through `DEFER_CHECK`.
8. Does not mutate completed, scheduled future, blocked, cancelled, expired, pace-offer, or hidden legacy tasks.
9. Applies the maximum 3 active task rule through a controlled materialisation helper.
10. Selects a featured pending task deterministically.
11. Emits aggregate events in-memory for the domain result.

No production mutation path is enabled.

## 4. Task Eligibility

May become pending after day end:

```text
practice_task
revision_task
mistake_recovery_task
theory_task
```

Only from:

```text
active
in_progress
```

Must not become pending:

```text
coverage_check
confidence_check
feedback_task
pace_unlock_task
scheduled
blocked
completed
cancelled
expired
hidden legacy-generation tasks
historical-generation tasks
```

## 5. Pending Reasons

Implemented:

```text
user_postponed
day_ended_incomplete
in_progress_abandoned
```

Reserved, not used by rollover yet:

```text
sync_unconfirmed
plan_rebalanced
```

Rules:

- active task at rollover -> `day_ended_incomplete`
- in-progress task at rollover -> `in_progress_abandoned`
- Maybe Later remains `user_postponed` through the Phase 4 task state machine

## 6. Skipped-Day Behaviour

When `lastProcessedCalendarDay = 1` and `calendarDay = 5`:

- the result emits `MULTI_DAY_GAP_PROCESSED`
- only tasks that were actually active/in-progress are evaluated
- no tasks are fabricated for Days 2, 3, and 4
- no hypothetical backlog is created
- current day materialisation remains a controlled interface, not a generator rewrite

## 7. Pending Query Rules

`listPendingTasks(userScope, activePlan)` equivalent logic is implemented as a pure helper over supplied tasks:

1. active plan only
2. current generation only
3. canonical status `pending`
4. hidden legacy tasks excluded
5. completed/cancelled/expired excluded
6. quick checks excluded
7. duplicate task IDs removed
8. deterministic sorting:
   - priority/reason
   - oldest `movedToPendingAt`
   - original scheduled day
   - task number
   - task id

## 8. Featured-Task Selection

One stable featured pending task is selected per calendar day:

1. zero pending -> no featured task
2. existing same-day featured task is kept if still pending
3. otherwise selection priority is:
   - repeated mistake recovery
   - in-progress abandoned
   - mentor priority score
   - oldest pending
   - stable task number / task id tie-break

The featured task remains status `pending`, optional, and separate from active required tasks.

## 9. Backlog Tiers

Pending nudge tier is derived from pending count:

```text
0      -> hidden
1-3    -> normal
4-7    -> stronger
8-14   -> backlog_session
15+    -> plan_review
```

Pending age is calculated from plan timezone and server date. Age does not expire tasks and does not increase required workload.

## 10. Snapshot Changes

The canonical snapshot shape now includes:

```javascript
{
  pendingTasks,
  pendingCount,
  featuredPendingTask,
  featuredPendingForCalendarDay,
  pendingNudgeTier,
  lastProcessedCalendarDay,
  rolloverRequired,
  rolloverProcessedAt
}
```

Added invariants:

- pending tasks belong to active plan/current generation
- hidden legacy tasks excluded
- no active/pending duplicate
- featured task included in pending tasks
- completed/cancelled/expired excluded
- pending count matches array length
- canonical day remains independent of task completion

## 11. Persistence Limitations

The current physical Google Sheet schema does not safely support every canonical mutable field without additive columns:

```text
PendingReason
MovedToPendingAt
NextEligibleAt
RowVersion
OriginalScheduledDay
TaskNumber
LastProcessedCalendarDay
FeaturedPendingTaskId
FeaturedPendingForCalendarDay
```

Because Phase 5 forbids manual header/schema changes, live Google Sheets rollover mutation remains disabled. The service is ready for a future adapter once the additive migration is explicitly approved.

## 12. Feature Flags

Added:

```text
MENTOR_DAILY_ROLLOVER_V2=false
MENTOR_PENDING_LIFECYCLE_V2=false
```

Recommended full future activation dependency:

```text
MENTOR_REPO_V2=true
MENTOR_CANONICAL_DAY_READ=true
MENTOR_TASK_STATE_MACHINE_V2=true
MENTOR_TASK_MUTATIONS_V2=true
MENTOR_DAILY_ROLLOVER_V2=true
MENTOR_PENDING_LIFECYCLE_V2=true
```

No flag is enabled by default.

## 13. API Integration

`/api/mentor/plan` includes only a default-off shadow evaluation:

- runs only when `MENTOR_DAILY_ROLLOVER_V2=true` or `MENTOR_PENDING_LIFECYCLE_V2=true`
- reads canonical repository data
- evaluates rollover in memory
- logs aggregate/non-sensitive diagnostics only
- never modifies the user-facing response
- never writes to Sheets
- never appends live events

Existing production behavior is unchanged while flags are false.

## 14. Tests

Command:

```text
npm run test:mentor-rollover
```

Result:

```text
55/55 Mentor daily rollover tests passed.
```

Covered:

- no-op day
- Day 1 -> Day 2
- Day 1 -> Day 5
- duplicate/idempotent rollover
- active/in-progress work task movement
- quick-check rescheduling
- pace-offer exclusion
- hidden legacy protection
- current-generation isolation
- pending query sorting/deduping
- featured pending stability/reselection
- max 3 active tasks
- pending age and nudge tiers
- snapshot pending integrity
- event/idempotency behavior

## 15. Build

Commands run:

```text
npm run test:mentor-rollover
npm run test:mentor-state-machine
npm run test:mentor-plan-day
npm run test:mentor-repo
node scripts/test-mentor-api-optimization.js
npm run lint
npm run build
```

Results:

- Phase 5 rollover tests: 55 passed, 0 failed.
- Phase 4 task state machine tests: 45 passed, 0 failed.
- Phase 3 plan-day tests: 25 passed, 0 failed.
- Phase 2 repository tests: 22 passed, 0 failed.
- Existing Mentor optimization tests: 42 passed, 0 failed.
- Lint: passed with pre-existing warnings in `pages/onboarding-slides.js` and `pages/quiz-setup.js`.
- Production build: passed.

## 16. No-Write Confirmation

- No Google Sheet was read by the Phase 5 tests.
- No Google Sheet cell was written.
- No Sheet header was added, removed, renamed, or reordered.
- No live task row was changed.
- No task status was changed in production data.
- No plan was generated.
- No cache was overwritten by rollover tests.
- No event was appended to live MentorTaskLogs.

## 17. Known Limitations

- Daily rollover writes are not enabled.
- Google Sheets rollover adapter is not enabled.
- Current-day task materialisation is an interface/test adapter, not a production generator replacement.
- Previously Pending UI is not implemented.
- Pending Tasks page is not implemented.
- Full quiz reconciliation is not implemented.
- Early next-day unlock is not implemented.
- Update My Plan replacement is not implemented.
- Supabase is not implemented.

## 18. Rollback

Keep flags false:

```text
MENTOR_DAILY_ROLLOVER_V2=false
MENTOR_PENDING_LIFECYCLE_V2=false
```

With flags false:

- production Mentor UI and API responses remain unchanged
- no rollover shadow evaluation runs
- no new mutation path is used

No data migration occurred, so no data rollback is required.

## 19. Phase 6 Readiness

Ready.

Phase 6 can build UI/experience on top of:

- canonical pending query
- stable featured pending selection
- pending nudge tiers
- max 3 active-task rule
- rollover shadow diagnostics

Before enabling live pending lifecycle writes, approve an additive Sheet schema migration or an alternative durable persistence layer for canonical mutable task fields.
