// lib/mentor/read/v2MutationMonitor.js — read-only V2 mutation health audit.
// CommonJS, injectable `sheets` client. Performs ONLY values.get (read). Returns
// non-sensitive aggregates; never writes; never logs full emails.
'use strict';

const { buildNormalizedHeaderMap } = require('../repository/headerNormalizer');

const DEFAULT_AFFECTED_PLAN_ID = 'MP_1780920810055';

// Phase 10E — daily-rollover monitor constants (read-only).
const ROLLOVER_KEY_PREFIX = 'mentor-rollover:';            // mentor-rollover:<scope>:<plan>:<calendarDay>
const ROLLOVER_SOURCE = 'daily_rollover';                  // MentorTaskLogs.SourcePage for rollover events
const ROLLOVER_PENDING_REASONS = new Set(['day_ended_incomplete', 'in_progress_abandoned']);
const QUICK_CHECK_TYPES = new Set(['coverage_check', 'confidence_check', 'feedback_task']);
const MAX_ACTIVE_TASKS = 3;                                // mirror dailyRolloverService cap
const PENDING_BACKLOG_WARN = 25;                           // per-plan canonical-pending backlog WARNING threshold
const ROLLOVER_PENDING_VOLUME_WARN = 50;                   // total tasks moved-to-pending by rollover WARNING threshold

function scopeFromIdempotencyKey(key) {
  // mentor-task:<scope>:<plan>:<task>:<action>:<op>
  const parts = String(key || '').split(':');
  return parts.length >= 2 && parts[0] === 'mentor-task' ? parts[1] : '';
}

function isRolloverKey(key) {
  return String(key || '').startsWith(ROLLOVER_KEY_PREFIX);
}

