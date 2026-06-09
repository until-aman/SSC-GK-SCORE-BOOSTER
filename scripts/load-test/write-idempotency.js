#!/usr/bin/env node
// scripts/load-test/write-idempotency.js — Group 4 controlled write idempotency (Step 17).
//
// STAGING TEST SHEET ONLY. Sends a SMALL number of DUPLICATE identical writes
// (same clientSessionId / same saved question / same interest) at low concurrency
// to prove server idempotency — NOT a volume test. After running, verify the
// staging Sheet has no duplicate rows (see docs/STAGING_WRITE_VERIFICATION.md).
//
// Hard guards: ALLOW_STAGING_LOAD_TEST=true + CONFIRM_WRITE_TEST=YES + a TEST
// session cookie + a non-production BASE_URL. No real account emails in source.
//
// Usage:
//   ALLOW_STAGING_LOAD_TEST=true CONFIRM_WRITE_TEST=YES \
//     BASE_URL=https://staging.example STAGING_COOKIE='next-auth.session-token=XXX' \
//     node scripts/load-test/write-idempotency.js --target=complete --copies=5

'use strict';
const { parseArgs, assertSafeTarget, assertWriteConfirmed } = require('./lib');

(async () => {
  const base = assertSafeTarget();
  assertWriteConfirmed();
  const cookie = process.env.STAGING_COOKIE;
  if (!cookie) { console.error('[ABORT] STAGING_COOKIE (TEST account) required.'); process.exit(2); }
  const args = parseArgs();
  const target = args.target || 'complete';
  const copies = Math.min(Number(args.copies) || 5, 10); // hard cap 10 duplicates

  // One fixed, disposable identity per target so duplicates collide.
  const sessionId = `loadtest-${target}-${Date.now()}`;
  const TARGETS = {
    complete: { path: '/api/quiz-session/complete', body: { clientSessionId: sessionId, sessionId, subject: 'History', topic: 'Test', correct: 1, incorrect: 0, skipped: 0, totalQuestions: 1, answers: [] } },
    saved: { path: '/api/saved-questions', body: { questionId: `loadtest-q-${Date.now()}`, question: 'Load test Q', correctOption: 'A', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd' } },
    interest: { path: '/api/notify-interest', body: { collection: 'AI Analysis' } },
  };
  const t = TARGETS[target];
  if (!t) { console.error('[ABORT] --target must be one of: complete|saved|interest'); process.exit(2); }

  console.log(`[write-idempotency] target=${base}${t.path} duplicates=${copies} sessionId=${sessionId}`);
  console.log('[write-idempotency] Sending identical concurrent duplicates. Verify the staging Sheet afterwards for NO duplicate rows.');

  const send = () => fetch(base + t.path, { method: target === 'saved-delete' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(t.body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const results = await Promise.all(Array.from({ length: copies }, send));
  const statuses = results.map(r => r.status);
  const okCount = statuses.filter(s => s >= 200 && s < 300).length;
  console.log(JSON.stringify({ copies, statuses, okCount, sample: results[0]?.body }, null, 2));
  console.log('\n[write-idempotency] NEXT: manually confirm exactly ONE logical row/coin update in the staging Sheet.');
  process.exit(0);
})();
