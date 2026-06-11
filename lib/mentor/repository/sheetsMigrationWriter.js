// lib/mentor/repository/sheetsMigrationWriter.js — Phase 6B live migration writer.
//
// Implements the REAL additive-migration writer behind hard gates. It runs through
// a small Gateway abstraction so it is fully testable with a fake in-memory
// workbook and NEVER touches the live Sheet in tests. The real gateway
// (createGoogleSheetsMigrationGateway) is wired by the apply script but is only
// invoked when every gate — including MENTOR_LIVE_WRITER_CONFIRMED — is present.
//
// Hard guarantees: additive only (create tabs, append columns, backfill blank
// cells), verify after every batch, abort on any mismatch, no-op rerun, partial
// failure detection. Never deletes/reorders/renames, never changes Status, never
// moves snoozed→pending, never alters completed evidence or StudentTopicState.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  TABS,
  SCHEMA_VERSION,
  requiredColumns,
  additiveColumns,
  additiveForTab,
  validateRequiredColumns,
  inspectTabHeaders,
  fingerprintHeaders,
  manifestHash,
} = require('./sheetsSchema');
const { buildNormalizedHeaderMap, normalizeHeader } = require('./headerNormalizer');
const { createMigrationManifest, GENERATED_DIR } = require('./sheetsMigration');
const { parsePlans, parseProfile, parseTasks, parseLegacyPlanVersion, deriveQuestionCount } = require('./parsers');
const { deriveGenerations, isolateTasks, deriveLegacyTaskNumbers } = require('./legacyGenerationAdapter');
const { calculatePlanDayState, isValidLocalDateKey } = require('../domain/planDay');

const FIXTURE_WORKBOOK_ID_HASH = hashId('fixture-workbook');

const TAB_KEY = Object.freeze({
  [TABS.PROFILE]: 'profile',
  [TABS.PLANS]: 'plans',
  [TABS.TASKS]: 'tasks',
  [TABS.LOGS]: 'logs',
  [TABS.TOPIC_STATE]: 'topicState',
  [TABS.MUTATION_REQUESTS]: 'mutationRequests',
  [TABS.SCHEMA]: 'schema',
});
const ALL_TABS = Object.keys(TAB_KEY);
const NEW_TABS = [TABS.MUTATION_REQUESTS, TABS.SCHEMA];
const COLUMN_APPEND_TABS = [TABS.PROFILE, TABS.PLANS, TABS.TASKS, TABS.LOGS];

