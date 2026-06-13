#!/usr/bin/env node
/**
 * scripts/test-mentor-monitor-alerts.js — Phase 9I monitor + alert tests (NO live Sheet).
 * Verifies the read-only audit and the pure alert evaluator. Fake/in-memory only.
 * Run: node scripts/test-mentor-monitor-alerts.js
 */
'use strict';

const assert = require('assert');
const { auditV2Mutations, evaluateMonitorAlerts, EXPECTED_AFFECTED_REAL_PLAN } = require('../lib/mentor/read/v2MutationMonitor');

const MR_H = ['IdempotencyKey', 'UserScopeHash', 'PlanId', 'TaskId', 'Action', 'Status'];
const LOG_H = ['CanonicalAction', 'TaskId', 'SourcePage', 'ToStatus', 'IdempotencyKey', 'PlanId'];
// `Type` then `CreatedAt` appended LAST so existing shorter task fixtures stay valid (missing => '').
const TASK_H = ['TaskId', 'PlanId', 'Status', 'PendingReason', 'MovedToPendingAt', 'RowVersion', 'CompletionSource', 'Type', 'CreatedAt'];
// Status + CreatedAt appended so existing 2-col plan fixtures (PlanId, LastProcessedCalendarDay) stay valid.
const PLAN_H = ['PlanId', 'LastProcessedCalendarDay', 'Status', 'CreatedAt'];
// PLAN_H-ordered plan-row fixture: [PlanId, LastProcessedCalendarDay, Status, CreatedAt].
const planGen = (planId, { status = 'active', createdAt = '2026-01-01T00:00:00Z', lastProcessed = '' } = {}) => [planId, lastProcessed, status, createdAt];
// TASK_H-ordered active-task fixture with an explicit CreatedAt (for generation scoping).
const activeTask = (taskId, planId, createdAt) => [taskId, planId, 'active', '', '', '1', '', 'practice_task', createdAt];
const REAL = 'MP_1780920810055';
const key = (scope, action, op) => `mentor-task:${scope}:P:T:${action}:${op}`;
const rKey = (scope, plan, day) => `mentor-rollover:${scope}:${plan}:${day}`;

