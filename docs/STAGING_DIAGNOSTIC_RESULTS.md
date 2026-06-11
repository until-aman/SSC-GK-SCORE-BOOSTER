# Staging Diagnostic Results (Step 17)

> **STATUS: NOT CAPTURED.** Requires a running staging server with real test Sheets/Gemini + `npm run dev 2> dev-diag.log` then `node scripts/summarize-api-diagnostics.js dev-diag.log`. Not available in this environment.

## Metrics to capture on staging (all currently UNMEASURED)
requests/route · physical `values.get` · physical `values.batchGet` · append/update calls · Gemini calls · cache hits/misses · stale fallbacks · client in-flight reuse · Sheet in-flight reuse · route p50/p95 · Sheet-op p50/p95 · 4xx · 5xx · timeouts · 429s.

**Key derived metric:** `physical Sheet reads / frontend API requests` — warm cached bursts must stay far below 1.

The instrumentation to produce these exists and is production-silent (Step 2 `[apidiag]` events + `summarize-api-diagnostics.js`). Only the live capture is outstanding.
