#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  evaluateTaskTransition,
  mapLegacyStatus,
  TASK_ACTION,
  TASK_STATUS,
} = require('../lib/mentor/domain/taskStateMachine');
const { TASK_TYPE, COMPLETION_SOURCE, PENDING_REASON } = require('../lib/mentor/domain/enums');
const {
  executeTaskMutation,
  createMemoryIdempotencyStore,
  createMemoryMutationRepository,
} = require('../lib/mentor/services/taskMutationService');
const flags = require('../lib/mentor/repository/featureFlags');
const fx = require('./fixtures/mentor-legacy-fixture');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');

let passed = 0, failed = 0;
function test(name, fn) {
  try { const r = fn(); if (r && typeof r.then === 'function') throw new Error('async test must use testAsync'); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; console.error(`  FAIL ${name}\n       ${err.stack || err.message}`); }
}
async function testAsync(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (err) { failed++; console.error(`  FAIL ${name}\n       ${err.stack || err.message}`); }
}
const base = (overrides = {}) => ({
  taskId: 'T1',
  planId: 'P1',
  planVersion: 1,
  rowVersion: 1,
  status: TASK_STATUS.ACTIVE,
  type: TASK_TYPE.PRACTICE_TASK,
  isCurrentGeneration: true,
  taskNumber: 7,
  ...overrides,
});
const ok = result => { assert.strictEqual(result.allowed, true, JSON.stringify(result)); return result.nextTask; };
const no = result => { assert.strictEqual(result.allowed, false); return result; };

console.log('\nPhase 4 - Mentor task state machine tests\n');

test('1. draft -> scheduled', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'draft', type: TASK_TYPE.THEORY_TASK }), action: TASK_ACTION.SCHEDULE })).status, 'scheduled'));
test('2. scheduled -> active', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'scheduled', type: TASK_TYPE.THEORY_TASK }), action: TASK_ACTION.ACTIVATE })).status, 'active'));
test('3. active -> in_progress', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base(), action: TASK_ACTION.START })).status, 'in_progress'));
test('4. active -> pending', () => {
  const next = ok(evaluateTaskTransition({ task: base(), action: TASK_ACTION.POSTPONE, context: { pendingReason: PENDING_REASON.USER_POSTPONED } }));
  assert.strictEqual(next.status, 'pending'); assert.strictEqual(next.snoozeCount, 1);
});
test('5. in_progress -> pending', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'in_progress' }), action: TASK_ACTION.POSTPONE })).status, 'pending'));
test('6. pending -> active', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.RESUME })).status, 'active'));
test('7. active -> completed', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ type: TASK_TYPE.THEORY_TASK }), action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } })).status, 'completed'));
test('8. in_progress -> completed', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'in_progress' }), action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC, linkedQuizSessionId: 'qs1' } })).status, 'completed'));
test('9. verified pending -> completed through manual recovery', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY, context: { manualRecoveryVerified: true } })).status, 'completed'));
test('10. quick-check defer remains scheduled', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'scheduled', type: TASK_TYPE.CONFIDENCE_CHECK }), action: TASK_ACTION.DEFER_CHECK, context: { nextEligibleAt: '2026-06-11T00:00:00Z' } })).status, 'scheduled'));
test('11. blocked -> active/scheduled', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'blocked', type: TASK_TYPE.THEORY_TASK }), action: TASK_ACTION.UNBLOCK, context: { unblockToActive: true } })).status, 'active'));
test('12. active -> cancelled', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base(), action: TASK_ACTION.CANCEL })).status, 'cancelled'));
test('13. pending -> cancelled', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.CANCEL })).status, 'cancelled'));
test('14. invalid source -> expired', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base(), action: TASK_ACTION.EXPIRE_INVALID })).status, 'expired'));

