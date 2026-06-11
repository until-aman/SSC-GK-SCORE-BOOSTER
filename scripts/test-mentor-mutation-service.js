#!/usr/bin/env node
/**
 * scripts/test-mentor-mutation-service.js — Phase 9A planning tests (non-mutating).
 *
 * Exercises the guarded V2 mutation service (executeTaskMutation) with the
 * in-memory repository + idempotency store ONLY. No live Google Sheet, no real
 * write. Validates the guards Phase 9B's first live cut-over will rely on.
 * Run: node scripts/test-mentor-mutation-service.js
 */
'use strict';

const assert = require('assert');
const {
  executeTaskMutation,
  createMemoryMutationRepository,
  createMemoryIdempotencyStore,
  deriveIdempotencyKey,
  userScopeFromIdentity,
} = require('../lib/mentor/services/taskMutationService');
const { TASK_ACTION } = require('../lib/mentor/domain/taskStateMachine');

const USER = { email: 'mutation-test@example.test' };
const NOW = '2026-06-11T08:00:00.000Z';
function activeTask(o = {}) {
  return { taskId: 't1', planId: 'P', planVersion: 1, rowVersion: 1, status: 'active', type: 'practice_task', isCurrentGeneration: true, isLegacyHidden: false, ...o };
}
function repoWith(tasks, events = []) {
  return createMemoryMutationRepository({ activePlan: { planId: 'P', planVersion: 1 }, tasks, events });
}

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

// 1. postpone (recommended first action) succeeds on an active task
test('1. POSTPONE active -> pending succeeds; event appended; no completion', async () => {
  const repo = repoWith([activeTask()]);
  const store = createMemoryIdempotencyStore();
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: store, request: { taskId: 't1', action: TASK_ACTION.POSTPONE }, now: NOW });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.task.status, 'pending');
  assert.ok(res.task.pendingReason, 'pendingReason set');
  assert.ok(res.task.movedToPendingAt, 'movedToPendingAt set');
  assert.strictEqual(Number(res.task.rowVersion), 2);
  assert.strictEqual(repo.events().length, 1);
  assert.strictEqual(store.size(), 1);
});

// 2. idempotent replay
test('2. duplicate idempotency key + same payload returns stored result (idempotent)', async () => {
  const repo = repoWith([activeTask()]);
  const store = createMemoryIdempotencyStore();
  const req = { taskId: 't1', action: TASK_ACTION.POSTPONE, idempotencyKey: 'k1' };
  const first = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: store, request: req, now: NOW });
  const second = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: store, request: req, now: NOW });
  assert.strictEqual(first.idempotent, false);
  assert.strictEqual(second.idempotent, true);
  assert.strictEqual(store.size(), 1);
  assert.strictEqual(repo.events().length, 1); // not appended twice
});

// 3. same key, different payload rejected
test('3. same idempotency key + different payload rejected', async () => {
  const repo = repoWith([activeTask(), activeTask({ taskId: 't2' })]);
  const store = createMemoryIdempotencyStore();
  await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: store, request: { taskId: 't1', action: TASK_ACTION.POSTPONE, idempotencyKey: 'shared' }, now: NOW });
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: store, request: { taskId: 't2', action: TASK_ACTION.POSTPONE, idempotencyKey: 'shared' }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
});

// 4. stale RowVersion rejected (optimistic lock)
test('4. stale expectedRowVersion rejected', async () => {
  const repo = repoWith([activeTask()]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.POSTPONE, expectedRowVersion: 99 }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.ok(/STALE_ROW_VERSION|STALE/.test(res.code), res.code);
});

// 5. historical-generation task rejected
test('5. historical-generation task rejected', async () => {
  const repo = repoWith([activeTask({ isCurrentGeneration: false })]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.POSTPONE }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});

// 6. hidden legacy snoozed rejected
test('6. hidden legacy snoozed task rejected', async () => {
  const repo = repoWith([activeTask({ isLegacyHidden: true, status: 'pending', rawLegacyStatus: 'snoozed' })]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.RESUME }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});

// 7. task not in active plan rejected
test('7. request.planId mismatch rejected (STALE_PLAN)', async () => {
  const repo = repoWith([activeTask()]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.POSTPONE, planId: 'OTHER' }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'STALE_PLAN');
});

// 8. duplicate completion blocked
test('8. duplicate completion blocked when a completed event exists', async () => {
  const repo = repoWith([activeTask({ type: 'theory_task' })], [{ taskId: 't1', type: 'task_completed' }]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.COMPLETE, context: { completionSource: 'mentor_response' } }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'DUPLICATE_COMPLETION');
});

// 9. unsupported / non-whitelisted action rejected before any write
test('9. unsupported action rejected (whitelist safety)', async () => {
  const repo = repoWith([activeTask()]);
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: 'DELETE_EVERYTHING' }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'UNSUPPORTED_ACTION');
  assert.strictEqual(repo.events().length, 0);
});

// 10. no active plan rejected
test('10. no active plan pointer rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: {}, tasks: [activeTask()] });
  repo.getActivePlanPointer = async () => ({ planId: '', status: 'active' });
  const res = await executeTaskMutation({ userIdentity: USER, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 't1', action: TASK_ACTION.POSTPONE }, now: NOW });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'NO_ACTIVE_PLAN');
});

// 11. derived idempotency key + user scope are deterministic and non-PII-leaking
test('11. idempotency key deterministic; user scope hashed', () => {
  const scope = userScopeFromIdentity(USER);
  assert.ok(scope.startsWith('u_') && !scope.includes('@'));
  const k = deriveIdempotencyKey({ userScope: scope, planId: 'P', taskId: 't1', action: 'POSTPONE', clientOperationId: 'op1' });
  assert.strictEqual(k, deriveIdempotencyKey({ userScope: scope, planId: 'P', taskId: 't1', action: 'POSTPONE', clientOperationId: 'op1' }));
  assert.ok(!k.includes('@'));
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor mutation-service planning tests passed.`);
  process.exit(failed ? 1 : 0);
})();
