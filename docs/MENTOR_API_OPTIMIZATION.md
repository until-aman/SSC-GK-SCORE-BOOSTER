# Mentor API & Cache Optimization (Step 8)

Reduces Mentor API traffic using only existing route names. No route created/renamed, no Sheet schema change, no task-generation/scoring change, no UI redesign.

## 1. Previous Mentor request flow
- **Open:** read cached snapshot → render → **always** `GET /api/mentor/plan` (even when cache fresh).
- **Task action (complete/snooze/response):** `POST /api/mentor/task-action` → **then** `GET /api/mentor/plan` (full reload cascade).
- **Manual refresh:** `POST /api/mentor/refresh` (no extra GET — already fine).
- **Profile update + generate:** `PATCH /api/mentor/profile` → `POST /api/mentor/generate` (already wrote the scoped v3 snapshot) → navigate → `GET /api/mentor/plan` (redundant).
- **Quiz return:** `POST /api/mentor/quiz-return`; next Mentor open always did a plan GET.

## 2. New Mentor request flow
- **Fresh cache (≤10 min):** zero API calls.
- **Stale cache:** render cached snapshot immediately + **one** background `GET /api/mentor/plan`; on failure stale data stays.
- **Cold (no cache / new date):** one `GET /api/mentor/plan`.
- **Task action (complete/snooze/response):** **one** `POST /api/mentor/task-action`; the route returns the authoritative snapshot; client patches state + cache. **Zero** plan GET.
- **Manual refresh:** one `POST /api/mentor/refresh`; response replaces UI + cache. Zero plan GET.
- **Profile update + generate:** `PATCH /api/mentor/profile` → `POST /api/mentor/generate` → snapshot cached fresh → navigate → **zero** plan GET.
- **Quiz return:** one `POST /api/mentor/quiz-return` → mark cache stale (no delete, no immediate GET); next open renders cached + one background refresh.

## 3. Routes preserved
All current names unchanged: `plan`, `refresh`, `generate`, `profile`, `task-action`, `task-feedback`, `quiz-return`, `topics`, `today-plan`. No `/api/mentor/snapshot` or `/api/mentor/action` created.

## 4. Cache key
`mentor_snapshot_v3:<scope>:<IST-date>` where `<scope>` = `guest` | `u_<djb2(email)>` (Step 4 account scope). Centralized in `lib/data/mentorData.js` (`mentorCacheKey`).

## 5. Freshness TTL
**10 minutes** (`MENTOR_FRESH_MS`, equivalent to `CACHE_TTL.TEN_MINUTES`). Dynamic — even though the key has a date, tasks change during the day, so a one-day window is not used. Freshness = `_cachedAt` (client write-stamp) when present, else server `lastSyncAt`; `_cachedAt:0` ⇒ explicitly stale.

## 6. Cold / fresh / stale behavior
Cold → 1 plan GET, cache written. Fresh → 0 API, cached render. Stale → cached render + 1 background plan GET, replace on success, keep stale on failure.

## 7. Task-action response changes
For non-`launch_practice` actions, `/api/mentor/task-action` now returns `{ success: true, snapshot }`, where `snapshot` is built by the **existing** `loadOrCreateMentorSnapshot(email)` (the same builder `GET /api/mentor/plan` uses). Because the active plan already exists, this reads the plan but does **not** regenerate — so it adds no new full-plan rebuild; it replaces the separate GET (net −1 HTTP request, same Sheet reads). `launch_practice` returns `{ success: true }` (navigates away). If snapshot assembly fails, returns `{ success: true }` and the client does one targeted plan GET.

## 8. Client patch logic by action type
- **complete / response:** server sets task `completed` (+ StudentTopicState theory/confidence); client replaces snapshot from `data.snapshot`.
- **snooze:** server sets `snoozed` + SnoozeCount increment; escalation (feedback/blocker at higher snooze counts) is computed inside the returned snapshot — so the client never has to replicate server logic.
- **launch_practice:** no patch, no GET (navigation).
- Guest mode (no email): unchanged local-only deterministic patch (no network).

