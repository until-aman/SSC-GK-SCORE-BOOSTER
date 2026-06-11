# Phase 6A — Live Google Sheet Migration Dry Run (Read-Only) Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Run the Phase 6 migration tool in **live dry-run mode only** against the actual Google Sheet. Generate a factual migration manifest. **No schema or data write was performed or approved.**
**Mode:** Read-only inspection (`spreadsheets.values.get` only).
**Date:** 2026-06-11 (run at `2026-06-11T00:13:40Z`)

```text
Data source: Live Google Sheet
Mode: Read-only dry run
Writes performed: None
```

> Findings below are 100% from the live Sheet. No fixture-derived data is mixed in. The live workbook id hash is `b5dbd520776c48ff` (the fixture path would hash `fixture-workbook` instead — proving this was a live read).

---

## 1. Environment readiness

Presence verified without reading any secret value:

```text
Google Sheet configuration present: Yes
```

- `GOOGLE_SHEET_ID` — present and non-empty.
- `GOOGLE_SERVICE_ACCOUNT_KEY` — present, parses as JSON, contains `client_email` and `private_key`.
- Source: the application's `.env.local` (the same config Next.js injects at runtime). The CLI script has no dotenv loader, so `.env.local` was preloaded for this run via `node -r dotenv/config` (equivalent to the app runtime). No credential value was printed.
- No Mentor V2 feature flag was enabled. `CONFIRM_MENTOR_SHEET_MIGRATION` and `MENTOR_BACKUP_CONFIRMED` were left unset.

## 2. Live-source confirmation

- Live read confirmed: the run issued `values.get` against 7 tabs on the real spreadsheet (`GOOGLE_SHEET_ID`), returning live headers and rows.
- `.env.local` was checked to ensure it does **not** set `MENTOR_MIGRATION_USE_FIXTURE`, `MENTOR_MIGRATION_MODE`, `CONFIRM_MENTOR_SHEET_MIGRATION`, or `MENTOR_BACKUP_CONFIRMED` — so the fixture path was not taken and apply could not run.
- Manifest `workbookIdHash = b5dbd520776c48ff` (non-reversible hash of the real Sheet id), `inspectionTimestamp = 2026-06-11T00:13:40.310Z`.

## 3. Dry-run safety inspection

Static inspection of the dry-run code path **before** execution:

| Check | Result |
|---|---|
| Dry-run uses read-only Sheets ops | Yes — only `spreadsheets.values.get` in `scripts/mentor-sheets-migration.js` |
| Calls `values.update`/`append`/`batchUpdate`/`clear`/`addSheet`/`create` | None (the single `values.update` token is a code comment inside the separate, gated `apply()` function) |
| Alters headers | No |
| Mutates application cache | No |
| Writes only to local report files | Yes — `fs.writeFileSync` confined to `docs/mentor-architecture/generated/` |
| Apply path reachable in dry-run mode | No — requires `--apply`/`MENTOR_MIGRATION_MODE=apply`; and even then is dry-apply-only with `CONFIRM`+`BACKUP` gates |

No safety defect found. Dry-run is provably read-only.

## 4. Tab inventory

| Tab | Exists (live) |
|---|---|
| MentorProfile | Yes |
| MentorPlans | Yes |
| MentorTasks | Yes |
| MentorTaskLogs | Yes |
| StudentTopicState | Yes |
| MentorMutationRequests | **No** (to be created) |
| MentorSchema | **No** (to be created) |

Required tabs found: 5/5. The two new mutation/idempotency/schema tabs do not yet exist.

## 5. Row counts (live)

| Tab | Rows |
|---|---|
| MentorProfile | 2 |
| MentorPlans | 5 |
| MentorTasks | 15 |
| MentorTaskLogs | 29 |
| StudentTopicState | 4 |
| MentorMutationRequests | 0 (absent) |
| MentorSchema | 0 (absent) |

> **Live vs offline difference:** the offline workbook export had **1** MentorProfile row; the live Sheet has **2**. All other core counts match the offline finding. The 5 plan rows and 15 task rows all belong to a **single** logical PlanId (see §7), so the second profile row does not affect the affected-plan analysis. The second profile should be confirmed by the founder before apply (likely a second user with no Mentor plan yet).

## 6. Header compatibility

No ambiguous normalized-duplicate headers in any tab. No unexpected extra columns. Per-tab summary:

- **MentorProfile** — 20 physical headers. **Trailing carriage-return (`\r`) found on 3 headers** (warnings, non-blocking, normalized cleanly):
  - `MentorPlanId\r` → `MentorPlanId`
  - `ProgressPercent\r` → `ProgressPercent`
  - `LastPlanRefreshAt\r` → `LastPlanRefreshAt`
  - (Note: the offline `.xlsx` showed these as trailing `\n`; live shows `\r`. The header normalizer strips both — same compatibility outcome.)
