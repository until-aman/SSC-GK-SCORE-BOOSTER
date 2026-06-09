# Current API Architecture (post Step 15)

**42 API route files** after cleanup (was 46). No route created/renamed in Steps 1–15.

## 1. Active API routes
- **Auth:** `/api/auth/[...nextauth]`
- **Dashboard/Profile:** `/api/dashboard-bootstrap`, `/api/user-profile` (GET/PATCH), `/api/dream-post` (GET/POST)
- **Quiz content:** `/api/topics`, `/api/question-bank`, `/api/daily-challenge`
- **Quiz completion:** `/api/quiz-session/complete` (canonical), `/api/score-history`
- **Leaderboard:** `/api/leaderboard`
- **History:** `/api/history/landing`, `/quizzes`, `/questions`, `/subjects`, `/topics`, `/session/[sessionId]`, `/reattempt`, `/reattempt-filtered`, `/retry-metadata`
- **Mentor:** `/api/mentor/plan`, `/refresh`, `/generate`, `/profile`, `/task-action`, `/task-feedback`, `/quiz-return`, `/topics`
- **Saved:** `/api/saved-questions` (GET/POST/DELETE), `/saved-questions/ids`, `/saved-questions/toggle`
- **AI:** `/api/ai/explain`, `/api/ai/tip`, `/api/ai/result-insights`
- **Analysis/Interest:** `/api/analysis-activity`, `/api/notify-interest`, `/api/notify-series`
- **Misc:** `/api/feedback`, `/api/report-question`

## 2. Active compatibility routes
- `POST /api/score` — pre-`complete` clients; delegates to shared `persistScore` (idempotent). Dev deprecation log.

## 3. Active fallback routes
- `GET /api/questions` — Mixed-subject + missing/invalid question-bank fallback (quiz player).

## 4. Deprecated-but-retained routes
- `GET /api/config` — zero in-app callers; allowlisted public config only; retained pending external/health-check confirmation.

## 5. Removed routes (Step 15)
- `/api/ai/summary`, `/api/mentor/today-plan`, `/api/history/filters`, `/api/prefetch` (see `REMOVED_DEPRECATED_ROUTES.md`).

## 6. Shared client data services (`lib/data/`)
`appData.js` (dashboard bootstrap + warms profile cache), `profileData.js` (profile + Dream Post), `historyClientData.js`, `mentorData.js`, `savedData.js`, `analysisData.js`, `aiData.js`, `questionData.js`, `leaderboardData.js`. Reads use `fetchWithClientCache` (Step-5 in-flight dedup); mutations use raw fetch + cache patching.

## 7. Shared server services (`lib/server/`)
`scorePersistence.js` (score+coins, used by `/api/score` + `/complete`), `userProfileService.js` (`buildProfileResponse`), `historyService.js` (landing/subjects/pagination), `savedQuestionsService.js` (identity/rows), `sheetsReadDedup.js` (Step-6 in-flight physical-read dedup), `serverCache.js` (Step-14 bounded TTL cache), `aiRequestDedup.js` (Step-13 AI in-flight dedup). Diagnostics: `lib/apiDiagnostics.js` (`withApiTrace`, `markGemini`, Sheet op instrumentation).

## 8. Cache layers
- **Client:** `lib/clientCache.js` `fetchWithClientCache` (localStorage, account-scoped via `lib/userCacheScope.js`, `CACHE_VERSION=ssc_gk_v1`) + per-domain patch/stale helpers + Step-5 in-flight dedup.
- **Server:** `serverCache.js` (topics, question-bank mem layer; bounded TTL) + question-bank optional Vercel KV + Sheets `LeaderboardCache` tab + per-IST-date daily cache + Step-6 Sheets in-flight dedup.
- **AI:** `aiData.js` localStorage (7d question-level / 24h attempt-level, bounded) + client + server in-flight dedup.

## 9. Mutation / invalidation map
- Quiz completion (`/complete`) → patches Dashboard bootstrap + shared `user_profile` caches; marks History + Analysis-activity stale; warms leaderboard once.
- Mentor task-action → returns snapshot, client patches Mentor cache (no plan GET). Quiz-return → marks Mentor cache stale.
- Saved save/unsave → patches scoped IDs+list caches + marks saved-bearing History caches stale.
- Profile/Dream-Post mutations → patch their scoped caches.
- Interest CTA → idempotent; updates scoped interest flag.

## 10. Known limitations
Caches are browser/server-instance local (no persistent Redis; KV optional for question-bank only). Server cache per-process (cold instances do one Sheets read per key). Cross-instance Sheets concurrency has no transaction (mitigated by existing-row checks + in-flight guards). Account scope = non-reversible djb2 email hash. See per-step docs for details.
