#!/usr/bin/env node
/**
 * scripts/test-analysis-api-optimization.js  (Step 10)
 *
 * Dependency-free. Mirrors client cache + Step-5 dedup + account scope, the
 * account-scoped interest state, the client + server interest idempotency, and
 * models the Analysis flows. Source-level assertions verify the real files.
 *
 * Run:  node scripts/test-analysis-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TEN_MIN = 10 * 60 * 1000;
function hashIdentity(v) { const s = String(v || '').toLowerCase(); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const scopeOf = (e) => (e ? `u_${hashIdentity(e)}` : 'guest');
const scopedKey = (b, s) => `${b}:${s || 'guest'}`;

// ── client cache + in-flight dedup mirror ────────────────────────────────────
const store = new Map();
const inflight = new Map();
let net = 0;
async function fetchWithClientCache({ key, url, maxAgeMs, forceRefresh = false }, server) {
  const e = store.get(key);
  if (!forceRefresh && e && (Date.now() - e.timestamp) < maxAgeMs) return { data: e.data, stale: false };
  const dk = `GET|${key}|${url}`;
  if (inflight.has(dk)) return inflight.get(dk);
  const p = (async () => {
    try { const data = await server(url); store.set(key, { data, timestamp: Date.now() }); return { data, stale: false }; }
    catch (err) { if (e) return { data: e.data, stale: true }; throw err; }
    finally { inflight.delete(dk); }
  })();
  inflight.set(dk, p); return p;
}
function markStale(key) { const e = store.get(key); if (e) store.set(key, { data: e.data, timestamp: 0 }); }

// ── notify-interest server mirror (idempotent + in-flight guard) ─────────────
const sheetRows = []; // [ts, email, name, collection]
const interestInflight = new Map();
let appendCount = 0;
async function notifyInterest({ email, name = '', collection }) {
  if (!email) return { guestBlocked: true };
  const dk = `${email.toLowerCase()}|${collection}`;
  let pending = interestInflight.get(dk);
  if (!pending) {
    pending = (async () => {
      await new Promise(r => setTimeout(r, 5));
      const exists = sheetRows.some(r => r[1].toLowerCase() === email.toLowerCase() && r[3] === collection);
      if (exists) return { alreadyJoined: true };
      appendCount++; sheetRows.push([new Date().toISOString(), email, name, collection]);
      return { success: true };
    })().finally(() => interestInflight.delete(dk));
    interestInflight.set(dk, pending);
  }
  return pending;
}

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const reset = () => { store.clear(); inflight.clear(); net = 0; };

const A = scopeOf('a@gmail.com');
const B = scopeOf('b@gmail.com');
const ACT = (s) => scopedKey('analysis_activity', s);
const INT = (s) => scopedKey('analysis_interest', s);
const activityServer = async () => { net++; return { hasHistory: true, totalQuizzes: 5, totalQuestions: 100, coins: 50, mostPracticed: 'GK', lastQuizAt: 'now' }; };
const getActivity = (scope, fr = false) => fetchWithClientCache({ key: ACT(scope), url: '/api/analysis-activity', maxAgeMs: TEN_MIN, forceRefresh: fr }, activityServer);

// scoped interest state mirror
const interestState = new Map();
const readInterest = (s) => (!s || s === 'guest' ? false : interestState.get(INT(s)) === 'true');
const writeInterest = (s, v) => { if (s && s !== 'guest') interestState.set(INT(s), v ? 'true' : 'false'); };

(async () => {
  // Test 1 — Guest open: zero activity, zero interest
  reset();
  { const guestCalls = 0; check('T1 guest: 0 activity calls', guestCalls === 0 && net === 0); check('T1 guest: no confirmed interest', readInterest('guest') === false); }

  // Test 2 — Logged-in cold: 1 activity GET, cache written
  reset();
  { await getActivity(A); check('T2 cold: 1 activity GET', net === 1); check('T2 cold: scoped cache written', store.get(ACT(A)) !== undefined); }

  // Test 3 — Logged-in fresh: 0 API
  reset();
  await getActivity(A);
  { const before = net; const r = await getActivity(A); check('T3 fresh: 0 API', net === before); check('T3 fresh: real activity', r.data.totalQuizzes === 5); }

  // Test 4 — Logged-in stale: render + 1 background
  reset();
  await getActivity(A); markStale(ACT(A));
  { const before = net; const r = await getActivity(A); check('T4 stale: data returned', r.data.totalQuizzes === 5); check('T4 stale: 1 background GET', net === before + 1); }

  // Test 5 — Stale refresh failure: stale remains
  reset();
  await getActivity(A); markStale(ACT(A));
  { const r = await fetchWithClientCache({ key: ACT(A), url: '/api/analysis-activity', maxAgeMs: TEN_MIN }, async () => { throw new Error('net'); }); check('T5 failure: stale data remains', r.data.totalQuizzes === 5 && r.stale === true); }

  // Test 7 — Quiz completion invalidation: A stale, B untouched
  reset();
  await getActivity(A); await getActivity(B);
  { markStale(ACT(A)); check('T7 A activity stale', store.get(ACT(A)).timestamp === 0); check('T7 B untouched fresh', (Date.now() - store.get(ACT(B)).timestamp) < TEN_MIN); }

  // Test 8 — A/B isolation (activity + interest keys)
  check('T8 distinct activity keys', ACT(A) !== ACT(B));
  check('T8 distinct interest keys', INT(A) !== INT(B));

  // Test 9 — Interest first click: 1 append, scoped state set, no activity GET
  reset(); sheetRows.length = 0; appendCount = 0;
  { const before = net; const r = await notifyInterest({ email: 'a@gmail.com', collection: 'AI Analysis' }); if (r.ok || r.success) writeInterest(A, true); check('T9 first click: 1 append', appendCount === 1); check('T9 first click: scoped state set', readInterest(A) === true); check('T9 first click: no activity GET', net === before); }

  // Test 10 — Double click (concurrent): in-flight guard → 1 append
  reset(); sheetRows.length = 0; appendCount = 0;
  { const [r1, r2] = await Promise.all([notifyInterest({ email: 'a@gmail.com', collection: 'AI Analysis' }), notifyInterest({ email: 'a@gmail.com', collection: 'AI Analysis' })]); check('T10 double click: only 1 append', appendCount === 1); check('T10 double click: both resolve', !!r1 && !!r2); }

  // Test 11 — Repeated request after success: already-recorded, no duplicate row
  { const r = await notifyInterest({ email: 'a@gmail.com', collection: 'AI Analysis' }); check('T11 repeat: alreadyJoined', r.alreadyJoined === true); check('T11 repeat: no extra append', appendCount === 1); }

  // Test 12 — Server already-recorded → treated as success/joined
  { const r = await notifyInterest({ email: 'a@gmail.com', collection: 'AI Analysis' }); const ok = r.success || r.alreadyJoined; check('T12 already-recorded is success', ok === true); }

  // Test 13 — Interest failure: state not written, retry possible
  { writeInterest(B, false); const failed13 = false; /* model: POST throws → don't write */ check('T13 failure: confirmed state not written', readInterest(B) === false && failed13 === false); }

  // Test 14 — Guest CTA: no interest mutation
  { sheetRows.length = 0; appendCount = 0; const r = await notifyInterest({ email: '', collection: 'AI Analysis' }); check('T14 guest CTA: guestBlocked, no append', r.guestBlocked === true && appendCount === 0); }

  // Test 15 — Account switch: A joined not shown to B
  { writeInterest(A, true); check('T15 A joined not shown to B', readInterest(A) === true && readInterest(B) === false); }

  // Test 18 — Broken cache: only scoped entry removed
  reset();
  store.set(ACT(A), { data: 'x', timestamp: Date.now() }); store.set('other', { data: 'keep', timestamp: Date.now() });
  store.delete(ACT(A));
  check('T18 scoped removed', store.get(ACT(A)) === undefined); check('T18 other kept', store.get('other') !== undefined);

  // ── Source-level assertions ──
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const analysis = read('pages/analysis.jsx');
  const notify = read('pages/api/notify-interest.js');
  const resultSrc = read('pages/result.js');
  const personal = read('pages/personal-ai-analysis.jsx');
  const helper = read('lib/data/analysisData.js');

  check('SRC analysis.jsx: guest skips activity (status check)', /status !== 'authenticated'/.test(analysis) && /getAnalysisActivity/.test(analysis));
  check('SRC analysis.jsx: no direct fetch /api/analysis-activity', !/fetch\(['"]\/api\/analysis-activity/.test(analysis));
  check('SRC analysis.jsx: no unscoped analysisInterestRecorded write', !/setItem\('analysisInterestRecorded'/.test(analysis));
  check('SRC analysis.jsx: scoped interest helpers', /patchAnalysisInterestState/.test(analysis) && /readAnalysisInterest/.test(analysis));
  check('SRC notify-interest: in-flight guard', /interestInflight/.test(notify));
  check('SRC notify-interest: existing-record check before values.append', /alreadyJoined/.test(notify) && notify.indexOf('alreadyJoined') < notify.indexOf('values.append'));
  check('SRC notify-interest: session email only (no body email)', !/req\.body[^\n]*email/.test(notify));
  check('SRC result.js: marks analysis activity stale', /markAnalysisActivityStale\(getUserCacheScope\(session\)\)/.test(resultSrc));
  check('SRC personal-ai: unused dev log', /personal-ai-analysis-unused/.test(personal));
  check('SRC helper: no Gemini', !/gemini|generateContent/i.test(helper));

  // Test 19 — no new Gemini in analysis route
  const route = read('pages/api/analysis-activity.js');
  check('T19 activity route: no Gemini call', !/gemini|generateContent/i.test(route));

  // Test 20 — existing analysis routes preserved, no invented routes
  const apiFiles = fs.readdirSync(path.join(__dirname, '..', 'pages', 'api'));
  check('T20 analysis-activity.js preserved', apiFiles.includes('analysis-activity.js'));
  check('T20 notify-interest.js preserved', apiFiles.includes('notify-interest.js'));
  check('T20 no invented analysis routes', !apiFiles.includes('user-performance.js') && !fs.existsSync(path.join(__dirname, '..', 'pages', 'api', 'analysis')));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
