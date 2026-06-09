#!/usr/bin/env node
/**
 * scripts/test-cleanup-and-route-safety.js  (Step 15)
 *
 * Verifies the cleanup: removed routes are gone + uncalled, retained
 * compatibility/fallback routes remain, no frontend caller points to a missing
 * route, and no removed file is still imported. Dependency-free.
 *
 * Run:  node scripts/test-cleanup-and-route-safety.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const exists = (p) => fs.existsSync(path.join(ROOT, p));

// Recursively read all source files outside pages/api.
function sourceFiles() {
  const out = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, f.name);
      if (f.isDirectory()) { if (!/node_modules|\.next|\.git/.test(fp)) walk(fp); continue; }
      if (/\.(js|jsx)$/.test(f.name)) out.push(fp);
    }
  };
  ['pages', 'components', 'lib'].forEach(d => walk(path.join(ROOT, d)));
  return out;
}
const allSrc = sourceFiles().map(fp => ({ fp, rel: fp.replace(ROOT, '').replace(/\\/g, '/'), txt: fs.readFileSync(fp, 'utf8') }));
const frontendSrc = allSrc.filter(s => !/\/pages\/api\//.test(s.rel));

const REMOVED_ROUTES = ['pages/api/ai/summary.js', 'pages/api/mentor/today-plan.js', 'pages/api/history/filters.js', 'pages/api/prefetch.js'];
const REMOVED_HELPERS = ['lib/fetchAI.js'];
const RETAINED = [
  'pages/api/questions.js',        // Mixed/fallback
  'pages/api/score.js',            // compatibility
  'pages/api/config.js',           // retained (external uncertainty)
  'pages/api/ai/result-insights.js', 'pages/api/ai/explain.js', 'pages/api/ai/tip.js',
  'pages/api/mentor/plan.js', 'pages/api/mentor/refresh.js', 'pages/api/mentor/generate.js',
  'pages/api/mentor/profile.js', 'pages/api/mentor/task-action.js', 'pages/api/mentor/task-feedback.js',
  'pages/api/mentor/quiz-return.js', 'pages/api/mentor/topics.js',
  'pages/api/history/landing.js', 'pages/api/history/quizzes.js', 'pages/api/history/questions.js',
  'pages/api/history/subjects.js', 'pages/api/history/topics.js', 'pages/api/history/session/[sessionId].js',
  'pages/api/history/reattempt.js', 'pages/api/history/reattempt-filtered.js', 'pages/api/history/retry-metadata.js',
];

// Test 2 — removed routes gone + uncalled (no frontend fetch reference)
const routeStr = { 'pages/api/ai/summary.js': '/api/ai/summary', 'pages/api/mentor/today-plan.js': '/api/mentor/today-plan', 'pages/api/history/filters.js': '/api/history/filters', 'pages/api/prefetch.js': '/api/prefetch' };
REMOVED_ROUTES.forEach(r => {
  check(`removed route file gone: ${r}`, !exists(r));
  const str = routeStr[r];
  const callers = frontendSrc.filter(s => s.txt.includes(`fetch('${str}'`) || s.txt.includes(`fetch("${str}"`) || s.txt.includes('fetch(`' + str));
  check(`no frontend caller of removed ${str}`, callers.length === 0);
});

// Removed helper gone + no importer
REMOVED_HELPERS.forEach(h => {
  check(`removed helper gone: ${h}`, !exists(h));
  const importers = allSrc.filter(s => /from '@\/lib\/fetchAI'|require\(['"]@?\/?lib\/fetchAI/.test(s.txt));
  check(`no importer of removed ${h}`, importers.length === 0);
});

// Test 3/4/I — retained compatibility + fallback routes remain
RETAINED.forEach(r => check(`retained route present: ${r.split('/').pop()}`, exists(r)));

// Test 3 — /api/score retained + compatibility deprecation + idempotency note
const score = fs.readFileSync(path.join(ROOT, 'pages/api/score.js'), 'utf8');
check('T3 /api/score retained (compatibility)', exists('pages/api/score.js'));
check('T3 /api/score still delegates to persistScore', score.includes('persistScore'));

// Test 4 — /api/questions fallback + verified quiz caller
const quiz = fs.readFileSync(path.join(ROOT, 'pages/quiz.js'), 'utf8');
check('T4 /api/questions exists', exists('pages/api/questions.js'));
check('T4 quiz.js still references /api/questions fallback', quiz.includes('/api/questions?'));

// Test 5 — active AI callers use aiData, none use fetchAI
check('T5 no source imports lib/fetchAI', allSrc.every(s => !/from '@\/lib\/fetchAI'/.test(s.txt)));
check('T5 detailed.js uses aiData', fs.readFileSync(path.join(ROOT, 'pages/result/detailed.js'), 'utf8').includes("@/lib/data/aiData"));

// Test 6/7 — mentor/history active routes remain (covered by RETAINED) + today-plan/filters gone
check('T6 today-plan removed', !exists('pages/api/mentor/today-plan.js'));
check('T7 filters removed', !exists('pages/api/history/filters.js'));

// Test 8 — prefetch removed; config + summary decisions
check('T8 prefetch removed', !exists('pages/api/prefetch.js'));
check('T8 config retained', exists('pages/api/config.js'));
check('T8 summary removed', !exists('pages/api/ai/summary.js'));

// Test 9 — no current authenticated write to unsafe unscoped cache keys
const result = fs.readFileSync(path.join(ROOT, 'pages/result.js'), 'utf8');
check('T9 result.js does not write unscoped user_profile', !/writeCache\(CACHE_KEYS\.USER_PROFILE/.test(result));
check('T9 result.js patches scoped caches only', /buildUserScopedKey\(CACHE_KEYS\.DASHBOARD_BOOTSTRAP/.test(result) && /patchUserProfileCache/.test(result));

// Test 10 — guest saved migration: canonical key + legacy read
const savedData = fs.readFileSync(path.join(ROOT, 'lib/data/savedData.js'), 'utf8');
check('T10 guest saved canonical + legacy read', savedData.includes("'ssc_saved_questions'") && savedData.includes("'savedQuestions'"));

// Test 11 — no committed secret patterns in tracked source
const SECRET = /BEGIN [A-Z ]*PRIVATE KEY|AIza[0-9A-Za-z_-]{30}|"private_key":/;
const leaks = allSrc.filter(s => SECRET.test(s.txt));
check('T11 no committed secret patterns', leaks.length === 0);

// Test 12 — diagnostics/deprecations environment-gated (devLog/emit guard IS_DEV)
const helpers = ['lib/data/aiData.js', 'lib/server/serverCache.js', 'lib/server/aiRequestDedup.js', 'lib/data/profileData.js'];
check('T12 dev logs gated by IS_DEV/NODE_ENV', helpers.every(h => { const t = fs.readFileSync(path.join(ROOT, h), 'utf8'); return /IS_DEV|NODE_ENV !== 'production'/.test(t); }));

// Test 15 — no Link/router target points to a removed page (no page removed this step)
check('T15 personal-ai-analysis retained (possibly-shared URL)', exists('pages/personal-ai-analysis.jsx'));

// Test 16 — route count
const countRoutes = () => {
  const out = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const fp = path.join(d, f.name); if (f.isDirectory()) walk(fp); else if (f.name.endsWith('.js')) out.push(fp); } };
  walk(path.join(ROOT, 'pages/api'));
  return out.length;
};
check('T16 route count = 42 (was 46; 4 removed)', countRoutes() === 42);

// Test 25 — no invented routes
check('T25 no invented routes', !exists('pages/api/catalog.js') && !exists('pages/api/public') && !exists('pages/api/profile/snapshot.js'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
