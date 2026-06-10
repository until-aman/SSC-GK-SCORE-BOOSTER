# Phase 6 - Sheets Schema and Persistence Tooling Report

**Project:** SSC Mentor / SSC GK Score Booster  
**Active app folder:** `festive-engelbart-5368c8`  
**Scope:** Additive Google Sheets schema definition, dry-run/apply tooling, guarded fake-Sheets persistence adapter, founder checklist, tests.  
**Date:** 2026-06-10

---

## 1. Files Created

1. `lib/mentor/repository/sheetsSchema.js`
2. `lib/mentor/repository/sheetsMigration.js`
3. `lib/mentor/repository/sheetsMutationAdapter.js`
4. `scripts/mentor-sheets-migration.js`
5. `scripts/test-mentor-sheets-migration.js`
6. `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json`
7. `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.md`
8. `docs/mentor-architecture/PHASE_6_SHEETS_SCHEMA_AND_PERSISTENCE_REPORT.md`
9. `docs/mentor-architecture/PHASE_6_FOUNDER_MIGRATION_CHECKLIST.md`

## 2. Files Modified

1. `lib/mentor/repository/featureFlags.js`
   - Added Phase 6 flags, all default false.

2. `package.json`
   - Added Phase 6 test and migration scripts.

3. `scripts/fixtures/mentor-legacy-fixture.js`
   - Fixture builder now clones header arrays so mutation tests cannot contaminate later tests.

## 3. Final Additive Schema

The schema is defined in `lib/mentor/repository/sheetsSchema.js`.

### `MentorProfile`

Required before mutation activation:

```text
ActivePlanVersion
Timezone
SnapshotRevision
```

Optional compatibility fields:

```text
PlanStartLocalDate
LastProcessedCalendarDay
UnlockedDay
```

### `MentorPlans`

Required before mutation activation:

```text
PlanVersion
GenerationId
TaskSetRevision
NextTaskNumber
Timezone
PlanStartLocalDate
TotalPlanDays
UnlockedDay
LastProcessedCalendarDay
LastDailyRolloverAt
FeaturedPendingTaskId
FeaturedPendingForCalendarDay
GenerationStatus
RowVersion
```

Optional compatibility fields:

```text
SupersededByPlanId
SupersededAt
```

### `MentorTasks`

Required before mutation activation:

```text
PlanVersion
GenerationId
TaskNumber
QuestionCount
OriginalScheduledDay
ScheduledLocalDate
PendingReason
MovedToPendingAt
NextEligibleAt
NextEligibleResurfaceAt
ResurfacedCount
LastResurfacedAt
CompletionSource
LinkedQuizSessionId
ParentTaskId
RelatedTaskId
TriggerReason
CancellationReason
RowVersion
```

Existing columns such as `Status`, `SnoozeCount`, `CompletedAt`, and `UpdatedAt` are not duplicated.

### `MentorTaskLogs`

Required before mutation activation:

```text
EventId
FromStatus
ToStatus
CanonicalAction
IdempotencyKey
RequestId
EventPayloadJSON
```

Existing legacy log fields remain intact.

### `MentorMutationRequests`

New idempotency tab:

```text
IdempotencyKey
UserScopeHash
PlanId
TaskId
Action
PayloadHash
Status
ResultJSON
CreatedAt
CompletedAt
ExpiresAt
```

Plain email is not required; `UserScopeHash` is used.

### `MentorSchema`

Schema marker tab:

```text
SchemaName
SchemaVersion
AppliedAt
ManifestHash
```

Expected marker:

```text
mentor | 2 | <AppliedAt> | <ManifestHash>
```

## 4. Required / Optional / Deferred Fields

Required fields are only those needed for:

- current-plan isolation
- generation isolation
- stable task numbering
- canonical pending state
- daily rollover
- featured pending state
- row-version checks
- idempotency
- completion source
- immutable event history

Optional fields are compatibility mirrors only.

Deferred until Supabase:

- true cross-row transactions
- partial unique active-plan constraints
- transactional task-number reservation
- durable event/idempotency guarantees equivalent to Postgres

