# API_SHEETS_ACCESS_MAP

Audit-only. Google Sheet tab access derived from `range:` literals and helper names (`readHeaderSheet`, `appendMentorRows`, `values.get/append/update`) in `pages/api/**`, `lib/sheets.js`, `lib/historyData.js`, `lib/config/appConfig.js`.

## Known Sheet tabs (from constants + range literals)
`Scores`, `ParmarSeriesScores` (`SHEET_NAMES.PARMAR_SCORES`), `Users`, `Feedback`, `LeaderboardCache`, `SeriesNotifications`, `Daily_Challenge`, `MasterTopics`, `MasterSubjects`, `MentorProfile`, `TaskFeedback`, `Config`, `NotifyInterest`, `QuestionQualityLog`, `QuizSessions`, `AttemptAnswers`, `SavedQuestions`, `StudentTopicState`, `MentorPlans`, `MentorTasks`, `MentorTaskLogs`, `Questions` (legacy backup).

## Access map (tab → route/helper → R/W)

| Sheet tab | Read by | Written by | Helper(s) |
|-----------|---------|-----------|-----------|
| `Scores` | `/api/score-history`, `/api/analysis-activity`, `/api/dashboard-bootstrap` (leaderboard), `/api/leaderboard` | `/api/score` | `getLeaderboardData`, `appendScoreV2` (`lib/sheets.js:213,198`) |
| `ParmarSeriesScores` | `/api/leaderboard`, score history (merged) | — | `getLeaderboardData` (`sheets.js:380`) |
| `Users` | `/api/user-profile`, `/api/dashboard-bootstrap`, `/api/analysis-activity` (coins), `/api/dream-post` | `/api/user-profile` (name, image), `/api/dream-post`, score flow (coins/level) | `getUserRows`, `findUserRow`, `parseUserRow`, `updateUserCells` (`sheets.js:315,665,…`) |
| `Daily_Challenge` | `/api/daily-challenge` | daily challenge write | `sheets.js:411,450,461` |
| `LeaderboardCache` | `/api/leaderboard`, `/api/dashboard-bootstrap` | leaderboard cache writer | `getLeaderboardCacheRow` (`sheets.js:622,632`) |
| `Feedback` | — | `/api/feedback` | `sheets.js:646` |
| `MasterTopics` | `/api/topics`, `/api/mentor/topics`, mentor plan | — | `getMasterTopics` (`sheets.js:730`) |
| `MasterSubjects` | `/api/dashboard-bootstrap` (subjects) | — | `sheets.js:747` |
| `MentorProfile` | `/api/mentor/*` (profile, plan) | `/api/mentor/profile` upsert, plan-state | `getMentorProfile`, `upsertMentorProfile`, `getMentorProfileWithPlanState` (`sheets.js:764,806,835,1034`) |
| `StudentTopicState` | mentor plan generation, `/api/mentor/task-action` | `/api/mentor/task-action` (`upsertStudentTopicState`) | `getStudentTopicState`, `upsertStudentTopicState` (`sheets.js:1061,1067`) |
| `MentorPlans` | `/api/mentor/plan`, `refresh`, `generate` (`getActiveMentorPlan`) | `createMentorPlanSnapshot` (marks old `invalid`, appends new) | `sheets.js:1097,1122,1135` |
| `MentorTasks` | `/api/mentor/plan` (`getMentorTasksForPlan`) | `createMentorPlanSnapshot`, `updateMentorTaskStatus` | `sheets.js:1110,1151,1192` |
| `MentorTaskLogs` | — | `/api/mentor/task-action`, `refresh` (`appendMentorTaskLog`) | `sheets.js:1221` |
| `TaskFeedback` | — | `/api/mentor/task-feedback` | `sheets.js:872` |
| `Config` | `/api/config`, `getAppConfig` (used by `/api/quiz-session/complete` for APP_VERSION) | — | `readConfigFromSheet` (`appConfig.js:62`) |
| `NotifyInterest` | `/api/notify-interest` (dedup read) | `/api/notify-interest` | `notify-interest.js:26,40` |
| `SeriesNotifications` | — | `/api/notify-series` | `SHEET_NAMES.SERIES_NOTIFICATIONS` |
| `QuestionQualityLog` | `/api/report-question` (dedup) | `/api/report-question` | `report-question.js:37,100` |
| `QuizSessions` | history routes (`getUserSessions`), `/api/history/retry-metadata` dedup | `/api/quiz-session/complete`, `/api/history/retry-metadata` | `historyData.js`, `complete.js:86`, `retry-metadata.js:43` |
| `AttemptAnswers` | history routes (`getUserAttemptAnswers`), mentor plan (`buildSubjectHistory`/mistakes) | `/api/quiz-session/complete` (fire-and-forget) | `historyData.js:152`, `complete.js` |
| `SavedQuestions` | `/api/saved-questions`, `/saved-questions/ids`, history | `/api/saved-questions`, `/saved-questions/toggle` | `historyData.js:216`, saved-questions routes |
| `Questions` (legacy) | legacy fallback only | — | `SHEET_NAMES.QUESTIONS` |

## Approximate Sheets I/O volume
- `values.get` (read) operations across `pages/api` + `lib`: **29**.
- `values.append` + `values.update` (write) operations: **27**.
- Heaviest readers per request: `/api/dashboard-bootstrap` (Users + LeaderboardCache + MasterSubjects + per-collection topic counts), `/api/mentor/plan` (MentorProfile + StudentTopicState + MasterTopics + AttemptAnswers + MentorPlans + MentorTasks), history routes (QuizSessions + AttemptAnswers + SavedQuestions).
- `/api/quiz-session/complete`: 1 dedup read (QuizSessions) + 1 write (QuizSessions) + 1 fire-and-forget write (AttemptAnswers).
