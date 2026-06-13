#!/usr/bin/env node
/**
 * scripts/test-mentor-rollover-write.js — Phase 10C rollover WRITE-path tests.
 * Fake/in-memory repositories only. NO Sheet writes, NO flag enablement.
 * Run: node scripts/test-mentor-rollover-write.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { executeDailyRolloverWrite } = require('../lib/mentor/services/rolloverWriteExecutor');
const { createSheetsPlanWriter } = require('../lib/mentor/repository/sheetsMutationRepository');
const flags = require('../lib/mentor/repository/featureFlags');
const { userScopeFromIdentity } = require('../lib/mentor/services/taskMutationService');

const NOW = '2026-06-12T06:00:00.000Z';
const PLAN = 'P_W';
const SCOPE = 'u_w';

function fakeTask(o = {}) { return { taskId: o.taskId || 't', planId: PLAN, type: o.type || 'practice_task', status: o.status || 'active', rowVersion: o.rowVersion != null ? o.rowVersion : 1, taskNumber: o.taskNumber || 1, dayNumber: o.dayNumber || 1, isCurrentGeneration: true, isLegacyHidden: false, ...o }; }
function snap({ calendarDay, lastProcessed, tasks = [], totalPlanDays }) { return { calendarDay, lastProcessedCalendarDay: lastProcessed, currentTasks: tasks, canonicalPendingTasks: [], timezone: 'Asia/Kolkata', serverGeneratedAt: NOW, totalPlanDays }; }
function fakeRepo(tasks, { throwOn } = {}) {
  const byId = new Map(tasks.map(t => [t.taskId, { ...t }]));
  const updateCalls = []; const events = [];
  return { _byId: byId, _updates: updateCalls, _events: events,
    async compareAndUpdateTask({ taskId, expected = {}, updates = {} }) {
      if (throwOn && throwOn.taskId === taskId) throw new Error(throwOn.error || 'STALE_ROW_VERSION');
      const t = byId.get(taskId); if (!t) throw new Error('TASK_NOT_FOUND');
      if (expected.rowVersion != null && Number(t.rowVersion) !== Number(expected.rowVersion)) throw new Error('STALE_ROW_VERSION');
      if (expected.status && String(t.status).toLowerCase() !== String(expected.status).toLowerCase()) throw new Error('STALE_EXPECTED_STATUS');
      Object.assign(t, updates); t.rowVersion = Number(t.rowVersion) + 1;
      updateCalls.push({ taskId, updates: { ...updates }, rowVersion: t.rowVersion }); return { ...t };
    },
    async appendTaskEvent(e) { events.push(e); return e; },
  };
}
const fakeStore = () => { const m = new Map(); return { _m: m, async get(k) { return m.get(k) || null; }, async save(k, v) { m.set(k, v); return v; } }; };
const throwingStore = () => ({ async get() { return null; }, async save() { throw new Error('APPEND_BOOM'); } });
const fakePlanWriter = (opts = {}) => { const calls = []; return { _calls: calls, async setLastProcessedCalendarDay(planId, day) { calls.push({ planId, day }); if (opts.reason) return { written: false, reason: opts.reason }; return opts.missing ? { written: false, reason: 'LAST_PROCESSED_COLUMN_MISSING' } : { written: true }; } }; };

// ---- Phase 10D-FIX: real createSheetsPlanWriter against a fake MentorPlans sheet ----
const PLAN_HEADERS = ['PlanId', 'Email', 'Status', 'CreatedAt', 'PlanVersion', 'GenerationId', 'LastProcessedCalendarDay', 'RowVersion', 'UpdatedAt'];
const LP_COL = PLAN_HEADERS.indexOf('LastProcessedCalendarDay');
function planRow({ planId = 'MP_T9B2', email = 'an@test', status = 'invalid', createdAt = '2026-06-11T00:00:00Z', planVersion = '', genId = '', lastProcessed = '' } = {}) {
  return [planId, email, status, createdAt, planVersion, genId, lastProcessed, '1', ''];
}
function fakePlansSheets(rows) {
  const data = [PLAN_HEADERS.slice(), ...rows.map(r => r.slice())]; const updates = [];
  return { _data: data, _updates: updates, spreadsheets: { values: {
    async get({ range }) { return range.split('!')[0] === 'MentorPlans' ? { data: { values: data.map(r => r.slice()) } } : { data: { values: [] } }; },
    async update({ range, requestBody }) { const n = Number(range.split('!A')[1]); data[n - 1] = requestBody.values[0].slice(); updates.push({ rowNum: n }); },
    async append() { throw new Error('append not expected on MentorPlans'); },
  } } };
}
const exec = (s, repo, store, pw, totalPlanDays) => executeDailyRolloverWrite({ snapshot: s, userScope: SCOPE, activePlan: { planId: PLAN }, now: NOW, mutationRepository: repo, idempotencyStore: store || fakeStore(), planWriter: pw || fakePlanWriter(), totalPlanDays: totalPlanDays || s.totalPlanDays });

const RF = ['MENTOR_DAILY_ROLLOVER_V2', 'MENTOR_DAILY_ROLLOVER_ALLOW_ALL', 'MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES'];
function withEnv(v, fn) { const p = {}; RF.forEach(k => p[k] = process.env[k]); Object.entries(v).forEach(([k, val]) => val === undefined ? delete process.env[k] : process.env[k] = val); try { return fn(); } finally { RF.forEach(k => p[k] === undefined ? delete process.env[k] : process.env[k] = p[k]); } }
const ALICE = userScopeFromIdentity({ email: 'alice-10c@test' });

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

// ---- gates (Step 1) ----
test('1. master flag off -> user NOT eligible (no writes)', () => withEnv({ MENTOR_DAILY_ROLLOVER_V2: undefined, MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES: ALICE }, () => assert.strictEqual(flags.isMentorDailyRolloverUserAllowed(ALICE), false)));
test('2. master on + empty allowlist -> NOT eligible (fail closed)', () => withEnv({ MENTOR_DAILY_ROLLOVER_V2: 'true', MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES: '' }, () => assert.strictEqual(flags.isMentorDailyRolloverUserAllowed(ALICE), false)));
test('3. master on + allowlisted -> eligible', () => withEnv({ MENTOR_DAILY_ROLLOVER_V2: 'true', MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES: ALICE }, () => assert.strictEqual(flags.isMentorDailyRolloverUserAllowed(ALICE), true)));
test('4g. master on + non-allowlisted -> NOT eligible', () => withEnv({ MENTOR_DAILY_ROLLOVER_V2: 'true', MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES: ALICE }, () => assert.strictEqual(flags.isMentorDailyRolloverUserAllowed('u_other'), false)));
test('5g. master on + allow-all -> eligible (any authenticated)', () => withEnv({ MENTOR_DAILY_ROLLOVER_V2: 'true', MENTOR_DAILY_ROLLOVER_ALLOW_ALL: 'true' }, () => { assert.strictEqual(flags.isMentorDailyRolloverUserAllowed('u_anything'), true); assert.strictEqual(flags.isMentorDailyRolloverUserAllowed(''), false); }));
test('6g. unset flags fail closed; allow-all only exact "true"; separate from action allow-all', () => {
  withEnv({ MENTOR_DAILY_ROLLOVER_V2: undefined, MENTOR_DAILY_ROLLOVER_ALLOW_ALL: undefined }, () => assert.strictEqual(flags.isMentorDailyRolloverUserAllowed(ALICE), false));
  withEnv({ MENTOR_DAILY_ROLLOVER_V2: 'true', MENTOR_DAILY_ROLLOVER_ALLOW_ALL: 'TRUE' }, () => assert.strictEqual(flags.isMentorDailyRolloverAllowAllEnabled(), false));
});

// ---- write executor ----
test('4. active work task persisted to pending (DAY_ENDED_INCOMPLETE)', async () => {
  const repo = fakeRepo([fakeTask({ taskId: 'W1', type: 'practice_task', status: 'active', rowVersion: 1 })]);
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks: [fakeTask({ taskId: 'W1', type: 'practice_task', status: 'active', rowVersion: 1 })] }), repo);
  assert.strictEqual(r.ok, true);
  const t = repo._byId.get('W1');
  assert.strictEqual(t.status, 'pending');
  assert.strictEqual(t.pendingReason, 'day_ended_incomplete');
  assert.ok(t.movedToPendingAt);
});
test('5. in_progress work task -> IN_PROGRESS_ABANDONED', async () => {
  const tasks = [fakeTask({ taskId: 'W2', type: 'revision_task', status: 'in_progress', rowVersion: 3 })];
  const repo = fakeRepo(tasks);
  await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  assert.strictEqual(repo._byId.get('W2').pendingReason, 'in_progress_abandoned');
});
test('6. quick check persisted as scheduled with NextEligibleAt', async () => {
  const tasks = [fakeTask({ taskId: 'C1', type: 'coverage_check', status: 'active', rowVersion: 1 })];
  const repo = fakeRepo(tasks);
  await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  const t = repo._byId.get('C1');
  assert.strictEqual(t.status, 'scheduled');
  assert.ok(t.nextEligibleAt, 'NextEligibleAt set');
});
test('7. RowVersion increments on persisted task', async () => {
  const tasks = [fakeTask({ taskId: 'W3', type: 'practice_task', status: 'active', rowVersion: 4 })];
  const repo = fakeRepo(tasks);
  await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  assert.strictEqual(Number(repo._byId.get('W3').rowVersion), 5);
});
test('8. stale RowVersion -> skipped (no duplicate), rollover still finalizes', async () => {
  const tasks = [fakeTask({ taskId: 'W4', type: 'practice_task', status: 'active', rowVersion: 1 })];
  const repo = fakeRepo(tasks, { throwOn: { taskId: 'W4', error: 'STALE_ROW_VERSION' } });
  const store = fakeStore();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo, store);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.skippedStaleCount, 1);
  assert.strictEqual(r.appliedCount, 0);
  assert.strictEqual(repo._updates.length, 0, 'no update applied');
  assert.ok(store._m.has(`mentor-rollover:${SCOPE}:${PLAN}:2`), 'finalized after benign skip');
});
test('9. event rows appended once per applied task', async () => {
  const tasks = [fakeTask({ taskId: 'W5', type: 'practice_task', status: 'active' }), fakeTask({ taskId: 'C2', type: 'feedback_task', status: 'active' })];
  const repo = fakeRepo(tasks);
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  assert.strictEqual(repo._events.length, r.appliedCount);
  assert.ok(repo._events.every(e => e.idempotencyKey && e.source === 'daily_rollover'));
});
test('10. idempotency row finalized after successful writes', async () => {
  const tasks = [fakeTask({ taskId: 'W6', type: 'practice_task', status: 'active' })];
  const store = fakeStore();
  await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), fakeRepo(tasks), store);
  const saved = store._m.get(`mentor-rollover:${SCOPE}:${PLAN}:2`);
  assert.ok(saved, 'idempotency saved');
  assert.strictEqual(saved.result.event.action, 'ROLLOVER');
});
test('11. idempotent replay writes nothing', async () => {
  const tasks = [fakeTask({ taskId: 'W7', type: 'practice_task', status: 'active' })];
  const store = fakeStore();
  const s = snap({ calendarDay: 2, lastProcessed: 1, tasks });
  await exec(s, fakeRepo(tasks), store);
  const repo2 = fakeRepo(tasks);
  const r2 = await exec(s, repo2, store);
  assert.strictEqual(r2.idempotent, true);
  assert.strictEqual(repo2._updates.length, 0, 'no writes on replay');
});
test('12. partial failure (non-stale) does NOT finalize idempotency', async () => {
  const tasks = [fakeTask({ taskId: 'W8', type: 'practice_task', status: 'active' }), fakeTask({ taskId: 'W9', type: 'revision_task', status: 'active' })];
  const repo = fakeRepo(tasks, { throwOn: { taskId: 'W9', error: 'NETWORK_BOOM' } });
  const store = fakeStore();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo, store);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'ROLLOVER_PARTIAL_FAILURE');
  assert.ok(!store._m.has(`mentor-rollover:${SCOPE}:${PLAN}:2`), 'idempotency NOT finalized -> re-run resumes');
});
test('13. LastProcessedCalendarDay written after success', async () => {
  const tasks = [fakeTask({ taskId: 'W10', type: 'practice_task', status: 'active' })];
  const pw = fakePlanWriter();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), fakeRepo(tasks), fakeStore(), pw);
  assert.deepStrictEqual(pw._calls, [{ planId: PLAN, day: 2 }]);
  assert.strictEqual(r.lastProcessedWritten, true);
  // tolerates a missing column
  const pw2 = fakePlanWriter({ missing: true });
  const r2 = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks: [fakeTask({ taskId: 'W10b', type: 'practice_task', status: 'active' })] }), fakeRepo([fakeTask({ taskId: 'W10b', type: 'practice_task', status: 'active' })]), fakeStore(), pw2);
  assert.strictEqual(r2.lastProcessedWritten, false);
  assert.ok(r2.diagnostics.includes('LAST_PROCESSED_COLUMN_MISSING'));
});
test('14. already-processed day -> no-op, no writes', async () => {
  const tasks = [fakeTask({ taskId: 'W11', type: 'practice_task', status: 'active' })];
  const repo = fakeRepo(tasks); const store = fakeStore();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 2, tasks }), repo, store);
  assert.strictEqual(r.rolloverRequired, false);
  assert.strictEqual(repo._updates.length, 0);
  assert.ok(!store._m.size, 'no idempotency row on no-op');
});
test('15. plan.js calls the executor ONLY inside the rollover-eligibility gate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'mentor', 'plan.js'), 'utf8');
  assert.ok(/if \(isMentorDailyRolloverUserAllowed\(userScope\)\)[\s\S]{0,400}executeDailyRolloverWrite\(/.test(src), 'executor must be gated by isMentorDailyRolloverUserAllowed');
  assert.ok(/userScopeFromIdentity\(\{ email: session\.user\.email \}\)/.test(src), 'real userScope, not placeholder');
  assert.ok(!/userScope:\s*['"]authenticated['"]/.test(src), 'placeholder "authenticated" removed');
});
test('16. never persists more than 3 active (planner cap upheld; executor moves only)', async () => {
  // 4 active work tasks -> all move to pending; executor never activates beyond cap
  const tasks = Array.from({ length: 4 }, (_, i) => fakeTask({ taskId: `M${i}`, type: 'practice_task', status: 'active', taskNumber: i + 1 }));
  const repo = fakeRepo(tasks);
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  assert.ok(r.appliedCount <= 4);
  // no task ends up 'active' beyond the cap — all work moved to pending
  assert.ok([...repo._byId.values()].filter(t => t.status === 'active').length <= 3);
});
test('17. no net-new task ids generated', async () => {
  const tasks = [fakeTask({ taskId: 'N1', type: 'practice_task', status: 'active' }), fakeTask({ taskId: 'N2', type: 'coverage_check', status: 'active' })];
  const repo = fakeRepo(tasks);
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo);
  (r.appliedTaskIds || []).forEach(id => assert.ok(['N1', 'N2'].includes(id)));
  assert.strictEqual(repo._byId.size, 2, 'no tasks added');
});
test('18. final-day policy: no pending-move when calendarDay >= totalPlanDays', async () => {
  const tasks = [fakeTask({ taskId: 'F1', type: 'practice_task', status: 'active' })];
  const repo = fakeRepo(tasks);
  const r = await exec(snap({ calendarDay: 46, lastProcessed: 45, tasks, totalPlanDays: 46 }), repo);
  assert.strictEqual(r.finalDay, true);
  assert.strictEqual(r.movedToPendingCount, 0);
  assert.strictEqual(repo._updates.length, 0, 'no task moved on the final day');
  assert.ok(r.diagnostics.includes('FINAL_DAY_NO_PENDING_MOVE'));
  // totalPlanDays unknown -> flagged as a pre-live blocker
  const r2 = await exec(snap({ calendarDay: 5, lastProcessed: 4, tasks: [fakeTask({ taskId: 'F2', type: 'practice_task', status: 'active' })] }), fakeRepo([fakeTask({ taskId: 'F2', type: 'practice_task', status: 'active' })]));
  assert.ok(r2.diagnostics.includes('FINAL_DAY_POLICY_UNKNOWN'));
});

// ---- Phase 10D-FIX Bug A: plan-writer targets the ACTIVE / current-generation row ----
test('A1. setLastProcessedCalendarDay writes ONLY the active row among 12 same-PlanId rows; invalid rows unchanged', async () => {
  // 11 invalid (older) + 1 active (newest) — the exact Phase 10D pilot shape.
  const rows = [];
  for (let i = 0; i < 11; i++) rows.push(planRow({ status: 'invalid', createdAt: `2026-06-11T0${i % 10}:00:00Z` }));
  rows.push(planRow({ status: 'active', createdAt: '2026-06-12T03:09:44Z' }));
  const sheets = fakePlansSheets(rows);
  const pw = createSheetsPlanWriter({ sheets, email: 'an@test' });
  const w = await pw.setLastProcessedCalendarDay('MP_T9B2', 3);
  assert.strictEqual(w.written, true);
  assert.strictEqual(w.sheetRow, 13, 'active row is sheetRow 13 (header + 11 invalid + active)');
  // only the active row got the value; all 11 invalid rows stay blank
  assert.strictEqual(sheets._data[12][LP_COL], '3');
  for (let i = 1; i <= 11; i++) assert.strictEqual(sheets._data[i][LP_COL], '', `invalid row ${i} unchanged`);
  assert.strictEqual(sheets._updates.length, 1);
});
test('A2. no active row -> PLAN_ROW_NO_ACTIVE, nothing written', async () => {
  const sheets = fakePlansSheets([planRow({ status: 'invalid' }), planRow({ status: 'invalid' })]);
  const pw = createSheetsPlanWriter({ sheets, email: 'an@test' });
  const w = await pw.setLastProcessedCalendarDay('MP_T9B2', 3);
  assert.strictEqual(w.written, false);
  assert.strictEqual(w.reason, 'PLAN_ROW_NO_ACTIVE');
  assert.strictEqual(sheets._updates.length, 0);
});
test('A3. two active rows, same CreatedAt, no other discriminator -> PLAN_ROW_AMBIGUOUS (fail closed)', async () => {
  const sheets = fakePlansSheets([
    planRow({ status: 'active', createdAt: '2026-06-12T03:00:00Z' }),
    planRow({ status: 'active', createdAt: '2026-06-12T03:00:00Z' }),
  ]);
  const pw = createSheetsPlanWriter({ sheets, email: 'an@test' });
  const w = await pw.setLastProcessedCalendarDay('MP_T9B2', 3);
  assert.strictEqual(w.written, false);
  assert.strictEqual(w.reason, 'PLAN_ROW_AMBIGUOUS');
  assert.strictEqual(sheets._updates.length, 0);
});
test('A4. two active rows, different CreatedAt -> newest active wins (not ambiguous)', async () => {
  const sheets = fakePlansSheets([
    planRow({ status: 'active', createdAt: '2026-06-10T00:00:00Z' }),
    planRow({ status: 'active', createdAt: '2026-06-12T00:00:00Z' }),
  ]);
  const pw = createSheetsPlanWriter({ sheets, email: 'an@test' });
  const w = await pw.setLastProcessedCalendarDay('MP_T9B2', 7);
  assert.strictEqual(w.written, true);
  assert.strictEqual(sheets._data[2][LP_COL], '7'); // the newer active row (sheetRow 3)
  assert.strictEqual(sheets._data[1][LP_COL], '');
});
test('A5. getLastProcessedCalendarDay reads the active row (ignores stale rows that carry a value)', async () => {
  const sheets = fakePlansSheets([
    planRow({ status: 'invalid', createdAt: '2026-06-11T00:00:00Z', lastProcessed: '99' }), // stale, must be ignored
    planRow({ status: 'active', createdAt: '2026-06-12T00:00:00Z', lastProcessed: '4' }),
  ]);
  const pw = createSheetsPlanWriter({ sheets, email: 'an@test' });
  assert.strictEqual(await pw.getLastProcessedCalendarDay('MP_T9B2'), 4);
});

// ---- Phase 10D-FIX Bug B: finalization failures are surfaced, never silent partial success ----
test('B1. day-marker UNRESOLVED (ambiguous active row) -> ok:false ROLLOVER_DAY_MARKER_UNRESOLVED, NOT finalized', async () => {
  const tasks = [fakeTask({ taskId: 'U1', type: 'practice_task', status: 'active' })];
  const repo = fakeRepo(tasks); const store = fakeStore();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo, store, fakePlanWriter({ reason: 'PLAN_ROW_AMBIGUOUS' }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'ROLLOVER_DAY_MARKER_UNRESOLVED');
  assert.strictEqual(r.reason, 'PLAN_ROW_AMBIGUOUS');
  assert.ok(!store._m.size, 'idempotency NOT finalized -> re-run can resume after data fix');
});
test('B2. idempotency finalization throws -> ok:false ROLLOVER_FINALIZE_FAILED (no silent partial success)', async () => {
  const tasks = [fakeTask({ taskId: 'U2', type: 'practice_task', status: 'active' })];
  const repo = fakeRepo(tasks);
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), repo, throwingStore(), fakePlanWriter());
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'ROLLOVER_FINALIZE_FAILED');
  assert.strictEqual(r.error, 'APPEND_BOOM');
  assert.strictEqual(r.appliedCount, 1, 'tasks were applied; failure is at finalization');
});
test('B3. success path still finalizes Action=ROLLOVER (regression guard)', async () => {
  const tasks = [fakeTask({ taskId: 'U3', type: 'practice_task', status: 'active' })];
  const store = fakeStore();
  const r = await exec(snap({ calendarDay: 2, lastProcessed: 1, tasks }), fakeRepo(tasks), store, fakePlanWriter());
  assert.strictEqual(r.ok, true);
  assert.strictEqual(store._m.get(`mentor-rollover:${SCOPE}:${PLAN}:2`).result.event.action, 'ROLLOVER');
});
test('B4. plan.js surfaces rollover write failure (no silent swallow on the rollover chain)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'mentor', 'plan.js'), 'utf8');
  assert.ok(/\[mentor-rollover-write\] FAILED/.test(src), 'must log a FAILED line when result.ok === false');
  // the rollover .then(...) chain must end in a logging .catch, not an empty swallow
  assert.ok(/\[mentor-rollover\] unhandled/.test(src), 'rollover chain must log unhandled errors');
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor rollover WRITE tests passed.`); process.exit(failed ? 1 : 0); })();
