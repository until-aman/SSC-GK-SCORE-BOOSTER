#!/usr/bin/env node
/**
 * scripts/test-mentor-monitor-workflow.js — Phase 9M static checks for the
 * scheduled monitor workflow. No I/O beyond reading the workflow file.
 * Run: node scripts/test-mentor-monitor-workflow.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WF = path.join(__dirname, '..', '.github', 'workflows', 'mentor-v2-monitor.yml');
const exists = fs.existsSync(WF);
const wf = exists ? fs.readFileSync(WF, 'utf8') : '';

let passed = 0, failed = 0; const T = []; const test = (n, fn) => T.push({ n, fn });

test('1. workflow file exists', () => assert.ok(exists, '.github/workflows/mentor-v2-monitor.yml missing'));
test('2. Phase 9M2: scheduled trigger REMOVED (manual-only; scheduling moved to Vercel Cron)', () => {
  assert.ok(!/^\s*schedule:/m.test(wf), 'workflow must NOT have a schedule trigger (no GitHub secrets -> would always fail)');
  assert.ok(!/^\s*-\s*cron:/m.test(wf), 'workflow must NOT have a cron entry');
});
test('3. supports manual workflow_dispatch', () => assert.ok(/workflow_dispatch/.test(wf)));
test('4. runs npm run mentor:v2-monitor', () => assert.ok(/npm run mentor:v2-monitor/.test(wf)));
test('5. NO deploy commands (deploy actions/CLIs, not the word in comments)', () => {
  // Inspect only `run:`/`uses:` lines so descriptive comments ("no deploy") don't false-positive.
  const execLines = wf.split('\n').filter(l => /^\s*(run:|-?\s*uses:)/.test(l)).join('\n');
  ['vercel', 'amondnet/vercel', '--prod', 'gh pr merge', 'git push', 'netlify'].forEach(bad => assert.ok(!new RegExp(bad, 'i').test(execLines), `workflow run/uses must not contain "${bad}"`));
});
test('6. NO mutation/write scripts (POSTPONE/RESUME/COMPLETE/migration apply)', () => {
  ['POSTPONE', 'RESUME', 'COMPLETE', 'task-action', 'quiz-return', 'sheets-migration:apply', 'executeTaskMutation', '--commit'].forEach(bad => assert.ok(!wf.includes(bad), `workflow must not reference "${bad}"`));
});
test('7. rollover/pending lifecycle write flags set to false', () => {
  assert.ok(/MENTOR_DAILY_ROLLOVER_V2:\s*["']false["']/.test(wf));
  assert.ok(/MENTOR_PENDING_LIFECYCLE_V2:\s*["']false["']/.test(wf));
});
test('8. allow-all env present as "true"', () => assert.ok(/MENTOR_V2_MUTATION_ALLOW_ALL:\s*["']true["']/.test(wf)));
test('9. uses the actual Google Sheets secret names (GOOGLE_SERVICE_ACCOUNT_KEY + GOOGLE_SHEET_ID)', () => {
  assert.ok(/GOOGLE_SERVICE_ACCOUNT_KEY:\s*\$\{\{\s*secrets\.GOOGLE_SERVICE_ACCOUNT_KEY\s*\}\}/.test(wf));
  assert.ok(/GOOGLE_SHEET_ID:\s*\$\{\{\s*secrets\.GOOGLE_SHEET_ID\s*\}\}/.test(wf));
  // must NOT use the wrong/invented names
  assert.ok(!/GOOGLE_SHEETS_CLIENT_EMAIL/.test(wf), 'must not use GOOGLE_SHEETS_CLIENT_EMAIL (repo uses GOOGLE_SERVICE_ACCOUNT_KEY)');
  assert.ok(!/GOOGLE_SHEETS_PRIVATE_KEY/.test(wf), 'must not use GOOGLE_SHEETS_PRIVATE_KEY');
});
test('10. least-privilege permissions (contents: read)', () => assert.ok(/permissions:[\s\S]*contents:\s*read/.test(wf)));
test('11. monitor npm script is read-only (node scripts/mentor-v2-mutation-monitor.js)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts['mentor:v2-monitor'], 'node scripts/mentor-v2-mutation-monitor.js');
});

(async () => { for (const t of T) { try { await t.fn(); passed++; console.log(`ok  ${t.n}`); } catch (e) { failed++; console.error(`FAIL ${t.n}\n     ${e.message}`); } } console.log(`\n${passed}/${T.length} Mentor monitor-workflow checks passed.`); process.exit(failed ? 1 : 0); })();
