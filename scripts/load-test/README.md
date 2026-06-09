# Load-test tooling (Step 17) — STAGING ONLY

Lightweight, dependency-free (Node built-in `fetch`). **These scripts have not been run** in the Step-17 environment (no staging deployment / test Sheets / test accounts available). They are ready to run on a staging deployment connected to a **dedicated test Google Sheet** and **test accounts**.

## Safety contract (do not weaken)
Every script:
- requires `ALLOW_STAGING_LOAD_TEST=true`;
- requires an explicit `BASE_URL` (no default);
- **refuses** production-looking hosts (`lib.js PRODUCTION_HOST_PATTERNS`) unless `I_UNDERSTAND_THIS_IS_PRODUCTION=YES` (discouraged; document why);
- conservative defaults, finite duration, aborts at >10% error rate;
- write tests additionally require `CONFIRM_WRITE_TEST=YES` + a TEST session cookie;
- contain **no credentials and no real emails**.

> Before first use, set `PRODUCTION_HOST_PATTERNS` in `lib.js` to your real production host so it can be refused.

## Scripts
| Script | Group | What |
|---|---|---|
| `read-routes.js` | 1 — public reads | topics/question-bank/daily/leaderboard/bootstrap(guest)/config. Main concurrency test. Run COLD and WARM separately. |
| `authenticated-read-routes.js` | 2 — authed reads | user-profile/history/mentor/analysis/saved-ids. Needs `STAGING_COOKIE` (TEST account). Low concurrency (cap 50). |
| `write-idempotency.js` | 4 — controlled writes | sends ≤10 identical duplicate writes (complete/saved/interest) to prove idempotency. NOT a volume test. Then verify the Sheet by hand. |

AI routes (Group 3) are intentionally **not** scripted for volume — test manually at concurrency 1–2 with identical requests to confirm dedup, and stop on any 429.

## Examples
```
# Group 1 public reads (Stage 1: 10 vus / 30s)
ALLOW_STAGING_LOAD_TEST=true BASE_URL=https://staging.example \
  node scripts/load-test/read-routes.js --vus=10 --duration=30

# Group 2 authed reads (TEST account session)
ALLOW_STAGING_LOAD_TEST=true BASE_URL=https://staging.example \
  STAGING_COOKIE='next-auth.session-token=...' \
  node scripts/load-test/authenticated-read-routes.js --vus=5 --duration=30

# Group 4 write idempotency (TEST sheet only)
ALLOW_STAGING_LOAD_TEST=true CONFIRM_WRITE_TEST=YES BASE_URL=https://staging.example \
  STAGING_COOKIE='next-auth.session-token=...' \
  node scripts/load-test/write-idempotency.js --target=complete --copies=5
```

## Staged concurrency plan (public reads)
Stage 1: 10/30s → Stage 2: 25/60s → Stage 3: 50/60s → Stage 4: 100/60s → Stage 5: 300 (short) only if Stage 4 passes → Stage 6: 1000 only with explicit approval + quota headroom. Authed reads: 5 → 10 → 25 → 50 max.

## Capturing diagnostics during a run
```
npm run dev 2> dev-diag.log     # or staging function logs
node scripts/summarize-api-diagnostics.js dev-diag.log
```
Watch `physical Sheet reads / frontend requests` — warm cached bursts must stay far below 1. Stop if Sheet reads grow linearly with cached HTTP requests, or on sustained 429.

## Output handling
Do not commit HAR files or `dev-diag.log` (may contain request metadata). Add to `.gitignore` if generated.
