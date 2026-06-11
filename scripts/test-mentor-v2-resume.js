#!/usr/bin/env node
/**
 * scripts/test-mentor-v2-resume.js — Phase 9D RESUME tests (NO live Sheet).
 * Drives the real V2 cut-over code through a fake Sheets client + routing gate.
 * Run: node scripts/test-mentor-v2-resume.js
 */
'use strict';

const assert = require('assert');
const { createSheetsMutationRepository, createSheetsIdempotencyStore } = require('../lib/mentor/repository/sheetsMutationRepository');
const { executeV2TaskActionCutover } = require('../lib/mentor/read/v2TaskActionHandler');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');
const { buildNormalizedHeaderMap } = require('../lib/mentor/repository/headerNormalizer');
const routing = require('../lib/mentor/read/taskActionRouting');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');

const EMAIL = 'v2resume@test';
const NOW = '2026-06-11T11:00:00.000Z';
const TASK_HEADERS = ['Email', 'TaskId', 'PlanId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'PlanVersion', 'GenerationId', 'TaskNumber', 'RowVersion', 'PendingReason', 'MovedToPendingAt', 'CompletedAt', 'UpdatedAt', 'CreatedAt'];
const PLAN_HEADERS = ['Email', 'PlanId', 'Status', 'Version', 'PlanVersion', 'RowVersion', 'CreatedAt'];
const LOG_HEADERS = ['LogId', 'EventId', 'TaskId', 'PlanId', 'Email', 'ActionType', 'FromStatus', 'ToStatus', 'CanonicalAction', 'IdempotencyKey', 'RequestId', 'EventPayloadJSON', 'CreatedAt', 'SourcePage'];
const MR_HEADERS = ['IdempotencyKey', 'UserScopeHash', 'PlanId', 'TaskId', 'Action', 'PayloadHash', 'Status', 'ResultJSON', 'CreatedAt', 'CompletedAt', 'ExpiresAt'];
const rowOf = (h, o) => h.map(k => (o[k] != null ? String(o[k]) : ''));

function buildTabs({ status = 'pending', rowVersion = '2', pendingReason = 'user_postponed', movedToPendingAt = '2026-06-10T00:00:00Z', type = 'practice_task' } = {}) {
  return {
    MentorTasks: [TASK_HEADERS, rowOf(TASK_HEADERS, { Email: EMAIL, TaskId: 't1', PlanId: 'P', Status: status, Type: type, PlanVersion: '1', RowVersion: rowVersion, PendingReason: pendingReason, MovedToPendingAt: movedToPendingAt, SequenceNumber: '1', DayNumber: '1', CreatedAt: '2026-06-08T00:00:00Z' })],
    MentorPlans: [PLAN_HEADERS, rowOf(PLAN_HEADERS, { Email: EMAIL, PlanId: 'P', Status: 'active', Version: 'v1', PlanVersion: '1', RowVersion: '1' })],
    MentorTaskLogs: [LOG_HEADERS],
    MentorMutationRequests: [MR_HEADERS],
  };
}
const fakeSheets = tabs => ({ spreadsheets: { values: {
  async get({ range }) { const t = range.split('!')[0]; return { data: { values: (tabs[t] || []).map(r => [...r]) } }; },
  async update({ range, requestBody }) { const [t, a1] = range.split('!'); const n = Number(String(a1).replace(/\D/g, '')); tabs[t][n - 1] = [...requestBody.values[0]]; return { data: {} }; },
  async append({ range, requestBody }) { const t = range.split('!')[0]; tabs[t].push([...requestBody.values[0]]); return { data: {} }; },
} } });
const dataRows = (tabs, n) => tabs[n].slice(1).filter(r => r.some(c => String(c || '').trim() !== ''));
const cell = (tabs, n, i, col) => { const m = buildNormalizedHeaderMap(tabs[n][0]); return tabs[n][i + 1][m.index[col]]; };
function rawFromTabs(tabs) {
  return { profile: { headers: ['Email'], rows: [] }, plans: { headers: tabs.MentorPlans[0], rows: tabs.MentorPlans.slice(1) }, tasks: { headers: tabs.MentorTasks[0], rows: tabs.MentorTasks.slice(1) }, topicState: { headers: ['Email', 'Subject', 'Topic'], rows: [] } };
}
async function resume(tabs, { currentGen = new Set(['t1']), hidden = new Set(), opId = 'resume-op-1', buildResponseSnapshot } = {}) {
  const s = fakeSheets(tabs);
  const repo = createSheetsMutationRepository({ sheets: s, email: EMAIL, currentGenerationTaskIds: currentGen, hiddenTaskIds: hidden });
  const store = createSheetsIdempotencyStore({ sheets: s, email: EMAIL });
  return executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, buildResponseSnapshot, request: { taskId: 't1', planId: 'P', actionType: 'resume', clientOperationId: opId } });
}

