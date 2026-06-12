# Phase 6B — Live Google Sheet Migration Writer (Implemented, Not Executed) Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Implement the real additive-migration **writer** behind hard gates, with a deterministic write plan, per-batch verification, no-op rerun, partial-failure detection, and an execution report. **The writer was NOT executed against the live Sheet.**
**Date:** 2026-06-11

```text
Live writer implemented: Yes
Live writer executed against the live Sheet: No
Live Google Sheet writes performed: None
Physical Sheet changed: No
Mentor V2 flags enabled: None
```

---

## 1. Files created (5)

| File | Purpose |
|---|---|
| `lib/mentor/repository/sheetsMigrationWriter.js` | The live writer: gates, manifest-lock, deterministic backfill, write-plan, gateway-driven batch execution with per-batch verification, no-op/partial detection, report builders, **fake gateway** (tests) + **real Google Sheets gateway** (wired but unexecuted). |
| `scripts/test-mentor-sheets-writer.js` | 23 fake-live writer tests (no live Sheet touched; artifacts written to a throwaway temp dir). |
| `docs/mentor-architecture/generated/PHASE_6B_LIVE_WRITE_PLAN.json` | Live write plan (generated from a **read-only** live read + the approved manifest). |
| `docs/mentor-architecture/generated/PHASE_6B_LIVE_WRITE_PLAN.md` | Human-readable live write plan. |
| `docs/mentor-architecture/PHASE_6B_LIVE_MIGRATION_WRITER_REPORT.md` | This report. |

> The execution-report files (`PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.json/.md`) are **only** produced when the gated live apply actually runs. They are intentionally absent now because apply was not executed.

## 2. Files modified (2)

| File | Change |
|---|---|
| `scripts/mentor-sheets-migration.js` | Added `--plan` mode (read-only write-plan generation) and replaced the old "dry-apply only" `apply()` with a fully-gated path that requires `MENTOR_LIVE_WRITER_CONFIRMED=YES` before constructing the real gateway + calling `executeMigration`. Without the gate it prints `LIVE_WRITER_NOT_CONFIRMED` and exits before any write. |
| `package.json` | Added `test:mentor-sheets-writer` and `mentor:sheets-migration:write-plan`. |

## 3. Writer safety gates (Step 2 + 4)

Live writes stay blocked unless **all** of these are present (any shorter command cannot write):

```text
CONFIRM_MENTOR_SHEET_MIGRATION=YES
MENTOR_BACKUP_CONFIRMED=YES
MENTOR_MIGRATION_MANIFEST=docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json
MENTOR_LIVE_WRITER_CONFIRMED=YES
MENTOR_BACKUP_NOTE="<founder backup filename/timestamp>"
npm run mentor:sheets-migration:apply
```

`verifyWriterGates()` returns a typed code and performs **zero** writes when any gate is missing: `CONFIRMATION_REQUIRED`, `BACKUP_CONFIRMATION_REQUIRED`, `LIVE_WRITER_NOT_CONFIRMED`, `MANIFEST_PATH_REQUIRED`, `BACKUP_NOTE_REQUIRED`. The backup note is **hashed** (`backupNoteHash`), never stored or printed raw.

## 4. Manifest-lock verification (Step 3)

Before any write, `verifyManifestLock()` re-reads the live Sheet (via the gateway) and aborts unless:
- manifest hash recomputes to the stored value (`MANIFEST_HASH_INVALID` otherwise),
- schema version is `mentor-sheets-v2` (`SCHEMA_VERSION_MISMATCH`),
- manifest is **not** a fixture manifest — `workbookIdHash !== hash('fixture-workbook')` (`FIXTURE_MANIFEST_REJECTED`),
- no blocking errors in the manifest (`BLOCKING_SCHEMA_ERRORS`),
- every tab's header fingerprint **and** row count still match the manifest (`STALE_MANIFEST` + `staleTabs`),
- all required core tabs still exist (`REQUIRED_TAB_MISSING`),
- no ambiguous normalized headers have appeared (`AMBIGUOUS_HEADERS_APPEARED`).

