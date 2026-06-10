#!/usr/bin/env node
/**
 * scripts/test-mentor-repository.js
 *
 * Dependency-free harness for the Phase 2 Mentor repository abstraction.
 * Unlike the mirror-style optimisation tests, this REQUIRES the real modules
 * under lib/mentor/** and asserts their behaviour against the anonymised legacy
 * workbook fixture (scripts/fixtures/mentor-legacy-fixture.js).
 *
 * Run:  node scripts/test-mentor-repository.js
 */
'use strict';

const assert = require('assert');

const { normalizeHeader, buildNormalizedHeaderMap } = require('../lib/mentor/repository/headerNormalizer');
const { parseLegacyPlanVersion, parseProfile, parseTopicState, deriveQuestionCount } = require('../lib/mentor/repository/parsers');
const { deriveGenerations, isolateTasks, deriveLegacyTaskNumbers, validateActivePlanPointer } = require('../lib/mentor/repository/legacyGenerationAdapter');
const { buildSnapshotFromRawData, notImplementedWrites } = require('../lib/mentor/repository/mentorRepository');
const { createSheetsMentorRepository, getMentorRepository } = require('../lib/mentor/repository');
const { compareShadow } = require('../lib/mentor/repository/shadowCompare');
const fx = require('./fixtures/mentor-legacy-fixture');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}
const codes = (diags) => diags.map(d => d.code);

console.log('\nPhase 2 — Mentor repository tests\n');

// 1. header normalisation
test('1. normalizeHeader strips trailing newline / spaces / CRLF', () => {
  assert.strictEqual(normalizeHeader('MentorPlanId\n'), 'MentorPlanId');
  assert.strictEqual(normalizeHeader(' ProgressPercent '), 'ProgressPercent');
  assert.strictEqual(normalizeHeader('LastPlanRefreshAt\r\n'), 'LastPlanRefreshAt');
  assert.strictEqual(normalizeHeader(null), '');
});

// 2. ambiguous header detection
test('2. ambiguous duplicate normalized headers are rejected (not overwritten)', () => {
  const map = buildNormalizedHeaderMap(['PlanId', 'PlanId\n', 'Status']);
  assert.strictEqual(map.hasAmbiguous, true);
  assert.deepStrictEqual(map.ambiguousHeaders, ['PlanId']);
  assert.ok(codes(map.diagnostics).includes('HEADER_AMBIGUOUS'));
  assert.strictEqual(map.index['PlanId'], 0); // first mapping preserved
});
test('2b. missing required header is reported, never silently skipped', () => {
  const map = buildNormalizedHeaderMap(['Foo', 'Bar'], { required: ['Email', 'PlanId'] });
  assert.deepStrictEqual(map.missingRequired.sort(), ['Email', 'PlanId']);
  assert.ok(codes(map.diagnostics).includes('REQUIRED_HEADER_MISSING'));
});
test('2c. trailing-newline header still resolves to canonical index', () => {
  const map = buildNormalizedHeaderMap(fx.PROFILE_HEADERS, { required: ['MentorPlanId'] });
  assert.strictEqual(typeof map.index['MentorPlanId'], 'number');
  assert.ok(codes(map.diagnostics).includes('HEADER_NORMALIZED'));
});

// 3. positional fallback
test('3. positional fallback used + logged when header row absent', () => {
  const raw = { headers: [], rows: [[fx.EMAIL, '', '', '', '', '', '', '', '', '2026-06-08T12:10:00Z', '', 'v1', '{}']] };
  const res = parseProfile(raw, fx.EMAIL);
  assert.ok(res.profile && res.profile.email === fx.EMAIL);
  assert.ok(codes(res.diagnostics).includes('POSITIONAL_FALLBACK_USED'));
});

// 4. legacy v1 parsing
test('4. parseLegacyPlanVersion handles v1 / 1 / blank / invalid', () => {
  assert.strictEqual(parseLegacyPlanVersion('v1').version, 1);
  assert.strictEqual(parseLegacyPlanVersion('1').version, 1);
  assert.strictEqual(parseLegacyPlanVersion(1).version, 1);
  const blank = parseLegacyPlanVersion(''); assert.strictEqual(blank.version, 1); assert.strictEqual(blank.rawLegacyVersion, '');
  const bad = parseLegacyPlanVersion('garbage'); assert.strictEqual(bad.version, 1); assert.strictEqual(bad.rawLegacyVersion, 'garbage');
  assert.strictEqual(parseLegacyPlanVersion('v3').version, 3);
});

// helpers for generation tests
const raw = fx.buildLegacyRawData();
const parsedPlans = require('../lib/mentor/repository/parsers').parsePlans(raw.plans, fx.EMAIL).plans;
const parsedTasks = require('../lib/mentor/repository/parsers').parseTasks(raw.tasks, fx.EMAIL, fx.PLAN_ID).tasks;

