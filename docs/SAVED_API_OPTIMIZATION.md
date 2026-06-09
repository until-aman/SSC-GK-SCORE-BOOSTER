# Saved Questions API & Cache Optimization (Step 11)

Mutations now patch the scoped IDs/list + History caches (no follow-up GET), guest migration is one idempotent batched POST, and all three routes share one identity/row helper — using only existing route names. No route created/renamed, no Sheet schema change, no scoring change, no History refactor, no UI redesign, no mutation through the read cache.

## 1. Previous Saved request flows
- Read: `getSavedQuestionIds` / `getSavedQuestions` (cache-aware, scoped, 10 min) — already existed.
- Save/unsave: direct `fetch` to `/api/saved-questions` (POST/DELETE) or `/api/saved-questions/toggle` from 6 screens; UI patched optimistically but **scoped IDs/list caches were not patched** → went stale until TTL, and saved-state in History lagged up to 10 min.
- Guest migration: a **loop of one POST per question** in `dashboard.js`.

## 2. New Saved request flows
- Read cold → 1 GET; fresh → 0; stale → cached + 1 background.
- Save/unsave → **1 mutation**, then IDs cache + list cache + visible UI + History caches patched/stale-marked. **0 follow-up GET.**
- Guest migration → **1 batched POST** `/api/saved-questions` (`{questions:[...]}`); guest keys cleared only on confirmed success.

## 3. Routes preserved
`GET|POST|DELETE /api/saved-questions`, `GET /api/saved-questions/ids`, `POST /api/saved-questions/toggle`. No `/action`, `/bulk`, or `/snapshot` created.

## 4. Route responsibilities
- `/api/saved-questions`: GET list · POST single-save **or** batch migration (`{questions:[]}`) · DELETE unsave.
- `/api/saved-questions/ids`: GET lightweight saved IDs.
- `/api/saved-questions/toggle`: POST save/unsave (`action`), authoritative against server state.

## 5. Shared server functions (`lib/server/savedQuestionsService.js`)
`normalizeQuestionId`, `buildSavedRow` (12-col A..L, exact order), `parseSavedRow`, `findSavedRowIndex`, `normalizeMigrationBatch` (dedup + validate + bound), `MAX_MIGRATION_BATCH=200`. Reused by all three routes (no duplicated parsing/identity).

## 6. Client helper functions (`lib/data/savedData.js`)
Reads: `getSavedQuestionIds`, `getSavedQuestions` (existing). Mutations: `toggleSavedQuestion`, `saveQuestion`, `unsaveQuestion`, `migrateGuestSavedQuestions`. Patching: `patchSavedIdsCache`, `patchSavedListCache`, `markSavedHistoryCachesStale`, `dropSavedCache`. Pending guard: per `scope|questionId|action`.

## 7. Question identity
Authenticated **email** (col A) + existing **questionId** (col B; client `id` alias normalized). No new identity format; legacy saved records stay connected.

## 8. Cache keys and TTLs
`saved_question_ids:<scope>` (10 min), `saved_questions:<scope>` (10 min), account-scoped (Step 4). Guest: `ssc_saved_questions` (+ legacy `savedQuestions`). Patched caches are written with a current timestamp so they stay fresh after a mutation.

## 9. Save behavior
One mutation (toggle `save` from History/review; `saveQuestion` POST from quiz). Idempotent: existing email+questionId → `{alreadySaved:true}`/`{isSaved:true,alreadySaved}`, no duplicate row. On success: add ID to IDs cache + item to list cache + mark History caches stale; visible UI patched. No GET.

## 10. Unsave behavior
One mutation (toggle `unsave`; `unsaveQuestion` DELETE from quiz/Saved page). Idempotent: absent → `{isSaved:false,alreadyUnsaved}`/`{notFound:true}`, no error loop. On success: remove ID + item from caches + mark History stale; UI patched. No GET.

## 11. Toggle behavior
`/toggle` computes against authoritative server state (reads A:B, then appends/deletes); client passes explicit `action` (not a blind flip). Returns `{success, data:{isSaved, alreadySaved?, alreadyUnsaved?}}`.

