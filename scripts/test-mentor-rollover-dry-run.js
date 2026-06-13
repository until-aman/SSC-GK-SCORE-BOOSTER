#!/usr/bin/env node
/**
 * scripts/test-mentor-rollover-dry-run.js — Phase 10B daily-rollover SHADOW dry-run.
 * Drives the real pure planner `processDailyRollover` with a NO-OP idempotency store
 * (shadow) against controlled fixtures. NO Sheet writes, no flags, fake data only.
 * Run: node scripts/test-mentor-rollover-dry-run.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  processDailyRollover, materializeTasksForPlanDay, rolloverKey, MAX_ACTIVE_TASKS,
} = require('../lib/mentor/services/dailyRolloverService');

const NOW = '2026-06-12T06:00:00.000Z';
const PLAN = 'P_DRYRUN';
const SCOPE = 'u_dryrun';
const NOOP = { get: async () => null, save: async () => {} };
let saveCalls = 0; const spyStore = { get: async () => null, save: async () => { saveCalls += 1; } };

function task(o = {}) {
  return { taskId: o.taskId || 't', planId: PLAN, type: o.type || 'practice_task', status: o.status || 'active', isCurrentGeneration: true, isLegacyHidden: false, rowVersion: o.rowVersion != null ? o.rowVersion : 1, taskNumber: o.taskNumber || 1, dayNumber: o.dayNumber || 1, ...o };
}
function snap({ calendarDay, lastProcessed, tasks = [], pending = [] }) {
  return { calendarDay, lastProcessedCalendarDay: lastProcessed, currentTasks: tasks, canonicalPendingTasks: pending, timezone: 'Asia/Kolkata', serverGeneratedAt: NOW };
}
const run = (s, store = NOOP) => processDailyRollover({ userScope: SCOPE, activePlan: { planId: PLAN }, repositorySnapshot: s, currentServerTime: NOW, idempotencyStore: store });
const idsOf = arr => (arr || []).map(t => t.taskId);

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('A. active work task -> would move to pending (DAY_ENDED_INCOMPLETE)', async () => {
  const r = await run(snap({ calendarDay: 2, lastProcessed: 1, tasks: [task({ taskId: 'A1', type: 'practice_task', status: 'active', rowVersion: 1 })] }));
  assert.strictEqual(r.rolloverRequired, true);
  assert.strictEqual(r.movedToPendingCount, 1);
  assert.strictEqual(r.pendingCount, 1);
  assert.strictEqual(r.pendingTasks[0].pendingReason, 'day_ended_incomplete');
  assert.ok(r.pendingTasks[0].movedToPendingAt, 'movedToPendingAt set');
  assert.ok(Number(r.pendingTasks[0].rowVersion) > 1, 'rowVersion incremented');
});
test('B. in_progress work task -> pending with IN_PROGRESS_ABANDONED', async () => {
  const r = await run(snap({ calendarDay: 2, lastProcessed: 1, tasks: [task({ taskId: 'B1', type: 'revision_task', status: 'in_progress' })] }));
  assert.strictEqual(r.movedToPendingCount, 1);
  assert.strictEqual(r.pendingTasks[0].pendingReason, 'in_progress_abandoned');
});
test('C. quick checks -> rescheduled, NOT pending', async () => {
  const tasks = [
    task({ taskId: 'C1', type: 'coverage_check', status: 'active' }),
    task({ taskId: 'C2', type: 'confidence_check', status: 'active' }),
    task({ taskId: 'C3', type: 'feedback_task', status: 'active' }),
    task({ taskId: 'C4', type: 'pace_unlock_task', status: 'active' }),
  ];
  const r = await run(snap({ calendarDay: 2, lastProcessed: 1, tasks }));
  assert.strictEqual(r.movedToPendingCount, 0, 'quick checks never become pending');
  assert.strictEqual(r.pendingCount, 0);
  assert.ok(r.rescheduledCount >= 3, `rescheduledCount=${r.rescheduledCount}`);
});
test('D. active limit: materialize caps active at 3, overflow -> scheduled; pending excluded', () => {
  const five = Array.from({ length: 5 }, (_, i) => task({ taskId: `D${i}`, status: 'active', taskNumber: i + 1 }));
  const m = materializeTasksForPlanDay({ existingTasks: five });
  assert.strictEqual(m.activeTasks.length, MAX_ACTIVE_TASKS);
  assert.strictEqual(m.scheduledOverflow.length, 2);
  assert.ok(m.scheduledOverflow.every(t => t.status === 'scheduled'));
  assert.ok(m.diagnostics.includes('MAX_ACTIVE_TASKS_APPLIED'));
  // pending tasks do not count toward the active limit
  const mixed = materializeTasksForPlanDay({ existingTasks: [task({ taskId: 'Ax', status: 'active' }), task({ taskId: 'AY', status: 'active' }), task({ taskId: 'P1', status: 'pending' }), task({ taskId: 'P2', status: 'pending' }), task({ taskId: 'P3', status: 'pending' })] });
  assert.strictEqual(mixed.activeTasks.length, 2, 'pending excluded from active count');
});
test('E. multi-day gap -> ONE rollover, MULTI_DAY_GAP_PROCESSED, no duplicate moves', async () => {
  const r = await run(snap({ calendarDay: 4, lastProcessed: 1, tasks: [task({ taskId: 'E1', type: 'practice_task', status: 'active' })] }));
  assert.strictEqual(r.rolloverRequired, true);
  assert.strictEqual(r.movedToPendingCount, 1, 'moved once, not once-per-skipped-day');
  assert.ok(r.diagnostics.includes('MULTI_DAY_GAP_PROCESSED'));
});
test('F. already-processed day -> no-op (rolloverRequired false)', async () => {
  const r = await run(snap({ calendarDay: 2, lastProcessed: 2, tasks: [task({ taskId: 'F1', type: 'practice_task', status: 'active' })] }));
  assert.strictEqual(r.rolloverRequired, false);
  assert.strictEqual(r.movedToPendingCount, 0);
  assert.strictEqual(r.rescheduledCount, 0);
});
test('G. (documented) shadow does NOT special-case the final plan day — calendarDay drives rollover', async () => {
  // no totalPlanDays awareness in processDailyRollover; an advancing calendarDay still rolls over.
  const r = await run(snap({ calendarDay: 46, lastProcessed: 45, tasks: [task({ taskId: 'G1', type: 'practice_task', status: 'active' })] }));
  assert.strictEqual(r.movedToPendingCount, 1); // current behaviour — final-day policy is a Phase 10C decision
});
test('8. idempotency key format is stable', () => {
  assert.strictEqual(rolloverKey({ userScope: SCOPE, planId: PLAN, calendarDay: 3 }), `mentor-rollover:${SCOPE}:${PLAN}:3`);
});
test('8b. re-run with stored result -> idempotent:true, no recompute', async () => {
  const s = snap({ calendarDay: 2, lastProcessed: 1, tasks: [task({ taskId: 'I1', type: 'practice_task', status: 'active' })] });
  let saved = null;
  const store = { get: async () => saved, save: async (k, v) => { saved = v; } };
  const first = await run(s, store);
  assert.strictEqual(first.idempotent, undefined);
  const second = await run(s, store);
  assert.strictEqual(second.idempotent, true);
});
test('9. no writer/update/append called — shadow uses only the injected idempotency store', async () => {
  saveCalls = 0;
  await run(snap({ calendarDay: 2, lastProcessed: 1, tasks: [task({ taskId: 'W1', type: 'practice_task', status: 'active' })] }), spyStore);
  assert.strictEqual(saveCalls, 1, 'only the idempotency store is touched (no-op in shadow)');
  // the service source must not import any Sheet writer
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'mentor', 'services', 'dailyRolloverService.js'), 'utf8');
  // Sheet-specific writers only (crypto .update() for hashing is fine).
  ['updateMentorTaskStatus', 'appendMentorTaskLog', 'compareAndUpdateTask', 'getSheetsClient', 'createSheetsMutationRepository', 'spreadsheets.values.update', 'spreadsheets.values.append', 'values.append'].forEach(bad => assert.ok(!src.includes(bad), `rollover service must not reference Sheet writer "${bad}"`));
});
test('10. rollover generates NO new tasks (only transitions existing ids)', async () => {
  const tasks = [task({ taskId: 'X1', type: 'practice_task', status: 'active' }), task({ taskId: 'X2', type: 'coverage_check', status: 'active' })];
  const r = await run(snap({ calendarDay: 2, lastProcessed: 1, tasks }));
  const out = new Set([...idsOf(r.pendingTasks), ...idsOf(r.activeTasks), ...idsOf(r.scheduledOverflow)]);
  const input = new Set(idsOf(tasks));
  [...out].forEach(id => assert.ok(input.has(id), `unexpected new task id "${id}" — rollover must not fabricate tasks`));
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor rollover dry-run scenarios passed.`); process.exit(failed ? 1 : 0); })();