## 9. Task-action request count before/after
Before: `task-action POST` + `plan GET` (2). After: `task-action POST` (1). −1 request per action.

## 10. Manual refresh request count
One `POST /api/mentor/refresh`, zero plan GET. Repeated clicks disabled via `refreshing` guard; identical simultaneous refreshes deduped in `lib/data/mentorData.js` (distinct mutations never merged — they share no dedup key).

## 11. Profile update + generate before/after
Before: PATCH + generate + **plan GET**. After: PATCH + generate + **0 plan GET** (generated snapshot written to `mentor_snapshot_v3:<scope>:<date>` with `_cachedAt`, so the Mentor mount sees it fresh). Generation algorithm unchanged; old visible tasks still cleared (`clearAllMentorCaches` + new snapshot only); historical performance preserved.

## 12. Standard quiz launch
`POST /api/mentor/task-action` (launch_practice) → navigate → quiz fetches `/api/questions?...`. No plan GET before navigation (unchanged; cascade never applied to launch).

## 13. Repeated-mistake launch
`POST /api/mentor/task-action` (launch_practice) + `POST /api/history/reattempt-filtered` → navigate to history-mode quiz. No third plan GET. `reattempt-filtered` stays a separate POST; sessionStorage payload unchanged; History API not merged.

## 14. Quiz-return cache behavior
`/api/mentor/quiz-return` returns no snapshot, so `pages/result.js` calls `markMentorCacheStale(getUserCacheScope(session))` on success — marks the scoped snapshot stale **without deleting it** and without any plan GET from the result page. Next Mentor open: cached render + one background refresh.

## 15. Task feedback
`POST /api/mentor/task-feedback` unchanged and separate from task-action. No plan refetch, no unrelated cache invalidation; TaskFeedback Sheet write preserved; duplicate submit guarded by existing ref.

## 16. Today-plan status
`/api/mentor/today-plan` has zero frontend callers and duplicates `/api/mentor/plan`. **Not deleted.** Added a dev-only deprecation log (`mentor-today-plan-deprecated`); response shape unchanged; no new callers routed to it. Later-removal candidate.

## 17. Error behavior
- Plan read fails + stale cache → keep showing stale plan, non-blocking error, no blank page.
- Plan read fails + no cache → existing error/retry, no loop (mount effect runs once per status/scope).
- Task action fails → throws before patch; cache untouched; controls re-enabled (`busyTaskId` cleared); existing error toast.
- Cache parse fails → only the broken scoped entry removed (`readMentorSnapshotCache`), then one plan fetch; no global clear.
- Account change → Step 4 scoping; never reads another account's snapshot.

## 18. Tests
`node scripts/test-mentor-api-optimization.js` → **41/41 pass**: cold/fresh/stale/stale-failure, complete/snooze/response (1 POST, 0 GET), standard + repeated-mistake launch, manual refresh, profile+generate (0 plan GET), quiz-return (stale-mark + next-open background), feedback, A/B isolation, date change, broken JSON, freshness units, and source assertions (cascade removed, freshness gate present, task-action returns snapshot, result marks stale, today-plan deprecation, zero today-plan callers).

## 19. Known limitations
- 10-min freshness: a task changed on another device appears after ≤10 min or manual refresh.
- task-action returns the snapshot by re-reading the active plan in the same request (no regeneration) — equal Sheet reads to the old GET, −1 HTTP request; not a zero-read deterministic patch (chosen for guaranteed behavior parity, esp. snooze escalation).
- In-flight dedup + cache are browser/server-instance local (Steps 4–6).
- Guest mode keeps its existing local-only flow.

## 20. Action still requiring a targeted refresh
None on the normal path. Only the **fallback** when the server cannot assemble a snapshot (rare error) does one targeted `GET /api/mentor/plan`.
