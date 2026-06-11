# Load Test Results (Step 17)

> **STATUS: NOT RUN.** No staging deployment was available. The tooling in `scripts/load-test/` is complete, dependency-free, syntax-checked, and its safety guards are **verified** (production host / missing BASE_URL / missing ALLOW flag / missing write-confirm all abort with exit 2; a staging URL is accepted). No live load numbers were produced — none are fabricated here.

## What was validated (without a server)
- Guard tests pass: refuses production-pattern hosts, refuses without `ALLOW_STAGING_LOAD_TEST=true`, refuses without `BASE_URL`, refuses writes without `CONFIRM_WRITE_TEST=YES`.
- All four scripts pass `node --check`.
- No credentials/emails committed in `scripts/load-test/`.

## Results table to fill on staging (per stage, all currently EMPTY)
| Group | Stage (vus/dur) | cold/warm | total | rps | success% | 4xx | 5xx | 429 | p50 | p95 | p99 | Sheet reads | Sheet writes | Gemini | cache hit% | pass/fail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 public reads | 10/30 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 public reads | 25/60 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 public reads | 50/60 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 1 public reads | 100/60 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 authed reads | 5–50 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 AI (conc 1–2) | manual |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 write idempotency | ≤10 dup |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

Thresholds (Phase H): public cached reads ≥99% success, p95 <2s, no sustained 429, Sheet reads ≪ requests; authed ≥98%, p95 <3s; completion 100% idempotent; AI fallback works, identical concurrent collapse, no auto-retry storms.

Stages 5 (300) and 6 (1000) require explicit approval + prior-stage success + quota headroom.
