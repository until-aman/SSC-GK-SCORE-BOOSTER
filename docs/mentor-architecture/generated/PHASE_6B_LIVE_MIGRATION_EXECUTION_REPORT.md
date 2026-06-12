# Phase 6B Live Migration Execution Report

Status: completed
Manifest hash: b31fe07b8f20107526281c2e00378dd0d1495ecaa7b56cbf6ec3412a62556fcc
Backup note hash: 1c454c0f8e8a9278
Applied at: 2026-06-11T01:49:04.128Z
Mentor V2 flags enabled: None (all false)

## Tabs created: 2
- MentorMutationRequests
- MentorSchema
## Columns added
- MentorProfile: ActivePlanVersion, Timezone, SnapshotRevision, PlanStartLocalDate, LastProcessedCalendarDay, UnlockedDay
- MentorPlans: PlanVersion, GenerationId, TaskSetRevision, NextTaskNumber, Timezone, PlanStartLocalDate, TotalPlanDays, UnlockedDay, LastProcessedCalendarDay, LastDailyRolloverAt, FeaturedPendingTaskId, FeaturedPendingForCalendarDay, GenerationStatus, RowVersion, SupersededByPlanId, SupersededAt
- MentorTasks: PlanVersion, GenerationId, TaskNumber, QuestionCount, OriginalScheduledDay, ScheduledLocalDate, PendingReason, MovedToPendingAt, NextEligibleAt, NextEligibleResurfaceAt, ResurfacedCount, LastResurfacedAt, CompletionSource, LinkedQuizSessionId, ParentTaskId, RelatedTaskId, TriggerReason, CancellationReason, RowVersion
- MentorTaskLogs: EventId, FromStatus, ToStatus, CanonicalAction, IdempotencyKey, RequestId, EventPayloadJSON
## Rows backfilled: 20
## Batch verification
- CREATE_TABS: OK (verified)
- APPEND_COLUMNS: OK (verified)
- BACKFILL_ROWS: OK (verified)
- SCHEMA_MARKER: OK (verified) — marker
## No-op items
- None
## Warnings
- None
## Errors
- None
## Final schema marker: present
## Final row counts
- MentorProfile: 2
- MentorPlans: 5
- MentorTasks: 15
- MentorTaskLogs: 29
- StudentTopicState: 4
- MentorMutationRequests: 0
- MentorSchema: 1
## Final header fingerprints
- MentorProfile: 933fa18b5ed3…
- MentorPlans: 289a580c1fae…
- MentorTasks: 86ab1f515aad…
- MentorTaskLogs: 76d644622abc…
- StudentTopicState: 85e28aab42bb…
- MentorMutationRequests: 4e23c9c0b63c…
- MentorSchema: cb7a6c4b40ab…