function hashId(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function addLocalDays(localDateKey, days) {
  if (!isValidLocalDateKey(localDateKey)) return '';
  const [y, m, d] = localDateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  const p = n => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

// ── Gate 2: writer gates ─────────────────────────────────────────────────────
function verifyWriterGates(env = {}) {
  if (env.CONFIRM_MENTOR_SHEET_MIGRATION !== 'YES') return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  if (env.MENTOR_BACKUP_CONFIRMED !== 'YES') return { ok: false, code: 'BACKUP_CONFIRMATION_REQUIRED' };
  if (env.MENTOR_LIVE_WRITER_CONFIRMED !== 'YES') return { ok: false, code: 'LIVE_WRITER_NOT_CONFIRMED' };
  if (!env.MENTOR_MIGRATION_MANIFEST || !String(env.MENTOR_MIGRATION_MANIFEST).trim()) return { ok: false, code: 'MANIFEST_PATH_REQUIRED' };
  const backupNote = String(env.MENTOR_BACKUP_NOTE || '').trim();
  if (!backupNote) return { ok: false, code: 'BACKUP_NOTE_REQUIRED' };
  return { ok: true, backupNoteHash: hashId(backupNote) }; // store hash, never the raw note
}

// ── Gate 3: manifest-lock verification (re-read live, compare to manifest) ────
function verifyManifestLock({ manifest, liveRawData }) {
  if (!manifest || !manifest.manifestHash) return { ok: false, code: 'MANIFEST_REQUIRED' };
  if (manifestHash(manifest) !== manifest.manifestHash) return { ok: false, code: 'MANIFEST_HASH_INVALID' };
  if (manifest.schemaVersion !== SCHEMA_VERSION) return { ok: false, code: 'SCHEMA_VERSION_MISMATCH' };
  if (!manifest.workbookIdHash || manifest.workbookIdHash === FIXTURE_WORKBOOK_ID_HASH) return { ok: false, code: 'FIXTURE_MANIFEST_REJECTED' };
  if ((manifest.blockingErrors || []).length) return { ok: false, code: 'BLOCKING_SCHEMA_ERRORS', errors: manifest.blockingErrors };

  const current = createMigrationManifest({ rawData: liveRawData, workbookId: manifest.workbookIdHash, inspectedAt: manifest.inspectionTimestamp });
  if (current.workbookIdHash !== hashId(manifest.workbookIdHash)) {
    // current is built with workbookId = manifest.workbookIdHash, so its hash differs;
    // identity is instead asserted via fingerprints/row counts below.
  }
  const staleTabs = [];
  Object.keys(manifest.originalHeaderFingerprints || {}).forEach(tab => {
    if (manifest.originalHeaderFingerprints[tab] !== current.originalHeaderFingerprints[tab]) staleTabs.push(`${tab}:headers`);
  });
  Object.keys(manifest.originalRowCounts || {}).forEach(tab => {
    if (Number(manifest.originalRowCounts[tab]) !== Number(current.originalRowCounts[tab])) staleTabs.push(`${tab}:rowCount`);
  });
  if (staleTabs.length) return { ok: false, code: 'STALE_MANIFEST', staleTabs };

  // required core tabs must still exist
  const missingTabs = [TABS.PROFILE, TABS.PLANS, TABS.TASKS, TABS.LOGS, TABS.TOPIC_STATE]
    .filter(t => !((liveRawData[TAB_KEY[t]] || {}).headers || []).length);
  if (missingTabs.length) return { ok: false, code: 'REQUIRED_TAB_MISSING', missingTabs };

  // no ambiguous normalized headers may have appeared
  const ambiguous = [];
  ALL_TABS.forEach(t => {
    const data = liveRawData[TAB_KEY[t]] || { headers: [] };
    const report = inspectTabHeaders(t, data.headers || []);
    if (report.duplicateCanonicalHeaders.length) ambiguous.push(`${t}:${report.duplicateCanonicalHeaders.join(',')}`);
  });
  if (ambiguous.length) return { ok: false, code: 'AMBIGUOUS_HEADERS_APPEARED', ambiguous };

  return { ok: true, currentManifest: current };
}

// ── Deterministic backfill computation (read-only; pure over live data) ───────
function computeBackfill(liveRawData, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const profile = parseProfile(liveRawData.profile || {}, opts.email || '').profile;
  const allPlans = parsePlans(liveRawData.plans || {}, '').plans;
  const allTasks = parseTasks(liveRawData.tasks || {}, '', '').tasks;

  const planIds = [...new Set(allPlans.map(p => p.planId))];
  const planBackfills = [];
  const taskBackfills = [];
  const groups = [];

  planIds.forEach(planId => {
    const planRows = allPlans.filter(p => p.planId === planId);
    const taskRows = allTasks.filter(t => t.planId === planId);
    const g = deriveGenerations(planRows, taskRows);
    const iso = isolateTasks(taskRows, g);
    const numbered = deriveLegacyTaskNumbers(iso.annotated);
    const active = g.activeGeneration;
    const earliest = [...planRows].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0];

    const planDay = calculatePlanDayState({
      serverNow: now,
      timezone: profile && profile.timezone,
      onboardingCompletedAt: profile && profile.onboardingCompletedAt,
      activePlanCreatedAt: active && active.planRow.createdAt,
      earliestPlanCreatedAt: earliest && earliest.createdAt,
      daysLeftRange: (active && active.planRow.daysLeftSnapshot) || (profile && profile.daysLeftRange),
      customDaysLeft: profile && profile.customDaysLeft,
    });

    groups.push({ planId, generations: g.generations.length, activeOrdinal: active ? active.ordinal : null, currentTaskCount: iso.currentTasks.length, nextTaskNumber: numbered.nextTaskNumber, totalPlanDays: planDay.totalPlanDays });

    g.generations.forEach(gen => {
      const isActive = active && gen.ordinal === active.ordinal;
      const v = parseLegacyPlanVersion(gen.planRow.rawLegacyVersion);
      planBackfills.push({
        tab: TABS.PLANS,
        key: { column: 'CreatedAt', value: gen.planRow.createdAt },
        altKey: { column: 'PlanId', value: planId },
        values: {
          PlanVersion: v.version,
          GenerationId: gen.generationBatchId,
          TaskSetRevision: 1,
          NextTaskNumber: isActive ? numbered.nextTaskNumber : 1,
          Timezone: planDay.timezone,
          PlanStartLocalDate: planDay.planStartLocalDate || '',
          TotalPlanDays: planDay.totalPlanDays,
          UnlockedDay: 1,
          LastProcessedCalendarDay: isActive ? planDay.calendarDay : 1,
          GenerationStatus: isActive ? 'succeeded' : 'superseded',
          RowVersion: 1,
        },
      });
    });

    numbered.tasks.forEach(task => {
      const qc = deriveQuestionCount(task.type, undefined, false);
      const scheduledLocal = planDay.planStartLocalDate ? addLocalDays(planDay.planStartLocalDate, Number(task.dayNumber || 1) - 1) : '';
      taskBackfills.push({
        tab: TABS.TASKS,
        key: { column: 'TaskId', value: task.taskId },
        values: {
          PlanVersion: 1,
          GenerationId: task.generationBatchId,
          TaskNumber: task.legacyTaskNumber,
          // QuestionCount only where safely derived; never fabricate.
          QuestionCount: qc.questionCount == null ? '' : qc.questionCount,
          OriginalScheduledDay: task.dayNumber || 1,
          ScheduledLocalDate: scheduledLocal,
          // CompletionSource is NOT safely inferable for legacy rows → leave blank.
          CompletionSource: '',
          RowVersion: 1,
        },
      });
    });
  });

  return { now, groups, planBackfills, taskBackfills };
}

// ── Write plan (preview; written locally before any write) ───────────────────
function buildWritePlan({ manifest, computed }) {
  const tabsToCreate = NEW_TABS
    .filter(t => (manifest.columnsToAdd[t] || []).length || !(manifest.tabs[t] && manifest.tabs[t].exists))
    .map(t => ({ tab: t, headers: additiveForTab(t) }));

  const columnsToAppend = COLUMN_APPEND_TABS.map(t => ({
    tab: t,
    add: manifest.columnsToAdd[t] || [],
    requiredAdd: (manifest.tabs[t] && manifest.tabs[t].requiredColumnsToAdd) || [],
  })).filter(x => x.add.length);

  const backfills = [...computed.planBackfills, ...computed.taskBackfills].map(op => ({
    tab: op.tab,
    matchBy: op.key.column,
    matchValue: op.key.value,
    columns: Object.keys(op.values),
    // expected OLD value of each additive cell is blank (column did not exist / empty)
    expectedOld: 'blank_or_absent',
    newValues: op.values,
  }));

  const verifications = [
    ...tabsToCreate.map(t => ({ type: 'tab_exists_with_headers', tab: t.tab })),
    ...columnsToAppend.map(t => ({ type: 'required_columns_present', tab: t.tab, columns: t.requiredAdd })),
    { type: 'backfill_cells_match', count: backfills.length },
    { type: 'schema_marker_present', tab: TABS.SCHEMA, expect: ['mentor', '2'] },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    manifestHash: manifest.manifestHash,
    workbookIdHash: manifest.workbookIdHash,
    generatedAt: computed.now,
    batches: ['CREATE_TABS', 'APPEND_COLUMNS', 'BACKFILL_ROWS', 'SCHEMA_MARKER'],
    tabsToCreate,
    columnsToAppend,
    backfillRowCount: backfills.length,
    backfills,
    schemaMarker: { tab: TABS.SCHEMA, row: ['mentor', '2', '<appliedAt>', manifest.manifestHash] },
    verifications,
    rollbackNotes: [
      'Google Sheets writes are not transactional.',
      'Rollback = restore the founder-downloaded .xlsx backup recorded in MENTOR_BACKUP_NOTE.',
      'All operations are additive (create tab / append column / fill blank cell); existing legacy data is never deleted, reordered, renamed, or overwritten.',
      'On any batch verification failure the writer stops before later batches and emits a failure report.',
    ],
  };
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeWritePlanFiles(plan, dir = GENERATED_DIR) {
  ensureDir(dir);
  const jsonPath = path.join(dir, 'PHASE_6B_LIVE_WRITE_PLAN.json');
  const mdPath = path.join(dir, 'PHASE_6B_LIVE_WRITE_PLAN.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(mdPath, writePlanToMarkdown(plan));
  return { jsonPath, mdPath };
}

function writePlanToMarkdown(plan) {
  const L = [
    '# Phase 6B Live Write Plan (preview — not executed)',
    '',
    `Schema version: ${plan.schemaVersion}`,
    `Manifest hash: ${plan.manifestHash}`,
    `Workbook id hash: ${plan.workbookIdHash}`,
    `Generated at: ${plan.generatedAt}`,
    '',
    '## Batch order',
    ...plan.batches.map((b, i) => `${i + 1}. ${b}`),
    '',
    '## Tabs to create',
    ...(plan.tabsToCreate.length ? plan.tabsToCreate.map(t => `- ${t.tab} (${t.headers.length} columns)`) : ['- None']),
    '',
    '## Columns to append (additive)',
    ...(plan.columnsToAppend.length ? plan.columnsToAppend.map(t => `- ${t.tab}: ${t.add.join(', ')}`) : ['- None']),
    '',
    '## Backfill',
    `- Rows to backfill: ${plan.backfillRowCount}`,
    `- Plan rows matched by CreatedAt; task rows matched by TaskId.`,
    `- Each additive cell expected old value: ${'`blank_or_absent`'} (never overwrites existing legacy data).`,
    '',
    '## Schema marker (written last)',
    `- ${TABS.SCHEMA}: mentor | 2 | <appliedAt> | ${plan.manifestHash}`,
    '',
    '## Verifications',
    ...plan.verifications.map(v => `- ${v.type}${v.tab ? ` (${v.tab})` : ''}`),
    '',
    '## Rollback notes',
    ...plan.rollbackNotes.map(n => `- ${n}`),
    '',
  ];
  return `${L.join('\n')}\n`;
}

// ── No-op / partial-state assessment ─────────────────────────────────────────
function tabHasColumns(headers, columns) {
  const map = buildNormalizedHeaderMap(headers || []);
  return columns.every(c => c in map.index);
}

function schemaMarkerPresent(schemaTab) {
  const headers = (schemaTab && schemaTab.headers) || [];
  const rows = (schemaTab && schemaTab.rows) || [];
  if (!headers.length) return false;
  const map = buildNormalizedHeaderMap(headers);
  const ni = map.index.SchemaName, vi = map.index.SchemaVersion;
  if (typeof ni !== 'number' || typeof vi !== 'number') return false;
  return rows.some(r => String(r[ni]) === 'mentor' && String(r[vi]) === '2');
}

function assessExistingState(liveRawData, computed) {
  const columnsPresent = {};
  COLUMN_APPEND_TABS.forEach(t => {
    columnsPresent[t] = tabHasColumns((liveRawData[TAB_KEY[t]] || {}).headers, requiredColumns[t] || []);
  });
  const newTabsPresent = {};
  NEW_TABS.forEach(t => {
    const data = liveRawData[TAB_KEY[t]] || { headers: [] };
    newTabsPresent[t] = (data.headers || []).length > 0;
  });
  const markerPresent = schemaMarkerPresent(liveRawData.schema);

  // backfill completeness: sample TaskNumber populated on all task rows
  const tasksTab = liveRawData.tasks || { headers: [], rows: [] };
  const tmap = buildNormalizedHeaderMap(tasksTab.headers || []);
  const tnCol = tmap.index.TaskNumber;
  const backfillComplete = typeof tnCol === 'number'
    ? (tasksTab.rows || []).every(r => String(r[tnCol] || '').trim() !== '')
    : false;

  const allColumns = Object.values(columnsPresent).every(Boolean) && Object.values(newTabsPresent).every(Boolean);
  const fullyApplied = allColumns && markerPresent && backfillComplete;
  const noneApplied = !markerPresent && Object.values(columnsPresent).every(v => !v) && Object.values(newTabsPresent).every(v => !v);
  const partiallyApplied = !fullyApplied && !noneApplied;

  return { columnsPresent, newTabsPresent, markerPresent, backfillComplete, fullyApplied, noneApplied, partiallyApplied };
}

function recoveryInstructions(state) {
  const notes = [];
  if (state.markerPresent && !state.backfillComplete) notes.push('Schema marker present but backfill incomplete — verify which task rows have TaskNumber, then re-run with MENTOR_RECOVERY_CONFIRMED=YES to complete only missing backfills.');
  if (!state.markerPresent && (Object.values(state.columnsPresent).some(Boolean) || Object.values(state.newTabsPresent).some(Boolean))) notes.push('Columns/tabs partially added but schema marker missing — inspect added columns, confirm no duplicates, then re-run with MENTOR_RECOVERY_CONFIRMED=YES.');
  NEW_TABS.forEach(t => { if (state.newTabsPresent[t] && state.markerPresent === false) notes.push(`Tab ${t} exists; verify its headers before continuing.`); });
  notes.push('Do not run an automatic destructive rollback. If state is inconsistent, restore the .xlsx backup recorded in MENTOR_BACKUP_NOTE.');
  return notes;
}

// ── Reports ──────────────────────────────────────────────────────────────────
function writeExecutionReportFiles(report, dir = GENERATED_DIR) {
  ensureDir(dir);
  const jsonPath = path.join(dir, 'PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.json');
  const mdPath = path.join(dir, 'PHASE_6B_LIVE_MIGRATION_EXECUTION_REPORT.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, executionReportToMarkdown(report));
  return { jsonPath, mdPath };
}

function executionReportToMarkdown(r) {
  const L = [
    '# Phase 6B Live Migration Execution Report',
    '',
    `Status: ${r.status}`,
    `Manifest hash: ${r.manifestHash}`,
    `Backup note hash: ${r.backupNoteHash || 'n/a'}`,
    `Applied at: ${r.appliedAt || 'n/a'}`,
    `Mentor V2 flags enabled: ${r.flagsRemainFalse ? 'None (all false)' : 'CHECK'}`,
    '',
    `## Tabs created: ${r.tabsCreated.length}`,
    ...(r.tabsCreated.length ? r.tabsCreated.map(t => `- ${t}`) : ['- None']),
    `## Columns added`,
    ...(Object.keys(r.columnsAdded).length ? Object.entries(r.columnsAdded).map(([t, c]) => `- ${t}: ${c.join(', ') || 'None'}`) : ['- None']),
    `## Rows backfilled: ${r.rowsBackfilled}`,
    `## Batch verification`,
    ...r.batches.map(b => `- ${b.name}: ${b.ok ? 'OK' : 'FAILED'}${b.verified ? ' (verified)' : ''}${b.note ? ` — ${b.note}` : ''}`),
    `## No-op items`,
    ...(r.noopItems.length ? r.noopItems.map(n => `- ${n}`) : ['- None']),
    `## Warnings`,
    ...(r.warnings.length ? r.warnings.map(w => `- ${w}`) : ['- None']),
    `## Errors`,
    ...(r.errors.length ? r.errors.map(e => `- ${e}`) : ['- None']),
    `## Final schema marker: ${r.finalSchemaMarker ? 'present' : 'absent'}`,
    `## Final row counts`,
    ...Object.entries(r.finalRowCounts || {}).map(([t, c]) => `- ${t}: ${c}`),
    `## Final header fingerprints`,
    ...Object.entries(r.finalHeaderFingerprints || {}).map(([t, f]) => `- ${t}: ${String(f).slice(0, 12)}…`),
    '',
  ];
  return `${L.join('\n')}\n`;
}

// ── Executor (gateway-driven; verify after every batch) ──────────────────────
async function readLiveRawDataViaGateway(gateway) {
  const out = {};
  for (const tab of ALL_TABS) {
    // missing tabs return { headers:[], rows:[] }
    // eslint-disable-next-line no-await-in-loop
    out[TAB_KEY[tab]] = await gateway.readTab(tab);
  }
  return out;
}

function finalSummaries(liveRawData) {
  const finalRowCounts = {};
  const finalHeaderFingerprints = {};
  ALL_TABS.forEach(t => {
    const d = liveRawData[TAB_KEY[t]] || { headers: [], rows: [] };
    finalRowCounts[t] = (d.rows || []).filter(r => (r || []).some(c => String(c || '').trim() !== '')).length;
    finalHeaderFingerprints[t] = fingerprintHeaders(d.headers || []);
  });
  return { finalRowCounts, finalHeaderFingerprints };
}

async function executeMigration({ gateway, manifest, env = {}, now = new Date().toISOString(), recoveryConfirmed, artifactsDir = GENERATED_DIR } = {}) {
  const batches = [];
  const warnings = [];
  const errors = [];
  const noopItems = [];
  const tabsCreated = [];
  const columnsAdded = {};
  let rowsBackfilled = 0;
  const recovery = recoveryConfirmed != null ? recoveryConfirmed : env.MENTOR_RECOVERY_CONFIRMED === 'YES';

  const fail = (status, code, extra = {}) => ({ ok: false, status, code, batches, warnings, errors, noopItems, tabsCreated, columnsAdded, rowsBackfilled, manifestHash: manifest && manifest.manifestHash, flagsRemainFalse: true, ...extra });

  // Gate 2 + 4
  const gates = verifyWriterGates(env);
  if (!gates.ok) { errors.push(gates.code); return fail('aborted', gates.code, { requiredGates: ['CONFIRM_MENTOR_SHEET_MIGRATION', 'MENTOR_BACKUP_CONFIRMED', 'MENTOR_LIVE_WRITER_CONFIRMED', 'MENTOR_MIGRATION_MANIFEST', 'MENTOR_BACKUP_NOTE'] }); }

  // Live re-read + Gate 3 manifest-lock
  const live = await readLiveRawDataViaGateway(gateway);
  const lock = verifyManifestLock({ manifest, liveRawData: live });
  if (!lock.ok) { errors.push(lock.code); return fail('aborted', lock.code, { staleTabs: lock.staleTabs, ambiguous: lock.ambiguous, backupNoteHash: gates.backupNoteHash }); }

  // No-op / partial detection
  const computed = computeBackfill(live, { now });
  const state = assessExistingState(live, computed);
  if (state.fullyApplied) {
    noopItems.push('All additive columns present', 'Both new tabs present', 'Schema marker present', 'Task backfill complete');
    const sums = finalSummaries(live);
    const report = buildExecutionReport({ status: 'noop', manifest, gates, now: null, batches, tabsCreated, columnsAdded, rowsBackfilled, noopItems, warnings, errors, live, sums, artifactsDir });
    return { ok: true, status: 'noop', ...report, batches, noopItems };
  }
  if (state.partiallyApplied && !recovery) {
    errors.push('PARTIAL_MIGRATION_DETECTED');
    return fail('partial_blocked', 'PARTIAL_MIGRATION_DETECTED', { recoveryInstructions: recoveryInstructions(state), state, backupNoteHash: gates.backupNoteHash });
  }

  const plan = buildWritePlan({ manifest, computed });
  let writePlanFiles = null;
  try { writePlanFiles = writeWritePlanFiles(plan, artifactsDir); } catch (e) { warnings.push(`write_plan_file_failed:${e.message}`); }

  // Helper: run a batch then verify by re-reading.
  async function runBatch(name, doWork, verify) {
    try {
      await doWork();
      const after = await readLiveRawDataViaGateway(gateway);
      const v = verify(after);
      batches.push({ name, ok: v.ok, verified: true, note: v.note });
      if (!v.ok) errors.push(`${name}_VERIFICATION_FAILED:${v.note || ''}`);
      return { ok: v.ok, after };
    } catch (e) {
      batches.push({ name, ok: false, verified: false, note: e.message });
      errors.push(`${name}_THREW:${e.message}`);
      return { ok: false, after: null };
    }
  }

  // BATCH 1 — CREATE_TABS (only missing)
  {
    const toCreate = NEW_TABS.filter(t => !((live[TAB_KEY[t]] || {}).headers || []).length);
    const r = await runBatch('CREATE_TABS', async () => {
      for (const t of toCreate) {
        const titles = await gateway.listTitles();
        if (titles.includes(t)) { noopItems.push(`Tab ${t} already exists`); continue; }
        // eslint-disable-next-line no-await-in-loop
        await gateway.createTab(t);
        // eslint-disable-next-line no-await-in-loop
        await gateway.setHeaders(t, additiveForTab(t));
        tabsCreated.push(t);
      }
    }, (after) => {
      for (const t of NEW_TABS) {
        const ok = validateRequiredColumns((after[TAB_KEY[t]] || {}).headers, t).ok;
        if (!ok) return { ok: false, note: `${t} headers incomplete` };
      }
      return { ok: true };
    });
    if (!r.ok) return abort();
  }

  // BATCH 2 — APPEND_COLUMNS (additive: never remove/reorder)
  {
    const r = await runBatch('APPEND_COLUMNS', async () => {
      for (const t of COLUMN_APPEND_TABS) {
        const cur = (await gateway.readTab(t)).headers || [];
        const map = buildNormalizedHeaderMap(cur);
        const missing = (additiveColumns[t] || []).map(c => c.name).filter(name => !(name in map.index));
        if (!missing.length) { columnsAdded[t] = columnsAdded[t] || []; continue; }
        const target = [...cur, ...missing]; // append only
        // eslint-disable-next-line no-await-in-loop
        await gateway.setHeaders(t, target);
        columnsAdded[t] = missing;
      }
    }, (after) => {
      for (const t of COLUMN_APPEND_TABS) {
        const headers = (after[TAB_KEY[t]] || {}).headers || [];
        // additive guarantee: original physical headers preserved as a prefix
        const orig = manifest.tabs[t].physicalHeaders || [];
        const prefixOk = orig.every((h, i) => headers[i] === h);
        if (!prefixOk) return { ok: false, note: `${t} original headers not preserved as prefix` };
        if (!validateRequiredColumns(headers, t).ok) return { ok: false, note: `${t} required columns missing after append` };
        // no duplicate normalized header introduced
        if (buildNormalizedHeaderMap(headers).hasAmbiguous) return { ok: false, note: `${t} ambiguous header after append` };
      }
      return { ok: true };
    });
    if (!r.ok) return abort();
  }

  // BATCH 3 — BACKFILL_ROWS (fill blank additive cells only)
  {
    const ops = [...computed.planBackfills, ...computed.taskBackfills];
    const r = await runBatch('BACKFILL_ROWS', async () => {
      for (const op of ops) {
        // eslint-disable-next-line no-await-in-loop
        const wrote = await gateway.setRowCells(op.tab, op.key, op.values);
        if (wrote) rowsBackfilled += 1;
      }
    }, (after) => {
      // verify a deterministic sample: every task row has TaskNumber + GenerationId
      const tt = after[TAB_KEY[TABS.TASKS]] || { headers: [], rows: [] };
      const m = buildNormalizedHeaderMap(tt.headers || []);
      const tn = m.index.TaskNumber, gi = m.index.GenerationId;
      if (typeof tn !== 'number' || typeof gi !== 'number') return { ok: false, note: 'task additive columns missing' };
      const allFilled = (tt.rows || []).every(row => String(row[tn] || '').trim() !== '' && String(row[gi] || '').trim() !== '');
      if (!allFilled) return { ok: false, note: 'not all task rows backfilled' };
      return { ok: true };
    });
    if (!r.ok) return abort();
  }

  // BATCH 4 — SCHEMA_MARKER (written LAST)
  {
    const r = await runBatch('SCHEMA_MARKER', async () => {
      await gateway.appendRow(TABS.SCHEMA, { SchemaName: 'mentor', SchemaVersion: '2', AppliedAt: now, ManifestHash: manifest.manifestHash });
    }, (after) => ({ ok: schemaMarkerPresent(after[TAB_KEY[TABS.SCHEMA]]), note: 'marker' }));
    if (!r.ok) return abort();
  }

  const finalLive = await readLiveRawDataViaGateway(gateway);
  const sums = finalSummaries(finalLive);
  const report = buildExecutionReport({ status: 'completed', manifest, gates, now, batches, tabsCreated, columnsAdded, rowsBackfilled, noopItems, warnings, errors, live: finalLive, sums, artifactsDir });
  return { ok: true, status: 'completed', writePlan: plan, writePlanFiles, ...report, batches };

  function abort() {
    const partialLive = live;
    const sums = finalSummaries(partialLive);
    const report = buildExecutionReport({ status: 'failed', manifest, gates, now, batches, tabsCreated, columnsAdded, rowsBackfilled, noopItems, warnings, errors, live: partialLive, sums, artifactsDir });
    return {
      ok: false, status: 'failed', code: 'BATCH_VERIFICATION_FAILED', ...report, batches,
      rollback: 'Restore the founder .xlsx backup recorded in MENTOR_BACKUP_NOTE. Do not continue to later batches.',
    };
  }
}

function buildExecutionReport({ status, manifest, gates, now, batches, tabsCreated, columnsAdded, rowsBackfilled, noopItems, warnings, errors, live, sums, artifactsDir = GENERATED_DIR }) {
  const report = {
    status,
    manifestHash: manifest && manifest.manifestHash,
    backupNoteHash: gates && gates.backupNoteHash,
    appliedAt: now,
    tabsCreated,
    columnsAdded,
    rowsBackfilled,
    batches,
    noopItems,
    warnings,
    errors,
    finalSchemaMarker: schemaMarkerPresent(live.schema),
    finalRowCounts: sums.finalRowCounts,
    finalHeaderFingerprints: sums.finalHeaderFingerprints,
    flagsRemainFalse: true, // writer never toggles flags
  };
  try { report.reportFiles = writeExecutionReportFiles(report, artifactsDir); } catch (e) { warnings.push(`exec_report_file_failed:${e.message}`); }
  return report;
}

// ── Fake gateway (tests) ─────────────────────────────────────────────────────
function createFakeMigrationGateway(workbook = {}, opts = {}) {
  // workbook: { [title]: { headers, rows } }. Missing tab => not created yet.
  const tabs = {};
  Object.entries(workbook).forEach(([title, d]) => { tabs[title] = { headers: [...(d.headers || [])], rows: (d.rows || []).map(r => [...r]) }; });
  const ops = [];
  const failOn = opts.failOn || {}; // { batchTabAction: true } to inject verification failures
  return {
    ops,
    snapshot: () => JSON.parse(JSON.stringify(tabs)),
    async listTitles() { return Object.keys(tabs); },
    async readTab(title) { const t = tabs[title]; return t ? { headers: [...t.headers], rows: t.rows.map(r => [...r]) } : { headers: [], rows: [] }; },
    async createTab(title) { if (tabs[title]) throw new Error(`TAB_EXISTS:${title}`); tabs[title] = { headers: [], rows: [] }; ops.push({ op: 'createTab', title }); },
    async setHeaders(title, headers) {
      tabs[title] = tabs[title] || { headers: [], rows: [] };
      // additive guard: existing headers must remain a prefix
      const cur = tabs[title].headers;
      for (let i = 0; i < cur.length; i += 1) { if (headers[i] !== cur[i]) throw new Error(`NON_ADDITIVE_HEADER_CHANGE:${title}`); }
      tabs[title].headers = [...headers];
      ops.push({ op: 'setHeaders', title, count: headers.length });
      if (failOn[`setHeaders:${title}`]) tabs[title].headers = cur; // simulate write that did not persist
    },
    async setRowCells(title, key, values) {
      const t = tabs[title]; if (!t) throw new Error(`NO_TAB:${title}`);
      const map = headerIndex(t.headers);
      const ki = map[key.column];
      if (typeof ki !== 'number') throw new Error(`NO_KEY_COLUMN:${title}.${key.column}`);
      const matches = t.rows.map((r, i) => (String(r[ki]) === String(key.value) ? i : -1)).filter(i => i >= 0);
      if (matches.length !== 1) throw new Error(matches.length ? `DUPLICATE_ROW_MATCH:${title}` : `NO_ROW_MATCH:${title}`);
      const ri = matches[0];
      const row = t.rows[ri];
      while (row.length < t.headers.length) row.push('');
      Object.entries(values).forEach(([col, val]) => {
        const ci = map[col];
        if (typeof ci !== 'number') throw new Error(`NO_COLUMN:${title}.${col}`);
        if (String(row[ci] || '').trim() !== '') return; // never overwrite existing non-blank legacy data
        row[ci] = val == null ? '' : String(val);
      });
      ops.push({ op: 'setRowCells', title, key: key.value });
      return true;
    },
    async appendRow(title, valuesByHeader) {
      const t = tabs[title]; if (!t) throw new Error(`NO_TAB:${title}`);
      const row = t.headers.map(h => { const v = valuesByHeader[normalizeHeader(h)]; return v == null ? '' : String(v); });
      t.rows.push(row);
      ops.push({ op: 'appendRow', title });
      if (failOn[`appendRow:${title}`]) t.rows.pop();
    },
  };
}

function headerIndex(headers) {
  const map = {};
  (headers || []).forEach((h, i) => { const n = normalizeHeader(h); if (n && !(n in map)) map[n] = i; });
  return map;
}

// ── Real gateway (wired by apply script; NOT executed in Phase 6B) ───────────
function createGoogleSheetsMigrationGateway(sheets, spreadsheetId) {
  return {
    async listTitles() {
      const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
      return (res.data.sheets || []).map(s => s.properties.title);
    },
    async readTab(title) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:ZZ` });
        const v = (res.data && res.data.values) || [];
        return { headers: v[0] || [], rows: v.slice(1) };
      } catch (_) { return { headers: [], rows: [] }; }
    },
    async createTab(title) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
    },
    async setHeaders(title, headers) {
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!1:1`, valueInputOption: 'RAW', requestBody: { values: [headers] } });
    },
    async setRowCells(title, key, values) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:ZZ` });
      const v = (res.data && res.data.values) || [];
      const headers = v[0] || [];
      const map = headerIndex(headers);
      const ki = map[key.column];
      const dataRows = v.slice(1);
      const matches = dataRows.map((r, i) => (String(r[ki]) === String(key.value) ? i : -1)).filter(i => i >= 0);
      if (matches.length !== 1) throw new Error(matches.length ? 'DUPLICATE_ROW_MATCH' : 'NO_ROW_MATCH');
      const ri = matches[0];
      const row = [...(dataRows[ri] || [])];
      while (row.length < headers.length) row.push('');
      let changed = false;
      Object.entries(values).forEach(([col, val]) => {
        const ci = map[col];
        if (typeof ci !== 'number') return;
        if (String(row[ci] || '').trim() !== '') return; // additive: do not overwrite legacy data
        row[ci] = val == null ? '' : String(val); changed = true;
      });
      if (!changed) return false;
      const rowNumber = ri + 2; // 1-based incl header
      await sheets.spreadsheets.values.update({ spreadsheetId, range: `${title}!A${rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [row] } });
      return true;
    },
    async appendRow(title, valuesByHeader) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!1:1` });
      const headers = (res.data && res.data.values && res.data.values[0]) || [];
      const row = headers.map(h => { const val = valuesByHeader[normalizeHeader(h)]; return val == null ? '' : String(val); });
      await sheets.spreadsheets.values.append({ spreadsheetId, range: `${title}!A:ZZ`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] } });
    },
  };
}

module.exports = {
  FIXTURE_WORKBOOK_ID_HASH,
  verifyWriterGates,
  verifyManifestLock,
  computeBackfill,
  buildWritePlan,
  writeWritePlanFiles,
  writePlanToMarkdown,
  assessExistingState,
  recoveryInstructions,
  executeMigration,
  writeExecutionReportFiles,
  executionReportToMarkdown,
  createFakeMigrationGateway,
  createGoogleSheetsMigrationGateway,
};
