# Cleanup Report (Step 15)

Evidence-based dead-code / deprecated-route cleanup after Steps 1–14. Nothing was removed without a full-repo proof of zero callers + zero server imports + no deploy ref + green `npm run build`.

## Files removed (5)
- `pages/api/ai/summary.js` (route, dead)
- `pages/api/mentor/today-plan.js` (route, dead)
- `pages/api/history/filters.js` (route, dead)
- `pages/api/prefetch.js` (route, dead)
- `lib/fetchAI.js` (helper, superseded by `lib/data/aiData.js`, zero importers)

## Routes removed (4)
`/api/ai/summary`, `/api/mentor/today-plan`, `/api/history/filters`, `/api/prefetch`. Route files **46 → 42**. See `REMOVED_DEPRECATED_ROUTES.md`.

## Routes retained
- **Compatibility:** `/api/score` (old clients; idempotent `persistScore`; dev deprecation log; remove after ≥1 release with zero hits).
- **Fallback:** `/api/questions` (Mixed / missing-bank).
- **Deprecated-retained:** `/api/config` (allowlisted public config; external/health-check use cannot be disproven).

## Helpers removed
- `lib/fetchAI.js` — all four AI flows now use `lib/data/aiData.js`.

## Pages removed / redirected / retained
- `pages/personal-ai-analysis.jsx` — **retained** (zero in-app links, but public URL may be shared; unreachable + harmless). Not deleted/redirected (no evidence requiring it).

## Legacy cache keys retired (writes stopped in earlier steps; verified here)
- unscoped `user_profile` write (Step 7), unscoped `dashboard_bootstrap` patch (Step 7), `sessionStorage ai_result:<sid>` (Step 13), unscoped `analysisInterestRecorded` write (Step 10). See `CLIENT_CACHE_KEY_INVENTORY.md`.

## Legacy migrations retained (do NOT remove)
- Guest `savedQuestions` legacy key: **read-only** for one-time migration into canonical `ssc_saved_questions` / account; never written.
- `mentor_snapshot_v2:guest`, `mentor_today_plan`, `mentor_profile_cache`: guest Mentor compatibility.
- Quiz/session recovery + `active_user_cache_scope` marker. No blanket `localStorage.clear()`.

## Compatibility decisions
- `/api/score`: kept (idempotent compat wrapper). `/api/config`: kept (allowlist, external uncertainty). `/api/questions`: kept (fallback). personal-AI page: kept (shared-URL caution). Config/score retain concise dev-only deprecation logs (production silent).

## Security scan (PHASE L)
- `.env.local` is **gitignored and untracked**; `.env.example` is a safe template.
- No `BEGIN PRIVATE KEY` / `AIza…` / `"private_key"` / committed OAuth/NextAuth secret in tracked source.
- No full email in cache keys (account scope = non-reversible djb2 hash).
- No prompt/response/question-text/private-row logging.
- **Result: safe. No remediation needed. No credential rotation triggered.**

## Production logging scan (PHASE M)
- All `[apidiag]` diagnostics + deprecation logs are inside `IS_DEV`/`NODE_ENV !== 'production'`-gated helpers → **production silent**. Step-2 API/Sheet diagnostics retained for Steps 16–17.

## Tests
- `scripts/test-cleanup-and-route-safety.js` → **52/52 pass** (removed routes gone+uncalled, helpers gone+unimported, retained/fallback/compat present, scoped-cache writes, guest migration, secret scan, gated logging, route count 42, no invented routes).
- All 10 prior optimization harnesses re-run green (counts updated for removed routes).

## Remaining cleanup candidates (deferred, need more evidence/time)
- `/api/config`, `/api/score` — remove after telemetry confirms zero external/old-client hits.
- `pages/personal-ai-analysis.jsx` — remove or 301-redirect to `/analysis` once URL-sharing is ruled out.
- `mentor_snapshot_v2:*` writes in `mentor-setup.js` — migrate guest flow fully to v3 (kept now to avoid guest breakage).
- `scripts/migrate-*.js` — archive once confirmed no longer needed.
