# History API & Cache Optimization (Step 9)

Collapses the History landing screen from three GETs to one, and makes all History reads account-scoped and cache-aware — using only existing routes. No route created/renamed, no Sheet schema change, no scoring change, no Mentor change, no reattempt-logic change, no UI redesign.

## 1. Previous landing request flow
`pages/history/quizzes.jsx` mount fired up to three direct GETs: `/api/history/summary`, `/api/history/quizzes?page=1&limit=3`, `/api/history/subjects` (the last on subject/topic/mistakes mode). Every visit re-fetched (no client cache). `/api/history/landing` existed but served a stale, unused shape and had no caller.

## 2. New landing request flow
All three mount loaders call one cache-aware `getHistoryLanding` (same scoped key). **Step 5 in-flight dedup collapses them to one `GET /api/history/landing` on cold load; warm load makes zero.** Filters/pages/topics/questions/session go through their own cache-aware helpers.

## 3. Routes preserved
All 11 History routes unchanged in name. `summary`, `quizzes`, `subjects` still serve filtered/paged/other callers. No `/api/history/snapshot` or `/items` created.

## 4. `/api/history/landing` response shape
```
{ success: true, data: {
    summary:  { totalQuizzes, totalQuestions, overallAccuracy, savedCount },   // getHistorySummary
    quizzes:  { sessions:[…≤3], total, page:1, hasMore, filterSummary },        // paginateQuizSessions (limit 3)
    subjects: [ { subject, questionCount, correctCount, wrongCount, skippedCount, accuracy, lastPracticedAt, statusLabel, statusTone, hasMistakes } ],
    generatedAt } }
```
Identical field shapes to the three legacy routes (reused, not reinvented).

## 5. Sheet reads used by landing — before/after
- **Before (3 requests):** summary read QuizSessions+SavedQuestions; quizzes read QuizSessions; subjects read AttemptAnswers → QuizSessions read up to 3× across requests.
- **After (1 request):** `buildHistoryLanding` runs `getHistorySummary` + `getUserSessions` + `getUserAttemptAnswers` in parallel; identical concurrent physical `values.get`s collapse via **Step 6** Sheets dedup → QuizSessions read effectively once, AttemptAnswers once, SavedQuestions once.

## 6. Shared server functions created (`lib/server/historyService.js`)
`paginateQuizSessions(sessions,{page,limit})`, `buildSubjectRows(attempts)`, `buildHistoryLanding(email)`, `HISTORY_LANDING_QUIZ_LIMIT=3`. `quizzes.js` and `subjects.js` were refactored to reuse the first two (no behavior change).

## 7. Client helper functions created (`lib/data/historyClientData.js`)
`getHistoryLanding`, `getHistoryQuizzes`, `getHistoryQuestions`, `getHistorySubjects`, `getHistoryTopics`, `getHistorySession`, `getScoreHistory`, `normalizeHistoryQuery`, `markHistoryCachesStale`, `dropHistoryCache`. All authenticated reads scoped via `buildUserScopedKey` + go through `fetchWithClientCache` (Step 5 dedup).

## 8. Cache keys (account-scoped: `<base>:<scope>`)
`history_landing`, `history_summary`, `history_quizzes:<normalized-query>`, `history_questions:<normalized-query>`, `history_subjects`, `history_topics:<subject>`, `history_session:<sessionId>`, `score_history`. Query keys use `normalizeHistoryQuery` (sorted params) for stability.

## 9. TTLs
Landing 10 min; quiz-list 10 min; question-list 10 min; subjects 10 min; topics 10 min; session detail 30 min; score history 10 min. (No one-day freshness for dynamic History.)

## 10. Cold/fresh/stale behavior
Landing: cold → 1 network; warm → 0; stale → cached render + 1 background refresh; failure-with-stale → keep stale data, no blank, no 3-call fallback.

## 11. Filtered quiz behavior
Default (all/page1/limit≤3) served from the landing payload. Any filter/expand → cache-aware `getHistoryQuizzes` keyed by exact normalized query; fresh → 0, else 1. Pagination/loading preserved; no unbounded client-side filtering.

