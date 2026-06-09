# Dashboard API & Cache Optimization (Step 7)

Removes the duplicate `/api/user-profile` request from the Dashboard while preserving all Dashboard UI/behaviour. Uses only existing routes — no new/renamed route, no schema/scoring/leaderboard changes.

## 1. Previous request flow
- **Logged-in cold:** `GET /api/dashboard-bootstrap` **+** `GET /api/user-profile` (Users read **twice**) + prefetch `GET /api/daily-challenge`.
- **Logged-in warm:** bootstrap from scoped cache (no network) **+** `GET /api/user-profile` fired whenever the cached bootstrap had no `profile` (and on every mount the fallback could fire). Profile patched after a quiz went to the **unscoped** `dashboard_bootstrap` + dead `user_profile` keys, so the Dashboard (which reads the **scoped** key) never saw fresh coins without a network call.

## 2. New request flow
- **Guest cold:** `GET /api/dashboard-bootstrap` + `GET /api/daily-challenge` (only if daily cache missing).
- **Guest warm:** zero bootstrap/profile network; Daily Challenge zero if fresh.
- **Logged-in cold:** `GET /api/dashboard-bootstrap` only (+ daily if missing). **No `/api/user-profile`.**
- **Logged-in warm (profile ≤10 min):** zero network.
- **Logged-in warm (profile >10 min):** one **background** `GET /api/dashboard-bootstrap` to freshen coins/streak (cached profile renders instantly first). Still **no `/api/user-profile`.**
- **Manual refresh:** exactly one `GET /api/dashboard-bootstrap` (`forceRefresh:true`). No `/api/user-profile`.

## 3. Exact bootstrap fields used for profile
`profile.{ isNewUser, email, name, totalCoins, level, streakCount, lastAttemptDate, createdAt, image }`. Dashboard renders `name, image, level, totalCoins, streakCount, lastAttemptDate`; `isNewUser` drives the onboarding redirect. No field was invented; `isNewUser` is the same concept `/api/user-profile` already exposes (added to the bootstrap profile object so the new-user redirect survives without the second route). `/api/user-profile`'s own response is unchanged.

## 4. Removed `/api/user-profile` Dashboard call
`loadUserProfileFallback()` (which did `fetch('/api/user-profile')`) was replaced by `loadProfileViaBootstrap()`, which retries the **same** `/api/dashboard-bootstrap` route once (force-refresh). All five call sites updated. New-user accounts (no Users row) are detected from `bootstrap.profile.isNewUser` and routed to `/onboarding` without `/api/user-profile`.

## 5. Cache keys
- Dashboard bootstrap (account-scoped): `ssc_gk_v1:dashboard_bootstrap:<scope>` where `<scope>` = `guest` | `u_<djb2(email)>`.
- Weekly leaderboard (global): `ssc_gk_v1:leaderboard:weekly`.
- Daily Challenge (global, per-IST-date): `ssc_gk_v1:daily_challenge:<YYYY-MM-DD>`.
- **Removed dead writes:** unscoped `ssc_gk_v1:user_profile` (no reader) and the unscoped `ssc_gk_v1:dashboard_bootstrap` patch.

## 6/7/8. TTLs & behaviour
- Bootstrap cache storage TTL: **ONE_DAY** (24h) — unchanged; serves static collection/leaderboard data instantly.
- **Profile freshness gate (new): TEN_MINUTES.** A logged-in warm load whose scoped bootstrap is older than 10 min triggers one background bootstrap refresh so dynamic profile data (coins/level/streak) is never shown up to a day stale. Reuses the existing `CACHE_TTL.TEN_MINUTES` constant (no new dependency, no new key).
- Leaderboard TTL: **THIRTY_MINUTES** — unchanged.
- **Guest:** profile null; static + leaderboard from cache; no auth reads.
- **Authenticated:** profile from the scoped bootstrap cache; never `/api/user-profile`.

## 9. Profile patch after quiz completion (PHASE E)
`result.js patchProfileCaches(profileSnapshot, scope)` now patches **only** the account-scoped `dashboard_bootstrap:<scope>` cache (merging `profileSnapshot` into `profile`, `isNewUser:false`). Guest scope is a no-op. Malformed payloads are guarded (`try/catch`, null-merge). Server stays source of truth — the next bootstrap refresh overwrites. No fetch is added after completion. Result: updated coins/level/streak appear on the Dashboard immediately, with **zero** extra requests.

## 10. Leaderboard-preview behaviour (PHASE H)
Bootstrap already returns `leaderboard.weeklyTop` (≤20). The Dashboard composes its weekly champions from that preview (written to `leaderboard:weekly`) and only calls `/api/leaderboard` when the preview is absent/stale. The full Leaderboard page still uses `/api/leaderboard`; ranking logic and the global 30-min cache are unchanged.

## 11. Refresh behaviour (PHASE I)
`handleBootstrapRefresh` → `getDashboardBootstrap({ forceRefresh:true })` once → `applyBootstrapData` updates profile + static + leaderboard-preview caches. Does not touch question-bank/topic/daily/saved/mentor/history caches. No `/api/user-profile`. No "clear all cache" action added.

## 12. Partial-failure behaviour (PHASE C/A-14)
`fetchProfile` distinguishes **confirmed new user** (`{isNewUser:true}`, no Users row) from **transient failure** (throws → caught → `profile:null` + `errors[]`). On `profile:null`, the Dashboard retries the bootstrap once (ref-guarded `profileFallbackRequested` → no infinite loop) and shows the existing "Showing saved data" fallback. Never auto-calls `/api/user-profile`.

## 13. Synthetic social-proof removed (PHASE J)
- `getLiveStudentCount()` → slide "**N students practiced today**" → replaced with "Practise GK daily to boost your score".
- `getRankedStudentCount()` → guest slide "**N students ranked this week**" → replaced with "Climb the weekly leaderboard".
Both generator functions, the `studentCount` state, and its 60-s interval were deleted. No other user-facing copy changed.

## 14. Test results
`node scripts/test-dashboard-optimization.js` → **34/34 pass**: guest cold/warm, logged-in cold/warm, A/B isolation, stale-profile background refresh, quiz-completion scoped patch (and confirmation the dead unscoped keys are not written), guest-patch no-op, manual refresh, partial-failure retry, new-user redirect, plus source assertions (no `/api/user-profile` fetch, no synthetic generators/strings, scoped patch in result.js). Daily Challenge (Test 9) and Leaderboard preview (Test 11) are unchanged existing behaviour (cache-gated `getDailyChallenge` / bootstrap `weeklyTop`).

## 15. Known limitations
- Profile freshness is gated at 10 min; a coins change on another device appears after ≤10 min (background refresh) or manual refresh — not instantly.
- The background refresh on a >10-min warm load is one extra `/api/dashboard-bootstrap` request, but it replaces the previously **always-present** `/api/user-profile` request — net equal or fewer requests for logged-in warm loads.
- Section freshness is implemented via the bootstrap cache timestamp (single scoped cache), not three physically separate cache entries; this keeps the change contained and the `getDashboardBootstrap` return shape intact.
- Server-instance/browser local; no cross-instance coordination (inherited from Steps 4–6).
