# Phase 1B.1 — Offline Workbook Verification

**Workbook inspected:** `SSC GK SCORE BOOSTER(3).xlsx`  
**Inspection type:** Offline, read-only workbook inspection  
**Google Sheet writes:** None  
**Source-code changes:** None  
**Personal identifiers:** Redacted in this document

---

## 1. Confirmed physical tabs

The workbook contains the expected Mentor-related tabs:

- `MentorProfile`
- `MentorPlans`
- `MentorTasks`
- `MentorTaskLogs`
- `StudentTopicState`
- `MasterTopics`

The workbook has 43 total worksheets.

---

## 2. Confirmed MentorProfile structure

The physical `MentorProfile` sheet contains the core 13 columns plus the 7 Mentor plan-state columns.

Physical headers:

1. Email
2. ExamTarget
3. DaysLeftRange
4. CustomDaysLeft
5. DailyGKTime
6. Pace
7. Goals
8. SubjectStatusJSON
9. TopicsCompletedJSON
10. OnboardingCompletedAt
11. LastUpdatedAt
12. OnboardingVersion
13. TopicStrengthJSON
14. MentorPlanId
15. ActiveDayNumber
16. ProgressPercent
17. LastPlanRefreshAt
18. PlanNeedsRebuild
19. MentorLastSyncAt
20. MentorCacheVersion

### Header-quality issue

Three headers contain trailing newline characters in the workbook:

- `MentorPlanId\n`
- `ProgressPercent\n`
- `LastPlanRefreshAt\n`

This is a compatibility risk if any code compares header names without trimming whitespace.

### Affected profile

The workbook has one populated MentorProfile row.

Confirmed values:

- Plan start/onboarding timestamp is populated.
- Active plan pointer is populated.
- Stored active day is `1`.
- Plan version/cache version is `v1`.
- Plan-needs-rebuild is false.

Therefore, onboarding date coverage for the current workbook is:

- Total populated Mentor profiles: 1
- Valid onboarding timestamp: 1
- Missing: 0
- Malformed: 0

This does not prove coverage for users not present in this export.

---

## 3. Confirmed 15-task root cause

The previously suspected cause is fully confirmed from the workbook.

### MentorPlans evidence

There are 5 plan rows.

All 5 rows use the exact same PlanId.

Their creation timestamps form 5 distinct generation batches:

1. 2026-06-08T12:13:30.089Z
2. 2026-06-08T12:19:16.660Z
3. 2026-06-08T14:01:19.707Z
4. 2026-06-08T14:01:20.314Z
5. 2026-06-08T14:01:22.132Z

Status distribution:

- 4 invalid plan rows
- 1 active plan row

All rows use `Version = v1`.

### MentorTasks evidence

There are exactly 15 task rows.

All 15 tasks use the same PlanId.

Each generation batch appended exactly 3 tasks:

- Batch 1: 3 tasks
- Batch 2: 3 tasks
- Batch 3: 3 tasks
- Batch 4: 3 tasks
- Batch 5: 3 tasks

Therefore:

> 5 task-generation runs × 3 tasks per generation = 15 stored tasks.

The reader can return all 15 because the tasks cannot be distinguished by generation when they share the same PlanId.

### Confirmed root cause

The root cause is:

1. The plan generator reuses the existing `MentorPlanId`.
2. Every generation appends a new `MentorPlans` row.
3. Every generation appends 3 new `MentorTasks` rows.
4. Old task rows are not removed or assigned a generation identifier.
5. The task reader fetches all tasks sharing the reused PlanId.

This is a server/data-model problem, not only a client-cache problem.

---

## 4. Duplicate numbering confirmed

Every task-generation batch restarts `SequenceNumber` from:

- 1
- 2
- 3

Across the same PlanId, the workbook therefore contains:

- five Task 1 rows
- five Task 2 rows
- five Task 3 rows

