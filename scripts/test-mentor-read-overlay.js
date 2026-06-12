#!/usr/bin/env node
/**
 * scripts/test-mentor-read-overlay.js — Phase 9B-Prep tests (non-live).
 *
 * Covers: shared Repository V2 read overlay (serveCompatibleSnapshot) and the
 * V2 task-action routing gate/whitelist (taskActionRouting). Fake/in-memory data
 * only; no live Sheet, no mutation, no flag persistence (env flags set/restored).
 * Run: node scripts/test-mentor-read-overlay.js
 */
'use strict';

const assert = require('assert');
const { applyRepoV2Compatibility } = require('../lib/mentor/read/serveCompatibleSnapshot');
const routing = require('../lib/mentor/read/taskActionRouting');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

// ---- fixtures ----
function legacyTask(id, status) {
  return { taskId: id, planId: 'P', status, taskType: 'practice_task', subject: 'Polity', topic: 'T', title: 'X', mentorMessage: 'm', dayNumber: 1, sequenceNumber: 1 };
}
function legacySnapshot() {
  const tasks = [];
  for (let i = 1; i <= 12; i++) tasks.push(legacyTask(`t${i}`, i <= 5 ? 'completed' : 'snoozed')); // historical-ish
  tasks.push(legacyTask('t13', 'snoozed'), legacyTask('t14', 'snoozed'), legacyTask('t15', 'snoozed')); // current gen
  const completedToday = tasks.filter(t => t.status === 'completed');
  return {
    exists: true,
    profile: { email: 'x', subjectStatus: { Polity: 'Theory Done' }, topicStrength: {}, daysLeftRange: '46-60' }, // rich legacy profile
    plan: { planId: 'P', dayNumber: 1, daysTotal: 45, mentorDayMessage: 'msg', tasks },
    activeTasks: [], completedToday, deferredTasks: tasks.filter(t => t.status === 'snoozed'), pendingTasks: [],
    progress: { completed: completedToday.length, total: 15, percent: 33 },
    mentorMessage: 'msg', lastSyncAt: '2026-06-11T00:00:00Z',
  };
}
function repoSnapshot(overrides = {}) {
  return {
    activePlan: { planId: 'P' },
    currentTasks: [{ taskId: 't13' }, { taskId: 't14' }, { taskId: 't15' }],
    historicalTasks: Array.from({ length: 12 }, (_, i) => ({ taskId: `t${i + 1}` })),
    hiddenLegacyTasks: [],
    canonicalPendingTasks: [],
    calendarDay: 4, activePlanDay: 4, totalPlanDays: 46,
    repositoryVersion: 'mentor-repo-v2', activeGeneration: { ordinal: 5 },
    ...overrides,
  };
}
const V2_FLAGS = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2'];
function withFlags(values, fn) {
  const prev = {}; V2_FLAGS.forEach(f => { prev[f] = process.env[f]; });
  Object.entries(values).forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  try { return fn(); } finally { V2_FLAGS.forEach(f => { if (prev[f] === undefined) delete process.env[f]; else process.env[f] = prev[f]; }); }
}

// ---- overlay tests ----
test('1. overlay preserves all legacy response keys', () => {
  const served = applyRepoV2Compatibility(legacySnapshot(), repoSnapshot());
  Object.keys(legacySnapshot()).forEach(k => assert.ok(k in served, `missing key ${k}`));
});
test('2. overlay filters to current-generation tasks only (3)', () => {
  const served = applyRepoV2Compatibility(legacySnapshot(), repoSnapshot());
  assert.deepStrictEqual(served.plan.tasks.map(t => t.taskId), ['t13', 't14', 't15']);
});
test('3. overlay applies canonical Day 4 fields', () => {
  const served = applyRepoV2Compatibility(legacySnapshot(), repoSnapshot());
  assert.strictEqual(served.plan.dayNumber, 4);
  assert.strictEqual(served.plan.activeDayNumber, 4);
  assert.strictEqual(served.plan.canonicalCalendarDay, 4);
  assert.strictEqual(served.plan.canonicalActivePlanDay, 4);
  assert.strictEqual(served.plan.legacyActiveDayNumber, 1);
});
test('4. overlay hides historical tasks from today view', () => {
  const served = applyRepoV2Compatibility(legacySnapshot(), repoSnapshot());
  ['t1', 't6', 't12'].forEach(id => assert.ok(!served.plan.tasks.some(t => t.taskId === id)));
  assert.strictEqual(served.historicalTaskCount, 12);
});
test('5. overlay keeps pending count 0 for legacy snoozed', () => {
  const served = applyRepoV2Compatibility(legacySnapshot(), repoSnapshot());
  assert.strictEqual(served.pendingTasks.length, 0);
});
test('6. overlay no-ops for planless profile / no active plan', () => {
  const noPlan = { ...legacySnapshot(), plan: null };
  assert.strictEqual(applyRepoV2Compatibility(noPlan, repoSnapshot()), noPlan);
  const ls = legacySnapshot();
  assert.strictEqual(applyRepoV2Compatibility(ls, repoSnapshot({ activePlan: null })), ls);
});
test('7. overlay preserves the rich legacy profile (same reference)', () => {
  const ls = legacySnapshot();
  const served = applyRepoV2Compatibility(ls, repoSnapshot());
  assert.strictEqual(served.profile, ls.profile);
  assert.deepStrictEqual(served.profile.subjectStatus, { Polity: 'Theory Done' });
});
test('12. future V2 task-action response can reuse the same overlay shape', () => {
  // Same function over a task-action-built legacy snapshot yields the SAME key set
  // as the GET plan overlay (shape consistency for the unified response).
  const getPlanShape = Object.keys(applyRepoV2Compatibility(legacySnapshot(), repoSnapshot())).sort();
  const taskActionLegacy = { ...legacySnapshot(), lastSyncAt: '2026-06-11T09:00:00Z' };
  const taskActionShape = Object.keys(applyRepoV2Compatibility(taskActionLegacy, repoSnapshot())).sort();
  assert.deepStrictEqual(taskActionShape, getPlanShape);
  assert.ok(getPlanShape.includes('repositoryServed'));
});

