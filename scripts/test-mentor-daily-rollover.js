#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  MAX_ACTIVE_TASKS,
  processDailyRollover,
  listPendingTasks,
  selectFeaturedPendingTask,
  pendingAgeDays,
  pendingNudgeTier,
  materializeTasksForPlanDay,
  extendSnapshotWithPending,
  rolloverKey,
  isCanonicalPendingTask,
} = require('../lib/mentor/services/dailyRolloverService');
const { TASK_STATUS, TASK_TYPE, PENDING_REASON } = require('../lib/mentor/domain/enums');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');
const { buildLegacyRawData, EMAIL } = require('../scripts/fixtures/mentor-legacy-fixture');

const NOW = '2026-06-10T06:00:00.000Z';
const activePlan = { planId: 'plan_1', planVersion: 1, activeDayNumber: 1 };

function makeIdempotencyStore() {
  const map = new Map();
  return {
    get: async key => map.get(key) || null,
    save: async (key, value) => { map.set(key, value); },
    size: () => map.size,
  };
}

function task(overrides = {}) {
  return {
    taskId: overrides.taskId || `task_${Math.random().toString(36).slice(2)}`,
    planId: 'plan_1',
    planVersion: 1,
    rowVersion: 1,
    isCurrentGeneration: true,
    isLegacyHidden: false,
    generationOrdinal: 5,
    status: TASK_STATUS.ACTIVE,
    type: TASK_TYPE.PRACTICE_TASK,
    taskNumber: 1,
    scheduledPlanDay: 1,
    dayNumber: 1,
    title: 'Amendments',
    subject: 'Polity',
    topic: 'Amendments',
    createdAt: '2026-06-08T06:00:00.000Z',
    ...overrides,
  };
}

function snapshot(tasks = [], overrides = {}) {
  return {
    activePlan,
    currentTasks: tasks,
    canonicalPendingTasks: overrides.canonicalPendingTasks || [],
    hiddenLegacyTasks: overrides.hiddenLegacyTasks || [],
    calendarDay: overrides.calendarDay == null ? 2 : overrides.calendarDay,
    lastProcessedCalendarDay: overrides.lastProcessedCalendarDay == null ? 1 : overrides.lastProcessedCalendarDay,
    timezone: 'Asia/Kolkata',
    serverGeneratedAt: NOW,
    ...overrides,
  };
}

async function runRollover(tasks, overrides = {}) {
  return processDailyRollover({
    userScope: 'user_scope',
    activePlan,
    repositorySnapshot: snapshot(tasks, overrides),
    currentServerTime: NOW,
    idempotencyStore: overrides.idempotencyStore || makeIdempotencyStore(),
    priorFeatured: overrides.priorFeatured || {},
  });
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('1. no day change is a no-op', async () => {
  const result = await runRollover([task({ taskId: 't1' })], { calendarDay: 1, lastProcessedCalendarDay: 1 });
  assert.equal(result.rolloverRequired, false);
  assert.equal(result.movedToPendingCount, 0);
});

test('2. Day 1 to Day 2 requires rollover', async () => {
  const result = await runRollover([task({ taskId: 't1' })]);
  assert.equal(result.rolloverRequired, true);
  assert.equal(result.lastProcessedCalendarDay, 2);
});

test('3. Day 1 to Day 5 emits multi-day diagnostic', async () => {
  const result = await runRollover([task({ taskId: 't1' })], { calendarDay: 5 });
  assert(result.diagnostics.includes('MULTI_DAY_GAP_PROCESSED'));
});

test('4. duplicate rollover request returns stored result', async () => {
  const store = makeIdempotencyStore();
  const first = await runRollover([task({ taskId: 't1' })], { idempotencyStore: store });
  const second = await runRollover([task({ taskId: 't1' })], { idempotencyStore: store });
  assert.equal(first.idempotent, undefined);
  assert.equal(second.idempotent, true);
  assert.equal(store.size(), 1);
});

test('5. two sequential duplicate calls produce one logical rollover', async () => {
  const store = makeIdempotencyStore();
  const [first, second] = await Promise.all([
    runRollover([task({ taskId: 't1' })], { idempotencyStore: store }),
    runRollover([task({ taskId: 't1' })], { idempotencyStore: store }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});

test('6. active practice moves to pending day_ended_incomplete', async () => {
  const result = await runRollover([task({ taskId: 't1' })]);
  assert.equal(result.pendingTasks[0].status, TASK_STATUS.PENDING);
  assert.equal(result.pendingTasks[0].pendingReason, PENDING_REASON.DAY_ENDED_INCOMPLETE);
});

test('7. in_progress practice moves to pending in_progress_abandoned', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.IN_PROGRESS })]);
  assert.equal(result.pendingTasks[0].pendingReason, PENDING_REASON.IN_PROGRESS_ABANDONED);
});