// Read-only fake sheets — writes THROW so any accidental write fails the test.
function fakeSheets(tabs) {
  return { spreadsheets: { values: {
    async get({ range }) { const t = range.split('!')[0]; return { data: { values: (tabs[t] || []).map(r => [...r]) } }; },
    async update() { throw new Error('WRITE attempted (update)'); },
    async append() { throw new Error('WRITE attempted (append)'); },
  } } };
}
function tabs({ mr = [], logs = [], tasks = [], plans = [] } = {}) {
  return { MentorMutationRequests: [MR_H, ...mr], MentorTaskLogs: [LOG_H, ...logs], MentorTasks: [TASK_H, ...tasks], MentorPlans: [PLAN_H, ...plans] };
}

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('1. monitor is read-only (audit runs even when update/append throw)', async () => {
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [[key('u_a', 'POSTPONE', '1'), 'u_a', 'P', 'T', 'POSTPONE', 'completed']] })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(audit.totalMutationRequests, 1);
});
test('2. unexpectedMutationsOutsideAllowlist > 0 -> CRITICAL alert', async () => {
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [
    [key('u_a', 'POSTPONE', '1'), 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
    [key('u_evil', 'POSTPONE', '2'), 'u_evil', 'P', 'T', 'POSTPONE', 'completed'],
  ] })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(audit.unexpectedMutationsOutsideAllowlist, 1);
  const { status, alerts } = evaluateMonitorAlerts(audit, { expectedAffectedRealPlan: null });
  assert.strictEqual(status, 'CRITICAL');
  assert.ok(alerts.some(a => a.code === 'UNEXPECTED_OUTSIDE_ALLOWLIST'));
});
test('3. duplicate idempotency keys -> CRITICAL alert', async () => {
  const dup = key('u_a', 'POSTPONE', 'same');
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [
    [dup, 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
    [dup, 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
  ] })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(audit.duplicateIdempotencyKeys, 1);
  const { status, alerts } = evaluateMonitorAlerts(audit, { expectedAffectedRealPlan: null });
  assert.strictEqual(status, 'CRITICAL');
  assert.ok(alerts.some(a => a.code === 'DUPLICATE_IDEMPOTENCY_KEYS'));
});
test('4. failed mutation requests -> WARNING (1-2) / CRITICAL (>=3)', async () => {
  const audit1 = await auditV2Mutations(fakeSheets(tabs({ mr: [[key('u_a', 'POSTPONE', '1'), 'u_a', 'P', 'T', 'POSTPONE', 'failed']] })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(audit1.failedMutationRequests, 1);
  const r1 = evaluateMonitorAlerts(audit1, { expectedAffectedRealPlan: null });
  assert.strictEqual(r1.status, 'WARNING');
  const r3 = evaluateMonitorAlerts({ failedMutationRequests: 3 }, { expectedAffectedRealPlan: null });
  assert.strictEqual(r3.status, 'CRITICAL');
  assert.ok(r3.alerts.some(a => a.code === 'FAILED_MUTATIONS'));
});
test('5. allowlist parsing with multiple users', async () => {
  const mr = [
    [key('u_a', 'POSTPONE', '1'), 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
    [key('u_b', 'RESUME', '2'), 'u_b', 'P', 'T', 'RESUME', 'completed'],
  ];
  const both = await auditV2Mutations(fakeSheets(tabs({ mr })), { allowedUserHashes: ['u_a', 'u_b'] });
  assert.strictEqual(both.unexpectedMutationsOutsideAllowlist, 0);
  const onlyA = await auditV2Mutations(fakeSheets(tabs({ mr })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(onlyA.unexpectedMutationsOutsideAllowlist, 1);
});
test('6. rollover/pending lifecycle write flags reported as CRITICAL when true', () => {
  const base = { affectedRealPlanStatus: { completed: 5, snoozed: 10 } };
  assert.strictEqual(evaluateMonitorAlerts(base, { flags: { MENTOR_DAILY_ROLLOVER_V2: true } }).status, 'CRITICAL');
  assert.strictEqual(evaluateMonitorAlerts(base, { flags: { MENTOR_PENDING_LIFECYCLE_V2: true } }).status, 'CRITICAL');
  assert.strictEqual(evaluateMonitorAlerts(base, { flags: { MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false } }).status, 'OK');
});
test('7. affected real plan change is INFORMATIONAL only, NOT CRITICAL (real users change their own plans under allow-all)', async () => {
  // real user added 3 active tasks (plan generation) — must not trip a CRITICAL.
  const taskRows = [];
  for (let i = 0; i < 5; i++) taskRows.push([`RT${i}`, REAL, 'completed', '', '', '1', '']);
  for (let i = 0; i < 10; i++) taskRows.push([`RS${i}`, REAL, 'snoozed', '', '', '1', '']);
  for (let i = 0; i < 3; i++) taskRows.push([`RA${i}`, REAL, 'active', '', '', '1', '']);
  const audit = await auditV2Mutations(fakeSheets(tabs({ tasks: taskRows })), { allowedUserHashes: [] });
  assert.deepStrictEqual(audit.affectedRealPlanStatus, { completed: 5, snoozed: 10, active: 3 }); // still reported (visibility)
  const { status, alerts } = evaluateMonitorAlerts(audit);
  assert.strictEqual(status, 'OK');
  assert.ok(!alerts.some(a => a.code === 'AFFECTED_REAL_PLAN_DRIFT'), 'no exact-drift CRITICAL');
  assert.ok(!alerts.some(a => /AFFECTED_REAL_PLAN/.test(a.code)), 'pure growth raises no real-plan alert');
});
test('7b. data-loss floor: completed below 5 -> CRITICAL; snoozed below 10 -> WARNING; growth stays OK', () => {
  const loss = evaluateMonitorAlerts({ affectedRealPlanStatus: { completed: 4, snoozed: 10 } });
  assert.strictEqual(loss.status, 'CRITICAL');
  assert.ok(loss.alerts.some(a => a.code === 'AFFECTED_REAL_PLAN_DATA_LOSS'));
  const snoozeDrop = evaluateMonitorAlerts({ affectedRealPlanStatus: { completed: 5, snoozed: 8, active: 2 } });
  assert.strictEqual(snoozeDrop.status, 'WARNING');
  assert.ok(snoozeDrop.alerts.some(a => a.code === 'AFFECTED_REAL_PLAN_SNOOZED_DROP'));
  assert.strictEqual(evaluateMonitorAlerts({ affectedRealPlanStatus: { completed: 6, snoozed: 12, active: 4 } }).status, 'OK');
});
test('8. clean steady-state -> OK (no alerts)', () => {
  const r = evaluateMonitorAlerts({ unexpectedMutationsOutsideAllowlist: 0, duplicateIdempotencyKeys: 0, failedMutationRequests: 0, affectedRealPlanStatus: { ...EXPECTED_AFFECTED_REAL_PLAN }, affectedRealPlanId: REAL }, { flags: { MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false } });
  assert.strictEqual(r.status, 'OK');
  assert.strictEqual(r.alerts.length, 0);
});

// ── Phase 10E: daily-rollover monitor guardrails ──────────────────────────────
const cleanBase = { affectedRealPlanStatus: { completed: 5, snoozed: 10 } };

test('R1. rollover flag OFF => no rollover alert (OK)', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_DAILY_ROLLOVER_V2: false } });
  assert.strictEqual(r.status, 'OK');
  assert.ok(!r.alerts.some(a => /ROLLOVER/.test(a.code)));
});
test('R2. rollover flag ON + allowlisted cohort => WARNING only (not CRITICAL)', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_DAILY_ROLLOVER_V2: true, rolloverAllowlistCount: 1 } });
  assert.strictEqual(r.status, 'WARNING');
  assert.ok(r.alerts.some(a => a.code === 'DAILY_ROLLOVER_PILOT_ENABLED'));
  assert.ok(!r.alerts.some(a => a.level === 'CRITICAL'));
});
test('R3. rollover flag ON + no cohort => CRITICAL (flag on, nobody eligible)', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_DAILY_ROLLOVER_V2: true, rolloverAllowlistCount: 0 } });
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'DAILY_ROLLOVER_FLAG_NO_COHORT'));
});
test('R4. rollover allow-all TRUE => CRITICAL', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_DAILY_ROLLOVER_V2: true, MENTOR_DAILY_ROLLOVER_ALLOW_ALL: true, rolloverAllowlistCount: 5 } });
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'DAILY_ROLLOVER_ALLOW_ALL_ENABLED'));
});
test('R5. duplicate rollover idempotency key => CRITICAL (audit-derived)', async () => {
  const dup = rKey('u_a', 'P1', '3');
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [
    [dup, 'u_a', 'P1', '', 'ROLLOVER', 'completed'],
    [dup, 'u_a', 'P1', '', 'ROLLOVER', 'completed'],
  ] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.duplicateRolloverIdempotencyKeys, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'DUPLICATE_ROLLOVER_IDEMPOTENCY_KEYS'));
});
test('R6. failed rollover mutation request => CRITICAL', async () => {
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [[rKey('u_a', 'P1', '3'), 'u_a', 'P1', '', 'ROLLOVER', 'failed']] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.failedRolloverMutationRequests, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'FAILED_ROLLOVER_MUTATIONS'));
});
const rolloverLog = (plan) => ['POSTPONE', `${plan}-t`, 'daily_rollover', 'pending', rKey('u_a', plan, '2'), plan];
test('R7. quick-check pending by rollover evidence (on a rollover-processed plan) => CRITICAL', async () => {
  // coverage_check moved to pending with day_ended_incomplete — must never happen.
  const audit = await auditV2Mutations(fakeSheets(tabs({
    tasks: [['QC1', 'P1', 'pending', 'day_ended_incomplete', '2026-06-12T06:00:00Z', '2', '', 'coverage_check']],
    logs: [rolloverLog('P1')],
  })), { allowedUserHashes: [] });
  assert.strictEqual(audit.quickChecksIncorrectlyPendingByRollover, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'QUICK_CHECK_PENDING_ANOMALY'));
});
test('R7b. quick-check pending on a NON-rollover plan => no anomaly (scoped, avoids false positive)', async () => {
  const audit = await auditV2Mutations(fakeSheets(tabs({
    tasks: [['QC1', 'P9', 'pending', 'day_ended_incomplete', '2026-06-12T06:00:00Z', '2', '', 'coverage_check']],
  })), { allowedUserHashes: [] });
  assert.strictEqual(audit.quickChecksIncorrectlyPendingByRollover, 0);
});
test('R8. active task count > 3 on a rollover-processed plan (current generation) => CRITICAL', async () => {
  const taskRows = [];
  for (let i = 0; i < 4; i++) taskRows.push(activeTask(`AT${i}`, 'P1', '2026-06-02T00:00:00Z'));
  const audit = await auditV2Mutations(fakeSheets(tabs({
    tasks: taskRows, plans: [planGen('P1', { status: 'active', createdAt: '2026-06-01T00:00:00Z' })], logs: [rolloverLog('P1')],
  })), { allowedUserHashes: [] });
  assert.strictEqual(audit.activeTaskCountOverLimit, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'ACTIVE_TASK_LIMIT_EXCEEDED'));
});
test('R8b. >3 active on a NON-rollover plan (normal generator output) => OK (Phase 9M3-style false-positive guard)', async () => {
  const taskRows = [];
  for (let i = 0; i < 5; i++) taskRows.push(activeTask(`AT${i}`, 'P9', '2026-06-02T00:00:00Z'));
  const audit = await auditV2Mutations(fakeSheets(tabs({ tasks: taskRows, plans: [planGen('P9')] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.activeTaskCountOverLimit, 0);
  assert.strictEqual(evaluateMonitorAlerts(audit).status, 'OK');
});
test('C1. Phase 10D-FIX: multi-generation same-PlanId — OLD gens have >3 active, CURRENT gen <=3 => activeTaskCountOverLimit=0, OK', async () => {
  // Exact Phase 10D pilot shape: 11 invalid old gens + 1 active; old-gen active tasks must NOT count.
  const plans = [
    planGen('MP_T9B2', { status: 'invalid', createdAt: '2026-06-11T00:00:00Z' }),
    planGen('MP_T9B2', { status: 'active', createdAt: '2026-06-12T03:09:44Z', lastProcessed: '3' }),
  ];
  const tasks = [];
  for (let i = 0; i < 6; i++) tasks.push(activeTask(`OLD${i}`, 'MP_T9B2', '2026-06-11T05:00:00Z')); // old gen (before active)
  for (let i = 0; i < 2; i++) tasks.push(activeTask(`CUR${i}`, 'MP_T9B2', '2026-06-12T04:00:00Z')); // current gen
  const audit = await auditV2Mutations(fakeSheets(tabs({ plans, tasks, logs: [rolloverLog('MP_T9B2')] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.activeTaskCountOverLimit, 0, 'stale generations must not inflate the active count');
  assert.strictEqual(audit.rolloverPlansMissingLastProcessedCalendarDay, 0, 'active-row marker present');
  assert.ok(!evaluateMonitorAlerts(audit).alerts.some(a => a.code === 'ACTIVE_TASK_LIMIT_EXCEEDED'));
});
test('C2. Phase 10D-FIX: CURRENT generation genuinely has >3 active => activeTaskCountOverLimit>0, CRITICAL', async () => {
  const plans = [planGen('MP_T9B2', { status: 'active', createdAt: '2026-06-12T03:00:00Z', lastProcessed: '3' })];
  const tasks = [];
  for (let i = 0; i < 4; i++) tasks.push(activeTask(`CUR${i}`, 'MP_T9B2', '2026-06-12T04:00:00Z'));
  const audit = await auditV2Mutations(fakeSheets(tabs({ plans, tasks, logs: [rolloverLog('MP_T9B2')] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.activeTaskCountOverLimit, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'ACTIVE_TASK_LIMIT_EXCEEDED'));
});
test('C3. Phase 10D-FIX: marker on a STALE invalid row but blank on the ACTIVE row => still WARNING (missing)', async () => {
  const plans = [
    planGen('MP_T9B2', { status: 'invalid', createdAt: '2026-06-11T00:00:00Z', lastProcessed: '3' }), // stale marker
    planGen('MP_T9B2', { status: 'active', createdAt: '2026-06-12T03:00:00Z', lastProcessed: '' }),    // active blank
  ];
  const audit = await auditV2Mutations(fakeSheets(tabs({ plans, logs: [rolloverLog('MP_T9B2')] })), { allowedUserHashes: [] });
  assert.strictEqual(audit.rolloverPlansMissingLastProcessedCalendarDay, 1, 'only the ACTIVE row counts for the marker');
  assert.ok(evaluateMonitorAlerts(audit).alerts.some(a => a.code === 'ROLLOVER_LAST_PROCESSED_MISSING'));
});
test('R9. successful rollover events but blank LastProcessedCalendarDay => WARNING', async () => {
  const audit = await auditV2Mutations(fakeSheets(tabs({
    logs: [['POSTPONE', 'T1', 'daily_rollover', 'pending', rKey('u_a', 'P1', '2'), 'P1']],
    plans: [['P1', '']], // blank LastProcessedCalendarDay
    mr: [[rKey('u_a', 'P1', '2'), 'u_a', 'P1', '', 'ROLLOVER', 'completed']],
  })), { allowedUserHashes: [] });
  assert.strictEqual(audit.rolloverTaskEventCount, 1);
  assert.strictEqual(audit.rolloverPlansMissingLastProcessedCalendarDay, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'WARNING');
  assert.ok(r.alerts.some(a => a.code === 'ROLLOVER_LAST_PROCESSED_MISSING'));
  // and when the column IS populated, no such warning
  const audit2 = await auditV2Mutations(fakeSheets(tabs({
    logs: [['POSTPONE', 'T1', 'daily_rollover', 'pending', rKey('u_a', 'P1', '2'), 'P1']],
    plans: [['P1', '2']],
  })), { allowedUserHashes: [] });
  assert.strictEqual(audit2.rolloverPlansMissingLastProcessedCalendarDay, 0);
});
test('R10. pending lifecycle flag TRUE => CRITICAL', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_PENDING_LIFECYCLE_V2: true } });
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'PENDING_LIFECYCLE_WRITE_ENABLED'));
});
test('R11. existing action-mutation allow-all remains WARNING (not CRITICAL)', () => {
  const r = evaluateMonitorAlerts(cleanBase, { flags: { MENTOR_V2_MUTATION_ALLOW_ALL: true } });
  assert.strictEqual(r.status, 'WARNING');
  assert.ok(r.alerts.some(a => a.code === 'ALLOW_ALL_ENABLED'));
  assert.ok(!r.alerts.some(a => a.level === 'CRITICAL'));
});
test('R12. existing general duplicate/failed mutation alerts still fire', async () => {
  const dup = key('u_a', 'POSTPONE', 'same');
  const audit = await auditV2Mutations(fakeSheets(tabs({ mr: [
    [dup, 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
    [dup, 'u_a', 'P', 'T', 'POSTPONE', 'completed'],
    [key('u_a', 'RESUME', '9'), 'u_a', 'P', 'T', 'RESUME', 'failed'],
  ] })), { allowedUserHashes: ['u_a'] });
  assert.strictEqual(audit.duplicateIdempotencyKeys, 1);
  assert.strictEqual(audit.failedMutationRequests, 1);
  const r = evaluateMonitorAlerts(audit);
  assert.strictEqual(r.status, 'CRITICAL'); // dup => CRITICAL
  assert.ok(r.alerts.some(a => a.code === 'DUPLICATE_IDEMPOTENCY_KEYS'));
  assert.ok(r.alerts.some(a => a.code === 'FAILED_MUTATIONS'));
  // rollover counters must NOT false-fire on pure action-mutation data
  assert.strictEqual(audit.rolloverMutationRequestCount, 0);
  assert.ok(!r.alerts.some(a => /ROLLOVER/.test(a.code)));
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor monitor-alert tests passed.`); process.exit(failed ? 1 : 0); })();
