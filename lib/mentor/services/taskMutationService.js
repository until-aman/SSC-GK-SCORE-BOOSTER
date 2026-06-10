// lib/mentor/services/taskMutationService.js - guarded Mentor task mutation foundation (Phase 4). CommonJS.
'use strict';

const crypto = require('crypto');
const { evaluateTaskTransition, TASK_ACTION } = require('../domain/taskStateMachine');

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function userScopeFromIdentity(identity = {}) {
  const raw = identity.userScope || identity.userId || identity.email || 'unknown';
  return `u_${crypto.createHash('sha256').update(String(raw)).digest('hex').slice(0, 16)}`;
}

function deriveIdempotencyKey({ userScope, planId, taskId, action, clientOperationId }) {
  return `mentor-task:${userScope}:${planId || 'plan'}:${taskId}:${action}:${clientOperationId || 'server'}`;
}

function reject(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

/**
 * Repository write contract expected by this service:
 * - getActivePlanPointer(userIdentity) -> { planId, planVersion, status }
 * - getTaskForMutation({ userIdentity, taskId, planId }) -> canonical task
 * - compareAndUpdateTask({ userIdentity, taskId, expected, updates }) -> updated task
 * - appendTaskEvent(event)
 * - getCompletedEvent({ taskId })
 * - updateStudentTopicState(update) optional
 *
 * The service never updates by title/topic and never writes directly to Sheets.
 */
async function executeTaskMutation({
  userIdentity,
  repository,
  idempotencyStore,
  request = {},
  now = new Date().toISOString(),
} = {}) {
  if (!userIdentity) return reject('AUTH_REQUIRED', 'Authentication is required.');
  if (!repository) return reject('REPOSITORY_REQUIRED', 'Mutation repository is required.');
  if (!request.taskId || !request.action) return reject('INVALID_REQUEST', 'taskId and action are required.');
  if (!Object.values(TASK_ACTION).includes(request.action)) return reject('UNSUPPORTED_ACTION', 'Unsupported Mentor task action.');

  const userScope = userScopeFromIdentity(userIdentity);
  const idempotencyKey = request.idempotencyKey || deriveIdempotencyKey({
    userScope,
    planId: request.planId,
    taskId: request.taskId,
    action: request.action,
    clientOperationId: request.clientOperationId,
  });
  const payloadHash = stableHash({
    taskId: request.taskId,
    planId: request.planId || '',
    action: request.action,
    context: request.context || {},
  });

  const existing = await idempotencyStore?.get?.(idempotencyKey);
  if (existing) {
    if (existing.payloadHash && existing.payloadHash !== payloadHash) return reject('IDEMPOTENCY_PAYLOAD_MISMATCH', 'Same idempotency key used with different payload.');
    return { ...existing.result, idempotent: true };
  }

  const activePlan = await repository.getActivePlanPointer(userIdentity);
  if (!activePlan?.planId) return reject('NO_ACTIVE_PLAN', 'No active Mentor plan found.');
  if (request.planId && request.planId !== activePlan.planId) return reject('STALE_PLAN', 'Task does not belong to the active plan.');
  const task = await repository.getTaskForMutation({ userIdentity, taskId: request.taskId, planId: activePlan.planId });
  if (!task) return reject('TASK_NOT_FOUND', 'Task not found.');
  if (task.ownerScope && task.ownerScope !== userScope) return reject('WRONG_USER', 'Task owner mismatch.');
  if (task.planId !== activePlan.planId) return reject('STALE_PLAN', 'Task does not belong to the active plan.');
  if (task.planVersion != null && activePlan.planVersion != null && Number(task.planVersion) !== Number(activePlan.planVersion)) {
    return reject('STALE_PLAN_VERSION', 'Task plan version mismatch.');
  }
  if (task.isLegacyHidden || task.isCurrentGeneration === false) return reject('HISTORICAL_TASK_NOT_ACTIONABLE', 'Historical legacy task cannot be mutated.');
  if ([TASK_ACTION.COMPLETE, TASK_ACTION.COMPLETE_MANUAL_RECOVERY].includes(request.action) && await repository.getCompletedEvent?.({ taskId: task.taskId })) {
    return reject('DUPLICATE_COMPLETION', 'Task already has a completion event.', { currentTask: task });
  }

  const transition = evaluateTaskTransition({
    task,
    action: request.action,
    now,
    context: {
      ...(request.context || {}),
      userScope,
      planId: activePlan.planId,
      idempotencyKey,
      requestId: request.requestId || '',
      expectedPlanId: activePlan.planId,
      expectedPlanVersion: activePlan.planVersion,
      expectedStatus: request.expectedStatus,
      expectedRowVersion: request.expectedRowVersion,
    },
  });
  if (!transition.allowed) return { ok: false, ...transition };

  let updatedTask;
  try {
    updatedTask = await repository.compareAndUpdateTask({
      userIdentity,
      taskId: task.taskId,
      expected: {
        planId: activePlan.planId,
        planVersion: activePlan.planVersion,
        status: task.status,
        rowVersion: task.rowVersion,
      },
      updates: transition.nextTask,
    });
  } catch (err) {
    return reject(err.message || 'COMPARE_AND_UPDATE_FAILED', 'Task changed before mutation could be saved.');
  }

  const event = { ...transition.event, toStatus: updatedTask.status, createdAt: now };
  await repository.appendTaskEvent(event);
  if (transition.sideEffects.updateTopicState && repository.updateStudentTopicState) {
    await repository.updateStudentTopicState(transition.sideEffects.topicStateUpdate);
  }

  const result = {
    ok: true,
    task: updatedTask,
    event,
    sideEffects: transition.sideEffects,
    idempotent: false,
  };
  await idempotencyStore?.save?.(idempotencyKey, { payloadHash, result, createdAt: now });
  return result;
}

function createMemoryIdempotencyStore() {
  const rows = new Map();
  return {
    async get(key) { return rows.get(key) || null; },
    async save(key, value) {
      if (!rows.has(key)) rows.set(key, value);
      return rows.get(key);
    },
    size() { return rows.size; },
  };
}

function createMemoryMutationRepository({ activePlan = {}, tasks = [], events = [] } = {}) {
  const taskMap = new Map(tasks.map(t => [t.taskId, { ...t }]));
  const eventRows = [...events];
  return {
    async getActivePlanPointer() { return { planId: activePlan.planId || 'PLAN', planVersion: activePlan.planVersion ?? 1, status: 'active' }; },
    async getTaskForMutation({ taskId }) { const t = taskMap.get(taskId); return t ? { ...t } : null; },
    async compareAndUpdateTask({ taskId, expected, updates }) {
      const current = taskMap.get(taskId);
      if (!current) throw new Error('TASK_NOT_FOUND');
      if (expected.planId && current.planId !== expected.planId) throw new Error('STALE_PLAN');
      if (expected.planVersion != null && current.planVersion != null && Number(current.planVersion) !== Number(expected.planVersion)) throw new Error('STALE_PLAN_VERSION');
      if (expected.status && current.status !== expected.status) throw new Error('STALE_EXPECTED_STATUS');
      if (expected.rowVersion != null && current.rowVersion != null && Number(current.rowVersion) !== Number(expected.rowVersion)) throw new Error('STALE_ROW_VERSION');
      const next = { ...current, ...updates };
      taskMap.set(taskId, next);
      return { ...next };
    },
    async appendTaskEvent(event) { eventRows.push({ ...event }); return event; },
    async getCompletedEvent({ taskId }) { return eventRows.find(e => e.taskId === taskId && ['task_completed', 'manual_recovery'].includes(e.type)) || null; },
    async updateStudentTopicState(update) { this.lastTopicStateUpdate = update; },
    tasks() { return [...taskMap.values()].map(t => ({ ...t })); },
    events() { return eventRows.map(e => ({ ...e })); },
  };
}

module.exports = {
  executeTaskMutation,
  deriveIdempotencyKey,
  userScopeFromIdentity,
  createMemoryIdempotencyStore,
  createMemoryMutationRepository,
};
