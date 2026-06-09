#!/usr/bin/env node
/**
 * scripts/test-sheets-inflight-dedup.js
 *
 * Deterministic harness for the REAL server-side Sheets read dedup
 * (lib/server/sheetsReadDedup.js). No test framework / new dependency.
 *
 * Run:  node scripts/test-sheets-inflight-dedup.js
 */

'use strict';

const { dedupeSheetsReads, buildSheetsReadKey, __getSheetsInflightCount } = require('../lib/server/sheetsReadDedup');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Capture dev `[apidiag] {kind:'sheet-dedup'}` events for Test 10 ───────────
const events = [];
const realDebug = console.debug;
console.debug = (line) => {
  if (typeof line === 'string' && line.includes('"kind":"sheet-dedup"')) {
    try { events.push(JSON.parse(line.replace('[apidiag] ', '')).event); } catch {}
  }
};

// ── Fake googleapis sheets client whose values.* count physical invocations ──
function makeClient() {
  const counts = { get: 0, batchGet: 0, append: 0, update: 0 };
  let mode = { delay: 15, fail: false };
  const mk = (name) => async function (params) {
    counts[name] += 1;
    await delay(mode.delay);
    if (mode.fail) throw new Error('sheets boom');
    return { data: { values: [[name, JSON.stringify(params)]] } };
  };
  const client = {
    spreadsheets: { values: { get: mk('get'), batchGet: mk('batchGet'), append: mk('append'), update: mk('update') } },
  };
  return { client, counts, setMode: (m) => Object.assign(mode, m) };
}

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; realDebug(`  PASS  ${name}`); }
  else { failed += 1; realDebug(`  FAIL  ${name}`); }
}

const SID = 'sheet_A';

async function run() {
  // Test 1 — identical values.get → one physical call
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    const midWasOne = [];
    const p1 = c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' });
    const p2 = c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' });
    midWasOne.push(__getSheetsInflightCount());
    await Promise.all([p1, p2]);
    check('T1 physical get called once', counts.get === 1);
    check('T1 one in-flight entry mid-flight', midWasOne[0] === 1);
    check('T1 registry cleared after', __getSheetsInflightCount() === 0);
  }

  // Test 2 — different ranges → two physical calls
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' }),
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Scores!A:O' }),
    ]);
    check('T2 different ranges → two calls', counts.get === 2);
  }

  // Test 3 — different spreadsheetId → two physical calls
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.get({ spreadsheetId: 'A', range: 'Users!A:Z' }),
      c.spreadsheets.values.get({ spreadsheetId: 'B', range: 'Users!A:Z' }),
    ]);
    check('T3 different spreadsheetId → two calls', counts.get === 2);
  }

  // Test 4 — different render options → two physical calls
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z', valueRenderOption: 'FORMATTED_VALUE' }),
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z', valueRenderOption: 'UNFORMATTED_VALUE' }),
    ]);
    check('T4 different renderOption → two calls', counts.get === 2);
  }

  // Test 5 — identical batchGet → one physical call
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.batchGet({ spreadsheetId: SID, ranges: ['Users!A:Z', 'Scores!A:O'] }),
      c.spreadsheets.values.batchGet({ spreadsheetId: SID, ranges: ['Users!A:Z', 'Scores!A:O'] }),
    ]);
    check('T5 identical batchGet → one call', counts.batchGet === 1);
  }

  // Test 6 — batch range order differs → two physical calls (not normalized)
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.batchGet({ spreadsheetId: SID, ranges: ['Users!A:Z', 'Scores!A:O'] }),
      c.spreadsheets.values.batchGet({ spreadsheetId: SID, ranges: ['Scores!A:O', 'Users!A:Z'] }),
    ]);
    check('T6 different range order → two calls', counts.batchGet === 2);
  }

  // Test 7 — failure cleanup + retry
  {
    const { client, counts, setMode } = makeClient();
    setMode({ fail: true });
    const c = dedupeSheetsReads(client);
    let r1 = false, r2 = false;
    await Promise.all([
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' }).catch(() => { r1 = true; }),
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' }).catch(() => { r2 = true; }),
    ]);
    check('T7 both callers reject', r1 && r2);
    check('T7 one physical failed call', counts.get === 1);
    check('T7 registry cleared after failure', __getSheetsInflightCount() === 0);
    setMode({ fail: false });
    await c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' });
    check('T7 retry creates new physical call', counts.get === 2);
  }

  // Test 8 — sequential identical reads → two physical calls (not a cache)
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' });
    await c.spreadsheets.values.get({ spreadsheetId: SID, range: 'Users!A:Z' });
    check('T8 sequential identical → two calls (no cache)', counts.get === 2);
  }

  // Test 9 — writes excluded (append/update each invoke physical, never deduped)
  {
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.append({ spreadsheetId: SID, range: 'Scores!A:O', requestBody: { values: [[1]] } }),
      c.spreadsheets.values.append({ spreadsheetId: SID, range: 'Scores!A:O', requestBody: { values: [[1]] } }),
      c.spreadsheets.values.update({ spreadsheetId: SID, range: 'Users!B2', requestBody: { values: [[1]] } }),
    ]);
    check('T9 writes never deduped (append x2)', counts.append === 2);
    check('T9 update invoked physically', counts.update === 1);
  }

  // Test 10 — diagnostics: one new + ≥1 reused + one cleared, one physical read
  {
    events.length = 0;
    const { client, counts } = makeClient();
    const c = dedupeSheetsReads(client);
    await Promise.all([
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'QuizSessions!A:ZZ' }),
      c.spreadsheets.values.get({ spreadsheetId: SID, range: 'QuizSessions!A:ZZ' }),
    ]);
    const n = events.filter((e) => e === 'sheet-inflight-new').length;
    const r = events.filter((e) => e === 'sheet-inflight-reused').length;
    const cl = events.filter((e) => e === 'sheet-inflight-cleared').length;
    check('T10 one physical read', counts.get === 1);
    check('T10 one inflight-new', n === 1);
    check('T10 at least one inflight-reused', r >= 1);
    check('T10 one inflight-cleared', cl === 1);
  }

  // Key sanity
  check('Key: get distinguishes range', buildSheetsReadKey('values.get', { spreadsheetId: SID, range: 'A!1:1' }) !== buildSheetsReadKey('values.get', { spreadsheetId: SID, range: 'B!1:1' }));
  check('Key: batchGet preserves order', buildSheetsReadKey('values.batchGet', { spreadsheetId: SID, ranges: ['A', 'B'] }) !== buildSheetsReadKey('values.batchGet', { spreadsheetId: SID, ranges: ['B', 'A'] }));

  realDebug(`\n${passed} passed, ${failed} failed`);
  console.debug = realDebug;
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.debug = realDebug; console.error(e); process.exit(1); });
