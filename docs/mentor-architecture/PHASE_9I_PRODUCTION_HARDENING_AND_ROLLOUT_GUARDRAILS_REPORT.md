# Phase 9I — Production V2 Mentor Hardening, Cleanup, and Rollout Guardrails

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Production hardening after the Phase 9H2 live route validation — scratch cleanup, env/rollback documentation, operator alert thresholds, no-write monitor tests. **No live mutation, no flag change, no deploy.**
**Date:** 2026-06-12
**Result:** ✅ Scratch removed; production env checklist + rollback paths + alert thresholds documented; monitor upgraded with a pure alert evaluator (read-only, exits 2 on CRITICAL); 8 new monitor tests; live monitor `ALERT STATUS: OK`. 404 tests + build green.

---

## 1. Scratch cleanup result
Removed the six one-time Phase 9H2 helper scripts (already deleted at the end of 9H2, re-confirmed absent this phase):
`scripts/_phase9h2_check.js`, `_phase9h2_inspect.js`, `_phase9h2_make_fixture.js`, `_phase9h2_fix_fixture.js`, `_phase9h2_reset_fixture.js`, `_phase9h2_rehome.js`.

**Retained** (permanent): all formal `scripts/test-mentor-*.js` suites, the monitor `scripts/mentor-v2-mutation-monitor.js`, and every `docs/mentor-architecture/*` report. **Not touched:** unrelated docs, `.claude/*` local config. None of the scratch files were ever committed (they were excluded from the production commit `ce19fe2`), so production was never affected.

## 2. Env checklist result
Created **`docs/mentor-architecture/MENTOR_V2_PRODUCTION_ENV_CHECKLIST.md`** documenting:
- The intended production flag state (read flags + mutation flags + allowlist; rollover/pending OFF).
- **`MENTOR_REPO_V2`** both options (false = safer global legacy reads, mutations still scoped; true = global V2 read overlay) with guidance on when to use each.
- The per-action V2/legacy scope table (manual `complete` stays legacy by design).
- **Disable/rollback paths** (clear the allowlist or set `MENTOR_TASK_MUTATIONS_V2=false` to stop mutations instantly; `MENTOR_REPO_V2=false` to revert reads; Vercel Instant Rollback; data restore from backup).
- The monitor/alert thresholds and the cohort-expansion procedure.

## 3. Monitor / alerting changes
Added a **pure** `evaluateMonitorAlerts(audit, { flags, expectedAffectedRealPlan })` to `lib/mentor/read/v2MutationMonitor.js` (no I/O), plus `EXPECTED_AFFECTED_REAL_PLAN = {completed:5, snoozed:10}`. Thresholds:

| Signal | Threshold | Severity |
|---|---|---|
| `unexpectedMutationsOutsideAllowlist` | `> 0` | CRITICAL |
| `duplicateIdempotencyKeys` | `> 0` | CRITICAL |
| `failedMutationRequests` | `1–2` / `≥3` | WARNING / CRITICAL |
| `affectedRealPlanStatus` drift from baseline | any | CRITICAL |
| `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` = true | — | CRITICAL |

The runner `scripts/mentor-v2-mutation-monitor.js` now prints an **operator summary** (ALERT STATUS + alert list + key counts) before the full JSON, supports **`--json`** for machine output, and **exits 2 on CRITICAL** so it can gate a cron/CI alert. It remains **read-only** (only `values.get`).

## 4. No-write monitor tests
Added `scripts/test-mentor-monitor-alerts.js` (8 tests, fake/in-memory, writes throw):
read-only audit runs even when `update`/`append` throw; `unexpectedMutationsOutsideAllowlist>0`→CRITICAL; duplicate idempotency keys→CRITICAL; failed requests→WARNING/CRITICAL; multi-user allowlist parsing (0 when all allowed, >0 when one outside); rollover/pending write flags→CRITICAL; affected-real-plan drift→CRITICAL; clean steady-state→OK. `npm run test:mentor-monitor-alerts` added. **8/8 pass.**

