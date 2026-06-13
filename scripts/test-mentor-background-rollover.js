#!/usr/bin/env node
/**
 * scripts/test-mentor-background-rollover.js — Phase 10F2 background-execution tests.
 * Flag parser + runBackgroundTask + plan-route dual-mode structural checks. No live Sheet,
 * no Vercel runtime (waitUntil is injected). Run: node scripts/test-mentor-background-rollover.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { runBackgroundTask } = require('../lib/mentor/util/backgroundTask');
const flags = require('../lib/mentor/repository/featureFlags');

const planSrc = () => fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'mentor', 'plan.js'), 'utf8');
const ENV = ['MENTOR_DAILY_ROLLOVER_BACKGROUND'];
function withEnv(v, fn) { const p = {}; ENV.forEach(k => p[k] = process.env[k]); Object.entries(v).forEach(([k, val]) => val === undefined ? delete process.env[k] : process.env[k] = val); try { return fn(); } finally { ENV.forEach(k => p[k] === undefined ? delete process.env[k] : process.env[k] = p[k]); } }

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('1. background flag is true ONLY for exact "true"; fail-closed otherwise', () => {
  withEnv({ MENTOR_DAILY_ROLLOVER_BACKGROUND: 'true' }, () => assert.strictEqual(flags.isMentorDailyRolloverBackgroundEnabled(), true));
  ['TRUE', 'True', '1', 'yes', '', 'false', undefined].forEach(val =>
    withEnv({ MENTOR_DAILY_ROLLOVER_BACKGROUND: val }, () => assert.strictEqual(flags.isMentorDailyRolloverBackgroundEnabled(), false, `value "${val}" must be false`)));
});
test('2. runBackgroundTask registers the promise with an injected waitUntil', async () => {
  let registered = null;
  const r = runBackgroundTask(Promise.resolve('ok'), 'unit', { waitUntil: p => { registered = p; } });
  assert.strictEqual(r.mode, 'waitUntil');
  assert.ok(registered && typeof registered.then === 'function', 'a promise was registered with waitUntil');
  await registered; // resolves
});
test('3. runBackgroundTask falls back to fire-and-forget when waitUntil is unavailable', () => {
  const r = runBackgroundTask(Promise.resolve('ok'), 'unit', { waitUntil: null });
  assert.strictEqual(r.mode, 'fire-and-forget');
});
test('4. a rejected background task is logged and NEVER thrown / never rejects', async () => {
  let registered = null; const orig = console.error; let logged = false; console.error = () => { logged = true; };
  try {
    const r = runBackgroundTask(Promise.reject(new Error('boom')), 'unit', { waitUntil: p => { registered = p; } });
    assert.strictEqual(r.mode, 'waitUntil');
    await registered; // must RESOLVE (handled), not reject
  } finally { console.error = orig; }
  assert.ok(logged, 'the failure was logged');
});
test('5. plan.js: BACKGROUND mode registers the write via runBackgroundTask (not awaited)', () => {
  assert.ok(/if \(isMentorDailyRolloverBackgroundEnabled\(\)\)\s*\{[\s\S]{0,400}runBackgroundTask\(runRollover\(\)/.test(planSrc()), 'background branch must runBackgroundTask(runRollover())');
});
test('6. plan.js: AWAITED fallback still awaits the write when background flag is off', () => {
  assert.ok(/\}\s*else\s*\{[\s\S]{0,300}await runRollover\(\)/.test(planSrc()), 'else branch must await runRollover()');
});
test('7. plan.js: write stays gated by isMentorDailyRolloverUserAllowed', () => {
  assert.ok(/if \(isMentorDailyRolloverUserAllowed\(userScope\)\)/.test(planSrc()));
});
test('8. plan.js: write failure is logged (threw handler), never a 500', () => {
  assert.ok(/\[mentor-rollover-write\] threw/.test(planSrc()));
  assert.ok(/backgroundMode/.test(planSrc()), 'log distinguishes awaited vs waitUntil');
});
test('9. plan.js: maxDuration config present for the plan route', () => {
  assert.ok(/export const config = \{ maxDuration: 60 \}/.test(planSrc()));
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor background-rollover tests passed.`); process.exit(failed ? 1 : 0); })();
