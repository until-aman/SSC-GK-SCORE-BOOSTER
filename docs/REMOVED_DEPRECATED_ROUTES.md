# Removed / Deprecated Routes (Step 15)

Route files: **46 → 42** (4 removed). All removals proven by full-repo search: zero frontend callers, zero server imports, no deploy/health-check refs, no test/doc dependency requiring them, and `npm run build` passes after removal.

## Removed routes (4)

| Route | File | Old responsibility | Evidence of zero use | Replacement / fallback | Compatibility risk | Decision |
|---|---|---|---|---|---|---|
| `GET /api/ai/summary` | `pages/api/ai/summary.js` | Performance summary via `getPerformanceSummary` | Only ref was `lib/fetchAI.js` (also removed); no page/test/doc caller; `/api/ai/result-insights` is the active result-level route (same Gemini fn) | `/api/ai/result-insights` | None (never wired to UI) | **Removed** |
| `GET /api/mentor/today-plan` | `pages/api/mentor/today-plan.js` | Duplicate of `/api/mentor/plan` | Zero callers/imports; `mentor.js` uses `/api/mentor/plan` | `/api/mentor/plan` | None | **Removed** |
| `GET /api/history/filters` | `pages/api/history/filters.js` | Subject/topic filter list | Zero callers; subjects from `/api/history/landing` + `/api/history/topics` | `/api/history/subjects` + `/topics` | None | **Removed** |
| `GET /api/prefetch` | `pages/api/prefetch.js` | Warm all question tabs | Zero callers; app uses targeted `getDailyChallenge`/`getQuestionBank` prefetch | targeted prefetch helpers | None (internal, no external contract) | **Removed** |

## Removed non-route helper (1)
- `lib/fetchAI.js` — superseded by `lib/data/aiData.js` (Step 13). Zero importers. **Removed.**

## Retained — compatibility (do NOT delete yet)

| Route | Reason | Removal condition |
|---|---|---|
| `POST /api/score` | Old deployed/cached clients may still POST here; canonical flow is `/api/quiz-session/complete`. Delegates to shared `persistScore` (idempotent via `hasDuplicateScore`). Dev deprecation log. | After ≥1 release with telemetry showing zero `/api/score` hits from clients. |
| `GET /api/config` | Zero in-app callers, but external tooling / deployment health checks cannot be disproven. Returns only allowlisted `getPublicConfig` (no secrets). Dev deprecation log. | After confirming no external/health-check consumer. |

## Retained — fallback (required)
- `GET /api/questions` — Mixed-subject + missing/invalid-bank fallback in `pages/quiz.js`. Dev `questions-legacy-fallback` diagnostic. **Keep.**

## Retained — page (possibly-shared URL)
- `pages/personal-ai-analysis.jsx` — zero in-app links/router targets, but the public URL may have been shared externally. Retained (unreachable in-app, harmless). Removal/redirect deferred. **Keep.**

## Honest note
Config, score, questions and the personal-AI page were **not** deleted despite low/zero in-app usage — evidence was insufficient to rule out external/compat/fallback use. Route-count vanity was not prioritized over backward compatibility.
