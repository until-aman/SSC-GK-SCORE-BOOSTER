# Deterministic Test Results (Step 16)

Commit `5d402bb`, Node v24.15.0. All harnesses are **non-destructive**: in-process only, no network calls, no data writes, safe anywhere. None contain secrets or real emails.

| Script | Passed | Failed | Runtime | Network? | Writes? | Notes |
|---|---|---|---|---|---|---|
| `test-inflight-dedup.js` | 19 | 0 | ~0.6s | no | no | Step 5 client cache dedup |
| `test-sheets-inflight-dedup.js` | 21 | 0 | ~0.6s | no | no | Step 6 — real `sheetsReadDedup` module |
| `test-dashboard-optimization.js` | 34 | 0 | ~0.4s | no | no | Step 7 |
| `test-mentor-api-optimization.js` | 42 | 0 | ~0.4s | no | no | Step 8 (today-plan removed) |
| `test-history-api-optimization.js` | 33 | 0 | ~0.6s | no | no | Step 9 (filters removed) |
| `test-analysis-api-optimization.js` | 40 | 0 | ~0.4s | no | no | Step 10 |
| `test-saved-api-optimization.js` | 36 | 0 | ~0.4s | no | no | Step 11 — real `savedQuestionsService` |
| `test-profile-api-optimization.js` | 45 | 0 | ~0.3s | no | no | Step 12 |
| `test-ai-api-optimization.js` | 32 | 0 | ~0.3s | no | no | Step 13 (summary + fetchAI removed) — real `aiRequestDedup` |
| `test-public-read-api-optimization.js` | 30 | 0 | ~0.3s | no | no | Step 14 — real `serverCache` (prefetch removed) |
| `test-cleanup-and-route-safety.js` | 52 | 0 | ~0.3s | no | no | Step 15 cleanup/route safety |
| **TOTAL** | **384** | **0** | ~5s | — | — | — |

## Build & Lint
- `npm run build` → **success** (all 42 routes + 27 pages compiled).
- `npm run lint` → **pass**, only the 2 long-standing pre-existing warnings (`onboarding-slides.js:92`, `quiz-setup.js:240`, both `react-hooks/exhaustive-deps` missing `router`).

## Not run (require live credentials / accounts — not destructive-by-default but environment-gated)
- `scripts/migrate-sheets.js`, `scripts/migrate-to-subject-tabs.js` — one-time manual Sheet migrations; **NOT** run (would touch Sheets). No CI/build invocation.
- `scripts/summarize-api-diagnostics.js` — utility to parse `[apidiag]` logs; needs a captured `dev-diag.log` from a live dev run (not available here).

## Conclusion
All critical deterministic harnesses pass (384/384). No harness failed → manual/staging regression may proceed (Phase O onward) on an environment with real Sheets/Gemini/accounts.