function parseRolloverKey(key) {
  // mentor-rollover:<scope>:<plan>:<calendarDay>
  const p = String(key || '').split(':');
  return p.length >= 4 && p[0] === 'mentor-rollover' ? { scope: p[1], plan: p[2], calendarDay: p[3] } : null;
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

  const lGet = (r, n) => (typeof lm.index[n] === 'number' ? r[lm.index[n]] : '');

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

  // ── Phase 10E: read-only daily-rollover counters ──────────────────────────────
  // Rollover idempotency rows live on MentorMutationRequests (Action=ROLLOVER /
  // IdempotencyKey mentor-rollover:*). Per-task rollover events live on MentorTaskLogs
  // (SourcePage=daily_rollover). Anomalies are derived from MentorTasks/MentorPlans.
  const plans = await read('MentorPlans');
  const pm = buildNormalizedHeaderMap(plans.h);
  const pGet = (r, n) => (typeof pm.index[n] === 'number' ? r[pm.index[n]] : '');

  const rolloverMrRows = mr.rows.filter(r => isRolloverKey(mrGet(r, 'IdempotencyKey')) || String(mrGet(r, 'Action')).toUpperCase() === 'ROLLOVER');
  const rolloverMutationRequestCount = rolloverMrRows.length;
  const rolloverKeyList = rolloverMrRows.map(r => mrGet(r, 'IdempotencyKey')).filter(isRolloverKey);
  const rolloverKeyCounts = rolloverKeyList.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {});
  const duplicateRolloverIdempotencyKeys = Object.values(rolloverKeyCounts).filter(c => c > 1).length;
  const failedRolloverMutationRequests = rolloverMrRows.filter(r => String(mrGet(r, 'Status')).toLowerCase() === 'failed').length;

  const rolloverLogRows = logs.rows.filter(r => String(lGet(r, 'SourcePage') || '').toLowerCase() === ROLLOVER_SOURCE || isRolloverKey(lGet(r, 'IdempotencyKey')));
  const rolloverTaskEventCount = rolloverLogRows.length;
  const tasksMovedToPendingByRollover = rolloverLogRows.filter(r => String(lGet(r, 'ToStatus') || '').toLowerCase() === 'pending').length;

  // Plans that have been touched by rollover (events and/or finalized idempotency rows).
  // The materialize cap and pending invariants are rollover POST-conditions, so we only
  // judge plans rollover actually processed — a plan the normal generator created with
  // >3 active tasks is NOT a rollover anomaly (mirrors the Phase 9M3 false-positive fix).
  const planIdsWithRollover = new Set();
  rolloverLogRows.forEach(r => { const p = lGet(r, 'PlanId'); if (p) planIdsWithRollover.add(p); });
  rolloverMrRows.forEach(r => { const parsed = parseRolloverKey(mrGet(r, 'IdempotencyKey')); if (parsed && parsed.plan) planIdsWithRollover.add(parsed.plan); });

  // Quick-check task that ended up pending with rollover evidence — must never happen.
  // Scoped to rollover-processed plans so a non-rollover pending row can't false-fire.
  const quickChecksIncorrectlyPendingByRollover = tasks.rows.filter(r => {
    if (!planIdsWithRollover.has(tGet(r, 'PlanId'))) return false;
    if (!QUICK_CHECK_TYPES.has(String(tGet(r, 'Type') || '').toLowerCase())) return false;
    if (String(tGet(r, 'Status')).toLowerCase() !== 'pending') return false;
    const reason = String(tGet(r, 'PendingReason') || '').toLowerCase();
    return ROLLOVER_PENDING_REASONS.has(reason) || String(tGet(r, 'MovedToPendingAt') || '').trim() !== '';
  }).length;

  // Phase 10D-FIX (Bug C): the active-task cap and the day-marker are CURRENT-generation
  // invariants. A reused PlanId (Phase 10D pilot: 12 plan rows / one PlanId, GenerationId
  // blank) must not let stale generations inflate the active count. Mirror
  // legacyGenerationAdapter: the active generation is the NEWEST Status=active plan row;
  // a task/marker belongs to it when its CreatedAt >= that row's CreatedAt.
  const planTs = v => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };
  const activeGenByPlan = {}; // planId -> { ms, lastProcessed }
  plans.rows.forEach(r => {
    const pid = pGet(r, 'PlanId'); if (!pid) return;
    const isActive = String(pGet(r, 'Status')).toLowerCase() === 'active';
    const ms = planTs(pGet(r, 'CreatedAt'));
    const lastProcessed = String(pGet(r, 'LastProcessedCalendarDay') || '').trim();
    const cur = activeGenByPlan[pid];
    // Prefer active rows; among same activeness, the newest by CreatedAt wins.
    if (!cur || (isActive && !cur.active) || (isActive === cur.active && ms >= cur.ms)) {
      activeGenByPlan[pid] = { ms, active: isActive, lastProcessed };
    }
  });

  // Active tasks per rollover-processed plan, scoped to the CURRENT generation only.
  const activeByPlan = {};
  tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'active' && planIdsWithRollover.has(tGet(r, 'PlanId'))).forEach(r => {
    const pid = tGet(r, 'PlanId'); const gen = activeGenByPlan[pid];
    if (!gen) return; // no plan row resolvable -> do not alert (avoid false positive)
    if (planTs(tGet(r, 'CreatedAt')) >= gen.ms) activeByPlan[pid] = (activeByPlan[pid] || 0) + 1;
  });
  const activeTaskCountOverLimit = Object.values(activeByPlan).filter(c => c > MAX_ACTIVE_TASKS).length;

  // Canonical pending backlog per plan (Status=pending WITH v2 evidence). Backlog is a
  // general health signal (WARNING only), so it spans all plans, not just rollover ones.
  const pendingByPlan = {};
  tasks.rows.filter(r => String(tGet(r, 'Status')).toLowerCase() === 'pending' && (String(tGet(r, 'PendingReason') || '').trim() !== '' || String(tGet(r, 'MovedToPendingAt') || '').trim() !== '')).forEach(r => { const p = tGet(r, 'PlanId'); if (p) pendingByPlan[p] = (pendingByPlan[p] || 0) + 1; });
  const maxPendingBacklogByPlan = Object.values(pendingByPlan).reduce((m, c) => Math.max(m, c), 0);

  // Plans that produced rollover events but whose ACTIVE-generation row has a blank
  // LastProcessedCalendarDay (Bug A symptom — a marker on a stale row no longer counts).
  const rolloverPlansMissingLastProcessedCalendarDay = [...planIdsWithRollover]
    .filter(pid => { const gen = activeGenByPlan[pid]; return !gen || !gen.lastProcessed; }).length;

  return {
    rolloverMutationRequestCount,
    duplicateRolloverIdempotencyKeys,
    failedRolloverMutationRequests,
    rolloverTaskEventCount,
    tasksMovedToPendingByRollover,
    quickChecksIncorrectlyPendingByRollover,
    activeTaskCountOverLimit,
    maxPendingBacklogByPlan,
    pendingBacklogByPlan: pendingByPlan,
    rolloverPlansMissingLastProcessedCalendarDay,
    mentorPlansCount: plans.rows.length,
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
function evaluateMonitorAlerts(audit = {}, { flags = {} } = {}) {
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
  // Affected real plan: after allow-all launch, real users legitimately GROW their
  // plans (new generations, active tasks), so growth is INFORMATIONAL — not an alert.
  // The exact-frozen-count drift CRITICAL (a rollout canary) is retired. We keep a
  // data-loss floor: the original legacy records should never DISAPPEAR. Counts are
  // monotonic for the original tasks, so a drop below the historical floor
  // ({completed:5, snoozed:10}) signals possible corruption/data loss. (Skipped when
  // the affected plan isn't present in the audit, e.g. fixture audits.)
  const realPlan = audit.affectedRealPlanStatus || {};
  if (Object.keys(realPlan).length) {
    if (num(realPlan.completed) < EXPECTED_AFFECTED_REAL_PLAN.completed) {
      add('CRITICAL', 'AFFECTED_REAL_PLAN_DATA_LOSS', `Affected real plan completed dropped below the historical floor (${num(realPlan.completed)} < ${EXPECTED_AFFECTED_REAL_PLAN.completed}) — possible data loss`);
    }
    if (num(realPlan.snoozed) < EXPECTED_AFFECTED_REAL_PLAN.snoozed) {
      add('WARNING', 'AFFECTED_REAL_PLAN_SNOOZED_DROP', `Affected real plan snoozed below the historical baseline (${num(realPlan.snoozed)} < ${EXPECTED_AFFECTED_REAL_PLAN.snoozed}) — likely a legitimate resume/complete; verify`);
    }
  }
  // ── Phase 10E: rollover flag guardrails (replaces the old flag-only CRITICAL) ──
  // The mere presence of MENTOR_DAILY_ROLLOVER_V2=true is no longer auto-CRITICAL now
  // that a gated write path exists. It is judged by rollout stage:
  //   • allow-all on            -> CRITICAL  (rollover must not be all-users yet)
  //   • flag on + pilot cohort  -> WARNING   (expected narrow Phase 10D pilot)
  //   • flag on + no cohort     -> CRITICAL  (enabled but nobody eligible / misconfig)
  const rolloverOn = flags.MENTOR_DAILY_ROLLOVER_V2 === true;
  const rolloverAllowAll = flags.MENTOR_DAILY_ROLLOVER_ALLOW_ALL === true;
  const rolloverAllowlistCount = num(flags.rolloverAllowlistCount);
  if (rolloverAllowAll) {
    add('CRITICAL', 'DAILY_ROLLOVER_ALLOW_ALL_ENABLED', 'MENTOR_DAILY_ROLLOVER_ALLOW_ALL is enabled — daily rollover must not run for all users before a controlled pilot');
  } else if (rolloverOn && rolloverAllowlistCount > 0) {
    add('WARNING', 'DAILY_ROLLOVER_PILOT_ENABLED', `MENTOR_DAILY_ROLLOVER_V2 enabled for a narrow allowlist (${rolloverAllowlistCount} user[s]) — Phase 10D pilot`);
  } else if (rolloverOn) {
    add('CRITICAL', 'DAILY_ROLLOVER_FLAG_NO_COHORT', 'MENTOR_DAILY_ROLLOVER_V2 enabled but no rollover allowlist and no allow-all — flag on with no eligible cohort');
  }
  if (flags.MENTOR_PENDING_LIFECYCLE_V2 === true) {
    add('CRITICAL', 'PENDING_LIFECYCLE_WRITE_ENABLED', 'MENTOR_PENDING_LIFECYCLE_V2 is enabled — pending-lifecycle writes must stay OFF until a controlled phase');
  }

  // ── Phase 10E: real rollover anomaly alerts (data-driven; no flag required) ──
  if (num(audit.duplicateRolloverIdempotencyKeys) > 0) {
    add('CRITICAL', 'DUPLICATE_ROLLOVER_IDEMPOTENCY_KEYS', `${audit.duplicateRolloverIdempotencyKeys} duplicate rollover idempotency key(s) — possible double rollover`);
  }
  if (num(audit.failedRolloverMutationRequests) >= 1) {
    add('CRITICAL', 'FAILED_ROLLOVER_MUTATIONS', `${audit.failedRolloverMutationRequests} failed rollover mutation request(s)`);
  }
  if (num(audit.quickChecksIncorrectlyPendingByRollover) > 0) {
    add('CRITICAL', 'QUICK_CHECK_PENDING_ANOMALY', `${audit.quickChecksIncorrectlyPendingByRollover} quick-check task(s) moved to pending by rollover — quick checks must never become pending`);
  }
  if (num(audit.activeTaskCountOverLimit) > 0) {
    add('CRITICAL', 'ACTIVE_TASK_LIMIT_EXCEEDED', `${audit.activeTaskCountOverLimit} plan(s) have more than ${MAX_ACTIVE_TASKS} active tasks`);
  }
  if (num(audit.maxPendingBacklogByPlan) > PENDING_BACKLOG_WARN) {
    add('WARNING', 'PENDING_BACKLOG_HIGH', `A plan's canonical pending backlog is unusually high (${audit.maxPendingBacklogByPlan} > ${PENDING_BACKLOG_WARN})`);
  }
  if (num(audit.tasksMovedToPendingByRollover) > ROLLOVER_PENDING_VOLUME_WARN) {
    add('WARNING', 'ROLLOVER_PENDING_VOLUME_HIGH', `Rollover moved an unusually high number of tasks to pending (${audit.tasksMovedToPendingByRollover} > ${ROLLOVER_PENDING_VOLUME_WARN})`);
  }
  if (num(audit.rolloverTaskEventCount) > 0 && num(audit.rolloverPlansMissingLastProcessedCalendarDay) > 0) {
    add('WARNING', 'ROLLOVER_LAST_PROCESSED_MISSING', `${audit.rolloverPlansMissingLastProcessedCalendarDay} plan(s) have rollover events but a blank LastProcessedCalendarDay`);
  }
  const status = alerts.some(a => a.level === 'CRITICAL') ? 'CRITICAL' : alerts.some(a => a.level === 'WARNING') ? 'WARNING' : 'OK';
  return { status, alerts };
}

// Phase 9M2: Vercel-cron route auth. Fail-closed — requires CRON_SECRET to be set
// AND the request to carry `Authorization: Bearer <CRON_SECRET>`. Never logs the secret.
function isValidCronRequest(authHeader, secret) {
  return Boolean(secret) && typeof authHeader === 'string' && authHeader === `Bearer ${secret}`;
}

// Phase 9M2: build the cron monitor HTTP result from an audit + the flag state.
// Pure (no I/O). CRITICAL -> HTTP 500 (so cron run is marked failed); WARNING/OK -> 200.
function cronMonitorResult(audit, flagState = {}) {
  const { status, alerts } = evaluateMonitorAlerts(audit, { flags: flagState });
  const body = {
    alertStatus: status,
    alerts,
    mutationAllowAll: flagState.MENTOR_V2_MUTATION_ALLOW_ALL === true,
    duplicateIdempotencyKeys: audit.duplicateIdempotencyKeys,
    failedMutationRequests: audit.failedMutationRequests,
    unexpectedMutationsOutsideAllowlist: audit.unexpectedMutationsOutsideAllowlist,
    affectedRealPlanStatus: audit.affectedRealPlanStatus,
    affectedRealPlanId: audit.affectedRealPlanId,
    rollover: {
      dailyRolloverFlagEnabled: flagState.MENTOR_DAILY_ROLLOVER_V2 === true,
      rolloverAllowAllEnabled: flagState.MENTOR_DAILY_ROLLOVER_ALLOW_ALL === true,
      rolloverAllowlistedUsersCount: Number(flagState.rolloverAllowlistCount || 0),
      rolloverMutationRequestCount: audit.rolloverMutationRequestCount,
      duplicateRolloverIdempotencyKeys: audit.duplicateRolloverIdempotencyKeys,
      failedRolloverMutationRequests: audit.failedRolloverMutationRequests,
      tasksMovedToPendingByRollover: audit.tasksMovedToPendingByRollover,
      quickChecksIncorrectlyPendingByRollover: audit.quickChecksIncorrectlyPendingByRollover,
      activeTaskCountOverLimit: audit.activeTaskCountOverLimit,
      maxPendingBacklogByPlan: audit.maxPendingBacklogByPlan,
      rolloverPlansMissingLastProcessedCalendarDay: audit.rolloverPlansMissingLastProcessedCalendarDay,
    },
    flags: {
      MENTOR_DAILY_ROLLOVER_V2: flagState.MENTOR_DAILY_ROLLOVER_V2 === true,
      MENTOR_DAILY_ROLLOVER_ALLOW_ALL: flagState.MENTOR_DAILY_ROLLOVER_ALLOW_ALL === true,
      MENTOR_PENDING_LIFECYCLE_V2: flagState.MENTOR_PENDING_LIFECYCLE_V2 === true,
    },
    checkedAt: new Date().toISOString(),
  };
  return { httpStatus: status === 'CRITICAL' ? 500 : 200, body };
}

module.exports = { auditV2Mutations, evaluateMonitorAlerts, cronMonitorResult, isValidCronRequest, scopeFromIdempotencyKey, DEFAULT_AFFECTED_PLAN_ID, EXPECTED_AFFECTED_REAL_PLAN };
