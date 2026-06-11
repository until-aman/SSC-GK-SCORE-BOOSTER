# Phase 9H1 — Authenticated HTTP Route Validation Prep Report

**Project:** SSC Mentor / SSC GK Score Booster · folder `festive-engelbart-5368c8`
**Scope:** Prepare a safe end-to-end authenticated HTTP route validation plan for the V2 Mentor actions. **Preparation/audit only — no live mutation, no flag change, no allowlist change.**
**Date:** 2026-06-11
**Result:** ✅ Route auth + client calls audited; Phase 9H2 sequence + auth strategy + test-user setup defined; 12 no-write route-readiness checks added. Live monitor unchanged; 396 tests + build green.

---

## 1. Route auth audit
**`/api/mentor/task-action`**
- **Auth:** `getServerSession(req, res, authOptions)`; `401` if `!session.user.email`. POST only.
- **Payload:** `{ taskId, planId, actionType, actionValue, subject, topic }`. `actionType ∈ {complete, snooze, response, launch_practice, resume}` (else `400`).
- **V2 gate:** `shouldRouteActionThroughV2ForUser(actionType, { email: session.user.email })` — uses the **session** email (hashed to `u_…`), never a request-body email. Routes `snooze`/`resume` to V2 for allowlisted users only.
- **Legacy fallback:** when the gate is false, the legacy write path runs (unchanged).
- **Failure:** V2 branch is **fail-closed** — once entered it never falls back to a legacy write (no dual-write); errors return the mapped HTTP status.
- **Response:** V2 success returns the shared overlay snapshot (same shape as `GET /api/mentor/plan`).

**`/api/mentor/quiz-return`**
- **Auth:** `getServerSession`; `401` if no email. POST only.
- **Payload:** `{ taskId, planId, quizSessionId, subject, topic, correct, incorrect, skipped, totalQuestions }`; `taskId` required (`400`).
- **Evidence:** V2 path requires non-empty `quizSessionId` (→ `LinkedQuizSessionId`) and uses `completionSource=quiz_sync` + the score breakdown.
- **V2 gate:** `shouldRouteQuizCompletionThroughV2({ email: session.user.email })` — session email, flags + allowlist, fail-closed; independent of the snooze/resume whitelist.
- **Legacy fallback:** when the gate is false, the legacy quiz-return write (status + topic-state + log) runs unchanged.
- **Failure:** V2 branch fail-closed (no legacy fallback once entered); returns `{success:false, code, error}`.
- **Response:** `{success, idempotent}` (no snapshot today; result page marks the Mentor cache stale).

## 2. Frontend call audit
- **snooze** — `pages/mentor.js` `handleLater(task) → runTaskAction(task, 'snooze')` → POST `/api/mentor/task-action` with `{taskId, planId, actionType, actionValue, subject, topic}`.
- **resume** — `pages/mentor.js` `handleResume(task) → runTaskAction(task, 'resume')` (Phase 9E) → same route/payload.
- **quiz-return** — `pages/result.js` (≈L451) POSTs `/api/mentor/quiz-return` with `taskId, planId, quizSessionId (= clientSessionId/sessionId/router.query.sessionId), subject, topic, correct, incorrect, skipped, totalQuestions`. Fires once per result page (`mentorReturnSavedRef`) and only when the quiz was launched from a Mentor task (`mentorContext.sourceTaskId`).
- **`clientOperationId`:** **not** sent by either client — the V2 handlers derive a stable id: task-action `${actionType}:${taskId}:${planId}`; quiz-return `quiz-complete:${taskId}:${quizSessionId}`. These are stable per task+action / task+session, so a repeated identical client submit is idempotent.
- **`quizSessionId`:** sent by the client → satisfies the V2 evidence requirement.
- **Decision:** no client change needed for 9H2. The server-derived stable operation id is sufficient; if 9H2 wants explicit replay control it can send `clientOperationId` from a script (the routes pass `requestId`/derive ids safely).

## 3. Test-user setup recommendation
The `T9B2_…` task is now **completed** (Phase 9G2), so it can only serve duplicate-completion/rejection checks — not POSTPONE/RESUME/COMPLETE. **Recommendation: Option A — founder-approved fresh test plan/task generation for the allowlisted test user** (same generation path used in Phase 9B2), giving one clean current-generation `active practice_task` the real UI/routes can act on. (Option C is kept only for negative checks on the completed task.) **Do not create it in this phase.**

