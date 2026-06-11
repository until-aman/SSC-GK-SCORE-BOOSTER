#!/usr/bin/env node
/**
 * scripts/test-mentor-route-readiness.js — Phase 9H1 route-readiness checks (NO live writes).
 *
 * Routes are ESM (no server test harness in this repo), so these are
 * source-assertion checks over the route/client files + gate-logic checks over
 * the shared CommonJS gates. They confirm: auth required, V2 gate uses the SESSION
 * email (not request body), allowlist scoping, quiz evidence required, manual
 * complete legacy, and the client sends the fields the V2 path needs.
 * Run: node scripts/test-mentor-route-readiness.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const routing = require('../lib/mentor/read/taskActionRouting');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const taskAction = read('pages/api/mentor/task-action.js');
const quizReturn = read('pages/api/mentor/quiz-return.js');
const mentorUi = read('pages/mentor.js');
const resultUi = read('pages/result.js');

let passed = 0, failed = 0; const tests = []; const test = (n, fn) => tests.push({ n, fn });

// ---- auth requirements ----
test('1. task-action requires an authenticated session (401 on no email)', () => {
  assert.ok(/getServerSession\(req, res, authOptions\)/.test(taskAction));
  assert.ok(/session\?\.user\?\.email[\s\S]{0,80}401/.test(taskAction));
});
test('2. quiz-return requires an authenticated session (401 on no email)', () => {
  assert.ok(/getServerSession\(req, res, authOptions\)/.test(quizReturn));
  assert.ok(/session\?\.user\?\.email[\s\S]{0,80}401/.test(quizReturn));
});
test('3. task-action V2 gate uses the SESSION email (not request body)', () => {
  assert.ok(/shouldRouteActionThroughV2ForUser\(actionType, \{ email: session\.user\.email \}\)/.test(taskAction));
});
test('4. quiz-return V2 gate uses the SESSION email (not request body)', () => {
  assert.ok(/shouldRouteQuizCompletionThroughV2\(\{ email: session\.user\.email \}\)/.test(quizReturn));
});

// ---- gate logic (uses scope hash, not raw email) ----
const ALICE = { email: 'alice-route@test' }; const ALICE_HASH = userScopeFromIdentity(ALICE); const BOB = { email: 'bob-route@test' };
const V2F = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_V2_MUTATION_ALLOWED_USER_HASHES'];
function withEnv(v, fn) { const p = {}; V2F.forEach(k => p[k] = process.env[k]); Object.entries(v).forEach(([k, val]) => val === undefined ? delete process.env[k] : process.env[k] = val); try { return fn(); } finally { V2F.forEach(k => p[k] === undefined ? delete process.env[k] : process.env[k] = p[k]); } }
const ON = { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' };

test('5. V2 gate keys on the user scope hash (u_…), never a full email', () => {
  assert.ok(ALICE_HASH.startsWith('u_') && !ALICE_HASH.includes('@'));
  withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    assert.strictEqual(routing.isV2MutationUserAllowed(ALICE), true);
    assert.strictEqual(routing.isV2MutationUserAllowed(ALICE.email), false); // raw email is not a hash
  });
});
test('6. non-allowlisted session routes snooze/resume/quiz-complete to legacy', () => {
  withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    ['snooze', 'resume'].forEach(a => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser(a, BOB), false));
    assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(BOB), false);
  });
});
test('7. allowlisted session routes snooze/resume to V2 + quiz-complete to V2', () => {
  withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    ['snooze', 'resume'].forEach(a => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser(a, ALICE), true));
    assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(ALICE), true);
  });
});
test('8. manual complete remains legacy even for an allowlisted session', () => {
  withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => {
    assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('complete', ALICE), false);
  });
});

// ---- payload readiness (client sends what the V2 path needs) ----
test('9. quiz-return route accepts resume? no — task-action accepts snooze/resume/complete/launch/resume', () => {
  assert.ok(/'complete', 'snooze', 'response', 'launch_practice', 'resume'/.test(taskAction));
});
test('10. client (mentor.js) sends actionType for snooze (handleLater) and resume (handleResume)', () => {
  assert.ok(/runTaskAction\(task, 'snooze'\)/.test(mentorUi));
  assert.ok(/runTaskAction\(task, 'resume'\)/.test(mentorUi));
  assert.ok(/actionType,/.test(mentorUi) && /\/api\/mentor\/task-action/.test(mentorUi));
});
test('11. client (result.js) sends quizSessionId + score evidence to quiz-return', () => {
  assert.ok(/\/api\/mentor\/quiz-return/.test(resultUi));
  ['quizSessionId', 'subject', 'topic', 'correct', 'incorrect', 'skipped', 'totalQuestions'].forEach(f => assert.ok(new RegExp(f).test(resultUi), `result.js must send ${f}`));
});
test('12. client does NOT send clientOperationId — V2 handlers derive a stable one', () => {
  assert.ok(!/clientOperationId/.test(mentorUi), 'mentor.js should not send clientOperationId (derived server-side)');
  assert.ok(!/clientOperationId/.test(resultUi), 'result.js should not send clientOperationId (derived server-side)');
});

(async () => { for (const t of tests) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${tests.length} Mentor route-readiness checks passed.`); process.exit(failed ? 1 : 0); })();
