#!/usr/bin/env node
/**
 * scripts/test-mentor-v2-postpone.js — Phase 9B1 tests (NO live Sheet).
 *
 * Drives the REAL V2 cut-over code (sheetsMutationRepository + v2TaskActionHandler)
 * through a FAKE in-memory Sheets client, plus the routing gate. No live write.
 * Run: node scripts/test-mentor-v2-postpone.js
 */
'use strict';

const assert = require('assert');
const { createSheetsMutationRepository, createSheetsIdempotencyStore } = require('../lib/mentor/repository/sheetsMutationRepository');
const { executeV2TaskActionCutover } = require('../lib/mentor/read/v2TaskActionHandler');
const { buildNormalizedHeaderMap } = require('../lib/mentor/repository/headerNormalizer');
const { deriveIdempotencyKey, userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');
const routing = require('../lib/mentor/read/taskActionRouting');

const EMAIL = 'v2@test';
const NOW = '2026-06-11T10:00:00.000Z';

const TASK_HEADERS = ['Email', 'TaskId', 'PlanId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'PlanVersion', 'GenerationId', 'TaskNumber', 'RowVersion', 'PendingReason', 'MovedToPendingAt', 'NextEligibleResurfaceAt', 'NextEligibleAt', 'CompletedAt', 'CompletionSource', 'SnoozeCount', 'CancellationReason', 'UpdatedAt', 'CreatedAt'];
const PLAN_HEADERS = ['Email', 'PlanId', 'Status', 'Version', 'PlanVersion', 'RowVersion', 'CreatedAt'];
const LOG_HEADERS = ['LogId', 'EventId', 'TaskId', 'PlanId', 'Email', 'ActionType', 'FromStatus', 'ToStatus', 'CanonicalAction', 'IdempotencyKey', 'RequestId', 'EventPayloadJSON', 'CreatedAt', 'SourcePage', 'QuizSessionId', 'Notes'];
const MR_HEADERS = ['IdempotencyKey', 'UserScopeHash', 'PlanId', 'TaskId', 'Action', 'PayloadHash', 'Status', 'ResultJSON', 'CreatedAt', 'CompletedAt', 'ExpiresAt'];
const rowOf = (headers, obj) => headers.map(h => (obj[h] != null ? String(obj[h]) : ''));

function buildTabs({ taskStatus = 'active', planVersion = '1', rowVersion = '1', taskRowVersion = '1', taskType = 'practice_task' } = {}) {
  return {
    MentorTasks: [TASK_HEADERS, rowOf(TASK_HEADERS, { Email: EMAIL, TaskId: 't1', PlanId: 'P', Status: taskStatus, Type: taskType, PlanVersion: planVersion, RowVersion: taskRowVersion, SequenceNumber: '1', DayNumber: '1' })],
    MentorPlans: [PLAN_HEADERS, rowOf(PLAN_HEADERS, { Email: EMAIL, PlanId: 'P', Status: 'active', Version: 'v1', PlanVersion: planVersion, RowVersion: rowVersion })],
    MentorTaskLogs: [LOG_HEADERS],
    MentorMutationRequests: [MR_HEADERS],
  };
}
function makeFakeSheets(tabs) {
  return {
    spreadsheets: {
      values: {
        async get({ range }) { const tab = range.split('!')[0]; return { data: { values: (tabs[tab] || []).map(r => [...r]) } }; },
        async update({ range, requestBody }) { const [tab, a1] = range.split('!'); const n = Number(String(a1).replace(/\D/g, '')); tabs[tab][n - 1] = [...requestBody.values[0]]; return { data: {} }; },
        async append({ range, requestBody }) { const tab = range.split('!')[0]; tabs[tab].push([...requestBody.values[0]]); return { data: {} }; },
      },
    },
  };
}
function dataRows(tabs, name) { return tabs[name].slice(1).filter(r => r.some(c => String(c || '').trim() !== '')); }
function cell(tabs, name, rowIdx, col) { const m = buildNormalizedHeaderMap(tabs[name][0]); return tabs[name][rowIdx + 1][m.index[col]]; }

async function runCutover(tabs, { currentGen = new Set(['t1']), hidden = new Set(), request = {}, buildResponseSnapshot } = {}) {
  const sheets = makeFakeSheets(tabs);
  const repository = createSheetsMutationRepository({ sheets, email: EMAIL, currentGenerationTaskIds: currentGen, hiddenTaskIds: hidden });
  const idempotencyStore = createSheetsIdempotencyStore({ sheets, email: EMAIL });
  return executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository, idempotencyStore, now: NOW, buildResponseSnapshot, request: { taskId: 't1', planId: 'P', actionType: 'snooze', ...request } });
}

