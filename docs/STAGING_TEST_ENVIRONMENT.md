# Staging Test Environment (Step 17)

> **STATUS: NOT PROVISIONED IN THIS RUN.** No staging deployment, no live Google Sheets credentials, no test service account, no Gemini key, and no test Google accounts (User A/B/new/no-history) were available in the execution environment. Therefore **no live read/write/load measurements were captured.** Per Step-17 Phase T, this step is classified **incomplete for measurement**, tooling + checklists are delivered, and broad public launch is **NO-GO** until these are captured on a real staging environment.

## To be filled in when staging is provisioned (template)
| Item | Value (fill on staging) |
|---|---|
| Git commit under test | `5d402bb` (current) |
| Git branch | `codex/premium-light-theme-phase-1` |
| Staging URL | _staging only — never the production host_ |
| Node | v24.15.0 |
| Next.js | 14.2.35 |
| Vercel plan/env | _preview/staging_ |
| Test Spreadsheet ID | _MASK in reports (e.g. `1AbC…X9`)_ |
| Sheet type | **must be staging-only or a disposable copy** — confirm before any write test |
| Test service account | _staging SA with access to the test Sheet only_ |
| Gemini | real test key OR fallback mode (record which) |
| KV | configured? (question-bank only) |
| Test accounts | User A / User B / new-user / no-history (all disposable) |
| Browser/version | _record_ |
| Network conditions | _record_ |
| IST date/timezone | _record (Daily Challenge / streak)_ |
| Rollback commit/tag | _record before launch_ |
| Sheet backup timestamp | _take before write tests_ |

## Hard gate (unchanged)
**No write/idempotency/load-write test may run until the connected Google Sheet is confirmed staging-only.** If only production data is available → read-only tests only; report the limitation; do not run destructive tests. Never print credentials or full Sheet IDs.
