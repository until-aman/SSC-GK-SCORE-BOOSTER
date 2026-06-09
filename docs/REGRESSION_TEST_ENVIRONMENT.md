# Regression Test Environment (Step 16)

| Item | Value |
|---|---|
| Git commit | `5d402bb` |
| Branch | `codex/premium-light-theme-phase-1` |
| API route files | **42** |
| Pages (non-api) | 27 |
| Node | v24.15.0 |
| Next.js | 14.2.35 |
| Environment | local development (build + deterministic harnesses) |
| Google Sheets target | **not connected in this run** — no live Sheets credentials; harnesses use mock stores / pure modules |
| Gemini | **not invoked** — no live key in this run; routes fall back to rule-based output by design |
| Optional Vercel KV | not configured (`KV_REST_API_URL` absent) → question-bank uses in-memory `serverCache` only |
| Browser (manual) | **none** — no interactive browser/account session available in this environment |
| Timezone (Daily/streak) | IST logic is code-deterministic (`getISTDateString`); not exercised against a live clock here |

## Verification mode for this step
- **Test-harness verified:** the 11 deterministic Node harnesses (mock stores + real pure modules `serverCache`/`aiRequestDedup`/`savedQuestionsService`/`sheetsReadDedup`).
- **Build verified:** `npm run build` compiles all 42 routes + 27 pages (fails on any broken import/link/removed route → none).
- **Code-evidence verified:** source inspection of request flows, cache keys, scoping, idempotency guards.
- **NOT manually verified:** interactive browser journeys with real Users A/B, live Google Sheets physical-read counts, and live Gemini call counts — these require a running dev server with real credentials/accounts, which is not available in this environment. They are labelled accordingly throughout and must be confirmed on staging before public launch.

No secret values are printed. `.env.local` is gitignored/untracked.