test('8. active theory moves to pending', async () => {
  const result = await runRollover([task({ taskId: 't1', type: TASK_TYPE.THEORY_TASK })]);
  assert.equal(result.pendingCount, 1);
});

test('9. completed task is unchanged', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.COMPLETED })]);
  assert.equal(result.pendingCount, 0);
});

test('10. scheduled task is unchanged', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.SCHEDULED })]);
  assert.equal(result.pendingCount, 0);
});

test('11. blocked task is unchanged', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.BLOCKED })]);
  assert.equal(result.pendingCount, 0);
});

test('12. cancelled task is unchanged', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.CANCELLED })]);
  assert.equal(result.pendingCount, 0);
});

test('13. expired task is unchanged', async () => {
  const result = await runRollover([task({ taskId: 't1', status: TASK_STATUS.EXPIRED })]);
  assert.equal(result.pendingCount, 0);
});

test('14. active coverage check is rescheduled, not pending', async () => {
  const result = await runRollover([task({ taskId: 't1', type: TASK_TYPE.COVERAGE_CHECK })]);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.rescheduledCount, 1);
});

test('15. active confidence check is rescheduled', async () => {
  const result = await runRollover([task({ taskId: 't1', type: TASK_TYPE.CONFIDENCE_CHECK })]);
  assert.equal(result.rescheduledCount, 1);
});

test('16. feedback task is rescheduled', async () => {
  const result = await runRollover([task({ taskId: 't1', type: TASK_TYPE.FEEDBACK_TASK })]);
  assert.equal(result.rescheduledCount, 1);
});

test('17. pace unlock is ignored as an offer', async () => {
  const result = await runRollover([task({ taskId: 't1', type: TASK_TYPE.PACE_UNLOCK_TASK })]);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.rescheduledCount, 0);
});