## 5. Migration Tooling

Command:

```text
npm run mentor:sheets-migration:dry-run
```

Script:

```text
scripts/mentor-sheets-migration.js
```

Dry-run behavior:

- reads tab headers and rows
- normalizes headers
- detects missing additive columns
- detects ambiguous duplicate-normalized headers
- records row counts and header fingerprints
- proposes generation mapping
- proposes task numbers 1-15 for the verified fixture pattern
- proposes `NextTaskNumber = 16`
- writes generated reports only
- performs no Sheet writes

Generated:

```text
docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json
docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.md
```

The generated report in this phase was produced from the redacted verified fixture path, not from a live Sheet.

## 6. Manifest Safeguards

The manifest contains:

- workbook identifier hash
- inspection timestamp
- tab names
- original header fingerprints
- original row counts
- columns to add
- rows to backfill
- proposed generation mapping
- proposed task-number mapping
- warnings
- blocking errors
- manifest hash

Apply preconditions:

- `CONFIRM_MENTOR_SHEET_MIGRATION=YES`
- `MENTOR_BACKUP_CONFIRMED=YES`
- valid manifest hash
- unchanged header fingerprints
- unchanged row counts
- no blocking schema errors

## 7. Backup Requirements

Before any future live apply:

1. founder downloads a fresh `.xlsx` backup
2. backup filename and timestamp are recorded
3. original row counts are recorded
4. Sheet editing is frozen during migration
5. apply command requires `MENTOR_BACKUP_CONFIRMED=YES`

Google Sheets writes are not transactional. The backup is the rollback anchor.

## 8. Legacy Backfill Rules

Locked from Phase 1C:

- derive generations from `MentorPlans.CreatedAt`
- keep all five generation batches
- latest active batch is current generation
- preserve all historical rows
- assign plan-wide `TaskNumber` 1-15 deterministically
- preserve `SequenceNumber`
- set `NextTaskNumber = 16`
- parse legacy `Version='v1'` as `PlanVersion=1`
- initialize `RowVersion = 1`
- preserve completed evidence
- keep 10 legacy snoozed rows historical/hidden
- do not put legacy snoozed rows into canonical pending backlog
- do not hardcode 5 or 15 in code; derive from data

## 9. Mutation Adapter

Implemented:

```text
lib/mentor/repository/sheetsMutationAdapter.js
```

Functions:

```text
getActivePlanPointer
getTaskForMutation
compareAndUpdateTask
appendTaskEvent
getIdempotencyResult
saveIdempotencyResult
reserveTaskNumbers
updatePlanRolloverState
updateFeaturedPendingSelection
assertSchemaReady
```

The adapter:

- uses normalized headers
- resolves exact rows by `TaskId` and `PlanId`
- rejects duplicate matching task rows
- compares plan/status/rowVersion before update
- updates intended cells only
- increments `RowVersion`
- appends events after successful update
- enforces the schema marker
- is tested with fake workbook data only

No live route uses this adapter yet.

## 10. Idempotency Persistence

`MentorMutationRequests` stores:

- idempotency key
- user scope hash
- plan/task/action
- payload hash
- status
- result JSON
- timestamps

States supported:

```text
started
task_updated
event_appended
completed
failed
```

Rules:

- same key + same payload returns the stored result
- same key + different payload rejects
- interrupted states can be inspected/reconciled
- duplicate completion/postpone cannot repeat through the same key

## 11. Task-Number Reservation

Implemented:

```text
reserveTaskNumbers({ planId, count, expectedRowVersion })
```

Behavior:

- reads `NextTaskNumber`
- verifies plan `RowVersion`
- reserves a contiguous range
- increments `NextTaskNumber`
- increments plan `RowVersion`
- does not use `max(TaskNumber)+1`

Idempotent duplicate reservation is supported through `MentorMutationRequests`.

## 12. Rollover Persistence

Adapter supports:

- task movement fields: `PendingReason`, `MovedToPendingAt`, `NextEligibleResurfaceAt`
- quick-check deferral field: `NextEligibleAt`
- plan rollover fields: `LastProcessedCalendarDay`, `LastDailyRolloverAt`
- featured pending fields: `FeaturedPendingTaskId`, `FeaturedPendingForCalendarDay`
- event appends
- idempotency records

