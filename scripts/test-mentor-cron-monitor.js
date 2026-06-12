#!/usr/bin/env node
/**
 * scripts/test-mentor-cron-monitor.js — Phase 9M2 Vercel-cron monitor tests (NO live Sheet).
 * Unit-tests the pure cron helpers + static-asserts the route/vercel.json/workflow.
 * Run: node scripts/test-mentor-cron-monitor.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { cronMonitorResult, isValidCronRequest } = require('../lib/mentor/read/v2MutationMonitor');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const route = read('pages/api/internal/mentor-v2-monitor.js');
const vercelJson = JSON.parse(read('vercel.json'));
const wf = read('.github/workflows/mentor-v2-monitor.yml');

const REAL = { completed: 5, snoozed: 10 };
let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

// ---- auth ----
test('1. rejects missing/invalid authorization (fail-closed)', () => {
  assert.strictEqual(isValidCronRequest(undefined, 'sec'), false);
  assert.strictEqual(isValidCronRequest('Bearer wrong', 'sec'), false);
  assert.strictEqual(isValidCronRequest('sec', 'sec'), false);          // missing "Bearer "
  assert.strictEqual(isValidCronRequest('Bearer sec', ''), false);      // no CRON_SECRET => fail closed
  assert.strictEqual(isValidCronRequest('Bearer sec', undefined), false);
});
test('2. allows valid cron auth (Bearer <CRON_SECRET>)', () => {
  assert.strictEqual(isValidCronRequest('Bearer s3cr3t', 's3cr3t'), true);
});

// ---- result mapping ----
test('3. WARNING / ALLOW_ALL_ENABLED -> HTTP 200', () => {
  const audit = { unexpectedMutationsOutsideAllowlist: 0, duplicateIdempotencyKeys: 0, failedMutationRequests: 0, affectedRealPlanStatus: REAL, affectedRealPlanId: 'MP_1780920810055' };
  const { httpStatus, body } = cronMonitorResult(audit, { MENTOR_V2_MUTATION_ALLOW_ALL: true, MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false });
  assert.strictEqual(httpStatus, 200);
  assert.strictEqual(body.alertStatus, 'WARNING');
  assert.ok(body.alerts.some(a => a.code === 'ALLOW_ALL_ENABLED'));
  assert.strictEqual(body.mutationAllowAll, true);
});
test('4. OK -> HTTP 200', () => {
  const audit = { unexpectedMutationsOutsideAllowlist: 0, duplicateIdempotencyKeys: 0, failedMutationRequests: 0, affectedRealPlanStatus: REAL };
  const { httpStatus, body } = cronMonitorResult(audit, { MENTOR_V2_MUTATION_ALLOW_ALL: false, MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false });
  assert.strictEqual(httpStatus, 200);
  assert.strictEqual(body.alertStatus, 'OK');
});
test('5. CRITICAL -> HTTP 500 (duplicate keys / real-plan drift / rollover flag)', () => {
  const dup = cronMonitorResult({ duplicateIdempotencyKeys: 1, affectedRealPlanStatus: REAL }, {});
  assert.strictEqual(dup.httpStatus, 500);
  assert.strictEqual(dup.body.alertStatus, 'CRITICAL');
  const drift = cronMonitorResult({ duplicateIdempotencyKeys: 0, affectedRealPlanStatus: { completed: 6, snoozed: 9 } }, {});
  assert.strictEqual(drift.httpStatus, 500);
  const rollover = cronMonitorResult({ affectedRealPlanStatus: REAL }, { MENTOR_DAILY_ROLLOVER_V2: true });
  assert.strictEqual(rollover.httpStatus, 500);
});
test('6. response body exposes the required fields', () => {
  const { body } = cronMonitorResult({ unexpectedMutationsOutsideAllowlist: 0, duplicateIdempotencyKeys: 0, failedMutationRequests: 0, affectedRealPlanStatus: REAL }, { MENTOR_V2_MUTATION_ALLOW_ALL: true, MENTOR_DAILY_ROLLOVER_V2: false, MENTOR_PENDING_LIFECYCLE_V2: false });
  ['alertStatus', 'alerts', 'mutationAllowAll', 'duplicateIdempotencyKeys', 'failedMutationRequests', 'unexpectedMutationsOutsideAllowlist', 'affectedRealPlanStatus', 'flags'].forEach(k => assert.ok(k in body, `missing ${k}`));
  assert.ok('MENTOR_DAILY_ROLLOVER_V2' in body.flags && 'MENTOR_PENDING_LIFECYCLE_V2' in body.flags);
});

// ---- route is read-only + secured (static) ----
test('7. route is auth-gated on Bearer CRON_SECRET and returns 401 on failure', () => {
  assert.ok(/isValidCronRequest\(req\.headers\.authorization,\s*process\.env\.CRON_SECRET\)/.test(route));
  assert.ok(/status\(401\)/.test(route));
});
test('8. route calls ONLY the read-only monitor (auditV2Mutations) — no write methods', () => {
  assert.ok(/auditV2Mutations\(/.test(route));
  ['updateMentorTaskStatus', 'appendMentorTaskLog', 'upsertStudentTopicState', 'executeTaskMutation', '.update(', '.append(', 'createSheetsMutationRepository', 'compareAndUpdateTask'].forEach(bad => assert.ok(!route.includes(bad), `route must not reference write method "${bad}"`));
});

// ---- vercel.json cron config ----
test('9. vercel.json has the cron path + once-per-day schedule (Hobby-compatible)', () => {
  assert.ok(Array.isArray(vercelJson.crons));
  const c = vercelJson.crons.find(x => x.path === '/api/internal/mentor-v2-monitor');
  assert.ok(c, 'cron entry for the monitor path missing');
  // Hobby plan rejects > once/day at deploy time, so the schedule must be daily.
  assert.strictEqual(c.schedule, '0 6 * * *');
  assert.ok(!/\*\/\d/.test(c.schedule), 'schedule must not contain a step (*/N) — that would exceed once/day on Hobby');
});

// ---- GitHub workflow manual-only ----
test('10. GitHub workflow schedule removed (manual-only)', () => {
  assert.ok(!/^\s*schedule:/m.test(wf), 'GitHub workflow must have no schedule');
  assert.ok(/workflow_dispatch/.test(wf), 'GitHub workflow keeps manual dispatch');
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor cron-monitor tests passed.`); process.exit(failed ? 1 : 0); })();