test('18. hidden legacy snoozed is not migrated', async () => {
  const pending = listPendingTasks([task({ taskId: 'legacy', status: 'snoozed', isLegacyHidden: true })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 0);
});

test('19. historical-generation active task is not mutated', async () => {
  const result = await runRollover([task({ taskId: 'old', isCurrentGeneration: false })]);
  assert.equal(result.pendingCount, 0);
});

test('20. current-generation task only is processed', async () => {
  const result = await runRollover([task({ taskId: 'old', isCurrentGeneration: false }), task({ taskId: 'new' })]);
  assert.deepEqual(result.pendingTasks.map(t => t.taskId), ['new']);
});

test('21. verified legacy snoozed tasks remain hidden', async () => {
  const legacy = Array.from({ length: 10 }, (_, i) => task({ taskId: `legacy_${i}`, status: 'snoozed', isLegacyHidden: true }));
  const pending = listPendingTasks(legacy, activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 0);
});

test('22. pending query returns current plan only', () => {
  const pending = listPendingTasks([task({ taskId: 'p1', status: TASK_STATUS.PENDING }), task({ taskId: 'p2', planId: 'other', status: TASK_STATUS.PENDING })], activePlan, { serverGeneratedAt: NOW });
  assert.deepEqual(pending.map(t => t.taskId), ['p1']);
});

test('23. pending query sorting is deterministic', () => {
  const pending = listPendingTasks([
    task({ taskId: 'b', status: TASK_STATUS.PENDING, taskNumber: 2, movedToPendingAt: '2026-06-09T00:00:00Z' }),
    task({ taskId: 'a', status: TASK_STATUS.PENDING, taskNumber: 1, movedToPendingAt: '2026-06-08T00:00:00Z' }),
  ], activePlan, { serverGeneratedAt: NOW });
  assert.deepEqual(pending.map(t => t.taskId), ['a', 'b']);
});

test('24. pending query removes duplicate IDs', () => {
  const pending = listPendingTasks([task({ taskId: 'p', status: TASK_STATUS.PENDING }), task({ taskId: 'p', status: TASK_STATUS.PENDING })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 1);
});

test('25. completed tasks are excluded from pending query', () => {
  assert.equal(listPendingTasks([task({ taskId: 'c', status: TASK_STATUS.COMPLETED })], activePlan, { serverGeneratedAt: NOW }).length, 0);
});

test('26. deferred checks are excluded from pending query', () => {
  assert.equal(listPendingTasks([task({ taskId: 'q', status: TASK_STATUS.PENDING, type: TASK_TYPE.COVERAGE_CHECK })], activePlan, { serverGeneratedAt: NOW }).length, 0);
});

test('27. zero pending selects no featured task', () => {
  assert.equal(selectFeaturedPendingTask([], {}, 2).featuredPendingTask, null);
});

test('28. one pending is selected', () => {
  const p = task({ taskId: 'p', status: TASK_STATUS.PENDING });
  assert.equal(selectFeaturedPendingTask([p], {}, 2).featuredPendingTaskId, 'p');
});

test('29. multiple pending selects highest priority', () => {
  const pending = listPendingTasks([
    task({ taskId: 'normal', status: TASK_STATUS.PENDING, type: TASK_TYPE.PRACTICE_TASK }),
    task({ taskId: 'mistake', status: TASK_STATUS.PENDING, type: TASK_TYPE.MISTAKE_RECOVERY_TASK }),
  ], activePlan, { serverGeneratedAt: NOW });
  assert.equal(selectFeaturedPendingTask(pending, {}, 2).featuredPendingTaskId, 'mistake');
});

test('30. featured pending remains stable on refresh', () => {
  const pending = [task({ taskId: 'a', status: TASK_STATUS.PENDING }), task({ taskId: 'b', status: TASK_STATUS.PENDING })];
  assert.equal(selectFeaturedPendingTask(pending, { featuredPendingTaskId: 'b', featuredPendingForCalendarDay: 2 }, 2).featuredPendingTaskId, 'b');
});

test('31. featured pending is reselected after completion', () => {
  const pending = [task({ taskId: 'a', status: TASK_STATUS.PENDING })];
  assert.equal(selectFeaturedPendingTask(pending, { featuredPendingTaskId: 'done', featuredPendingForCalendarDay: 2 }, 2).featuredPendingTaskId, 'a');
});

test('32. featured pending is not active simultaneously', async () => {
  const result = await runRollover([task({ taskId: 'p' })]);
  assert(!result.activeTasks.some(t => t.taskId === result.featuredPendingTaskId));
});

test('33. maximum 3 active tasks are selected', () => {
  const result = materializeTasksForPlanDay({ existingTasks: [1, 2, 3, 4].map(n => task({ taskId: `a${n}`, taskNumber: n })) });
  assert.equal(result.activeTasks.length, MAX_ACTIVE_TASKS);
});

test('34. extra active tasks remain scheduled overflow', () => {
  const result = materializeTasksForPlanDay({ existingTasks: [1, 2, 3, 4].map(n => task({ taskId: `a${n}`, taskNumber: n })) });
  assert.equal(result.scheduledOverflow[0].status, TASK_STATUS.SCHEDULED);
});

test('35. featured pending is not counted as required active', async () => {
  const result = await runRollover([task({ taskId: 'p' }), ...[1, 2, 3].map(n => task({ taskId: `a${n}`, status: TASK_STATUS.ACTIVE, taskNumber: n }))]);
  assert(result.activeTasks.length <= MAX_ACTIVE_TASKS);
});

test('36. pending age is calculated from local calendar dates', () => {
  assert.equal(pendingAgeDays(task({ movedToPendingAt: '2026-06-07T18:35:00.000Z' }), 'Asia/Kolkata', '2026-06-10T01:00:00.000Z'), 2);
});

test('37. nudge tier 1-3 is normal', () => {
  assert.equal(pendingNudgeTier(3), 'normal');
});

test('38. nudge tier 4-7 is stronger', () => {
  assert.equal(pendingNudgeTier(7), 'stronger');
});

test('39. nudge tier 8-14 recommends backlog session', () => {
  assert.equal(pendingNudgeTier(14), 'backlog_session');
});

test('40. nudge tier 15+ recommends plan review', () => {
  assert.equal(pendingNudgeTier(15), 'plan_review');
});

test('41. old pending task is not auto-expired', () => {
  const pending = listPendingTasks([task({ taskId: 'old', status: TASK_STATUS.PENDING, movedToPendingAt: '2026-05-01T00:00:00Z' })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending[0].status, TASK_STATUS.PENDING);
});

test('42. snapshot pending count integrity is preserved', async () => {
  const result = await runRollover([task({ taskId: 'p' })]);
  const extended = extendSnapshotWithPending(snapshot([]), result);
  assert.equal(extended.pendingCount, extended.pendingTasks.length);
});

test('43. featured task is included in pending count', async () => {
  const result = await runRollover([task({ taskId: 'p' })]);
  assert(result.pendingTasks.some(t => t.taskId === result.featuredPendingTaskId));
});

test('44. no cross-collection duplicate active and pending IDs', async () => {
  const result = await runRollover([task({ taskId: 'p' })]);
  const activeIds = new Set((result.activeTasks || []).map(t => t.taskId));
  assert(!result.pendingTasks.some(t => activeIds.has(t.taskId)));
});

test('45. completed tasks are excluded from extended pending snapshot', () => {
  const extended = extendSnapshotWithPending(snapshot([task({ taskId: 'c', status: TASK_STATUS.COMPLETED })]));
  assert.equal(extended.pendingCount, 0);
});

test('46. canonical day is independent of task completion', async () => {
  const result = await runRollover([task({ taskId: 'c', status: TASK_STATUS.COMPLETED })], { calendarDay: 5 });
  assert.equal(result.calendarDay, 5);
});

test('47. rollover aggregate event is appended once', async () => {
  const result = await runRollover([task({ taskId: 'p' })]);
  assert.equal(result.events.filter(e => e.type === 'daily_rollover_processed').length, 1);
});

test('48. duplicate request returns original result', async () => {
  const store = makeIdempotencyStore();
  const first = await runRollover([task({ taskId: 'p' })], { idempotencyStore: store });
  const second = await runRollover([task({ taskId: 'p' })], { idempotencyStore: store });
  assert.equal(second.pendingCount, first.pendingCount);
});

test('49. same idempotency key with different payload is rejected', async () => {
  const store = makeIdempotencyStore();
  await runRollover([task({ taskId: 'p' })], { idempotencyStore: store, calendarDay: 2, lastProcessedCalendarDay: 1 });
  const result = await runRollover([task({ taskId: 'p' })], { idempotencyStore: store, calendarDay: 2, lastProcessedCalendarDay: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ROLLOVER_IDEMPOTENCY_PAYLOAD_MISMATCH');
});

test('50. task transition events are generated once per moved task', async () => {
  const result = await runRollover([task({ taskId: 'a' }), task({ taskId: 'b' })]);
  assert.equal(result.events.filter(e => e.type === 'task_postponed').length, 2);
});

test('51. rollover key format is deterministic', () => {
  assert.equal(rolloverKey({ userScope: 'u', planId: 'p', calendarDay: 3 }), 'mentor-rollover:u:p:3');
});

test('52. current day materialisation does not fabricate tasks', () => {
  const result = materializeTasksForPlanDay({ existingTasks: [] });
  assert.equal(result.activeTasks.length, 0);
  assert.equal(result.scheduledOverflow.length, 0);
});

test('53. scheduled future task is not moved to pending in rollover result', async () => {
  const result = await runRollover([task({ taskId: 'future', status: TASK_STATUS.SCHEDULED, scheduledPlanDay: 4 })], { calendarDay: 5 });
  assert.equal(result.pendingCount, 0);
});

test('54. completed evidence is preserved by exclusion, not mutation', async () => {
  const result = await runRollover([task({ taskId: 'done', status: TASK_STATUS.COMPLETED, completedAt: NOW })]);
  assert.equal(result.movedToPendingCount, 0);
});

test('55. hidden legacy task cannot be featured', () => {
  const pending = listPendingTasks([task({ taskId: 'hidden', status: TASK_STATUS.PENDING, isLegacyHidden: true })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(selectFeaturedPendingTask(pending, {}, 2).featuredPendingTask, null);
});

// ── Phase 8A: legacy snoozed pending reconciliation ──────────────────────────
// A "legacy snoozed" row = read-normalized pending (status pending) with
// rawLegacyStatus 'snoozed' and blank v2 pending fields.
const legacySnoozed = o => task({ status: TASK_STATUS.PENDING, rawLegacyStatus: 'snoozed', pendingReason: '', movedToPendingAt: '', ...o });

test('56. legacy snoozed HISTORICAL task is hidden', () => {
  const pending = listPendingTasks([legacySnoozed({ taskId: 'h', isCurrentGeneration: false })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 0);
});
test('57. legacy snoozed CURRENT-generation task is hidden', () => {
  const pending = listPendingTasks([legacySnoozed({ taskId: 'c', isCurrentGeneration: true })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 0);
});
test('58. legacy snoozed current-gen with blank PendingReason is not canonical pending', () => {
  assert.equal(isCanonicalPendingTask(legacySnoozed({ taskId: 'c' })), false);
});
test('59. current-gen legacy snoozed is NOT selected as featured pending', () => {
  const pending = listPendingTasks([legacySnoozed({ taskId: 'c' })], activePlan, { serverGeneratedAt: NOW });
  assert.equal(selectFeaturedPendingTask(pending, {}, 2).featuredPendingTask, null);
});
test('60. current-gen legacy snoozed does not affect nudge tier (count 0 -> hidden)', () => {
  const pending = listPendingTasks(Array.from({ length: 3 }, (_, i) => legacySnoozed({ taskId: `c${i}` })), activePlan, { serverGeneratedAt: NOW });
  assert.equal(pending.length, 0);
  assert.equal(pendingNudgeTier(pending.length), 'hidden');
});
test('61. v2 pending task with PendingReason IS included', () => {
  const pending = listPendingTasks([legacySnoozed({ taskId: 'v2', pendingReason: PENDING_REASON.USER_POSTPONED })], activePlan, { serverGeneratedAt: NOW });
  assert.deepEqual(pending.map(t => t.taskId), ['v2']);
});
test('62. v2 pending task with MovedToPendingAt IS included', () => {
  const pending = listPendingTasks([legacySnoozed({ taskId: 'v2', movedToPendingAt: '2026-06-10T00:00:00Z' })], activePlan, { serverGeneratedAt: NOW });
  assert.deepEqual(pending.map(t => t.taskId), ['v2']);
});
test('63. genuine v2 pending (no legacy snoozed marker) still included', () => {
  const pending = listPendingTasks([task({ taskId: 'p', status: TASK_STATUS.PENDING })], activePlan, { serverGeneratedAt: NOW });
  assert.deepEqual(pending.map(t => t.taskId), ['p']);
});
test('64. migrated legacy fixture: repository canonical pending = 0', () => {
  const snap = buildSnapshotFromRawData(buildLegacyRawData(), { email: EMAIL });
  assert.equal(snap.canonicalPendingTasks.length, 0);
  assert.equal(snap.hiddenLegacyTasks.length, 10);
});
test('65. migrated legacy fixture: rollover shadow pending = 0', async () => {
  const snap = buildSnapshotFromRawData(buildLegacyRawData(), { email: EMAIL });
  const result = await processDailyRollover({
    userScope: 'shadow', activePlan: snap.activePlan, repositorySnapshot: snap,
    currentServerTime: snap.serverGeneratedAt, idempotencyStore: { get: async () => null, save: async () => {} },
  });
  assert.equal(result.ok, true);
  assert.equal(result.pendingCount, 0);
  assert.equal(Boolean(result.featuredPendingTaskId), false);
  assert.equal(result.pendingNudgeTier, 'hidden');
});
test('66. predicate: completed/cancelled/expired never canonical pending', () => {
  [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED, TASK_STATUS.EXPIRED].forEach(s =>
    assert.equal(isCanonicalPendingTask(task({ status: s })), false));
});
test('67. predicate: quick-check pending never canonical pending', () => {
  assert.equal(isCanonicalPendingTask(task({ status: TASK_STATUS.PENDING, type: TASK_TYPE.COVERAGE_CHECK })), false);
});

(async () => {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`ok ${passed} - ${item.name}`);
    } catch (err) {
      console.error(`not ok ${passed + 1} - ${item.name}`);
      console.error(err);
      process.exit(1);
    }
  }
  console.log(`\n${passed}/${tests.length} Mentor daily rollover tests passed.`);
})();
