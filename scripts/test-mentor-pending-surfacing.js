#!/usr/bin/env node
/**
 * scripts/test-mentor-pending-surfacing.js — Phase 9C pending surfacing tests.
 * Fake/in-memory only; no live Sheet, no mutation, no flags required.
 * Run: node scripts/test-mentor-pending-surfacing.js
 */
'use strict';

const assert = require('assert');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');
const { applyRepoV2Compatibility } = require('../lib/mentor/read/serveCompatibleSnapshot');
const { isCanonicalPendingTask } = require('../lib/mentor/services/dailyRolloverService');
const { auditV2Mutations } = require('../lib/mentor/read/v2MutationMonitor');
const { buildLegacyRawData, EMAIL } = require('./fixtures/mentor-legacy-fixture');

// Fresh single-generation plan with one task in the given state.
function freshRaw({ taskId = 'FT1', status = 'pending', pendingReason = 'user_postponed', movedToPendingAt = '2026-06-11T00:00:00Z', type = 'practice_task' } = {}) {
  return {
    profile: { headers: ['Email', 'MentorPlanId', 'OnboardingCompletedAt'], rows: [['u@t', 'MP_F', '2026-06-08T00:00:00Z']] },
    plans: { headers: ['Email', 'PlanId', 'Status', 'Version', 'CreatedAt', 'PlanVersion', 'RowVersion'], rows: [['u@t', 'MP_F', 'active', 'v1', '2026-06-08T00:00:00Z', '1', '1']] },
    tasks: { headers: ['Email', 'PlanId', 'TaskId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'CreatedAt', 'PendingReason', 'MovedToPendingAt', 'RowVersion'], rows: [['u@t', 'MP_F', taskId, status, type, '1', '1', '2026-06-08T00:00:00Z', pendingReason, movedToPendingAt, '2']] },
    topicState: { headers: ['Email', 'Subject', 'Topic'], rows: [] },
  };
}
function legacyFromSnapshot(snap) {
  const tasks = (snap.currentTasks || []).map(t => ({ taskId: t.taskId, status: t.status, subject: t.subject, topic: t.topic, title: t.title }));
  return { exists: true, profile: { subjectStatus: {} }, plan: { planId: snap.activePlan ? snap.activePlan.planId : 'MP_F', dayNumber: 1, tasks }, activeTasks: [], completedToday: [], deferredTasks: [], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't' };
}

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

test('1. V2 pending with PendingReason appears in canonicalPendingTasks', () => {
  const snap = buildSnapshotFromRawData(freshRaw({ pendingReason: 'user_postponed', movedToPendingAt: '' }), { email: 'u@t' });
  assert.strictEqual(snap.canonicalPendingTasks.length, 1);
});
test('2. V2 pending with MovedToPendingAt appears in canonicalPendingTasks', () => {
  const snap = buildSnapshotFromRawData(freshRaw({ pendingReason: '', movedToPendingAt: '2026-06-11T00:00:00Z' }), { email: 'u@t' });
  assert.strictEqual(snap.canonicalPendingTasks.length, 1);
});
test('3. legacy snoozed (no v2 evidence) does NOT appear', () => {
  const snap = buildSnapshotFromRawData(freshRaw({ status: 'snoozed', pendingReason: '', movedToPendingAt: '' }), { email: 'u@t' });
  assert.strictEqual(snap.canonicalPendingTasks.length, 0);
});
test('4. affected real plan (legacy fixture) canonicalPendingTasks = 0', () => {
  const snap = buildSnapshotFromRawData(buildLegacyRawData(), { email: EMAIL });
  assert.strictEqual(snap.canonicalPendingTasks.length, 0);
  assert.strictEqual(snap.hiddenLegacyTasks.length, 10);
});
test('5. Phase 9B2-style fresh postponed task -> canonicalPendingTasks = 1', () => {
  const snap = buildSnapshotFromRawData(freshRaw(), { email: 'u@t' });
  assert.strictEqual(snap.canonicalPendingTasks.length, 1);
  assert.strictEqual(snap.canonicalPendingTasks[0].taskId, 'FT1');
});
test('6. shared overlay exposes pendingTasks = 1 for V2-postponed task', () => {
  const snap = buildSnapshotFromRawData(freshRaw(), { email: 'u@t' });
  const served = applyRepoV2Compatibility(legacyFromSnapshot(snap), snap);
  assert.strictEqual(served.pendingTasks.length, 1);
  assert.strictEqual(served.pendingTasks[0].taskId, 'FT1');
});
test('7. overlay does NOT duplicate the pending task into deferredTasks', () => {
  // a snoozed (legacy) task + a pending (v2) task in current gen
  const raw = {
    profile: { headers: ['Email', 'MentorPlanId'], rows: [['u@t', 'MP_F']] },
    plans: { headers: ['Email', 'PlanId', 'Status', 'Version', 'CreatedAt'], rows: [['u@t', 'MP_F', 'active', 'v1', '2026-06-08T00:00:00Z']] },
    tasks: { headers: ['Email', 'PlanId', 'TaskId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'CreatedAt', 'PendingReason', 'MovedToPendingAt'],
      rows: [
        ['u@t', 'MP_F', 'PEND', 'pending', 'practice_task', '1', '1', '2026-06-08T00:00:00Z', 'user_postponed', '2026-06-11T00:00:00Z'],
        ['u@t', 'MP_F', 'SNOOZ', 'snoozed', 'practice_task', '2', '1', '2026-06-08T00:00:00Z', '', ''],
      ] },
    topicState: { headers: ['Email', 'Subject', 'Topic'], rows: [] },
  };
  const snap = buildSnapshotFromRawData(raw, { email: 'u@t' });
  const legacy = { exists: true, profile: {}, plan: { planId: 'MP_F', dayNumber: 1, tasks: [{ taskId: 'PEND', status: 'pending' }, { taskId: 'SNOOZ', status: 'snoozed' }] }, activeTasks: [], completedToday: [], deferredTasks: [], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't' };
  const served = applyRepoV2Compatibility(legacy, snap);
  assert.deepStrictEqual(served.pendingTasks.map(t => t.taskId), ['PEND']);
  assert.ok(!served.deferredTasks.some(t => t.taskId === 'PEND'), 'pending task must not be in deferred');
});
test('8. historical pending task is hidden (predicate)', () => {
  assert.strictEqual(isCanonicalPendingTask({ status: 'pending', isCurrentGeneration: false, pendingReason: 'user_postponed' }), false);
  assert.strictEqual(isCanonicalPendingTask({ status: 'pending', isLegacyHidden: true, pendingReason: 'user_postponed' }), false);
});
test('9. quick-check pending is excluded (predicate)', () => {
  assert.strictEqual(isCanonicalPendingTask({ status: 'pending', type: 'coverage_check', pendingReason: 'user_postponed' }), false);
  assert.strictEqual(isCanonicalPendingTask({ status: 'pending', type: 'feedback_task', movedToPendingAt: 'x' }), false);
});
test('10. monitor reports canonical pending counts (read-only)', async () => {
  const tabs = {
    MentorMutationRequests: [['IdempotencyKey', 'Action', 'Status']],
    MentorTaskLogs: [['CanonicalAction', 'TaskId']],
    MentorTasks: [['TaskId', 'PlanId', 'Status', 'PendingReason', 'MovedToPendingAt', 'RowVersion'],
      ['FT1', 'MP_F', 'pending', 'user_postponed', 'x', '2'],
      ['SN', 'MP_R', 'snoozed', '', '', '1']] };
  const sheets = { spreadsheets: { values: {
    async get({ range }) { const t = range.split('!')[0]; return { data: { values: (tabs[t] || []).map(r => [...r]) } }; },
    async update() { throw new Error('WRITE'); }, async append() { throw new Error('WRITE'); },
  } } };
  const audit = await auditV2Mutations(sheets, { affectedPlanId: 'MP_R' });
  assert.strictEqual(audit.canonicalPendingTaskRows, 1);
  assert.strictEqual(audit.legacySnoozedHiddenCount, 1);
});
test('11. read model needs no mutation flags (pure)', () => {
  const prev = {}; ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2'].forEach(f => { prev[f] = process.env[f]; delete process.env[f]; });
  try {
    const snap = buildSnapshotFromRawData(freshRaw(), { email: 'u@t' });
    assert.strictEqual(snap.canonicalPendingTasks.length, 1);
  } finally { Object.entries(prev).forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; }); }
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor pending-surfacing tests passed.`);
  process.exit(failed ? 1 : 0);
})();