// ---- routing gate / whitelist tests ----
test('8. routing stays legacy when mutation flags are false', () => {
  withFlags({ MENTOR_TASK_MUTATIONS_V2: undefined, MENTOR_SHEETS_MUTATIONS_V2: undefined, MENTOR_MUTATION_IDEMPOTENCY_V2: undefined }, () => {
    assert.strictEqual(routing.isV2TaskMutationActive(), false);
    assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), false);
  });
});
test('9. routing allows ONLY snooze when all 3 mutation flags are true', () => {
  withFlags({ MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' }, () => {
    assert.strictEqual(routing.isV2TaskMutationActive(), true);
    assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), true);
  });
});
test('10. non-whitelisted actions stay legacy even when all mutation flags are true', () => {
  withFlags({ MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' }, () => {
    // snooze + resume are whitelisted (V2); everything else stays legacy.
    ['complete', 'response', 'launch_practice'].forEach(a => assert.strictEqual(routing.shouldRouteActionThroughV2(a), false));
  });
});
test('11. no V2 routing when ANY single mutation flag is false', () => {
  const combos = [
    { MENTOR_TASK_MUTATIONS_V2: undefined, MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' },
    { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: undefined, MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' },
    { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: undefined },
  ];
  combos.forEach(c => withFlags(c, () => assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), false)));
});
test('13. freshly generated plan (blank V2 columns) reads cleanly under Repository V2', () => {
  // 1 active plan row + 1 active task, all V2 additive columns blank — mirrors
  // createMentorPlanSnapshot output. Repository V2 must read it without crashing.
  const raw = {
    profile: { headers: ['Email', 'MentorPlanId', 'OnboardingCompletedAt'], rows: [['u@test', 'MP_FRESH', '2026-06-11T00:00:00Z']] },
    plans: { headers: ['Email', 'PlanId', 'Status', 'Version', 'CreatedAt', 'PlanVersion', 'GenerationId', 'RowVersion', 'NextTaskNumber'], rows: [['u@test', 'MP_FRESH', 'active', 'v1', '2026-06-11T00:00:00Z', '', '', '', '']] },
    tasks: { headers: ['Email', 'PlanId', 'TaskId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'CreatedAt', 'PlanVersion', 'GenerationId', 'TaskNumber', 'RowVersion'], rows: [['u@test', 'MP_FRESH', 'FT1', 'active', 'practice_task', '1', '1', '2026-06-11T00:00:00Z', '', '', '', '']] },
    topicState: { headers: ['Email', 'Subject', 'Topic'], rows: [] },
  };
  const snap = buildSnapshotFromRawData(raw, { email: 'u@test' });
  assert.ok(snap.activeGeneration, 'active generation resolved');
  assert.strictEqual(snap.activeGeneration.ordinal, 1);
  assert.strictEqual(snap.currentTasks.length, 1);
  assert.strictEqual(snap.currentTasks[0].taskId, 'FT1');
  assert.strictEqual(snap.canonicalPendingTasks.length, 0);
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor read-overlay + routing tests passed.`);
  process.exit(failed ? 1 : 0);
})();