This confirms that `SequenceNumber` cannot serve as a stable plan-wide user-facing task number.

A separate persisted `TaskNumber` and a plan-level `nextTaskNumber` allocator are required.

---

## 5. Task-status evidence

Across 15 tasks:

- Completed: 5
- Snoozed: 10
- Active: 0
- Pending: 0
- Blocked: 0
- Expired: 0

This exactly explains the visible summary:

- 5 completed
- 10 locked/later
- 0 active

The current screen is aggregating tasks from all five generation batches.

### Additional observation

Multiple logically identical tasks exist across generations, including repeated tasks for:

- repeated mistakes
- Polity — Amendments
- Polity — Fundamental Rights and Duties

These are separate TaskIds but represent the same logical task themes.

---

## 6. MentorTaskLogs evidence

There are 29 task-log rows:

- 13 snooze events
- 10 launch-practice events
- 5 return-from-quiz events
- 1 refresh-plan event

There are no task-generation events in the log.

Therefore, logs alone cannot reconstruct all five generation batches.

The five creation batches are visible only from `MentorPlans.CreatedAt` and `MentorTasks.CreatedAt`.

---

## 7. QuestionCount issue confirmed

The physical `MentorTasks` sheet does not contain a `QuestionCount` column.

Therefore, any code that attempts to write or reduce `QuestionCount` through header lookup cannot persist that value in this workbook.

This confirms the dead/no-op `QuestionCount` path identified in the code audit.

---

## 8. Plan-day bug confirmed

The profile and active plan both store `ActiveDayNumber = 1`.

The onboarding/plan creation date is populated on 8 June 2026.

Because the current implementation reuses the stored day rather than recalculating the calendar day on each read, the interface remains on Day 1.

The workbook confirms that this is not caused by a missing start date.

The corrected architecture should compute calendar day server-side from:

- stored local plan-start date
- stored timezone
- authoritative server time

Incomplete tasks must move to the pending backlog rather than freezing the day.

---

## 9. StudentTopicState findings

The workbook contains 4 StudentTopicState rows.

The populated rows are usable as long-term learning evidence.

No plan replacement should delete these rows.

Observed topic-state records include:

- repeated-mistake learning evidence
- Polity topic practice/confidence evidence

This supports the architecture rule:

> tasks are replaceable, but learning state survives plan replacement.

---

## 10. Header compatibility conclusion

### Confirmed compatible

The expected Mentor tabs and most expected columns physically exist.

### Confirmed issues

1. Three MentorProfile headers contain trailing newline characters.
2. MentorProfile core fields are positional, which remains fragile.
3. `QuestionCount` is absent.
4. `PlanVersion` does not exist; only constant `Version = v1`.
5. Stable `TaskNumber` does not exist.
6. Generation identity/task-set revision does not exist.
7. All generations reuse the same PlanId.

---

## 11. Phase 2 readiness

### Domain design

Ready.

### Direct Google Sheets repository implementation

Do not begin the full repository abstraction without first defining a non-destructive compatibility/repair strategy for the existing rows.

A small Phase 1C is recommended before Phase 2 coding.

Phase 1C should define:

1. how existing five plan rows are interpreted;
2. how current active generation is selected;
3. how old-generation tasks are archived/cancelled without deletion;
4. how TaskNumber is backfilled;
5. how header whitespace is handled safely;
6. whether to add a generation/task-set identifier before repository coding;
7. how existing completed evidence is preserved;
8. how current snoozed tasks are migrated into the new pending model;
9. how the active plan remains usable during transition;
10. rollback and verification steps.

---

## Final conclusion

The workbook fully confirms the 15-task mechanism:

> The same PlanId was reused across five plan generations, and each generation appended three tasks. The current task reader can therefore aggregate all 15 rows.

This is no longer an unresolved hypothesis.

The next correct step is a **Phase 1C non-destructive legacy-data compatibility and repair plan**, followed by Phase 2 repository abstraction.
