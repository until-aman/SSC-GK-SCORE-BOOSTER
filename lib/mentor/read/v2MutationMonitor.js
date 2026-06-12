// lib/mentor/read/v2MutationMonitor.js — read-only V2 mutation health audit.
// CommonJS, injectable `sheets` client. Performs ONLY values.get (read). Returns
// non-sensitive aggregates; never writes; never logs full emails.
'use strict';

const { buildNormalizedHeaderMap } = require('../repository/headerNormalizer');

const DEFAULT_AFFECTED_PLAN_ID = 'MP_1780920810055';

function scopeFromIdempotencyKey(key) {
  // mentor-task:<scope>:<plan>:<task>:<action>:<op>
  const parts = String(key || '').split(':');
  return parts.length >= 2 && parts[0] === 'mentor-task' ? parts[1] : '';
}

async function auditV2Mutations(sheets, { affectedPlanId = DEFAULT_AFFECTED_PLAN_ID, allowedUserHashes = [] } = {}) {
  const SID = process.env.GOOGLE_SHEET_ID;
  const read = async tab => {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SID, range: `${tab}!A:ZZ` });
    const v = (res.data && res.data.values) || [];
    return { h: v[0] || [], rows: v.slice(1).filter(r => r.some(c => String(c || '').trim() !== '')) };
  };

  const mr = await read('MentorMutationRequests');
  const mm = buildNormalizedHeaderMap(mr.h);
  const mrGet = (r, n) => (typeof mm.index[n] === 'number' ? r[mm.index[n]] : '');
  const keys = mr.rows.map(r => mrGet(r, 'IdempotencyKey'));
  const keyCounts = keys.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {});
  const duplicateIdempotencyKeys = Object.values(keyCounts).filter(c => c > 1).length;
  const allowedSet = new Set(allowedUserHashes);
  const unexpectedOutsideAllowlist = allowedUserHashes.length
    ? mr.rows.filter(r => { const sc = scopeFromIdempotencyKey(mrGet(r, 'IdempotencyKey')); return sc && !allowedSet.has(sc); }).length
    : null; // null = allowlist not provided to the audit

  const logs = await read('MentorTaskLogs');
  const lm = buildNormalizedHeaderMap(logs.h);
  const canonicalEventCount = action => logs.rows.filter(r => String((typeof lm.index.CanonicalAction === 'number' && r[lm.index.CanonicalAction]) || '') === action).length;
  const canonicalPostponeEvents = canonicalEventCount('POSTPONE');
  const canonicalResumeEvents = canonicalEventCount('RESUME');
  const canonicalCompleteEvents = canonicalEventCount('COMPLETE');

  const tasks = await read('MentorTasks');
  const tm = buildNormalizedHeaderMap(tasks.h);
  const tGet = (r, n) => (typeof tm.index[n] === 'number' ? r[tm.index[n]] : '');
  const pendingUserPostponed = tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'pending' && String(tGet(r, 'PendingReason')) === 'user_postponed').length;
  // Canonical pending (Phase 9C): Status=pending WITH v2 evidence (PendingReason or MovedToPendingAt).
  const canonicalPendingTaskRows = tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'pending' && (String(tGet(r, 'PendingReason') || '').trim() !== '' || String(tGet(r, 'MovedToPendingAt') || '').trim() !== '')).length;
  // Legacy snoozed (no v2 evidence) — hidden from canonical pending.
  const legacySnoozedHiddenCount = tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'snoozed').length;
  const tasksRowVersionGt1 = tasks.rows.filter(r => Number(tGet(r, 'RowVersion') || 0) > 1).length;
  const affectedRealPlanStatus = {};
  tasks.rows.filter(r => tGet(r, 'PlanId') === affectedPlanId).forEach(r => { const s = String(tGet(r, 'Status')).toLowerCase(); affectedRealPlanStatus[s] = (affectedRealPlanStatus[s] || 0) + 1; });

  return {
    totalMutationRequests: mr.rows.length,
    completedMutationRequests: mr.rows.filter(r => String(mrGet(r, 'Status')).toLowerCase() === 'completed').length,
    failedMutationRequests: mr.rows.filter(r => String(mrGet(r, 'Status')).toLowerCase() === 'failed').length,
    postponeMutationCount: mr.rows.filter(r => String(mrGet(r, 'Action')).toUpperCase() === 'POSTPONE').length,
    resumeMutationCount: mr.rows.filter(r => String(mrGet(r, 'Action')).toUpperCase() === 'RESUME').length,
    completeMutationCount: mr.rows.filter(r => String(mrGet(r, 'Action')).toUpperCase() === 'COMPLETE').length,
    failedMutationRequestsByCode: mr.rows.filter(r => String(mrGet(r, 'Status')).toLowerCase() === 'failed').length,
    duplicateIdempotencyKeys,
    unexpectedMutationsOutsideAllowlist: unexpectedOutsideAllowlist,
    canonicalPostponeEvents,
    canonicalResumeEvents,
    canonicalCompleteEvents,
    completedQuizSyncTaskCount: tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'completed' && String(tGet(r, 'CompletionSource')) === 'quiz_sync').length,
    pendingUserPostponedTasks: pendingUserPostponed,
    canonicalPendingTaskRows,
    legacySnoozedHiddenCount,
    tasksRowVersionGt1,
    mentorTaskLogsCount: logs.rows.length,
    mentorTasksCount: tasks.rows.length,
    affectedRealPlanId: affectedPlanId,
    affectedRealPlanStatus,
  };
}

module.exports = { auditV2Mutations, scopeFromIdempotencyKey, DEFAULT_AFFECTED_PLAN_ID };
