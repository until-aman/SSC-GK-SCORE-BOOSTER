# Regression State Preparation (Step 16)

Procedures for the **staging/manual** regression pass (to be executed where a dev server + real test Sheets + test accounts exist). In the Step-16 code/harness environment these states are modeled by the deterministic harnesses (mock localStorage stores + scope hashing), not a live browser.

## Test identities
1. **Guest** — `userMode=guest` cookie; no NextAuth session.
2. **User A** — authenticated test account with saved questions, quiz history, Mentor plan, Dream Post.
3. **User B** — second authenticated test account (isolation checks).
4. **New-user** — fresh test account with no Users row (onboarding path).
5. **No-history** — authenticated account with empty history.

Use only test accounts / a test Google Sheet. Never mutate a real user destructively.

## Browser-state presets
- **Cold:** clear only the relevant `ssc_gk_v1:*` scoped entries for the target journey (precise `localStorage.removeItem`); **do not** blanket-clear when testing guest→login migration (preserve `ssc_saved_questions`).
- **Warm:** perform the journey once, then re-run — caches fresh (within TTL).
- **Stale (dev only):** rewrite a target cache entry's `timestamp` to `0` (helpers like `markUserProfileStale`, `markMentorCacheStale`, `markHistoryCachesStale` do this) → next read renders cached + 1 background refresh.
- **Broken-cache:** set one target key to malformed JSON (e.g. `{bad`) → reader removes only that scoped entry, refetches once.
- **Offline/failure (dev only):** DevTools offline or a route stub returning 5xx → confirm stale-fallback / non-blocking error, no loop.

## Diagnostics capture (staging)
```
npm run dev 2> dev-diag.log     # server [apidiag] events
# DevTools → Network + Console for client cache/journey/AI events
node scripts/summarize-api-diagnostics.js dev-diag.log
```
Never log/publish secrets, full emails, question text, prompts/responses, or personal history (the diagnostics layer already masks/omits these and is production-silent).

## Expected per-journey targets
Defined in `docs/API_BASELINE_MEASUREMENT.md` and `docs/API_OPTIMIZATION_FINAL_RESULTS.md`.
