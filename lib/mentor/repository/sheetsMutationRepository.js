// lib/mentor/repository/sheetsMutationRepository.js — live Sheets-backed mutation
// repository + idempotency store implementing the executeTaskMutation contract.
// CommonJS. Accepts an injected `sheets` client so it is fully testable with a
// fake in-memory client (no live Sheet). Used by the gated V2 task-action cut-over
// (Phase 9B1); never executes while the mutation flags are false.
//
// Safety: compareAndUpdateTask verifies PlanId/PlanVersion/Status/RowVersion before
// writing, writes ONLY a whitelisted set of canonical columns (never adds columns),
// and increments RowVersion. Idempotency rows are appended to MentorMutationRequests.
'use strict';

const { buildNormalizedHeaderMap, normalizeHeader } = require('./headerNormalizer');

// canonical task field -> physical MentorTasks column (whitelist; unmapped fields ignored)
const TASK_UPDATE_COLUMNS = Object.freeze({
  status: 'Status',
  pendingReason: 'PendingReason',
  movedToPendingAt: 'MovedToPendingAt',
  nextEligibleResurfaceAt: 'NextEligibleResurfaceAt',
  nextEligibleAt: 'NextEligibleAt',
  completedAt: 'CompletedAt',
  completionSource: 'CompletionSource',
  linkedQuizSessionId: 'LinkedQuizSessionId',
  snoozeCount: 'SnoozeCount',
  cancellationReason: 'CancellationReason',
});

function rowObject(headers, row) {
  const map = buildNormalizedHeaderMap(headers || []);
  const out = {};
  Object.keys(map.index).forEach(n => { out[n] = (row && row[map.index[n]]) || ''; });
  return out;
}

function createSheetsIo(sheets) {
  const SID = process.env.GOOGLE_SHEET_ID;
  return {
    async read(tab) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: `${tab}!A:ZZ` });
      const v = (res.data && res.data.values) || [];
      return { headers: v[0] || [], rows: v.slice(1) };
    },
    async updateRow(tab, sheetRowNumber, rowValues) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SID, range: `${tab}!A${sheetRowNumber}`, valueInputOption: 'RAW', requestBody: { values: [rowValues] } });
    },
    async appendRow(tab, rowValues) {
      await sheets.spreadsheets.values.append({ spreadsheetId: SID, range: `${tab}!A:ZZ`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [rowValues] } });
    },
  };
}

/**
 * @param {Object} opts
 * @param {Object} opts.sheets  googleapis Sheets client (or a fake in tests)
 * @param {string} opts.email
 * @param {Set<string>} [opts.currentGenerationTaskIds]  from a Repository V2 snapshot
 * @param {Set<string>} [opts.hiddenTaskIds]             from a Repository V2 snapshot
 */
