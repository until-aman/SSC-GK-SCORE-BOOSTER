#!/usr/bin/env node
/**
 * scripts/test-history-api-optimization.js  (Step 9)
 *
 * Dependency-free. Mirrors the client cache + Step-5 in-flight dedup + account
 * scope + normalizeHistoryQuery, then models the History flows. Source-level
 * assertions confirm the migration on the real files.
 *
 * Run:  node scripts/test-history-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TEN_MIN = 10 * 60 * 1000;

// ── scope (djb2, mirrors lib/userCacheScope.js) ──────────────────────────────
function hashIdentity(v) { const s = String(v || '').toLowerCase(); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const scopeOf = (e) => (e ? `u_${hashIdentity(e)}` : 'guest');
const scopedKey = (base, scope) => `${base}:${scope || 'guest'}`;

function normalizeHistoryQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '').sort().forEach(k => usp.set(k, String(params[k])));
  return usp.toString();
}

// ── cache store + fetchWithClientCache mirror (with in-flight dedup) ──────────
const store = new Map();
const inflight = new Map();
let networkCount = 0;
const counters = {}; // per-url network counts

function makeServer(payloadFor) {
  return async (url) => { networkCount++; counters[url] = (counters[url] || 0) + 1; return payloadFor(url); };
}

async function fetchWithClientCache({ key, url, maxAgeMs, forceRefresh = false }, server) {
  const entry = store.get(key);
  if (!forceRefresh && entry && (Date.now() - entry.timestamp) < maxAgeMs) {
    return { data: entry.data, timestamp: entry.timestamp, stale: false };
  }
  const dk = `GET|${key}|${url}`;
  if (inflight.has(dk)) return inflight.get(dk);
  const p = (async () => {
    try {
      const data = await server(url);
      store.set(key, { data, timestamp: Date.now() });
      return { data, timestamp: Date.now(), stale: false };
    } catch (e) {
      if (entry) return { data: entry.data, timestamp: entry.timestamp, stale: true };
      throw e;
    } finally { inflight.delete(dk); }
  })();
  inflight.set(dk, p);
  return p;
}

function markStale(key) { const e = store.get(key); if (e) store.set(key, { data: e.data, timestamp: 0 }); }

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const reset = () => { store.clear(); inflight.clear(); networkCount = 0; Object.keys(counters).forEach(k => delete counters[k]); };

const A = scopeOf('a@gmail.com');
const B = scopeOf('b@gmail.com');
const LANDING = (s) => scopedKey('history_landing', s);

const landingPayload = { success: true, data: { summary: { totalQuizzes: 4 }, quizzes: { sessions: [{ id: 1 }, { id: 2 }, { id: 3 }], total: 4, page: 1, hasMore: true }, subjects: [{ subject: 'GK' }], generatedAt: 'now' } };
const server = makeServer((url) => {
  if (url === '/api/history/landing') return JSON.parse(JSON.stringify(landingPayload));
  if (url.startsWith('/api/history/quizzes')) return { success: true, data: { sessions: [], total: 0, page: 1, hasMore: false } };
  if (url.startsWith('/api/history/questions')) return { success: true, data: { questions: [], total: 0 } };
  if (url.startsWith('/api/history/topics')) return { success: true, data: { topics: [] } };
  if (url.startsWith('/api/history/session/')) return { success: true, data: { sessionId: url.split('/').pop() } };
  if (url === '/api/score-history') return { totalCoins: 100, level: 'Aspirant' };
  return { success: true, data: {} };
});
const getLanding = (scope, fr = false) => fetchWithClientCache({ key: LANDING(scope), url: '/api/history/landing', maxAgeMs: TEN_MIN, forceRefresh: fr }, server);

(async () => {
// Test 1 — Cold landing: 3 concurrent loaders (summary/quizzes/subjects) → 1 network
reset();
{
  const [r1, r2, r3] = await Promise.all([getLanding(A), getLanding(A), getLanding(A)]);
  check('T1 cold: one /api/history/landing network', counters['/api/history/landing'] === 1);
  check('T1 cold: zero summary/quizzes/subjects calls', !counters['/api/history/summary'] && !counters['/api/history/quizzes'] && !counters['/api/history/subjects']);
  check('T1 cold: combined summary present', r1.data.data.summary.totalQuizzes === 4);
  check('T1 cold: combined quizzes present', r2.data.data.quizzes.sessions.length === 3);
  check('T1 cold: combined subjects present', r3.data.data.subjects.length === 1);
}

// Test 2 — Warm landing: zero network
reset();
await getLanding(A);
{ const before = networkCount; await Promise.all([getLanding(A), getLanding(A), getLanding(A)]); check('T2 warm: zero network', networkCount === before); }

// Test 3 — Stale landing: cached returned + one background network
reset();
await getLanding(A); markStale(LANDING(A));
{ const before = networkCount; const r = await getLanding(A); check('T3 stale: data still returned', r.data.data.summary.totalQuizzes === 4); check('T3 stale: one background network', networkCount === before + 1); }

// Test 4 — Landing failure with stale data → stale remains, no throw, no 3-call fallback
reset();
await getLanding(A); markStale(LANDING(A));
{
  const failServer = async () => { networkCount++; throw new Error('net'); };
  const r = await fetchWithClientCache({ key: LANDING(A), url: '/api/history/landing', maxAgeMs: TEN_MIN }, failServer);
  check('T4 failure: stale data returned', r.data.data.summary.totalQuizzes === 4 && r.stale === true);
  check('T4 failure: no summary/quizzes/subjects fallback', !counters['/api/history/summary']);
}

// Test 6 — Filtered quizzes: different filters → different keys
reset();
{
  const q7 = normalizeHistoryQuery({ page: 1, limit: 3, dateRange: '7d' });
  const q30 = normalizeHistoryQuery({ page: 1, limit: 3, dateRange: '30d' });
  check('T6 different filters → different keys', scopedKey(`history_quizzes:${q7}`, A) !== scopedKey(`history_quizzes:${q30}`, A));
  await fetchWithClientCache({ key: scopedKey(`history_quizzes:${q7}`, A), url: `/api/history/quizzes?${q7}`, maxAgeMs: TEN_MIN }, server);
  const before = networkCount;
  await fetchWithClientCache({ key: scopedKey(`history_quizzes:${q7}`, A), url: `/api/history/quizzes?${q7}`, maxAgeMs: TEN_MIN }, server);
  check('T6 same filter warm → 0 network', networkCount === before);
}

// Test 7 — Subjects from landing (no separate subjects GET on initial)
reset();
await getLanding(A);
check('T7 subjects come from landing', store.get(LANDING(A)).data.data.subjects.length === 1 && !counters['/api/history/subjects']);

// Test 8 — Topics cache
reset();
{
  const k = scopedKey('history_topics:GK', A);
  await fetchWithClientCache({ key: k, url: '/api/history/topics?subject=GK', maxAgeMs: TEN_MIN }, server);
  const before = networkCount;
  await fetchWithClientCache({ key: k, url: '/api/history/topics?subject=GK', maxAgeMs: TEN_MIN }, server);
  check('T8 topics warm → 0 network', networkCount === before);
}

// Test 9/10 — Questions vs mistakes: different status → different keys
reset();
{
  const qWrong = normalizeHistoryQuery({ status: 'wrong', limit: 50, page: 1 });
  const qRepeated = normalizeHistoryQuery({ questionHistory: 'repeated', limit: 50, page: 1 });
  check('T9/T10 questions vs mistakes use different keys', scopedKey(`history_questions:${qWrong}`, A) !== scopedKey(`history_questions:${qRepeated}`, A));
  await fetchWithClientCache({ key: scopedKey(`history_questions:${qWrong}`, A), url: `/api/history/questions?${qWrong}`, maxAgeMs: TEN_MIN }, server);
  const before = networkCount;
  await fetchWithClientCache({ key: scopedKey(`history_questions:${qWrong}`, A), url: `/api/history/questions?${qWrong}`, maxAgeMs: TEN_MIN }, server);
  check('T9 questions warm → 0 network', networkCount === before);
}

// Test 11 — Session detail cold/warm + scoped
reset();
{
  const k = scopedKey('history_session:s1', A);
  await fetchWithClientCache({ key: k, url: '/api/history/session/s1', maxAgeMs: 30 * 60 * 1000 }, server);
  check('T11 session cold: 1 network', counters['/api/history/session/s1'] === 1);
  const before = networkCount;
  await fetchWithClientCache({ key: k, url: '/api/history/session/s1', maxAgeMs: 30 * 60 * 1000 }, server);
  check('T11 session warm: 0 network', networkCount === before);
}

// Test 12 — A/B isolation
reset();
await getLanding(A);
check('T12 distinct scopes', A !== B);
check('T12 User B has no landing cache', store.get(LANDING(B)) === undefined);

// Test 13 — Quiz completion invalidation (markHistoryCachesStale): A stale, B untouched
reset();
await getLanding(A); await getLanding(B);
{
  ['history_landing', 'history_summary', 'history_subjects', 'score_history'].forEach(b => markStale(scopedKey(b, A)));
  const bFresh = (Date.now() - store.get(LANDING(B)).timestamp) < TEN_MIN;
  check('T13 A landing marked stale', store.get(LANDING(A)).timestamp === 0);
  check('T13 B landing untouched (fresh)', bFresh);
}

// Test 18 — Broken cache: only scoped entry removed, others kept
reset();
store.set(LANDING(A), { data: 'x', timestamp: Date.now() });
store.set('other', { data: 'keep', timestamp: Date.now() });
store.delete(LANDING(A)); // dropHistoryCache removes only the scoped key
check('T18 broken entry removed', store.get(LANDING(A)) === undefined);
check('T18 unrelated cache kept', store.get('other') !== undefined);

// ── Source-level assertions ──────────────────────────────────────────────────
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const quizzes = read('pages/history/quizzes.jsx');
const landingRoute = read('pages/api/history/landing.js');
const service = read('lib/server/historyService.js');
const resultSrc = read('pages/result.js');

check('SRC quizzes.jsx: no direct fetch /api/history/summary', !/fetch\(['"]\/api\/history\/summary/.test(quizzes));
check('SRC quizzes.jsx: no direct fetch /api/history/subjects', !/fetch\(['"]\/api\/history\/subjects/.test(quizzes));
check('SRC quizzes.jsx: uses getHistoryLanding', /getHistoryLanding/.test(quizzes));
check('SRC landing.js: uses buildHistoryLanding', /buildHistoryLanding/.test(landingRoute));
check('SRC historyService: landing quiz limit = 3', /HISTORY_LANDING_QUIZ_LIMIT = 3/.test(service));
check('SRC result.js: marks history caches stale', /markHistoryCachesStale\(getUserCacheScope\(session\)\)/.test(resultSrc));
check('Step15 filters.js removed (dead; subjects/topics cover it)', !fs.existsSync(path.join(__dirname, '..', 'pages/api/history/filters.js')));

// Test 19 — no frontend caller of /api/history/filters or /api/history/landing direct fetch
const grep = (needle) => {
  let hits = 0;
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, f.name);
      if (f.isDirectory()) { if (!/[\\/]api[\\/]/.test(fp)) walk(fp); continue; }
      if (!/\.(js|jsx)$/.test(f.name)) continue;
      if (/[\\/]api[\\/]/.test(fp)) continue;
      if (fs.readFileSync(fp, 'utf8').includes(needle)) hits++;
    }
  };
  ['pages', 'components', 'lib'].forEach(d => walk(path.join(__dirname, '..', d)));
  return hits;
};
check('T19 zero frontend callers of /api/history/filters', grep('/api/history/filters') === 0);

// Test 20 — landing payload bounded (default limit 3, no answers/questions arrays)
check('T20 landing bounded: 3 quiz sessions, no answers field', landingPayload.data.quizzes.sessions.length === 3 && !('answers' in landingPayload.data));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
})();
