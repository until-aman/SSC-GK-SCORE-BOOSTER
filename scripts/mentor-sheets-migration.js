#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createMigrationManifest, writeDryRunReports } = require('../lib/mentor/repository/sheetsMigration');
const { TABS } = require('../lib/mentor/repository/sheetsSchema');
const {
  computeBackfill,
  buildWritePlan,
  writeWritePlanFiles,
  executeMigration,
  createGoogleSheetsMigrationGateway,
} = require('../lib/mentor/repository/sheetsMigrationWriter');

async function readLiveTab(sheets, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tabName}!A:ZZ`,
  });
  const values = res.data?.values || [];
  return { headers: values[0] || [], rows: values.slice(1) };
}

async function readLiveWorkbook() {
  const { getSheetsClient } = require('../lib/sheets');
  const sheets = await getSheetsClient();
  const [profile, plans, tasks, logs, topicState, mutationRequests, schema] = await Promise.all([
    readLiveTab(sheets, TABS.PROFILE),
    readLiveTab(sheets, TABS.PLANS),
    readLiveTab(sheets, TABS.TASKS),
    readLiveTab(sheets, TABS.LOGS),
    readLiveTab(sheets, TABS.TOPIC_STATE),
    readLiveTab(sheets, TABS.MUTATION_REQUESTS).catch(() => ({ headers: [], rows: [] })),
    readLiveTab(sheets, TABS.SCHEMA).catch(() => ({ headers: [], rows: [] })),
  ]);
  return { profile, plans, tasks, logs, topicState, mutationRequests, schema };
}

function readFixtureWorkbook() {
  const { buildLegacyRawData, EMAIL } = require('./fixtures/mentor-legacy-fixture');
  return { rawData: buildLegacyRawData(), userIdentity: { email: EMAIL, serverNow: '2026-06-10T06:00:00.000Z' } };
}

async function getWorkbook() {
  if (process.env.MENTOR_MIGRATION_USE_FIXTURE === '1') return readFixtureWorkbook();
  const rawData = await readLiveWorkbook();
  return { rawData, userIdentity: { email: process.env.MENTOR_MIGRATION_EMAIL || '' } };
}

async function dryRun() {
  const { rawData, userIdentity } = await getWorkbook();
  const manifest = createMigrationManifest({
    rawData,
    userIdentity,
    workbookId: process.env.GOOGLE_SHEET_ID || 'fixture-workbook',
  });
  const paths = writeDryRunReports(manifest);
  console.log(JSON.stringify({
    ok: manifest.blockingErrors.length === 0,
    manifestHash: manifest.manifestHash,
    jsonPath: paths.jsonPath,
    mdPath: paths.mdPath,
    blockingErrors: manifest.blockingErrors,
    warnings: manifest.warnings,
  }, null, 2));
  if (manifest.blockingErrors.length) process.exitCode = 2;
}

function loadManifest() {
  const manifestPath = process.env.MENTOR_MIGRATION_MANIFEST;
  if (!manifestPath) throw new Error('MENTOR_MIGRATION_MANIFEST is required.');
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
}

// Read-only: emit the Phase 6B live write plan files from the manifest + a live read.
async function plan() {
  const manifest = loadManifest();
  const { rawData } = await getWorkbook();
  const computed = computeBackfill(rawData, { email: process.env.MENTOR_MIGRATION_EMAIL || '' });
  const writePlan = buildWritePlan({ manifest, computed });
  const paths = writeWritePlanFiles(writePlan);
  console.log(JSON.stringify({
    ok: true,
    mode: 'write-plan',
    manifestHash: manifest.manifestHash,
    tabsToCreate: writePlan.tabsToCreate.map(t => t.tab),
    columnsToAppend: writePlan.columnsToAppend.map(c => `${c.tab}:${c.add.length}`),
    backfillRowCount: writePlan.backfillRowCount,
    jsonPath: paths.jsonPath,
    mdPath: paths.mdPath,
    liveWriteExecuted: false,
  }, null, 2));
}

async function apply() {
  if (process.env.CONFIRM_MENTOR_SHEET_MIGRATION !== 'YES') throw new Error('CONFIRM_MENTOR_SHEET_MIGRATION=YES is required.');
  if (process.env.MENTOR_BACKUP_CONFIRMED !== 'YES') throw new Error('MENTOR_BACKUP_CONFIRMED=YES is required.');
  const manifest = loadManifest();

  // Phase 6B gate: live writes stay BLOCKED unless MENTOR_LIVE_WRITER_CONFIRMED=YES.
  if (process.env.MENTOR_LIVE_WRITER_CONFIRMED !== 'YES') {
    console.log(JSON.stringify({
      ok: false,
      blocked: true,
      code: 'LIVE_WRITER_NOT_CONFIRMED',
      manifestHash: manifest.manifestHash,
      note: 'Live writer is blocked. Set MENTOR_LIVE_WRITER_CONFIRMED=YES (with CONFIRM + BACKUP + manifest + backup note) to enable live writes. No Sheet write performed.',
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  // Fully gated live writer. Reaches here only when every gate is present.
  const { getSheetsClient } = require('../lib/sheets');
  const sheets = await getSheetsClient();
  const gateway = createGoogleSheetsMigrationGateway(sheets, process.env.GOOGLE_SHEET_ID);
  const result = await executeMigration({ gateway, manifest, env: process.env });
  console.log(JSON.stringify({
    ok: result.ok,
    status: result.status,
    code: result.code || null,
    tabsCreated: result.tabsCreated,
    columnsAdded: result.columnsAdded,
    rowsBackfilled: result.rowsBackfilled,
    finalSchemaMarker: result.finalSchemaMarker,
    reportFiles: result.reportFiles,
    rollback: result.rollback || null,
  }, null, 2));
  if (!result.ok) process.exitCode = 2;
}

(async () => {
  let mode = 'dry-run';
  if (process.argv.includes('--apply') || process.env.MENTOR_MIGRATION_MODE === 'apply') mode = 'apply';
  else if (process.argv.includes('--plan') || process.env.MENTOR_MIGRATION_MODE === 'plan') mode = 'plan';
  if (mode === 'apply') await apply();
  else if (mode === 'plan') await plan();
  else await dryRun();
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
