# Launch Blockers — Pre Load-Test (Step 16)

Honest severity assessment after the Step-16 regression. Evidence basis: 384/384 deterministic assertions, clean lint, successful build, code-flow inspection. **No live-browser/Sheets/Gemini run was possible in this environment**, so all "verified" items below are harness/code/build verified unless a staging run is explicitly noted as required.

## P0 — blocks any launch
**None found.**
- Quiz completion idempotency (no duplicate coins) — `[H]` (two independent dedup guards: `quizSessionExists` + `hasDuplicateScore`; duplicate-payload test passes).
- Cross-account data leak — `[H][C]` (all authenticated caches account-scoped via djb2 email hash; A/B isolation asserted in dashboard/mentor/history/saved/profile/analysis harnesses).
- Missing routes / broken imports — `[B]` (build compiles all 42 routes + 27 pages; zero refs to removed routes).
- Exposed secret — `[C]` (`.env.local` gitignored/untracked; no committed key patterns; no email in keys).

## P1 — blocks broad public launch (must confirm on staging)
1. **Live request/Sheet/Gemini counts not captured** — the optimization targets are harness/code-verified but not measured against live Google Sheets + Gemini. **Action:** run `npm run dev 2> dev-diag.log` + `summarize-api-diagnostics.js` on staging with test accounts before public launch. Owner: dev. Step 17 load test **can proceed on staging** and will itself produce these numbers.
2. **Manual interactive journeys not executed** (no browser/accounts here) — Dashboard/Quiz/Result/Saved/History/Mentor/Analysis/Profile/Leaderboard flows are code/harness-verified only. **Action:** execute the Phase E–O manual checklist on staging. Owner: QA.

## P2 — can launch with monitoring
1. **Caches browser/server-instance local** — no persistent/Redis cache; cold serverless instances do one Sheets read per key; cross-device cache changes reflect within TTL (≤10 min profile/mentor, 24h/7d AI). Acceptable for MVP. `[C]`
2. **Cross-instance Sheets concurrency** — no DB transaction; rare simultaneous first-write on different instances could double-append (mitigated by existing-row checks + in-flight guards). Low probability. `[C]`
3. **`/api/score` compatibility route** — retained for old cached clients; idempotent. Remove after telemetry shows zero hits. `[C]`
4. **`/api/config` retained** — zero in-app callers; allowlisted public config; remove after confirming no external/health-check consumer. `[C]`
5. **`personal-ai-analysis.jsx` retained** — unreachable in-app; possibly-shared public URL. Redirect/remove later. `[C]`
6. **2 pre-existing lint warnings** (`onboarding-slides.js:92`, `quiz-setup.js:240`) — unrelated to this work; cosmetic `exhaustive-deps`. `[B]`
7. **AI content-hash (djb2) keys** — negligible collision chance; advisory text only. `[C]`

## Step 17 readiness
**Step 17 load testing MAY proceed on a staging environment** with real test Sheets/Gemini/accounts and rate-limit awareness. No P0 blocker. The two P1 items are *measurement/verification* gaps that the staging load test is designed to close, not functional defects.