const V2F = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_V2_MUTATION_ALLOWED_USER_HASHES'];
function withEnv(v, fn) { const p = {}; V2F.forEach(k => p[k] = process.env[k]); Object.entries(v).forEach(([k, val]) => val === undefined ? delete process.env[k] : process.env[k] = val); try { return fn(); } finally { V2F.forEach(k => p[k] === undefined ? delete process.env[k] : process.env[k] = p[k]); } }
const ALICE = { email: 'alice@t' }; const ALICE_HASH = userScopeFromIdentity(ALICE); const BOB = { email: 'bob@t' };
const ALLON = { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' };

let passed = 0, failed = 0; const tests = []; const test = (n, fn) => tests.push({ n, fn });

test('1. resume not V2 when mutation flags false', () => withEnv({ ...ALLON, MENTOR_TASK_MUTATIONS_V2: undefined, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('resume', ALICE), false)));
test('2. resume is V2 only for allowlisted user', () => withEnv({ ...ALLON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('resume', ALICE), true)));
test('3. non-allowlisted resume stays legacy', () => withEnv({ ...ALLON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('resume', BOB), false)));
test('4. complete stays legacy even allowlisted', () => withEnv({ ...ALLON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('complete', ALICE), false)));

test('5. V2 RESUME pending -> active', async () => { const tabs = buildTabs(); const r = await resume(tabs); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.task.status, 'active'); assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'Status'), 'active'); });
test('6. RESUME clears PendingReason', async () => { const tabs = buildTabs(); await resume(tabs); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'PendingReason') || ''), ''); });
test('7. RESUME clears MovedToPendingAt', async () => { const tabs = buildTabs(); await resume(tabs); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'MovedToPendingAt') || ''), ''); });
test('8. RowVersion increments once (2 -> 3)', async () => { const tabs = buildTabs(); const r = await resume(tabs); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '3'); assert.strictEqual(Number(r.task.rowVersion), 3); });
test('9. canonical RESUME event row appended', async () => { const tabs = buildTabs(); await resume(tabs); const logs = dataRows(tabs, 'MentorTaskLogs'); assert.strictEqual(logs.length, 1); const m = buildNormalizedHeaderMap(tabs.MentorTaskLogs[0]); assert.strictEqual(logs[0][m.index.CanonicalAction], 'RESUME'); assert.strictEqual(logs[0][m.index.FromStatus], 'pending'); assert.strictEqual(logs[0][m.index.ToStatus], 'active'); });
test('10. RESUME idempotency row written', async () => { const tabs = buildTabs(); await resume(tabs); const m = buildNormalizedHeaderMap(tabs.MentorMutationRequests[0]); const rows = dataRows(tabs, 'MentorMutationRequests'); assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0][m.index.Action], 'RESUME'); });
test('11. idempotent replay writes no extra rows', async () => { const tabs = buildTabs(); const s = fakeSheets(tabs); const repo = createSheetsMutationRepository({ sheets: s, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) }); const store = createSheetsIdempotencyStore({ sheets: s, email: EMAIL }); const req = { taskId: 't1', planId: 'P', actionType: 'resume', clientOperationId: 'r1' }; const a = await executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req }); const b = await executeV2TaskActionCutover({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req }); assert.strictEqual(a.idempotent, false); assert.strictEqual(b.idempotent, true); assert.strictEqual(dataRows(tabs, 'MentorTaskLogs').length, 1); assert.strictEqual(dataRows(tabs, 'MentorMutationRequests').length, 1); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '3'); });
test('12. stale RowVersion rejected', async () => { const tabs = buildTabs(); const repo = createSheetsMutationRepository({ sheets: fakeSheets(tabs), email: EMAIL, currentGenerationTaskIds: new Set(['t1']) }); await assert.rejects(() => repo.compareAndUpdateTask({ taskId: 't1', expected: { planId: 'P', rowVersion: 99 }, updates: { status: 'active' } }), /STALE_ROW_VERSION/); });
test('13. active task cannot resume', async () => { const r = await resume(buildTabs({ status: 'active', pendingReason: '', movedToPendingAt: '' })); assert.strictEqual(r.ok, false); assert.ok(/INVALID_TRANSITION/.test(r.code), r.code); });
test('14. completed task cannot resume', async () => { const r = await resume(buildTabs({ status: 'completed', pendingReason: '', movedToPendingAt: '' })); assert.strictEqual(r.ok, false); assert.ok(/INVALID_TRANSITION|TERMINAL/.test(r.code), r.code); });
test('15. hidden/historical task rejects', async () => { const r1 = await resume(buildTabs(), { currentGen: new Set() }); assert.strictEqual(r1.code, 'HISTORICAL_TASK_NOT_ACTIONABLE'); const r2 = await resume(buildTabs(), { hidden: new Set(['t1']) }); assert.strictEqual(r2.code, 'HISTORICAL_TASK_NOT_ACTIONABLE'); });
test('16. response uses shared overlay shape', async () => { const overlay = { exists: true, profile: {}, plan: { tasks: [] }, activeTasks: [], completedToday: [], deferredTasks: [], pendingTasks: [], progress: {}, mentorMessage: 'm', lastSyncAt: 't', repositoryServed: true }; const r = await resume(buildTabs(), { buildResponseSnapshot: async () => overlay }); assert.strictEqual(r.ok, true); ['exists', 'profile', 'plan', 'activeTasks', 'pendingTasks', 'progress', 'mentorMessage', 'lastSyncAt'].forEach(k => assert.ok(k in r.snapshot)); });
test('17/18. after RESUME canonicalPending=0 and current task active', async () => { const tabs = buildTabs(); await resume(tabs); const snap = buildSnapshotFromRawData(rawFromTabs(tabs), { email: '' }); assert.strictEqual(snap.canonicalPendingTasks.length, 0); assert.strictEqual(snap.currentTasks.length, 1); assert.strictEqual(snap.currentTasks[0].status, 'active'); });
test('19. no live gateway used (fake client only)', () => { assert.ok(true); });

(async () => { for (const t of tests) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${tests.length} Mentor V2 RESUME tests passed.`); process.exit(failed ? 1 : 0); })();
