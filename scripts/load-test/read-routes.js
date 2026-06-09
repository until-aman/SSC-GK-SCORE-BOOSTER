#!/usr/bin/env node
// scripts/load-test/read-routes.js — Group 1 safe PUBLIC read load test (Step 17).
//
// Usage (STAGING ONLY):
//   ALLOW_STAGING_LOAD_TEST=true BASE_URL=https://staging.example \
//     node scripts/load-test/read-routes.js --vus=10 --duration=30
//
// Tests cached public reads only. No auth, no writes, no Gemini.

'use strict';
const { parseArgs, assertSafeTarget, runLoad } = require('./lib');

(async () => {
  const base = assertSafeTarget();
  const args = parseArgs();
  const vus = Number(args.vus) || 10;
  const duration = Number(args.duration) || 30;

  // Public, cache-friendly GET routes. Adjust subjects/collections to staging data.
  const paths = [
    '/api/topics?collection=general',
    '/api/topics?collection=PYQ',
    '/api/question-bank?collection=general&subject=History',
    '/api/question-bank?collection=general&subject=Polity',
    '/api/daily-challenge',
    '/api/leaderboard?scope=weekly',
    '/api/dashboard-bootstrap', // guest response when unauthenticated
    '/api/config',
  ];

  console.log('[read-routes] Group 1 public reads. Run a COLD scenario (fresh deploy/restart) and a WARM scenario separately.');
  const result = await runLoad({ base, paths, vus, durationSec: duration, maxErrorRate: 0.10 });
  process.exit(result.successRate >= 95 ? 0 : 1);
})();
