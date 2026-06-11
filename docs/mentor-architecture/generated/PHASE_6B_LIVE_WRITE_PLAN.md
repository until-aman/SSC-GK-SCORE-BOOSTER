# Phase 6B Live Write Plan (preview — not executed)

Schema version: mentor-sheets-v2
Manifest hash: b31fe07b8f20107526281c2e00378dd0d1495ecaa7b56cbf6ec3412a62556fcc
Workbook id hash: b5dbd520776c48ff
Generated at: 2026-06-11T01:49:04.128Z

## Batch order
1. CREATE_TABS
2. APPEND_COLUMNS
3. BACKFILL_ROWS
4. SCHEMA_MARKER

## Tabs to create
- MentorMutationRequests (11 columns)
- MentorSchema (4 columns)

## Columns to append (additive)
- MentorProfile: ActivePlanVersion, Timezone, SnapshotRevision, PlanStartLocalDate, LastProcessedCalendarDay, UnlockedDay
- MentorPlans: PlanVersion, GenerationId, TaskSetRevision, NextTaskNumber, Timezone, PlanStartLocalDate, TotalPlanDays, UnlockedDay, LastProcessedCalendarDay, LastDailyRolloverAt, FeaturedPendingTaskId, FeaturedPendingForCalendarDay, GenerationStatus, RowVersion, SupersededByPlanId, SupersededAt
- MentorTasks: PlanVersion, GenerationId, TaskNumber, QuestionCount, OriginalScheduledDay, ScheduledLocalDate, PendingReason, MovedToPendingAt, NextEligibleAt, NextEligibleResurfaceAt, ResurfacedCount, LastResurfacedAt, CompletionSource, LinkedQuizSessionId, ParentTaskId, RelatedTaskId, TriggerReason, CancellationReason, RowVersion
- MentorTaskLogs: EventId, FromStatus, ToStatus, CanonicalAction, IdempotencyKey, RequestId, EventPayloadJSON

## Backfill
- Rows to backfill: 20
- Plan rows matched by CreatedAt; task rows matched by TaskId.
- Each additive cell expected old value: `blank_or_absent` (never overwrites existing legacy data).

## Schema marker (written last)
- MentorSchema: mentor | 2 | <appliedAt> | b31fe07b8f20107526281c2e00378dd0d1495ecaa7b56cbf6ec3412a62556fcc

## Verifications
- tab_exists_with_headers (MentorMutationRequests)
- tab_exists_with_headers (MentorSchema)
- required_columns_present (MentorProfile)
- required_columns_present (MentorPlans)
- required_columns_present (MentorTasks)
- required_columns_present (MentorTaskLogs)
- backfill_cells_match
- schema_marker_present (MentorSchema)

## Rollback notes
- Google Sheets writes are not transactional.
- Rollback = restore the founder-downloaded .xlsx backup recorded in MENTOR_BACKUP_NOTE.
- All operations are additive (create tab / append column / fill blank cell); existing legacy data is never deleted, reordered, renamed, or overwritten.
- On any batch verification failure the writer stops before later batches and emits a failure report.

