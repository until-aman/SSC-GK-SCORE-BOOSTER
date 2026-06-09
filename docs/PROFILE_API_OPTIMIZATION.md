# Profile / Streak / Onboarding / Dream Post Optimization (Step 12)

Profile, Streak and Onboarding now share one account-scoped profile cache (warmed by the Dashboard bootstrap), and Dream Post is account-scoped + cache-aware — using only existing route names. No route created/renamed, no Sheet schema change, no coin/level/streak/Dream-Post formula change, no UI redesign, no mutation through the read cache.

## 1. Previous request flows
`pages/profile.js`, `pages/streak.js`, `pages/onboarding.js` each did an independent `fetch('/api/user-profile')` on mount (no client cache, re-fetched every visit). Onboarding always GET to check `isNewUser`. `DreamPostCard` did `fetch('/api/dream-post')` on every mount + POST on save. No shared profile cache (the Step-4 `user_profile` key was dead).

## 2. New request flows
- Profile/Streak: fresh shared cache → **0** API; stale → cached + 1 background GET; missing → 1 GET. Manual streak refresh → 1 force GET.
- Onboarding: existing/new proven by fresh cache → **0** redundant GET; uncertain → 1 GET (which also creates a new user's Users row).
- Dream Post: fresh → 0; stale → cached + 1 bg; missing → 1 GET. Save → 1 POST, cache patched, **0** follow-up GET.
- Quiz completion / profile/Dream-Post mutations → patch caches, **0** profile GET.

## 3. Routes preserved
`GET|PATCH /api/user-profile`, `GET|POST /api/dream-post`, `GET /api/dashboard-bootstrap`. No `/profile/snapshot`, `/profile/update`, `/streak`, `/onboarding`, `/dream-post/status` created.

## 4. Shared client helper (`lib/data/profileData.js`)
Profile: `getUserProfile`, `readUserProfileCache`, `writeUserProfileCache`, `patchUserProfileCache`, `markUserProfileStale`, `dropUserProfileCache`, `updateUserProfile`, `isCompleteProfile`. Dream Post: `getDreamPost`, `updateDreamPost`, `readDreamPostCache`, `patchDreamPostCache`, `markDreamPostStale`, `dropDreamPostCache`.

## 5. Shared server profile function (`lib/server/userProfileService.js`)
`buildProfileResponse(user, isNewUser)` — the single normalized profile object, reused by `/api/user-profile` and `/api/dashboard-bootstrap` (identical field set → interchangeable client cache). Selects already-parsed fields only; no Sheet/calculation change.

## 6. Normalized profile shape
`{ email, name, totalCoins, level, streakCount, lastAttemptDate, createdAt, image, isNewUser }`.

## 7. Cache keys and TTLs
`user_profile:<scope>` (10 min), `dream_post:<scope>` (10 min), account-scoped (Step 4), no email in keys. Dashboard bootstrap cache (`dashboard_bootstrap:<scope>`) remains and **also** writes `user_profile:<scope>` from a valid existing-user profile.

## 8. Cache completeness rules
`isCompleteProfile(p)` = `p.email` present **and** `isNewUser === false` (an existing user's full profile). A bare new-user marker `{isNewUser:true}` is incomplete for Profile/Streak display but sufficient for Onboarding's decision. The bootstrap profile has the same field set as `/api/user-profile`, so a warmed cache is always complete for display. The appData bridge only writes the shared cache for `isNewUser===false && email` profiles.

## 9. Profile page behavior
`getUserProfile({scope})`: fresh → 0; stale → cached render + 1 bg GET (keep stale on failure); missing → 1 GET + store. No direct `/api/user-profile` fetch remains.

## 10. Streak behavior
Reads the same shared cache (`getUserProfile`) — needs only `streakCount`/`lastAttemptDate`/`createdAt`, all present. `playedToday` + calendar derived client-side (unchanged). Fresh → 0; manual refresh → 1 force GET → updates shared cache. Streak rules unchanged.

## 11. Onboarding behavior
Existing user (cache `isNewUser:false`) → redirect, 0 GET. New user (cache `isNewUser:true`) → render, 0 GET. Uncertain (no cache) → 1 GET (creates the row for a genuinely new user). A transient read failure renders onboarding (existing safe behavior) — never a hard redirect from a failed read. Submission → `updateUserProfile` PATCH → patches cache `{name, isNewUser:false}` → navigate; no follow-up GET. Validation/auth unchanged.

## 12. Dream Post behavior
`DreamPostCard` uses `getDreamPost({scope})` (account-scoped, 10 min) — guest unaffected (card behaves as designed). Save → `updateDreamPost` (one POST, module in-flight guard prevents duplicate submit) → patches `dream_post:<scope>` cache; no follow-up GET. Target 8,000 / progress / write-once unlock / tag semantics / card design unchanged. Single source of truth = `dream_post:<scope>`.

## 13. Profile mutation cache patching
PATCH name → `patchUserProfileCache(scope, {name, isNewUser:false})` (safe merge, never writes undefined). Dream Post save → `patchDreamPostCache`. Both update the visible UI from the server response; no refetch.

## 14. Quiz-completion patching
`pages/result.js patchProfileCaches` patches **both** the Dashboard bootstrap profile (Step 7) **and** the shared `user_profile:<scope>` cache via a safe merge of `{totalCoins, level, streakCount, lastAttemptDate, isNewUser:false}`. No profile GET. Coins/level/streak become visible on Profile/Streak/Dashboard immediately.

## 15. Account isolation
All keys account-scoped (`u_<djb2(email)>`); User A's profile/streak/Dream Post never read for User B. Dream Post in-flight guard is module-level but the cache it patches is scoped.

## 16. Error behavior
Stale + read failure → stale profile/Dream Post stays visible, non-blocking. No cache + failure → existing error/render path, no loop, never assumes "new user". Broken scoped cache → `dropUserProfileCache`/`dropDreamPostCache` removes only that entry, then one read; no global clear. Session loading → pages gate on `status` before reading scoped cache. Account switch → Step 4 isolation.

## 17. Test results
`node scripts/test-profile-api-optimization.js` → **45/45 pass**: profile cold/fresh/stale/failure, mutation patch, streak fresh/force, onboarding known-new/existing/uncertain/submission, dream cold/fresh/save/resubmit, quiz-completion dual-cache patch, A/B isolation, broken-cache scoped removal, concurrent Profile+Streak dedup (1 network), + source assertions (routes preserved, Users columns unchanged, helper reuse, no direct fetches, raw-fetch mutations, appData bridge, result patch).

## 18. Known limitations
- Shared profile cache is browser-local; another device reflects changes within the 10-min TTL.
- New users still incur one `/api/user-profile` GET on onboarding (required — that GET creates the Users row).
- Dream Post POST is server-side write-once for `unlockedAt`; saving the same value rewrites M/N (updatedAt/value) but never the unlock timestamp — no new column added, idempotent on unlock.
- `markUserProfileStale`/`markDreamPostStale` are stale-marks (cached render + 1 bg), not field-level patches for cross-source changes.
