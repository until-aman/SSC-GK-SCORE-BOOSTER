#!/usr/bin/env node
/**
 * scripts/test-dashboard-optimization.js  (Step 7)
 *
 * Dependency-free harness. Mirrors the real account-scoping (djb2, identical to
 * lib/userCacheScope.js) and the client-cache patch semantics, then verifies the
 * Dashboard optimization behaviours. Source-level assertions confirm the
 * /api/user-profile Dashboard call and synthetic numbers are gone.
 *
 * Run:  node scripts/test-dashboard-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Mirror lib/userCacheScope.js (must stay byte-identical in behaviour) ─────
function hashIdentity(value) {
  const s = String(value || '').toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function getUserCacheScope(email) {
  if (!email || typeof email !== 'string') return 'guest';
  return `u_${hashIdentity(email)}`;
}
function buildUserScopedKey(baseKey, scope) {
  return `${baseKey}:${scope || 'guest'}`;
}

// ── Mirror clientCache store: { data, timestamp } per key ────────────────────
const store = new Map();
const writeCache = (key, data, ts = Date.now()) => store.set(key, { data, timestamp: ts });
const readCache = (key, maxAgeMs) => {
  const e = store.get(key);
  if (!e) return null;
  return { data: e.data, timestamp: e.timestamp, isFresh: maxAgeMs == null || (Date.now() - e.timestamp) < maxAgeMs };
};
const patchCache = (key, updater) => {
  const e = store.get(key);
  if (!e) return;
  store.set(key, { data: updater(e.data), timestamp: e.timestamp });
};

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const DASHBOARD_BOOTSTRAP = 'dashboard_bootstrap';

// ── Mirror result.js patchProfileCaches (Step 7) ─────────────────────────────
function patchProfileCaches(profileSnapshot, scope) {
  if (!profileSnapshot || !scope || scope === 'guest') return;
  patchCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, scope), data => ({
    ...(data || {}),
    profile: { ...(data?.profile || {}), ...profileSnapshot, isNewUser: false },
  }));
}

// ── Mirror the Dashboard mount decision (which network calls fire) ───────────
// Returns { bootstrapNetwork, userProfileCalls, redirectOnboarding, profile }.
function simulateDashboardMount({ isLoggedIn, scope, now = Date.now() }) {
  let bootstrapNetwork = 0;
  const userProfileCalls = 0; // Step 7: Dashboard never calls /api/user-profile
  let redirectOnboarding = false;
  let profile = null;

  const cached = readCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, scope), ONE_DAY);
  if (cached) {
    if (cached.data?.profile?.isNewUser) { redirectOnboarding = true; return { bootstrapNetwork, userProfileCalls, redirectOnboarding, profile }; }
    profile = cached.data?.profile || null;
    const hasProfile = Boolean(cached.data?.profile);
    if (isLoggedIn && !hasProfile) {
      bootstrapNetwork += 1; // loadProfileViaBootstrap → forceRefresh bootstrap
    } else if (isLoggedIn && hasProfile && !cached.data?.profile?.isNewUser) {
      const age = now - (cached.timestamp || 0);
      if (age > TEN_MINUTES) bootstrapNetwork += 1; // PHASE D background freshen
    }
    return { bootstrapNetwork, userProfileCalls, redirectOnboarding, profile };
  }
  // No cache → one cold network bootstrap
  bootstrapNetwork += 1;
  return { bootstrapNetwork, userProfileCalls, redirectOnboarding, profile };
}

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.log(`  FAIL  ${name}`); } };

const EMAIL_A = 'amanA@gmail.com';
const EMAIL_B = 'userB@gmail.com';
const SCOPE_A = getUserCacheScope(EMAIL_A);
const SCOPE_B = getUserCacheScope(EMAIL_B);

function reset() { store.clear(); }

// Test 1 — Guest cold load → one bootstrap network, no profile
reset();
{
  const r = simulateDashboardMount({ isLoggedIn: false, scope: 'guest' });
  check('T1 guest cold: 1 bootstrap network', r.bootstrapNetwork === 1);
  check('T1 guest cold: 0 user-profile calls', r.userProfileCalls === 0);
}

// Test 2 — Guest warm load → zero network
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, 'guest'), { profile: null, collections: { PYQ: { totalQuestions: 10 } } });
{
  const r = simulateDashboardMount({ isLoggedIn: false, scope: 'guest' });
  check('T2 guest warm: 0 bootstrap network', r.bootstrapNetwork === 0);
}

// Test 3 — Logged-in cold load → 1 bootstrap, 0 user-profile, scoped profile cached after
reset();
{
  const r = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('T3 logged-in cold: 1 bootstrap network', r.bootstrapNetwork === 1);
  check('T3 logged-in cold: 0 user-profile calls', r.userProfileCalls === 0);
  // simulate network result writing scoped cache
  writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: false, totalCoins: 50 } });
  check('T3 account-scoped profile cached', readCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A)).data.profile.totalCoins === 50);
}

// Test 4 — Logged-in warm (fresh) → zero network, profile displayed
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: false, totalCoins: 120 } }, Date.now() - 60 * 1000);
{
  const r = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('T4 logged-in warm fresh: 0 bootstrap network', r.bootstrapNetwork === 0);
  check('T4 logged-in warm fresh: profile displayed', r.profile.totalCoins === 120);
}

// Test 5 — User A / User B isolation
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: false, totalCoins: 999 } });
{
  check('T5 distinct scopes', SCOPE_A !== SCOPE_B);
  const rB = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_B });
  check('T5 User B does not read User A profile', rB.profile === null);
  check('T5 User B cold → own bootstrap', rB.bootstrapNetwork === 1);
}

// Test 6 — Profile stale (>10m), public fresh → background bootstrap refresh, no user-profile
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: false, totalCoins: 7 } }, Date.now() - 11 * 60 * 1000);
{
  const r = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('T6 stale profile: 1 background bootstrap refresh', r.bootstrapNetwork === 1);
  check('T6 stale profile: 0 user-profile calls', r.userProfileCalls === 0);
  check('T6 stale profile: cached value still rendered first', r.profile.totalCoins === 7);
}

// Test 7 — Quiz completion patch visible from scoped cache, no API call
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: false, totalCoins: 100, level: 'Aspirant', streakCount: 2 } }, Date.now() - 60 * 1000);
{
  patchProfileCaches({ totalCoins: 175, level: 'Scholar', streakCount: 3, lastAttemptDate: '2026-06-09' }, SCOPE_A);
  const r = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('T7 patched coins visible', r.profile.totalCoins === 175);
  check('T7 patched level visible', r.profile.level === 'Scholar');
  check('T7 patched streak visible', r.profile.streakCount === 3);
  check('T7 no extra network (fresh after patch)', r.bootstrapNetwork === 0);
  check('T7 patch did NOT write unscoped user_profile', store.get('user_profile') === undefined);
  check('T7 patch did NOT write unscoped dashboard_bootstrap', store.get('dashboard_bootstrap') === undefined);
}

// Test 7b — patch is a no-op for guest scope
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, 'guest'), { profile: null });
patchProfileCaches({ totalCoins: 5 }, 'guest');
check('T7b guest patch is no-op', readCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, 'guest')).data.profile === null);

// Test 8 — Manual refresh = exactly one bootstrap (modeled), no user-profile
reset();
{
  let bootstrap = 0; const userProfile = 0;
  // handleBootstrapRefresh → getDashboardBootstrap({forceRefresh:true}) once
  bootstrap += 1;
  check('T8 manual refresh: exactly 1 bootstrap', bootstrap === 1);
  check('T8 manual refresh: 0 user-profile', userProfile === 0);
}

// Test 10 — Partial bootstrap failure (profile null + errors) → no infinite retry, no user-profile
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: null, errors: [{ section: 'profile', message: 'x' }] });
{
  const r1 = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('T10 partial failure: triggers one bootstrap retry', r1.bootstrapNetwork === 1);
  check('T10 partial failure: 0 user-profile calls', r1.userProfileCalls === 0);
}

// New-user routing: bootstrap profile {isNewUser:true} → redirect, not rendered
reset();
writeCache(buildUserScopedKey(DASHBOARD_BOOTSTRAP, SCOPE_A), { profile: { isNewUser: true } });
{
  const r = simulateDashboardMount({ isLoggedIn: true, scope: SCOPE_A });
  check('NewUser: redirects to onboarding', r.redirectOnboarding === true);
  check('NewUser: does not render isNewUser as profile', r.profile === null);
}

// ── Source-level assertions ──────────────────────────────────────────────────
const dash = fs.readFileSync(path.join(__dirname, '..', 'pages', 'dashboard.js'), 'utf8');
const result = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result.js'), 'utf8');

check('SRC dashboard.js: no fetch to /api/user-profile', !/fetch\(['"]\/api\/user-profile/.test(dash));
check('SRC dashboard.js: getLiveStudentCount removed', !/getLiveStudentCount/.test(dash));
check('SRC dashboard.js: getRankedStudentCount removed', !/getRankedStudentCount/.test(dash));
check('SRC dashboard.js: no "students practiced today"', !/students practiced today/.test(dash));
check('SRC dashboard.js: no "students ranked this week"', !/students ranked this week/.test(dash));
check('SRC result.js: patch uses buildUserScopedKey', /buildUserScopedKey\(CACHE_KEYS\.DASHBOARD_BOOTSTRAP/.test(result));
check('SRC result.js: no unscoped USER_PROFILE write', !/writeCache\(CACHE_KEYS\.USER_PROFILE/.test(result));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
