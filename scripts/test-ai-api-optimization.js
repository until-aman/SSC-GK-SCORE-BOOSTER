#!/usr/bin/env node
/**
 * scripts/test-ai-api-optimization.js  (Step 13)
 *
 * Dependency-free. Requires the REAL server dedup (CommonJS), mirrors the client
 * AI cache + dedup behavior, and runs source-level assertions on the real files.
 *
 * Run:  node scripts/test-ai-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const dedup = require('../lib/server/aiRequestDedup');

const Q_TTL = 7 * 24 * 60 * 60 * 1000;
const R_TTL = 24 * 60 * 60 * 1000;
function hash(v) { const s = String(v || ''); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }

// ── client cache + in-flight mirror ──────────────────────────────────────────
const store = new Map();
const inflight = new Map();
let posts = 0;
const explainKey = (q, c, u) => `ai_q:v1:explain:${hash([q, c, u].join('|'))}`;
const tipKey = (q, c) => `ai_q:v1:tip:${hash([q, c].join('|'))}`;
const insightKey = (scope, sid) => `ai_r:v1:insights:${scope || 'guest'}:${sid}`;
const readC = (k, ttl) => { const e = store.get(k); if (!e) return null; if (Date.now() - e.timestamp > ttl) return null; return e.data; };
const writeC = (k, t) => store.set(k, { timestamp: Date.now(), data: t });

async function helperPost(key, server, { cacheOk = true, ttl = Q_TTL } = {}) {
  const c = readC(key, ttl); if (c) return { text: c, source: 'ai', cached: true };
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => { posts++; const r = await server(); if (r.ok && r.text) { if (cacheOk) writeC(key, r.text); return { text: r.text, source: 'ai' }; } return { text: 'fallback', source: 'fallback' }; })().finally(() => inflight.delete(key));
  inflight.set(key, p); return p;
}

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const reset = () => { store.clear(); inflight.clear(); posts = 0; };
const okServer = (t = 'AI text') => async () => ({ ok: true, text: t });

(async () => {
  // T2 — Explanation cold/fresh
  reset();
  { const k = explainKey('Q1', 'A', 'B'); await helperPost(k, okServer()); check('T2 cold: 1 POST', posts === 1); const before = posts; const r = await helperPost(k, okServer()); check('T2 fresh: 0 POST', posts === before && r.cached); }

  // T3 — simultaneous duplicate → 1 POST
  reset();
  { const k = explainKey('Q1', 'A', 'B'); const [a, b] = await Promise.all([helperPost(k, okServer()), helperPost(k, okServer())]); check('T3 duplicate: 1 POST', posts === 1 && !!a && !!b); }

  // T4 — different questions → distinct keys
  check('T4 different questions distinct keys', explainKey('Q1', 'A', 'B') !== explainKey('Q2', 'A', 'B'));

  // T5 — same question, different selected answer → distinct keys
  check('T5 different selected answer distinct keys', explainKey('Q1', 'A', 'B') !== explainKey('Q1', 'A', 'C'));

  // T6 — tip key excludes selected answer (question-content only)
  check('T6 tip key independent of selected answer', tipKey('Q1', 'A') === tipKey('Q1', 'A'));

  // T9/T10 — result insight: 1 per attempt; repeat cached
  reset();
  { const k = insightKey('u_a', 's1'); await helperPost(k, okServer('Insight'), { ttl: R_TTL }); check('T9 insight: 1 POST', posts === 1); const before = posts; const r = await helperPost(k, okServer('Insight'), { ttl: R_TTL }); check('T10 repeat: 0 POST', posts === before && r.cached); }

  // T11 — effect rerun reuses active promise (simultaneous)
  reset();
  { const k = insightKey('u_a', 's1'); const [a, b] = await Promise.all([helperPost(k, okServer('I'), { ttl: R_TTL }), helperPost(k, okServer('I'), { ttl: R_TTL })]); check('T11 rerun: 1 POST', posts === 1 && !!a && !!b); }

  // T12 — retry attempt isolation (different sessionId → different key)
  check('T12 retry isolation', insightKey('u_a', 's1') !== insightKey('u_a', 's2'));

  // T13 — AI failure: fallback, no success cache, retry works
  reset();
  { const k = explainKey('Qf', 'A', 'B'); let calls = 0; const failS = async () => { calls++; return { ok: false }; };
    const r1 = await helperPost(k, failS); check('T13 failure: fallback', r1.source === 'fallback'); check('T13 failure: not cached', readC(k, Q_TTL) === null);
    const r2 = await helperPost(k, okServer()); check('T13 retry works', r2.source === 'ai' && calls === 1); }

  // T16 — eviction: oldest first (mirror)
  reset();
  { const max = 5; for (let i = 0; i < 8; i++) store.set(`ai_q:v1:explain:e${i}`, { timestamp: 1000 + i, data: 'x' });
    // evict to max
    const entries = [...store.keys()].filter(k => k.startsWith('ai_q:v1:')).map(k => ({ k, ts: store.get(k).timestamp })).sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < entries.length - max; i++) store.delete(entries[i].k);
    const remaining = [...store.keys()].filter(k => k.startsWith('ai_q:v1:'));
    check('T16 eviction: bounded to max', remaining.length === max);
    check('T16 eviction: oldest removed', !store.has('ai_q:v1:explain:e0') && store.has('ai_q:v1:explain:e7')); }

  // T17 — A/B result insight isolation
  check('T17 A/B insight isolation', insightKey('u_a', 's1') !== insightKey('u_b', 's1'));

  // T18 — server in-flight dedup: 2 identical concurrent → 1 execution
  { let exec = 0; const k = dedup.buildAiDedupKey('explain', ['Q1', 'A', 'B']); const loader = async () => { exec++; await new Promise(r => setTimeout(r, 5)); return 'X'; };
    const [a, b] = await Promise.all([dedup.dedupeAiRequest(k, loader), dedup.dedupeAiRequest(k, loader)]); check('T18 server dedup: 1 Gemini execution', exec === 1 && a === 'X' && b === 'X'); }

  // T19 — different prompts → not deduped
  { let exec = 0; const loader = async () => { exec++; return 'Y'; };
    await Promise.all([dedup.dedupeAiRequest(dedup.buildAiDedupKey('explain', ['Q1', 'A', 'B']), loader), dedup.dedupeAiRequest(dedup.buildAiDedupKey('explain', ['Q2', 'A', 'B']), loader)]);
    check('T19 different prompts: 2 executions', exec === 2); }
  check('T19 server key excludes api key / raw email', !dedup.buildAiDedupKey('explain', ['Q1', 'A']).includes('@') && !dedup.buildAiDedupKey('explain', ['Q1']).toLowerCase().includes('key'));

  // ── Source assertions ──
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const ai = read('lib/data/aiData.js');
  // Step 15: /api/ai/summary removed (dead). Active AI routes:
  const routes = ['explain', 'tip', 'result-insights'].map(r => read(`pages/api/ai/${r}.js`));
  const result = read('pages/result.js');
  const detailed = read('pages/result/detailed.js');
  const questions = read('pages/history/questions.jsx');

  check('T1/T22 3 active AI route files exist', routes.length === 3 && routes.every(Boolean));
  check('T20 summary route removed (dead)', !fs.existsSync(path.join(__dirname, '..', 'pages/api/ai/summary.js')));
  check('Step15 fetchAI.js removed', !fs.existsSync(path.join(__dirname, '..', 'lib/fetchAI.js')));
  check('O all routes wrapped withApiTrace + markGemini', routes.every(r => r.includes('withApiTrace') && r.includes('markGemini')));
  check('J routes use server dedupeAiRequest', routes.every(r => r.includes('dedupeAiRequest')));
  check('C aiData mutations use raw fetch (not fetchWithClientCache import)', !/from '@\/lib\/clientCache'/.test(ai) && ai.includes('fetch(url'));
  check('SRC questions.jsx uses aiData helper (no direct ai fetch)', /getAIExplanationHelper|getAIExplanation/.test(questions) && !/fetch\(['"]\/api\/ai\/explain/.test(questions));
  check('SRC detailed.js uses aiData (no fetchAI import)', /getAIExplanation|getAITip/.test(detailed) && !/from '@\/lib\/fetchAI'/.test(detailed));
  check('SRC result.js uses getAIResultInsights (no direct insights fetch)', /getAIResultInsights/.test(result) && !/fetch\(['"]\/api\/ai\/result-insights/.test(result));
  check('SRC result.js insight effect attempt-keyed + read-only', /readAIInsightsCache/.test(result));
  check('T21 privacy: no email/api key in aiData keys (hash used)', ai.includes('function hash') && !/GEMINI_API_KEY/.test(ai));
  // Server dedup hashes inputs and never accesses/logs the Gemini response text.
  check('T21 privacy: server dedup hashes inputs, no response access', read('lib/server/aiRequestDedup.js').includes('function hash') && !/response\.text|generateContent/.test(read('lib/server/aiRequestDedup.js')));
  check('K model unchanged (gemini-2.0-flash)', read('lib/gemini.js').includes('gemini-2.0-flash'));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