## 12. Questions/mistakes behavior
`questions.jsx` routes through `getHistoryQuestions`; key includes the full normalized query so wrong/skipped/repeated/never_correct/subject/page never share data. Cold → 1, warm → 0. Mistakes view (`questionHistory=repeated`) gets a distinct key from the questions view. Grouping/sorting/pagination/saved state and AI/reattempt calls unchanged.

## 13. Session-detail behavior
`session/[sessionId].jsx` routes through `getHistorySession`, key `history_session:<sessionId>:<scope>`. Cold → 1, warm → 0; A/B never share; answer details, AI explanation, save toggle, reattempt unchanged. Dynamic route name unchanged.

## 14. Reattempt behavior
`POST /api/history/reattempt` and `/reattempt-filtered` untouched — never routed through the read cache. Payloads, question-selection logic, limits, sessionStorage handoff, quiz mode, navigation all preserved. Preparing a reattempt does not refetch History.

## 15. Retry metadata
`POST /api/history/retry-metadata` unchanged/separate. History caches that change come from the quiz-completion stale-mark (Phase M); no immediate refetch.

## 16. Quiz-completion invalidation
`pages/result.js` calls `markHistoryCachesStale(getUserCacheScope(session))` after a successful completion — sets landing/summary/subjects/score caches to `timestamp:0` (kept, not deleted) so the next History open renders cached data + one background refresh. Does not touch question banks, Dashboard public metadata, Daily Challenge, Saved, Mentor, or other users' caches.

## 17. Saved-state cache behavior
Saved/unsave still patches the visible item in place (existing behavior, unchanged); no full History list refetch is triggered. Saved-bearing question caches refresh naturally within their 10-min TTL. (General Saved API consolidation is deferred to a later step.)

## 18. Score-history behavior
`coins.jsx` routes `/api/score-history` through `getScoreHistory` (account-scoped, 10-min TTL); cold → 1, warm → 0; marked stale after quiz completion. Route name unchanged; not merged into landing.

## 19. Filters-route status
`/api/history/filters` has zero frontend callers and duplicates subjects/topics. **Not deleted** — dev-only `history-filters-deprecated` log added; response shape unchanged; later-removal candidate.

## 20. Payload size/bounds
Landing returns summary + **≤3** quiz sessions + subject aggregates only — no full answers, no full saved list, no AI explanations, no reattempt data. Comparable to the three legacy payloads combined (their first-page/limited slices), not larger.

## 21. Error behavior
Fresh → instant cached render, 0 calls. Stale → cached render + background landing refresh. Background failure → stale stays visible, non-blocking error, no blank. No cache → existing loader + 1 landing call (effect runs once per status/scope, no loop). Broken JSON → `dropHistoryCache` removes only that scoped entry, then one network read; no global clear. Unauthenticated/guest behavior unchanged; History cache is read only once user scope is known.

## 22. Tests
`node scripts/test-history-api-optimization.js` → **33/33 pass**: cold (1 landing, 0 legacy), warm (0), stale (render + 1 bg), failure-keeps-stale, filtered keys, subjects-from-landing, topics cache, questions/mistakes distinct keys, session cold/warm scoped, A/B isolation, quiz-completion stale-mark (A stale / B untouched), broken-cache scoped removal, + source assertions (no direct summary/subjects fetch, uses getHistoryLanding, landing uses buildHistoryLanding, limit 3, result marks stale, filters deprecation, zero filters callers, bounded payload).

## 23. Known limitations
- Per-query quizzes/questions caches aren't individually invalidated after a quiz (only landing/summary/subjects/score); a previously-viewed filtered list refreshes within its 10-min TTL.
- Saved-state in cached question lists may lag a toggle until TTL/refresh (visible item is patched immediately).
- Caches are browser/server-instance local (Steps 4–6); no cross-instance coordination.
- Landing relies on Step 6 Sheets dedup for single physical reads; if the three internal reads don't perfectly overlap, a small number of extra physical reads may occur (still ≤ the old 3-request total).
