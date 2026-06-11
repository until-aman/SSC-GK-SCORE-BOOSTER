#!/usr/bin/env node
/**
 * scripts/test-mentor-sheets-writer.js — Phase 6B fake-live writer tests.
 *
 * Exercises the real writer (lib/mentor/repository/sheetsMigrationWriter.js)
 * against a FAKE in-memory gateway built from the anonymised legacy fixture.
 * No live Google Sheet is touched. Run: node scripts/test-mentor-sheets-writer.js
 */
'use strict';

const assert = require('assert');
const os = require('os');
const fsmod = require('fs');
const pathmod = require('path');
const { buildLegacyRawData, EMAIL } = require('./fixtures/mentor-legacy-fixture');
const { createMigrationManifest } = require('../lib/mentor/repository/sheetsMigration');
const { additiveForTab, TABS } = require('../lib/mentor/repository/sheetsSchema');
const { buildNormalizedHeaderMap } = require('../lib/mentor/repository/headerNormalizer');
const W = require('../lib/mentor/repository/sheetsMigrationWriter');

let passed = 0, failed = 0;
function test(name, fn) {
  Promise.resolve().then(fn).then(
    () => { passed++; console.log(`  ok   ${name}`); },
    e => { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  );
}

// Build a "live-shaped" workbook (5 core tabs) + matching LIVE manifest (non-fixture id).
function liveWorkbook() {
  const raw = buildLegacyRawData();
  return {
    [TABS.PROFILE]: raw.profile,
    [TABS.PLANS]: raw.plans,
    [TABS.TASKS]: raw.tasks,
    [TABS.LOGS]: { headers: ['LogId', 'TaskId', 'PlanId', 'Email', 'UserId', 'ActionType', 'ActionValue', 'CreatedAt', 'SourcePage', 'QuizSessionId', 'Notes'], rows: [] },
    [TABS.TOPIC_STATE]: raw.topicState,
  };
}
function rawFromWorkbook(wb) {
  return {
    profile: wb[TABS.PROFILE] || { headers: [], rows: [] },
    plans: wb[TABS.PLANS] || { headers: [], rows: [] },
    tasks: wb[TABS.TASKS] || { headers: [], rows: [] },
    logs: wb[TABS.LOGS] || { headers: [], rows: [] },
    topicState: wb[TABS.TOPIC_STATE] || { headers: [], rows: [] },
    mutationRequests: wb[TABS.MUTATION_REQUESTS] || { headers: [], rows: [] },
    schema: wb[TABS.SCHEMA] || { headers: [], rows: [] },
  };
}
function liveManifest(wb) {
  return createMigrationManifest({ rawData: rawFromWorkbook(wb), userIdentity: { email: EMAIL }, workbookId: 'live-sheet-id-xyz', inspectedAt: '2026-06-11T00:13:40.310Z' });
}
const GOOD_ENV = {
  CONFIRM_MENTOR_SHEET_MIGRATION: 'YES',
  MENTOR_BACKUP_CONFIRMED: 'YES',
  MENTOR_LIVE_WRITER_CONFIRMED: 'YES',
  MENTOR_MIGRATION_MANIFEST: 'docs/mentor-architecture/generated/PHASE_6_MIGRATION_DRY_RUN.json',
  MENTOR_BACKUP_NOTE: 'backup_2026-06-11.xlsx',
};
const headersOf = (gw, tab) => gw.snapshot()[tab] ? gw.snapshot()[tab].headers : [];
// Tests write artifacts to a throwaway temp dir so they never clobber the real
// live artifacts under docs/mentor-architecture/generated/.
const TMP_ARTIFACTS = fsmod.mkdtempSync(pathmod.join(os.tmpdir(), 'mentor-6b-'));
async function runGood(wb, envOverrides = {}, opts = {}) {
  const gw = W.createFakeMigrationGateway(wb, opts);
  const res = await W.executeMigration({ gateway: gw, manifest: liveManifest(wb), env: { ...GOOD_ENV, ...envOverrides }, now: '2026-06-11T06:00:00.000Z', artifactsDir: TMP_ARTIFACTS });
  return { gw, res };
}

console.log('\nPhase 6B — Mentor Sheets live writer tests\n');

// 1-4 gates
test('1. missing MENTOR_LIVE_WRITER_CONFIRMED blocks writes', async () => {
  const wb = liveWorkbook();
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest: liveManifest(wb), env: { ...GOOD_ENV, MENTOR_LIVE_WRITER_CONFIRMED: '' } });
  assert.strictEqual(res.status, 'aborted');
  assert.strictEqual(res.code, 'LIVE_WRITER_NOT_CONFIRMED');
  assert.strictEqual(gw.ops.length, 0);
});
test('2. missing backup confirmation blocks writes', async () => {
  const wb = liveWorkbook();
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest: liveManifest(wb), env: { ...GOOD_ENV, MENTOR_BACKUP_CONFIRMED: '' } });
  assert.strictEqual(res.code, 'BACKUP_CONFIRMATION_REQUIRED');
  assert.strictEqual(gw.ops.length, 0);
});
test('3. missing backup note blocks writes', async () => {
  const wb = liveWorkbook();
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest: liveManifest(wb), env: { ...GOOD_ENV, MENTOR_BACKUP_NOTE: '' } });
  assert.strictEqual(res.code, 'BACKUP_NOTE_REQUIRED');
  assert.strictEqual(gw.ops.length, 0);
});
test('4. fixture manifest cannot be used for live write', async () => {
  const wb = liveWorkbook();
  const fixtureManifest = createMigrationManifest({ rawData: rawFromWorkbook(wb), workbookId: 'fixture-workbook' });
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest: fixtureManifest, env: GOOD_ENV });
  assert.strictEqual(res.code, 'FIXTURE_MANIFEST_REJECTED');
  assert.strictEqual(gw.ops.length, 0);
});

