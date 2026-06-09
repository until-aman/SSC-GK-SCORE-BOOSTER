# Quiz Completion Consolidation (Step 3)

Consolidated the dual quiz-completion frontend flow into **one** canonical request, preserving all scoring, coins, history, leaderboard, retry, and Mentor behavior.

## 1. Previous flow
`pages/result.js` save effect fired **two** mutations on result mount:
1. `POST /api/score` → Scores write + Users coins/level/streak update; returned coin data → `coinsResult`.
2. Inside its `.then`, `saveQuizSession()` → `POST /api/quiz-session/complete` → QuizSessions + AttemptAnswers.

## 2. New flow
`pages/result.js` fires **one** mutation:
- `POST /api/quiz-session/complete` (via `saveQuizSession(result, sessionId, scoreFields)`), which now performs **all** completion persistence and returns the combined response consumed by `coinsResult`.
- `POST /api/score` is **no longer called** by the normal flow.

## 3. Exact writes performed by `/api/quiz-session/complete`
Order (after auth + answer validation):
1. **Dedup gate:** `quizSessionExists(clientSessionId)` → if exists, return `{ success:true, alreadySaved:true }` (no writes, no coins).
2. **`persistScore(...)`** (shared `lib/server/scorePersistence.js`):
   - read **Users**; create row if missing;
   - `hasDuplicateScore(duplicateCheckKey)` independent Scores dedup;
   - append **Scores** row (`appendScoreV2`, unchanged column order);
   - `updateUserCells` (streak, lastAttemptDate, totalCoins, level) + `updateUserAggregateStats`;
   - invalidate **LeaderboardCache** (fire-and-forget).
3. **Append QuizSessions** row (incl. `QuestionIdsList`, `AnswersSummaryJSON`).
4. **Append AttemptAnswers** rows (awaited, non-fatal — logs on failure, preserves prior behavior).

## 4. Exact combined response shape
```jsonc
{
  "success": true,
  "ok": true,
  "sessionId": "SESSION_…",        // QuizSessions SessionId
  "clientSessionId": "…",
  // present only on a fresh (first) completion:
  "coins": 0, "totalCoins": 0, "level": "Aspirant",
  "streakCount": 0, "lastAttemptDate": "YYYY-MM-DD",
  "isFirstQuizOfDay": true, "streakMilestone": null|{bonus,label},
  "profileSnapshot": { name,email,totalCoins,level,streakCount,lastAttemptDate,playedToday },
  // backward-compatible block:
  "data": { "sessionId","correct","incorrect","skipped","score","accuracy","coins" }
}
```
On an idempotent repeat: `{ "success": true, "alreadySaved": true }` (no coin fields — matches prior `/api/score` dedup behavior; UI shows no fresh coins).

## 5. Idempotency key
- **Primary gate:** `clientSessionId` via `quizSessionExists` (QuizSessions).
- **Independent Scores guard:** `duplicateCheckKey = md5(email|subject|topic|timeBucket(startedAt||clientSessionId||sessionId||completedAt))` via `hasDuplicateScore`; the Scores row also stores `clientSessionId`.
- Both already exist in the codebase; no Sheet structure changed.

## 6. Write ordering & rationale
`dedup gate → persistScore (Scores+Users) → QuizSessions → AttemptAnswers`.
- `persistScore` runs **before** the QuizSessions write so a later failure + retry converges: on retry, `quizSessionExists` is still false → re-enter → `hasDuplicateScore` blocks a second Scores/coins write → QuizSessions then writes. **Coins are never awarded twice.**

## 7. Partial-failure behavior
| Case | Behavior |
|---|---|
| persistScore throws (Sheets down) — before QuizSessions write | return **500** controlled error; nothing else written; client refresh retries idempotently |
| QuizSessions write fails after coins awarded | outer catch → **500**; retry: `quizSessionExists` false → `hasDuplicateScore` blocks double coins → QuizSessions writes |
| AttemptAnswers fails | logged, **non-fatal** (preserved fire-and-forget intent); response still success |
| Client disconnects after writes, before response | writes persisted; refresh → idempotent `alreadySaved` |
| persistScore validation fails (bad score fields) | logged (dev), completion still saves session; response omits coin fields |

**Limitation (documented):** Google Sheets has no multi-table transaction. Cross-sheet atomicity is approximated by ordering + the two independent dedup guards. We do **not** claim true atomicity.

## 8. Compatibility status of `/api/score`
- **Still a valid route**, now backed by the same `persistScore` function.
- Emits `[Deprecated API] /api/score called` in development only.
- **No frontend caller remains** (verified by repo search). Kept for compatibility; to be removed in a later cleanup step.

## 9. Consumers (unchanged, still preserved)
- **Scores:** leaderboard, `/api/score-history` (Coins history), `/api/analysis-activity`, profile coins/level.
- **QuizSessions:** History (`getUserSessions`), Mentor plan, retry-metadata dedup.
- **AttemptAnswers:** History question/mistakes views, Mentor weak-topic detection.
- **Users:** profile coins/level/streak, dashboard, analysis coins.

## 10. Why all four datasets are still preserved
The consolidation **adds** the Scores/Users writes into the canonical route via the extracted function with identical inputs, formula (`calculateCoins`), column order (`appendScoreV2`), level thresholds (`computeLevel`), and streak logic (`computeStreak`). QuizSessions + AttemptAnswers writes are unchanged. So every downstream consumer keeps receiving the exact same data; only the **number of frontend requests** dropped from 2 → 1.