function createSheetsMutationRepository({ sheets, email, currentGenerationTaskIds = new Set(), hiddenTaskIds = new Set() }) {
  const io = createSheetsIo(sheets);

  async function getActivePlanPointer() {
    const { headers, rows } = await io.read('MentorPlans');
    const m = buildNormalizedHeaderMap(headers);
    const i = rows.findIndex(r => r[m.index.Email] === email && String(r[m.index.Status] || '').toLowerCase() === 'active');
    if (i < 0) return null;
    const r = rows[i];
    return {
      planId: r[m.index.PlanId],
      planVersion: Number(r[m.index.PlanVersion] || 1),
      rowVersion: Number(r[m.index.RowVersion] || 1),
      status: 'active',
    };
  }

  function findTaskRows(rows, m, taskId, planId) {
    return rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r[m.index.Email] === email && r[m.index.TaskId] === taskId && (!planId || r[m.index.PlanId] === planId));
  }

  async function getTaskForMutation({ taskId, planId }) {
    const { headers, rows } = await io.read('MentorTasks');
    const m = buildNormalizedHeaderMap(headers);
    const matches = findTaskRows(rows, m, taskId, planId);
    if (matches.length > 1) throw new Error('DUPLICATE_TASK_ROWS');
    if (!matches.length) return null;
    const o = rowObject(headers, matches[0].r);
    return {
      ...o,
      taskId: o.TaskId,
      planId: o.PlanId,
      planVersion: Number(o.PlanVersion || 1),
      status: String(o.Status || '').toLowerCase(),
      rawLegacyStatus: String(o.Status || '').toLowerCase(),
      rowVersion: Number(o.RowVersion || 1),
      type: o.Type,
      isCurrentGeneration: currentGenerationTaskIds.has(taskId),
      isLegacyHidden: hiddenTaskIds.has(taskId),
    };
  }

  async function compareAndUpdateTask({ taskId, expected = {}, updates = {} }) {
    const { headers, rows } = await io.read('MentorTasks');
    const m = buildNormalizedHeaderMap(headers);
    const matches = findTaskRows(rows, m, taskId, expected.planId);
    if (matches.length > 1) throw new Error('DUPLICATE_TASK_ROWS');
    if (!matches.length) throw new Error('TASK_NOT_FOUND');
    const { r, idx } = matches[0];
    const get = name => (typeof m.index[name] === 'number' ? r[m.index[name]] : '');
    if (expected.planId && get('PlanId') !== expected.planId) throw new Error('STALE_PLAN');
    if (expected.planVersion != null && Number(get('PlanVersion') || 1) !== Number(expected.planVersion)) throw new Error('STALE_PLAN_VERSION');
    if (expected.status && String(get('Status')).toLowerCase() !== String(expected.status).toLowerCase()) throw new Error('STALE_EXPECTED_STATUS');
    if (expected.rowVersion != null && Number(get('RowVersion') || 1) !== Number(expected.rowVersion)) throw new Error('STALE_ROW_VERSION');

    const next = [...r];
    while (next.length < headers.length) next.push('');
    Object.entries(updates).forEach(([key, value]) => {
      const col = TASK_UPDATE_COLUMNS[key];
      if (!col) return; // whitelist only — never write/ add unmapped columns
      const ci = m.index[col];
      if (typeof ci === 'number') next[ci] = value == null ? '' : String(value);
    });
    const nextRowVersion = Number(get('RowVersion') || 1) + 1;
    if (typeof m.index.RowVersion === 'number') next[m.index.RowVersion] = String(nextRowVersion);
    if (typeof m.index.UpdatedAt === 'number') next[m.index.UpdatedAt] = new Date().toISOString();
    await io.updateRow('MentorTasks', idx + 2, next);
    const o = rowObject(headers, next);
    return { ...o, taskId: o.TaskId, planId: o.PlanId, planVersion: Number(o.PlanVersion || 1), status: String(o.Status || '').toLowerCase(), rowVersion: nextRowVersion };
  }

  async function appendTaskEvent(event) {
    const { headers } = await io.read('MentorTaskLogs');
    const valuesByHeader = {
      LogId: event.eventId || '', EventId: event.eventId || '', TaskId: event.taskId || '', PlanId: event.planId || '',
      ActionType: event.type || event.action || '', FromStatus: event.fromStatus || '', ToStatus: event.toStatus || '',
      CanonicalAction: event.action || '', IdempotencyKey: event.idempotencyKey || '', RequestId: event.requestId || '',
      EventPayloadJSON: JSON.stringify(event.payload || {}), CreatedAt: event.createdAt || new Date().toISOString(),
      SourcePage: event.source || '', QuizSessionId: '', Notes: '',
    };
    const row = headers.map(h => { const v = valuesByHeader[normalizeHeader(h)]; return v == null ? '' : String(v); });
    await io.appendRow('MentorTaskLogs', row);
    return event;
  }

  async function getCompletedEvent({ taskId }) {
    const { headers, rows } = await io.read('MentorTaskLogs');
    const m = buildNormalizedHeaderMap(headers);
    return rows.find(r => r[m.index.TaskId] === taskId && ['task_completed', 'manual_recovery'].includes(String((m.index.ActionType != null && r[m.index.ActionType]) || (m.index.CanonicalAction != null && r[m.index.CanonicalAction]) || ''))) || null;
  }

  return { getActivePlanPointer, getTaskForMutation, compareAndUpdateTask, appendTaskEvent, getCompletedEvent };
}