// 5. generation-batch derivation
test('5. derives 5 generations from one reused PlanId', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  assert.strictEqual(g.generations.length, 5);
  assert.ok(codes(g.diagnostics).includes('PLAN_ID_REUSED'));
  assert.ok(codes(g.diagnostics).includes('LEGACY_GENERATIONS_DETECTED'));
});

// 6. active-generation selection
test('6. active generation = newest active plan row (g5)', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  assert.strictEqual(g.activeGeneration.ordinal, 5);
});

// 7. current-task isolation
test('7. isolates 3 current-gen tasks, 12 historical', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  const iso = isolateTasks(parsedTasks, g);
  assert.strictEqual(iso.currentTasks.length, 3);
  assert.strictEqual(iso.historicalTasks.length, 12);
  iso.currentTasks.forEach(t => assert.strictEqual(t.generationOrdinal, 5));
});

// 8. deterministic legacy numbering
test('8. legacy task numbers are unique, deterministic, order-independent; sequence untouched', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  const iso = isolateTasks(parsedTasks, g);
  const a = deriveLegacyTaskNumbers(iso.annotated).tasks;
  const nums = a.map(t => t.legacyTaskNumber).sort((x, y) => x - y);
  assert.deepStrictEqual(nums, Array.from({ length: 15 }, (_, i) => i + 1)); // unique 1..15
  // order independence: shuffle input, same mapping per taskId
  const shuffled = [...iso.annotated].reverse();
  const b = deriveLegacyTaskNumbers(shuffled).tasks;
  const mapA = Object.fromEntries(a.map(t => [t.taskId, t.legacyTaskNumber]));
  const mapB = Object.fromEntries(b.map(t => [t.taskId, t.legacyTaskNumber]));
  assert.deepStrictEqual(mapA, mapB);
  // SequenceNumber untouched (still restarts 1,2,3)
  const seqs = a.map(t => t.sequenceNumber).filter(s => s === 1).length;
  assert.strictEqual(seqs, 5); // five "1"s preserved
  assert.strictEqual(deriveLegacyTaskNumbers(iso.annotated).nextTaskNumber, 16);
});

// 9. hidden legacy snoozed handling
test('9. all 10 legacy snoozed hidden; canonical pending empty', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  const iso = isolateTasks(parsedTasks, g);
  assert.strictEqual(iso.hiddenLegacyTasks.length, 10);
  assert.strictEqual(iso.canonicalPendingTasks.length, 0);
});

// 10. completed evidence preservation
test('10. 5 completed evidence rows preserved', () => {
  const g = deriveGenerations(parsedPlans, parsedTasks);
  const iso = isolateTasks(parsedTasks, g);
  assert.strictEqual(iso.completedEvidence.length, 5);
});

// 11. StudentTopicState duplicate handling
test('11. topic-state dedupes by subject+topic keeping newest UpdatedAt', () => {
  const dupRaw = {
    headers: fx.TOPIC_HEADERS,
    rows: [
      [fx.EMAIL, 'Polity', 'Topic A', 'in_progress', 'not_started', 'low', '2026-06-08T10:00:00Z'],
      [fx.EMAIL, 'Polity', 'Topic A', 'done', 'done', 'high', '2026-06-08T12:00:00Z'], // newer
      [fx.EMAIL, '', '', 'done', 'done', 'high', '2026-06-08T12:00:00Z'],               // blank key skipped
    ],
  };
  const res = parseTopicState(dupRaw, fx.EMAIL);
  assert.strictEqual(res.topicState.length, 1);
  assert.strictEqual(res.topicState[0].theoryStatus, 'done'); // newest kept
  assert.ok(codes(res.diagnostics).includes('DUPLICATE_TOPIC_STATE'));
  assert.ok(codes(res.diagnostics).includes('MALFORMED_ROW_SKIPPED'));
});

// 12. plan-pointer validation
test('12. pointer validation selects newest active row; flags reuse', () => {
  const profile = parseProfile(raw.profile, fx.EMAIL).profile;
  const all = require('../lib/mentor/repository/parsers').parsePlans(raw.plans, fx.EMAIL).plans;
  const res = validateActivePlanPointer(profile, all);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.selectedActivePlan.planId, fx.PLAN_ID);
  assert.ok(codes(res.diagnostics).includes('PLAN_ID_REUSED'));
});
test('12b. missing pointer is reported', () => {
  const res = validateActivePlanPointer({ mentorPlanId: '' }, parsedPlans);
  assert.strictEqual(res.valid, false);
  assert.ok(codes(res.diagnostics).includes('POINTER_MISSING'));
});