## 5. Live monitor result (read-only)
```text
ALERT STATUS: OK   (no alerts)
MutationRequests: 13  (POSTPONE 6 / RESUME 5 / COMPLETE 2)
Canonical events: POSTPONE 7 / RESUME 6 / COMPLETE 2
Guardrails: unexpectedOutsideAllowlist=0  duplicateIdempotencyKeys=0  failed=0
Affected real plan (MP_1780920810055): {completed:5, snoozed:10}  (== expected)
Allowlist size: 1  |  rollover/pending write flags: false/false
```
**Delta accounting vs the 9H2 spec's "expected 13":** `MentorMutationRequests = 13` = the 3 original `T9B2` rows (9B2/9D/9G2) + 10 added during the 9H2 live-route diagnosis/validation (6 POSTPONE + 5 RESUME + 2 COMPLETE across the multiple live clicks; one POSTPONE was a non-completing reservation, hence canonical POSTPONE events 7 ≥ mutation rows 6). All are test-user-scoped (`unexpectedMutationsOutsideAllowlist=0`), none duplicated, none failed. `MentorTaskLogs` grew correspondingly from the same live exercises. The affected real plan never changed.

## 6. main/deploy process note
Documented in the env checklist (and here): **Production deploys from `main`. Mentor V2 work must be merged into `main` before its production env flags can activate it; flags on a Preview/feature branch have no effect on production. Vercel bakes env vars at build time — Redeploy after any env change.** This is the root cause that gated 9H2.

## 7. No-live-write confirmation
This phase performed **zero** live writes. The monitor and live verification use only `values.get`; all new tests use fake/in-memory data. `MentorMutationRequests` (13), `MentorTaskLogs`, and the affected real plan (`{completed:5, snoozed:10}`) are unchanged from end-of-9H2. Rollover/pending lifecycle write flags remain false.

## 8. Tests / build result
`test:mentor-monitor-alerts` 8/8 (new) · route-readiness 12 · v2-complete 21 · v2-complete-design 13 · pending-ui 9 · pending-surfacing 11 · v2-resume 18 · v2-cohort 8 · v2-postpone 20 · read-overlay 13 · mutation-service 11 · state-machine 45 · rollover 67 · repo 22 · sheets 36 · sheets-writer 23 · plan-day 25 · optimization 42 — **404 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 9. Controlled cohort-expansion recommendation
Documented as a procedure in the env checklist. In short:
1. Confirm monitor `ALERT STATUS: OK` + clean latest report; take a fresh `.xlsx` backup.
2. Append the new user's `u_` hash to `MENTOR_V2_MUTATION_ALLOWED_USER_HASHES`; **Redeploy** (env applies at build).
3. Validate that user's snooze→pending / resume→active / quiz-complete on the live route (as in 9H2), watching `unexpectedMutationsOutsideAllowlist` stay 0.
4. Expand in small increments; wire the monitor as a scheduled read-only check (it exits 2 on CRITICAL) for alerting.
5. Keep `MENTOR_DAILY_ROLLOVER_V2` / `MENTOR_PENDING_LIFECYCLE_V2` OFF — those need their own controlled write-phase.
Optionally enable `MENTOR_REPO_V2=true` (global read overlay, validated in 8C) when ready for the all-user canonical-day/pending UX.

## 10. Blocking items
- **Blocking:** None.
- **Non-blocking follow-ups:** wire `scripts/mentor-v2-mutation-monitor.js` into a scheduled job for continuous alerting; commit the Phase 9I additions to `main` (operator docs + monitor alerts + tests) when approved; decide timing for `MENTOR_REPO_V2=true`; design the daily-rollover write phase before enabling it.

---

*Phase 9I complete — production hardening, cleanup, and rollout guardrails. No live mutation, no flag change, no deploy, affected real plan untouched, rollover/pending writes not enabled, no commit/push without approval.*
