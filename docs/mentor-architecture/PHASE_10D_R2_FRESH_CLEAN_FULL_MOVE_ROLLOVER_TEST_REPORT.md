# Phase 10D-R2 — Fresh Clean Full-Move Daily Rollover Test

**Date:** 2026-06-13
**Outcome:** ⚠️ **PARTIAL** — the full-move run hit a **transient Google Sheets write error** mid-batch. One of three current-generation work tasks moved; the rest, the day-marker, and finalization did not. **No corruption**, monitor stayed WARNING, and the failure was **visible and resumable** (Bug B fix working as designed). Founder chose: **disable → harden the executor against transient writes → clean retry.**

---

## 1. Candidate selection
- Considered: `antilanuj666@gmail.com` (`u_1d929728f3beaa74`, old partial plan — declined, not clean) and `aman.iitkgp00@gmail.com` (`u_535de9b1b4e8c248` — declined, no active work task).
- **`backupofpocox3@gmail.com` (`u_7bbf57cf905a5df3`) — founder test account.** Resolves to **`MP_1780920810055`**, which is the monitor's hardcoded baseline "affected plan." Founder explicitly approved repurposing it for this test (the moves keep `completed=6 ≥ 5` and `snoozed=10`, so no data-loss CRITICAL; the affected-plan baseline guardrail will shift and should later be retired/repointed).

## 2. Why the candidate was clean
`TotalPlanDays=31`, `calendarDay=2 > lastProcessed=1`, **3 current-generation active work tasks**, no prior `Action=ROLLOVER` row, no prior `daily_rollover` events. (A 4th raw-active task `MT_1781279507912_mistake` belongs to an **older generation** and is correctly excluded by generation scoping — re-validated Bug C live.)

## 3. Backup
- Founder-confirmed fresh `.xlsx` backup before enabling the flag.

## 4. Shadow prediction (re-run, exact)
`rolloverRequired=true`, **moved=3**, rescheduled=0; tasks `MT_1781279529828_{mistake, Current Affairs_weak_2, Biology_weak_3}` active→pending (`day_ended_incomplete`, rv blank→2); would write `LastProcessedCalendarDay=2` to the active row; key `mentor-rollover:u_7bbf57cf905a5df3:MP_1780920810055:2`.

## 5. Env used
`MENTOR_DAILY_ROLLOVER_V2=true`, `MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES=u_7bbf57cf905a5df3`, allow-all off, pending-lifecycle off. Step 5 post-enable monitor: WARNING, `DAILY_ROLLOVER_PILOT_ENABLED`, allowlist=1, no CRITICAL.

## 6. Live trigger
One authenticated `GET /api/mentor/plan` in the `backupofpocox3` session (hard reload, 200).

## 7. Result — PARTIAL FAILURE
| Item | Expected | Observed |
|---|---|---|
| `..._mistake` | →pending | ✅ pending, day_ended_incomplete, movedAt set, snooze 1, **rv 2** |
| `..._Current Affairs_weak_2` | →pending | ❌ still **active**, unchanged |
| `..._Biology_weak_3` | →pending | ❌ still **active**, unchanged |
| POSTPONE event for task 1 | written | ❌ **not written** |
| active-row `LastProcessedCalendarDay` | =2 | ❌ blank |
| `Action=ROLLOVER` row | +1 | ❌ absent (MR=21) |
| old-gen `MT_1781279507912_mistake` | untouched | ✅ active |
| affected-plan data-loss | none | ✅ completed 6, snoozed 10 intact |

## 8. Root cause (diagnosed read-only)
- **No duplicate task rows** (each task = 1 row); **plan-row resolution clean** (exactly 1 active row, not ambiguous). So not a logic bug.
- The executor loop does `compareAndUpdateTask` (status) **then** `appendTaskEvent` (event). Task 1's status update succeeded (rv→2) but its **`appendTaskEvent` threw a non-stale error** → `ROLLOVER_PARTIAL_FAILURE`, aborting before tasks 2–3, the day-marker, and finalization. Almost certainly a **transient Sheets API error (429/503)** during the rapid sequential-write burst.
- The +1 MentorTaskLogs row (101→102) was an unrelated `Source=mentor` row for the *old* `MP_T9B2` plan, not this run.

## 9. What worked (verified)
- Move path (task 1 moved correctly), generation scoping (old-gen task untouched; `activeTaskCountOverLimit=0`), and crucially **Bug B**: the failure surfaced as a visible `ROLLOVER_PARTIAL_FAILURE` (`plan.js` logs `[mentor-rollover-write] FAILED`) instead of a silent partial, with idempotency **not** finalized → a re-run resumes.

## 10. New robustness finding (to fix before clean retry)
The executor is **not resilient to a transient Sheets write error mid-batch**: a failed `appendTaskEvent` after a successful status update leaves a task **moved-but-eventless** and aborts the batch; on resume that task is already `pending`, so its event is never backfilled (an orphaned, unaudited move). **Fix:** bounded **retry/backoff on transient Sheets writes** (HTTP 429/5xx, network errors) in the Sheets IO layer, so transient blips don't abort the batch. (Optionally also reconsider event/status ordering or resume-time event backfill.)

## 11. Monitor
WARNING throughout, no CRITICAL. `duplicateRolloverIdempotencyKeys=0`, `failedRolloverMutationRequests=0`, `activeTaskCountOverLimit=0`. (`ROLLOVER_LAST_PROCESSED_MISSING=1` is the *old* `MP_T9B2` regenerated plan, not this candidate.)

## 12. Decision + next steps
Founder chose **disable → harden → clean retry**:
1. **Disable** `MENTOR_DAILY_ROLLOVER_V2=false` + redeploy (in progress).
2. **Harden** the Sheets IO layer with retry/backoff on transient errors (code + tests + PR) — Phase 10D-FIX-2.
3. **Restore** the candidate plan from the fresh backup (revert task 1 to active) for a clean slate — founder-approved restore.
4. **Clean retry** the full-move test after the hardening is deployed.

## 13. Confirmation — scope of writes
The only production write was the single partial move of task 1 on the pilot plan (status→pending, no event). No day-marker, no `ROLLOVER` row, no other task changed, no non-pilot data touched, no hand-edits, no backup restore in this phase. The partial state is safe and resumable; it will be cleaned via the founder-approved restore before the retry.
