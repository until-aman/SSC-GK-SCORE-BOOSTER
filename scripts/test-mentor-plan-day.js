#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  DEFAULT_TIMEZONE,
  toLocalDateKey,
  differenceInLocalCalendarDays,
  calculatePlanDayState,
  parseTotalPlanDays,
} = require('../lib/mentor/domain/planDay');
const { buildSnapshotFromRawData } = require('../lib/mentor/repository/mentorRepository');
const { validateRepositorySnapshot } = require('../lib/mentor/domain/invariants');
const { compareShadow } = require('../lib/mentor/repository/shadowCompare');
const flags = require('../lib/mentor/repository/featureFlags');
const fx = require('./fixtures/mentor-legacy-fixture');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ok   ${name}`); }
  catch (err) { failed += 1; console.error(`  FAIL ${name}\n       ${err.stack || err.message}`); }
}
function codes(diags) { return diags.map(d => d.code); }
function state(overrides = {}) {
  return calculatePlanDayState({
    timezone: DEFAULT_TIMEZONE,
    onboardingCompletedAt: '2026-06-08T12:10:00.000Z',
    activePlanCreatedAt: '2026-06-08T12:13:30.089Z',
    daysLeftRange: '46-60',
    legacyActiveDayNumber: 1,
    serverNow: '2026-06-10T04:30:00.000Z',
    ...overrides,
  });
}

console.log('\nPhase 3 - Mentor plan-day tests\n');

test('1. same local day returns calendar day 1', () => {
  assert.strictEqual(state({ serverNow: '2026-06-08T13:00:00.000Z' }).calendarDay, 1);
});
test('2. next local calendar date with less than 24 elapsed hours returns day 2', () => {
  const s = state({ onboardingCompletedAt: '2026-06-08T18:25:00.000Z', serverNow: '2026-06-08T18:35:00.000Z' });
  assert.strictEqual(s.calendarDay, 2);
});
test('3. 8 June to 10 June in IST returns day 3', () => {
  assert.strictEqual(state().calendarDay, 3);
  assert.strictEqual(state().activePlanDay, 3);
});
test('4. UTC boundary uses IST plan date', () => {
  assert.strictEqual(toLocalDateKey('2026-06-09T19:00:00.000Z', DEFAULT_TIMEZONE), '2026-06-10');
  assert.strictEqual(state({ serverNow: '2026-06-09T19:00:00.000Z' }).calendarDay, 3);
});
test('5. missing timezone defaults to Asia/Kolkata', () => {
  const s = state({ timezone: '' });
  assert.strictEqual(s.timezone, DEFAULT_TIMEZONE);
  assert.ok(codes(s.diagnostics).includes('TIMEZONE_DEFAULTED'));
});
test('6. invalid timezone falls back safely', () => {
  const s = state({ timezone: 'Not/AZone' });
  assert.strictEqual(s.timezone, DEFAULT_TIMEZONE);
  assert.ok(codes(s.diagnostics).includes('TIMEZONE_INVALID'));
});
test('7. future start clamps to day 1', () => {
  const s = state({ onboardingCompletedAt: '2026-06-12T00:00:00.000Z' });
  assert.strictEqual(s.calendarDay, 1);
  assert.ok(codes(s.diagnostics).includes('CALENDAR_DAY_CLAMPED'));
});
test('8. past plan end clamps and marks complete', () => {
  const s = state({ daysLeftRange: '3', serverNow: '2026-06-20T00:00:00.000Z' });
  assert.strictEqual(s.calendarDay, 3);
  assert.strictEqual(s.isPlanComplete, true);
  assert.strictEqual(s.daysRemaining, 0);
});
test('9. skipped five days jumps directly to actual calendar day', () => {
  assert.strictEqual(state({ serverNow: '2026-06-13T00:00:00.000Z' }).calendarDay, 6);
});
test('10. unlocked day ahead of calendar day drives active plan day', () => {
  const s = state({ legacyActiveDayNumber: 5, serverNow: '2026-06-08T13:00:00.000Z' });
  assert.strictEqual(s.calendarDay, 1);
  assert.strictEqual(s.activePlanDay, 5);
});
test('11. calendar day ahead of unlocked day drives active plan day', () => {
  assert.strictEqual(state({ legacyActiveDayNumber: 1 }).activePlanDay, 3);
});
test('12. completed tasks do not freeze day', () => {
  const raw = fx.buildLegacyRawData();
  raw.tasks.rows = raw.tasks.rows.map(r => { const x = [...r]; x[6] = 'completed'; return x; });
  const snap = buildSnapshotFromRawData(raw, { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00.000Z' });
  assert.strictEqual(snap.calendarDay, 3);
});
test('13. snoozed tasks do not freeze day', () => {
  const raw = fx.buildLegacyRawData();
  raw.tasks.rows = raw.tasks.rows.map(r => { const x = [...r]; x[6] = 'snoozed'; return x; });
  const snap = buildSnapshotFromRawData(raw, { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00.000Z' });
  assert.strictEqual(snap.calendarDay, 3);
});
test('14. zero active tasks do not freeze day', () => {
  const snap = buildSnapshotFromRawData(fx.buildLegacyRawData(), { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00.000Z' });
  assert.strictEqual(snap.currentTasks.filter(t => t.status === 'active').length, 0);
  assert.strictEqual(snap.calendarDay, 3);
});
test('15. range-based plan-day parsing preserves legacy range-start rule', () => {
  const diags = [];
  assert.strictEqual(parseTotalPlanDays('0-15', '', diags), 15);
  assert.ok(codes(diags).includes('TOTAL_PLAN_DAYS_DERIVED_FROM_RANGE'));
});
test('15b. all common day ranges parse deterministically', () => {
  assert.strictEqual(parseTotalPlanDays('0-15', ''), 15);
});
test('15c. range parser exact expectations', () => {
  assert.strictEqual(parseTotalPlanDays('16-30', ''), 16);
  assert.strictEqual(parseTotalPlanDays('31-45', ''), 31);
  assert.strictEqual(parseTotalPlanDays('46-60', ''), 46);
  assert.strictEqual(parseTotalPlanDays('60+', ''), 60);
  assert.strictEqual(parseTotalPlanDays('25', ''), 25);
});
test('16. CustomDaysLeft is honored for custom/missing range', () => {
  assert.strictEqual(parseTotalPlanDays('Custom', '37'), 37);
  assert.strictEqual(parseTotalPlanDays('', '42'), 42);
});
test('17. malformed days-left falls back with diagnostic', () => {
  const diags = [];
  assert.strictEqual(parseTotalPlanDays('bad-value', '', diags), 45);
  assert.ok(codes(diags).includes('TOTAL_PLAN_DAYS_INVALID'));
});
test('18. onboarding timestamp fallback is used first for legacy data', () => {
  const s = state();
  assert.strictEqual(s.planStartSource, 'onboarding_completed_at');
});
test('19. active-plan-created-at fallback is used when onboarding is missing', () => {
  const s = state({ onboardingCompletedAt: '', activePlanCreatedAt: '2026-06-08T12:13:30.089Z' });
  assert.strictEqual(s.planStartSource, 'active_plan_created_at');
});
test('20. snapshot invariants include canonical day fields', () => {
  const snap = buildSnapshotFromRawData(fx.buildLegacyRawData(), { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00.000Z' });
  assert.strictEqual(snap.calendarDay, 3);
  assert.strictEqual(snap.activePlanDay, 3);
  assert.strictEqual(validateRepositorySnapshot(snap).valid, true);
  const invalid = { ...snap, activePlanDay: 99 };
  assert.strictEqual(validateRepositorySnapshot(invalid).valid, false);
});
test('21. shadow aggregate contains no personal identifier fields', () => {
  const snap = buildSnapshotFromRawData(fx.buildLegacyRawData(), { email: fx.EMAIL, serverNow: '2026-06-10T04:30:00.000Z' });
  const cmp = compareShadow({ plan: { planId: fx.PLAN_ID, activeDayNumber: 1, tasks: [] } }, snap);
  const text = JSON.stringify(cmp);
  assert.ok(!text.includes(fx.EMAIL));
  assert.strictEqual(cmp.adapter.legacyStoredActiveDay, 1);
  assert.strictEqual(cmp.adapter.canonicalCalendarDay, 3);
});
test('22. repository flags default to false', () => {
  const prevA = process.env.MENTOR_REPO_V2;
  const prevB = process.env.MENTOR_REPO_V2_SHADOW;
  const prevC = process.env.MENTOR_CANONICAL_DAY_READ;
  delete process.env.MENTOR_REPO_V2;
  delete process.env.MENTOR_REPO_V2_SHADOW;
  delete process.env.MENTOR_CANONICAL_DAY_READ;
  assert.strictEqual(flags.isMentorRepoV2Enabled(), false);
  assert.strictEqual(flags.isMentorRepoShadowEnabled(), false);
  assert.strictEqual(flags.isMentorCanonicalDayReadEnabled(), false);
  if (prevA !== undefined) process.env.MENTOR_REPO_V2 = prevA;
  if (prevB !== undefined) process.env.MENTOR_REPO_V2_SHADOW = prevB;
  if (prevC !== undefined) process.env.MENTOR_CANONICAL_DAY_READ = prevC;
});
test('23. DST timezone local-date arithmetic is calendar based', () => {
  const start = toLocalDateKey('2026-03-07T17:00:00.000Z', 'America/New_York');
  const current = toLocalDateKey('2026-03-09T16:00:00.000Z', 'America/New_York');
  assert.strictEqual(differenceInLocalCalendarDays(start, current), 2);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