// 13. malformed-row tolerance + question-count derivation
test('13. malformed task row skipped with diagnostic; bad rows do not crash', () => {
  const badTasks = { headers: fx.TASK_HEADERS, rows: [[fx.EMAIL, fx.PLAN_ID, '', '1', '1', 'practice_task', 'snoozed', 'X', 'Y', 'Z', '2026-06-08T12:13:30.089Z', '']] };
  const res = require('../lib/mentor/repository/parsers').parseTasks(badTasks, fx.EMAIL, fx.PLAN_ID);
  assert.strictEqual(res.tasks.length, 0);
  assert.ok(codes(res.diagnostics).includes('MALFORMED_ROW_SKIPPED'));
});
test('13b. question count derives from type; null when unknown; never written', () => {
  assert.strictEqual(deriveQuestionCount('practice_task', undefined, false).questionCount, 25);
  assert.strictEqual(deriveQuestionCount('coverage_check', undefined, false).questionCount, null);
  assert.strictEqual(deriveQuestionCount('practice_task', '40', true).questionCount, 40); // physical wins
});

// 14. repository snapshot validation (full orchestrator + factory)
test('14. buildSnapshotFromRawData passes all invariants on legacy fixture', () => {
  const snap = buildSnapshotFromRawData(raw, { email: fx.EMAIL });
  assert.strictEqual(snap.currentTasks.length, 3);
  assert.strictEqual(snap.historicalTasks.length, 12);
  assert.strictEqual(snap.completedEvidence.length, 5);
  assert.strictEqual(snap.hiddenLegacyTasks.length, 10);
  assert.strictEqual(snap.canonicalPendingTasks.length, 0);
  assert.strictEqual(snap.studentTopicState.length, 4);
  assert.strictEqual(snap.activeGeneration.ordinal, 5);
  assert.strictEqual(snap.validation.valid, true, JSON.stringify(snap.validation.issues));
});
test('14b. factory (injected source) returns same snapshot; write methods throw', async () => {
  const repo = createSheetsMentorRepository({ dataSource: async () => raw });
  const snap = await repo.getMentorSnapshotData({ email: fx.EMAIL });
  assert.strictEqual(snap.currentTasks.length, 3);
  assert.throws(() => repo.completeTask(), /not implemented/i);
  assert.throws(() => repo.createPlan(), /not implemented/i);
  Object.values(notImplementedWrites()).forEach(fn => assert.throws(fn, /not implemented/i));
});
test('14c. getMentorRepository returns null when flags off (no force/dataSource)', () => {
  const prev = process.env.MENTOR_REPO_V2; delete process.env.MENTOR_REPO_V2;
  const prevS = process.env.MENTOR_REPO_V2_SHADOW; delete process.env.MENTOR_REPO_V2_SHADOW;
  assert.strictEqual(getMentorRepository(), null);
  if (prev !== undefined) process.env.MENTOR_REPO_V2 = prev;
  if (prevS !== undefined) process.env.MENTOR_REPO_V2_SHADOW = prevS;
});

// 15. expected aggregate test from the spec
test('15. spec aggregates: 15 rows read, 5 gens, 3 current, 12 historical, 5 completed, 10 hidden', () => {
  const snap = buildSnapshotFromRawData(raw, { email: fx.EMAIL });
  const totalRead = snap.currentTasks.length + snap.historicalTasks.length;
  assert.strictEqual(totalRead, 15);
  assert.strictEqual(snap.activeGeneration.ordinal, 5);
  assert.strictEqual(snap.currentTasks.length, 3);
  assert.strictEqual(snap.historicalTasks.length, 12);
  assert.strictEqual(snap.completedEvidence.length, 5);
  assert.strictEqual(snap.hiddenLegacyTasks.length, 10);
});

// 16. shadow comparison: legacy 15 vs adapter 3 (expected divergence)
test('16. shadow compare flags expected legacy divergence (15 -> 3)', () => {
  const snap = buildSnapshotFromRawData(raw, { email: fx.EMAIL });
  const legacy = { planId: fx.PLAN_ID, tasks: Array.from({ length: 15 }, (_, i) => ({ status: i < 5 ? 'completed' : 'snoozed' })), studentTopicState: [1, 2, 3, 4] };
  const cmp = compareShadow(legacy, snap);
  assert.strictEqual(cmp.legacy.totalTaskCount, 15);
  assert.strictEqual(cmp.adapter.currentTaskCount, 3);
  assert.strictEqual(cmp.expectedLegacyDivergence, true);
  assert.strictEqual(cmp.adapter.topicStateCount, cmp.legacy.topicStateCount); // topic state preserved 1:1
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
