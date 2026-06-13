# Phase 9M2 — Scheduled Mentor V2 Monitoring via Vercel Cron

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Replace the unusable GitHub-Actions scheduled monitor with a **Vercel Cron** read-only monitor that reuses the existing Vercel env. **No live mutation, no Sheets write, no V2 routing change, no rollover/pending enablement.**
**Date:** 2026-06-12
**Result:** ✅ Read-only `CRON_SECRET`-protected route + `vercel.json` cron (every 6h); GitHub workflow made manual-only; 10 cron tests; docs updated. 435 tests + build green. **Not committed/pushed** (awaiting approval). One new Vercel env var `CRON_SECRET` is required (you add it).

---

## 1. Why Vercel Cron (not GitHub Actions)
GitHub Actions has its own secret store and **cannot read Vercel env vars**. The repo has **no** Actions secrets, so a scheduled GitHub run always fails. Vercel Cron runs in the Vercel runtime and reuses the existing production env (`GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEET_ID`, all `MENTOR_*` flags) — no GitHub secrets, no duplication.

## 2. Files changed
| File | Change |
|---|---|
| `pages/api/internal/mentor-v2-monitor.js` | **New** — read-only Vercel-cron monitor route. |
| `vercel.json` | **New** — `crons: [{ path: "/api/internal/mentor-v2-monitor", schedule: "0 */6 * * *" }]`. |
| `lib/mentor/read/v2MutationMonitor.js` | Added pure helpers `isValidCronRequest(authHeader, secret)` (fail-closed) and `cronMonitorResult(audit, flagState)` (→ `{httpStatus, body}`; CRITICAL→500). |
| `.github/workflows/mentor-v2-monitor.yml` | **Schedule removed → manual-only** (`workflow_dispatch`), with a comment explaining the no-secrets reason. |
| `scripts/test-mentor-cron-monitor.js` | **New** — 10 tests. |
| `scripts/test-mentor-monitor-workflow.js` | Updated test 2 to assert the GitHub schedule is removed (manual-only). |
| `docs/mentor-architecture/MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md` | §5a rewritten for Vercel Cron + `CRON_SECRET`. |
| `package.json` | Added `test:mentor-cron-monitor`. |

## 3. GitHub scheduled workflow disabled
`.github/workflows/mentor-v2-monitor.yml` now has **no `schedule:` trigger** — only `workflow_dispatch`. It can be run manually from the Actions tab, but only succeeds if the three repo secrets are ever added. This stops the always-failing scheduled runs.

## 4. Cron route (read-only + secured)
`pages/api/internal/mentor-v2-monitor.js`:
- **Auth:** `isValidCronRequest(req.headers.authorization, process.env.CRON_SECRET)` — requires `Authorization: Bearer <CRON_SECRET>`; **fail-closed** (401 if `CRON_SECRET` unset or header mismatches). Vercel Cron sends this header automatically when `CRON_SECRET` is set on the project.
- **Work:** `getSheetsClient()` → `auditV2Mutations(sheets, {allowedUserHashes})` (only `values.get`) → `cronMonitorResult(audit, flagState)`. **No mutation/write method is imported or called** (asserted by test).
- **Response body:** `alertStatus`, `alerts`, `mutationAllowAll`, `duplicateIdempotencyKeys`, `failedMutationRequests`, `unexpectedMutationsOutsideAllowlist`, `affectedRealPlanStatus`, `affectedRealPlanId`, `flags.{MENTOR_DAILY_ROLLOVER_V2, MENTOR_PENDING_LIFECYCLE_V2}`, `checkedAt`.
- **HTTP:** **CRITICAL → 500** (Vercel marks the run failed), **WARNING/OK → 200**. A read failure also → 500.

## 5. `CRON_SECRET` requirement
No pre-existing cron/internal secret exists in the repo (`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET` are OAuth/NextAuth and were deliberately **not** reused). So **one new Vercel env var `CRON_SECRET`** must be added (Production scope; any strong random string — not a Google/Sheets secret). Until it is set, the route returns 401 and the cron is effectively inert (safe). You approved adding this single secret.

## 6. Cron schedule
`vercel.json` → `"0 6 * * *"` (daily ~06:00 UTC). **Plan limit:** the Vercel **Hobby** plan allows cron **once per day only**; a more-frequent expression **fails the deployment** ("Hobby accounts are limited to daily cron jobs"). The initial `0 */6 * * *` (4×/day) failed deploy and was corrected to daily. Hobby timing precision is hourly (±59 min). Upgrade to Pro for sub-daily/precise timing.

## 7. Tests / build result
`test:mentor-cron-monitor` (new): auth fail-closed/valid; WARNING→200 + ALLOW_ALL_ENABLED + mutationAllowAll; OK→200; CRITICAL→500 (dup keys / ≥3 failed / rollover flag); a real-user plan change → 200 (NOT critical); body fields present; route auth-gated + 401; route has **no** write methods; `vercel.json` cron path+schedule; GitHub schedule removed. `test:mentor-monitor-workflow` 11/11 (manual-only). Full mentor suite **435 passed, 0 failed** (incl. monitor-alerts 8, allow-all 10, route-readiness 12, v2-complete 21, v2-resume 18, v2-postpone 20, read-overlay 13, mutation-service 11, state-machine 45, rollover 67, repo 22, sheets 36, sheets-writer 23, plan-day 25, pending-ui 9, pending-surfacing 11, v2-complete-design 13, v2-cohort 8, optimization 42). `npx next build` → **✓ Compiled successfully**; route `/api/internal/mentor-v2-monitor` registered.

## 8. Read-only / safety confirmation
No live writes this phase (production `MentorMutationRequests=14`, affected real plan `{completed:5, snoozed:10}` unchanged). The cron route only reads. `MENTOR_REPO_V2`, `MENTOR_DAILY_ROLLOVER_V2`, `MENTOR_PENDING_LIFECYCLE_V2` untouched/off. V2 routing unchanged.

## 9. Activation steps (after a commit/PR is merged + deployed)
1. **Add `CRON_SECRET`** to Vercel **Production** env (any strong random string). Redeploy.
2. Deploy `main` (the `vercel.json` cron registers on deploy; the route ships with the app).
3. Verify: Vercel → (Project) → **Cron Jobs** shows the job; trigger a run (or wait) and check the function log returns `200` with `alertStatus: "WARNING" / ALLOW_ALL_ENABLED`.

## 10. Blocking items
- **Required (your action):** add the single `CRON_SECRET` env var in Vercel (you approved this). Without it the route is 401 / cron inert.
- **Plan caveat:** Hobby-plan cron may run ~daily, not strictly 6h.
- **Not done (per rules):** no commit/push (awaiting approval), no env change, no deploy, no Sheets writes, no rollover/pending enablement. I can prepare a clean commit + PR to `main` on approval.

---

*Phase 9M2 complete — Vercel Cron read-only monitor + manual-only GitHub workflow. No live mutation, no Sheets write, no V2 routing change, no MENTOR_REPO_V2/rollover/pending enablement, no deploy, no commit/push without approval.*
