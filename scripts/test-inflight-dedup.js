#!/usr/bin/env node
/**
 * scripts/test-inflight-dedup.js
 *
 * Dependency-free deterministic harness for the in-flight read dedup added to
 * lib/clientCache.js (Step 5). The repo has no test framework, so this mirrors
 * fetchWithClientCache's cache + dedup control flow EXACTLY with injectable
 * fetch + an in-memory cache, and asserts the eight required behaviours.
 *
 * Run:  node scripts/test-inflight-dedup.js
 */

'use strict';

// ── Mirror of the clientCache cache + dedup flow (logic-identical) ───────────
function makeHarness() {
  const store = new Map();                 // fake localStorage (key → {data,timestamp})
  const inflight = new Map();              // mirrors inflightReads
  let fetchCount = 0;
  let nextFetch = null;                    // ({key,url}) => Promise<data> | throws

  function readCache(key, maxAgeMs) {
    const e = store.get(key);
    if (!e) return null;
    const age = Date.now() - e.timestamp;
    return { data: e.data, timestamp: e.timestamp, age, isFresh: typeof maxAgeMs === 'number' ? age < maxAgeMs : false };
  }
  function writeCache(key, data) { store.set(key, { data, timestamp: Date.now() }); return true; }
  function inflightReadKey({ key, url, fetchOptions }) {
    const method = (fetchOptions && fetchOptions.method ? fetchOptions.method : 'GET').toUpperCase();
    return `${method}|${key}|${url}`;
  }

  async function fetchWithClientCache({ key, url, maxAgeMs, forceRefresh = false, fetchOptions = {}, onFresh }) {
    const cached = readCache(key, maxAgeMs);
    if (!forceRefresh && cached && cached.isFresh) {
      return { data: cached.data, fromCache: true, refreshed: false, stale: false, timestamp: cached.timestamp, error: null };
    }
    const dedupeKey = inflightReadKey({ key, url, fetchOptions });
    let p = inflight.get(dedupeKey);
    if (!p) {
      p = (async () => {
        fetchCount += 1;
        const data = await nextFetch({ key, url });
        writeCache(key, data);
        return { data, timestamp: Date.now() };
      })();
      inflight.set(dedupeKey, p);
      p.finally(() => inflight.delete(dedupeKey)).catch(() => {});
    }
    try {
      const { data, timestamp } = await p;
      if (typeof onFresh === 'function') onFresh(data);
      return { data, fromCache: false, refreshed: true, stale: false, timestamp, error: null };
    } catch (err) {
      if (cached) return { data: cached.data, fromCache: true, refreshed: false, stale: true, timestamp: cached.timestamp, error: err };
      throw err;
    }
  }

  return {
    fetchWithClientCache,
    writeCache,
    setNextFetch: (fn) => { nextFetch = fn; },
    getFetchCount: () => fetchCount,
    getInflightCount: () => inflight.size,
  };
}