- **MentorPlans** — 14 physical headers; no trailing whitespace; no ambiguity.
- **MentorTasks** — 26 physical headers; no trailing whitespace; **no physical `QuestionCount` column** (expected — additive).
- **MentorTaskLogs** — 11 physical headers; no trailing whitespace.
- **StudentTopicState** — 17 physical headers; **already contains all canonical v2 columns** (0 to add); no trailing whitespace.

Known-whitespace verification: `MentorPlanId`, `ProgressPercent`, `LastPlanRefreshAt` all confirmed with trailing `\r` and **left unmodified**.

## 7. Generation analysis (live)

| Metric | Live value |
|---|---|
| Distinct logical PlanIds (in tasks) | **1** (`MP_1780920810055`) |
| MentorPlans rows for that PlanId | 5 |
| Active-plan rows | 1 (generation 5) |
| Invalid/superseded rows | 4 (generations 1–4) |
| Generation batches | 5 |
| Tasks per generation | 3, 3, 3, 3, 3 |
| Current generation | g5 (`MP_1780920810055#g5`) |
| Historical generations | 4 (g1–g4) |
| Total MentorTasks | 15 |
| Current-generation tasks | 3 |
| Historical tasks | 12 |
| Tasks assignable to a generation deterministically | 15/15 (none ambiguous) |
| Duplicate TaskIds | 0 |

**Offline-finding reconciliation — the live Sheet still matches:**

```text
5 generations          -> CONFIRMED (5)
3 tasks per generation -> CONFIRMED (3 each)
15 total tasks         -> CONFIRMED (15)
5 completed            -> CONFIRMED (5)
10 snoozed             -> CONFIRMED (10; normalized read-label = "pending", kept historical/hidden)
generation 5 active    -> CONFIRMED (g5)
```

## 8. Current task / status analysis (live)

| Status (normalized) | Count |
|---|---|
| completed | 5 |
| pending (from legacy `snoozed`) | 10 |
| active / in_progress / blocked / expired / cancelled | 0 |

- `SequenceNumber` frequency: `1×5, 2×5, 3×5` — restarts per generation (duplicate across generations confirmed; warning, non-blocking).
- The 10 legacy `snoozed` rows are read-normalized to `pending` **for labelling only**; per Phase 1C they remain **historical/hidden** and are **not** placed into the canonical pending backlog. Their physical `Status` is unchanged.
- `Version='v1'` on all plan rows → parsed `PlanVersion = 1` (warning, expected).

## 9. Proposed additive columns (live migration proposal)

All additions are **additive only** — no existing column is renamed, reordered, or deleted.

| Tab | Existing | Columns to add | Required before mutation? |
|---|---|---|---|
| MentorProfile | 20 | `ActivePlanVersion`, `Timezone`, `SnapshotRevision` (3 **required**) + `PlanStartLocalDate`, `LastProcessedCalendarDay`, `UnlockedDay` (3 optional) | 3 required |
| MentorPlans | 14 | `PlanVersion`, `GenerationId`, `TaskSetRevision`, `NextTaskNumber`, `Timezone`, `PlanStartLocalDate`, `TotalPlanDays`, `UnlockedDay`, `LastProcessedCalendarDay`, `LastDailyRolloverAt`, `FeaturedPendingTaskId`, `FeaturedPendingForCalendarDay`, `GenerationStatus`, `RowVersion` (14 **required**) + `SupersededByPlanId`, `SupersededAt` (2 optional) | 14 required |
| MentorTasks | 26 | `PlanVersion`, `GenerationId`, `TaskNumber`, `QuestionCount`, `OriginalScheduledDay`, `ScheduledLocalDate`, `PendingReason`, `MovedToPendingAt`, `NextEligibleAt`, `NextEligibleResurfaceAt`, `ResurfacedCount`, `LastResurfacedAt`, `CompletionSource`, `LinkedQuizSessionId`, `ParentTaskId`, `RelatedTaskId`, `TriggerReason`, `CancellationReason`, `RowVersion` (19 **required**) | 19 required |
| MentorTaskLogs | 11 | `EventId`, `FromStatus`, `ToStatus`, `CanonicalAction`, `IdempotencyKey`, `RequestId`, `EventPayloadJSON` (7 **required**) | 7 required |
| StudentTopicState | 17 | None | — |
| **MentorMutationRequests** (new tab) | 0 | `IdempotencyKey`, `UserScopeHash`, `PlanId`, `TaskId`, `Action`, `PayloadHash`, `Status`, `ResultJSON`, `CreatedAt`, `CompletedAt`, `ExpiresAt` (11) | required (new tab) |
| **MentorSchema** (new tab) | 0 | `SchemaName`, `SchemaVersion`, `AppliedAt`, `ManifestHash` (4) | required (new tab) |

## 10. Proposed backfills (computed, not written)

- **MentorPlans rows to backfill:** 1 (the active generation mapping for `MP_1780920810055`, ordinal 5, current-generation task count 3).
- **MentorTasks rows to backfill:** 15.
  - **TaskNumber** assigned plan-wide `1..15` by `(generation order, CreatedAt, TaskId)` — unique, verified.
  - **NextTaskNumber** = **16**.
  - **GenerationId** = `MP_1780920810055#g1..#g5` (3 tasks each).
  - **PlanVersion** = `1` (from `v1`); **RowVersion** initialized `1`.
  - **QuestionCount** — derived only where safe (by task type); left blank where not derivable. No fabrication.
