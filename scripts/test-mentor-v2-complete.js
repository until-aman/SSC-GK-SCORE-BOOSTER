#!/usr/bin/env node
/**
 * scripts/test-mentor-v2-complete.js — Phase 9G1 quiz-sync COMPLETE tests (NO live Sheet).
 * Drives the real V2 quiz-complete path through a fake Sheets client + routing/monitor.
 * Run: node scripts/test-mentor-v2-complete.js
 */
'use strict';

const assert = require('assert');
const { createSheetsMutationRepository, createSheetsIdempotencyStore } = require('../lib/mentor/repository/sheetsMutationRepository');
const { executeV2QuizComplete } = require('../lib/mentor/read/v2TaskActionHandler');
const { evaluateTaskTransition, TASK_ACTION } = require('../lib/mentor/domain/taskStateMachine');
const { COMPLETION_SOURCE } = require('../lib/mentor/domain/enums');
const { buildNormalizedHeaderMap } = require('../lib/mentor/repository/headerNormalizer');
const { auditV2Mutations } = require('../lib/mentor/read/v2MutationMonitor');
const routing = require('../lib/mentor/read/taskActionRouting');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');

const EMAIL = 'v2complete@test';
const NOW = '2026-06-11T13:00:00.000Z';
const TASK_HEADERS = ['Email', 'TaskId', 'PlanId', 'Status', 'Type', 'SequenceNumber', 'DayNumber', 'PlanVersion', 'RowVersion', 'PendingReason', 'MovedToPendingAt', 'CompletedAt', 'CompletionSource', 'LinkedQuizSessionId', 'UpdatedAt', 'CreatedAt'];
const PLAN_HEADERS = ['Email', 'PlanId', 'Status', 'Version', 'PlanVersion', 'RowVersion', 'CreatedAt'];
const LOG_HEADERS = ['LogId', 'EventId', 'TaskId', 'PlanId', 'Email', 'ActionType', 'FromStatus', 'ToStatus', 'CanonicalAction', 'IdempotencyKey', 'RequestId', 'EventPayloadJSON', 'CreatedAt', 'SourcePage'];
const MR_HEADERS = ['IdempotencyKey', 'UserScopeHash', 'PlanId', 'TaskId', 'Action', 'PayloadHash', 'Status', 'ResultJSON', 'CreatedAt', 'CompletedAt', 'ExpiresAt'];
const rowOf = (h, o) => h.map(k => (o[k] != null ? String(o[k]) : ''));
function buildTabs({ status = 'active', type = 'practice_task', rowVersion = '1' } = {}) {
  return {
    MentorTasks: [TASK_HEADERS, rowOf(TASK_HEADERS, { Email: EMAIL, TaskId: 't1', PlanId: 'P', Status: status, Type: type, PlanVersion: '1', RowVersion: rowVersion, SequenceNumber: '1', DayNumber: '1', CreatedAt: '2026-06-08T00:00:00Z' })],
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
async function quizComplete(tabs, { currentGen = new Set(['t1']), hidden = new Set(), req = {}, upsertTopicState } = {}) {
  const s = fakeSheets(tabs);
  const repository = createSheetsMutationRepository({ sheets: s, email: EMAIL, currentGenerationTaskIds: currentGen, hiddenTaskIds: hidden });
  const store = createSheetsIdempotencyStore({ sheets: s, email: EMAIL });
  return executeV2QuizComplete({ userIdentity: { email: EMAIL }, repository, idempotencyStore: store, now: NOW, upsertTopicState,
    request: { taskId: 't1', planId: 'P', quizSessionId: 'QS1', subject: 'Polity', topic: 'Amendments', correct: 18, incorrect: 4, skipped: 3, totalQuestions: 25, ...req } });
}
const active = (o = {}) => ({ taskId: 't1', planId: 'P', planVersion: 1, rowVersion: 1, status: 'active', type: 'practice_task', isCurrentGeneration: true, isLegacyHidden: false, ...o });
const V2F = ['MENTOR_TASK_MUTATIONS_V2', 'MENTOR_SHEETS_MUTATIONS_V2', 'MENTOR_MUTATION_IDEMPOTENCY_V2', 'MENTOR_V2_MUTATION_ALLOWED_USER_HASHES'];
function withEnv(v, fn) { const p = {}; V2F.forEach(k => p[k] = process.env[k]); Object.entries(v).forEach(([k, val]) => val === undefined ? delete process.env[k] : process.env[k] = val); try { return fn(); } finally { V2F.forEach(k => p[k] === undefined ? delete process.env[k] : process.env[k] = p[k]); } }
const ALICE = { email: 'alice@t' }; const ALICE_HASH = userScopeFromIdentity(ALICE);
const ON = { MENTOR_TASK_MUTATIONS_V2: 'true', MENTOR_SHEETS_MUTATIONS_V2: 'true', MENTOR_MUTATION_IDEMPOTENCY_V2: 'true' };

let passed = 0, failed = 0; const tests = []; const test = (n, fn) => tests.push({ n, fn });

test('1. manual complete is NOT V2-whitelisted', () => withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => { assert.strictEqual(routing.shouldRouteActionThroughV2('complete'), false); assert.strictEqual(routing.shouldRouteActionThroughV2ForUser('complete', ALICE), false); }));
test('2. quiz V2 gate fails closed with no allowlist', () => withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: undefined }, () => assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(ALICE), false)));
test('3. quiz V2 gate passes for allowlisted user', () => withEnv({ ...ON, MENTOR_V2_MUTATION_ALLOWED_USER_HASHES: ALICE_HASH }, () => assert.strictEqual(routing.shouldRouteQuizCompletionThroughV2(ALICE), true)));
test('4. quiz task COMPLETE without completionSource rejects', () => { const r = evaluateTaskTransition({ task: active(), action: TASK_ACTION.COMPLETE, now: NOW }); assert.strictEqual(r.allowed, false); assert.strictEqual(r.code, 'INVALID_COMPLETION_SOURCE'); });
test('5. quiz task COMPLETE with mentor_response rejects', () => { const r = evaluateTaskTransition({ task: active(), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.MENTOR_RESPONSE } }); assert.strictEqual(r.allowed, false); });
test('6. quiz_sync without linkedQuizSessionId rejects', () => { const r = evaluateTaskTransition({ task: active(), action: TASK_ACTION.COMPLETE, now: NOW, context: { completionSource: COMPLETION_SOURCE.QUIZ_SYNC } }); assert.strictEqual(r.allowed, false); assert.strictEqual(r.code, 'LINKED_QUIZ_SESSION_REQUIRED'); });
test('7. quiz_sync + linkedQuizSessionId succeeds (handler)', async () => { const tabs = buildTabs(); const r = await quizComplete(tabs); assert.strictEqual(r.ok, true, JSON.stringify(r)); });
test('8. COMPLETE active -> completed', async () => { const tabs = buildTabs(); const r = await quizComplete(tabs); assert.strictEqual(r.task.status, 'completed'); assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'Status'), 'completed'); });
test('9. CompletedAt set', async () => { const tabs = buildTabs(); await quizComplete(tabs); assert.ok(String(cell(tabs, 'MentorTasks', 0, 'CompletedAt')).length > 0); });
test('10. CompletionSource=quiz_sync written', async () => { const tabs = buildTabs(); await quizComplete(tabs); assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'CompletionSource'), 'quiz_sync'); });
test('11. LinkedQuizSessionId written', async () => { const tabs = buildTabs(); await quizComplete(tabs); assert.strictEqual(cell(tabs, 'MentorTasks', 0, 'LinkedQuizSessionId'), 'QS1'); });
test('12. PendingReason/MovedToPendingAt cleared (stay blank)', async () => { const tabs = buildTabs(); await quizComplete(tabs); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'PendingReason') || ''), ''); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'MovedToPendingAt') || ''), ''); });
test('13. RowVersion increments once (1 -> 2)', async () => { const tabs = buildTabs(); const r = await quizComplete(tabs); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '2'); assert.strictEqual(Number(r.task.rowVersion), 2); });
test('14. canonical COMPLETE event row appended', async () => { const tabs = buildTabs(); await quizComplete(tabs); const logs = dataRows(tabs, 'MentorTaskLogs'); assert.strictEqual(logs.length, 1); const m = buildNormalizedHeaderMap(tabs.MentorTaskLogs[0]); assert.strictEqual(logs[0][m.index.CanonicalAction], 'COMPLETE'); assert.strictEqual(logs[0][m.index.FromStatus], 'active'); assert.strictEqual(logs[0][m.index.ToStatus], 'completed'); });
test('15. idempotency row written (Action=COMPLETE)', async () => { const tabs = buildTabs(); await quizComplete(tabs); const m = buildNormalizedHeaderMap(tabs.MentorMutationRequests[0]); const rows = dataRows(tabs, 'MentorMutationRequests'); assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0][m.index.Action], 'COMPLETE'); });
test('16. idempotent replay writes no second event/idempotency row', async () => { const tabs = buildTabs(); const s = fakeSheets(tabs); const repo = createSheetsMutationRepository({ sheets: s, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) }); const store = createSheetsIdempotencyStore({ sheets: s, email: EMAIL }); const req = { taskId: 't1', planId: 'P', quizSessionId: 'QS1', subject: 'Polity', topic: 'A', correct: 1, totalQuestions: 1, clientOperationId: 'c1' }; const a = await executeV2QuizComplete({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req }); const b = await executeV2QuizComplete({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: req }); assert.strictEqual(a.idempotent, false); assert.strictEqual(b.idempotent, true); assert.strictEqual(dataRows(tabs, 'MentorTaskLogs').length, 1); assert.strictEqual(dataRows(tabs, 'MentorMutationRequests').length, 1); assert.strictEqual(String(cell(tabs, 'MentorTasks', 0, 'RowVersion')), '2'); });
test('17. duplicate completion (new op id) rejects', async () => { const tabs = buildTabs(); const s = fakeSheets(tabs); const repo = createSheetsMutationRepository({ sheets: s, email: EMAIL, currentGenerationTaskIds: new Set(['t1']) }); const store = createSheetsIdempotencyStore({ sheets: s, email: EMAIL }); await executeV2QuizComplete({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: { taskId: 't1', planId: 'P', quizSessionId: 'QS1', clientOperationId: 'op-A' } }); const r2 = await executeV2QuizComplete({ userIdentity: { email: EMAIL }, repository: repo, idempotencyStore: store, now: NOW, request: { taskId: 't1', planId: 'P', quizSessionId: 'QS2', clientOperationId: 'op-B' } }); assert.strictEqual(r2.ok, false); assert.strictEqual(r2.code, 'DUPLICATE_COMPLETION'); });
test('18. historical/hidden task rejects', async () => { const r1 = await quizComplete(buildTabs(), { currentGen: new Set() }); assert.strictEqual(r1.code, 'HISTORICAL_TASK_NOT_ACTIONABLE'); const r2 = await quizComplete(buildTabs(), { hidden: new Set(['t1']) }); assert.strictEqual(r2.code, 'HISTORICAL_TASK_NOT_ACTIONABLE'); });
test('19. StudentTopicState upsert called once with practice fields', async () => { const tabs = buildTabs(); const calls = []; await quizComplete(tabs, { upsertTopicState: async (u) => calls.push(u) }); assert.strictEqual(calls.length, 1); assert.strictEqual(calls[0].Subject, 'Polity'); assert.ok(['enough_practice', 'started'].includes(calls[0].PracticeStatus)); assert.ok(typeof calls[0].RecentAccuracy === 'number'); assert.ok(calls[0].ConfidenceLevel); });
test('20. missing quizSessionId rejects (LinkedQuizSessionId required)', async () => { const r = await quizComplete(buildTabs(), { req: { quizSessionId: '' } }); assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'LINKED_QUIZ_SESSION_REQUIRED'); });
test('21. monitor reports complete counters (read-only)', async () => {
  const tabs = { MentorMutationRequests: [['IdempotencyKey', 'Action', 'Status'], ['k', 'COMPLETE', 'completed']], MentorTaskLogs: [['CanonicalAction', 'TaskId'], ['COMPLETE', 't1']], MentorTasks: [['TaskId', 'PlanId', 'Status', 'CompletionSource', 'PendingReason', 'MovedToPendingAt', 'RowVersion'], ['t1', 'P', 'completed', 'quiz_sync', '', '', '2']] };
  const s = { spreadsheets: { values: { async get({ range }) { const t = range.split('!')[0]; return { data: { values: (tabs[t] || []).map(r => [...r]) } }; }, async update() { throw new Error('W'); }, async append() { throw new Error('W'); } } } };
  const a = await auditV2Mutations(s, { affectedPlanId: 'X' });
  assert.strictEqual(a.completeMutationCount, 1);
  assert.strictEqual(a.canonicalCompleteEvents, 1);
  assert.strictEqual(a.completedQuizSyncTaskCount, 1);
});

(async () => { for (const t of tests) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${tests.length} Mentor V2 quiz-sync COMPLETE tests passed.`); process.exit(failed ? 1 : 0); })();
