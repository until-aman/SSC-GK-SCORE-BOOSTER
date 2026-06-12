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
const LOG_H = ['CanonicalAction', 'TaskId'];
const TASK_H = ['TaskId', 'PlanId', 'Status', 'PendingReason', 'MovedToPendingAt', 'RowVersion', 'CompletionSource'];
const REAL = 'MP_1780920810055';
const key = (scope, action, op) => `mentor-task:${scope}:P:T:${action}:${op}`;

// Read-only fake sheets — writes THROW so any accidental write fails the test.
function fakeSheets(tabs) {
  return { spreadsheets: { values: {
    async get({ range }) { const t = range.split('!')[0]; return { data: { values: (tabs[t] || []).map(r => [...r]) } }; },
    async update() { throw new Error('WRITE attempted (update)'); },
    async append() { throw new Error('WRITE attempted (append)'); },
  } } };
}
function tabs({ mr = [], logs = [], tasks = [] } = {}) {
  return { MentorMutationRequests: [MR_H, ...mr], MentorTaskLogs: [LOG_H, ...logs], MentorTasks: [TASK_H, ...tasks] };
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

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor monitor-alert tests passed.`); process.exit(failed ? 1 : 0); })();
