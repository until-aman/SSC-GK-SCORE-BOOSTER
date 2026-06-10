# Phase 4 - Mentor Task State Machine and Guarded Mutation Foundation Report

**Project:** SSC Mentor / SSC GK Score Booster  
**Active app folder:** `festive-engelbart-5368c8`  
**Scope:** Pure task state machine, guarded mutation service, idempotency/event foundation, default-off API shadow integration, tests.  
**Date:** 2026-06-10

---

## 1. Files Created

1. `lib/mentor/domain/taskStateMachine.js`
   - Pure canonical task transition engine.
   - Defines transition rules, type policies, completion-source protections, manual-recovery guard, legacy status mapper, event construction, and side-effect metadata.

2. `lib/mentor/services/taskMutationService.js`
   - Guarded mutation service foundation.
   - Defines repository/idempotency/event contracts.
   - Includes in-memory repository and idempotency adapters for no-write tests.

3. `scripts/test-mentor-task-state-machine.js`
   - Phase 4 test harness with 45 assertions.

4. `docs/mentor-architecture/PHASE_4_TASK_STATE_MACHINE_IMPLEMENTATION_REPORT.md`
   - This report.

## 2. Files Modified

1. `lib/mentor/domain/enums.js`
   - Added canonical `draft` task status.
   - Added canonical task actions and task event types.

2. `lib/mentor/repository/mentorRepository.js`
   - Extended reserved write contract with guarded mutation methods.

3. `lib/mentor/repository/featureFlags.js`
   - Added `MENTOR_TASK_STATE_MACHINE_V2` and `MENTOR_TASK_MUTATIONS_V2`, both default false.

4. `pages/api/mentor/task-action.js`
   - Added default-off shadow validation hook.
   - Existing writes and responses remain unchanged while flags are false.

5. `package.json`
   - Added `test:mentor-state-machine`.

## 3. Current Mutation Entry-Point Audit

### `/api/mentor/task-action`

- Input: `taskId`, `planId`, `actionType`, `actionValue`, `subject`, `topic`.
- Current actions: `complete`, `snooze`, `response`, `launch_practice`.
- Current writes:
  - `updateMentorTaskStatus` for `complete`, `snooze`, `response`.
  - `upsertStudentTopicState` for `response` and `complete`.
  - `appendMentorTaskLog` for every accepted action.
- Duplicate risk:
  - duplicate complete/snooze/response can append duplicate logs.
  - snooze can increment more than once.
- Failure behavior:
  - mutation may succeed but snapshot build can fail; route returns success without snapshot.
  - write failure returns 500.

### `/api/mentor/quiz-return`

- Input: `taskId`, `planId`, `quizSessionId`, `subject`, `topic`, result counts.
- Current writes:
  - task status to `completed`.
  - `StudentTopicState` practice/confidence fields.
  - `MentorTaskLogs` with `return_from_quiz`.
- Duplicate risk:
  - repeated quiz return may append duplicate logs and rewrite completed status.
- Coins:
  - no Mentor coins are awarded here.

### `/api/mentor/refresh`

- Current behavior:
  - calls `loadOrCreateMentorSnapshot(...forceRefresh)`.
  - appends `refresh_plan` log.
- Risk:
  - current implementation can regenerate through existing legacy path.
  - Phase 1A says future refresh must become sync-only, but Phase 4 does not alter it.

### `/api/mentor/generate`

- Current behavior:
  - force-refresh plan generation.
  - `unlockNextDay` uses `revealCount=1`.
- Risk:
  - no new guarded mutation integration in Phase 4.

### Mentor page task actions

- `launchPractice` / repeated mistakes launch:
  - sends `launch_practice`, then routes quiz.
- theory/revision completion:
  - sends `complete`.
- confidence/coverage/feedback response:
  - sends `response`.
- Maybe Later:
  - sends `snooze`.
- Show Next Day:
  - calls `/api/mentor/generate`.

### Direct helpers

- `updateMentorTaskStatus`
  - direct row update by task id.
  - no canonical transition validation.
- `appendMentorTaskLog`
  - append-only legacy log write.

No current behavior was changed while Phase 4 flags are false.

## 4. Final Statuses

Canonical statuses implemented:

```text
draft
scheduled
active
in_progress
pending
blocked
completed
cancelled
expired
```

Compatibility:

```text
snoozed -> pending
```

Raw legacy status is preserved on task objects.

Terminal statuses:

```text
completed
cancelled
expired
```

## 5. Actions

Canonical actions implemented:

```text
SCHEDULE
ACTIVATE
START
POSTPONE
RESUME
COMPLETE
COMPLETE_MANUAL_RECOVERY
DEFER_CHECK
UNBLOCK
CANCEL
EXPIRE_INVALID
```

The transition engine does not accept arbitrary status overrides.

## 6. Transition Table

Implemented:

| Current | Action | Next |
|---|---|---|
| draft | SCHEDULE | scheduled |
| scheduled | ACTIVATE | active |
| active | START | in_progress |
| active | POSTPONE | pending |
| in_progress | POSTPONE | pending |
| pending | RESUME | active or in_progress |
| active | COMPLETE | completed |
| in_progress | COMPLETE | completed |
| pending | COMPLETE_MANUAL_RECOVERY | completed when verified |
| scheduled | DEFER_CHECK | scheduled with `nextEligibleAt` |
| blocked | UNBLOCK | scheduled or active |
| non-terminal | CANCEL | cancelled |
| non-terminal | EXPIRE_INVALID | expired |

