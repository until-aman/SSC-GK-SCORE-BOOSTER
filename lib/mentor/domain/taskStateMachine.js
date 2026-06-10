// lib/mentor/domain/taskStateMachine.js - pure Mentor task transition engine (Phase 4). CommonJS.
'use strict';

const {
  TASK_ACTION,
  TASK_EVENT_TYPE,
  TASK_STATUS,
  LEGACY_TASK_STATUS,
  TASK_TYPE,
  COMPLETION_SOURCE,
  PENDING_REASON,
  CANCELLATION_REASON,
  TERMINAL_TASK_STATUSES,
} = require('./enums');

const TERMINAL = new Set(TERMINAL_TASK_STATUSES);
const QUIZ_TYPES = new Set([TASK_TYPE.PRACTICE_TASK, TASK_TYPE.REVISION_TASK, TASK_TYPE.MISTAKE_RECOVERY_TASK]);
const RESPONSE_TYPES = new Set([TASK_TYPE.COVERAGE_CHECK, TASK_TYPE.CONFIDENCE_CHECK, TASK_TYPE.FEEDBACK_TASK]);
const WORK_TYPES = new Set([TASK_TYPE.THEORY_TASK, ...QUIZ_TYPES]);

function normalizeTaskStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (raw === LEGACY_TASK_STATUS.SNOOZED) return TASK_STATUS.PENDING;
  return Object.values(TASK_STATUS).includes(raw) ? raw : raw || TASK_STATUS.DRAFT;
}

function cloneTask(task) {
  return { ...(task || {}), status: normalizeTaskStatus(task?.status), rawLegacyStatus: task?.rawLegacyStatus || task?.status || '' };
}

function reject(code, message, currentTask) {
  return { allowed: false, code, message, currentTask };
}

function eventTypeFor(action) {
  return {
    [TASK_ACTION.SCHEDULE]: TASK_EVENT_TYPE.TASK_SCHEDULED,
    [TASK_ACTION.ACTIVATE]: TASK_EVENT_TYPE.TASK_ACTIVATED,
    [TASK_ACTION.START]: TASK_EVENT_TYPE.TASK_STARTED,
    [TASK_ACTION.POSTPONE]: TASK_EVENT_TYPE.TASK_POSTPONED,
    [TASK_ACTION.RESUME]: TASK_EVENT_TYPE.TASK_RESUMED,
    [TASK_ACTION.COMPLETE]: TASK_EVENT_TYPE.TASK_COMPLETED,
    [TASK_ACTION.COMPLETE_MANUAL_RECOVERY]: TASK_EVENT_TYPE.MANUAL_RECOVERY,
    [TASK_ACTION.DEFER_CHECK]: TASK_EVENT_TYPE.TASK_DEFERRED,
    [TASK_ACTION.UNBLOCK]: TASK_EVENT_TYPE.TASK_UNBLOCKED,
    [TASK_ACTION.CANCEL]: TASK_EVENT_TYPE.TASK_CANCELLED,
    [TASK_ACTION.EXPIRE_INVALID]: TASK_EVENT_TYPE.TASK_EXPIRED,
  }[action] || '';
}

function assertTaskPolicy(task, action, context) {
  const type = task.type || task.taskType || '';
  if (!Object.values(TASK_ACTION).includes(action)) return reject('UNSUPPORTED_ACTION', 'Unsupported Mentor task action.', task);
  if (type === TASK_TYPE.PACE_UNLOCK_TASK && ![TASK_ACTION.CANCEL].includes(action)) {
    return reject('PACE_UNLOCK_NOT_BACKLOG_TASK', 'Pace unlock is an offer, not a backlog task.', task);
  }
  if (RESPONSE_TYPES.has(type)) {
    if (![TASK_ACTION.COMPLETE, TASK_ACTION.DEFER_CHECK, TASK_ACTION.CANCEL, TASK_ACTION.EXPIRE_INVALID].includes(action)) {
      return reject('ACTION_NOT_ALLOWED_FOR_TASK_TYPE', 'This check cannot enter pending backlog.', task);
    }
    if (action === TASK_ACTION.COMPLETE && context.completionSource && context.completionSource !== COMPLETION_SOURCE.MENTOR_RESPONSE) {
      return reject('INVALID_COMPLETION_SOURCE', 'Checks complete through mentor response only.', task);
    }
  }
  if (WORK_TYPES.has(type)) {
    if (![TASK_ACTION.START, TASK_ACTION.POSTPONE, TASK_ACTION.RESUME, TASK_ACTION.COMPLETE, TASK_ACTION.COMPLETE_MANUAL_RECOVERY, TASK_ACTION.CANCEL, TASK_ACTION.EXPIRE_INVALID, TASK_ACTION.SCHEDULE, TASK_ACTION.ACTIVATE, TASK_ACTION.UNBLOCK].includes(action)) {
      return reject('ACTION_NOT_ALLOWED_FOR_TASK_TYPE', 'Action is not valid for this task type.', task);
    }
  }
  if (QUIZ_TYPES.has(type) && action === TASK_ACTION.COMPLETE && context.completionSource === COMPLETION_SOURCE.MENTOR_RESPONSE) {
    return reject('INVALID_COMPLETION_SOURCE', 'Quiz tasks cannot complete through mentor response.', task);
  }
  return null;
}

