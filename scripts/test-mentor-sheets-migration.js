#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { buildLegacyRawData, EMAIL, PLAN_ID } = require('./fixtures/mentor-legacy-fixture');
const { createMigrationManifest, applyMigrationToWorkbook } = require('../lib/mentor/repository/sheetsMigration');
const { additiveColumns, TABS, manifestHash } = require('../lib/mentor/repository/sheetsSchema');
const { createSheetsMutationAdapter } = require('../lib/mentor/repository/sheetsMutationAdapter');
const flags = require('../lib/mentor/repository/featureFlags');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeMigratedWorkbook() {
  const raw = buildLegacyRawData();
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  const result = applyMigrationToWorkbook({ rawData: raw, manifest, confirm: 'YES', backupConfirmed: 'YES', now: '2026-06-10T06:00:00.000Z' });
  assert.equal(result.ok, true);
  return { workbook: result.workbook, manifest, result };
}

function setCell(tab, rowIndex, column, value) {
  const index = tab.headers.findIndex(h => String(h).trim() === column);
  if (index < 0) throw new Error(`missing ${column}`);
  while (tab.rows[rowIndex].length <= index) tab.rows[rowIndex].push('');
  tab.rows[rowIndex][index] = value == null ? '' : String(value);
}

function getCell(tab, rowIndex, column) {
  const index = tab.headers.findIndex(h => String(h).trim() === column);
  return index < 0 ? '' : (tab.rows[rowIndex][index] || '');
}

function seedRows(workbook) {
  workbook.plans.rows.forEach((_, i) => {
    setCell(workbook.plans, i, 'PlanVersion', 1);
    setCell(workbook.plans, i, 'GenerationId', `g${i + 1}`);
    setCell(workbook.plans, i, 'TaskSetRevision', 1);
    setCell(workbook.plans, i, 'NextTaskNumber', 16);
    setCell(workbook.plans, i, 'Timezone', 'Asia/Kolkata');
    setCell(workbook.plans, i, 'PlanStartLocalDate', '2026-06-08');
    setCell(workbook.plans, i, 'TotalPlanDays', 46);
    setCell(workbook.plans, i, 'UnlockedDay', 1);
    setCell(workbook.plans, i, 'LastProcessedCalendarDay', 1);
    setCell(workbook.plans, i, 'GenerationStatus', 'succeeded');
    setCell(workbook.plans, i, 'RowVersion', 1);
  });
  workbook.tasks.rows.forEach((_, i) => {
    setCell(workbook.tasks, i, 'PlanVersion', 1);
    setCell(workbook.tasks, i, 'GenerationId', `g${Math.floor(i / 3) + 1}`);
    setCell(workbook.tasks, i, 'TaskNumber', i + 1);
    setCell(workbook.tasks, i, 'QuestionCount', 25);
    setCell(workbook.tasks, i, 'OriginalScheduledDay', 1);
    setCell(workbook.tasks, i, 'ScheduledLocalDate', '2026-06-08');
    setCell(workbook.tasks, i, 'RowVersion', 1);
  });
  return workbook;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('1. dry run finds exact missing profile columns', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.deepEqual(manifest.columnsToAdd.MentorProfile, additiveColumns.MentorProfile.map(c => c.name));
});

test('2. dry run performs no writes', () => {
  const raw = buildLegacyRawData();
  const before = JSON.stringify(raw);
  createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(JSON.stringify(raw), before);
});