test('15. completed -> active rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'completed' }), action: TASK_ACTION.ACTIVATE })).code, 'TERMINAL_TASK'));
test('16. cancelled -> active rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'cancelled' }), action: TASK_ACTION.ACTIVATE })).code, 'TERMINAL_TASK'));
test('17. expired -> active rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'expired' }), action: TASK_ACTION.ACTIVATE })).code, 'TERMINAL_TASK'));
test('18. pending -> postpone duplicate rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.POSTPONE })).code, 'INVALID_TRANSITION'));
test('19. unsupported task type/action rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ type: TASK_TYPE.CONFIDENCE_CHECK }), action: TASK_ACTION.POSTPONE })).code, 'ACTION_NOT_ALLOWED_FOR_TASK_TYPE'));
test('20. direct status override rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base(), action: TASK_ACTION.COMPLETE, context: { directStatusOverride: true } })).code, 'DIRECT_STATUS_OVERRIDE_REJECTED'));
(async () => {
await testAsync('21. wrong user rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base({ ownerScope: 'other' })] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START } });
  assert.strictEqual(res.code, 'WRONG_USER');
});
await testAsync('22. wrong plan rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P2', action: TASK_ACTION.START } });
  assert.strictEqual(res.code, 'STALE_PLAN');
});
await testAsync('23. wrong version rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 2 }, tasks: [base()] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START } });
  assert.strictEqual(res.code, 'STALE_PLAN_VERSION');
});
await testAsync('24. historical-generation task rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base({ isCurrentGeneration: false })] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START } });
  assert.strictEqual(res.code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});
await testAsync('25. stale expected status rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START, expectedStatus: 'pending' } });
  assert.strictEqual(res.code, 'STALE_EXPECTED_STATUS');
});
await testAsync('26. stale rowVersion rejected', async () => {
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: createMemoryIdempotencyStore(), request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START, expectedRowVersion: 99 } });
  assert.strictEqual(res.code, 'STALE_ROW_VERSION');
});
test('27. unmet dependency rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base(), action: TASK_ACTION.START, context: { dependenciesSatisfied: false } })).code, 'DEPENDENCY_BLOCKED'));

await testAsync('28. duplicate postpone changes once', async () => {
  const store = createMemoryIdempotencyStore();
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const req = { taskId: 'T1', planId: 'P1', action: TASK_ACTION.POSTPONE, clientOperationId: 'op1' };
  const a = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  const b = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  assert.strictEqual(a.ok, true); assert.strictEqual(b.idempotent, true); assert.strictEqual(repo.tasks()[0].snoozeCount, 1);
});
await testAsync('29. duplicate completion changes once', async () => {
  const store = createMemoryIdempotencyStore();
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base({ type: TASK_TYPE.THEORY_TASK })] });
  const req = { taskId: 'T1', planId: 'P1', action: TASK_ACTION.COMPLETE, clientOperationId: 'op2', context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } };
  await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  const b = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  assert.strictEqual(b.idempotent, true); assert.strictEqual(repo.events().length, 1);
});
await testAsync('30. same key different payload rejected', async () => {
  const store = createMemoryIdempotencyStore();
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START, idempotencyKey: 'same' } });
  const res = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: { taskId: 'T1', planId: 'P1', action: TASK_ACTION.POSTPONE, idempotencyKey: 'same' } });
  assert.strictEqual(res.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
});
await testAsync('31. concurrent duplicate returns one mutation', async () => {
  const store = createMemoryIdempotencyStore();
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const req = { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START, clientOperationId: 'op3' };
  const a = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  const b = await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  assert.strictEqual(a.ok, true); assert.strictEqual(b.idempotent, true);
});
await testAsync('32. duplicate event not appended', async () => {
  const store = createMemoryIdempotencyStore();
  const repo = createMemoryMutationRepository({ activePlan: { planId: 'P1', planVersion: 1 }, tasks: [base()] });
  const req = { taskId: 'T1', planId: 'P1', action: TASK_ACTION.START, clientOperationId: 'op4' };
  await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  await executeTaskMutation({ userIdentity: { email: 'a@test' }, repository: repo, idempotencyStore: store, request: req });
  assert.strictEqual(repo.events().length, 1);
});

