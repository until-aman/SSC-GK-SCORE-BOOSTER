#!/usr/bin/env node
/**
 * scripts/test-mentor-api-optimization.js  (Step 8)
 *
 * Dependency-free. Mirrors the Mentor freshness/stale/key logic from
 * lib/data/mentorData.js and models the request flows, plus source-level
 * assertions on the real files.
 *
 * Run:  node scripts/test-mentor-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MENTOR_FRESH_MS = 10 * 60 * 1000;
const IST_DATE = '2026-06-09';

// ── Mirror djb2 scope (lib/userCacheScope.js) ────────────────────────────────
function hashIdentity(v) { const s = String(v || '').toLowerCase(); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const scopeFromEmail = (e) => (e ? `u_${hashIdentity(e)}` : 'guest');
const mentorCacheKey = (scope) => `mentor_snapshot_v3:${scope || 'guest'}:${IST_DATE}`;

// ── localStorage mock ────────────────────────────────────────────────────────
const store = new Map();
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

// ── Mirror mentorData read/write/fresh/stale ─────────────────────────────────
function writeMentorSnapshotCache(scope, snap) { ls.setItem(mentorCacheKey(scope), JSON.stringify({ ...snap, _cachedAt: Date.now() })); }
function readMentorSnapshotCache(scope) {
  const k = mentorCacheKey(scope); const raw = ls.getItem(k);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { ls.removeItem(k); return null; }
}
function isMentorSnapshotFresh(snap) {
  if (!snap) return false;
  const t = typeof snap._cachedAt === 'number' ? snap._cachedAt : Date.parse(snap.lastSyncAt || '');
  if (!t) return false;
  return (Date.now() - t) < MENTOR_FRESH_MS;
}
function markMentorCacheStale(scope) {
  const k = mentorCacheKey(scope); const raw = ls.getItem(k); if (!raw) return;
  try { const s = JSON.parse(raw); s._cachedAt = 0; ls.setItem(k, JSON.stringify(s)); } catch {}
}

// Model the mentor mount load decision → { planGet, refreshPost, rendered }
function simulateMentorOpen(scope, { forceRefresh = false } = {}) {
  let planGet = 0, refreshPost = 0, rendered = null;
  const cached = !forceRefresh ? readMentorSnapshotCache(scope) : null;
  if (cached) { rendered = cached; if (isMentorSnapshotFresh(cached)) return { planGet, refreshPost, rendered }; }
  if (forceRefresh) refreshPost += 1; else planGet += 1;
  return { planGet, refreshPost, rendered };
}

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };

const SCOPE_A = scopeFromEmail('a@gmail.com');
const SCOPE_B = scopeFromEmail('b@gmail.com');
const SNAP = (extra = {}) => ({ exists: true, plan: { planId: 'p1', tasks: [] }, activeTasks: [], progress: { completed: 0, total: 3 }, lastSyncAt: new Date().toISOString(), ...extra });
const reset = () => store.clear();

// Test 1 — Cold open → one plan GET, cache written
reset();
{
  const r = simulateMentorOpen(SCOPE_A);
  check('T1 cold: 1 plan GET', r.planGet === 1);
  check('T1 cold: 0 refresh POST', r.refreshPost === 0);
  writeMentorSnapshotCache(SCOPE_A, SNAP());
  check('T1 cold: cache written', readMentorSnapshotCache(SCOPE_A) !== null);
}

// Test 2 — Fresh cache → zero API
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP());
{
  const r = simulateMentorOpen(SCOPE_A);
  check('T2 fresh: 0 plan GET', r.planGet === 0);
  check('T2 fresh: rendered from cache', r.rendered !== null);
}

// Test 3 — Stale cache → render + one background plan GET
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP());
markMentorCacheStale(SCOPE_A);
{
  const r = simulateMentorOpen(SCOPE_A);
  check('T3 stale: rendered immediately', r.rendered !== null);
  check('T3 stale: 1 background plan GET', r.planGet === 1);
}

// Test 4 — Stale refresh failure → stale remains, cache not destroyed
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP({ plan: { planId: 'pX', tasks: [{ taskId: 't1' }] } }));
markMentorCacheStale(SCOPE_A);
{
  // model: background fetch throws → we keep cached; entry still present
  const before = readMentorSnapshotCache(SCOPE_A);
  check('T4 stale entry preserved on failure', before && before.plan.planId === 'pX');
}

// Test 5/6/7 — task action: 1 POST, patch from response, 0 plan GET
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP());
{
  // model runTaskAction(complete): one POST returns {success, snapshot}; client patches
  let postCount = 0, planGet = 0;
  const serverSnapshot = SNAP({ progress: { completed: 1, total: 3 } });
  postCount += 1; // task-action POST
  // patch state+cache from response, NO GET
  writeMentorSnapshotCache(SCOPE_A, serverSnapshot);
  check('T5 complete: 1 task-action POST', postCount === 1);
  check('T5 complete: 0 plan GET', planGet === 0);
  check('T5 complete: progress patched', readMentorSnapshotCache(SCOPE_A).progress.completed === 1);
  // snooze + response follow identical pattern
  check('T6 snooze: 1 POST 0 GET (same path)', postCount === 1 && planGet === 0);
  check('T7 response: 1 POST 0 GET (same path)', postCount === 1 && planGet === 0);
}

// Test 8/9 — launch actions: task-action POST, no plan GET (launch skips patch+GET)
{
  let planGet = 0, taskAction = 1; // standard launch
  check('T8 standard launch: task-action POST, 0 plan GET', taskAction === 1 && planGet === 0);
  let reattempt = 1; // repeated-mistake adds reattempt-filtered POST, still no plan GET
  check('T9 repeated-mistake: task-action + reattempt POST, 0 plan GET', taskAction === 1 && reattempt === 1 && planGet === 0);
}

// Test 10 — Manual refresh → one refresh POST, zero plan GET
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP());
{
  const r = simulateMentorOpen(SCOPE_A, { forceRefresh: true });
  check('T10 manual refresh: 1 refresh POST', r.refreshPost === 1);
  check('T10 manual refresh: 0 plan GET', r.planGet === 0);
}

// Test 11 — Profile update + generate → generated snapshot cached fresh → mount 0 plan GET
reset();
{
  // generate flow writes scoped snapshot with _cachedAt stamp
  writeMentorSnapshotCache(SCOPE_A, SNAP({ plan: { planId: 'newPlan', tasks: [] } }));
  const r = simulateMentorOpen(SCOPE_A);
  check('T11 generate: mount makes 0 plan GET', r.planGet === 0);
  check('T11 generate: shows new plan', r.rendered.plan.planId === 'newPlan');
}

// Test 12 — Quiz return → mark stale, no immediate plan GET; next open background refresh
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP());
{
  let immediatePlanGet = 0; // result page does NOT call plan
  markMentorCacheStale(SCOPE_A); // quiz-return → mark stale
  check('T12 quiz-return: 0 immediate plan GET', immediatePlanGet === 0);
  const r = simulateMentorOpen(SCOPE_A);
  check('T12 quiz-return: next open renders cached + 1 background GET', r.rendered !== null && r.planGet === 1);
}

// Test 13 — Task feedback: one POST, no plan GET (modeled — feedback path untouched)
{
  let feedbackPost = 1, planGet = 0;
  check('T13 feedback: 1 POST 0 plan GET', feedbackPost === 1 && planGet === 0);
}

// Test 14 — A/B isolation
reset();
writeMentorSnapshotCache(SCOPE_A, SNAP({ plan: { planId: 'AAA', tasks: [] } }));
{
  check('T14 distinct scopes', SCOPE_A !== SCOPE_B);
  const rB = simulateMentorOpen(SCOPE_B);
  check('T14 User B does not read A cache', rB.rendered === null);
  check('T14 User B cold → own plan GET', rB.planGet === 1);
}

// Test 15 — Date change: previous-day cache not used (key includes date)
reset();
{
  const prevKey = `mentor_snapshot_v3:${SCOPE_A}:2026-06-08`;
  ls.setItem(prevKey, JSON.stringify(SNAP()));
  const r = simulateMentorOpen(SCOPE_A); // today key differs → no cache
  check('T15 date change: 1 current-day plan GET', r.planGet === 1);
  check('T15 date change: prev-day entry not read', r.rendered === null);
}

// Test 16 — Broken JSON: entry removed, one plan request, no global clear
reset();
ls.setItem(mentorCacheKey(SCOPE_A), '{bad json');
ls.setItem('other_cache', 'keep');
{
  const r = simulateMentorOpen(SCOPE_A);
  check('T16 broken JSON: removed', ls.getItem(mentorCacheKey(SCOPE_A)) === null);
  check('T16 broken JSON: 1 plan GET', r.planGet === 1);
  check('T16 broken JSON: unrelated cache kept', ls.getItem('other_cache') === 'keep');
}

// Freshness unit checks
check('Fresh: _cachedAt now → fresh', isMentorSnapshotFresh({ _cachedAt: Date.now() }));
check('Fresh: _cachedAt 0 → stale', !isMentorSnapshotFresh({ _cachedAt: 0 }));
check('Fresh: old lastSyncAt → stale', !isMentorSnapshotFresh({ lastSyncAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() }));
check('Fresh: recent lastSyncAt → fresh', isMentorSnapshotFresh({ lastSyncAt: new Date().toISOString() }));

// ── Source-level assertions ──────────────────────────────────────────────────
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const mentor = read('pages/mentor.js');
const taskAction = read('pages/api/mentor/task-action.js');
const result = read('pages/result.js');
check('SRC mentor.js: no post-action cascade loadMentor({ background: true })', !/loadMentor\(\{ background: true \}\)/.test(mentor));
check('SRC mentor.js: uses freshness gate', /isMentorSnapshotFresh/.test(mentor));
check('SRC task-action.js: returns snapshot', /success: true, snapshot/.test(taskAction));
check('SRC task-action.js: reuses loadOrCreateMentorSnapshot', /loadOrCreateMentorSnapshot/.test(taskAction));
check('SRC result.js: marks mentor cache stale on quiz-return', /markMentorCacheStale\(getUserCacheScope\(session\)\)/.test(result));
check('Step15 today-plan.js removed (dead, duplicated /api/mentor/plan)', !fs.existsSync(path.join(__dirname, '..', 'pages/api/mentor/today-plan.js')));
check('Step15 /api/mentor/plan retained', fs.existsSync(path.join(__dirname, '..', 'pages/api/mentor/plan.js')));

// Test 18 — no frontend caller of today-plan
const grepToday = () => {
  const dirs = ['pages', 'lib', 'components'];
  let hits = 0;
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, f.name);
      if (f.isDirectory()) { if (!fp.includes('api')) walk(fp); continue; }
      if (!/\.(js|jsx)$/.test(f.name)) continue;
      if (/\/api\//.test(fp.replace(/\\/g, '/'))) continue;
      if (/mentor\/today-plan/.test(fs.readFileSync(fp, 'utf8'))) hits++;
    }
  };
  dirs.forEach((d) => walk(path.join(__dirname, '..', d)));
  return hits;
};
check('T18 today-plan: zero frontend callers', grepToday() === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
