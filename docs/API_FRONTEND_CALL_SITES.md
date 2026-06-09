# API_FRONTEND_CALL_SITES

Audit-only. Every frontend network call site, derived from `grep "fetch("` / `/api/` and the shared helpers.

Legend:
- **Helper** = goes through `fetchWithClientCache` (`lib/clientCache.js`) or `fetchAI*` (`lib/fetchAI.js`); these check localStorage cache before the network and skip the call when fresh.
- **Direct** = raw `fetch()`, no cache layer.
- "Cache check before call": Yes only when routed through `fetchWithClientCache`.

## Shared-helper call sites (cache-aware)

| Route | Method | File:Line | Function | Trigger | Cache key / TTL | Cache checked | API runs when cached |
|-------|--------|-----------|----------|---------|-----------------|---------------|----------------------|
| `/api/dashboard-bootstrap` | GET | `lib/data/appData.js:7` | `getDashboardBootstrap` | dashboard mount | `DASHBOARD_BOOTSTRAP` / ONE_DAY | Yes | only if stale/force |
| `/api/leaderboard` | GET | `lib/data/leaderboardData.js:7` | `getLeaderboard` | leaderboard/result mount | `WEEKLY_LEADERBOARD` / 30 min | Yes | only if stale/force |
| `/api/topics` | GET | `lib/data/questionData.js:11` | `getTopics` | quiz-setup | per-params key | Yes | only if stale/force |
| `/api/daily-challenge` | GET | `lib/data/questionData.js:34` | `getDailyChallenge` | dashboard prefetch / start | key | Yes | only if stale/force |
| `/api/question-bank` | GET | `lib/data/questionData.js:49` | `getQuestionBank` | quiz-setup | per-params key | Yes | only if stale/force |
| `/api/saved-questions/ids` | GET | `lib/data/savedData.js:29` | `getSavedQuestionIds` | quiz / saved screens | `saved_question_ids` / 10 min | Yes | only if stale/force |
| `/api/saved-questions` | GET | `lib/data/savedData.js:40` | `getSavedQuestions` | saved screen | `saved_questions` / 10 min | Yes | only if stale/force |
| `/api/ai/explain` | POST | `lib/fetchAI.js:37` | `fetchAIExplain` | result/detailed, history | n/a (POST helper) | No | always |
| `/api/ai/tip` | POST | `lib/fetchAI.js:55` | `fetchAITip` | `pages/result/detailed.js:268` | n/a | No | always |
| `/api/ai/summary` | POST | `lib/fetchAI.js:77` | `fetchAISummary` | **no UI consumer** | n/a | No | n/a |

## Direct `fetch()` call sites