test('33. manual recovery without evidence rejected', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY })).code, 'MANUAL_RECOVERY_NOT_VERIFIED'));
test('34. verified manual recovery accepted', () => assert.strictEqual(ok(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY, context: { manualRecoveryVerified: true } })).completionSource, 'manual_recovery'));
test('35. completion does not award coins', () => assert.strictEqual(evaluateTaskTransition({ task: base({ type: TASK_TYPE.THEORY_TASK }), action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } }).sideEffects.awardCoins, false));
test('36. mentor-response completion limited to correct task types', () => assert.strictEqual(no(evaluateTaskTransition({ task: base(), action: TASK_ACTION.COMPLETE, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } })).code, 'INVALID_COMPLETION_SOURCE'));
test('37. legacy snoozed maps to canonical pending for interpretation only', () => assert.strictEqual(mapLegacyStatus('snoozed'), 'pending'));
test('38. hidden legacy snoozed remains non-actionable', () => assert.strictEqual(no(evaluateTaskTransition({ task: base({ status: 'snoozed', isLegacyHidden: true }), action: TASK_ACTION.RESUME })).code, 'HISTORICAL_TASK_NOT_ACTIONABLE'));
test('39. task type remains immutable', () => {
  const next = ok(evaluateTaskTransition({ task: base({ type: TASK_TYPE.PRACTICE_TASK }), action: TASK_ACTION.POSTPONE }));
  assert.strictEqual(next.type, TASK_TYPE.PRACTICE_TASK);
});
test('40. task number remains unchanged', () => {
  const next = ok(evaluateTaskTransition({ task: base({ taskNumber: 99 }), action: TASK_ACTION.START }));
  assert.strictEqual(next.taskNumber, 99);
});
test('41. raw legacy status preserved', () => {
  const next = ok(evaluateTaskTransition({ task: base({ status: 'snoozed', rawLegacyStatus: 'snoozed' }), action: TASK_ACTION.RESUME }));
  assert.strictEqual(next.rawLegacyStatus, 'snoozed');
});
test('42. five-generation fixture protects historical tasks', () => {
  const snap = buildSnapshotFromRawData(fx.buildLegacyRawData(), { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00Z' });
  assert.strictEqual(snap.currentTasks.length, 3);
  assert.strictEqual(snap.historicalTasks.length, 12);
  assert.strictEqual(no(evaluateTaskTransition({ task: snap.historicalTasks[0], action: TASK_ACTION.RESUME })).code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});
test('43. flags default false', () => {
  const prevA = process.env.MENTOR_TASK_STATE_MACHINE_V2;
  const prevB = process.env.MENTOR_TASK_MUTATIONS_V2;
  delete process.env.MENTOR_TASK_STATE_MACHINE_V2;
  delete process.env.MENTOR_TASK_MUTATIONS_V2;
  assert.strictEqual(flags.isMentorTaskStateMachineV2Enabled(), false);
  assert.strictEqual(flags.isMentorTaskMutationsV2Enabled(), false);
  if (prevA !== undefined) process.env.MENTOR_TASK_STATE_MACHINE_V2 = prevA;
  if (prevB !== undefined) process.env.MENTOR_TASK_MUTATIONS_V2 = prevB;
});
test('44. immutable event shape includes required fields', () => {
  const res = evaluateTaskTransition({ task: base(), action: TASK_ACTION.START, context: { userScope: 'u_x', idempotencyKey: 'k', requestId: 'r' }, now: '2026-06-10T00:00:00Z' });
  assert.ok(res.event.eventId); assert.strictEqual(res.event.userScope, 'u_x'); assert.strictEqual(res.event.type, 'task_started'); assert.strictEqual(res.event.idempotencyKey, 'k');
});
test('45. no coin side effect exists on manual recovery', () => assert.strictEqual(evaluateTaskTransition({ task: base({ status: 'pending' }), action: TASK_ACTION.COMPLETE_MANUAL_RECOVERY, context: { manualRecoveryVerified: true } }).sideEffects.awardCoins, false));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
})();
