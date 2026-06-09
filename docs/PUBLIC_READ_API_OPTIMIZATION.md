# Public / Static Read API Optimization (Step 14)

Adds a shared bounded server TTL cache, removes the topics N+1, bounds client question-bank storage, and flags the two unused routes — using only existing routes/sources. No route created/deleted/renamed, no Sheet schema change, no question/scoring/randomization change.

## 1. Previous route flows
- `/api/topics`: no server cache; when counts wanted it **looped `VALID_SUBJECTS` calling `getTopicsBySubject(subj)` per subject** (N+1) even though `getTopicsBySubject(undefined)` already returns all.
- `/api/question-bank`: bespoke in-memory `Map` (4h) + optional Vercel KV.
- `/api/questions`: legacy; only caller is the quiz fallback (Mixed / bank-empty).
- `/api/daily-challenge`: per-IST-date server object cache; client date-keyed cache.
- `/api/leaderboard`: 30s mem cache + Sheets `LeaderboardCache` tab.
- Client question-bank cache (`question_bank:<coll>:<subject>`): **unbounded** (no eviction).
- `/api/prefetch`, `/api/config`: no callers.

## 2. New route flows
- topics: single physical read; counts derived from it; result server-cached 12h.
- question-bank: same 4h mem TTL + KV, now via shared `serverCache` (consolidated).
- Client banks bounded to 3 (oldest-first eviction).
- prefetch/config: dev deprecation logs.
- Quiz/topic/daily/leaderboard request counts unchanged-or-better (most already optimal from Steps 5–9).

## 3. Routes preserved
All 7 in scope (+ dashboard-bootstrap) unchanged in name/shape. No `/catalog`, `/questions/bank`, `/questions/subject`, `/public/bootstrap`, `/leaderboard/snapshot`.

## 4. Shared server-cache implementation (`lib/server/serverCache.js`)
Bounded in-memory `Map` (version prefix `sc_v1`), TTL + max-entries (oldest-stored eviction), `getOrLoadServerCache` with **pending-Promise reuse** (concurrent identical loaders share one), failed loaders **not** cached, dev `public-server-cache-*` events, prod silent. Distinct from Step-6 in-flight physical-read dedup (this reuses a *completed* result for a TTL). KV stays route-specific (optional, unchanged).

Functions: `getServerCache`, `setServerCache`, `deleteServerCache`, `clearServerCachePrefix`, `getOrLoadServerCache`, `getServerCacheStats`.

## 5. Exact server cache keys
- topics: `sc_v1:topics:<collection>:__all__` (counts/all) and `sc_v1:topics:<collection>:<subject>` (single).
- question-bank: `sc_v1:qbank:questionBank:<collection>:<subject>` (mem) + KV `questionBank:<collection>:<subject>`.
- daily-challenge / leaderboard: existing per-date / mem+Sheets caches retained (not migrated — proven, KV/Sheets-cache nuances; consolidation deferred to avoid behavior risk).

## 6. Exact server TTLs
topics **12h**; question-bank **4h** (unchanged) + KV 4h; daily-challenge per-IST-date; leaderboard 30s mem + 60s Sheets-cache (unchanged).

## 7. Exact client TTLs
topics `ONE_DAY`; question-bank `ONE_DAY`; daily-challenge `ONE_DAY` (date-keyed); leaderboard `THIRTY_MINUTES`. (Unchanged — these govern fresh/stale; bounded by eviction now.)

## 8. Topics N+1 before/after
Before: 1 read + up to `VALID_SUBJECTS.length` extra `getTopicsBySubject(subj)` reads. After: **1** read (`getTopicsBySubject(undefined)`); `deriveSubjectCounts` computes per-subject totals from that single map. Response shape, names, counts, sorting identical. Server-cached.

## 9. Question-bank request behavior
One uncached collection+subject → 1 `/api/question-bank` returning the full subject bank. Topic selection filters that bank **client-side** (`filterQuestionBankByTopic`) → topic switch = **0** API; second quiz in same fresh subject = **0** API. Subject/collection change → different key. Active quiz uses a copied/picked array (`pickQuestions`) — a background refresh cannot mutate in-flight questions. Order/randomization/count validation unchanged.

