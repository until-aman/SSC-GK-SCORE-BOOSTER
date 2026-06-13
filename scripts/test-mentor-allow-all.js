#!/usr/bin/env node
/**
 * scripts/test-mentor-allow-all.js — Phase 9K global allow-all gate tests (NO live Sheet).
 * Run: node scripts/test-mentor-allow-all.js
 */
'use strict';

const assert = require('assert');
const routing = require('../lib/mentor/read/taskActionRouting');
const flags = require('../lib/mentor/repository/featureFlags');
const { evaluateMonitorAlerts } = require('../lib/mentor/read/v2MutationMonitor');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');

const ALICE = { email: 'alice-9k@test' };
const ALICE_HASH = userScopeFromIdentity(ALICE);
const BOB = { email: 'bob-9k@test' };

const ENV_KEYS = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_V2_MUTATION_ALLOWED_USER_HASHES', 'MENTOR_V2_MUTATION_ALLOW_ALL'];
function withEnv(v, fn) {
  const prev = {}; ENV_KEYS.forEach(k => prev[k] = process.env[k]);
  Object.entries(v).forEach(([k, val]) => (val === undefined ? delete process.env[k] : (process.env[k] = val)));
  try { return fn(); } finally { ENV_KEYS.forEach(k => (prev[k] === undefined ? delete process.env[k] : (process.env[k] = prev[k]))); }
}
const MUT_ON = { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' };

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('1. allowAll false + empty allowlist -> legacy', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: '', MENTOR_V2_MUTATION_ALLOW_ALL: 'false' }, () => {
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), false);
  assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(ALICE), false);
}));
test('2. allowAll false + allowlisted user -> V2', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', ALICE), true);
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('resume', ALICE), true);
  assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(ALICE), true);
}));
test('3. allowAll false + non-allowlisted user -> legacy', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', BOB), false);
  assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(BOB), false);
}));
test('4. allowAll true + any authenticated user -> V2 (allowlist bypassed)', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: '', MENTOR_V2_MUTATION_ALLOW_ALL: 'true' }, () => {
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('snooze', BOB), true);
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('resume', ALICE), true);
}));
test('5. allowAll true + manual complete -> legacy', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOW_ALL: 'true' }, () => {
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('complete', BOB), false);
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('response', BOB), false);
  assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('launch_practice', BOB), false);
}));
test('6. allowAll true + quiz-return -> V2 for any authenticated user', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOW_ALL: 'true' }, () => {
  assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(BOB), true);
}));
test('7. unset allowAll behaves false; only exact "true" enables it', () => {
  withEnv({ MENTOR_V2_MUTATION_ALLOW_ALL: undefined }, () => assert.strictEqual(flags.isMentorV2MutationAllowAllEnabled(), false));
  ['TRUE', 'True', '1', 'yes', '', 'false'].forEach(v => withEnv({ MENTOR_V2_MUTATION_ALLOW_ALL: v }, () => assert.strictEqual(flags.isMentorV2MutationAllowAllEnabled(), false, `value "${v}" must NOT enable`)));
  withEnv({ MENTOR_V2_MUTATION_ALLOW_ALL: 'true' }, () => assert.strictEqual(flags.isMentorV2MutationAllowAllEnabled(), true));
});
test('8. allowAll true requires an authenticated identity (empty scope -> still false)', () => withEnv({ ...MUT_ON, MENTOR_V2_MUTATION_ALLOW_ALL: 'true' }, () => {
  assert.strictEqual(flags.isMentorV2MutationUserAllowed(''), false);
  assert.strictEqual(flags.isMentorV2MutationUserAllowed('u_anyhash'), true);
}));
test('9. monitor emits WARNING (not CRITICAL) when allowAll=true; suppresses outside-allowlist CRITICAL', () => {
  const base = { unexpectedMutationsOutsideAllowlist: 5, duplicateIdempotencyKeys: 0, failedMutationRequests: 0, affectedRealPlanStatus: { completed: 5, snoozed: 10 } };
  const r = evaluateMonitorAlerts(base, { flags: { MENTOR_V2_MUTATION_ALLOW_ALL: true, MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false } });
  assert.strictEqual(r.status, 'WARNING');
  assert.ok(r.alerts.some(a => a.code === 'ALLOW_ALL_ENABLED'));
  assert.ok(!r.alerts.some(a => a.code === 'UNEXPECTED_OUTSIDE_ALLOWLIST'));
  // with allowAll OFF, the same outside count is CRITICAL
  const off = evaluateMonitorAlerts(base, { flags: { MENTOR_V2_MUTATION_ALLOW_ALL: false } });
  assert.strictEqual(off.status, 'CRITICAL');
  assert.ok(off.alerts.some(a => a.code === 'UNEXPECTED_OUTSIDE_ALLOWLIST'));
});
test('10. rollover/pending flags stay CRITICAL even when allowAll=true', () => {
  // Phase 10E: ROLLOVER_WRITE_ENABLED was replaced by stage-aware codes. A rollover
  // flag ON with no rollover cohort is still CRITICAL (DAILY_ROLLOVER_FLAG_NO_COHORT).
  const base = { affectedRealPlanStatus: { completed: 5, snoozed: 10 } };
  const r = evaluateMonitorAlerts(base, { flags: { MENTOR_V2_MUTATION_ALLOW_ALL: true, MENTOR_DAILY_ROLLOVER_V2: true } });
  assert.strictEqual(r.status, 'CRITICAL');
  assert.ok(r.alerts.some(a => a.code === 'DAILY_ROLLOVER_FLAG_NO_COHORT'));
  const p = evaluateMonitorAlerts(base, { flags: { MENTOR_V2_MUTATION_ALLOW_ALL: true, MENTOR_PENDING_LIFECYCLE_V2: true } });
  assert.strictEqual(p.status, 'CRITICAL');
  assert.ok(p.alerts.some(a => a.code === 'PENDING_LIFECYCLE_WRITE_ENABLED'));
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor allow-all gate tests passed.`); process.exit(failed ? 1 : 0); })();