let passed = 0, failed = 0;
const tests = [];
const test = (n, fn) => tests.push({ n, fn });

// ---- routing gate (1-4) ----
const V2F = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2'];
function withFlags(vals, fn) { const prev = {}; V2F.forEach(f => prev[f] = process.env[f]); Object.entries(vals).forEach(([k, v]) => v === undefined ? delete process.env[k] : process.env[k] = v); try { return fn(); } finally { V2F.forEach(f => prev[f] === undefined ? delete process.env[f] : process.env[f] = prev[f]); } }
test('1. mutation flags false -> snooze stays legacy (not routed to V2)', () => withFlags({ MENTOR_TASK_MUTATIONS_V2: undefined, MENTOR_SHEETS_MUTATIONS_V2: undefined, MENTOR_MUTATION_IDEMPOTENCY_V2: undefined }, () => assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), false)));
test('2. one mutation flag false -> snooze stays legacy', () => withFlags({ MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: undefined }, () => assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), false)));
test('3. all three true + snooze -> routes to V2', () => withFlags({ MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' }, () => assert.strictEqual(routing.shouldRouteActionThroughV2('snooze'), true)));
test('4. all three true + complete -> legacy path', () => withFlags({ MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' }, () => assert.strictEqual(routing.shouldRouteActionThroughV2('complete'), false)));

// ---- POSTPONE behaviour (5-10) ----
test('5. V2 POSTPONE: fake task active -> pending', async () => {
  const tabs = buildTabs(); const res = await runCutover(tabs);
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.task.status, 'pending');
  assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'Status'), 'pending');
});
test('6. V2 POSTPONE sets PendingReason=user_postponed', async () => {
  const tabs = buildTabs(); await runCutover(tabs);
  assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'PendingReason'), 'user_postponed');
});
test('7. V2 POSTPONE sets MovedToPendingAt', async () => {
  const tabs = buildTabs(); await runCutover(tabs);
  assert.ok(String(cell(tabs, 'MentorTasks', 0, 'MovedToPendingAt')).length > 0);
});
test('8. V2 POSTPONE increments RowVersion (1 -> 2)', async () => {
  const tabs = buildTabs(); const res = await runCutover(tabs);
  assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '2');
  assert.strictEqual(Number(res.task.rowVersion), 2);
});
test('9. V2 POSTPONE appends exactly one canonical event row', async () => {
  const tabs = buildTabs(); await runCutover(tabs);
  const logs = dataRows(tabs, 'MentorTaskLogs');
  assert.strictEqual(logs.length, 1);
  const m = buildNormalizedHeaderMap(tabs.MentorTaskLogs[0]);
  assert.strictEqual(logs[0][m.index.CanonicalAction], 'POSTPONE');
  assert.strictEqual(logs[0][m.index.FromStatus], 'active');
  assert.strictEqual(logs[0][m.index.ToStatus], 'pending');
});
test('10. V2 POSTPONE writes exactly one idempotency row', async () => {
  const tabs = buildTabs(); await runCutover(tabs);
  assert.strictEqual(dataRows(tabs, 'MentorMutationRequests').length, 1);
});

