// lib/mentor/repository/sheetsMutationAdapter.js - guarded Sheets persistence adapter.
// Phase 6 implements the adapter against injected/fake workbook data. Live route
// adoption remains behind default-off flags and requires schema marker checks.
'use strict';

const crypto = require('crypto');
const { buildNormalizedHeaderMap, cell } = require('./headerNormalizer');
const { TABS, validateRequiredColumns } = require('./sheetsSchema');

function payloadHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function rowObject(headers, row) {
  const map = buildNormalizedHeaderMap(headers || []);
  const out = {};
  Object.keys(map.index).forEach(name => { out[name] = cell(row, map, name) || ''; });
  return out;
}

function ensureHeader(tab, column) {
  tab.headers = tab.headers || [];
  const map = buildNormalizedHeaderMap(tab.headers);
  if (!(column in map.index)) {
    tab.headers.push(column);
    (tab.rows || []).forEach(row => row.push(''));
  }
}

function setCell(tab, rowIndex, column, value) {
  ensureHeader(tab, column);
  const map = buildNormalizedHeaderMap(tab.headers);
  const col = map.index[column];
  tab.rows[rowIndex] = tab.rows[rowIndex] || [];
  while (tab.rows[rowIndex].length <= col) tab.rows[rowIndex].push('');
  tab.rows[rowIndex][col] = value == null ? '' : String(value);
}

function getCell(tab, rowIndex, column) {
  const map = buildNormalizedHeaderMap(tab.headers || []);
  const col = map.index[column];
  if (typeof col !== 'number') return '';
  return tab.rows?.[rowIndex]?.[col] || '';
}

function userScopeHash(identity = {}) {
  return crypto.createHash('sha256').update(String(identity.userScope || identity.email || identity.userId || 'unknown')).digest('hex').slice(0, 16);
}