/**
 * Idempotency store backed by MentorMutationRequests. Stores executeTaskMutation's
 * precomputed payloadHash verbatim (so get/compare is exact).
 */
function createSheetsIdempotencyStore({ sheets, email }) {
  const io = createSheetsIo(sheets);
  return {
    async get(key) {
      const { headers, rows } = await io.read('MentorMutationRequests');
      const m = buildNormalizedHeaderMap(headers);
      const row = rows.find(r => r[m.index.IdempotencyKey] === key);
      if (!row) return null;
      let result = {};
      try { result = JSON.parse(row[m.index.ResultJSON] || '{}'); } catch (_) { result = {}; }
      return { payloadHash: row[m.index.PayloadHash] || '', result };
    },
    async save(key, { payloadHash, result, createdAt } = {}) {
      const existing = await this.get(key);
      if (existing) return existing; // first-writer-wins; executeTaskMutation guards payload mismatch
      const { headers } = await io.read('MentorMutationRequests');
      const now = createdAt || new Date().toISOString();
      const valuesByHeader = {
        IdempotencyKey: key, UserScopeHash: '', PlanId: (result && result.task && result.task.planId) || '',
        TaskId: (result && result.task && result.task.taskId) || '', Action: (result && result.event && result.event.action) || '',
        PayloadHash: payloadHash || '', Status: 'completed', ResultJSON: JSON.stringify(result || {}),
        CreatedAt: now, CompletedAt: now, ExpiresAt: '',
      };
      const row = headers.map(h => { const v = valuesByHeader[normalizeHeader(h)]; return v == null ? '' : String(v); });
      await io.appendRow('MentorMutationRequests', row);
      return { payloadHash: payloadHash || '', result: result || {} };
    },
  };
}

/**
 * Phase 10C — durable LastProcessedCalendarDay storage on MentorPlans.
 * Additive: tolerates a missing column (returns { written:false, reason } and
 * never adds columns). Used only by the gated rollover write executor.
 */
function createSheetsPlanWriter({ sheets, email }) {
  const io = createSheetsIo(sheets);
  async function getLastProcessedCalendarDay(planId) {
    const { headers, rows } = await io.read('MentorPlans');
    const m = buildNormalizedHeaderMap(headers);
    if (typeof m.index.LastProcessedCalendarDay !== 'number') return null;
    const row = rows.find(r => r[m.index.PlanId] === planId && (!email || r[m.index.Email] === email));
    const v = row ? row[m.index.LastProcessedCalendarDay] : '';
    return String(v || '').trim() === '' ? null : Number(v);
  }
  async function setLastProcessedCalendarDay(planId, day) {
    const { headers, rows } = await io.read('MentorPlans');
    const m = buildNormalizedHeaderMap(headers);
    if (typeof m.index.LastProcessedCalendarDay !== 'number') return { written: false, reason: 'LAST_PROCESSED_COLUMN_MISSING' };
    const idx = rows.findIndex(r => r[m.index.PlanId] === planId && (!email || r[m.index.Email] === email));
    if (idx === -1) return { written: false, reason: 'PLAN_ROW_NOT_FOUND' };
    const next = [...rows[idx]]; while (next.length < headers.length) next.push('');
    next[m.index.LastProcessedCalendarDay] = String(day);
    await io.updateRow('MentorPlans', idx + 2, next);
    return { written: true };
  }
  return { getLastProcessedCalendarDay, setLastProcessedCalendarDay };
}

module.exports = { createSheetsMutationRepository, createSheetsIdempotencyStore, createSheetsPlanWriter, TASK_UPDATE_COLUMNS };
