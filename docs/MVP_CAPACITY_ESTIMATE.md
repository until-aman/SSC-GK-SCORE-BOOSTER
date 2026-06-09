# MVP Capacity Estimate (Step 17)

> **ESTIMATE ONLY — NOT MEASURED.** No staging load test was run, so this is a *conservative architectural* estimate, not a guarantee. Replace with measured numbers from `docs/LOAD_TEST_RESULTS.md` before relying on it.

## Architectural reasoning (qualitative)
- **Public reads** (topics/question-bank/daily/leaderboard) are heavily cached: client cache (Step 4/5), server TTL cache (Step 14: topics 12h, bank 4h), Step-6 Sheets dedup. Warm bursts should cause far fewer than one physical Sheet read per request, so public-read concurrency is bounded mainly by Vercel function capacity, not Sheets quota — **likely the most scalable surface.**
- **Authenticated reads** (profile/history/mentor/saved) hit per-user Sheet ranges; cached client-side (≤10 min) but cold reads touch Sheets. **Sheets read quota is the primary bottleneck** here.
- **Writes** (quiz completion, saved, mentor) are append/update to Sheets with idempotency guards; **Google Sheets write quota + lack of transactions** is the hard ceiling.
- **Gemini** is lazy + cached + deduped → low call volume; cost/rate-limit unlikely to bind at MVP scale.

## Conservative MVP guidance (pending measurement)
- Likely **bottleneck: Google Sheets per-minute read/write quota** (default ~60 reads + 60 writes per user per minute, per-project limits apply), amplified by serverless cold starts (each new instance does one cold read per key).
- Suggested **initial cap: a closed cohort (10–100 users)** with monitoring, NOT broad public, until measured.
- **Supabase migration trigger:** sustained Sheets 429s, write contention/duplicates under real concurrency, p95 breaching thresholds, or daily attempts growing into the low-thousands/day range. Sheets is an MVP store, not a scale store.

Do not quote a specific "N concurrent users" number until staging load tests provide it.
