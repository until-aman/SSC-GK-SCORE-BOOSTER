# Phase 7 — Post-Migration Validation & Shadow-Mode Readiness Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Validate the Phase 6C-migrated live Sheet against Mentor backend V2 (read-only/shadow). **No live write, no flag enabled, no UI change.**
**Date:** 2026-06-11
**Result:** ✅ 70/70 shadow validations passed · live Sheet unchanged · all tests + build green.

---

## 1. Flags disabled confirmation
All ten Mentor V2 flags verified **disabled** (process env + `.env.local`, values never printed): `MENTOR_REPO_V2`, `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ`, `MENTOR_TASK_STATE_MACHINE_V2`, `MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_SCHEMA_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`.

## 2. Live schema verification
All 7 tabs present: `MentorProfile`, `MentorPlans`, `MentorTasks`, `MentorTaskLogs`, `StudentTopicState`, `MentorMutationRequests`, `MentorSchema`. Row counts (re-read from live): **2 / 5 / 15 / 29 / 4 / 0 / 1** — all as expected.

## 3. Schema marker verification
```text
MentorSchema: SchemaName=mentor | SchemaVersion=2 | AppliedAt=2026-06-11T01:49:04.128Z | ManifestHash=b31fe07b8f20107526281c2e00378dd0d1495ecaa7b56cbf6ec3412a62556fcc
```
Marker accepted by the mutation adapter's `assertSchemaReady()` and by repository V2 reads.

## 4. Original header preservation
For `MentorProfile`/`MentorPlans`/`MentorTasks`/`MentorTaskLogs`: original columns present, retained as the **exact prefix** (20/14/26/11), none renamed or reordered, additive columns appended after originals. The three trailing-`\r` headers (`MentorPlanId`, `ProgressPercent`, `LastPlanRefreshAt`) were **not** cleaned. `StudentTopicState` header fingerprint matches the manifest (untouched).

## 5. Additive column verification
All required additive columns present: MentorProfile 6, MentorPlans 16, MentorTasks 19, MentorTaskLogs 7, MentorMutationRequests 11 (new tab), MentorSchema 4 (new tab).

## 6. Backfill verification (aggregate)
- `PlanVersion=1` on all 5 plan rows; `GenerationId` set on all 5 plan rows and all 15 task rows.
- `TaskNumber` unique **1–15**; active generation (g5) task numbers = **13, 14, 15**; historical = g1–g4.
- `NextTaskNumber=16` on the active generation-5 plan row.
- `RowVersion=1` on migrated plan/task rows.
- `SequenceNumber` unchanged (1,2,3 ×5); `Status` unchanged (**5 completed, 10 snoozed**); completed rows keep `CompletedAt`.
- `PendingReason` **blank** for legacy snoozed rows; `CompletionSource` **not fabricated** (blank); `StudentTopicState` unchanged.

