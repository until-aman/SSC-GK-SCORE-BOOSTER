# API Route Inventory — Post-Optimization (Step 15)

Rebuilt from the current `pages/api/**` tree (the Step-1 inventory is stale after Steps 2–14). **42 route files.** Recommendation legend: **A**=active keep, **F**=fallback keep, **C**=compatibility keep, **D**=deprecated-retained, **R**=removed this step.

| Route | File | Frontend caller(s) | Server caller | Writes? | Rec |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | auth/[...nextauth].js | NextAuth client | — | — | A |
| `/api/dashboard-bootstrap` | dashboard-bootstrap.js | appData.getDashboardBootstrap (dashboard.js) | — | no | A |
| `/api/user-profile` | user-profile.js | profileData (profile/streak/onboarding) | — | PATCH name | A |
| `/api/dream-post` | dream-post.js | profileData (DreamPostCard) | — | POST | A |
| `/api/topics` | topics.js | questionData.getTopics (quiz-setup/quizzes) | — | no | A |
| `/api/question-bank` | question-bank.js | questionData.getQuestionBank (quiz/quiz-setup) | — | no | A |
| `/api/questions` | questions.js | quiz.js (Mixed/missing-bank fallback only) | — | no | **F** |
| `/api/daily-challenge` | daily-challenge.js | questionData.getDailyChallenge (dashboard/quiz) | — | no | A |
| `/api/quiz-session/complete` | quiz-session/complete.js | result.js saveQuizSession (canonical) | persistScore | yes | A |
| `/api/score` | score.js | none in current build (old clients) | persistScore | yes | **C** |
| `/api/score-history` | score-history.js | historyClientData.getScoreHistory (coins) | — | no | A |
| `/api/leaderboard` | leaderboard.js | leaderboardData.getLeaderboard (leaderboard/dashboard) | — | no | A |
| `/api/history/landing` | history/landing.js | historyClientData.getHistoryLanding | buildHistoryLanding | no | A |
| `/api/history/quizzes` | history/quizzes.js | getHistoryQuizzes (filters) | paginateQuizSessions | no | A |
| `/api/history/questions` | history/questions.js | getHistoryQuestions (questions/mistakes) | — | no | A |
| `/api/history/subjects` | history/subjects.js | (landing covers initial) | buildSubjectRows | no | A |
| `/api/history/topics` | history/topics.js | getHistoryTopics | — | no | A |
| `/api/history/session/[sessionId]` | history/session/[sessionId].js | getHistorySession | — | no | A |
| `/api/history/reattempt` | history/reattempt.js | session detail | — | no(prep) | A |
| `/api/history/reattempt-filtered` | history/reattempt-filtered.js | questions/mistakes/mentor | — | no(prep) | A |
| `/api/history/retry-metadata` | history/retry-metadata.js | result/quiz flow | — | yes | A |
| `/api/mentor/plan` | mentor/plan.js | mentorData.fetchMentorPlan | loadOrCreateMentorSnapshot | no | A |
| `/api/mentor/refresh` | mentor/refresh.js | mentorData.fetchMentorRefresh | loadOrCreate… | yes(log) | A |
| `/api/mentor/generate` | mentor/generate.js | mentor-setup-edit / mentor (unlock) | loadOrCreate… | yes | A |
| `/api/mentor/profile` | mentor/profile.js | mentor-setup-edit | — | PATCH | A |
| `/api/mentor/task-action` | mentor/task-action.js | mentor.js | loadOrCreate… | yes | A |
| `/api/mentor/task-feedback` | mentor/task-feedback.js | result.js | — | yes | A |
| `/api/mentor/quiz-return` | mentor/quiz-return.js | result.js | — | yes | A |
| `/api/mentor/topics` | mentor/topics.js | mentor-setup-edit | — | no | A |
| `/api/saved-questions` | saved-questions.js | savedData (list/save/migrate/unsave) | savedQuestionsService | POST/DELETE | A |
| `/api/saved-questions/ids` | saved-questions/ids.js | savedData.getSavedQuestionIds | — | no | A |
| `/api/saved-questions/toggle` | saved-questions/toggle.js | savedData.toggleSavedQuestion | — | yes | A |
| `/api/ai/explain` | ai/explain.js | aiData.getAIExplanation | gemini + dedup | no | A |
| `/api/ai/tip` | ai/tip.js | aiData.getAITip | gemini + dedup | no | A |
| `/api/ai/result-insights` | ai/result-insights.js | aiData.getAIResultInsights (result) | gemini + dedup | no | A |
| `/api/analysis-activity` | analysis-activity.js | analysisData.getAnalysisActivity | — | no | A |
| `/api/notify-interest` | notify-interest.js | analysisData.recordAnalysisInterest | — | yes | A |
| `/api/notify-series` | notify-series.js | series interest UI | — | yes | A |
| `/api/feedback` | feedback.js | feedback UI | — | yes | A |
| `/api/report-question` | report-question.js | report UI | — | yes | A |
| `/api/config` | config.js | **none** (allowlisted public config) | getAppConfig (server-side helper used elsewhere) | no | **D** |
| `/api/ai/summary` | — | — | — | — | **R** |
| `/api/mentor/today-plan` | — | — | — | — | **R** |
| `/api/history/filters` | — | — | — | — | **R** |
| `/api/prefetch` | — | — | — | — | **R** |

**Recommendations:** A=37 active, F=1 (`/api/questions`), C=1 (`/api/score`), D=1 (`/api/config`), R=4 removed. (`getAppConfig`/`getPublicConfig` server helpers remain used; only the HTTP route is caller-less.)
