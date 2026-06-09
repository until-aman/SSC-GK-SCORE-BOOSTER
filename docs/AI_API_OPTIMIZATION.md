# AI API Optimization (Step 13)

Adds caching, client + server in-flight dedup, and route tracing to the four existing AI routes — without changing routes, prompts' meaning, the model, or scoring. AI stays lazy (user-click), with Sheet/static fallbacks intact.

## 1. Previous AI request flows
- Explain: direct `fetch('/api/ai/explain')` in History questions/quizzes/session (user "Get AI Explanation"), and via `lib/fetchAI.js` in `result/detailed.js`. Per-component React-state cache only (lost on navigation; reopening re-called).
- Tip: `fetchAITip` in `result/detailed.js` (skipped questions only).
- Result-insights: direct `fetch('/api/ai/result-insights')` in `result.js` (user "Generate AI Analysis"), cached in `sessionStorage` per session id.
- Summary: `fetchAISummary` defined but **no caller**.
- No client/server in-flight dedup; routes not `withApiTrace`-wrapped.

## 2. New AI request flows
- All AI goes through `lib/data/aiData.js`: content/attempt-keyed localStorage cache + client in-flight dedup. Reopening a recently viewed explanation → 0 POST. Two simultaneous identical → 1 POST. Result insight cached per attempt (24h) → repeat open 0 POST. Server dedup collapses identical concurrent Gemini work to one execution. All 4 routes `withApiTrace` + `markGemini` (`geminiCalled:true`).

## 3. Routes preserved
`POST /api/ai/explain`, `/tip`, `/summary`, `/result-insights` — unchanged names + response shapes. No `/chat`, `/analyze`, `/batch`, `/question` created.

## 4. Exact frontend callers
- explain: `history/questions.jsx`, `history/quizzes.jsx`, `history/session/[sessionId].jsx`, `result/detailed.js` (wrong only) — all via `getAIExplanation`.
- tip: `result/detailed.js` (skipped only) via `getAITip`.
- result-insights: `result.js` via `getAIResultInsights` (user click) + `readAIInsightsCache` (mount read-only).
- summary: none (unused; dev `ai-route-unused` log).

## 5. Request/response shapes (unchanged)
- explain: `{question,optionA-D,correctOption,userOption,explanation,subject,topic}` → `{aiExplanation}`.
- tip: `{question,correctOption,correctOptionText,explanation,subject,topic}` → `{aiTip}`.
- summary / result-insights: `{subject,topic,totalQuestions,correctAnswers,incorrectAnswers,skipped,rawScore,accuracy}` → `{aiSummary}`.

## 6. Cache-safety classification
- **explain → Category 2** (user-answer-specific; prompt includes `userOption`). Keyed with selected answer.
- **tip → Category 1** (question-content deterministic; no selected answer).
- **summary → Category 3** (quiz-attempt aggregate) — unused.
- **result-insights → Category 3** (quiz-attempt aggregate; account-scoped + attempt-keyed).

## 7. Client helper functions (`lib/data/aiData.js`)
`getAIExplanation`, `getAITip`, `getAIResultInsights`, `readAIInsightsCache`, `__getAIInflightCount`. Server: `lib/server/aiRequestDedup.js` → `buildAiDedupKey`, `dedupeAiRequest`, `hash`.

## 8. Cache key formats
- explain: `ai_q:v1:explain:<djb2(question|correctOption|userOption)>`
- tip: `ai_q:v1:tip:<djb2(question|correctOption)>`
- result-insights: `ai_r:v1:insights:<scope>:<sessionId>`
No question text, options, email, or API key in keys — only djb2 content hashes + account scope hash.

## 9. TTLs
Explain/tip **7 days**; result-insights **24 hours**. Envelope `{ timestamp, data }` with version prefix `v1`.

## 10. Cache size limits
Question-level (explain+tip) max **150** entries/browser; attempt-level insights max **20**/account. Oldest-first eviction (malformed entries evicted first). localStorage-full → one eviction retry, then silently skip caching (response still displays).