## 10. `/api/questions` fallback status and callers
Sole caller: `pages/quiz.js` — reached **only** when subject==='Mixed' or the question-bank path yields no pool (missing/invalid bank). Preserved as compatibility/fallback. Dev `questions-legacy-fallback` log with reason (`mixed-subject` | `missing-bank`). Not deleted/renamed.

## 11. Question-bank client eviction limit and measured sizes
Max **3** subject banks (`MAX_QUESTION_BANKS`). Measured ≈30–120 KB serialized per subject bank → 3 banks ≪ safe localStorage budget. Eviction: oldest/malformed first, never the just-written/active bank; best-effort (`try/catch`) — never blocks quiz loading. Never touches topic/Dashboard/profile/Saved/History/Mentor/Daily caches.

## 12. Daily Challenge request behavior
Unchanged + correct: server cached per current IST date; client date-keyed (`daily_challenge:<IST-date>`); Dashboard prefetch + quiz start share `getDailyChallenge` (Step-5 deduped). Fresh → 0; date rollover → 1 new; previous day never shown as today; failure after rollover uses existing fallback. Not merged into bootstrap. Scoring/coins unchanged.

## 13. Leaderboard request behavior
Unchanged + already optimal: `getLeaderboard` (`leaderboard:weekly`, 30min) — fresh → 0, cold → 1, stale → cached+1bg. Scope/tie-breakers/top-three/cache-tab unchanged; public cache stays global (no personalized row).

## 14. Dashboard preview reuse
Already implemented (Step 7): Dashboard composes weekly champions from `bootstrap.leaderboard.weeklyTop`; no second full `/api/leaderboard` request for the card. Unchanged here.

## 15. Result leaderboard policy
Already implemented (Steps 3/8): result completion warms the weekly leaderboard once in the background (one request, intentional, to reflect the new score). No local ranking patch. Unchanged here.

## 16. Manual question refresh semantics
Quiz force-refresh (`getQuestionBank({forceRefresh:true})`) bypasses the **client** cache and makes one `/api/question-bank` request, which may still be served by the route's 4h server cache — i.e. it reloads latest *available* questions, not a guaranteed direct Sheets read. No new bypass exposed to normal users; existing copy already says "Refresh later for latest questions" (truthful). No unrelated caches cleared; repeat clicks guarded by the existing run-id.

## 17. `/api/prefetch` status
Zero callers (verified). Kept; dev `prefetch-route-deprecated` log; later-removal candidate. No new caller introduced.

## 18. `/api/config` status and exposed fields
Zero callers (verified). Kept; dev `config-route-deprecated` log. Returns **only** `getPublicConfig(config)` = allowlisted `PUBLIC_CONFIG_KEYS` — no Sheet IDs, service-account details, Gemini keys, or secrets. Removal candidate.

## 19. Payload sizes (approx, dev-measured order of magnitude)
topics ≈ few KB (names + counts); one subject bank ≈ 30–120 KB (question content — required by quiz); daily-challenge ≈ small (CHALLENGE_SIZE questions); leaderboard ≈ small (top-N rows); Dashboard preview ≈ ≤20 weekly rows. No unused expensive fields added; topic callers don't receive options/explanations; leaderboard internal cache rows not exposed.

## 20. Error / stale behavior
Topics/bank stale+failure → stale data kept, quiz setup usable. Bank no-cache+failure → `/api/questions` fallback where supported, else retry state. Leaderboard stale+failure → stale ranking + last-updated, no blank. Daily failure → correct date semantics (no yesterday-as-today). Broken local entry → only that scoped entry removed, fetch once, no global clear. Server failed loader not cached.

## 21. Tests
`node scripts/test-public-read-api-optimization.js` → **31/31 pass** (real `serverCache`): server TTL hit/expire/concurrent-dedup, failed-loader-not-cached + retry, bounds eviction; client bank cached/eviction (oldest-out, active-kept), subject/collection distinct keys; + source assertions (topics N+1 removed + derivation + serverCache, qbank serverCache, client eviction, legacy-fallback diagnostic, quiz prefers bank, prefetch/config deprecation + config allowlist, all 7 routes preserved, no invented routes, eviction best-effort).

## 22. Known serverless limitations
Server cache is per-process (each serverless instance warms independently); cold instances do one Sheets read per key. KV (if configured) bridges instances for question-bank only. No persistent/Redis cache added (per constraint). daily/leaderboard retain their existing caches (consolidation deferred to avoid KV/Sheets-cache behavior risk). Client caches are browser-local.