// 5-7 manifest lock
test('5. stale row count blocks writes', async () => {
  const wb = liveWorkbook();
  const manifest = liveManifest(wb);
  wb[TABS.TASKS].rows.push(['TASK_X', 'MP_TEST_REUSED', EMAIL, '1', '1', 'practice_task', 'snoozed', 'X', 'Y', 'Z', '2026-06-08T14:01:22.132Z', '']); // row count changed
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest, env: GOOD_ENV });
  assert.strictEqual(res.code, 'STALE_MANIFEST');
  assert.strictEqual(gw.ops.length, 0);
});
test('6. stale header fingerprint blocks writes', async () => {
  const wb = liveWorkbook();
  const manifest = liveManifest(wb);
  wb[TABS.PLANS].headers = [...wb[TABS.PLANS].headers, 'SomeNewLegacyCol']; // header changed
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest, env: GOOD_ENV });
  assert.strictEqual(res.code, 'STALE_MANIFEST');
});
test('7. ambiguous header blocks writes', async () => {
  const wb = liveWorkbook();
  wb[TABS.PLANS].headers = [...wb[TABS.PLANS].headers, 'PlanId\r']; // duplicate normalized PlanId
  const manifest = liveManifest(wb); // manifest built with the ambiguity present
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest, env: GOOD_ENV });
  assert.ok(['AMBIGUOUS_HEADERS_APPEARED', 'BLOCKING_SCHEMA_ERRORS'].includes(res.code), res.code);
  assert.strictEqual(gw.ops.length, 0);
});

// 8 write plan generated
test('8. write plan generated before writes (files + structure)', async () => {
  const wb = liveWorkbook();
  const computed = W.computeBackfill(rawFromWorkbook(wb), { email: EMAIL, now: '2026-06-11T06:00:00.000Z' });
  const plan = W.buildWritePlan({ manifest: liveManifest(wb), computed });
  assert.deepStrictEqual(plan.batches, ['CREATE_TABS', 'APPEND_COLUMNS', 'BACKFILL_ROWS', 'SCHEMA_MARKER']);
  assert.strictEqual(plan.tabsToCreate.length, 2);
  assert.strictEqual(plan.backfillRowCount, 20); // 5 plan rows + 15 task rows
  assert.ok(plan.rollbackNotes.join(' ').includes('.xlsx backup'));
});

