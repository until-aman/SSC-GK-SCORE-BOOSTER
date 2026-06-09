# API Optimization — Final Results (Step 16)

Before/after per major journey. **Evidence legend:** `[H]` test-harness verified, `[C]` inferred from code architecture, `[B]` build-verified, `[M]` manual-browser-measured. **No `[M]` values exist in this run** (no live browser/Sheets/Gemini) — those require staging. "Before" values are from `docs/API_BASELINE_MEASUREMENT.md` + per-step docs.

Frontend = client API requests. Sheet reads = physical Google API reads (reduced by Step-6 in-flight dedup + Step-14 server cache; exact live counts need staging). Gemini = `generateContent` calls.

| Journey | FE reqs before | FE reqs after | Sheet reads | Gemini | Evidence |
|---|---|---|---|---|---|
| Guest Dashboard cold | bootstrap + (guest still called activity-style) | **1** (`dashboard-bootstrap`) + daily if missing | unchanged collections read | 0 | [H][C] |
| Guest Dashboard warm | re-fetch every visit | **0** | 0 | 0 | [H][C] |
| Logged-in Dashboard cold | bootstrap **+ user-profile** (Users ×2) | **1** (`dashboard-bootstrap`), no user-profile | Users read **×1** (was ×2) | 0 | [H][C] |
| Logged-in Dashboard warm | bootstrap-cache + user-profile every visit | **0** if profile ≤10 min; else 1 bg bootstrap | 0 warm | 0 | [H][C] |
| Dashboard manual refresh | bootstrap + user-profile | **1** bootstrap only | per bootstrap | 0 | [C] |
| Quiz setup / topics cold | 1 `topics` + **N per-subject reads (N+1)** | **1** `topics`, **1** physical read (derived counts) + 12h server cache | N+1 → **1** | 0 | [H][C] |
| Quiz setup / topics warm | re-fetch | **0** | 0 | 0 | [H][C] |
| First subject quiz | 1 `question-bank` | **1** `question-bank` (full subject bank) + 4h server cache | 1 (cached after) | 0 | [H][C] |
| Topic switch (same subject) | could refetch | **0** (client-side filter of cached bank) | 0 | 0 | [H][C] |
| Same-subject 2nd quiz (bank fresh) | refetch | **0** | 0 | 0 | [H][C] |
| Daily Challenge cold | 1 | **1** (date-keyed) | per date (server-cached) | 0 | [H][C] |
| Daily Challenge warm | re-fetch | **0** | 0 | 0 | [H][C] |
| Quiz completion | **2** (`complete` + `score`) | **1** (`complete`); `score` idempotent compat-only | 1 write set (idempotent) | 0 | [H][C] |
| Saved mutation (save/unsave) | 1 mutation + **stale lists until TTL** | **1** mutation + IDs/list/History caches patched, **0** follow-up GET | 1 read+1 write (idempotent) | 0 | [H][C] |
| Guest saved migration | **loop: 1 POST per question** | **1** batched POST (dedup, append-missing) | 1 read + ≤1 append | 0 | [H][C] |
| History landing cold | **3** (`summary`+`quizzes`+`subjects`) | **1** (`landing`) | identical reads collapse via Step-6 dedup | 0 | [H][C] |
| History landing warm | re-fetch | **0** | 0 | 0 | [H][C] |
| Mentor warm load | cached render **+ always** `plan` GET | **0** if fresh ≤10 min; stale → cached + 1 bg | 0 warm | 0 | [H][C] |
| Mentor task action | `task-action` **→ `plan` GET** (cascade) | **1** `task-action` (returns snapshot), **0** plan GET | 1 mutation set | 0 | [H][C] |
| Analysis guest | 1 `analysis-activity` | **0** (static sample) | 0 | 0 | [H][C] |
| Analysis warm | re-fetch | **0** | 0 | 0 | [H][C] |
| Profile warm | `user-profile` every visit | **0** (shared cache, warmed by bootstrap) | 0 warm | 0 | [H][C] |
| Dream Post warm | `dream-post` per mount | **0** | 0 warm | 0 | [H][C] |
| Dream Post save | 1 POST + per-mount GET | **1** POST, **0** follow-up GET | 1 read + 1 write | 0 | [H][C] |
| AI explanation repeat (same Q) | re-POST each open | **0** (7d content-keyed cache) | 0 | **0** | [H][C] |
| Result insights repeat (same attempt) | sessionStorage cache | **0** (24h attempt cache) | 0 | **0** | [H][C] |
| Result mount | — | **0** AI POST (insight is user-click only) | 0 | 0 | [C] |
| Leaderboard warm | re-fetch | **0** (30 min global cache) | 0 warm | 0 | [H][C] |

## Headline deltas (architecture-level, harness/code verified)
- Quiz completion: **2 → 1** FE request; no duplicate coins (dual dedup guards).
- History landing: **3 → 1** FE request.
- Mentor task action: removed the **task-action→plan** GET cascade (**2 → 1**).
- Topics: **N+1 → 1** physical Sheet read.
- Guest Dashboard / Profile / Streak / Analysis / Mentor / History / Saved / Dream Post warm loads: **→ 0** API via account-scoped client caches + Step-5 in-flight dedup.
- AI: explanation/insight reuse → **0** repeat Gemini calls; result mount never auto-calls Gemini.
- Server: Step-6 collapses identical concurrent physical Sheet reads; Step-14 12h/4h TTL caches reduce cold reads.

## Limitations on these numbers
- Exact **live** physical-Sheet-read and Gemini counts require a staging run with real credentials (`npm run dev 2> dev-diag.log` + `summarize-api-diagnostics.js`). Values above are the **intended** counts proven by harness logic + code flow, not live-captured this run.
- Caches are browser/server-instance local; cross-instance cold starts each do one Sheets read per key.
