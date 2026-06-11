// lib/mentor/read/v2TaskActionHandler.js — V2 task-action cut-over orchestration.
// CommonJS, repository-injected (testable with fake/in-memory data). Maps the
// whitelisted legacy `snooze` action to canonical V2 `POSTPONE`, runs it through
// the guarded executeTaskMutation service, and (on success) returns a response
// snapshot via the shared read overlay. Fail-closed: callers must NOT fall back
// to the legacy write after entering this branch.
'use strict';

const { executeTaskMutation } = require('../services/taskMutationService');
const { TASK_ACTION } = require('../domain/taskStateMachine');
const { PENDING_REASON, COMPLETION_SOURCE } = require('../domain/enums');

// Legacy actionType -> canonical V2 action.
const LEGACY_TO_V2_ACTION = Object.freeze({ snooze: TASK_ACTION.POSTPONE, resume: TASK_ACTION.RESUME });

const CONFLICT_CODES = new Set([
  'STALE_PLAN', 'STALE_PLAN_VERSION', 'STALE_EXPECTED_STATUS', 'STALE_ROW_VERSION',
  'IDEMPOTENCY_PAYLOAD_MISMATCH', 'DUPLICATE_COMPLETION', 'DUPLICATE_TASK_ROWS',
]);
const NOT_FOUND_CODES = new Set(['TASK_NOT_FOUND', 'NO_ACTIVE_PLAN']);
const FORBIDDEN_CODES = new Set(['HISTORICAL_TASK_NOT_ACTIONABLE', 'WRONG_USER']);

function httpStatusFor(code) {
  if (CONFLICT_CODES.has(code)) return 409;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (code === 'AUTH_REQUIRED') return 401;
  return 400;
}

/**
 * @param {Object} args
 * @param {{email:string}} args.userIdentity
 * @param {Object} args.repository       executeTaskMutation contract (Sheets-backed or in-memory)
 * @param {Object} args.idempotencyStore { get, save }
 * @param {{taskId,planId,actionType,requestId,clientOperationId}} args.request
 * @param {Function} [args.buildResponseSnapshot]  async () => compatible snapshot
 * @param {string} [args.now]
 */
async function executeV2TaskActionCutover({ userIdentity, repository, idempotencyStore, request = {}, buildResponseSnapshot, now } = {}) {
  const action = LEGACY_TO_V2_ACTION[request.actionType];
  if (!action) return { ok: false, code: 'ACTION_NOT_WHITELISTED_FOR_V2', httpStatus: 400 };

  const clientOperationId = request.clientOperationId || `${request.actionType}:${request.taskId}:${request.planId || ''}`;
  // POSTPONE records why it became pending; RESUME clears pending fields (no reason).
  const context = action === TASK_ACTION.POSTPONE
    ? { pendingReason: PENDING_REASON.USER_POSTPONED, source: 'task-action-v2' }
    : { source: 'task-action-v2' };
  const result = await executeTaskMutation({
    userIdentity,
    repository,
    idempotencyStore,
    now,
    request: {
      taskId: request.taskId,
      planId: request.planId,
      action,
      clientOperationId,
      requestId: request.requestId || '',
      context,
    },
  });

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message, mutationResult: result, httpStatus: httpStatusFor(result.code) };
  }

  let snapshot = null;
  if (typeof buildResponseSnapshot === 'function') {
    try { snapshot = await buildResponseSnapshot(); } catch (_) { snapshot = null; }
  }
  return { ok: true, task: result.task, event: result.event, idempotent: Boolean(result.idempotent), snapshot, httpStatus: 200 };
}

// Phase 9G1 — classify a quiz result into a StudentTopicState practice update
// (mirrors the legacy quiz-return derivation; never resets fields).
function classifyQuizResult({ correct = 0, incorrect = 0, skipped = 0, totalQuestions = 0 } = {}) {
  const total = Number(totalQuestions) || Number(correct) + Number(incorrect) + Number(skipped);
  const accuracy = total ? (Number(correct) / total) * 100 : 0;
  const wrongRate = total ? (Number(incorrect) / total) * 100 : 0;
  const skippedRate = total ? (Number(skipped) / total) * 100 : 0;
  let category = 'AVERAGE';
  if (skippedRate >= 30) category = 'LOW_CONFIDENCE';
  else if (accuracy >= 80 && wrongRate <= 15 && skippedRate <= 10) category = 'EXCELLENT';
  else if (accuracy >= 65 && wrongRate <= 25) category = 'GOOD';
  else if (accuracy < 45 || wrongRate > 40) category = 'WEAK';
  const confidence = category === 'EXCELLENT' ? 'strong' : category === 'GOOD' ? 'okay' : category === 'LOW_CONFIDENCE' ? 'forgotten' : 'weak';
  return { accuracy: Math.round(accuracy), wrongRate, category, confidence, practiceStatus: accuracy >= 65 && wrongRate <= 25 ? 'enough_practice' : 'started' };
}

/**
 * Phase 9G1 — V2 quiz-sync COMPLETE for the quiz-return flow (allowlisted only).
 * Runs the guarded COMPLETE (quiz_sync + linkedQuizSessionId) then upserts
 * StudentTopicState via the injected `upsertTopicState` callback. Fail-closed.
 */
async function executeV2QuizComplete({ userIdentity, repository, idempotencyStore, request = {}, upsertTopicState, buildResponseSnapshot, now } = {}) {
  if (!request.taskId) return { ok: false, code: 'TASK_REQUIRED', httpStatus: 400 };
  if (!request.planId) return { ok: false, code: 'PLAN_REQUIRED', httpStatus: 400 };
  if (!String(request.quizSessionId || '').trim()) return { ok: false, code: 'LINKED_QUIZ_SESSION_REQUIRED', httpStatus: 400 };

  const clientOperationId = request.clientOperationId || `quiz-complete:${request.taskId}:${request.quizSessionId}`;
  const result = await executeTaskMutation({
    userIdentity,
    repository,
    idempotencyStore,
    now,
    request: {
      taskId: request.taskId,
      planId: request.planId,
      action: TASK_ACTION.COMPLETE,
      clientOperationId,
      requestId: request.requestId || '',
      context: {
        completionSource: COMPLETION_SOURCE.QUIZ_SYNC,
        linkedQuizSessionId: request.quizSessionId,
        source: 'quiz-return-v2',
      },
    },
  });
  if (!result.ok) return { ok: false, code: result.code, message: result.message, mutationResult: result, httpStatus: httpStatusFor(result.code) };

  // Side-effect: StudentTopicState upsert (only on a fresh, non-idempotent completion).
  let topicStateUpdated = false;
  if (!result.idempotent && typeof upsertTopicState === 'function' && request.subject && request.topic) {
    const r = classifyQuizResult(request);
    try {
      await upsertTopicState({
        Subject: request.subject,
        Topic: request.topic,
        PracticeStatus: r.practiceStatus,
        LastPracticeUpdatedAt: now,
        LastQuizAttemptAt: now,
        RecentAccuracy: r.accuracy,
        ConfidenceLevel: r.confidence,
      });
      topicStateUpdated = true;
    } catch (_) { topicStateUpdated = false; }
  }

  let snapshot = null;
  if (typeof buildResponseSnapshot === 'function') { try { snapshot = await buildResponseSnapshot(); } catch (_) { snapshot = null; } }
  return { ok: true, task: result.task, event: result.event, idempotent: Boolean(result.idempotent), topicStateUpdated, snapshot, httpStatus: 200 };
}

module.exports = { executeV2TaskActionCutover, executeV2QuizComplete, classifyQuizResult, LEGACY_TO_V2_ACTION, httpStatusFor };
