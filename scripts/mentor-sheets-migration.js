#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { createMigrationManifest, writeDryRunReports, applyMigrationToWorkbook } = require('../lib/mentor/repository/sheetsMigration');
const { TABS } = require('../lib/mentor/repository/sheetsSchema');

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

async function apply() {
  if (process.env.CONFIRM_MENTOR_SHEET_MIGRATION !== 'YES') throw new Error('CONFIRM_MENTOR_SHEET_MIGRATION=YES is required.');
  if (process.env.MENTOR_BACKUP_CONFIRMED !== 'YES') throw new Error('MENTOR_BACKUP_CONFIRMED=YES is required.');
  const manifestPath = process.env.MENTOR_MIGRATION_MANIFEST;
  if (!manifestPath) throw new Error('MENTOR_MIGRATION_MANIFEST is required.');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  const { rawData } = await getWorkbook();
  const result = applyMigrationToWorkbook({
    rawData,
    manifest,
    confirm: process.env.CONFIRM_MENTOR_SHEET_MIGRATION,
    backupConfirmed: process.env.MENTOR_BACKUP_CONFIRMED,
  });
  if (!result.ok) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 2;
    return;
  }
  // Phase 6 deliberately does not write live Sheets. This command prints the
  // verified execution plan; a future phase can connect this to values.update.
  console.log(JSON.stringify({
    ok: true,
    dryApplyOnly: true,
    manifestHash: manifest.manifestHash,
    writes: result.writes,
    note: 'No live Google Sheet write was performed by Phase 6 apply tooling.',
  }, null, 2));
}

(async () => {
  const mode = process.argv.includes('--apply') || process.env.MENTOR_MIGRATION_MODE === 'apply' ? 'apply' : 'dry-run';
  if (mode === 'apply') await apply();
  else await dryRun();
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
