# Phase 9M — Scheduled Mentor V2 Production Monitor / Alerting

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Add a scheduled, read-only GitHub Actions monitor for the Mentor V2 production guardrails. **No live mutation, no env/routing change, no deploy.**
**Date:** 2026-06-12
**Result:** ✅ `.github/workflows/mentor-v2-monitor.yml` added (every 6h + manual dispatch, read-only, fails only on CRITICAL); 11 static workflow tests; env checklist documents secrets, expected WARNING, and failure conditions. 425 tests + build green. **Not committed/pushed** (awaiting approval).

---

## 1. Workflow file added
`.github/workflows/mentor-v2-monitor.yml` — job `monitor` on `ubuntu-latest`, `timeout-minutes: 10`, `permissions: contents: read`. Steps: checkout → setup-node 20 (npm cache) → `npm ci` → `npm run mentor:v2-monitor`. The monitor performs **only Google Sheets reads** (`values.get`) and exits 2 on CRITICAL.

## 2. Schedule frequency
`cron: "0 */6 * * *"` — every 6 hours.

## 3. Manual dispatch support
`workflow_dispatch: {}` — runnable on demand from the Actions tab ("Mentor V2 Production Monitor" → Run workflow).

## 4. Required secrets
Names match the app's **actual** Sheets auth in `lib/sheets.js` (`JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)` + `process.env.GOOGLE_SHEET_ID`) — the spec's suggested `GOOGLE_SHEETS_CLIENT_EMAIL`/`GOOGLE_SHEETS_PRIVATE_KEY` are **not** used by this repo and were deliberately avoided.

| GitHub Actions Secret | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | service-account JSON (same value as Vercel) |
| `GOOGLE_SHEET_ID` | production Sheet id |
| `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES` | current allowlist value (or blank — ignored while allow-all is on) |

The mutation/scope flags are hard-coded in the workflow `env` to mirror production (`MENTOR_MUTATION_IDEMPOTENCY_V2`/`SHEETS_MUTATIONS_V2`/`TASK_MUTATIONS_V2`=`true`, `MENTOR_V2_MUTATION_ALLOW_ALL`=`true`, `MENTOR_DAILY_ROLLOVER_V2`/`MENTOR_PENDING_LIFECYCLE_V2`=`false`). **No write-capable secret is required or used.**

## 5. Expected healthy allow-all monitor state
```text
ALERT STATUS: WARNING
  [WARNING] ALLOW_ALL_ENABLED: V2 mutations are enabled for all authenticated users.
mutationAllowAll=true
unexpectedMutationsOutsideAllowlist=0   duplicateIdempotencyKeys=0   failed=0
Affected real plan (MP_1780920810055): {completed:5, snoozed:10}
rollover/pending write flags: false/false
exit code: 0   → job PASSES
```
Confirmed locally (allow-all overridden for the run): WARNING with `ALLOW_ALL_ENABLED`, exit 0. The WARNING is expected and does **not** fail the scheduled job.

## 6. What fails the job (CRITICAL → exit 2 → red run)
- `unexpectedMutationsOutsideAllowlist > 0` **while allow-all is off**
- `duplicateIdempotencyKeys > 0`
- `failedMutationRequests ≥ 3`
- affected real plan drift from `{completed:5, snoozed:10}`
- `MENTOR_DAILY_ROLLOVER_V2` or `MENTOR_PENDING_LIFECYCLE_V2` = `true`

(`failedMutationRequests` 1–2 is WARNING, not a failure.)

## 7. Read-only confirmation
The workflow runs only `npm run mentor:v2-monitor` → `node scripts/mentor-v2-mutation-monitor.js` → `auditV2Mutations` (only `values.get`). No write/mutation scripts, no `--commit`, no deploy/`vercel`/`git push` steps. Verified by the static test (`scripts/test-mentor-monitor-workflow.js`, 11 checks) and `permissions: contents: read`. No live writes were performed in this phase (production `MentorMutationRequests=14` and affected real plan `{5,10}` unchanged from end-of-9L).

## 8. Docs updated
`MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md` gained section **§5a "Scheduled monitor / alerting"**: workflow path, schedule, manual-run instructions, the expected healthy WARNING result, the CRITICAL failure conditions, the required secrets table, and the CRITICAL-response/rollback note.

## 9. Tests / build result
`test:mentor-monitor-workflow` 11/11 (new) · monitor-alerts 8 · allow-all 10 · route-readiness 12 · v2-complete 21 · v2-resume 18 · v2-postpone 20 · read-overlay 13 · mutation-service 11 · state-machine 45 · rollover 67 · repo 22 · sheets 36 · sheets-writer 23 · plan-day 25 · optimization 42 — **425 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 10. Committed / pushed / deployed
**No.** Per the strict rules, nothing was committed or pushed. New/changed files are local: `.github/workflows/mentor-v2-monitor.yml`, `scripts/test-mentor-monitor-workflow.js`, `docs/mentor-architecture/MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md`, `docs/mentor-architecture/PHASE_9M_SCHEDULED_MONITOR_ALERTING_REPORT.md`, `package.json` (`test:mentor-monitor-workflow`). To activate scheduled monitoring: commit these → merge to `main` (GitHub Actions schedules run from the default branch) → add the 3 repo Secrets. I can prepare a clean commit + PR on approval.

## 11. Blocking items
- **Blocking for scheduled runs:** the workflow must be **on `main`** (Actions schedules only fire from the default branch) and the **3 repo Secrets** must be set — both require your action/approval.
- **Non-blocking:** optionally add a notification step (Slack/email) on failure; optionally lower the cadence (e.g., hourly) if traffic grows. The job is intentionally alert-by-red-run today.
- **Not done (per rules):** no commit/push, no env change, no routing change, rollover/pending writes remain off.

---

*Phase 9M complete — scheduled read-only production monitor workflow + tests + docs. No live mutation, no env/routing change, no deploy, no commit/push; rollover/pending writes remain off.*
