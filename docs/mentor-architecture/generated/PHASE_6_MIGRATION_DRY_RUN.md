# Phase 6 Migration Dry Run

Schema version: mentor-sheets-v2
Inspection timestamp: 2026-06-10T15:58:51.747Z
Workbook id hash: c71b314c3ed08712
Manifest hash: 521ca1e2c39cc76c4ee38880d84b8cbbb6bc52a8046068c1738b3068689a72b6

## Columns To Add
- MentorProfile: ActivePlanVersion, Timezone, SnapshotRevision, PlanStartLocalDate, LastProcessedCalendarDay, UnlockedDay
- MentorPlans: PlanVersion, GenerationId, TaskSetRevision, NextTaskNumber, Timezone, PlanStartLocalDate, TotalPlanDays, UnlockedDay, LastProcessedCalendarDay, LastDailyRolloverAt, FeaturedPendingTaskId, FeaturedPendingForCalendarDay, GenerationStatus, RowVersion, SupersededByPlanId, SupersededAt
- MentorTasks: PlanVersion, GenerationId, TaskNumber, QuestionCount, OriginalScheduledDay, ScheduledLocalDate, PendingReason, MovedToPendingAt, NextEligibleAt, NextEligibleResurfaceAt, ResurfacedCount, LastResurfacedAt, CompletionSource, LinkedQuizSessionId, ParentTaskId, RelatedTaskId, TriggerReason, CancellationReason, RowVersion
- MentorTaskLogs: EventId, FromStatus, ToStatus, CanonicalAction, IdempotencyKey, RequestId, EventPayloadJSON
- StudentTopicState: None
- MentorMutationRequests: IdempotencyKey, UserScopeHash, PlanId, TaskId, Action, PayloadHash, Status, ResultJSON, CreatedAt, CompletedAt, ExpiresAt
- MentorSchema: SchemaName, SchemaVersion, AppliedAt, ManifestHash

## Row Counts
- MentorProfile: 1
- MentorPlans: 5
- MentorTasks: 15
- MentorTaskLogs: 0
- StudentTopicState: 4
- MentorMutationRequests: 0
- MentorSchema: 0

## Backfill Summary
- MentorPlans rows to backfill: 1
- MentorTasks rows to backfill: 15
- Proposed next task number: 16

## Blocking Errors
- None

## Warnings
- None