function createSheetsMutationAdapter({ workbook, enforceSchema = true } = {}) {
  const data = workbook || {};
  const tasks = data.tasks || { headers: [], rows: [] };
  const plans = data.plans || { headers: [], rows: [] };
  const logs = data.logs || { headers: [], rows: [] };
  const mutationRequests = data.mutationRequests || { headers: [], rows: [] };
  const schema = data.schema || { headers: [], rows: [] };
  data.tasks = tasks;
  data.plans = plans;
  data.logs = logs;
  data.mutationRequests = mutationRequests;
  data.schema = schema;

  function assertSchemaReady() {
    if (!enforceSchema) return;
    const required = [
      validateRequiredColumns(tasks.headers, TABS.TASKS),
      validateRequiredColumns(plans.headers, TABS.PLANS),
      validateRequiredColumns(logs.headers, TABS.LOGS),
      validateRequiredColumns(mutationRequests.headers, TABS.MUTATION_REQUESTS),
      validateRequiredColumns(schema.headers, TABS.SCHEMA),
    ];
    const bad = required.find(r => !r.ok);
    if (bad) throw new Error('MENTOR_SHEETS_SCHEMA_NOT_READY');
    const rows = schema.rows || [];
    const marker = rows.some((_, i) => getCell(schema, i, 'SchemaName') === 'mentor' && String(getCell(schema, i, 'SchemaVersion')) === '2');
    if (!marker) throw new Error('MENTOR_SCHEMA_MARKER_MISSING');
  }

  function findTaskRows({ taskId, planId }) {
    const matches = [];
    (tasks.rows || []).forEach((_, i) => {
      if (getCell(tasks, i, 'TaskId') === taskId && (!planId || getCell(tasks, i, 'PlanId') === planId)) matches.push(i);
    });
    return matches;
  }

  function taskAt(rowIndex) {
    return rowObject(tasks.headers, tasks.rows[rowIndex]);
  }

  function findPlanRow(planId) {
    const matches = [];
    (plans.rows || []).forEach((_, i) => {
      if (getCell(plans, i, 'PlanId') === planId && String(getCell(plans, i, 'Status')).toLowerCase() === 'active') matches.push(i);
    });
    if (matches.length !== 1) throw new Error(matches.length ? 'DUPLICATE_ACTIVE_PLAN_ROWS' : 'ACTIVE_PLAN_NOT_FOUND');
    return matches[0];
  }

  return {
    workbook: data,

    assertSchemaReady,

    async getActivePlanPointer(_identity = {}, planId) {
      assertSchemaReady();
      const row = planId ? findPlanRow(planId) : (plans.rows || []).findIndex((_, i) => String(getCell(plans, i, 'Status')).toLowerCase() === 'active');
      if (row < 0) return null;
      return {
        planId: getCell(plans, row, 'PlanId'),
        planVersion: Number(getCell(plans, row, 'PlanVersion') || 1),
        rowVersion: Number(getCell(plans, row, 'RowVersion') || 1),
        status: getCell(plans, row, 'Status'),
      };
    },

    async getTaskForMutation({ taskId, planId }) {
      assertSchemaReady();
      const rows = findTaskRows({ taskId, planId });
      if (rows.length > 1) throw new Error('DUPLICATE_TASK_ROWS');
      if (!rows.length) return null;
      const obj = taskAt(rows[0]);
      return {
        ...obj,
        taskId: obj.TaskId,
        planId: obj.PlanId,
        planVersion: Number(obj.PlanVersion || 1),
        status: String(obj.Status || '').toLowerCase(),
        rowVersion: Number(obj.RowVersion || 1),
        isCurrentGeneration: true,
        isLegacyHidden: false,
      };
    },

    async compareAndUpdateTask({ taskId, expected = {}, updates = {} }) {
      assertSchemaReady();
      const rows = findTaskRows({ taskId, planId: expected.planId });
      if (rows.length > 1) throw new Error('DUPLICATE_TASK_ROWS');
      if (!rows.length) throw new Error('TASK_NOT_FOUND');
      const i = rows[0];
      if (expected.planId && getCell(tasks, i, 'PlanId') !== expected.planId) throw new Error('STALE_PLAN');
      if (expected.planVersion != null && Number(getCell(tasks, i, 'PlanVersion') || 1) !== Number(expected.planVersion)) throw new Error('STALE_PLAN_VERSION');
      if (expected.status && String(getCell(tasks, i, 'Status')).toLowerCase() !== String(expected.status).toLowerCase()) throw new Error('STALE_EXPECTED_STATUS');
      if (expected.rowVersion != null && Number(getCell(tasks, i, 'RowVersion') || 1) !== Number(expected.rowVersion)) throw new Error('STALE_ROW_VERSION');
      Object.entries(updates).forEach(([key, value]) => {
        const column = {
          taskId: 'TaskId', planId: 'PlanId', planVersion: 'PlanVersion', status: 'Status',
          rowVersion: 'RowVersion', completedAt: 'CompletedAt', updatedAt: 'UpdatedAt',
          pendingReason: 'PendingReason', movedToPendingAt: 'MovedToPendingAt',
          nextEligibleAt: 'NextEligibleAt', nextEligibleResurfaceAt: 'NextEligibleResurfaceAt',
          completionSource: 'CompletionSource', linkedQuizSessionId: 'LinkedQuizSessionId',
          cancellationReason: 'CancellationReason',
        }[key] || key;
        setCell(tasks, i, column, value);
      });
      setCell(tasks, i, 'RowVersion', Number(getCell(tasks, i, 'RowVersion') || 1) + 1);
      return this.getTaskForMutation({ taskId, planId: expected.planId });
    },

    async appendTaskEvent(event) {
      assertSchemaReady();
      const row = logs.headers.map(header => {
        const h = String(header || '').trim();
        return {
          LogId: event.eventId || '',
          EventId: event.eventId || '',
          TaskId: event.taskId || '',
          PlanId: event.planId || '',
          ActionType: event.type || event.action || '',
          FromStatus: event.fromStatus || '',
          ToStatus: event.toStatus || '',
          CanonicalAction: event.action || '',
          IdempotencyKey: event.idempotencyKey || '',
          RequestId: event.requestId || '',
          EventPayloadJSON: JSON.stringify(event.payload || {}),
          CreatedAt: event.createdAt || new Date().toISOString(),
          SourcePage: event.source || '',
          QuizSessionId: event.quizSessionId || '',
          Notes: '',
        }[h] ?? '';
      });
      logs.rows.push(row);
      return event;
    },

    async getIdempotencyResult(key) {
      assertSchemaReady();
      const row = (mutationRequests.rows || []).findIndex((_, i) => getCell(mutationRequests, i, 'IdempotencyKey') === key);
      if (row < 0) return null;
      return {
        idempotencyKey: key,
        payloadHash: getCell(mutationRequests, row, 'PayloadHash'),
        status: getCell(mutationRequests, row, 'Status'),
        result: JSON.parse(getCell(mutationRequests, row, 'ResultJSON') || '{}'),
      };
    },

    async saveIdempotencyResult(key, { userIdentity = {}, planId = '', taskId = '', action = '', payload = {}, result = {}, status = 'completed', now = new Date().toISOString() } = {}) {
      assertSchemaReady();
      const existing = await this.getIdempotencyResult(key);
      const nextHash = payloadHash(payload);
      if (existing) {
        if (existing.payloadHash !== nextHash) throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
        return existing;
      }
      const row = mutationRequests.headers.map(header => ({
        IdempotencyKey: key,
        UserScopeHash: userScopeHash(userIdentity),
        PlanId: planId,
        TaskId: taskId,
        Action: action,
        PayloadHash: nextHash,
        Status: status,
        ResultJSON: JSON.stringify(result || {}),
        CreatedAt: now,
        CompletedAt: status === 'completed' ? now : '',
        ExpiresAt: '',
      }[String(header || '').trim()] ?? ''));
      mutationRequests.rows.push(row);
      return this.getIdempotencyResult(key);
    },

    async reserveTaskNumbers({ planId, count, expectedRowVersion }) {
      assertSchemaReady();
      const row = findPlanRow(planId);
      if (expectedRowVersion != null && Number(getCell(plans, row, 'RowVersion') || 1) !== Number(expectedRowVersion)) throw new Error('STALE_ROW_VERSION');
      const first = Number(getCell(plans, row, 'NextTaskNumber') || 1);
      const reserved = Array.from({ length: count }, (_, i) => first + i);
      setCell(plans, row, 'NextTaskNumber', first + count);
      setCell(plans, row, 'RowVersion', Number(getCell(plans, row, 'RowVersion') || 1) + 1);
      return { firstTaskNumber: first, taskNumbers: reserved, nextTaskNumber: first + count };
    },

    async updatePlanRolloverState({ planId, lastProcessedCalendarDay, lastDailyRolloverAt }) {
      assertSchemaReady();
      const row = findPlanRow(planId);
      setCell(plans, row, 'LastProcessedCalendarDay', lastProcessedCalendarDay);
      setCell(plans, row, 'LastDailyRolloverAt', lastDailyRolloverAt);
      setCell(plans, row, 'RowVersion', Number(getCell(plans, row, 'RowVersion') || 1) + 1);
      return rowObject(plans.headers, plans.rows[row]);
    },

    async updateFeaturedPendingSelection({ planId, featuredPendingTaskId, featuredPendingForCalendarDay }) {
      assertSchemaReady();
      const row = findPlanRow(planId);
      setCell(plans, row, 'FeaturedPendingTaskId', featuredPendingTaskId);
      setCell(plans, row, 'FeaturedPendingForCalendarDay', featuredPendingForCalendarDay);
      setCell(plans, row, 'RowVersion', Number(getCell(plans, row, 'RowVersion') || 1) + 1);
      return rowObject(plans.headers, plans.rows[row]);
    },
  };
}

module.exports = {
  createSheetsMutationAdapter,
  userScopeHash,
  payloadHash,
};