- **Preservation guarantees (verified by the proposal):**
  - `SequenceNumber` unchanged (`1×5, 2×5, 3×5` preserved).
  - 5 completed rows preserved as historical evidence — not rewritten.
  - 10 legacy snoozed rows remain historical/hidden — none enter canonical pending.
  - No row deleted; no existing column reordered or renamed.

## 11. Manifest hash

```text
manifestHash: ca1f69c79241f88af0106f0e19d0c5326a400690ca5fcbd51bf03cfb3ec2c1f6
workbookIdHash: b5dbd520776c48ff   (non-reversible hash of the live Sheet id)
inspectionTimestamp: 2026-06-11T00:13:40.310Z
```

The JSON manifest contains: workbook id hash (no raw Sheet id), inspection timestamp, schema version (`mentor-sheets-v2`, the live-read source marker), tab names, original row counts, per-tab normalized header fingerprints, proposed additive columns, proposed generation + task-number mappings, warnings, blocking errors, and the manifest hash. It contains **no** raw Sheet id, full email addresses, task question content, secrets, or tokens. The JSON was left byte-for-byte as generated so its `manifestHash` stays valid for a future apply precondition check.

## 12. Warnings (non-blocking)

1. `MentorPlanId` header has trailing `\r`.
2. `ProgressPercent` header has trailing `\r`.
3. `LastPlanRefreshAt` header has trailing `\r`.
4. Legacy `Version='v1'` across all plan rows (→ `PlanVersion=1`).
5. Duplicate `SequenceNumber` (1,2,3) repeated across all 5 generations.
6. MentorProfile has 2 rows (offline export had 1) — confirm the second profile before apply.

(The tool's machine `warnings` array is empty because it only flags unknown extra columns / ambiguous headers; the items above are the Step-11-classified non-blocking warnings, surfaced here from the live header/status inspection.)

## 13. Blocking errors

**None.** Specifically verified absent:
- no required tab missing (5/5 present),
- no ambiguous normalized headers,
- no duplicate TaskIds,
- exactly one active plan (deterministic),
- active generation resolves deterministically (g5),
- every task assigns to a generation deterministically (15/15),
- manifest generated completely (hash present),
- proposal adds columns only (no delete/reorder/rename),
- no write attempted on the dry-run path,
- live source confirmed.

## 14. No-write verification

After the run, all five core tabs were re-read and compared to the manifest:

| Tab | Rows (now / manifest) | Header fingerprint |
|---|---|---|
| MentorProfile | 2 / 2 | MATCH |
| MentorPlans | 5 / 5 | MATCH |
| MentorTasks | 15 / 15 | MATCH |
| MentorTaskLogs | 29 / 29 | MATCH |
| StudentTopicState | 4 / 4 | MATCH |

```text
Live Google Sheet writes performed: None
Physical Sheet changed: No
```

- No tab added (`MentorMutationRequests`/`MentorSchema` still absent).
- No column added; no row changed; no header cleaned/renamed.
- No task status changed; no plan generated; no cache mutated.
- Only local files written: `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json` and `.md`, and this report.

## 15. Readiness recommendation

**Migration apply readiness: Ready (no blocking errors).** The live Sheet is structurally compatible with the additive v2 schema; all backfills are deterministic and non-destructive. Apply must **not** be run yet — the dry-run artifacts require external review first, and (per Phase 6) the current apply tooling is dry-apply-only and does not write the live Sheet; a future live-writer phase plus founder approval are required before any column is actually added.

## 16. Exact manual founder actions before apply

1. **Download a fresh `.xlsx` backup** of the Google Sheet; record filename + exact download time.
2. **Record original row counts:** MentorProfile 2, MentorPlans 5, MentorTasks 15, MentorTaskLogs 29, StudentTopicState 4.
3. **Freeze Sheet editing** for the migration window (no concurrent edits).
4. **Review** `docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json` and `.md` and this report; confirm the additive column list and the 1–15 / next=16 task-number proposal.
5. **Confirm the second MentorProfile row** is expected (e.g., a second user) before proceeding.
6. **Decide on header cleanup (optional):** the 3 trailing-`\r` headers are handled by read-time normalization; manual trimming is optional and not required for correctness.
7. **Keep all Mentor V2 flags false** (`MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`, `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`).
8. **Do not run apply** until a separate, approved step (with `CONFIRM_MENTOR_SHEET_MIGRATION=YES` + `MENTOR_BACKUP_CONFIRMED=YES` + the reviewed manifest path) and a live-writer implementation are in place.

---

*Phase 6A complete — live read-only dry run only. No Google Sheet write, no column/tab added, no row changed, no flag enabled, no apply executed, no commit/push.*