## 12. Batch guest migration
`POST /api/saved-questions` with `{questions:[...]}` (authenticated only). Server: `normalizeMigrationBatch` (dedup, validate, bound to 200), reads existing IDs **once**, appends only missing rows, returns `{ok, migrated, skipped, failed}`. Oversized payloads (>800) → 413. Client `migrateGuestSavedQuestions` merges migrated items into scoped caches; `dashboard.js` clears guest keys only on `ok`.

## 13. Server idempotency
Single save, toggle, and batch all check existing rows before append (email+questionId). **In-flight guards** (`saveInflight` on `/api/saved-questions`, `toggleInflight` on `/toggle`) keyed by `email|questionId|action` (or `email|batch`) share one check+write promise per server instance, so concurrent double-clicks/retries can't both append. Documented limitation: Google Sheets has no unique index/transaction, so a cross-instance simultaneous first-save could (rarely) race; the existing-row check covers all normal retry/double-click cases.

## 14. Client pending guards
`savedData.js` keeps a per-`scope|questionId|action` pending `Map`; a repeated click for the same question+action reuses the in-flight promise. Opposite actions and different questions use different keys (never merged), so they proceed independently. Per-question pending means unrelated cards aren't frozen.

## 15. Saved page behavior (`pages/history/saved.jsx`)
Cold → 1 `GET /api/saved-questions` (helper); fresh → 0; stale → cached + 1 background. Unsave → 1 mutation via `unsaveQuestion`, item removed from state + scoped caches, **no list refetch**. Empty state and practice-selected sessionStorage flow unchanged.

## 16. Quiz saved-ID behavior (`pages/quiz.js`)
Fresh scoped IDs cache → 0 calls; cold → 1 `/api/saved-questions/ids`; overlapping reads deduped (Step 5). Bookmark save/unsave → `saveQuestion`/`unsaveQuestion` patch the scoped IDs (+ list) cache immediately; local `savedIds` Set still drives the quiz UI. Guest stays local-only; login uses the authenticated scoped cache.

## 17. History cache patching
After a successful save/unsave, `markSavedHistoryCachesStale(scope)` sets this scope's `history_questions:*`, `history_session:*`, and `history_landing` cache entries to `timestamp:0` (kept, not deleted). Next History open renders cached data + one background refresh — fixing the Step-9 ≤10-min saved-state lag. Other users' History caches untouched; quiz-session summaries not invalidated beyond the stale flag.

## 18. Guest behavior
Guest save/unsave stays local (`ssc_saved_questions`), no authenticated API call, no duplicates. On login: one `migrateGuestSavedQuestions` batched POST → merge into scoped caches → clear guest keys only on success. On failure: guest keys remain, retry possible, no partially-trusted authenticated cache.

## 19. Errors and rollback
Toggle/quiz screens patch UI optimistically and roll back on `!ok` (refetch or revert). Helper returns `{ok,...}`; on failure caches are not patched. Broken scoped cache → `dropSavedCache` removes only that scoped entry, then one GET; no global clear. A/B isolation via Step 4 scope; pending guards are per scope+question (no cross-account sharing).

## 20. Test results
`node scripts/test-saved-api-optimization.js` → **36/36 pass** (list/ids cold-fresh, save/unsave + already-state, concurrent save/unsave single-row, opposite actions, guest local, migration missing/skip/no-dup, repeat migration, migration-failure keeps guest keys, A/B isolation, broken-cache scoped removal, batch bound, 12-col Sheet compatibility, + source assertions). Uses the real `savedQuestionsService` for identity/row logic.

## 21. Known limitations
- In-flight guards are server-instance-local; cross-instance simultaneous first-save could rarely double-append (no Sheet unique constraint).
- `markSavedHistoryCachesStale` stale-marks (not field-level patches) History query/session caches — instant cached render + one background refresh, not zero-network.
- Patched IDs/list caches are browser-local; another device reflects changes within the 10-min TTL.
- Quiz player keeps its own `savedIds` Set as UI source of truth (caches patched alongside).
