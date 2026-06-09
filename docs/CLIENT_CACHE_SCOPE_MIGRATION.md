# CLIENT_CACHE_SCOPE_MIGRATION (Step 4)

How legacy unscoped/shared user-specific caches are handled when accounts change on the same browser.

## Mechanism
- `lib/userCacheScope.js` — `getUserCacheScope(session)` → `guest` | `u_<djb2(email)>`; `buildUserScopedKey`, `isGuestScope`, `clearUserScopedKeys`, `migrateLegacyUserCacheKey`, `reconcileCacheScope`.
- `components/CacheScopeGuard.jsx` — mounted once in `pages/_app.js` inside `SessionProvider`. On every account-identity change it calls `reconcileCacheScope(session)`.
- A marker key `active_user_cache_scope` stores the current scope; reconcile runs only when it changes (idempotent — no work on re-render or unchanged scope).

## Reconcile behavior (per transition)
| Transition | Action |
|---|---|
| guest → User A | clear unscoped user keys (mostly empty for guest); **guest saved keys preserved** so migration runs; public caches kept |
| User A → guest | clear A's unscoped user keys; A's account-scoped keys (`…:u_A`) left intact (isolated) |
| User A → User B | clear unscoped/shared keys; B reads only `…:u_B` (fresh); A's `…:u_A` left intact |
| expired → guest | treated as → guest |

## Legacy key treatment
| Legacy key | Treatment | Verification |
|---|---|---|
| `mentor_snapshot_v2:account:<date>` | **removed** on account change (shared across all accounts → unsafe) | n/a — never safe to attribute |
| `mentor_snapshot_v3:<email>:<date>` | **removed** when key contains `@` (old plain-email format). New writes use `…:u_<hash>:<date>` and are kept | format check |
| `mentor_today_plan`, `mentor_profile_cache`, `mentor_onboarded` | **removed** on account change | unscoped, not attributable |
| `ssc_gk_v1:dashboard_bootstrap` / `:saved_question_ids` / `:saved_questions` (unscoped) | **removed** on account change (superseded by `…:<scope>`) | unscoped legacy |
| `ssc_gk_v1:user_profile`, `ssc_gk_v1:history` | **removed** on account change | unscoped |
| `analysisInterestRecorded`, `ssc_revised_questions`, `ssc_understood_questions`, `ssc_reminder_*` | **removed** on account change | unscoped; server is source of truth where applicable |
| guest saved (`ssc_saved_questions`, `savedQuestions`) | **kept** (migration), removed by the migration flow after a successful `POST /api/saved-questions` | — |
| public caches (topics, question_bank, daily_challenge, leaderboard, questions) | **untouched** | no personalized fields |

## migrateLegacyUserCacheKey
Generic, opt-in helper: moves a legacy value to `<base>:<scope>` **only** when `verifyOwner(payload, session)` confirms ownership (e.g. payload email matches). Otherwise the legacy value is **discarded**. Idempotent. Not auto-applied to any key in this step (the current strategy is clear-on-change for unscoped keys, which is always safe); available for future per-key migration where ownership is verifiable.

## Dev-only diagnostics (no production noise; masked identifiers only)
Emitted as `[apidiag] {"kind":"cache-scope", ...}`:
- `scope-changed` `{ from, to, cleared }`
- `legacy-migrated` `{ key, to }`
- `legacy-discarded-unverified` `{ key }`

Never logs: full email, session object, tokens, profile payload, saved-question content, or Mentor plan content.

## Idempotency
`reconcileCacheScope` is a no-op when `active_user_cache_scope` already equals the current scope, so it runs at most once per actual account change — never on every render.