| Route | Method | File:Line | Trigger | Body / Query | Response fields used |
|-------|--------|-----------|---------|--------------|----------------------|
| `/api/dream-post` | GET | `components/DreamPostCard.jsx:41` | card mount | — | dream post fields |
| `/api/dream-post` | POST | `components/DreamPostCard.jsx:93` | save click | post body | ok |
| `/api/analysis-activity` | GET | `pages/analysis.jsx:170` | analysis tab mount (after session) | — | hasHistory, totalQuizzes, totalQuestions, coins, mostPracticed, lastQuizAt |
| `/api/notify-interest` | POST | `pages/analysis.jsx:190` | CTA click / autoRecord | `{collection:'AI Analysis'}` | success, alreadyJoined, guestBlocked |
| `/api/notify-interest` | POST | `pages/dashboard.js:460` | CTA click | `{collection}` | success/alreadyJoined |
| `/api/notify-interest` | POST | `pages/personal-ai-analysis.jsx:54` | CTA click | `{collection:'AI Analysis'}` | success/alreadyJoined/guestBlocked |
| `/api/notify-series` | POST | `pages/dashboard.js:399` | CTA click | `{...}` | success |
| `/api/user-profile` | GET | `pages/dashboard.js:548` | dashboard mount | — | name, totalCoins/level, streak, image |
| `/api/user-profile` | GET | `pages/onboarding.js:17` | mount | — | isNewUser, name |
| `/api/user-profile` | PATCH | `pages/onboarding.js:38` | name submit | `{name}` | ok |
| `/api/user-profile` | GET | `pages/profile.js:47` | mount | — | profile fields |
| `/api/user-profile` | GET | `pages/streak.js:108` | mount | — | streakCount |
| `/api/saved-questions` | POST | `pages/dashboard.js:533` | guest→login migration | `{questions}` | ok |
| `/api/saved-questions` | POST | `pages/quiz.js:637` | bookmark | `{question}` | ok |
| `/api/saved-questions` | POST | `pages/quiz.js:651` | bookmark | `{question}` | ok |
| `/api/saved-questions` | POST | `pages/history/saved.jsx:468` | save | `{question}` | ok |
| `/api/saved-questions/toggle` | POST | `pages/history/mistakes.jsx:278` | toggle | `{questionId}` | saved |
| `/api/saved-questions/toggle` | POST | `pages/history/questions.jsx:273` | toggle | `{questionId}` | saved |
| `/api/saved-questions/toggle` | POST | `pages/history/quizzes.jsx:813` | toggle | `{questionId}` | saved |
| `/api/saved-questions/toggle` | POST | `pages/history/session/[sessionId].jsx:243` | toggle | `{questionId}` | saved |
| `/api/score-history` | GET | `pages/history/coins.jsx:31` | mount | — | sessions, totalCoins |
| `/api/history/questions` | GET | `pages/history/mistakes.jsx:176` | mount/filter | query params | groups |
| `/api/history/questions` | GET | `pages/history/questions.jsx:163` | mount/filter | query params | groups |
| `/api/history/questions` | GET | `pages/history/quizzes.jsx:611` | drill-in | query params | groups |
| `/api/history/reattempt-filtered` | POST | `pages/history/mistakes.jsx:248` | practice click | filter body | questions |
| `/api/history/reattempt-filtered` | POST | `pages/history/questions.jsx:248` | practice click | filter body | questions |
| `/api/history/reattempt-filtered` | POST | `pages/history/quizzes.jsx:774` | practice click | filter body | questions |
| `/api/history/reattempt-filtered` | POST | `pages/mentor.js:758` | repeated-mistakes task | `{answerStatus,questionHistory,limit}` | questions, quizMode |
| `/api/history/reattempt` | POST | `pages/history/session/[sessionId].jsx:272` | reattempt click | `{sessionId}` | questions |
| `/api/history/summary` | GET | `pages/history/quizzes.jsx:543` | mount | — | totals |
| `/api/history/quizzes` | GET | `pages/history/quizzes.jsx:564` | mount/filter | query | sessions |
| `/api/history/subjects` | GET | `pages/history/quizzes.jsx:577` | mount | — | subjects |
| `/api/history/topics` | GET | `pages/history/quizzes.jsx:591` | subject select | `?subject=` | topics |
| `/api/history/session/[id]` | GET | `pages/history/session/[sessionId].jsx:188` | mount | path id | session detail |
| `/api/history/retry-metadata` | POST | `pages/result.js:248` | after retry save | `{clientSessionId,parentSessionId,attemptNumber}` | ok |
| `/api/ai/explain` | POST | `pages/history/questions.jsx:58` | explain click | question body | explanation |
| `/api/ai/explain` | POST | `pages/history/quizzes.jsx:382` | explain click | question body | explanation |
| `/api/ai/explain` | POST | `pages/history/session/[sessionId].jsx:91` | explain click | question body | explanation |
| `/api/ai/result-insights` | POST | `pages/result.js:493` | result mount | result body | insights |
| `/api/quiz-session/complete` | POST | `pages/result.js:235` | quiz completion | answers payload | data.sessionId, correct, etc. |
| `/api/score` | POST | `pages/result.js:378` | quiz completion (legacy, parallel) | score payload | coins/level |
| `/api/mentor/quiz-return` | POST | `pages/result.js:435` | result mount (mentor source) | `{taskId,planId}` | ok |
| `/api/mentor/task-feedback` | POST | `pages/result.js:1029` | feedback click | `{taskId,...}` | ok |
| `/api/feedback` | POST | `pages/result.js:649` | feedback submit | `{feedback}` | ok |
| `/api/mentor/plan` or `/api/mentor/refresh` | GET / POST | `pages/mentor.js:540` | mentor mount / manual refresh | — | snapshot (plan, tasks, progress) |
| `/api/mentor/task-action` | POST | `pages/mentor.js:598` | complete/snooze/launch | `{taskId,planId,actionType,actionValue,subject,topic}` | success |
| `/api/mentor/generate` | POST | `pages/mentor.js:668` | unlock next day | `{unlockNextDay}` | snapshot |
| `/api/mentor/generate` | POST | `pages/mentor-setup-edit.js:248` | Update Plan | — | snapshot |
| `/api/mentor/profile` | GET | `pages/mentor-setup-edit.js:142` | edit mount | — | profile |
| `/api/mentor/topics` | GET | `pages/mentor-setup-edit.js:143` | edit mount | — | topics |
| `/api/mentor/profile` | PATCH | `pages/mentor-setup-edit.js:205` | save | profile body | ok |
| `/api/mentor/profile` | POST | `pages/mentor-setup.js:152` | setup save | profile body | ok |
| `/api/leaderboard` | GET | `pages/leaderboard.js:157` | mount/scope | `?scope=` | entries |
| `/api/questions` | GET | `pages/quiz.js:778` | quiz start | `?subject&topic&collection` | questions |
| `/api/topics` | GET | `pages/quiz-setup.js:280` | subject select | `?subject&collection&includeCounts=false` | topics |

## Notes
- `pages/result.js:303` builds `/api/leaderboard?scope=weekly` through `fetchWithClientCache` (warm cache for result page).
- `pages/result/detailed.js:268,276` consume `fetchAITip` / `fetchAIExplain`.
- `pages/history/session/[sessionId].jsx:313` uses `router.push('/api/auth/signin')` (navigation, not a fetch).
- Direct `fetch()` call sites in pages/components: **53**. Shared-helper (`fetchWithClientCache`) sites: **10**. `fetchAI*` consumers: **2**.