## 7. Repository V2 shadow validation — **Pass**
Read-only `buildSnapshotFromRawData` over the live migrated Sheet (using the affected profile's pointer; email never printed):
- schema/normalized headers accepted; active plan pointer resolved; **active generation = 5**.
- current-generation tasks **3**; historical **12**; completed evidence **5**; hidden legacy snoozed **10**; canonical pending **0**.
- legacy snoozed do not leak into canonical pending; no duplicate TaskIds; no duplicate canonical TaskNumber; no ambiguous headers; snapshot invariants valid (`[]`).
- the **second MentorProfile row (no plan)** does not break the repository read.

## 8. Canonical day live validation — **Pass**
| Field | Value |
|---|---|
| legacy `ActiveDayNumber` | 1 |
| `PlanStartLocalDate` | 2026-06-08 (source: `canonical_plan_start` — the backfilled value) |
| `Timezone` | Asia/Kolkata |
| `TotalPlanDays` | 46 |
| `UnlockedDay` | 1 |
| canonical `calendarDay` | **4** |
| `activePlanDay` | **4** |
| `daysRemaining` | 42 |
| diagnostics | `PLAN_START_FROM_CANONICAL`, `LEGACY_ACTIVE_DAY_IGNORED` |

Verified: the frozen legacy `ActiveDayNumber=1` does **not** override the canonical day (computed day is 4); completion count / snoozed tasks / zero active tasks do **not** freeze the day (it is derived from server time + `Asia/Kolkata` local dates).

## 9. Rollover shadow evaluation — **Pass (with one follow-up note)**
Read-only `processDailyRollover` (no-op idempotency store; no live write):
- `rolloverRequired=true`, `lastProcessedCalendarDay→4`, `calendarDay=4`, would-move-to-pending **0**, would-reschedule **0**, featured pending candidate **yes**, nudge tier **normal**, `pendingCount=3`.
- No live write, no task event appended, no status changed, no idempotency row written (confirmed in §12).

> **Follow-up (non-blocking for read-only flags):** the rollover/pending read model surfaces `pendingCount=3` — the **current-generation (g5) legacy-snoozed tasks** — whereas the repository's canonical pending is **0**. This is because `dailyRolloverService.listPendingTasks` treats current-generation normalized-`pending` tasks as backlog, while the repository keeps **all** legacy snoozed hidden per Phase 1C §5. Before enabling the **pending lifecycle**, the team must reconcile this: either mark current-generation legacy snoozed as hidden in the pending model, or consciously decide to surface them. This does **not** affect repository reads, canonical day, or schema-read flags.

## 10. State-machine shadow validation — **Pass**
Read-only `evaluateTaskTransition` (no mutation persisted): historical-generation task rejected; hidden legacy snoozed rejected; terminal completed cannot reactivate; a current-generation active task is actionable (`START → in_progress`); task type immutable across transition; quick-check cannot enter pending; manual recovery requires evidence (`MANUAL_RECOVERY_NOT_VERIFIED`).

## 11. Mutation adapter readiness check — **Pass (no writes)**
`createSheetsMutationAdapter` over a deep copy of the live workbook: `assertSchemaReady()` passes (schema marker + required columns + idempotency tab present); active plan pointer + `RowVersion` readable (compare-and-update preconditions evaluable); write/idempotency flags (`MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`) are **false**, so no route would invoke writes. No write/append/idempotency method was called.

## 12. No-write confirmation
Live Sheet re-read after all checks: row counts unchanged (2/5/15/29/4/0/1); **no** new rows in `MentorMutationRequests` or `MentorTaskLogs`; task statuses unchanged (5 completed/10 snoozed); `PendingReason` still blank for legacy snoozed; `StudentTopicState` unchanged; schema marker unchanged; no feature flag changed. **No live write occurred.** (The temporary validation script was removed after use.)

## 13. Tests / build results
`test:mentor-sheets-writer` 23/23 · `test:mentor-sheets` 36/36 · `test:mentor-rollover` 55/55 · `test:mentor-state-machine` 45/45 · `test:mentor-plan-day` 25/25 · `test:mentor-repo` 22/22 · `test-mentor-api-optimization` 42/42 — **248 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 14. Can Phase 8 safely enable read-only V2 flags?
**Yes — for read-only / shadow flags.** The migrated Sheet is fully compatible with repository V2 reads, schema-marker validation, header normalization, generation isolation, TaskNumber backfill, and canonical day calculation. Phase 8 may, behind server-only flags and in a controlled order, enable: `MENTOR_SHEETS_SCHEMA_V2` (schema-aware reads), `MENTOR_REPO_V2_SHADOW`, `MENTOR_CANONICAL_DAY_READ` (additive day fields), and the rollover/state-machine **shadow** evaluators — none of which mutate data or change user-facing behaviour.

**Do NOT yet enable** mutation/lifecycle flags (`MENTOR_TASK_MUTATIONS_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2`, `MENTOR_SHEETS_MUTATIONS_V2`, `MENTOR_MUTATION_IDEMPOTENCY_V2`) until the §9 pending-model reconciliation is resolved.

## 15. Blocking items
- **Blocking for read-only V2 flags:** None.
- **Blocking for pending-lifecycle / mutation flags (later):** the §9 discrepancy — current-generation legacy-snoozed tasks appear in the rollover pending model (`pendingCount=3`) but are hidden (0) in the repository's canonical pending. Reconcile before enabling pending lifecycle writes.

---

*Phase 7 complete — validation only. No live Sheet write, no column/tab/row change, no flag enabled, no UI change, no deploy, no commit/push.*