// 9-13 happy path writes
test('9. tabs created additively (MentorMutationRequests + MentorSchema)', async () => {
  const { gw, res } = await runGood(liveWorkbook());
  assert.strictEqual(res.status, 'completed', JSON.stringify(res.errors));
  assert.deepStrictEqual(res.tabsCreated.sort(), [TABS.MUTATION_REQUESTS, TABS.SCHEMA].sort());
  assert.ok(headersOf(gw, TABS.SCHEMA).includes('SchemaName'));
});
test('10. columns appended additively to all four tabs', async () => {
  const { res } = await runGood(liveWorkbook());
  assert.ok((res.columnsAdded[TABS.TASKS] || []).includes('TaskNumber'));
  assert.ok((res.columnsAdded[TABS.PLANS] || []).includes('GenerationId'));
});
test('11. no existing column duplicated; original headers preserved as prefix', async () => {
  const wb = liveWorkbook();
  const origPlanHeaders = [...wb[TABS.PLANS].headers];
  const { gw } = await runGood(wb);
  const after = headersOf(gw, TABS.PLANS);
  origPlanHeaders.forEach((h, i) => assert.strictEqual(after[i], h));
  assert.strictEqual(buildNormalizedHeaderMap(after).hasAmbiguous, false);
});
test('12. row backfill deterministic (TaskNumber 1..15, GenerationId set)', async () => {
  const { gw } = await runGood(liveWorkbook());
  const t = gw.snapshot()[TABS.TASKS];
  const m = buildNormalizedHeaderMap(t.headers);
  const nums = t.rows.map(r => Number(r[m.index.TaskNumber])).sort((a, b) => a - b);
  assert.deepStrictEqual(nums, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.ok(t.rows.every(r => String(r[m.index.GenerationId]).includes('#g')));
});
test('13. QuestionCount not fabricated (blank where not type-derivable)', async () => {
  // build a workbook where one task is a coverage_check (null question count)
  const wb = liveWorkbook();
  const tm = buildNormalizedHeaderMap(wb[TABS.TASKS].headers);
  wb[TABS.TASKS].rows[0][tm.index.Type] = 'coverage_check';
  const manifest = liveManifest(wb);
  const gw = W.createFakeMigrationGateway(wb);
  const res = await W.executeMigration({ gateway: gw, manifest, env: GOOD_ENV, now: '2026-06-11T06:00:00.000Z', artifactsDir: TMP_ARTIFACTS });
  assert.strictEqual(res.status, 'completed', JSON.stringify(res.errors));
  const t = gw.snapshot()[TABS.TASKS];
  const m = buildNormalizedHeaderMap(t.headers);
  assert.strictEqual(String(t.rows[0][m.index.QuestionCount] || ''), ''); // coverage_check -> blank
});

// 14-16 preservation
test('14. completed rows preserved (status + CompletedAt unchanged)', async () => {
  const wb = liveWorkbook();
  const before = JSON.parse(JSON.stringify(wb[TABS.TASKS]));
  const { gw } = await runGood(wb);
  const after = gw.snapshot()[TABS.TASKS];
  const bm = buildNormalizedHeaderMap(before.headers), am = buildNormalizedHeaderMap(after.headers);
  before.rows.forEach((r, i) => {
    assert.strictEqual(after.rows[i][am.index.Status], r[bm.index.Status]);
    assert.strictEqual(after.rows[i][am.index.CompletedAt], r[bm.index.CompletedAt]);
  });
});
test('15. snoozed rows remain historical/hidden (Status snoozed; no PendingReason written)', async () => {
  const { gw } = await runGood(liveWorkbook());
  const t = gw.snapshot()[TABS.TASKS];
  const m = buildNormalizedHeaderMap(t.headers);
  const snoozed = t.rows.filter(r => r[m.index.Status] === 'snoozed');
  assert.strictEqual(snoozed.length, 10);
  snoozed.forEach(r => assert.strictEqual(String(r[m.index.PendingReason] || ''), '')); // not moved into pending
});
test('16. StudentTopicState unchanged (no columns added, rows identical)', async () => {
  const wb = liveWorkbook();
  const before = JSON.parse(JSON.stringify(wb[TABS.TOPIC_STATE]));
  const { gw } = await runGood(wb);
  assert.deepStrictEqual(gw.snapshot()[TABS.TOPIC_STATE], before);
});

// 17-18 marker + verification
test('17. schema marker written LAST (after all other batches)', async () => {
  const { gw, res } = await runGood(liveWorkbook());
  assert.strictEqual(res.finalSchemaMarker, true);
  const ops = gw.ops;
  const markerIdx = ops.findIndex(o => o.op === 'appendRow' && o.title === TABS.SCHEMA);
  const lastBackfill = ops.map((o, i) => (o.op === 'setRowCells' ? i : -1)).filter(i => i >= 0).pop();
  assert.ok(markerIdx > lastBackfill, 'marker must come after backfills');
});
test('18. verification runs after every batch (4 verified batches)', async () => {
  const { res } = await runGood(liveWorkbook());
  assert.strictEqual(res.batches.length, 4);
  assert.ok(res.batches.every(b => b.verified && b.ok));
});

// 19 partial failure stops execution
test('19. partial failure stops execution + emits failure (no schema marker)', async () => {
  // inject a header-write that does not persist for MentorTasks append -> verification fails
  const wb = liveWorkbook();
  const gw = W.createFakeMigrationGateway(wb, { failOn: { [`setHeaders:${TABS.TASKS}`]: true } });
  const res = await W.executeMigration({ gateway: gw, manifest: liveManifest(wb), env: GOOD_ENV, now: '2026-06-11T06:00:00.000Z', artifactsDir: TMP_ARTIFACTS });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.status, 'failed');
  assert.ok(res.rollback.includes('.xlsx backup'));
  // SCHEMA_MARKER batch must NOT have run
  assert.ok(!res.batches.find(b => b.name === 'SCHEMA_MARKER'));
  assert.strictEqual(res.finalSchemaMarker, false);
});

