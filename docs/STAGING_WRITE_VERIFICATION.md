# Staging Write Verification (Step 17)

> **STATUS: NOT EXECUTED.** Requires test accounts + a staging Google Sheet. Idempotency is **harness-verified** (Steps 11/13 + duplicate-payload tests) but **not yet confirmed against live Sheet rows.**

## Checklist to run on staging (use scripts/load-test/write-idempotency.js then inspect the test Sheet)
- **Quiz completion:** 1 QuizSessions row, correct AttemptAnswers count, 1 Scores row, 1 Users coin/streak update; duplicate same-`clientSessionId` payload → no extra rows, no double coins.
- **Saved:** 1 row on first save; repeat save → no duplicate; unsave removes row; guest batch migration appends only missing items.
- **Analysis interest:** 1 row first submit; repeat → `alreadyJoined`, no duplicate row.
- **Mentor:** correct task status/log; double-click → no duplicate action; generate clears visible tasks, keeps history.
- **Dream Post:** value saved; unlock/timestamp fields per current rules; same-value resubmit stable.

Inspect only test-account rows; never report real users' rows.
