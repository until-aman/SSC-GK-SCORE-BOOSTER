# API_BASELINE_MEASUREMENT

Repeatable manual baseline for the **current** system (pre-optimization). Uses only existing routes (see Step 1 docs). All diagnostics are **development-only** and disabled in production.

## How to capture logs
1. Run dev and capture `console.debug` (diagnostics go to stderr):
   ```
   npm run dev 2> dev-diag.log
   ```
2. Perform a journey in the browser (and watch DevTools console for client `[apidiag]` lines).
3. Summarize:
   ```
   node scripts/summarize-api-diagnostics.js dev-diag.log
   ```

## Event format (all `console.debug`, tag `[apidiag]`)
- `{"kind":"api","requestId","route","method","user","statusCode","durationMs","cacheStatus","serverCacheHit","geminiCalled","sheetReads","sheetWrites","sheetTabs":[…],"errorCategory"}`
- `{"kind":"sheet","requestId","rw":"read|write","tab","range","operation":"values.get|append|update","durationMs","ok"}`
- `{"kind":"cache","status":"fresh-hit|stale-hit|miss|force-refresh|network-refresh|stale-fallback|write-success|write-failed|parse-failed","key","url","maxAgeMs","ageMs","ranNetwork","usedStale","forceRefresh"}`
- `{"kind":"journey","journey","route","trigger","cache","helper","user","ts"}`

## Coverage of this baseline build
- **Physical Sheet ops:** logged for **every** route (central wrapper in `lib/sheets.js getSheetsClient`).
- **Client cache decisions:** logged for **every** `fetchWithClientCache` call (`lib/clientCache.js`).
- **Route-level traces (requestId + duration + status + per-request Sheet counts):** wrapped routes — `/api/dashboard-bootstrap`, `/api/analysis-activity`, `/api/quiz-session/complete`, `/api/score`, `/api/mentor/plan`, `/api/mentor/task-action`.
- **Frontend journey markers:** history-landing 3-GET sequence (`pages/history/quizzes.jsx`). Other journeys are observable via server `api`/`sheet` events.
- **Un-wrapped routes:** still emit `sheet` events with `requestId:null` ("unassociated"). They can be wrapped later with the one-line `withApiTrace(route, handler)` HOF.

---

## Per-journey baseline checklist

For each: set browser/cache/login state, perform the action, record the row.

| State key | Meaning |
|---|---|
| Cache | clear localStorage = cold; keep = warm |
| Login | guest (no session) / logged-in |

### Journey table template (fill from summarizer + console)