## 5. Backup gate (Step 4)

`MENTOR_BACKUP_CONFIRMED=YES` **and** a non-empty `MENTOR_BACKUP_NOTE` are both required; the note (founder-recorded backup filename/timestamp) is hashed into the execution report for audit without exposing the raw value.

## 6. Write-plan generation (Step 5)

`buildWritePlan({ manifest, computed })` produces a deterministic plan with: batch order, tabs to create, columns to append per tab, backfill row ops (match key, columns, `expectedOld = blank_or_absent`, new values), verification list, schema marker, and rollback notes. It is written **before** any write to:

```text
docs/mentor-architecture/generated/PHASE_6B_LIVE_WRITE_PLAN.json
docs/mentor-architecture/generated/PHASE_6B_LIVE_WRITE_PLAN.md
```

The committed live plan (from a read-only live read) shows: 2 tabs to create (`MentorMutationRequests`, `MentorSchema`), columns to append (Profile 6, Plans 16, Tasks 19, Logs 7), and **20 backfill rows** (5 plan rows + 15 task rows under live PlanId `MP_1780920810055`). No emails/secrets/question content.

## 7. Batch execution design (Step 6)

Four ordered batches, each executed through a small **Gateway** abstraction (`listTitles`, `readTab`, `createTab`, `setHeaders`, `setRowCells`, `appendRow`):
1. **CREATE_TABS** — create only missing `MentorMutationRequests` / `MentorSchema`, set their headers.
2. **APPEND_COLUMNS** — append missing additive columns to Profile/Plans/Tasks/Logs (append only).
3. **BACKFILL_ROWS** — fill blank additive cells: `PlanVersion`, `GenerationId`, `TaskSetRevision`, `NextTaskNumber`, `Timezone`, `PlanStartLocalDate`, `TotalPlanDays`, `UnlockedDay`, `LastProcessedCalendarDay`, `GenerationStatus`, `RowVersion` (plan rows); `PlanVersion`, `GenerationId`, `TaskNumber`, `QuestionCount` (only where type-derivable), `OriginalScheduledDay`, `ScheduledLocalDate`, `RowVersion` (task rows). `CompletionSource` left blank (not safely inferable for legacy rows → no fabrication).
4. **SCHEMA_MARKER** — append `mentor | 2 | <appliedAt> | <manifestHash>` to `MentorSchema` **last**.

`setRowCells` never overwrites an existing non-blank legacy cell (additive guarantee). Backfill values are recomputed from the live data under the manifest-lock at execution time, not from possibly-stale precomputed values, and counts (`5`/`15`) are derived from data, never hardcoded.

## 8. Post-write verification (Step 6)

After **every** batch the writer re-reads via the gateway and verifies: new tabs have required headers; original physical headers remain an exact prefix (no reorder/rename) and no ambiguous header was introduced and required columns are present; every task row has non-blank `TaskNumber` + `GenerationId`; schema marker present. On any failure it **stops immediately**, does not run later batches, and emits a `failed` execution report stating that rollback = restoring the `.xlsx` backup.

## 9. No-op rerun behaviour (Step 8)

`assessExistingState()` detects: required additive columns present per tab, both new tabs present, schema marker (`mentor`/`2`) present, and task backfill complete. If all true → **no-op** (zero gateway ops, no-op report). Existing columns/tabs are never duplicated; matching backfills are not rewritten.

## 10. Partial-failure handling (Step 9)

If state is neither "none applied" nor "fully applied", the writer treats it as **partial** and refuses to blindly continue: it returns `PARTIAL_MIGRATION_DETECTED` with `recoveryInstructions` (e.g., marker present but backfill incomplete; columns/tabs added but marker missing) and requires `MENTOR_RECOVERY_CONFIRMED=YES` to proceed. **No automatic destructive rollback** is performed — recovery always references restoring the founder `.xlsx` backup.

