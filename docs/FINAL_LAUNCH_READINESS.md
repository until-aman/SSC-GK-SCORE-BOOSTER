# Final Launch Readiness (Step 17)

## 1. Decision: **CONDITIONAL GO**
- ✅ **Code is launch-ready** for a **closed/monitored cohort on a staging or limited deployment**: no P0 blocker, 384/384 deterministic assertions pass, lint clean (2 pre-existing), build succeeds, all optimizations + cleanup verified by harness/code/build.
- ⛔ **NO-GO for broad/unrestricted public launch** until live staging measurements (manual journeys, real Sheet read/write counts, Gemini counts, load tests, write-idempotency-against-Sheet) are captured. These could **not** be run here (no staging deployment / test Sheets / test accounts) and must not be assumed.

This is a deliberate CONDITIONAL GO, not a default-GO-because-tests-passed: the gap is **unmeasured live behavior**, not a known defect.

## 2. Evidence
- Deterministic: 384/384 (`docs/DETERMINISTIC_TEST_RESULTS.md`).
- Build: success; 42 routes / 27 pages; zero refs to removed routes.
- Architecture: `docs/CURRENT_API_ARCHITECTURE.md`, `docs/API_OPTIMIZATION_FINAL_RESULTS.md` (labeled `[H]`/`[C]`/`[B]`; no fabricated `[M]`/`[L]`).
- Tooling + guards: `scripts/load-test/` (production-refusing, syntax-checked, guard-tested).
- Not captured: staging diagnostics, manual journeys, write verification, load results (their docs say so explicitly).

## 3. P0 blockers
**None.**

## 4. P1 blockers (must close before broad public launch)
1. **Live staging measurements not captured** — run manual journeys + `dev-diag.log` summary + load tests (Groups 1–4) on staging; fill `LOAD_TEST_RESULTS.md`, `MANUAL_STAGING_REGRESSION_RESULTS.md`, `STAGING_WRITE_VERIFICATION.md`. Owner: dev/QA.
2. **Write idempotency not confirmed against live Sheet rows** — run `write-idempotency.js` on a test Sheet; confirm no duplicate rows/coins. Owner: dev.
3. **Account isolation not manually confirmed live** — execute Phase K with User A/B on staging. Owner: QA.

## 5. Accepted P2 risks (launch with monitoring)
Browser/instance-local caches (no Redis); rare cross-instance write race (mitigated by existing-row checks + in-flight guards); `/api/score` + `/api/config` + `personal-ai-analysis.jsx` retained for compat/uncertainty; feedback/report need rate-limiting before broad launch; 2 cosmetic pre-existing lint warnings; djb2 AI-key collision (negligible).

## 6. Initial user cap
**Closed Cohort 1: 10–20 trusted users** on staging/limited deploy with monitoring. No broad public launch until P1 closed.

## 7. Monitoring plan
Track per cohort: 5xx rate, Google Sheets 429s, quiz-completion write success + duplicate-coin reports, account-data-leak reports, p95 latency, Gemini errors/rate-limits, corrupted Saved/History/Mentor reports, `/api/score` hit count.

## 8. Rollback trigger
Any of: duplicate score/coin reports, account-data leakage, >3% 5xx, frequent Sheets 429, quiz-completion failures, sustained p95 over threshold, Gemini cost/limit issue, corrupted user state.

## 9. Rollback procedure
Redeploy the tagged known-good commit (`5d402bb`); restore the pre-launch Sheet backup if writes were corrupted; disable the affected cohort; communicate.

## 10. Next architecture milestone
Capture staging measurements → run cohorts → if Sheets pressure/limits appear, plan **Supabase (or Postgres) migration** for Scores/Users/Saved/History (transactional, indexed, higher quota).

## 11. Supabase migration trigger
Sustained Sheets 429s, write contention/duplicates under real concurrency, p95 breaches, or daily attempts reaching low-thousands/day. Sheets is the MVP store, not the scale store.

## 12. Owner / action list
- Dev: provision staging + test Sheet/accounts; run load + diagnostics; fill result docs.
- QA: execute 83 manual journeys + account-isolation; sign off.
- Ops: env vars, backups, rollback tag, monitoring, privacy note, Sheet sharing lockdown, feedback/report rate-limit.
- Then: re-evaluate to **GO** for broad launch.