This is not activated in live APIs.

## 13. Schema Marker

Defined marker:

```text
MentorSchema
SchemaName | SchemaVersion | AppliedAt | ManifestHash
mentor     | 2             | ...       | ...
```

The mutation adapter refuses to run if required columns or the marker are missing.

## 14. Feature Flags

Added:

```text
MENTOR_SHEETS_SCHEMA_V2=false
MENTOR_SHEETS_MUTATIONS_V2=false
MENTOR_MUTATION_IDEMPOTENCY_V2=false
```

All are server-side flags and default false.

Mutation activation must additionally require:

- schema marker present
- required columns present
- no ambiguous headers
- migration manifest applied
- idempotency store available
- prior repo/state-machine/rollover flags enabled in the required order

## 15. Tests

Command:

```text
npm run test:mentor-sheets
```

Result:

```text
36/36 Mentor Sheets migration tests passed.
```

Covered:

- missing columns detection
- no-write dry run
- ambiguous headers
- stale manifest
- changed row counts
- confirmation and backup gates
- additive columns only
- no-op rerun
- deterministic generation IDs
- deterministic task numbers
- `NextTaskNumber = 16`
- `SequenceNumber` preserved
- completed/snoozed evidence preserved
- row-version backfill
- `v1 -> PlanVersion 1`
- exact-row compare-and-update
- stale status and rowVersion rejection
- duplicate task row rejection
- idempotency persistence
- event append
- interrupted mutation state
- contiguous reservation
- rollover and featured pending persistence
- schema marker enforcement
- flags default false
- no plain email in manifest
- manifest hash integrity

## 16. Build

Commands run:

```text
npm run test:mentor-sheets
npm run mentor:sheets-migration:dry-run
npm run test:mentor-rollover
npm run test:mentor-state-machine
npm run test:mentor-plan-day
npm run test:mentor-repo
node scripts/test-mentor-api-optimization.js
npm run lint
npm run build
```

Results:

- Phase 6 Sheets tests: 36 passed, 0 failed.
- Phase 5 rollover tests: 55 passed, 0 failed.
- Phase 4 state-machine tests: 45 passed, 0 failed.
- Phase 3 plan-day tests: 25 passed, 0 failed.
- Phase 2 repository tests: 22 passed, 0 failed.
- Existing Mentor optimization tests: 42 passed, 0 failed.
- Lint: passed with pre-existing warnings in `pages/onboarding-slides.js` and `pages/quiz-setup.js`.
- Production build: passed.

## 17. No-Write Confirmation

- No live Google Sheet was modified.
- No live Sheet tab was created.
- No live Sheet column was added.
- No live Sheet row was changed.
- No migration apply command was executed against live data.
- Phase 6 tests used fake workbook data.
- The generated dry-run artifacts used a redacted fixture path.

## 18. Known Limitations

- Phase 6 apply tooling validates/plans but does not perform live Sheet writes.
- Google Sheets cannot guarantee a true transaction across task row update, plan row update, event append, and idempotency record write.
- Live schema inspection still requires credentials/runtime context.
- No live migration was run.
- Live API writes still use existing legacy paths while flags are false.
- Pending UI and Update My Plan replacement are not implemented.
- Supabase is not implemented.

## 19. Rollback

Keep flags false:

```text
MENTOR_SHEETS_SCHEMA_V2=false
MENTOR_SHEETS_MUTATIONS_V2=false
MENTOR_MUTATION_IDEMPOTENCY_V2=false
```

Since no live migration ran, there is no data rollback.

For a future live migration, rollback requires restoring the founder-downloaded `.xlsx` backup because Sheets writes are not transactional.

## 20. Exact Next Step

Do not enable writes yet.

Next approved step should be:

1. run live dry-run only
2. review generated manifest
3. confirm backup
4. approve or reject live additive migration
5. keep mutation flags false until the applied schema marker and adapter readiness are verified
