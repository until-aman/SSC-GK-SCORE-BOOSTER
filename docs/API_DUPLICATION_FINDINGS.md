# API_DUPLICATION_FINDINGS

Audit-only. Evidence-based overlaps and wasteful flows. **No fixes proposed; no routes renamed/created/merged.** Each finding cites real files/lines.

## 1. `Users` tab read by multiple routes on one screen
- `/api/dashboard-bootstrap` (`pages/api/dashboard-bootstrap.js` → `fetchProfile` → `getUserRows`/`parseUserRow`) AND `/api/user-profile` (`pages/api/user-profile.js:52`) both read **Users** and both run on logged-in dashboard cold load (`pages/dashboard.js:548` + `lib/data/appData.js`).
- Evidence: `API_USER_JOURNEY_FLOWS.md` #3.

## 2. Dual-write of one quiz attempt (legacy + new persistence coexist)
- On quiz completion, `pages/result.js` calls **both** `/api/quiz-session/complete:235` (→ QuizSessions + AttemptAnswers) and `/api/score:378` (→ Scores).
- Two independent persistence systems for the same attempt; downstream, `Scores` powers leaderboard/score-history/analysis-activity while `QuizSessions`/`AttemptAnswers` power history/mentor.
- Evidence: `pages/result.js:235,378`; `API_SHEETS_ACCESS_MAP.md`.

## 3. Mutation followed by a full snapshot GET (mentor)
- `pages/mentor.js` `runTaskAction` POSTs `/api/mentor/task-action:598`, then calls `loadMentor({background:true})` which GETs `/api/mentor/plan:540` (a full snapshot rebuild) after every non-launch action.
- One full plan GET per task complete/snooze. Count of mutation-then-refetch flows: **1** distinct pattern (fires per action).

## 4. Cached data rendered but API still runs (mentor)
- `pages/mentor.js loadMentor` renders `readCachedSnapshot` first (`:513-517`) and then always fetches `/api/mentor/plan` (`:519-526`). The GET runs even when a fresh local snapshot exists.
- Contrast: `fetchWithClientCache` short-circuits on fresh cache; the mentor path does not use it.

## 5. Same user aggregates computed by multiple routes
- "Coins/level/profile" is computed in `/api/user-profile`, `/api/dashboard-bootstrap` (`fetchProfile`), and partially `/api/analysis-activity` (reads `Users.totalCoins`). Three routes derive overlapping user aggregates from **Users**.
- Quiz aggregates (counts/accuracy) computed both in `/api/score-history` (from Scores) and history routes (from QuizSessions/AttemptAnswers) and `/api/analysis-activity` (from Scores).

## 6. Saved-question behaviour split across a top-level route and nested routes
- `/api/saved-questions` (GET list, POST save), `/api/saved-questions/ids` (GET ids), `/api/saved-questions/toggle` (POST toggle) coexist. List/save and toggle are separate endpoints serving the same SavedQuestions tab.
- Evidence: `pages/api/saved-questions.js`, `saved-questions/ids.js`, `saved-questions/toggle.js`.

## 7. Legacy + newer routes coexist
- `/api/score` (legacy Scores write) coexists with `/api/quiz-session/complete` (new). `SHEET_NAMES.QUESTIONS = 'Questions'` marked "legacy — keep as backup" alongside per-subject/collection question sources.

## 8. Routes with no detected frontend caller (dead-to-frontend)
- `/api/config`, `/api/history/filters`, `/api/history/landing`, `/api/mentor/today-plan`, `/api/prefetch`, `/api/report-question`, `/api/ai/summary`.
- `/api/mentor/today-plan` duplicates `/api/mentor/plan` (both call `loadOrCreateMentorSnapshot` in `pages/api/mentor/plan.js`); only `/api/mentor/plan` is called.
- `/api/ai/summary` has a helper (`fetchAISummary`, `lib/fetchAI.js:77`) but **no UI consumer**.

## 9. History landing duplicated by separate granular calls
- `/api/history/landing` (one combined payload) exists but is unused; the history screen instead fires 3 separate GETs: `/api/history/summary`, `/api/history/quizzes`, `/api/history/subjects` (`pages/history/quizzes.jsx:543,564,577`). `/api/history/filters` also unused.

## 10. Same data under multiple cache keys
- Leaderboard cached under `CACHE_KEYS.WEEKLY_LEADERBOARD` (helper) and also fetched directly in `pages/leaderboard.js:157` (`/api/leaderboard?scope=weekly`) and warmed in `pages/result.js:303`. Mentor snapshot cached under both `mentor_snapshot_v3:*` (clientCache) and legacy `mentor_today_plan`/`mentor_profile_cache` keys (`pages/mentor.js`).

## 11. Multiple components calling the same API concurrently
- `/api/user-profile` GET is issued independently by `dashboard.js:548`, `profile.js:47`, `streak.js:108`, `onboarding.js:17` (each screen mount; no shared cache layer).
- `/api/saved-questions/toggle` POST is wired in 4 history screens with identical bodies.

## 12. Response fields not consumed by callers (sampling)
- `/api/analysis-activity` returns `isGuest` which the analysis page does not branch on (only `hasHistory` is used) — `pages/analysis.jsx`.
- `/api/dashboard-bootstrap` returns `collections` per-collection counts; dashboard uses a subset; `errors[]` array is returned but not surfaced in UI.
- (Sampling only — a full field-by-field consumption diff was not performed in this audit.)

## Caller → missing route
- **None.** No frontend call references a non-existent route.