function buildEvent({ task, action, fromStatus, toStatus, context, now }) {
  return {
    eventId: context.eventId || `evt_${now.replace(/[-:.TZ]/g, '')}_${task.taskId || 'task'}`,
    userScope: context.userScope || '',
    planId: task.planId || context.planId || '',
    taskId: task.taskId || '',
    type: eventTypeFor(action),
    fromStatus,
    toStatus,
    action,
    idempotencyKey: context.idempotencyKey || '',
    source: context.source || 'mentor',
    requestId: context.requestId || '',
    payload: context.eventPayload || {},
    createdAt: now,
  };
}

function applyCommon(next, now) {
  return { ...next, updatedAt: now, rowVersion: Number(next.rowVersion || 0) + 1 };
}

function completeTask(task, context, now, source) {
  if (!source || !Object.values(COMPLETION_SOURCE).includes(source)) {
    return reject('COMPLETION_SOURCE_REQUIRED', 'Completion source is required.', task);
  }
  if (source === COMPLETION_SOURCE.MANUAL_RECOVERY && !context.manualRecoveryVerified) {
    return reject('MANUAL_RECOVERY_NOT_VERIFIED', 'Manual recovery requires verified quiz or recovery evidence.', task);
  }
  return applyCommon({
    ...task,
    status: TASK_STATUS.COMPLETED,
    completedAt: task.completedAt || now,
    completionSource: task.completionSource || source,
  }, now);
}

