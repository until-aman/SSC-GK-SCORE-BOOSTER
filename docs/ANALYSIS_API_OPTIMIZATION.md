# Analysis API & Cache Optimization (Step 10)

Removes the guest Analysis network call, makes logged-in activity account-scoped + cache-aware, and hardens interest-CTA idempotency — using only existing routes. No route created/renamed, no paid flow, no AI report generation, no Sheet schema change, no UI redesign.

## 1. Previous request flow
Analysis open (guest AND logged-in) fired `GET /api/analysis-activity` on every mount (no client cache). Interest CTA → `POST /api/notify-interest`. Interest state stored in **unscoped** `analysisInterestRecorded`.

## 2. New request flow
- **Guest open:** 0 API calls — static premium sample renders directly.
- **Logged-in cold:** 1 `GET /api/analysis-activity` (cache-aware, account-scoped).
- **Logged-in fresh (≤10 min):** 0 API.
- **Logged-in stale:** cached render + 1 background activity GET.
- **Interest CTA:** 1 `POST /api/notify-interest`, 0 follow-up GETs.

## 3. Routes preserved
`GET /api/analysis-activity` and `POST /api/notify-interest` — names unchanged. No `/api/analysis/snapshot`, `/api/analysis/interest`, or `/api/user-performance` created.

## 4. Guest zero-request behavior
The activity effect waits for `status`; for non-authenticated it sets `{hasHistory:false,isGuest:true}` locally and makes **no** network call. CTA for guests opens the sign-in modal only (no notify-interest POST, no confirmed-interest write).

## 5. Activity response shape (unchanged)
`{ hasHistory, isGuest, totalQuizzes, totalQuestions, coins, mostPracticed, lastQuizAt }` (guest → `{hasHistory:false,isGuest:true}`; no-history user → `{hasHistory:false,isGuest:false}`).

## 6. Fields actually consumed
`hasHistory, totalQuizzes, totalQuestions, coins, mostPracticed, lastQuizAt` — **all returned fields are consumed; none unused**, so the route was not minimized (no breaking change, no Gemini, no premium generation added).

## 7. Sheet reads — before/after
Unchanged server-side: `getLeaderboardData()` (Scores) + `getUserRows()` (Users, for coins). No NotifyInterest read added to the activity route (Phase I — would be an extra read per open). The route keeps its existing per-process Map cache. Client caching now avoids repeat calls within 10 min.

## 8. Cache key and TTL
`ssc_gk_v1:analysis_activity:u_<hash>` (account-scoped, no email). TTL **10 min** (`CACHE_TTL.TEN_MINUTES`). Static sample is **not** cached in localStorage — it stays bundled in the page.

## 9. Cold/fresh/stale behavior
Cold → 1 GET + cache write. Fresh → 0. Stale → cached render + 1 background GET (keep stale on failure). Broken JSON → `dropAnalysisActivityCache` removes only that scoped entry, then one fetch; no global clear.

## 10. Quiz-completion invalidation
`pages/result.js` calls `markAnalysisActivityStale(getUserCacheScope(session))` after a successful completion — sets the scoped activity cache `timestamp:0` (kept, not deleted); no immediate refetch; other users' caches, static sample, question-bank and Daily Challenge untouched. Next open → cached render + 1 background refresh.

## 11. Interest key and state
Account-scoped boolean flag `analysis_interest:u_<hash>` (no email). Reflects a **server-confirmed** success/check, written only after `{success|alreadyJoined}`. Guests get no confirmed state. User A's joined state never appears for User B. `analysisRevealed` stays a global UX reveal flag (confirmed not account-specific).

## 12. Notify-interest idempotency
Identity = **authenticated session email + collection** (never a client-supplied email). Server: existing-record check over `NotifyInterest!A:D` before append → returns `{alreadyJoined:true}` if present, else appends once. **New (Step 10):** a server-instance in-flight `Map` keyed by `email|collection` shares one check+append promise, so concurrent double-clicks/retries can't both pass the check and append duplicates. Client: `recordInterest` guard (`interestRecorded`/`autoCallFired`) + a module-level in-flight promise in `analysisData.js`. No new Sheet column added.

## 13. CTA behavior
Guest → sign-in modal, no POST. Logged-in not recorded → 1 POST, button disabled while pending; on success → scoped state + UI update, no activity refetch. Already recorded (local or server `alreadyJoined`) → "on the list", no resubmit. Failure → button re-enabled, state not written, retry allowed. No payment collection.

## 14. Personal AI page status
`pages/personal-ai-analysis.jsx` has **zero in-app callers** (verified by repo search). Kept (not deleted); dev-only `personal-ai-analysis-unused` log added; no new caller; flagged as a later cleanup candidate. (It still uses the legacy unscoped interest key, but is unreachable.)

## 15. Real-versus-sample boundary
Real activity strip (logged-in only) shows the exact `/api/analysis-activity` fields. The premium report remains clearly labeled static sample ("Sample Analysis Label", `STATIC SAMPLE` data) and is never presented as the user's own. No labels were made misleading; design unchanged.

## 16. Error behavior
Stale + network failure → cached activity + static sample stay visible, non-blocking. No cache + failure → static preview stays usable, real-activity falls back to `{hasHistory:false}`, CTA usable, no loop (effect keyed on status/scope). Session loading → spinner gate before reading scoped cache or calling the route (no guest/auth flash). Account switch → Step 4 scoping; never shows another account's activity/interest.

## 17. Test results
`node scripts/test-analysis-api-optimization.js` → **40/40 pass**: guest 0-calls, cold 1, fresh 0, stale render+bg, stale-failure keeps data, quiz-completion stale-mark (A only), A/B activity+interest isolation, interest first click (1 append + scoped state, no GET), concurrent double-click (1 append), repeat already-recorded, guest-blocked no append, failure no-write, broken-cache scoped removal, no-Gemini, route preservation, + source assertions.

## 18. Known limitations
- Cross-device CTA state: the activity route does not return `interestRecorded` (would cost an extra NotifyInterest read per open), so a user who joined on device A sees the not-recorded CTA on device B until they click again (server then returns `alreadyJoined`, no duplicate row). Documented per Phase I.
- notify-interest concurrency: the in-flight guard is server-instance-local; Google Sheets has no unique index/transaction, so a cross-instance simultaneous first-submit could (rarely) double-append. The email+collection check covers all normal retry/double-click cases.
- Activity/interest caches are browser/server-instance local (Steps 4–6).
- `personal-ai-analysis.jsx` retains a legacy unscoped interest write but is unreachable.

## 19. Routes/flows untouched
No History/Mentor/Saved/Profile/Streak/Onboarding/AI route refactored; no UI redesign; no Gemini added.
