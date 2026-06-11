# API_CURRENT_ROUTE_INVENTORY

Audit-only. Generated from the filesystem (`pages/api/**`). No runtime behaviour changed.

- **Total API route files:** 46
- **Total public routes:** 46 (one catch-all auth route, one dynamic route)
- Auth column: "session" = `getServerSession(req,res,authOptions)` required; "optional" = works for guests; "—" = none.

| # | Route | File | Methods | Auth | Purpose | Frontend callers (file:line) |
|---|-------|------|---------|------|---------|------------------------------|
| 1 | `/api/ai/explain` | `pages/api/ai/explain.js` | POST | session | Gemini explanation for a question | `lib/fetchAI.js:37`; `pages/history/questions.jsx:58`; `pages/history/quizzes.jsx:382`; `pages/history/session/[sessionId].jsx:91` |
| 2 | `/api/ai/result-insights` | `pages/api/ai/result-insights.js` | POST | session | Gemini insights for result page | `pages/result.js:493` |
| 3 | `/api/ai/summary` | `pages/api/ai/summary.js` | POST | session | Gemini quiz summary | `lib/fetchAI.js:77` (`fetchAISummary`) — **no UI consumer found** |
| 4 | `/api/ai/tip` | `pages/api/ai/tip.js` | POST | session | Gemini tip | `lib/fetchAI.js:55` → `pages/result/detailed.js:268` |
| 5 | `/api/analysis-activity` | `pages/api/analysis-activity.js` | GET | optional (guest → `hasHistory:false`) | Real activity aggregate from Scores | `pages/analysis.jsx:170` |
| 6 | `/api/auth/[...nextauth]` | `pages/api/auth/[...nextauth].js` | GET/POST | NextAuth | Auth (Google) | NextAuth client; `pages/history/session/[sessionId].jsx:313` (`/api/auth/signin`) |
| 7 | `/api/config` | `pages/api/config.js` | GET | — | Public config flags | **No caller found** |
| 8 | `/api/daily-challenge` | `pages/api/daily-challenge.js` | GET | optional | Daily challenge questions | `lib/data/questionData.js:34` |
| 9 | `/api/dashboard-bootstrap` | `pages/api/dashboard-bootstrap.js` | GET | optional | Combined dashboard payload (profile+leaderboard+collections) | `lib/data/appData.js:7` (`getDashboardBootstrap`) |
| 10 | `/api/dream-post` | `pages/api/dream-post.js` | GET, POST | session | Dream-post read/save (Users sheet) | `components/DreamPostCard.jsx:41` (GET), `:93` (POST) |
| 11 | `/api/feedback` | `pages/api/feedback.js` | POST | session | Result feedback | `pages/result.js:649` |
| 12 | `/api/history/filters` | `pages/api/history/filters.js` | GET | session | History filter options | **No caller found** |
| 13 | `/api/history/landing` | `pages/api/history/landing.js` | GET | session | History landing payload | **No caller found** |
| 14 | `/api/history/questions` | `pages/api/history/questions.js` | GET | session | Per-question history | `pages/history/mistakes.jsx:176`; `pages/history/questions.jsx:163`; `pages/history/quizzes.jsx:611` |
| 15 | `/api/history/quizzes` | `pages/api/history/quizzes.js` | GET | session | Session list | `pages/history/quizzes.jsx:564` |
| 16 | `/api/history/reattempt-filtered` | `pages/api/history/reattempt-filtered.js` | POST | session | Build reattempt set from filters | `pages/history/mistakes.jsx:248`; `pages/history/questions.jsx:248`; `pages/history/quizzes.jsx:774`; `pages/mentor.js:758` |
| 17 | `/api/history/reattempt` | `pages/api/history/reattempt.js` | POST | session | Reattempt a session | `pages/history/session/[sessionId].jsx:272` |
| 18 | `/api/history/retry-metadata` | `pages/api/history/retry-metadata.js` | POST | session | Link retry to parent session | `pages/result.js:248` |
| 19 | `/api/history/session/[sessionId]` | `pages/api/history/session/[sessionId].js` | GET | session | Single session detail | `pages/history/session/[sessionId].jsx:188` |
| 20 | `/api/history/subjects` | `pages/api/history/subjects.js` | GET | session | Subjects with history | `pages/history/quizzes.jsx:577` |
| 21 | `/api/history/summary` | `pages/api/history/summary.js` | GET | session | History summary totals | `pages/history/quizzes.jsx:543` |
| 22 | `/api/history/topics` | `pages/api/history/topics.js` | GET | session | Topics for a subject | `pages/history/quizzes.jsx:591` |
| 23 | `/api/leaderboard` | `pages/api/leaderboard.js` | GET | optional | Leaderboard (scope) | `lib/data/leaderboardData.js:7`; `pages/leaderboard.js:157`; `pages/result.js:303` |
| 24 | `/api/mentor/generate` | `pages/api/mentor/generate.js` | POST | session | Force-regenerate plan (supersedes old) | `pages/mentor-setup-edit.js:248`; `pages/mentor.js:668` |
| 25 | `/api/mentor/plan` | `pages/api/mentor/plan.js` | GET | session | Load-or-create active plan snapshot | `pages/mentor.js:540` |
| 26 | `/api/mentor/profile` | `pages/api/mentor/profile.js` | GET, POST, PATCH | session | Mentor profile read/upsert | `pages/mentor-setup-edit.js:142` (GET), `:205` (PATCH); `pages/mentor-setup.js:152` (POST) |
| 27 | `/api/mentor/quiz-return` | `pages/api/mentor/quiz-return.js` | POST | session | Record return from mentor quiz | `pages/result.js:435` |
| 28 | `/api/mentor/refresh` | `pages/api/mentor/refresh.js` | POST | session | Refresh plan (force) | `pages/mentor.js:540` |
| 29 | `/api/mentor/task-action` | `pages/api/mentor/task-action.js` | POST | session | Complete/snooze/launch/response | `pages/mentor.js:598` |
| 30 | `/api/mentor/task-feedback` | `pages/api/mentor/task-feedback.js` | POST | session | Task feedback | `pages/result.js:1029` |
| 31 | `/api/mentor/today-plan` | `pages/api/mentor/today-plan.js` | GET | session | Load-or-create snapshot (same as plan) | **No caller found** |
| 32 | `/api/mentor/topics` | `pages/api/mentor/topics.js` | GET | session | Master topics for setup | `pages/mentor-setup-edit.js:143` |
| 33 | `/api/notify-interest` | `pages/api/notify-interest.js` | POST | optional (guest → `guestBlocked`) | Record premium interest | `pages/analysis.jsx:190`; `pages/dashboard.js:460`; `pages/personal-ai-analysis.jsx:54` |
| 34 | `/api/notify-series` | `pages/api/notify-series.js` | POST | optional | Series notification interest | `pages/dashboard.js:399` |
| 35 | `/api/prefetch` | `pages/api/prefetch.js` | GET | — | Prefetch warmup | **No caller found** |
| 36 | `/api/question-bank` | `pages/api/question-bank.js` | GET | optional | Question bank counts/list | `lib/data/questionData.js:49` |
| 37 | `/api/questions` | `pages/api/questions.js` | GET | optional | Quiz questions | `pages/quiz.js:778` |
| 38 | `/api/quiz-session/complete` | `pages/api/quiz-session/complete.js` | POST | session | Persist session → QuizSessions + AttemptAnswers | `pages/result.js:235` |
| 39 | `/api/report-question` | `pages/api/report-question.js` | POST | session | Report a question → QuestionQualityLog | **No caller found** |
| 40 | `/api/saved-questions` | `pages/api/saved-questions.js` | GET, POST | session | Saved questions list / save | `lib/data/savedData.js:40`; `pages/dashboard.js:533`; `pages/quiz.js:637`,`:651`; `pages/history/saved.jsx:468` |
| 41 | `/api/saved-questions/ids` | `pages/api/saved-questions/ids.js` | GET | session | Saved question ids | `lib/data/savedData.js:29` |
| 42 | `/api/saved-questions/toggle` | `pages/api/saved-questions/toggle.js` | POST | session | Toggle save state | `pages/history/mistakes.jsx:278`; `pages/history/questions.jsx:273`; `pages/history/quizzes.jsx:813`; `pages/history/session/[sessionId].jsx:243` |
| 43 | `/api/score-history` | `pages/api/score-history.js` | GET | session | Score/coins history | `pages/history/coins.jsx:31` |
| 44 | `/api/score` | `pages/api/score.js` | POST | session | Legacy score write (Scores sheet) | `pages/result.js:378` |
| 45 | `/api/topics` | `pages/api/topics.js` | GET | optional | Topics for subject/collection | `lib/data/questionData.js:11`; `pages/quiz-setup.js:280` |
| 46 | `/api/user-profile` | `pages/api/user-profile.js` | GET, PATCH | session | User profile read / name update | `pages/dashboard.js:548`; `pages/onboarding.js:17` (GET), `:38` (PATCH); `pages/profile.js:47`; `pages/streak.js:108` |

## Routes with no detected frontend caller (7)
`/api/config`, `/api/history/filters`, `/api/history/landing`, `/api/mentor/today-plan`, `/api/prefetch`, `/api/report-question`, `/api/ai/summary`.

## Route-name mismatches
**None.** Every frontend `/api/` string resolves to an existing route file. No caller references a missing route.