Rejected:

- terminal task to non-terminal state
- pending -> POSTPONE duplicate state change
- direct status override
- unsupported task/action pair
- historical legacy-generation mutation
- stale status/plan/version/rowVersion
- unmet dependency
- unverified manual recovery

## 7. Task-Type Policies

Practice/revision/mistake-recovery/theory tasks:

- may start, postpone, resume, complete, cancel, expire.

Coverage/confidence checks:

- may complete through mentor response.
- may defer as `scheduled + nextEligibleAt`.
- must not enter pending backlog.

Feedback task:

- may complete through mentor response.
- may defer as scheduled.
- must not enter pending backlog.

Pace unlock:

- treated as an offer, not a normal backlog task.
- cannot become pending.

## 8. Mutation Guards

The guarded service requires:

- authenticated user identity
- active plan pointer
- task belongs to active plan
- task plan version matches active plan
- task is current generation
- task is not legacy hidden
- expected status matches when supplied
- expected rowVersion matches when supplied
- dependencies satisfied
- action allowed by type policy
- valid completion source

The browser cannot mutate a task merely by sending a `TaskId`.

## 9. Idempotency Design

Idempotency key format:

```text
mentor-task:<userScope>:<planId>:<taskId>:<action>:<clientOperationId>
```

Behavior:

- first valid request mutates once
- repeated identical request returns stored result
- same key with different payload is rejected
- duplicate postpone increments once
- duplicate completion appends one event
- duplicate completion does not award coins

Phase 4 includes an in-memory idempotency store for tests only.

## 10. Event Design

Successful transitions produce immutable event objects with:

```text
eventId
userScope
planId
taskId
type
fromStatus
toStatus
action
idempotencyKey
source
requestId
payload
createdAt
```

Event types implemented:

```text
task_scheduled
task_activated
task_started
task_postponed
task_resumed
task_completed
task_deferred
task_unblocked
task_cancelled
task_expired
manual_recovery
```

Rejected transitions do not emit successful task events.

## 11. Legacy Protection

The service and state machine reject:

- `isCurrentGeneration === false`
- `isLegacyHidden === true`
- hidden legacy snoozed tasks
- historical-generation tasks from the five-generation fixture

Completed historical evidence remains preserved and non-actionable.

## 12. Feature Flags

Added:

```text
MENTOR_TASK_STATE_MACHINE_V2=false
MENTOR_TASK_MUTATIONS_V2=false
```

Interaction with prior flags:

- `MENTOR_REPO_V2`: read repository flag, unchanged.
- `MENTOR_REPO_V2_SHADOW`: read-only repository shadow flag, unchanged.
- `MENTOR_CANONICAL_DAY_READ`: canonical day read flag, unchanged.
- `MENTOR_TASK_STATE_MACHINE_V2`: default-off shadow validation for task transitions.
- `MENTOR_TASK_MUTATIONS_V2`: reserved for future route-level mutation service adoption, remains false.

## 13. API Integration

`/api/mentor/task-action` includes only a default-off shadow validation hook:

- existing task-action writes remain user-facing
- new state machine evaluates the legacy action only when `MENTOR_TASK_STATE_MACHINE_V2=true`
- shadow log contains action/status/decision aggregates only
- no email, question text, or Mentor message is logged
- response is not altered

`MENTOR_TASK_MUTATIONS_V2` is defined but not enabled or used for production writes in Phase 4.

## 14. Test Results

Commands run:

```text
npm run test:mentor-state-machine
npm run test:mentor-repo
npm run test:mentor-plan-day
node scripts/test-mentor-api-optimization.js
npm run lint
npm run build
```

Results:

- Phase 4 state-machine tests: 45 passed, 0 failed.
- Phase 2 repository tests: 22 passed, 0 failed.
- Phase 3 plan-day tests: 25 passed, 0 failed.
- Existing Mentor optimization tests: 42 passed, 0 failed.
- Lint: passed with pre-existing warnings in `pages/onboarding-slides.js` and `pages/quiz-setup.js`.
- Production build: passed.

## 15. Build Result

`npm run build` completed successfully.

## 16. No-Write Confirmation

- No Google Sheet cell was written.
- No Sheet header was added or changed.
- No Sheet row was migrated.
- No task status was modified.
- No plan was generated.
- Tests used in-memory stores and fixtures only.

## 17. Known Limitations

- No Google Sheets mutation adapter is enabled in Phase 4.
- Google Sheets cannot provide full transaction semantics; future adapter must re-read, compare expected values, update specific row, re-read after write, then append event.
- Daily rollover is not implemented.
- Pending resurfacing and Previously Pending UI are not implemented.
- Update My Plan replacement is not implemented.
- Supabase is not implemented.

## 18. Rollback Method

Leave flags false:

```text
MENTOR_TASK_STATE_MACHINE_V2=false
MENTOR_TASK_MUTATIONS_V2=false
```

With flags false, the production task-action path remains unchanged.

No data migration occurred, so there is no data rollback.

## 19. Phase 5 Readiness

Ready.

Phase 5 can build on this mutation foundation for daily rollover and pending lifecycle, using the state machine and guarded service rather than direct ad hoc status writes.

