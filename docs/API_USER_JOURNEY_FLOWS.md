# API_USER_JOURNEY_FLOWS

Audit-only. Chronological request flows per journey, from the call sites in `API_FRONTEND_CALL_SITES.md`. "warm" = `fetchWithClientCache` fresh hit ⇒ no network.

### 1. Guest dashboard cold load
1. GET `/api/dashboard-bootstrap` (`lib/data/appData.js`, ONE_DAY TTL) — profile:null for guest.
2. (prefetch) `getDailyChallenge` → GET `/api/daily-challenge` (`pages/dashboard.js:170 prefetchDailyChallenge`).
- `/api/user-profile` is **skipped** for guests.

### 2. Guest dashboard warm load
1. `/api/dashboard-bootstrap` served from localStorage (fresh) — **no network**.

### 3. Logged-in dashboard cold load
1. GET `/api/dashboard-bootstrap`.
2. GET `/api/user-profile` (`dashboard.js:548`).
3. (prefetch) GET `/api/daily-challenge`.
- Overlap: both bootstrap and `/api/user-profile` read the **Users** tab (see DUPLICATION_FINDINGS #1).

### 4. Logged-in dashboard warm load
1. `/api/dashboard-bootstrap` warm (no network).
2. GET `/api/user-profile` still runs (direct fetch, **no cache layer**).

### 5. Quiz setup
1. GET `/api/topics?subject=&collection=&includeCounts=false` (`quiz-setup.js:280`).
2. (optionally) `getQuestionBank` → GET `/api/question-bank`.

### 6. Normal quiz start
1. GET `/api/questions?subject&topic&collection` (`quiz.js:778`).
2. (on bookmark) POST `/api/saved-questions` (`quiz.js:637/651`).

### 7. Daily Challenge start
1. `getDailyChallenge` → GET `/api/daily-challenge` (warm if prefetched on dashboard).

### 8. Quiz completion (Result page mount)
1. POST `/api/quiz-session/complete` (`result.js:235`) — writes QuizSessions + AttemptAnswers.
2. POST `/api/score` (`result.js:378`) — **legacy parallel write** to Scores.
3. POST `/api/ai/result-insights` (`result.js:493`).
4. `getLeaderboard('weekly')` → GET `/api/leaderboard?scope=weekly` (`result.js:303`, warm-cache).
5. If retry: POST `/api/history/retry-metadata` (`result.js:248`).
6. If mentor source: POST `/api/mentor/quiz-return` (`result.js:435`).
- **Dual-write overlap:** steps 1 & 2 both persist the same attempt (DUPLICATION_FINDINGS #2).

### 9. Result page load
- Same as #8 (Result is the post-quiz screen). `result/detailed.js` additionally calls `fetchAITip`/`fetchAIExplain`.

### 10. Saved-question save
1. POST `/api/saved-questions` (logged-in) OR localStorage (guest).

### 11. Saved-question unsave
1. POST `/api/saved-questions/toggle` (history screens).

### 12. Guest saved-question migration after login
1. POST `/api/saved-questions` with batched guest questions (`dashboard.js:533`).

### 13. History landing
- The `pages/history/quizzes.jsx` screen (the landing UI) issues, on mount:
  1. GET `/api/history/summary` (`:543`)
  2. GET `/api/history/quizzes` (`:564`)
  3. GET `/api/history/subjects` (`:577`)
- `/api/history/landing` and `/api/history/filters` exist but are **not called** (DUPLICATION_FINDINGS #9).

### 14. History questions
1. GET `/api/history/questions?…` (`questions.jsx:163`).

### 15. History quizzes
1. GET `/api/history/quizzes?…` (`quizzes.jsx:564`).

### 16. History mistakes
1. GET `/api/history/questions?…` (`mistakes.jsx:176`).
2. (practice) POST `/api/history/reattempt-filtered` (`mistakes.jsx:248`).

### 17. History session detail
1. GET `/api/history/session/[id]` (`session.jsx:188`).

### 18. History reattempt
1. POST `/api/history/reattempt` (`session.jsx:272`) OR POST `/api/history/reattempt-filtered` (list screens).

### 19. Mentor first load
1. GET `/api/mentor/plan` (`mentor.js:540`, no forceRefresh) → `loadOrCreateMentorSnapshot` (creates plan if none).

### 20. Mentor cached/repeated load
1. localStorage snapshot rendered first (`readCachedSnapshot`), then GET `/api/mentor/plan` runs anyway (DUPLICATION_FINDINGS #4).

### 21. Mentor task action
1. POST `/api/mentor/task-action` (`mentor.js:598`).
2. GET `/api/mentor/plan` via `loadMentor({background:true})` (`mentor.js`, after non-launch actions).
   - Reason: refresh snapshot after mutation. **Mutation-followed-by-GET** (DUPLICATION_FINDINGS #3). Potential duplicate: yes (one full snapshot GET per action).

### 22. Mentor task feedback
1. POST `/api/mentor/task-feedback` (`result.js:1029`).

### 23. Mentor quiz launch
1. POST `/api/mentor/task-action` (actionType `launch_practice`, `mentor.js:795`).
2. (practice) GET `/api/questions?…&collection=PYQ` via `/quiz` page.
   (repeated mistakes) POST `/api/history/reattempt-filtered` then `/quiz?mode=history`.

### 24. Mentor quiz return
1. POST `/api/mentor/quiz-return` (`result.js:435`) on result mount when source = mentor.

### 25. Mentor refresh / regenerate flow
- Refresh button: POST `/api/mentor/refresh` (`mentor.js:540`, forceRefresh).
- Update Plan (edit): PATCH `/api/mentor/profile` (`mentor-setup-edit.js:205`) → POST `/api/mentor/generate` (`:248`) → navigate `/mentor` → GET `/api/mentor/plan`.

### 26. Analysis tab as guest
1. GET `/api/analysis-activity` → `{hasHistory:false,isGuest:true}` (no further calls; logged-out view).

### 27. Analysis tab as logged-in user
1. GET `/api/analysis-activity` (`analysis.jsx:170`).
2. (CTA) POST `/api/notify-interest`.

### 28. Analysis interest CTA
1. POST `/api/notify-interest` `{collection:'AI Analysis'}` (`analysis.jsx:190` / `personal-ai-analysis.jsx:54`).

### 29. Profile load
1. GET `/api/user-profile` (`profile.js:47`).

### 30. Dream Post save/edit
1. GET `/api/dream-post` (mount), then POST `/api/dream-post` (save).

### 31. Leaderboard load
1. `getLeaderboard` → GET `/api/leaderboard?scope=weekly` (warm cache, 30 min).

### 32. Manual refresh actions
- Dashboard refresh → `getDashboardBootstrap({forceRefresh:true})`.
- Mentor "Refresh My Plan" → POST `/api/mentor/refresh`.
- Leaderboard refresh → `getLeaderboard({forceRefresh:true})`.