## 4. Phase 9H2 live route test sequence
```text
1. Founder fresh .xlsx backup
2. Generate/select ONE fresh active practice_task for the allowlisted test user
3. POST /api/mentor/task-action {actionType:'snooze'} via the authenticated route → verify active → pending
4. POST /api/mentor/task-action {actionType:'resume'} via the authenticated route → verify pending → active
5. Launch the task's quiz → result page → POST /api/mentor/quiz-return (quiz_sync) → verify active → completed
6. Idempotent replay (same submit) → no extra rows
7. Duplicate-completion (second complete) → DUPLICATE_COMPLETION, no writes
8. Monitor: POSTPONE/RESUME/COMPLETE counts increment by exactly 1 each; duplicates 0; unexpected 0; real plan unchanged
```
**Stop conditions:** any route falls to legacy unexpectedly; any response shape broken; any unexpected row changes; the affected real plan is touched; a non-allowlisted identity routes to V2; more than the one test task mutates.

## 5. Auth strategy recommendation
**Preferred: Option A/B — a real authenticated browser/session for the test user** (NextAuth Google provider). The founder logs in as the test user in the local app, then drives the actions through the actual UI (Maybe Later → Resume → launch quiz → result), or via browser devtools `fetch` carrying the session cookie. This exercises the full path: route + NextAuth session resolution + V2 gate + mutation + response.

Automating Google OAuth headlessly (Playwright) is brittle, so a **single manual browser pass is the realistic choice**. Explicit coverage note: the V2 **gate + mutation + repository + side-effect** logic is already proven live by the handler-replica tests (9B2/9D/9G2); what a browser pass additionally validates is only the **NextAuth session→email resolution** and the **route req/res plumbing** (payload parsing, status codes, response consumption). Option C (script with mocked session) is **not** recommended — it would bypass the very auth wiring 9H2 exists to test.

## 6. No-write tests added
`scripts/test-mentor-route-readiness.js` (12 checks, source-assertion + gate-logic; routes are ESM with no server harness): both routes require an authenticated session (401 on no email); both V2 gates use the **session** email (not request body); the gate keys on the `u_…` scope hash (a raw email is rejected); non-allowlisted session → legacy for snooze/resume/quiz-complete; allowlisted → V2; manual `complete` stays legacy; task-action accepts `resume`; clients send the required fields (`actionType`; `quizSessionId`+scores) and do **not** send `clientOperationId`.

## 7. Live monitor result (read-only)
```text
MentorMutationRequests: 3   MentorTaskLogs: 32
POSTPONE events: 1   RESUME events: 1   COMPLETE events: 1
completedQuizSyncTaskCount: 1
duplicateIdempotencyKeys: 0   unexpectedMutationsOutsideAllowlist: 0
affectedRealPlanStatus: { completed: 5, snoozed: 10 }   (unchanged)
```
No writes performed this phase.

## 8. Tests / build results
`test:mentor-route-readiness` 12/12 (new) · `test:mentor-v2-complete` 21/21 · `test:mentor-v2-complete-design` 13/13 · `test:mentor-pending-ui` 9/9 · `test:mentor-pending-surfacing` 11/11 · `test:mentor-v2-resume` 18/18 · `test:mentor-v2-cohort` 8/8 · `test:mentor-v2-postpone` 20/20 · `test:mentor-read-overlay` 13/13 · `test:mentor-mutation-service` 11/11 · `test:mentor-state-machine` 45/45 · `test:mentor-rollover` 67/67 · `test:mentor-repo` 22/22 · `test:mentor-sheets` 36/36 · `test:mentor-sheets-writer` 23/23 · `test:mentor-plan-day` 25/25 · `test-mentor-api-optimization` 42/42 — **396 passed, 0 failed**. `npx next build` → **✓ Compiled successfully**.

## 9. Phase 9H2 readiness
**Ready.** Routes, gates, and clients are audited and consistent; the V2 gates correctly key on the session email hash; the clients already send the fields the V2 path needs. Phase 9H2 needs only operational steps: founder backup, a fresh active test task (Option A), and one authenticated browser pass through snooze → resume → quiz-return, with the monitor confirming exactly +1 each and no out-of-scope writes.

## 10. Blocking items
- **Blocking for this phase:** None.
- **Operational for Phase 9H2:** founder fresh `.xlsx` backup; founder-approved fresh active test task for the test user; a real authenticated test-user session (browser) to drive the routes.
- **Coverage caveat:** if a real browser session is not feasible in the run environment, 9H2 can only re-exercise the route-handler logic (already proven), leaving NextAuth session resolution + req/res plumbing validated only by source assertions — state this explicitly in the 9H2 report if so.
- **Non-blocking:** unify the quiz-return V2 response with the overlay snapshot later; optional cleanup of the `MP_T9B2_…` test plan.

---

*Phase 9H1 complete — authenticated route validation prep. No live mutation, no flag change, no allowlist change, affected real plan untouched, rollover/pending writes not enabled, no deploy, no commit/push.*
