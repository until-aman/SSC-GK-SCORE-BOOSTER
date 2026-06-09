# Server-side Sheets In-Flight Read Deduplication (Step 6)

Collapses identical concurrent physical Google Sheets **reads** to a single Google API call; all callers reuse the same Promise. Not a cache. No API route, response shape, Sheet range, TTL, write behaviour, UI, or business logic changed.

## 1. Registry location
`lib/server/sheetsReadDedup.js` — module-level `const registry = new Map()` (server-process-local). Applied in `lib/sheets.js getSheetsClient()` as the **outer** wrapper: `dedupeSheetsReads(instrumentSheetsClient(google.sheets(...)))`.

## 2. Eligible read methods
`values.get`, `values.batchGet` only (explicit allowlist `ELIGIBLE_READ_METHODS = ['get','batchGet']` — never a "starts with get" rule).

## 3. Excluded methods
`values.append`, `values.update`, `values.batchUpdate`, `values.clear`, `batchGetByDataFilter`, and every other method pass straight through untouched — **no write is ever deduplicated**.

## 4. Exact dedupe-key format
- `values.get`: `values.get|<spreadsheetId>|<range>|<majorDimension>|<valueRenderOption>|<dateTimeRenderOption>`
- `values.batchGet`: `values.batchGet|<spreadsheetId>|<ranges joined in original order>|<majorDimension>|<valueRenderOption>|<dateTimeRenderOption>`
- Excludes credentials/auth/tokens, requestId, and route name. **Range-array order is preserved** (not sorted) so different orders do not share.

## 5. Cross-route reuse behavior
Route name is **not** in the key, so two different routes (e.g. `/api/dashboard-bootstrap` and `/api/user-profile`) issuing the identical physical read while overlapping will reuse one Promise → one physical Sheet read.

## 6. Interaction with requestId diagnostics
Dedup is applied **outside** the Step-2 diagnostics wrapper. A **new** read invokes the inner method → the existing `sheet` physical event is recorded once (attributed to the creating request). A **reused** read never reaches the inner method → no second `sheet` event; it emits `sheet-inflight-reused` instead. Consequence: a reusing request's route-level `sheetReads` count may remain 0 even though it used shared data — this is expected and documented.

Dev-only events (`kind:"sheet-dedup"`): `sheet-inflight-new`, `sheet-inflight-reused`, `sheet-inflight-cleared`, `sheet-inflight-failed` — each with `operation`, `tab`, `active` count, and `durationMs` where relevant. No credentials logged. Production is silent.

## 7. Success behavior
All callers receive the same successful Google API response object; the entry is removed on settle; a later (non-overlapping) request creates a new physical read (not a cache).

## 8. Failure behavior
All callers receive the same rejection; the entry is removed; a later retry creates a fresh physical request (Test 7). The cleanup chain is `.catch(()=>{})`-guarded so it never surfaces as an unhandled rejection.

## 9. Sequential-read behavior
Two identical reads that do **not** overlap → two physical calls (Test 8). Confirms this is in-flight dedup, not a persistent cache.

## 10. Response mutation audit
Searched `lib/` and `pages/api/` for in-place mutation of returned Sheet rows (`.push/.splice/.sort/.reverse/.shift/.unshift`, direct index assignment). **None found** — all callers read results via `.filter/.map/.find/.slice` (`res.data.values || []`). Reused callers therefore safely share the same response object; **no cloning is performed or needed**.

## 11. Test results
`node scripts/test-sheets-inflight-dedup.js` → **21/21 pass** (Tests 1–10 + key sanity): identical get→1 call; different ranges/spreadsheet/renderOption→2; identical batchGet→1; different range order→2; failure cleanup+retry; sequential→2; writes never deduped; diagnostics emit one new + reused + cleared with one physical read.

## 12. Real-route verification
Behaviour is automatic for any overlapping identical physical read (all routes use the central `getSheetsClient`). Whether a specific pair (Dashboard `Users`, History `QuizSessions`, Mentor helpers, Leaderboard `LeaderboardCache`/`Scores`, Saved `SavedQuestions`) actually reuses depends on **exact identical range params + temporal overlap** — observe via the `sheet-dedup` dev events. No frontend calls were changed.

## 13. Known limitations
- **Server-instance local** — no cross-instance coordination (each serverless instance has its own registry).
- Reuse only happens while a request is **pending** (in-flight) — no persistent cache.
- Sequential identical reads are not collapsed.
- Reuse requires byte-identical read parameters (same spreadsheetId/range(s)/render options/order).
