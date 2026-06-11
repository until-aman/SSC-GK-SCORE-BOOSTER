// lib/mentor/repository/sheetsMigration.js - Phase 6 dry-run/apply helpers.
// Pure over supplied workbook data unless a caller passes a real Sheets reader.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  TABS,
  SCHEMA_VERSION,
  currentColumns,
  additiveColumns,
  normalizeHeader,
  inspectTabHeaders,
  manifestHash,
  fingerprintHeaders,
} = require('./sheetsSchema');
const { buildSnapshotFromRawData } = require('./mentorRepository');

const GENERATED_DIR = path.join(process.cwd(), 'docs', 'mentor-architecture', 'generated');

function hashId(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function normalizeRows(rows = []) {
  return (rows || []).filter(row => (row || []).some(cell => String(cell || '').trim() !== ''));
}

function tabData(rawData, tabName) {
  const key = {
    [TABS.PROFILE]: 'profile',
    [TABS.PLANS]: 'plans',
    [TABS.TASKS]: 'tasks',
    [TABS.LOGS]: 'logs',
    [TABS.TOPIC_STATE]: 'topicState',
    [TABS.MUTATION_REQUESTS]: 'mutationRequests',
    [TABS.SCHEMA]: 'schema',
  }[tabName];
  return rawData[key] || { headers: [], rows: [] };
}

function buildProposedBackfill(rawData, userIdentity = {}) {
  const snapshot = buildSnapshotFromRawData(rawData, userIdentity);
  const tasks = [...(snapshot.currentTasks || []), ...(snapshot.historicalTasks || [])]
    .sort((a, b) => Number(a.legacyTaskNumber || 0) - Number(b.legacyTaskNumber || 0));
  const taskNumberMapping = tasks.map(task => ({
    taskId: task.taskId,
    planId: task.planId,
    generationId: task.generationBatchId || '',
    taskNumber: Number(task.legacyTaskNumber || 0),
    sequenceNumber: Number(task.sequenceNumber || 0),
    status: task.status,
  }));
  const generationMapping = snapshot.activeGeneration ? [{
    planId: snapshot.activeGeneration.planId,
    activeGenerationId: snapshot.activeGeneration.generationBatchId,
    currentGenerationOrdinal: snapshot.activeGeneration.ordinal,
    currentGenerationTaskCount: (snapshot.currentTasks || []).length,
  }] : [];
  return {
    snapshot,
    generationMapping,
    taskNumberMapping,
    nextTaskNumber: snapshot.nextTaskNumber || (taskNumberMapping.length + 1),
  };
}

function createMigrationManifest({ rawData, userIdentity = {}, workbookId = 'unknown-workbook', inspectedAt = new Date().toISOString() } = {}) {
  const tabNames = [TABS.PROFILE, TABS.PLANS, TABS.TASKS, TABS.LOGS, TABS.TOPIC_STATE, TABS.MUTATION_REQUESTS, TABS.SCHEMA];
  const tabReports = {};
  const warnings = [];
  const blockingErrors = [];
  tabNames.forEach(tabName => {
    const data = tabData(rawData || {}, tabName);
    const report = inspectTabHeaders(tabName, data.headers || []);
    tabReports[tabName] = {
      tabName,
      exists: Boolean((data.headers || []).length),
      rowCount: normalizeRows(data.rows || []).length,
      originalHeaderFingerprint: report.headerFingerprint,
      physicalHeaders: report.physicalHeaders,
      normalizedHeaders: report.normalizedHeaders,
      columnsToAdd: report.missingAdditiveColumns.map(col => col.name),
      requiredColumnsToAdd: report.missingAdditiveColumns.filter(col => col.class === 'required_before_mutation_activation').map(col => col.name),
      warnings: report.unknownExistingColumns.map(col => `Unknown existing column: ${col}`),
      blockingErrors: report.duplicateCanonicalHeaders.map(col => `Ambiguous normalized header: ${col}`),
    };
    if (!report.physicalHeaders.length && [TABS.MUTATION_REQUESTS, TABS.SCHEMA].includes(tabName)) {
      tabReports[tabName].columnsToAdd = (additiveColumns[tabName] || []).map(col => col.name);
      tabReports[tabName].requiredColumnsToAdd = tabReports[tabName].columnsToAdd;
    }
    warnings.push(...tabReports[tabName].warnings.map(msg => `${tabName}: ${msg}`));
    blockingErrors.push(...tabReports[tabName].blockingErrors.map(msg => `${tabName}: ${msg}`));
  });
  const proposed = buildProposedBackfill(rawData || {}, userIdentity);
  const rowsToBackfill = {
    MentorPlans: proposed.generationMapping.length,
    MentorTasks: proposed.taskNumberMapping.length,
  };
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    workbookIdHash: hashId(workbookId),
    inspectionTimestamp: inspectedAt,
    tabNames,
    tabs: tabReports,
    originalRowCounts: Object.fromEntries(Object.entries(tabReports).map(([tab, report]) => [tab, report.rowCount])),
    originalHeaderFingerprints: Object.fromEntries(Object.entries(tabReports).map(([tab, report]) => [tab, report.originalHeaderFingerprint])),
    columnsToAdd: Object.fromEntries(Object.entries(tabReports).map(([tab, report]) => [tab, report.columnsToAdd])),
    rowsToBackfill,
    proposedGenerationMapping: proposed.generationMapping,
    proposedTaskNumberMapping: proposed.taskNumberMapping,
    proposedNextTaskNumber: proposed.nextTaskNumber,
    warnings,
    blockingErrors,
  };
  manifest.manifestHash = manifestHash(manifest);
  return manifest;
}

