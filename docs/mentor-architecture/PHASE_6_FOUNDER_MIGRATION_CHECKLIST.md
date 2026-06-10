# Phase 6 Founder Migration Checklist

This checklist is for a future approved migration window. Do not run the apply step now.

## Important Rule

Do not make the column changes manually unless the automated migration is unavailable and a separate manual template has been approved.

## Before Migration

1. Download a fresh `.xlsx` backup of the Google Sheet.
2. Record the backup filename and exact download time.
3. Record original row counts for:
   - `MentorProfile`
   - `MentorPlans`
   - `MentorTasks`
   - `MentorTaskLogs`
   - `StudentTopicState`
4. Make sure no one edits the Sheet during the migration window.
5. Keep all Mentor v2 mutation flags false.

## Dry Run

1. Run:

```text
npm run mentor:sheets-migration:dry-run
```

2. Review:
   - `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json`
   - `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.md`
3. Confirm:
   - no blocking errors
   - no ambiguous normalized headers
   - expected additive columns only
   - row counts match the backup
   - proposed generation mapping is correct
   - proposed task numbers are deterministic
   - manifest hash is present
4. Share the dry-run report for approval.

## Apply Step

Run apply only after approval:

```text
CONFIRM_MENTOR_SHEET_MIGRATION=YES \
MENTOR_BACKUP_CONFIRMED=YES \
MENTOR_MIGRATION_MANIFEST=docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json \
npm run mentor:sheets-migration:apply
```

The apply command must:

- recheck header fingerprints
- recheck row counts
- abort if the Sheet changed after dry run
- add columns only
- avoid deletes, renames, and reordering
- verify every batch after writing in the future live-writer phase

Phase 6 apply tooling currently performs validation/planning only and does not write the live Google Sheet.

## After Apply

1. Verify row counts and columns.
2. Save the execution report.
3. Keep all Mentor v2 mutation flags false.
4. Upload/share the execution report for review.
5. Do not enable:
   - `MENTOR_SHEETS_MUTATIONS_V2`
   - `MENTOR_MUTATION_IDEMPOTENCY_V2`
   - `MENTOR_TASK_MUTATIONS_V2`
   - `MENTOR_DAILY_ROLLOVER_V2`
   - `MENTOR_PENDING_LIFECYCLE_V2`

## Rollback Reminder

Google Sheets does not provide a true transaction across task updates, plan updates, logs, and idempotency records. The fresh `.xlsx` backup is the restore point if a future live migration is approved and then fails.
