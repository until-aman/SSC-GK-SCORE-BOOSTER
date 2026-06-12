#!/usr/bin/env node
/**
 * scripts/test-mentor-pending-ui.js — Phase 9E pending-UI integration checks.
 *
 * The repo has no React/DOM test harness, so these are source-assertion tests
 * over pages/mentor.js (plus a data-shape check via the shared overlay). They
 * verify the "Previously Pending" section wiring + non-guilt copy. No live data.
 * Run: node scripts/test-mentor-pending-ui.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { applyRepoV2Compatibility } = require('../lib/mentor/read/serveCompatibleSnapshot');

const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'mentor.js'), 'utf8');
const pendingBlock = src.slice(src.indexOf('Previously Pending'), src.indexOf('Previously Pending') + 1600);

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

test('1. pending section is gated to render only when pendingTasks.length > 0 (hidden when empty)', () => {
  assert.ok(/\(snapshot\?\.pendingTasks \|\| \[\]\)\.length > 0 &&/.test(src), 'pending section must be conditional on length > 0');
});
test('2. pending section renders from snapshot.pendingTasks', () => {
  assert.ok(/\(snapshot\?\.pendingTasks \|\| \[\]\)\.map\(/.test(src), 'must map over snapshot.pendingTasks');
  assert.ok(pendingBlock.includes('Previously Pending'), 'section heading present');
});
test('3. Resume CTA wired to handleResume', () => {
  assert.ok(/onClick=\{\(\) => handleResume\(task\)\}/.test(src), 'Resume button calls handleResume');
  assert.ok(/Resume/.test(pendingBlock));
});
test('4. handleResume calls task-action with actionType resume', () => {
  assert.ok(/async function handleResume\(task\)\s*\{[\s\S]*runTaskAction\(task, 'resume'\)/.test(src), 'handleResume -> runTaskAction(task, "resume")');
});
test('5. guest optimistic path maps resume -> active (pending disappears, becomes active)', () => {
  assert.ok(/if \(actionType === 'resume'\) return 'active';/.test(src), 'getGuestTaskStatus handles resume -> active');
});
test('6. resume is an accepted action in the task-action route', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'mentor', 'task-action.js'), 'utf8');
  assert.ok(/'complete', 'snooze', 'response', 'launch_practice', 'resume'/.test(route), 'route accepts resume');
});
test('7. pending UI copy avoids guilt language (missed / failed / overdue)', () => {
  const lc = pendingBlock.toLowerCase();
  ['missed', 'failed', 'overdue', 'you missed', 'you failed'].forEach(bad => assert.ok(!lc.includes(bad), `pending copy must not contain "${bad}"`));
  assert.ok(/paused for later|resume when you|continue when you/i.test(pendingBlock), 'uses gentle copy');
});
test('8. data: legacy snoozed (no v2 evidence) does NOT appear in served pendingTasks', () => {
  const legacy = { exists: true, profile: {}, plan: { planId: 'P', dayNumber: 1, tasks: [{ taskId: 'S1', status: 'snoozed' }] }, activeTasks: [], completedToday: [], deferredTasks: [{ taskId: 'S1', status: 'snoozed' }], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't' };
  const repo = { activePlan: { planId: 'P' }, currentTasks: [{ taskId: 'S1' }], historicalTasks: [], hiddenLegacyTasks: [{ taskId: 'S1' }], canonicalPendingTasks: [], calendarDay: 4, activePlanDay: 4, totalPlanDays: 46 };
  const served = applyRepoV2Compatibility(legacy, repo);
  assert.strictEqual(served.pendingTasks.length, 0);
});
test('9. data: V2 pending task appears in served pendingTasks and not in deferred (no duplicate)', () => {
  const legacy = { exists: true, profile: {}, plan: { planId: 'P', dayNumber: 1, tasks: [{ taskId: 'PEND', status: 'pending' }] }, activeTasks: [], completedToday: [], deferredTasks: [], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't' };
  const repo = { activePlan: { planId: 'P' }, currentTasks: [{ taskId: 'PEND' }], historicalTasks: [], hiddenLegacyTasks: [], canonicalPendingTasks: [{ taskId: 'PEND' }], calendarDay: 4, activePlanDay: 4, totalPlanDays: 46 };
  const served = applyRepoV2Compatibility(legacy, repo);
  assert.deepStrictEqual(served.pendingTasks.map(t => t.taskId), ['PEND']);
  assert.ok(!served.deferredTasks.some(t => t.taskId === 'PEND'));
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor pending-UI integration tests passed.`);
  process.exit(failed ? 1 : 0);
})();