function ensureGeneratedDir() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function manifestToMarkdown(manifest) {
  const lines = [
    '# Phase 6 Migration Dry Run',
    '',
    `Schema version: ${manifest.schemaVersion}`,
    `Inspection timestamp: ${manifest.inspectionTimestamp}`,
    `Workbook id hash: ${manifest.workbookIdHash}`,
    `Manifest hash: ${manifest.manifestHash}`,
    '',
    '## Columns To Add',
  ];
  Object.entries(manifest.columnsToAdd).forEach(([tab, cols]) => {
    lines.push(`- ${tab}: ${cols.length ? cols.join(', ') : 'None'}`);
  });
  lines.push('', '## Row Counts');
  Object.entries(manifest.originalRowCounts).forEach(([tab, count]) => lines.push(`- ${tab}: ${count}`));
  lines.push('', '## Backfill Summary');
  lines.push(`- MentorPlans rows to backfill: ${manifest.rowsToBackfill.MentorPlans}`);
  lines.push(`- MentorTasks rows to backfill: ${manifest.rowsToBackfill.MentorTasks}`);
  lines.push(`- Proposed next task number: ${manifest.proposedNextTaskNumber}`);
  lines.push('', '## Blocking Errors');
  lines.push(...(manifest.blockingErrors.length ? manifest.blockingErrors.map(e => `- ${e}`) : ['- None']));
  lines.push('', '## Warnings');
  lines.push(...(manifest.warnings.length ? manifest.warnings.map(w => `- ${w}`) : ['- None']));
  return `${lines.join('\n')}\n`;
}

function writeDryRunReports(manifest) {
  ensureGeneratedDir();
  const jsonPath = path.join(GENERATED_DIR, 'PHASE_6_MIGRATION_DRY_RUN.json');
  const mdPath = path.join(GENERATED_DIR, 'PHASE_6_MIGRATION_DRY_RUN.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(mdPath, manifestToMarkdown(manifest));
  return { jsonPath, mdPath };
}

function verifyApplyPreconditions({ rawData, manifest, confirm, backupConfirmed } = {}) {
  if (confirm !== 'YES') return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  if (backupConfirmed !== 'YES') return { ok: false, code: 'BACKUP_CONFIRMATION_REQUIRED' };
  if (!manifest?.manifestHash) return { ok: false, code: 'MANIFEST_REQUIRED' };
  if (manifestHash(manifest) !== manifest.manifestHash) return { ok: false, code: 'MANIFEST_HASH_INVALID' };
  const current = createMigrationManifest({ rawData, workbookId: manifest.workbookIdHash, inspectedAt: manifest.inspectionTimestamp });
  const staleTabs = [];
  Object.keys(manifest.originalHeaderFingerprints || {}).forEach(tab => {
    if (manifest.originalHeaderFingerprints[tab] !== current.originalHeaderFingerprints[tab]) staleTabs.push(`${tab}:headers`);
  });
  Object.keys(manifest.originalRowCounts || {}).forEach(tab => {
    if (Number(manifest.originalRowCounts[tab]) !== Number(current.originalRowCounts[tab])) staleTabs.push(`${tab}:rowCount`);
  });
  if (staleTabs.length) return { ok: false, code: 'STALE_MANIFEST', staleTabs };
  if ((manifest.blockingErrors || []).length) return { ok: false, code: 'BLOCKING_SCHEMA_ERRORS', errors: manifest.blockingErrors };
  return { ok: true, currentManifest: current };
}

function applyMigrationToWorkbook({ rawData, manifest, confirm, backupConfirmed, now = new Date().toISOString() } = {}) {
  const pre = verifyApplyPreconditions({ rawData, manifest, confirm, backupConfirmed });
  if (!pre.ok) return pre;
  const next = JSON.parse(JSON.stringify(rawData || {}));
  const writes = [];
  Object.entries(manifest.columnsToAdd || {}).forEach(([tabName, columns]) => {
    if (!columns.length) return;
    const key = {
      [TABS.PROFILE]: 'profile',
      [TABS.PLANS]: 'plans',
      [TABS.TASKS]: 'tasks',
      [TABS.LOGS]: 'logs',
      [TABS.TOPIC_STATE]: 'topicState',
      [TABS.MUTATION_REQUESTS]: 'mutationRequests',
      [TABS.SCHEMA]: 'schema',
    }[tabName];
    next[key] = next[key] || { headers: [], rows: [] };
    const existing = new Set((next[key].headers || []).map(normalizeHeader));
    columns.forEach(col => {
      if (!existing.has(col)) {
        next[key].headers.push(col);
        existing.add(col);
        writes.push({ tabName, type: 'add_column', column: col });
      }
    });
  });
  if (!next.schema?.rows?.length) {
    next.schema = next.schema || { headers: ['SchemaName', 'SchemaVersion', 'AppliedAt', 'ManifestHash'], rows: [] };
    next.schema.rows.push(['mentor', '2', now, manifest.manifestHash]);
    writes.push({ tabName: TABS.SCHEMA, type: 'schema_marker', schemaVersion: '2' });
  }
  return { ok: true, workbook: next, writes, executionReport: { appliedAt: now, manifestHash: manifest.manifestHash, writes } };
}

module.exports = {
  GENERATED_DIR,
  createMigrationManifest,
  writeDryRunReports,
  manifestToMarkdown,
  verifyApplyPreconditions,
  applyMigrationToWorkbook,
};
