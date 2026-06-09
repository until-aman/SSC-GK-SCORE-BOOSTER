# Client In-Flight Request Deduplication (Step 5)

Adds in-flight dedup to the existing cache-aware read layer. When two callers request the same read resource before the first network call resolves, only one request runs and both reuse the same Promise. No API route, response shape, TTL, UI, or server behaviour changed.

## 1. Registry location
`lib/clientCache.js` — a single module-level `const inflightReads = new Map()` (browser-tab-local, in-memory). Helper `inflightReadKey(...)` builds the dedup key; dev-only `__getInflightReadCount()` exposes the active count.

## 2. Deduplication-key format
`` `${method}|${cacheKey}|${url}` `` (method defaults to `GET`). The `cacheKey` already encodes account scope + params from Step 4, so the key is unique per resource **and** per account. `forceRefresh` is intentionally **not** in the key.

## 3. Fresh-cache interaction
Unchanged. A non-force caller with a fresh cache entry returns immediately **before** the dedup path — it never creates or reuses an in-flight entry (Test 4: zero fetches, zero in-flight entries).

## 4. Force-refresh interaction
Because `forceRefresh` is excluded from the dedup key:
- **normal + normal** → 1 network request, both get the result.
- **force + force** → 1 network request, both get the refreshed result (Test 6).
- **normal (needs network) while force active** → reuses the active request.
- **force while normal active** → reuses the active request (avoids a second strong-refresh).
A fresh-cache normal caller still short-circuits to cache and does not wait for an active refresh. **Decision:** dedup is by resource, not by refresh-strength — the goal is "one network request per resource at a time," not parallel strong refreshes.

## 5. Stale-fallback interaction
Preserved exactly. Each caller reads its own `cached` snapshot at entry. The shared Promise performs the network call + single cache write. On failure, every caller falls back to its own stale cache (Test 5). The Promise is removed from the registry on failure, so a later retry creates a new request.

## 6. Account-scope behavior
The dedup key includes the Step-4 account-scoped `cacheKey`, so User A and User B never share a Promise; different subject/collection/topic/date/leaderboard-scope never share (Tests 2, 3).

## 7. Reads covered (all current `fetchWithClientCache` consumers)
- `lib/data/appData.js` → `/api/dashboard-bootstrap`
- `lib/data/leaderboardData.js` → `/api/leaderboard`
- `lib/data/questionData.js` → `/api/topics`, `/api/daily-challenge`, `/api/question-bank`
- `lib/data/savedData.js` → `/api/saved-questions/ids`, `/api/saved-questions`
- `pages/quiz.js` (questions fetch), `pages/quiz-setup.js`, `pages/result.js` (leaderboard warm-up)

## 8. Mutations explicitly excluded
Dedup lives only inside `fetchWithClientCache` (reads). No mutation uses it: `/api/quiz-session/complete`, `/api/saved-questions` POST, `/api/saved-questions/toggle`, `/api/mentor/*` actions/generate/refresh/profile, `/api/notify-interest`, `/api/notify-series`, `/api/dream-post` POST, `/api/feedback`, history reattempt POSTs, AI POSTs. No direct GET was newly routed into the cache layer.

## 9. Failure cleanup
The entry is removed in a `.finally()` (on success and failure); the cleanup chain is `.catch(()=>{})`-guarded so it never surfaces as an unhandled rejection. Resolved Promises are never retained. The map cannot grow permanently. No timers, no new dependency.

## 10. Test results
`node scripts/test-inflight-dedup.js` → **19/19 pass** (Tests 1–8: identical cold reads share one fetch; different URLs/scopes don't; fresh cache → zero fetch; stale fallback for all callers + retry works; force+force → one fetch; failure cleanup + new request; mutations excluded).

## 11. Known limitations
- The harness mirrors the cache+dedup control flow (the repo has no test framework and `lib/clientCache.js` is ESM and not loadable standalone without the Next/babel toolchain); the production module uses the identical flow.
- Returned `data` is shared by reference among deduped callers. Current consumers only **read** the payload (no mutation), so no clone is performed; if a future consumer mutates a returned payload, clone at that call site.
- Dedup is per browser tab (in-memory) — it does not coordinate across tabs (by design).