// 20-21 no-op rerun
test('20. no-op rerun works (second run detects fully applied, writes nothing)', async () => {
  const wb = liveWorkbook();
  const first = await runGood(wb); // applies in place (gw holds mutated wb state internally)
  assert.strictEqual(first.res.status, 'completed');
  // Rebuild a workbook reflecting the applied state from the first gateway snapshot
  const applied = first.gw.snapshot();
  const gw2 = W.createFakeMigrationGateway(applied);
  // manifest must match the applied state's ORIGINAL fingerprints? Re-lock uses fingerprints of
  // the now-extended headers; so build a manifest from the applied state for the rerun.
  const res2 = await W.executeMigration({ gateway: gw2, manifest: liveManifest(applied), env: GOOD_ENV, now: '2026-06-11T07:00:00.000Z', artifactsDir: TMP_ARTIFACTS });
  assert.strictEqual(res2.status, 'noop');
  assert.strictEqual(gw2.ops.length, 0);
});
test('21. existing schema marker verified on rerun', async () => {
  const wb = liveWorkbook();
  const first = await runGood(wb);
  const applied = first.gw.snapshot();
  const res2 = await W.executeMigration({ gateway: W.createFakeMigrationGateway(applied), manifest: liveManifest(applied), env: GOOD_ENV, artifactsDir: TMP_ARTIFACTS });
  assert.ok(res2.noopItems.some(n => /marker/i.test(n)));
});

// 22-23 reports
test('22. execution report generated with required fields', async () => {
  const { res } = await runGood(liveWorkbook());
  assert.ok(res.reportFiles && res.reportFiles.jsonPath);
  assert.strictEqual(typeof res.manifestHash, 'string');
  assert.ok(res.finalRowCounts && typeof res.finalRowCounts.MentorTasks === 'number');
  assert.strictEqual(res.flagsRemainFalse, true);
});
test('23. no plain emails / secrets in report or write plan', async () => {
  const wb = liveWorkbook();
  const { res } = await runGood(wb);
  const planJson = fsmod.readFileSync(res.writePlanFiles.jsonPath, 'utf8');
  const execJson = fsmod.readFileSync(res.reportFiles.jsonPath, 'utf8');
  [planJson, execJson].forEach(txt => {
    assert.ok(!txt.includes('@'), 'no @ (email) allowed in generated artifacts');
    assert.ok(!/private_key|BEGIN PRIVATE/.test(txt), 'no secret material');
  });
  // backup note must be hashed, not raw
  assert.ok(!execJson.includes('backup_2026-06-11.xlsx'));
});

setTimeout(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}, 500);
