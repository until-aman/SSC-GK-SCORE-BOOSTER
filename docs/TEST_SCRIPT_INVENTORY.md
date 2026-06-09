# Test Script Inventory (Step 15)

All under `scripts/`. None contain credentials or real user emails; none write to production Sheets (all are pure in-process/mock harnesses or read-only). Safe to keep for the Step-16 regression baseline.

## Regression test harnesses (KEEP — read-only, deterministic)
| Script | Covers | Status |
|---|---|---|
| `test-inflight-dedup.js` | Step 5 client cache in-flight dedup | keep |
| `test-sheets-inflight-dedup.js` | Step 6 server Sheets read dedup (real module) | keep |
| `test-dashboard-optimization.js` | Step 7 dashboard | keep |
| `test-mentor-api-optimization.js` | Step 8 mentor (updated: today-plan removed) | keep |
| `test-history-api-optimization.js` | Step 9 history (updated: filters removed) | keep |
| `test-analysis-api-optimization.js` | Step 10 analysis | keep |
| `test-saved-api-optimization.js` | Step 11 saved (real service module) | keep |
| `test-profile-api-optimization.js` | Step 12 profile/streak/onboarding/dream-post | keep |
| `test-ai-api-optimization.js` | Step 13 AI (updated: summary removed, fetchAI removed) | keep |
| `test-public-read-api-optimization.js` | Step 14 public reads (updated: prefetch removed) | keep |
| `test-cleanup-and-route-safety.js` | Step 15 cleanup/route safety | keep (new) |

## Diagnostics / utilities (KEEP)
- `summarize-api-diagnostics.js` — parses `[apidiag]` logs; needed for Step 16/17.

## One-time migration scripts (KEEP, not run in CI)
- `migrate-sheets.js`, `migrate-to-subject-tabs.js` — historical Sheet migrations. Not destructive by default in normal flow; retained for reference. **Do not run against production without explicit confirmation.**
- `gen-icons.js` — build-time asset helper.

## Safety
- No `process.env` secret printing; no hardcoded emails; harnesses use mock data/stores or real **pure** modules (`serverCache`, `aiRequestDedup`, `savedQuestionsService`, `sheetsReadDedup`).
- The two `migrate-*` scripts are the only ones that could touch Sheets; they are manual-run, not part of `test-*`, and not invoked by build/CI.

## Removed test references
The four removed routes' assertions were updated in their harnesses to assert **removal** instead of deprecation (no harness reads a deleted file).