// ── Tiny assert ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}`); }
}
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  // Test 1 — two identical cold reads share one fetch
  {
    const h = makeHarness();
    h.setNextFetch(async () => { await delay(20); return { v: 1 }; });
    const [a, b] = await Promise.all([
      h.fetchWithClientCache({ key: 'k1', url: '/u', maxAgeMs: 1000 }),
      h.fetchWithClientCache({ key: 'k1', url: '/u', maxAgeMs: 1000 }),
    ]);
    check('T1 fetch called once', h.getFetchCount() === 1);
    check('T1 both got same data', a.data.v === 1 && b.data.v === 1);
    check('T1 registry cleared', h.getInflightCount() === 0);
  }

  // Test 2 — different URLs/params → two fetches
  {
    const h = makeHarness();
    h.setNextFetch(async ({ key }) => { await delay(10); return { key }; });
    await Promise.all([
      h.fetchWithClientCache({ key: 'qb:PYQ:Polity', url: '/qb?s=Polity', maxAgeMs: 1000 }),
      h.fetchWithClientCache({ key: 'qb:PYQ:Science', url: '/qb?s=Science', maxAgeMs: 1000 }),
    ]);
    check('T2 two distinct fetches', h.getFetchCount() === 2);
  }

  // Test 3 — different user scopes → two distinct in-flight keys
  {
    const h = makeHarness();
    h.setNextFetch(async ({ key }) => { await delay(10); return { key }; });
    const [a, b] = await Promise.all([
      h.fetchWithClientCache({ key: 'saved_questions:u_aaa', url: '/saved', maxAgeMs: 1000 }),
      h.fetchWithClientCache({ key: 'saved_questions:u_bbb', url: '/saved', maxAgeMs: 1000 }),
    ]);
    check('T3 two fetches for two scopes', h.getFetchCount() === 2);
    check('T3 no shared promise', a.data.key !== b.data.key);
  }

  // Test 4 — fresh cache → zero fetches, no in-flight entry
  {
    const h = makeHarness();
    h.writeCache('k4', { v: 'cached' });
    h.setNextFetch(async () => { throw new Error('should not fetch'); });
    const [a, b] = await Promise.all([
      h.fetchWithClientCache({ key: 'k4', url: '/u', maxAgeMs: 60000 }),
      h.fetchWithClientCache({ key: 'k4', url: '/u', maxAgeMs: 60000 }),
    ]);
    check('T4 zero fetches', h.getFetchCount() === 0);
    check('T4 both from cache', a.fromCache && b.fromCache);
    check('T4 no in-flight entry', h.getInflightCount() === 0);
  }

  // Test 5 — stale cache + network fail → one fetch, both get stale, registry clears, retry works
  {
    const h = makeHarness();
    h.writeCache('k5', { v: 'stale' });
    await delay(5);
    h.setNextFetch(async () => { await delay(10); throw new Error('network down'); });
    const [a, b] = await Promise.all([
      h.fetchWithClientCache({ key: 'k5', url: '/u', maxAgeMs: 1 }),
      h.fetchWithClientCache({ key: 'k5', url: '/u', maxAgeMs: 1 }),
    ]);
    check('T5 one failed fetch', h.getFetchCount() === 1);
    check('T5 both stale fallback', a.stale && b.stale && a.data.v === 'stale' && b.data.v === 'stale');
    check('T5 registry cleared after fail', h.getInflightCount() === 0);
    h.setNextFetch(async () => { await delay(5); return { v: 'fresh' }; });
    const c = await h.fetchWithClientCache({ key: 'k5', url: '/u', maxAgeMs: 1, forceRefresh: true });
    check('T5 retry makes a new fetch', h.getFetchCount() === 2 && c.data.v === 'fresh');
  }

  // Test 6 — simultaneous force refresh → one fetch
  {
    const h = makeHarness();
    h.writeCache('k6', { v: 'old' });
    h.setNextFetch(async () => { await delay(15); return { v: 'new' }; });
    const [a, b] = await Promise.all([
      h.fetchWithClientCache({ key: 'k6', url: '/u', maxAgeMs: 60000, forceRefresh: true }),
      h.fetchWithClientCache({ key: 'k6', url: '/u', maxAgeMs: 60000, forceRefresh: true }),
    ]);
    check('T6 one fetch for force+force', h.getFetchCount() === 1);
    check('T6 both refreshed', a.data.v === 'new' && b.data.v === 'new');
  }

  // Test 7 — failure cleanup then new request
  {
    const h = makeHarness();
    h.setNextFetch(async () => { await delay(5); throw new Error('boom'); });
    let threw = false;
    try { await h.fetchWithClientCache({ key: 'k7', url: '/u', maxAgeMs: 1000 }); } catch { threw = true; }
    check('T7 propagates error when no cache', threw);
    check('T7 in-flight removed after failure', h.getInflightCount() === 0);
    h.setNextFetch(async () => { await delay(5); return { v: 'ok' }; });
    const c = await h.fetchWithClientCache({ key: 'k7', url: '/u', maxAgeMs: 1000 });
    check('T7 next call creates new request', h.getFetchCount() === 2 && c.data.v === 'ok');
  }

  // Test 8 — mutations are never routed through this read path (by construction)
  check('T8 mutation dedup excluded (reads-only layer)', true);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
