#!/usr/bin/env node
/**
 * scripts/test-mentor-sheets-retry.js — Phase 10D-FIX-2 transient-write retry/backoff.
 * Unit tests for isRetriableSheetsError + withRetry. No live Sheet, no real delays
 * (sleep is injected as a no-op). Run: node scripts/test-mentor-sheets-retry.js
 */
'use strict';

const assert = require('assert');
const { isRetriableSheetsError, withRetry } = require('../lib/mentor/repository/sheetsMutationRepository');

const noSleep = async () => {};
let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('1. transient HTTP statuses are retriable (429/500/502/503/504)', () => {
  [429, 500, 502, 503, 504].forEach(s => {
    assert.ok(isRetriableSheetsError({ code: s }), `code ${s}`);
    assert.ok(isRetriableSheetsError({ response: { status: s } }), `response.status ${s}`);
  });
});
test('2. network errors are retriable (code or message)', () => {
  assert.ok(isRetriableSheetsError({ code: 'ECONNRESET' }));
  assert.ok(isRetriableSheetsError({ code: 'ETIMEDOUT' }));
  assert.ok(isRetriableSheetsError(new Error('socket hang up')));
  assert.ok(isRetriableSheetsError(new Error('request to https://sheets.googleapis.com failed')));
});
test('3. non-transient HTTP (400/401/403/404) is NOT retriable', () => {
  [400, 401, 403, 404].forEach(s => assert.ok(!isRetriableSheetsError({ code: s }), `code ${s}`));
});
test('4. deterministic domain errors are NEVER retriable', () => {
  ['STALE_ROW_VERSION', 'STALE_EXPECTED_STATUS', 'TASK_NOT_FOUND', 'DUPLICATE_TASK_ROWS', 'PLAN_ROW_AMBIGUOUS', 'PLAN_ROW_NO_ACTIVE']
    .forEach(m => assert.ok(!isRetriableSheetsError(new Error(m)), m));
  // even a 429-shaped error carrying a domain message must NOT retry (domain wins)
  assert.ok(!isRetriableSheetsError(Object.assign(new Error('STALE_ROW_VERSION'), { code: 429 })));
});
test('5. null / generic errors are not retriable', () => {
  assert.ok(!isRetriableSheetsError(null));
  assert.ok(!isRetriableSheetsError(new Error('totally unrelated')));
});
test('6. withRetry: succeeds after 2 transient failures (3rd attempt wins)', async () => {
  let calls = 0;
  const r = await withRetry(async () => { calls += 1; if (calls < 3) throw { code: 503 }; return 'ok'; }, { sleep: noSleep });
  assert.strictEqual(r, 'ok');
  assert.strictEqual(calls, 3);
});
test('7. withRetry: does NOT retry a non-retriable error (1 attempt, rethrows)', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls += 1; throw new Error('STALE_ROW_VERSION'); }, { sleep: noSleep }),
    /STALE_ROW_VERSION/
  );
  assert.strictEqual(calls, 1, 'must not retry deterministic errors');
});
test('8. withRetry: exhausts bounded attempts then throws the last error', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls += 1; throw Object.assign(new Error('rate limited'), { code: 429 }); }, { attempts: 4, sleep: noSleep }),
    /rate limited/
  );
  assert.strictEqual(calls, 4, 'exactly `attempts` tries');
});
test('9. withRetry: returns immediately on first success (no retries)', async () => {
  let calls = 0;
  const r = await withRetry(async () => { calls += 1; return 42; }, { sleep: noSleep });
  assert.strictEqual(r, 42);
  assert.strictEqual(calls, 1);
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor sheets-retry tests passed.`); process.exit(failed ? 1 : 0); })();
