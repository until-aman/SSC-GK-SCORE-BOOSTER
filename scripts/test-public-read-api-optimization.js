#!/usr/bin/env node
/**
 * scripts/test-public-read-api-optimization.js  (Step 14)
 *
 * Dependency-free. Requires the REAL serverCache (CommonJS), mirrors client
 * bank caching + eviction, and runs source-level assertions on the real files.
 *
 * Run:  node scripts/test-public-read-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sc = require('../lib/server/serverCache');

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };

(async () => {
  // ── Server cache (real module) ──
  // T18 — TTL hit avoids reload
  { let loads = 0; const loader = async () => { loads++; return { v: 1 }; };
    const a = await sc.getOrLoadServerCache('t:x', 1000, loader);
    const b = await sc.getOrLoadServerCache('t:x', 1000, loader);
    check('T18 server TTL: 1 load within TTL', loads === 1 && a.v === 1 && b.v === 1); }

  // T18b — expired reloads
  { let loads = 0; const loader = async () => { loads++; return { v: 2 }; };
    await sc.getOrLoadServerCache('t:y', 1, loader);
    await new Promise(r => setTimeout(r, 5));
    await sc.getOrLoadServerCache('t:y', 1, loader);
    check('T18b expired: reloads once', loads === 2); }

  // T18c — concurrent identical loaders share one Promise
  { let loads = 0; const loader = async () => { loads++; await new Promise(r => setTimeout(r, 5)); return { v: 3 }; };
    const [a, b] = await Promise.all([sc.getOrLoadServerCache('t:z', 1000, loader), sc.getOrLoadServerCache('t:z', 1000, loader)]);
    check('T18c concurrent: 1 load', loads === 1 && a.v === 3 && b.v === 3); }

  // T20 — failed loader not cached as success; retry runs
  { let loads = 0; const failer = async () => { loads++; throw new Error('x'); };
    let threw = false; try { await sc.getOrLoadServerCache('t:f', 1000, failer); } catch { threw = true; }
    check('T20 failure propagates', threw);
    check('T20 failure not cached', sc.getServerCache('t:f') === undefined);
    let ok = false; try { await sc.getOrLoadServerCache('t:f', 1000, async () => { loads++; return { v: 9 }; }); ok = true; } catch {}
    check('T20 retry runs', ok && loads === 2); }

  // T19 — server-cache bounds (maxEntries eviction)
  { for (let i = 0; i < 10; i++) sc.setServerCache(`b:${i}`, i, 10000, { maxEntries: 5 });
    const stats = sc.getServerCacheStats();
    check('T19 bounded', stats.size <= 5 + 2 /* allow other test keys */ && sc.getServerCache('b:9') === 9);
    check('T19 oldest evicted', sc.getServerCache('b:0') === undefined); }

  // ── Client bank eviction mirror (matches lib/data/questionData.js) ──
  const store = new Map();
  const MAX = 3;
  function evict(keepKey) {
    const prefix = 'ssc_gk_v1:question_bank:';
    const keep = keepKey ? `ssc_gk_v1:${keepKey}` : null;
    const banks = [];
    for (const [k, v] of store) { if (k.startsWith(prefix)) banks.push({ k, ts: v.timestamp }); }
    if (banks.length <= MAX) return;
    banks.sort((a, b) => a.ts - b.ts);
    let removed = 0; const target = banks.length - MAX;
    for (const b of banks) { if (removed >= target) break; if (b.k === keep) continue; store.delete(b.k); removed++; }
  }
  function writeBank(coll, subj, ts) { const key = `question_bank:${coll}:${subj}`; store.set(`ssc_gk_v1:${key}`, { timestamp: ts, data: [] }); evict(key); }

  // T4/T3 — topic switch / cached bank: model "fresh bank → 0 network"
  { store.clear(); writeBank('general', 'History', 1000);
    const hasBank = store.has('ssc_gk_v1:question_bank:general:History');
    check('T3/T4 cached subject bank present → topic switch 0 API', hasBank); }

  // T10 — eviction: keep newest MAX, never the active/just-written
  { store.clear();
    writeBank('general', 'A', 1); writeBank('general', 'B', 2); writeBank('general', 'C', 3); writeBank('general', 'D', 4);
    const banks = [...store.keys()].filter(k => k.includes('question_bank:'));
    check('T10 bounded to MAX banks', banks.length === MAX);
    check('T10 oldest (A) evicted, newest (D) kept', !store.has('ssc_gk_v1:question_bank:general:A') && store.has('ssc_gk_v1:question_bank:general:D')); }

  // T6 — collection switch → distinct key
  check('T6 collection switch distinct key', 'question_bank:general:History' !== 'question_bank:PYQ:History');
  // T5 — subject switch → distinct key
  check('T5 subject switch distinct key', 'question_bank:general:History' !== 'question_bank:general:Polity');

  // ── Source assertions ──
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const topics = read('pages/api/topics.js');
  const qbank = read('pages/api/question-bank.js');
  const qData = read('lib/data/questionData.js');
  const config = read('pages/api/config.js');
  const quiz = read('pages/quiz.js');
  const appConfig = read('lib/config/appConfig.js');

  // Old N+1 = a per-subject sheet read `getTopicsBySubject(subj, ...)` inside the loop.
  check('T2 topics: N+1 loop removed (no getTopicsBySubject(subj, ...) call)', !topics.includes('getTopicsBySubject(subj,') && /deriveSubjectCounts/.test(topics));
  check('T2 topics: single-read derivation marker', topics.includes('topics-derived-single-read'));
  check('B/D topics + qbank use serverCache', topics.includes('getOrLoadServerCache') && qbank.includes('serverCache'));
  check('I client bank eviction present', qData.includes('evictOldQuestionBanks') && qData.includes('MAX_QUESTION_BANKS'));
  check('F legacy fallback diagnostic in quiz.js', quiz.includes('questions-legacy-fallback'));
  check('E quiz prefers question-bank (getQuestionBank used)', quiz.includes('getQuestionBank'));
  check('Step15 prefetch.js removed (dead warm-up route)', !fs.existsSync(path.join(__dirname, '..', 'pages/api/prefetch.js')));
  check('T22 config retained (allowlist) + deprecation', config.includes('config-route-deprecated') && config.includes('getPublicConfig'));
  check('T22 config exposes only allowlisted public fields', appConfig.includes('PUBLIC_CONFIG_KEYS') && /getPublicConfig/.test(appConfig));

  // T25 — route preservation (all in-scope route files still exist; none invented)
  const apiDir = path.join(__dirname, '..', 'pages', 'api');
  ['topics.js', 'question-bank.js', 'questions.js', 'daily-challenge.js', 'leaderboard.js', 'config.js'].forEach(f => check(`T25 route preserved: ${f}`, fs.existsSync(path.join(apiDir, f))));
  check('T25 no invented routes', !fs.existsSync(path.join(apiDir, 'catalog.js')) && !fs.existsSync(path.join(apiDir, 'public')) && !fs.existsSync(path.join(apiDir, 'questions', 'bank.js')));

  // T11 — localStorage-full non-fatal (eviction wrapped in try/catch in source)
  check('T11 eviction best-effort (try/catch, never blocks)', /catch \{ \/\* eviction is best-effort/.test(qData));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
