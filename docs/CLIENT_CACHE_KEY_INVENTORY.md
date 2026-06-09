# CLIENT_CACHE_KEY_INVENTORY (Step 4)

Every browser-storage key found in the repo, classified. No API/TTL/UI/schema changes.
`fetchWithClientCache` keys are stored under the `ssc_gk_v1:` prefix (`CACHE_VERSION`).

## User-specific (must be isolated by account)

| Key / pattern | Files | Data | Owner | TTL | Action |
|---|---|---|---|---|---|
| `ssc_gk_v1:dashboard_bootstrap` → **`…:<scope>`** | `lib/data/appData.js`, `pages/dashboard.js` | profile + leaderboard + collections | guest/auth | ONE_DAY | **made user-scoped** |
| `saved_question_ids` → **`…:<scope>`** | `lib/data/savedData.js`, `pages/quiz.js` | saved IDs | auth | TEN_MINUTES | **made user-scoped** |
| `saved_questions` → **`…:<scope>`** | `lib/data/savedData.js`, `pages/history/saved.jsx` | saved list | auth | TEN_MINUTES | **made user-scoped** |
| `mentor_snapshot_v3:<email>:<date>` → **`…:u_<hash>:<date>`** | `pages/mentor.js`, `pages/mentor-setup-edit.js` | Mentor plan/tasks/progress | auth/guest | day | **scoped (hash, no email)**; legacy email form discarded |
| `mentor_snapshot_v2:account:<date>` | `pages/mentor-setup.js` (write), `pages/result.js` (guest read) | Mentor snapshot | **shared across accounts (leak)** | day | **cleared on account change** |
| `mentor_today_plan` | mentor.js, mentor-setup*.js, result.js | legacy plan cache | auth/guest | — | **cleared on account change** |
| `mentor_profile_cache` | mentor.js, mentor-setup*.js | legacy profile cache | auth | — | **cleared on account change** |
| `mentor_onboarded` | mentor-setup-edit.js | onboarded flag | auth | — | **cleared on account change** |
| `analysisInterestRecorded` | `pages/analysis.jsx`, `personal-ai-analysis.jsx` | local interest flag | auth | — | **cleared on account change** (server remains source of truth) |
| `ssc_revised_questions`, `ssc_understood_questions` | quiz.js, history/saved.jsx, result/detailed.js | per-account question states | auth | — | **cleared on account change** |
| `ssc_reminder_hour`, `ssc_reminder_scheduled` | notifications/reminder | personal reminder state | auth | — | **cleared on account change** |
| `ssc_gk_v1:user_profile` | `pages/result.js` (`patchProfileCaches`) | profile snapshot | auth | — | **cleared on account change** (write-only; no reader found) |
| `ssc_gk_v1:history` | `CACHE_KEYS.HISTORY` (constant) | — | — | — | **cleared on account change** (defensive; not actively written) |

## Public / static (remain global — verified no personalized fields)

| Key / pattern | Files | Action |
|---|---|---|
| `ssc_gk_v1:leaderboard:weekly` / `:<scope-of-board>` | `lib/data/leaderboardData.js`, `pages/leaderboard.js`, `result.js` | **keep global** — response is a public top-N list (no current-user row/rank field; verified `getWeeklyPlayers` reads only `name/image/totalScore`) |
| `ssc_gk_v1:daily_challenge:<date>` | `lib/data/questionData.js`, `quiz.js` | keep global (public questions) |
| `ssc_gk_v1:topics:*`, `ssc_gk_v1:question_bank:*`, `ssc_gk_v1:questions:*` | questionData.js, quiz.js, quiz-setup.js | keep global (public content) |
| `dailyChallengeQuestions` | quiz/dashboard | keep global (public) |
| `whatsapp_prompt_seen`, `ssc_onboarding_done`, `ssc_understood`/intro flags, `analysisRevealed`, `ssc_leaderboard_refresh_started_at`, `notification_bell_hint_seen`, `analysis_tab_tooltip_seen` | various | keep global (UX one-time flags, not account data) |

## Temporary quiz / session state (intentionally not user-scoped)

| Key | Files | Lifecycle | Action |
|---|---|---|---|
| `quizResult` (sessionStorage) | quiz.js, result.js | current quiz → result handoff | leave |
| `ssc_history_quiz_questions` (sessionStorage) | quiz.js, mentor.js | reattempt payload | leave |
| `ssc_mentor_return_context` (sessionStorage) | quiz.js, mentor.js, result.js | mentor-launched practice return | leave |
| `ssc_saved_quiz_questions` (sessionStorage) | quiz.js, history/saved.jsx | saved-quiz payload | leave |
| active quiz session (recovery) | quiz.js | timer/recovery | leave |

## Guest saved-question keys (preserved for migration)

| Key | Action |
|---|---|
| `ssc_saved_questions`, `savedQuestions` | **kept** (guest→login migration reads these); cleared by the migration after a successful sync, not by the scope reconcile |

## Authenticated key format
`<baseKey>:u_<djb2(lowercased email)>` — e.g. `saved_questions:u_1a2b3c`, `mentor_snapshot_v3:u_1a2b3c:2026-06-09`. Guest scope: literal `guest`.

---

## Step 15 — final active vs retired keys

**Active (account-scoped `:<scope>` unless noted):** `dashboard_bootstrap`, `user_profile`, `dream_post`, `saved_question_ids`, `saved_questions`, `history_landing`, `history_summary`, `history_quizzes:<query>`, `history_questions:<query>`, `history_subjects`, `history_topics:<subject>`, `history_session:<id>`, `score_history`, `analysis_activity`, `analysis_interest`, `leaderboard:weekly` (global), `daily_challenge:<IST-date>` (global), `topics:*`/`question_bank:*` (global, client), `mentor_snapshot_v3:<scope>:<IST-date>`, `ai_q:v1:*` / `ai_r:v1:*` (AI), `active_user_cache_scope` (scope marker).

**Guest (local, kept for migration):** `ssc_saved_questions` (canonical), `savedQuestions` (legacy — **read-only** for one-time migration, never written), `mentor_today_plan`, `mentor_profile_cache`, `mentor_snapshot_v2:guest:<date>`, `ssc_revised_questions`, quiz/session recovery keys.

**Retired / no longer written (Steps 4/7/10/12/13):**
- unscoped `user_profile` write (Step 7) — removed; key now used **scoped** as the shared profile cache.
- unscoped `dashboard_bootstrap` patch (Step 7) — now scoped only.
- `sessionStorage` `ai_result:<sid>` (Step 13) — replaced by scoped `ai_r:v1:insights:<scope>:<sid>`.
- unscoped `analysisInterestRecorded` write (Step 10) — replaced by scoped `analysis_interest:<scope>`. (Legacy unscoped key is still *read* once on mount only via the retained, unreachable `personal-ai-analysis.jsx`; no in-app writer.)

**Not removed (compat / guest / recovery):** legacy `savedQuestions` read, `mentor_snapshot_v2:guest` (guest mentor), quiz recovery keys, `active_user_cache_scope`. Removing these would break existing guests / in-progress sessions. No blanket `localStorage.clear()` is performed anywhere.
