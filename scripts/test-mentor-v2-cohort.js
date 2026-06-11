#!/usr/bin/env node
/**
 * scripts/test-mentor-v2-cohort.js — Phase 9B3 cohort allowlist + monitor tests.
 * Fake/in-memory only; no live Sheet, no mutation. Run: node scripts/test-mentor-v2-cohort.js
 */
'use strict';

const assert = require('assert');
const routing = require('../lib/mentor/read/taskActionRouting');
const flags = require('../lib/mentor/repository/featureFlags');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');
const { auditV2Mutations } = require('../lib/mentor/read/v2MutationMonitor');

const ALICE = { email: 'alice-test@example.test' };
const BOB = { email: 'bob-real@example.test' };
const ALICE_HASH = userScopeFromIdentity(ALICE);
const BOB_HASH = userScopeFromIdentity(BOB);

const ENV = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_V2_MUTATION_ALLOWED_USER_HASHES'];
function withEnv(vals, fn) {
  const prev = {}; ENV.forEach(k => prev[k] = process.env[k]);
  Object.entries(vals).forEach(([k, v]) => v === undefined ? delete process.env[k] : process.env[k] = v);
  try { return fn(); } finally { ENV.forEach(k => prev[k] === undefined ? delete process.env[k] : process.env[k] = prev[k]); }
}
const ALL_FLAGS_ON = { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' };

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

test('1. all mutation flags true but NO allowlist -> legacy (fail closed)', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: undefined }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), true); // flag+whitelist ok
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), false); // cohort blocks
  });
});
test('2. all flags true + allowlisted user + snooze -> V2', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), true);
  });
});
test('3. all flags true + NON-allowlisted user + snooze -> legacy', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', BOB), false);
  });
});
test('4. allowlist supports comma-separated hashes', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: `${BOB_HASH}, ${ALICE_HASH} ,u_other` }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), true);
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', BOB), true);
  });
});
test('5. gate works with a raw hash (no full email required)', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    assert.strictEqual(flags.isMentorV2MutationUserAllowed(ALICE_HASH), true);
    assert.strictEqual(routing.isV2MutationUserAllowed(ALICE_HASH), true);
    assert.ok(ALICE_HASH.startsWith('u_') && !ALICE_HASH.includes('@'));
  });
});
test('6. complete/response/launch_practice stay legacy even for an allowlisted user', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    // snooze + resume are V2-whitelisted; these remain legacy.
    ['complete', 'response', 'launch_practice'].forEach(a => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser(a, ALICE), false));
  });
});
test('7. malformed/empty allowlist fails closed', () => {
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: '   , ,, ' }, () => {
    assert.strictEqual(flags.getV2MutationAllowedUserHashes().length, 0);
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), false);
  });
  withEnv({ ...ALL_FLAGS_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: '' }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), false);
  });
});
test('8. monitoring audit is read-only (update/append throw, audit still runs)', async () => {
  const tabs = {
    MentorMutationRequests: [['IdempotencyKey', 'PlanId', 'TaskId', 'Action', 'Status'], ['mentor-task:u_x:P:t:POSTPONE:op', 'P', 't', 'POSTPONE', 'completed']],
    MentorTaskLogs: [['CanonicalAction', 'TaskId'], ['POSTPONE', 't']],
    MentorTasks: [['TaskId', 'PlanId', 'Status', 'PendingReason', 'RowVersion'], ['t', 'P', 'pending', 'user_postponed', '2']],
  };
  const sheets = { spreadsheets: { values: {
    async get({ range }) { const tab = range.split('!')[0]; return { data: { values: (tabs[tab] || []).map(r => [...r]) } }; },
    async update() { throw new Error('WRITE_ATTEMPTED'); },
    async append() { throw new Error('WRITE_ATTEMPTED'); },
  } } };
  const audit = await auditV2Mutations(sheets, { affectedPlanId: 'P', allowedUserHashes: ['u_x'] });
  assert.strictEqual(audit.totalMutationRequests, 1);
  assert.strictEqual(audit.postponeMutationCount, 1);
  assert.strictEqual(audit.canonicalPostponeEvents, 1);
  assert.strictEqual(audit.pendingUserPostponedTasks, 1);
  assert.strictEqual(audit.tasksRowVersionGt1, 1);
  assert.strictEqual(audit.unexpectedMutationsOutsideAllowlist, 0); // u_x is allowed
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor V2 cohort-gate + monitor tests passed.`);
  process.exit(failed ? 1 : 0);
})();