| # | Journey | Browser/cache | Login | Expected route sequence (Step 1) | FE reqs | Sheet reads | Sheet writes | Gemini | Cache hits | Cache miss | Route ms | Sheet ms | Unexpected dups |
|---|---------|---------------|-------|----------------------------------|---------|-------------|--------------|--------|-----------|-----------|----------|----------|-----------------|
| 1 | Guest dashboard cold | cold | guest | `GET /api/dashboard-bootstrap` → prefetch `GET /api/daily-challenge` (unchanged by Step 7) | | | | | | | | | |
| 2 | Guest dashboard warm | warm | guest | (bootstrap from cache, no network) — unchanged | | | | | | | | | |
| 3 | Logged-in dashboard cold | cold | in | **Before Step 7:** `GET /api/dashboard-bootstrap` + `GET /api/user-profile` (Users ×2). **After Step 7:** `GET /api/dashboard-bootstrap` only (+ prefetch daily). | | | | | | | | | Step 7: dup `/api/user-profile` removed |
| 4 | Logged-in dashboard warm | warm | in | **Before Step 7:** bootstrap cache + `GET /api/user-profile`. **After Step 7:** profile ≤10 min → 0 network; profile >10 min → one background `GET /api/dashboard-bootstrap` (no `/api/user-profile`). | | | | | | | | | Step 7: profile freshness gate 10m |
| 5 | Quiz setup | warm | any | `GET /api/topics` (**Step 14:** single-read derivation, no N+1; 12h server cache). | | | | | | | | | Step 14: N+1 removed |
| 6 | Normal quiz start | warm | any | **Step 14:** `GET /api/question-bank` (per collection+subject) is canonical; topic switch / same-subject restart = **0 API** (client-side filter of cached bank, bounded to 3 banks). `GET /api/questions` only for Mixed / bank-failure fallback. | | | | | | | | | Step 14: bank canonical |
| 7 | Daily Challenge start | warm | any | `GET /api/daily-challenge` (date-keyed client+server; fresh → 0; rollover → 1) | | | | | | | | | unchanged |
| 8 | Quiz completion | n/a | in | **After Step 3:** `POST /api/quiz-session/complete` only (writes QuizSessions + AttemptAnswers + Scores + Users). *(Before Step 3: `complete` **+** `POST /api/score`.)* Separate concerns unchanged: insights, leaderboard warm, retry-metadata, mentor-return. | | | | | | | | | consolidated 2→1 |
| 9 | Result page | n/a | in | same as #8 (+ `fetchAITip`/`fetchAIExplain` on detailed) | | | | | | | | | |
| 10 | Save question | n/a | in | `POST /api/saved-questions` or `/toggle` (idempotent). **After Step 11:** patches scoped IDs/list + History caches; **0 follow-up GET**. | | | | | | | | | Step 11: cache-patch, no GET |
| 11 | Unsave question | n/a | in | `POST /api/saved-questions/toggle` or `DELETE /api/saved-questions` (idempotent). **After Step 11:** removes from scoped caches; **0 GET**. | | | | | | | | | Step 11: cache-patch, no GET |
| 12 | Guest saved migration | n/a | login | **Before Step 11:** loop of one POST per question. **After Step 11:** ONE batched `POST /api/saved-questions` `{questions:[]}` (dedup, append-missing, idempotent); guest keys cleared on success. | | | | | | | | | Step 11: 1 batched POST |
| 12b | Saved list / IDs | warm | in | `GET /api/saved-questions` / `/ids` via helper — cold 1 / fresh 0 / stale cached+1 bg (account-scoped, 10 min) | | | | | | | | | Step 11: cached |
| 13 | History landing | warm | in | **Before Step 9:** `GET summary` + `GET quizzes` + `GET subjects` (3 GETs, no cache). **After Step 9:** cold → 1 `GET /api/history/landing`; warm → 0; stale → cached + 1 bg landing. | | | | | | | | | Step 9: 3→1, account-scoped |
| 14 | History question list | warm | in | `GET /api/history/questions` via cache helper (fresh → 0, exact-query keyed) | | | | | | | | | Step 9: cached |
| 15 | History quiz list | warm | in | `GET /api/history/quizzes` via cache helper (default served by landing; filters keyed) | | | | | | | | | Step 9: cached |
| 16 | History mistakes | warm | in | `GET /api/history/questions` (distinct query key) (+practice POST) | | | | | | | | | Step 9: cached |
| 17 | History session detail | warm | in | `GET /api/history/session/[id]` via cache helper (cold 1 / warm 0, scoped) | | | | | | | | | Step 9: cached |
| 18 | History reattempt | n/a | in | `POST /api/history/reattempt` or `…/reattempt-filtered` (unchanged; not cached) | | | | | | | | | |
| 18b | Coins/score history | warm | in | `GET /api/score-history` via cache helper (cold 1 / warm 0; stale after quiz) | | | | | | | | | Step 9: cached |
| 19 | Mentor first load | cold | in | `GET /api/mentor/plan` (unchanged) | | | | | | | | | |
| 20 | Mentor repeated load (cache) | warm | in | **Before Step 8:** cached render **+** always `GET /api/mentor/plan`. **After Step 8:** fresh (≤10 min) → 0 API; stale → cached render + 1 background `GET /api/mentor/plan`. | | | | | | | | | Step 8: freshness gate |
| 21 | Mentor task complete | n/a | in | **Before:** `POST task-action` → `GET plan`. **After Step 8:** `POST /api/mentor/task-action` only (returns snapshot). | | | | | | | | | Step 8: cascade removed |
| 22 | Mentor task snooze | n/a | in | **Before:** `POST task-action` → `GET plan`. **After Step 8:** `POST /api/mentor/task-action` only. | | | | | | | | | Step 8: cascade removed |
| 23 | Mentor repeated-mistake practice | n/a | in | `POST /api/mentor/task-action` + `POST /api/history/reattempt-filtered` (no plan GET) | | | | | | | | | |
| 24 | Mentor quiz return | n/a | in | `POST /api/mentor/quiz-return` → mark cache stale (no immediate plan GET) | | | | | | | | | Step 8: stale-mark |
| 25 | Mentor profile update + generate | n/a | in | **Before:** PATCH + generate + `GET plan`. **After Step 8:** `PATCH /api/mentor/profile` → `POST /api/mentor/generate` → cached snapshot → **0** plan GET. | | | | | | | | | Step 8: no plan GET |
| 26 | Analysis guest load | n/a | guest | **Before Step 10:** `GET /api/analysis-activity` → `{hasHistory:false}`. **After Step 10:** **0 API** (static sample renders directly). | | | | | | | | | Step 10: guest 0-call |
| 27 | Analysis logged-in load | warm | in | **Before Step 10:** `GET /api/analysis-activity` every open. **After Step 10:** cold → 1; fresh (≤10 min) → 0; stale → cached + 1 bg. Account-scoped. | | | | | | | | | Step 10: cached |
| 28 | Analysis interest CTA | n/a | in | `POST /api/notify-interest` (idempotent: email+collection check + in-flight guard; 0 follow-up GET) | | | | | | | | | Step 10: idempotent |
| 29 | Profile load | warm | in | **Before Step 12:** `GET /api/user-profile` every visit. **After Step 12:** shared `user_profile:<scope>` cache (warmed by Dashboard bootstrap) → fresh 0 / stale cached+1bg / cold 1. | | | | | | | | | Step 12: shared cache |
| 29b | Streak load | warm | in | shared profile cache → fresh 0; manual refresh → 1 force `GET /api/user-profile` | | | | | | | | | Step 12: shared cache |
| 29c | Onboarding load/submit | n/a | in | **Before:** always `GET /api/user-profile`. **After Step 12:** fresh cache → 0 redundant GET; uncertain → 1 GET; submit `PATCH` patches cache, no follow-up GET. | | | | | | | | | Step 12 |
| 30 | Dream Post read/save | warm | in | **Before:** `GET /api/dream-post` per mount. **After Step 12:** account-scoped cache (fresh 0 / stale cached+1bg / cold 1); save → 1 `POST`, cache patched, **0 follow-up GET**. | | | | | | | | | Step 12: scoped cache |
| 31 | Leaderboard load | warm | any | `GET /api/leaderboard?scope=weekly` | | | | | | | | | |
| 32 | Manual refresh flows | warm | any | `forceRefresh` bootstrap (exactly 1 `/api/dashboard-bootstrap`, **no `/api/user-profile`** after Step 7) / `POST /api/mentor/refresh` / leaderboard force | | | | | | | | | |

