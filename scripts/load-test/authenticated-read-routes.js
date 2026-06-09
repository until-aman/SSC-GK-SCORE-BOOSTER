#!/usr/bin/env node
// scripts/load-test/authenticated-read-routes.js — Group 2 authed reads (Step 17).
//
// STAGING ONLY, conservative concurrency. Requires a staging session cookie
// supplied via env (NEVER committed): STAGING_COOKIE='next-auth.session-token=...'.
// No credentials are stored in this file.
//
// Usage:
//   ALLOW_STAGING_LOAD_TEST=true BASE_URL=https://staging.example \
//     STAGING_COOKIE='next-auth.session-token=XXX' \
//     node scripts/load-test/authenticated-read-routes.js --vus=5 --duration=30

'use strict';
const { parseArgs, assertSafeTarget, runLoad } = require('./lib');

(async () => {
  const base = assertSafeTarget();
  const cookie = process.env.STAGING_COOKIE;
  if (!cookie) { console.error('[load-test ABORT] STAGING_COOKIE env (a TEST account session) is required for authed reads.'); process.exit(2); }
  const args = parseArgs();
  const vus = Math.min(Number(args.vus) || 5, 50); // cap conservative
  const duration = Number(args.duration) || 30;

  const paths = [
    '/api/user-profile',
    '/api/history/landing',
    '/api/history/questions?status=wrong&limit=50&page=1',
    '/api/mentor/plan',
    '/api/analysis-activity',
    '/api/saved-questions/ids',
  ];

  // Wrap runLoad's fetch by injecting the cookie via a monkey-patched header path:
  // simplest is to set a global default header through a custom runner is overkill;
  // instead we re-implement a tiny authed runner here using the same guards.
  const stats = { total: 0, ok: 0, errors: {}, lat: [], t0: Date.now() };
  const deadline = Date.now() + duration * 1000;
  let stop = false;
  async function worker() {
    let i = 0;
    while (!stop && Date.now() < deadline) {
      const url = base + paths[i % paths.length]; i += 1;
      const s = Date.now();
      try {
        const r = await fetch(url, { headers: { cookie } });
        stats.total++; stats.lat.push(Date.now() - s);
        if (r.ok) stats.ok++; else stats.errors[r.status] = (stats.errors[r.status] || 0) + 1;
      } catch (e) { stats.total++; stats.errors[e.name || 'net'] = (stats.errors[e.name || 'net'] || 0) + 1; }
      if (stats.total >= 20) { const e = Object.values(stats.errors).reduce((a, b) => a + b, 0); if (e / stats.total > 0.10) { stop = true; } }
    }
  }
  console.log(`[authed-reads] target=${base} vus=${vus} duration=${duration}s (TEST account only)`);
  await Promise.all(Array.from({ length: vus }, worker));
  const sorted = [...stats.lat].sort((a, b) => a - b);
  const errs = Object.values(stats.errors).reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ total: stats.total, ok: stats.ok, successRate: +(stats.ok / (stats.total || 1) * 100).toFixed(2), errors: stats.errors, p95: sorted[Math.floor(0.95 * sorted.length)] || 0 }, null, 2));
  process.exit(errs / (stats.total || 1) < 0.02 ? 0 : 1);
})();