## 11. Client in-flight dedup
Module-level `Map` keyed by the same cache key (route + content + selected answer / scope+sessionId). Identical concurrent calls share one Promise; different questions/answers/attempts run separately; entries cleared in `finally` (no retained Promises); failures don't cache.

## 12. Server in-flight dedup
`lib/server/aiRequestDedup.js` module-level `Map`, keyed `route|djb2(prompt-defining parts)`. Applied in each route around the Gemini call. Identical concurrent computations → one `generateContent`; different prompts → separate. No API key/email in key; cleared in `finally`; dev events `ai-inflight-new/reused/cleared/failed`.

## 13. Lazy-loading rules
Unchanged and confirmed lazy: quiz player never calls AI mid-question; result mount makes **0** AI POST (insight is read-only cache lookup; generated only on user "Generate AI Analysis" click); History explanation only on the user's "Get AI Explanation" tap.

## 14. Explain/tip applicability
`result/detailed.js`: tip **only** for skipped, explain **only** for wrong (unchanged). History "Get AI Explanation" is explicit per-question. Correct questions are not auto-AI'd. No combined route; second route never called unless its panel/output is shown.

## 15. Summary / result-insights relationship
Both call the **same** `getPerformanceSummary` in `lib/gemini.js` (verified). The result UI uses **result-insights**; `summary` has no caller. Neither deleted; `summary` flagged `ai-route-unused` (later-removal candidate). No duplicate result-level call (one route used).

## 16. Result attempt keying
Keyed by account scope + stable `sessionId`/`clientSessionId` (Step 3). One attempt → ≤1 POST per route. Repeat mount → cached, 0 POST. A retry produces a new session id → new insight key (parent attempt's insight never reused). Strict-Mode/effect rerun → mount effect is read-only; generate is user-triggered + deduped.

## 17. Prompt/payload reductions
Prompts in `lib/gemini.js` unchanged (meaning/length/model preserved). Payloads already minimal aggregates (no full session/question-bank objects sent). No fields added/removed. Model `gemini-2.0-flash` unchanged; no token-limit change; no extra retries.

## 18. Timeout / retry / fallback
Single **3 s** AbortController timeout (centralized in `aiData.js`, matching prior `fetchAI.js`). No automatic Gemini retries (client manual retry allowed after failure). On timeout/non-OK/empty → Sheet/static fallback shown, failure **not** cached as success. Result-insights failure → score/stats still render, friendly fallback, no completion rollback. Missing key → `lib/gemini.js` returns rule-based fallback (no config leak).

## 19. Privacy rules
No email, name, history, token, session object, API key, prompt, or response stored in AI cache keys/values or logs. Keys use djb2 hashes + non-reversible account scope. Result-level cache account-scoped; question-level (explain) includes selected answer but no identity. Diagnostics log only event names + hashed keys + counts.

## 20. Tests
`node scripts/test-ai-api-optimization.js` → **31/31 pass** (cold/fresh, simultaneous dedup, distinct question/answer keys, tip key, result 1-per-attempt + repeat-cached, effect rerun, retry isolation, failure fallback + no-cache + retry, eviction oldest-first, A/B insight isolation, server dedup 1-execution, different-prompt no-dedup, + source assertions: 4 routes exist, summary flagged, withApiTrace+markGemini, server dedup wired, raw-fetch mutations, no direct AI fetches, privacy, model unchanged). Uses the real `aiRequestDedup`.

## 21. Known limitations
- Caches are browser/server-instance local (no persistent/Redis cache, per constraint).
- Content-hash keys (djb2) have a negligible theoretical collision chance; explanations are advisory, so a rare collision is non-harmful.
- `lib/fetchAI.js` is now unused (superseded by `aiData.js`) — kept, not deleted (not a route).
- `summary` route remains unused but live (removal deferred).
- Server dedup only collapses truly concurrent identical work (not a persistent cache).