## Step 5 — in-flight dedup (cache-aware reads)
After Step 5, two identical cache-aware reads issued before the first resolves
(same `method|cacheKey|url`, i.e. same resource + account scope) collapse to **one**
network request; both callers reuse the same Promise and the cache is written once.
Fresh-cache callers still short-circuit with zero network. Mutations are unaffected.
Watch for `[apidiag] {"kind":"cache","status":"inflight-new|inflight-reused|inflight-cleared|inflight-failed"}`.
Example targets: two `getDashboardBootstrap` (same scope) → 1 `/api/dashboard-bootstrap`;
prefetch + quiz-setup `getQuestionBank` (same collection/subject) → 1 `/api/question-bank`.

## Step 6 — server Sheets in-flight read dedup
Identical concurrent physical Sheets reads (`values.get`/`values.batchGet` with the
same spreadsheetId + range(s) + render options) now collapse to **one** Google API
read while in-flight; reused callers emit `[apidiag] {"kind":"sheet-dedup","event":"sheet-inflight-reused"}`.
Sequential identical reads remain separate (not a cache). **API request count is unchanged**;
physical **Sheet read count may decrease** for overlapping requests. Writes are never deduped.
Server-instance-local; no cross-instance coordination.

## Step 13 — AI routes (explain / tip / summary / result-insights)
All four AI routes are now `withApiTrace`-wrapped + `markGemini()` (traces show `geminiCalled:true`), with client cache + client/server in-flight dedup.
- **Result insights first open:** core completion unchanged; ≤1 result-level AI POST (user-triggered "Generate AI Analysis"); result mount itself = 0 AI POST.
- **Result insights repeat open / same attempt:** 0 POST (24h attempt-scoped cache, key `ai_r:v1:insights:<scope>:<sessionId>`).
- **Question explanation first expansion:** 1 explain POST (lazy, user tap); **repeat / reopen after navigation:** 0 POST (7d content-keyed cache `ai_q:v1:explain:<hash>`).
- **Tip:** only for skipped questions; 7d cache `ai_q:v1:tip:<hash>`.
- **Two simultaneous identical expansions:** 1 client POST + 1 Gemini execution (client + server dedup).
- **AI failure/timeout (3s):** Sheet/static fallback shown; failure NOT cached; score/stats still render.
- **/api/ai/summary:** no caller (unused; `ai-route-unused` dev log).

## Before/after comparison template

| Journey | Metric | Before (baseline) | After (target) | Delta |
|---------|--------|-------------------|----------------|-------|
| (journey) | FE requests | | | |
| | Sheet reads | | | |
| | Sheet writes | | | |
| | Gemini calls | | | |
| | Route ms (sum) | | | |
| | Duplicate calls | | | |

## Where to find logs
- **Server** events (`api`, `sheet`): terminal running `npm run dev` (stderr). Capture with `2> dev-diag.log`.
- **Client** events (`cache`, `journey`, and client-side `sheet` n/a): browser DevTools console.
- **Summary:** `node scripts/summarize-api-diagnostics.js dev-diag.log`.
