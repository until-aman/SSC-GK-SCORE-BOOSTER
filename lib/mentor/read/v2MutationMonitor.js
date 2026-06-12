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

// Expected steady-state of the affected real plan (read-only invariant). Any drift
// from this means a real-user plan was mutated — a CRITICAL guardrail breach.
const EXPECTED_AFFECTED_REAL_PLAN = Object.freeze({ completed: 5, snoozed: 10 });

/**
 * Pure operator-facing alert evaluation over an audit snapshot. No I/O.
 * @param {Object} audit  output of auditV2Mutations
 * @param {Object} [opts]
 * @param {Object} [opts.flags]                     { MENTOR_DAILY_ROLLOVER_V2, MENTOR_PENDING_LIFECYCLE_V2 } booleans
 * @param {Object|null} [opts.expectedAffectedRealPlan]  baseline; pass null to skip the drift check
 * @returns {{status:'OK'|'WARNING'|'CRITICAL', alerts:Array<{level,code,message}>}}
 */
function evaluateMonitorAlerts(audit = {}, { flags = {}, expectedAffectedRealPlan = EXPECTED_AFFECTED_REAL_PLAN } = {}) {
  const alerts = [];
  const add = (level, code, message) => alerts.push({ level, code, message });
  const num = v => (v == null ? 0 : Number(v));
  const allowAll = flags.MENTOR_V2_MUTATION_ALLOW_ALL === true;

  if (allowAll) {
    // Deliberate global enablement — visible but not a failure.
    add('WARNING', 'ALLOW_ALL_ENABLED', 'V2 mutations are enabled for all authenticated users.');
  }
  // "Outside allowlist" is only a breach when the allowlist is the gate. With
  // allow-all on, mutations from non-allowlisted scopes are expected.
  if (!allowAll && num(audit.unexpectedMutationsOutsideAllowlist) > 0) {
    add('CRITICAL', 'UNEXPECTED_OUTSIDE_ALLOWLIST', `${audit.unexpectedMutationsOutsideAllowlist} mutation(s) recorded for a scope not in the allowlist`);
  }
  if (num(audit.duplicateIdempotencyKeys) > 0) {
    add('CRITICAL', 'DUPLICATE_IDEMPOTENCY_KEYS', `${audit.duplicateIdempotencyKeys} duplicate idempotency key(s) — possible double-write`);
  }
  const failed = num(audit.failedMutationRequests);
  if (failed > 0) {
    add(failed >= 3 ? 'CRITICAL' : 'WARNING', 'FAILED_MUTATIONS', `${failed} failed mutation request(s)`);
  }
  if (expectedAffectedRealPlan) {
    const got = audit.affectedRealPlanStatus || {};
    const keys = new Set([...Object.keys(expectedAffectedRealPlan), ...Object.keys(got)]);
    const drift = [...keys].filter(k => num(expectedAffectedRealPlan[k]) !== num(got[k]));
    if (drift.length) {
      add('CRITICAL', 'AFFECTED_REAL_PLAN_DRIFT', `Affected real plan changed (${audit.affectedRealPlanId || ''}): expected ${JSON.stringify(expectedAffectedRealPlan)}, got ${JSON.stringify(got)}`);
    }
  }
  if (flags.MENTOR_DAILY_ROLLOVER_V2 === true) {
    add('CRITICAL', 'ROLLOVER_WRITE_ENABLED', 'MENTOR_DAILY_ROLLOVER_V2 is enabled — daily-rollover writes must stay OFF until a controlled phase');
  }
  if (flags.MENTOR_PENDING_LIFECYCLE_V2 === true) {
    add('CRITICAL', 'PENDING_LIFECYCLE_WRITE_ENABLED', 'MENTOR_PENDING_LIFECYCLE_V2 is enabled — pending-lifecycle writes must stay OFF until a controlled phase');
  }
  const status = alerts.some(a => a.level === 'CRITICAL') ? 'CRITICAL' : alerts.some(a => a.level === 'WARNING') ? 'WARNING' : 'OK';
  return { status, alerts };
}

module.exports = { auditV2Mutations, evaluateMonitorAlerts, scopeFromIdempotencyKey, DEFAULT_AFFECTED_PLAN_ID, EXPECTED_AFFECTED_REAL_PLAN };