function evaluateTaskTransition({ task, action, context = {}, now } = {}) {
  const currentTask = cloneTask(task);
  const timestamp = now || new Date().toISOString();
  if (!currentTask.taskId) return reject('TASK_REQUIRED', 'Task is required.', currentTask);
  if (context.directStatusOverride) return reject('DIRECT_STATUS_OVERRIDE_REJECTED', 'Direct status override is not allowed.', currentTask);
  if (currentTask.isLegacyHidden || currentTask.isCurrentGeneration === false || context.isHistoricalGeneration) {
    return reject('HISTORICAL_TASK_NOT_ACTIONABLE', 'Historical legacy task cannot be mutated.', currentTask);
  }
  if (TERMINAL.has(currentTask.status) && ![TASK_ACTION.CANCEL, TASK_ACTION.EXPIRE_INVALID].includes(action)) {
    return reject('TERMINAL_TASK', 'Terminal task cannot move to a non-terminal state.', currentTask);
  }
  if (context.expectedStatus && normalizeTaskStatus(context.expectedStatus) !== currentTask.status) {
    return reject('STALE_EXPECTED_STATUS', 'Task status changed. Please refresh.', currentTask);
  }
  if (context.expectedPlanId && context.expectedPlanId !== currentTask.planId) return reject('STALE_PLAN', 'Task belongs to a different plan.', currentTask);
  if (context.expectedPlanVersion != null && currentTask.planVersion != null && Number(context.expectedPlanVersion) !== Number(currentTask.planVersion)) {
    return reject('STALE_PLAN_VERSION', 'Task belongs to a different plan version.', currentTask);
  }
  if (context.expectedRowVersion != null && currentTask.rowVersion != null && Number(context.expectedRowVersion) !== Number(currentTask.rowVersion)) {
    return reject('STALE_ROW_VERSION', 'Task was updated elsewhere.', currentTask);
  }
  if (context.dependenciesSatisfied === false) return reject('DEPENDENCY_BLOCKED', 'Pehle previous task complete kijiye.', currentTask);

  const policyError = assertTaskPolicy(currentTask, action, context);
  if (policyError) return policyError;

  const fromStatus = currentTask.status;
  let nextTask = null;
  switch (action) {
    case TASK_ACTION.SCHEDULE:
      if (fromStatus !== TASK_STATUS.DRAFT) return reject('INVALID_TRANSITION', 'Only draft tasks can be scheduled.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.SCHEDULED }, timestamp);
      break;
    case TASK_ACTION.ACTIVATE:
      if (fromStatus !== TASK_STATUS.SCHEDULED) return reject('INVALID_TRANSITION', 'Only scheduled tasks can be activated.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.ACTIVE, activatedAt: currentTask.activatedAt || timestamp }, timestamp);
      break;
    case TASK_ACTION.START:
      if (fromStatus !== TASK_STATUS.ACTIVE) return reject('INVALID_TRANSITION', 'Only active tasks can be started.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.IN_PROGRESS, startedAt: currentTask.startedAt || timestamp }, timestamp);
      break;
    case TASK_ACTION.POSTPONE:
      if (![TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS].includes(fromStatus)) return reject('INVALID_TRANSITION', 'Only active or in-progress tasks can be postponed.', currentTask);
      nextTask = applyCommon({
        ...currentTask,
        status: TASK_STATUS.PENDING,
        pendingReason: context.pendingReason || PENDING_REASON.USER_POSTPONED,
        movedToPendingAt: currentTask.movedToPendingAt || timestamp,
        snoozeCount: Number(currentTask.snoozeCount || 0) + 1,
      }, timestamp);
      break;
    case TASK_ACTION.RESUME:
      if (fromStatus !== TASK_STATUS.PENDING) return reject('INVALID_TRANSITION', 'Only pending tasks can be resumed.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: context.resumeToInProgress ? TASK_STATUS.IN_PROGRESS : TASK_STATUS.ACTIVE }, timestamp);
      if (nextTask.status === TASK_STATUS.IN_PROGRESS) nextTask.startedAt = nextTask.startedAt || timestamp;
      break;
    case TASK_ACTION.COMPLETE:
      if (![TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS].includes(fromStatus)) return reject('INVALID_TRANSITION', 'Task is not ready for normal completion.', currentTask);
      nextTask = completeTask(currentTask, context, timestamp, context.completionSource || COMPLETION_SOURCE.MENTOR_RESPONSE);
      if (nextTask.allowed === false) return nextTask;
      break;
    case TASK_ACTION.COMPLETE_MANUAL_RECOVERY:
      if (![TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS, TASK_STATUS.PENDING].includes(fromStatus)) return reject('INVALID_TRANSITION', 'Task cannot be manually recovered from this state.', currentTask);
      nextTask = completeTask(currentTask, context, timestamp, COMPLETION_SOURCE.MANUAL_RECOVERY);
      if (nextTask.allowed === false) return nextTask;
      break;
    case TASK_ACTION.DEFER_CHECK:
      if (fromStatus !== TASK_STATUS.SCHEDULED) return reject('INVALID_TRANSITION', 'Only scheduled checks can be deferred.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.SCHEDULED, nextEligibleAt: context.nextEligibleAt || timestamp }, timestamp);
      break;
    case TASK_ACTION.UNBLOCK:
      if (fromStatus !== TASK_STATUS.BLOCKED) return reject('INVALID_TRANSITION', 'Only blocked tasks can be unblocked.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: context.unblockToActive ? TASK_STATUS.ACTIVE : TASK_STATUS.SCHEDULED }, timestamp);
      break;
    case TASK_ACTION.CANCEL:
      if (TERMINAL.has(fromStatus)) return reject('TERMINAL_TASK', 'Terminal task cannot be cancelled again.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.CANCELLED, cancellationReason: context.cancellationReason || CANCELLATION_REASON.USER_MARKED_NOT_RELEVANT }, timestamp);
      break;
    case TASK_ACTION.EXPIRE_INVALID:
      if (TERMINAL.has(fromStatus)) return reject('TERMINAL_TASK', 'Terminal task cannot expire again.', currentTask);
      nextTask = applyCommon({ ...currentTask, status: TASK_STATUS.EXPIRED, cancellationReason: context.cancellationReason || 'invalid_source' }, timestamp);
      break;
    default:
      return reject('UNSUPPORTED_ACTION', 'Unsupported Mentor task action.', currentTask);
  }

  const event = buildEvent({ task: currentTask, action, fromStatus, toStatus: nextTask.status, context, now: timestamp });
  return {
    allowed: true,
    nextTask,
    event,
    sideEffects: {
      awardCoins: false,
      updateTopicState: Boolean(context.topicStateUpdate),
      topicStateUpdate: context.topicStateUpdate || null,
    },
    idempotent: false,
  };
}

function mapLegacyStatus(status) {
  return normalizeTaskStatus(status);
}

module.exports = {
  evaluateTaskTransition,
  normalizeTaskStatus,
  mapLegacyStatus,
  TASK_ACTION,
  TASK_STATUS,
  TASK_EVENT_TYPE,
};
