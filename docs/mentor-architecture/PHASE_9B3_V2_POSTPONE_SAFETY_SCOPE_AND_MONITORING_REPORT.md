# Phase 9B3 — Post-Live V2 POSTPONE Safety Hardening & Cohort Scoping Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Harden V2 POSTPONE after the first live mutation by adding a cohort/test-user allowlist gate, a read-only monitor, and disable/rollback instructions. **No new live mutation, no new action expanded.**
**Date:** 2026-06-11
**Result:** ✅ V2 POSTPONE now runs **only** for allowlisted test users (currently 1); all other users fail closed to legacy. Live Sheet unchanged. 312 tests + build green.

---

## 1. Files changed
| File | Change |
|---|---|
| `lib/mentor/repository/featureFlags.js` | Added `getV2MutationAllowedUserHashes()` (comma-separated, trimmed) + `isMentorV2MutationUserAllowed(hash)` (fail-closed when empty). |
| `lib/mentor/read/taskActionRouting.js` | Added `userScopeHashFor`, `isV2MutationUserAllowed`, and `shouldRouteActionThroughV2ForUser(actionType, identity)` = flags + whitelist + **cohort allowlist**. |
| `pages/api/mentor/task-action.js` | Route now gates on `shouldRouteActionThroughV2ForUser(actionType, { email })` instead of the flag/whitelist-only gate. |
| `lib/mentor/read/v2MutationMonitor.js` | **New** — read-only `auditV2Mutations(sheets)` aggregate health audit (no writes, no full emails). |
| `scripts/mentor-v2-mutation-monitor.js` | **New** — CLI wrapper for the live read-only audit. |
| `scripts/test-mentor-v2-cohort.js` | **New** — 8 cohort-gate + monitor tests. |
| `package.json` | Added `test:mentor-v2-cohort` + `mentor:v2-monitor`. |
| `.env.local` | Added `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES=u_1d929728f3beaa74` (test user only). |

## 2. Allowlist / cohort gate implementation
A **second gate** sits on top of the three mutation flags + the `snooze` whitelist. The live route only routes a task action through V2 when **all** of:
1. `MENTOR_TASK_MUTATIONS_V2` + `MENTOR_SHEETS_MUTATIONS_V2` + `MENTOR_MUTATION_IDEMPOTENCY_V2` are true,
2. the action is whitelisted (`snooze`),
3. the user's scope hash (`u_<sha256(email)[:16]>`) is in `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES`.

**Fail-closed:** if the allowlist is empty, unset, or whitespace-only → **no users allowed** → every action routes to the legacy path (even with all flags on). The gate uses the existing user **scope hash**, never the full email.

## 3. Current allowed test user hash
```text
MENTOR_V2_MUTATION_ALLOWED_USER_HASHES=u_1d929728f3beaa74
```
This is the Phase 9B2 dedicated test user (`an***@gmail.com`) scope hash — the only user for whom V2 POSTPONE is active.

## 4. Routing result for the test user
- test user hash matches the allowlist → **true**
- test user + `snooze` → **V2** (true)
- test user + `complete`/`response`/`launch_practice`/`resume` → **legacy** (false; whitelist unchanged)

## 5. Routing result for the real affected user
- real user (`ba***@gmail.com`, owner of `MP_1780920810055`) + `snooze` → **legacy** (false; not allowlisted)
- unknown user + `snooze` → **legacy** (false)

## 6. Monitoring script results (live, read-only)
`npm run mentor:v2-monitor`:
```text
totalMutationRequests: 1     completedMutationRequests: 1     failedMutationRequests: 0
postponeMutationCount: 1     duplicateIdempotencyKeys: 0       unexpectedMutationsOutsideAllowlist: 0
canonicalPostponeEvents: 1   pendingUserPostponedTasks: 1     tasksRowVersionGt1: 1
mentorTaskLogsCount: 30       mentorTasksCount: 16
affectedRealPlanStatus: { completed: 5, snoozed: 10 }   (MP_1780920810055 unchanged)
flags: TASK/SHEETS/IDEMPOTENCY_V2 true; DAILY_ROLLOVER/PENDING_LIFECYCLE false
```
Exactly the single Phase 9B2 mutation is present; no duplicates; no mutations outside the allowlisted scope; the affected real plan is unchanged.

## 7. No-live-write confirmation
This phase performed **no** live mutation. The monitor and routing verification use only `spreadsheets.values.get` (read). Confirmed live: `MentorMutationRequests` = 1 (unchanged), `MentorTaskLogs` = 30 (unchanged), only the Phase 9B2 test task carries V2 pending state, affected real plan unchanged, `MENTOR_DAILY_ROLLOVER_V2`/`MENTOR_PENDING_LIFECYCLE_V2` remain false. Test 8 proves the audit module is read-only (it runs even when `update`/`append` are wired to throw).

## 8. Rollback / disable instruction
Quickest safe disable paths (either one routes **all** future `snooze` actions back to legacy for everyone):
- **Clear the allowlist:** `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES=` (or remove the line) → fail-closed, no users in V2 (keeps the flags on but inert).
- **Or disable the action flag:** `MENTOR_TASK_MUTATIONS_V2=false` → `shouldRouteActionThroughV2` false → legacy for all.
Either is a config-only change (no code/deploy). Restoring the founder `.xlsx` backup remains the data rollback for the already-applied test mutation (Sheets is non-transactional; no automatic rollback).

## 9. Tests / build results
`test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **312 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 10. Can Phase 9C begin planning?
**Yes.** With the cohort gate in place, V2 POSTPONE is safely scoped to approved test users and disable is a one-line config change. Phase 9C can plan, behind the same allowlist + per-action whitelist:
- **Pending surfacing** — enable/validate the pending read model so postponed tasks appear in `pendingTasks` (currently the repository's `canonicalPendingTasks` is a placeholder `[]`), decide UI treatment, validate on the test user.
- **Action expansion** — add the next reversible action (e.g., `resume` to undo a postpone) to the whitelist, one at a time, each with a fresh backup + single controlled test + monitor verification.

## 11. Blocking items
- **Blocking for this phase:** None (complete).
- **For Phase 9C (non-blocking):**
  1. Pending-lifecycle surfacing of postponed tasks (placeholder `canonicalPendingTasks`).
  2. Decide whether to broaden the allowlist beyond the test user (and add alerting on `unexpectedMutationsOutsideAllowlist > 0`).
  3. Define the safe completion source before any future `complete` cut-over.
  4. Optional cleanup of the `MP_T9B2_…` test plan.

---

*Phase 9B3 complete — V2 POSTPONE cohort-scoped to allowlisted test users + read-only monitoring + documented disable path. No new live mutation, no action expanded, affected real plan untouched, rollover/pending writes not enabled, no deploy, no commit/push.*
