#!/usr/bin/env node
/**
 * scripts/test-mentor-v2-complete-design.js — Phase 9F design-audit tests (NON-LIVE).
 *
 * Validates the EXISTING building blocks the future V2 COMPLETE cut-over will rely
 * on (state machine completion-source rules, guarded service, routing). No live
 * Sheet, no mutation, COMPLETE not added to any whitelist. Fake/in-memory only.
 * Run: node scripts/test-mentor-v2-complete-design.js
 */
'use strict';

const assert = require('assert');
const { evaluateTaskTransition, TASK_ACTION } = require('../lib/mentor/domain/taskStateMachine');
const { COMPLETION_SOURCE } = require('../lib/mentor/domain/enums');
const { executeTaskMutation, createMemoryMutationRepository, createMemoryIdempotencyStore } = require('../lib/mentor/services/taskMutationService');
const routing = require('../lib/mentor/read/taskActionRouting');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');
const { buildLegacyRawData, EMAIL } = require('./fixtures/mentor-legacy-fixture');

const USER = { email: 'complete-design@test' };
const NOW = '2026-06-11T12:00:00.000Z';
const active = (o = {}) => ({ taskId: 't1', planId: 'P', planVersion: 1, rowVersion: 1, status: 'active', type: 'practice_task', isCurrentGeneration: true, isLegacyHidden: false, ...o });

let passed = 0, failed = 0; const tests = []; const test = (n, fn) => tests.push({ n, fn });

test('1. complete is NOT routed through V2 (not whitelisted), even with all flags on', () => {
  const prev = {}; ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2'].forEach(f => { prev[f] = process.env[f]; process.env[f] = 'true'; });
  try { assert.strictEqual(routing.shouldRouteActionThroughV2('complete'), false); assert.ok(!routing.V2_CUTOVER_ACTIONS.includes('complete')); }
  finally { Object.entries(prev).forEach(([k, v]) => v === undefined ? delete process.env[k] : process.env[k] = v); }
});
test('2. quiz task + EXPLICIT mentor_response complete is REJECTED (wrong source)', () => {
  const r = evaluateTaskTransition({ task: active({ type: 'practice_task' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'INVALID_COMPLETION_SOURCE');
});
test('2b. GAP CLOSED (Phase 9G1): quiz task with NO source is now REJECTED (no silent mentor_response)', () => {
  const r = evaluateTaskTransition({ task: active({ type: 'practice_task' }), action: TASK_ACTION.COMPLETE, now: NOW });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'INVALID_COMPLETION_SOURCE');
});
test('3. quiz task + quiz_sync (+ linkedQuizSessionId) complete is ALLOWED -> completed', () => {
  const r = evaluateTaskTransition({ task: active({ type: 'practice_task' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC, linkedQuizSessionId: 'qs1' } });
  assert.strictEqual(r.allowed, true, JSON.stringify(r));
  assert.strictEqual(r.nextTask.status, 'completed');
});
test('4. complete sets CompletedAt + CompletionSource + LinkedQuizSessionId', () => {
  const r = evaluateTaskTransition({ task: active({ type: 'practice_task' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC, linkedQuizSessionId: 'qs1' } });
  assert.strictEqual(r.nextTask.completedAt, NOW);
  assert.strictEqual(r.nextTask.completionSource, COMPLETION_SOURCE.QUIZ_SYNC);
  assert.strictEqual(r.nextTask.linkedQuizSessionId, 'qs1');
});
test('5. check task (coverage_check) completes via mentor_response only', () => {
  const ok = evaluateTaskTransition({ task: active({ type: 'coverage_check' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } });
  assert.strictEqual(ok.allowed, true);
  const bad = evaluateTaskTransition({ task: active({ type: 'coverage_check' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } });
  assert.strictEqual(bad.allowed, false);
  assert.strictEqual(bad.code, 'INVALID_COMPLETION_SOURCE');
});
test('6. theory task completes via mentor_response', () => {
  const r = evaluateTaskTransition({ task: active({ type: 'theory_task' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } });
  assert.strictEqual(r.allowed, true);
});
test('7. manual_recovery complete requires verified evidence', () => {
  const bad = evaluateTaskTransition({ task: active({ status: 'pending', type: 'practice_task' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY, now: NOW, context: {} });
  assert.strictEqual(bad.allowed, false);
  assert.strictEqual(bad.code, 'MANUAL_RECOVERY_NOT_VERIFIED');
  const ok = evaluateTaskTransition({ task: active({ status: 'pending', type: 'practice_task' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY, now: NOW, context: { manualRecoveryVerified: true } });
  assert.strictEqual(ok.allowed, true);
});
test('8. service: quiz_sync complete active->completed, RowVersion+1, event appended', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P', planVersion: 1 }, tasks: [active({ type: 'practice_task' })] });
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), now: NOW, request: { taskId: 't1', planId: 'P', action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC, linkedQuizSessionId: 'qs1' } } });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.task.status, 'completed');
  assert.strictEqual(Number(res.task.rowVersion), 2);
  assert.strictEqual(repo.events().length, 1);
});
test('9. duplicate completion blocked when a completed event exists', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P', planVersion: 1 }, tasks: [active({ type: 'practice_task' })], events: [{ taskId: 't1', type: 'task_completed' }] });
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), now: NOW, request: { taskId: 't1', planId: 'P', action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'DUPLICATE_COMPLETION');
});
test('10. hidden/historical task rejects complete', () => {
  assert.strictEqual(evaluateTaskTransition({ task: active({ isCurrentGeneration: false }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } }).allowed, false);
  assert.strictEqual(evaluateTaskTransition({ task: active({ isLegacyHidden: true }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } }).allowed, false);
});
test('11. completed task cannot complete again (terminal)', () => {
  const r = evaluateTaskTransition({ task: active({ status: 'completed' }), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } });
  assert.strictEqual(r.allowed, false);
  assert.ok(/TERMINAL|INVALID_TRANSITION/.test(r.code), r.code);
});
test('12. affected real plan fixture: tasks are hidden/historical (not V2-completable)', () => {
  const snap = buildSnapshotFromRawData(buildLegacyRawData(), { email: EMAIL });
  // all 10 legacy snoozed are hidden; completed evidence is terminal — none are active/current actionable for COMPLETE
  assert.strictEqual(snap.hiddenLegacyTasks.length, 10);
  const anyActiveCurrent = snap.currentTasks.some(t => t.status === 'active');
  assert.strictEqual(anyActiveCurrent, false);
});

(async () => {
  for (const t of tests) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } }
  console.log(`\n${passed}/${tests.length} Mentor V2 COMPLETE design-audit tests passed.`);
  process.exit(failed ? 1 : 0);
})();