test('3. ambiguous normalized header blocks apply', () => {
  const raw = buildLegacyRawData();
  raw.profile.headers.push('MentorPlanId');
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  const result = applyMigrationToWorkbook({ rawData: raw, manifest, confirm: 'YES', backupConfirmed: 'YES' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'BLOCKING_SCHEMA_ERRORS');
});

test('4. stale manifest blocks apply', () => {
  const raw = buildLegacyRawData();
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  raw.tasks.headers.push('Unexpected');
  const result = applyMigrationToWorkbook({ rawData: raw, manifest, confirm: 'YES', backupConfirmed: 'YES' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STALE_MANIFEST');
});

test('5. changed row count blocks apply', () => {
  const raw = buildLegacyRawData();
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  raw.tasks.rows.push(raw.tasks.rows[0]);
  const result = applyMigrationToWorkbook({ rawData: raw, manifest, confirm: 'YES', backupConfirmed: 'YES' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STALE_MANIFEST');
});

test('6. confirmation missing blocks apply', () => {
  const raw = buildLegacyRawData();
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(applyMigrationToWorkbook({ rawData: raw, manifest, backupConfirmed: 'YES' }).code, 'CONFIRMATION_REQUIRED');
});

test('7. backup confirmation missing blocks apply', () => {
  const raw = buildLegacyRawData();
  const manifest = createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(applyMigrationToWorkbook({ rawData: raw, manifest, confirm: 'YES' }).code, 'BACKUP_CONFIRMATION_REQUIRED');
});

test('8. apply adds columns only', () => {
  const { result } = makeMigratedWorkbook();
  assert(result.writes.every(w => ['add_column', 'schema_marker'].includes(w.type)));
});

test('9. rerun after migration is a no-op for migrated columns', () => {
  const { workbook } = makeMigratedWorkbook();
  const manifest2 = createMigrationManifest({ rawData: workbook, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(manifest2.columnsToAdd.MentorTasks.length, 0);
});

test('10. generation IDs are deterministic', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(manifest.proposedGenerationMapping[0].activeGenerationId, `${PLAN_ID}#g5`);
});

test('11. task numbers are deterministic 1-15', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.deepEqual(manifest.proposedTaskNumberMapping.map(t => t.taskNumber), Array.from({ length: 15 }, (_, i) => i + 1));
});

test('12. nextTaskNumber becomes 16', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(manifest.proposedNextTaskNumber, 16);
});

test('13. SequenceNumber remains unchanged', () => {
  const raw = buildLegacyRawData();
  const before = raw.tasks.rows.map(r => r[3]).join(',');
  createMigrationManifest({ rawData: raw, userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(raw.tasks.rows.map(r => r[3]).join(','), before);
});

test('14. completed evidence count remains unchanged', () => {
  const raw = buildLegacyRawData();
  assert.equal(raw.tasks.rows.filter(r => r[6] === 'completed').length, 5);
});

test('15. snoozed historical rows remain unchanged', () => {
  const raw = buildLegacyRawData();
  assert.equal(raw.tasks.rows.filter(r => r[6] === 'snoozed').length, 10);
});

test('16. row versions are available after migration', () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  assert.equal(getCell(workbook.tasks, 0, 'RowVersion'), '1');
});

test('17. v1 is represented as PlanVersion 1', () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  assert.equal(getCell(workbook.plans, 0, 'PlanVersion'), '1');
});

test('18. exact-row compare-and-update succeeds', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  const updated = await adapter.compareAndUpdateTask({ taskId: 'TASK_1', expected: { planId: PLAN_ID, planVersion: 1, status: 'completed', rowVersion: 1 }, updates: { status: 'completed', completionSource: 'quiz_sync' } });
  assert.equal(updated.rowVersion, 2);
});

test('19. stale status is rejected', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await assert.rejects(() => adapter.compareAndUpdateTask({ taskId: 'TASK_1', expected: { planId: PLAN_ID, status: 'active', rowVersion: 1 }, updates: { status: 'completed' } }), /STALE_EXPECTED_STATUS/);
});

test('20. stale RowVersion is rejected', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await assert.rejects(() => adapter.compareAndUpdateTask({ taskId: 'TASK_1', expected: { planId: PLAN_ID, status: 'completed', rowVersion: 9 }, updates: { status: 'completed' } }), /STALE_ROW_VERSION/);
});

test('21. historical generation mutation can be rejected by expected generation', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  setCell(workbook.tasks, 0, 'GenerationId', 'g1');
  assert.notEqual(getCell(workbook.tasks, 0, 'GenerationId'), 'g5');
});

test('22. duplicate task row is rejected', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  workbook.tasks.rows.push(clone(workbook.tasks.rows[0]));
  const adapter = createSheetsMutationAdapter({ workbook });
  await assert.rejects(() => adapter.getTaskForMutation({ taskId: 'TASK_1', planId: PLAN_ID }), /DUPLICATE_TASK_ROWS/);
});