## 11. Execution report format (Step 10)

When apply eventually runs, `executeMigration` writes:

```text
docs/mentor-architecture/generated/PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.json
docs/mentor-architecture/generated/PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.md
```

including: status, manifest hash, **backup note hash** (not raw), applied timestamp, tabs created, columns added, rows backfilled, per-batch verification results, no-op items, warnings, errors, final schema marker state, final row counts, final header fingerprints, and `flagsRemainFalse` confirmation. No emails/secrets/question content are written (verified by test 23).

## 12. Tests (Step 11)

`scripts/test-mentor-sheets-writer.js` — **23 fake-live tests, all passing**, covering all 26 required areas: gate blocks (live-writer / backup / backup-note / fixture-manifest), manifest-lock (stale rows, stale fingerprint, ambiguous header), write-plan generation, additive tab creation, additive column append, no duplicate columns / prefix preserved, deterministic backfill (TaskNumber 1–15), QuestionCount not fabricated, completed rows preserved, snoozed rows remain historical/hidden (no `PendingReason`), StudentTopicState unchanged, schema marker written last, verification after every batch, partial-failure stop, no-op rerun, existing-marker verification, execution report generation, and no plain emails/secrets in artifacts. Tests write artifacts to an OS temp dir so they never clobber the live `generated/` files.

Earlier suites (Step 11 #24–25) re-run green: repository 22, plan-day 25, task-state-machine 45, daily-rollover 55, sheets-migration 36, mentor-optimization 42 — **all 0 failed**.

## 13. Build (Step 11 #26)

- `npx next lint` → only the two pre-existing warnings (`onboarding-slides.js`, `quiz-setup.js`).
- `npx next build` → **✓ Compiled successfully** (writer is server/CLI-only; flags remain default-off; no UI/route lifecycle change).

## 14. No-live-write confirmation

- The live Sheet was accessed **read-only** twice this phase (manifest re-read for the write plan; a final structural check) — both `values.get` only.
- After this phase: `MentorMutationRequests` and `MentorSchema` **still do not exist**; row counts remain MentorProfile 2, MentorPlans 5, MentorTasks 15, MentorTaskLogs 29, StudentTopicState 4 (unchanged).
- No live column added, no tab created, no row backfilled, no header cleaned, no Status changed, no plan superseded, no flag enabled.
- `npm run mentor:sheets-migration:apply` was **not** run; `MENTOR_LIVE_WRITER_CONFIRMED=YES` was **not** set for any live run. All writer batches were exercised only against the in-memory fake gateway.

## 15. Exact next step

The migration apply is **implemented and ready but intentionally blocked**. The approved live apply (a separate, future step) is:

1. Founder downloads a fresh `.xlsx` backup; record filename/time + row counts (2/5/15/29/4).
2. Freeze Sheet editing for the window.
3. Re-run `npm run mentor:sheets-migration:dry-run` to confirm the manifest still matches (fingerprints/row counts unchanged).
4. Review `PHASE_6B_LIVE_WRITE_PLAN.md`.
5. Run apply **only** with the full gate set:
   ```text
   CONFIRM_MENTOR_SHEET_MIGRATION=YES MENTOR_BACKUP_CONFIRMED=YES \
   MENTOR_LIVE_WRITER_CONFIRMED=YES MENTOR_BACKUP_NOTE="<backup>.xlsx" \
   MENTOR_MIGRATION_MANIFEST=docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json \
   npm run mentor:sheets-migration:apply
   ```
6. Review the generated `PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.*`; keep all Mentor V2 mutation flags false until the applied schema marker + adapter readiness are verified.

---

*Phase 6B complete — writer implemented and fully tested against a fake gateway; not executed against the live Sheet. No live write, no tab/column added, no row backfilled, no flag enabled, no commit/push.*