// ---- idempotency (11-12) ----
test('11. idempotent replay (same op id) does not write a second event/idempotency row', async () => {
  const tabs = buildTabs(); const sheets = makeFakeSheets(tabs);
  const repo = createSheetsMutationRepository({ sheets, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) });
  const store = createSheetsIdempotencyStore({ sheets, email: EMAIL });
  const req = { taskId: 't1', planId: 'P', actionType: 'snooze', clientOperationId: 'op-1' };
  const r1 = await executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req });
  const r2 = await executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req });
  assert.strictEqual(r1.idempotent, false);
  assert.strictEqual(r2.idempotent, true);
  assert.strictEqual(dataRows(tabs, 'MentorTaskLogs').length, 1);
  assert.strictEqual(dataRows(tabs, 'MentorMutationRequests').length, 1);
  assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '2'); // not bumped twice
});
test('12. same idempotency key + different payload rejected', async () => {
  const tabs = buildTabs(); const sheets = makeFakeSheets(tabs);
  const store = createSheetsIdempotencyStore({ sheets, email: EMAIL });
  const scope = userScopeFromIdentity({ email: EMAIL });
  const key = deriveIdempotencyKey({ userScope: scope, planId: 'P', taskId: 't1', action: 'POSTPONE', clientOperationId: 'op-x' });
  await store.save(key, { payloadHash: 'DIFFERENT_HASH', result: {} }); // pre-seed conflicting payload
  const repo = createSheetsMutationRepository({ sheets, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) });
  const res = await executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: { taskId: 't1', planId: 'P', actionType: 'snooze', clientOperationId: 'op-x' } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
});

// ---- guards (13-16) ----
test('13. stale RowVersion rejected (repository compare-and-update)', async () => {
  const tabs = buildTabs(); const sheets = makeFakeSheets(tabs);
  const repo = createSheetsMutationRepository({ sheets, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) });
  await assert.rejects(() => repo.compareAndUpdateTask({ taskId: 't1', expected: { planId: 'P', rowVersion: 99 }, updates: { status: 'pending' } }), /STALE_ROW_VERSION/);
});
test('14. historical task rejected (not in current generation)', async () => {
  const res = await runCutover(buildTabs(), { currentGen: new Set() }); // t1 not current-gen
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});
test('15. hidden legacy snoozed task rejected', async () => {
  const res = await runCutover(buildTabs(), { currentGen: new Set(['t1']), hidden: new Set(['t1']) });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'HISTORICAL_TASK_NOT_ACTIONABLE');
});
test('16. completed task rejected (invalid transition)', async () => {
  const res = await runCutover(buildTabs({ taskStatus: 'completed' }));
  assert.strictEqual(res.ok, false);
  assert.ok(/INVALID_TRANSITION|TERMINAL/.test(res.code), res.code);
});

// ---- response compatibility (17) + fail-closed (18) ----
test('17. V2 handler response uses the shared overlay shape', async () => {
  const overlayShape = { exists: true, profile: {}, plan: { tasks: [] }, activeTasks: [], completedToday: [], deferredTasks: [], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't', repositoryServed: true };
  const res = await runCutover(buildTabs(), { buildResponseSnapshot: async () => overlayShape });
  assert.strictEqual(res.ok, true);
  ['exists', 'profile', 'plan', 'activeTasks', 'completedToday', 'deferredTasks', 'pendingTasks', 'progress', 'mentorMessage', 'lastSyncAt'].forEach(k => assert.ok(k in res.snapshot, `missing ${k}`));
  assert.strictEqual(res.snapshot.repositoryServed, true);
});
test('18. failure is fail-closed (ok:false + httpStatus); no legacy fallback in orchestration', async () => {
  const res = await runCutover(buildTabs(), { currentGen: new Set() }); // forces reject
  assert.strictEqual(res.ok, false);
  assert.ok(typeof res.httpStatus === 'number' && res.httpStatus >= 400);
  assert.strictEqual(res.snapshot, undefined); // no snapshot built on failure
});

// ---- fresh-plan blank V2 columns (Step 6) ----
test('19. freshly generated plan with blank V2 columns still mutates (defaults 1 -> 2)', async () => {
  const tabs = buildTabs({ planVersion: '', rowVersion: '', taskRowVersion: '' });
  const res = await runCutover(tabs);
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.task.status, 'pending');
  assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '2');
});

// ---- environment safety (20) ----
test('20. forbidden flags remain unset in this test process', () => {
  ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_DAILY_ROLLOVER_V2', 'MENTOR_PENDING_LIFECYCLE_V2'].forEach(f => {
    assert.ok(!/^(true|yes|1)$/i.test(String(process.env[f] || '')), `${f} should not be enabled`);
  });
});

(async () => {
  for (const t of tests) {
    try { await t.fn(); passed++; console.log(`ok  ${t.n}`); }
    catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); }
  }
  console.log(`\n${passed}/${tests.length} Mentor V2 postpone cut-over tests passed.`);
  process.exit(failed ? 1 : 0);
})();