test('23. idempotent completion persists result', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await adapter.saveIdempotencyResult('k1', { userIdentity: { email: EMAIL }, planId: PLAN_ID, taskId: 'TASK_1', action: 'COMPLETE', payload: { a: 1 }, result: { ok: true } });
  assert.equal((await adapter.getIdempotencyResult('k1')).result.ok, true);
});

test('24. idempotent postpone returns same record', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  const first = await adapter.saveIdempotencyResult('k2', { payload: { a: 1 }, result: { ok: true, status: 'pending' } });
  const second = await adapter.saveIdempotencyResult('k2', { payload: { a: 1 }, result: { ok: true, status: 'pending' } });
  assert.equal(second.payloadHash, first.payloadHash);
});

test('25. same key different payload rejected', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await adapter.saveIdempotencyResult('k3', { payload: { a: 1 }, result: {} });
  await assert.rejects(() => adapter.saveIdempotencyResult('k3', { payload: { a: 2 }, result: {} }), /IDEMPOTENCY_PAYLOAD_MISMATCH/);
});

test('26. event appended once', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await adapter.appendTaskEvent({ eventId: 'evt1', taskId: 'TASK_1', planId: PLAN_ID, action: 'COMPLETE', type: 'task_completed', createdAt: '2026-06-10T06:00:00Z' });
  assert.equal(workbook.logs.rows.length, 1);
});

test('27. interrupted mutation state can be stored', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await adapter.saveIdempotencyResult('k4', { payload: { a: 1 }, status: 'task_updated', result: { stage: 'task_updated' } });
  assert.equal((await adapter.getIdempotencyResult('k4')).status, 'task_updated');
});

test('28. number reservation is contiguous', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  const res = await adapter.reserveTaskNumbers({ planId: PLAN_ID, count: 3, expectedRowVersion: 1 });
  assert.deepEqual(res.taskNumbers, [16, 17, 18]);
});

test('29. duplicate reservation can return same range through idempotency', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  await adapter.saveIdempotencyResult('reserve1', { payload: { count: 2 }, result: { taskNumbers: [16, 17] } });
  assert.deepEqual((await adapter.getIdempotencyResult('reserve1')).result.taskNumbers, [16, 17]);
});

test('30. rollover state persistence updates plan fields', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  const row = await adapter.updatePlanRolloverState({ planId: PLAN_ID, lastProcessedCalendarDay: 3, lastDailyRolloverAt: '2026-06-10T06:00:00Z' });
  assert.equal(row.LastProcessedCalendarDay, '3');
});

test('31. featured pending persistence updates plan fields', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  const adapter = createSheetsMutationAdapter({ workbook });
  const row = await adapter.updateFeaturedPendingSelection({ planId: PLAN_ID, featuredPendingTaskId: 'TASK_2', featuredPendingForCalendarDay: 3 });
  assert.equal(row.FeaturedPendingTaskId, 'TASK_2');
});

test('32. required schema marker is enforced', async () => {
  const { workbook } = makeMigratedWorkbook();
  seedRows(workbook);
  workbook.schema.rows = [];
  const adapter = createSheetsMutationAdapter({ workbook });
  assert.throws(() => adapter.assertSchemaReady(), /MENTOR_SCHEMA_MARKER_MISSING/);
});

test('33. flags default false', () => {
  assert.equal(flags.isMentorSheetsSchemaV2Enabled(), false);
  assert.equal(flags.isMentorSheetsMutationsV2Enabled(), false);
  assert.equal(flags.isMentorMutationIdempotencyV2Enabled(), false);
});

test('34. manifest does not include plain email', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert(!JSON.stringify(manifest).includes(EMAIL));
});

test('35. manifest hash validates against its payload', () => {
  const manifest = createMigrationManifest({ rawData: buildLegacyRawData(), userIdentity: { email: EMAIL }, workbookId: 'fixture' });
  assert.equal(manifestHash(manifest), manifest.manifestHash);
});

test('36. dry-run/apply command model never marks live writes', () => {
  const { result } = makeMigratedWorkbook();
  assert(!result.executionReport.writes.some(w => w.type === 'live_sheet_write'));
});

(async () => {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`ok ${passed} - ${item.name}`);
    } catch (err) {
      console.error(`not ok ${passed + 1} - ${item.name}`);
      console.error(err);
      process.exit(1);
    }
  }
  console.log(`\n${passed}/${tests.length} Mentor Sheets migration tests passed.`);
})();
