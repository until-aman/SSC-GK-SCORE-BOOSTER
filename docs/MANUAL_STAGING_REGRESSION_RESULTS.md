# Manual Staging Regression Results (Step 17)

> **STATUS: NOT EXECUTED IN THIS RUN.** The 83 interactive journeys (Phase C) require a running staging app + test accounts (User A/B/new/no-history) + a browser session — none available here. They remain **code/test-harness verified** (Step 16: 384/384 deterministic assertions + successful build), **not manually verified**.

This file is the ready-to-run checklist. For each journey record: pass/fail · request sequence · request count · Sheet reads · Sheet writes · Gemini calls · latency · UI result · stale/fallback result · unexpected calls. **A journey is "passed" only when the intended data + request behavior are confirmed — not merely that the page loaded.**

## Journey checklist (expected behavior = `docs/API_OPTIMIZATION_FINAL_RESULTS.md`)
- **Dashboard (1–7):** guest cold/warm, logged-in cold/warm, stale profile, manual refresh, A→logout→B isolation.
- **Quiz setup/questions (8–17):** topics cold/warm, uncached subject, topic switch (0 calls), 2nd same-subject quiz (0), subject switch, Mixed/fallback (diagnostic), stale-bank+failure, manual reload, bank eviction (≤3).
- **Daily Challenge (18–22):** cold/warm, prefetch+start (1 via dedup), date-key, completion.
- **Quiz completion (23–27):** normal, duplicate same `clientSessionId` (idempotent), Daily, retry, Mentor-launched → 1 `complete`, no `/api/score` from frontend.
- **Saved (28–35):** save/repeat/unsave/repeat, Saved-page removal, guest local, batch migration, repeat migration → 1 mutation each, 0 follow-up GET.
- **History (36–45):** landing cold(1)/warm(0)/stale, filtered quizzes, questions, mistakes (distinct keys), session detail, reattempt, retry-metadata, score history.
- **Mentor (46–57):** cold(1)/fresh(0)/stale, complete/snooze/response (1 POST, 0 plan GET), standard + repeated-mistake launch, manual refresh, profile+generate (0 plan GET), quiz-return, feedback.
- **Analysis (58–65):** guest(0), logged-in cold(1)/warm(0)/stale, interest first/duplicate/alreadyJoined/failure.
- **Profile-related (66–72):** profile cold/warm/stale + edit, streak warm/refresh, onboarding existing/new/uncertain/submit, Dream Post cold/warm/save/resubmit.
- **AI (73–77):** wrong explanation first/repeat(0), skipped tip first/repeat(0), result insight first/repeat(0), simultaneous identical (1 Gemini), failure/fallback.
- **Leaderboard (78–83):** Dashboard preview (no full call), page cold/warm/stale, manual refresh, post-result warm-up.

Until executed on staging, treat all 83 as **pending manual confirmation**.
