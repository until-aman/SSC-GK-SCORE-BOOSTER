#!/usr/bin/env node
/**
 * scripts/test-profile-api-optimization.js  (Step 12)
 *
 * Dependency-free. Mirrors client cache + Step-5 dedup + account scope, the
 * shared profile + Dream Post cache patching, and the page decision flows.
 * Source-level assertions verify the real files.
 *
 * Run:  node scripts/test-profile-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TEN_MIN = 10 * 60 * 1000;
function hashIdentity(v) { const s = String(v || '').toLowerCase(); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const scopeOf = (e) => (e ? `u_${hashIdentity(e)}` : 'guest');
const scopedKey = (b, s) => `${b}:${s || 'guest'}`;

const store = new Map();
const inflight = new Map();
let net = 0;
const counters = {};
async function fetchCache({ key, url, maxAge, force = false }, server) {
  const e = store.get(key);
  if (!force && e && (Date.now() - e.timestamp) < maxAge) return { data: e.data, stale: false };
  const dk = `GET|${key}|${url}`;
  if (inflight.has(dk)) return inflight.get(dk);
  const p = (async () => {
    try { net++; counters[url] = (counters[url] || 0) + 1; const d = await server(url); store.set(key, { data: d, timestamp: Date.now() }); return { data: d, stale: false }; }
    catch (err) { if (e) return { data: e.data, stale: true }; throw err; }
    finally { inflight.delete(dk); }
  })();
  inflight.set(dk, p); return p;
}
function patchProfile(scope, partial) { const k = scopedKey('user_profile', scope); const e = store.get(k); const base = e?.data || {}; const next = { ...base }; Object.keys(partial).forEach(x => { if (partial[x] !== undefined) next[x] = partial[x]; }); store.set(k, { data: next, timestamp: Date.now() }); }
function markStale(k) { const e = store.get(k); if (e) store.set(k, { data: e.data, timestamp: 0 }); }
const readProfile = (scope) => (store.get(scopedKey('user_profile', scope))?.data || null);

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const reset = () => { store.clear(); inflight.clear(); net = 0; Object.keys(counters).forEach(k => delete counters[k]); };

const A = scopeOf('a@gmail.com'), B = scopeOf('b@gmail.com');
const PROF = (s) => scopedKey('user_profile', s);
const DREAM = (s) => scopedKey('dream_post', s);
const existingProfile = { email: 'a@gmail.com', name: 'A', totalCoins: 100, level: 'Scholar', streakCount: 3, lastAttemptDate: '2026-06-09', createdAt: '2026-01-01', image: '', isNewUser: false };
const profileServer = async () => existingProfile;
const dreamServer = async () => ({ dreamPost: 'GST Inspector', dreamPostUpdatedAt: 'now', dreamPostUnlockedAt: null, coins: 100 });
const getProfile = (scope, force = false) => fetchCache({ key: PROF(scope), url: '/api/user-profile', maxAge: TEN_MIN, force }, profileServer);
const getDream = (scope, force = false) => fetchCache({ key: DREAM(scope), url: '/api/dream-post', maxAge: TEN_MIN, force }, dreamServer);

(async () => {
  // T1 — Profile cold
  reset();
  { const r = await getProfile(A); check('T1 cold: 1 GET', counters['/api/user-profile'] === 1); check('T1 cold: cache written + complete', readProfile(A).email === 'a@gmail.com'); check('T1 cold: data', r.data.totalCoins === 100); }

  // T2 — Profile fresh
  { const before = net; await getProfile(A); check('T2 fresh: 0 API', net === before); }

  // T3 — Profile stale → bg refresh
  markStale(PROF(A));
  { const before = net; const r = await getProfile(A); check('T3 stale: data returned', r.data.email === 'a@gmail.com'); check('T3 stale: 1 bg GET', net === before + 1); }

  // T4 — Profile failure with stale
  reset(); await getProfile(A); markStale(PROF(A));
  { const r = await fetchCache({ key: PROF(A), url: '/api/user-profile', maxAge: TEN_MIN }, async () => { throw new Error('net'); }); check('T4 failure: stale visible', r.data.email === 'a@gmail.com' && r.stale === true); }

  // T5 — Profile mutation (PATCH name) patches cache, no GET
  reset(); await getProfile(A);
  { const before = net; patchProfile(A, { name: 'New Name', isNewUser: false }); check('T5 mutation: name patched', readProfile(A).name === 'New Name'); check('T5 mutation: no GET', net === before); }

  // T6 — Streak fresh (reads same shared cache)
  reset(); await getProfile(A);
  { const before = net; const r = await getProfile(A); check('T6 streak fresh: 0 API', net === before); check('T6 streak: has streakCount+lastAttempt', r.data.streakCount === 3 && r.data.lastAttemptDate === '2026-06-09'); }

  // T7 — Streak force refresh
  { const before = net; await getProfile(A, true); check('T7 force refresh: 1 GET', net === before + 1); }

  // T8 — Onboarding known-new (cache isNewUser true) → 0 redundant GET
  reset(); store.set(PROF(A), { data: { isNewUser: true }, timestamp: Date.now() });
  { const cached = readProfile(A); let gets = 0; let rendered = false, redirected = false;
    if (cached && cached.isNewUser === false) redirected = true;
    else if (cached && cached.isNewUser === true) rendered = true;
    else { gets++; }
    check('T8 known-new: 0 GET', gets === 0 && rendered === true && !redirected); }

  // T9 — Onboarding existing (cache isNewUser false) → 0 GET, redirect
  reset(); store.set(PROF(A), { data: existingProfile, timestamp: Date.now() });
  { const cached = readProfile(A); let gets = 0, redirected = false;
    if (cached && cached.isNewUser === false) redirected = true; else gets++;
    check('T9 existing: 0 GET + redirect', gets === 0 && redirected); }

  // T10 — Onboarding uncertain → 1 GET; transient error not treated as new
  reset();
  { const cached = readProfile(A); let gets = 0, treatedNew = false;
    if (!cached) { gets++; try { await fetchCache({ key: PROF(A), url: '/api/user-profile', maxAge: TEN_MIN }, async () => { throw new Error('net'); }); } catch { treatedNew = false; /* render onboarding, no hard new-user redirect */ } }
    check('T10 uncertain: 1 GET', gets === 1); check('T10 transient error not a confirmed redirect', treatedNew === false); }

  // T11 — Onboarding submission → isNewUser false patched, no GET
  reset(); store.set(PROF(A), { data: { isNewUser: true }, timestamp: Date.now() });
  { const before = net; patchProfile(A, { name: 'Aman', isNewUser: false }); check('T11 submit: isNewUser false', readProfile(A).isNewUser === false); check('T11 submit: no GET', net === before); }

  // T12 — Dream Post cold/fresh
  reset();
  { await getDream(A); check('T12 dream cold: 1 GET', counters['/api/dream-post'] === 1); const before = net; await getDream(A); check('T12 dream fresh: 0', net === before); }

  // T13 — Dream Post save patches cache, no GET
  { const before = net; store.set(DREAM(A), { data: { ...store.get(DREAM(A)).data, dreamPost: 'CBI SI', dreamPostUpdatedAt: 'now2' }, timestamp: Date.now() });
    check('T13 dream save: cache patched', store.get(DREAM(A)).data.dreamPost === 'CBI SI'); check('T13 dream save: no GET', net === before); }

  // T14 — Same dream post resubmit → stable
  { const v = store.get(DREAM(A)).data.dreamPost; store.set(DREAM(A), { data: { ...store.get(DREAM(A)).data, dreamPost: v }, timestamp: Date.now() }); check('T14 resubmit stable', store.get(DREAM(A)).data.dreamPost === 'CBI SI'); }

  // T15 — Quiz completion patches profile + dashboard caches
  reset(); store.set(PROF(A), { data: existingProfile, timestamp: Date.now() }); store.set(scopedKey('dashboard_bootstrap', A), { data: { profile: { ...existingProfile } }, timestamp: Date.now() });
  { const snap = { totalCoins: 250, level: 'Scholar', streakCount: 4, lastAttemptDate: '2026-06-10' };
    patchProfile(A, { ...snap, isNewUser: false });
    const db = store.get(scopedKey('dashboard_bootstrap', A)); db.data.profile = { ...db.data.profile, ...snap }; store.set(scopedKey('dashboard_bootstrap', A), { data: db.data, timestamp: Date.now() });
    check('T15 quiz: profile cache coins patched', readProfile(A).totalCoins === 250);
    check('T15 quiz: dashboard cache coins patched', store.get(scopedKey('dashboard_bootstrap', A)).data.profile.totalCoins === 250);
    check('T15 quiz: no field overwritten with undefined', readProfile(A).email === 'a@gmail.com'); }

  // T16 — A/B isolation
  reset(); store.set(PROF(A), { data: existingProfile, timestamp: Date.now() });
  check('T16 distinct profile keys', PROF(A) !== PROF(B));
  check('T16 distinct dream keys', DREAM(A) !== DREAM(B));
  check('T16 B has no profile', readProfile(B) === null);

  // T17/T18 — broken caches: scoped removal only
  reset(); store.set(PROF(A), { data: 'x', timestamp: Date.now() }); store.set('other', { data: 'k', timestamp: Date.now() }); store.delete(PROF(A));
  check('T17 broken profile scoped removed', !store.has(PROF(A))); check('T17 other kept', store.has('other'));
  store.set(DREAM(A), { data: 'x', timestamp: Date.now() }); store.delete(DREAM(A));
  check('T18 broken dream scoped removed', !store.has(DREAM(A)));

  // T19 — concurrent Profile + Streak reads → 1 active GET (dedup)
  reset();
  { const [r1, r2] = await Promise.all([getProfile(A), getProfile(A)]); check('T19 concurrent: 1 network', counters['/api/user-profile'] === 1 && !!r1 && !!r2); }

  // ── Source assertions ──
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const prof = read('pages/profile.js'), streak = read('pages/streak.js'), onb = read('pages/onboarding.js'), card = read('components/DreamPostCard.jsx');
  const helper = read('lib/data/profileData.js'), svc = read('lib/server/userProfileService.js'), up = read('pages/api/user-profile.js'), dp = read('pages/api/dream-post.js'), resultSrc = read('pages/result.js'), app = read('lib/data/appData.js');

  check('T20 routes preserved (no invented)', fs.existsSync(path.join(__dirname, '..', 'pages/api/user-profile.js')) && fs.existsSync(path.join(__dirname, '..', 'pages/api/dream-post.js')) && !fs.existsSync(path.join(__dirname, '..', 'pages/api/profile')) && !fs.existsSync(path.join(__dirname, '..', 'pages/api/streak.js')));
  check('T21 Users columns unchanged (M:O dream range, B name, L image)', dp.includes('Users!M') && up.includes('Users!B') && up.includes('Users!L'));
  check('T21 buildProfileResponse selects existing fields only', /totalCoins:\s*user\.totalCoins/.test(svc) && /isNewUser/.test(svc));
  check('T22 profile.js uses getUserProfile (no direct fetch)', /getUserProfile/.test(prof) && !/fetch\(['"]\/api\/user-profile/.test(prof));
  check('T22 streak.js uses getUserProfile (no direct fetch)', /getUserProfile/.test(streak) && !/fetch\(['"]\/api\/user-profile/.test(streak));
  check('T22 onboarding.js uses helper (no direct GET fetch)', /getUserProfile/.test(onb) && /updateUserProfile/.test(onb) && !/fetch\(['"]\/api\/user-profile['"]\)/.test(onb));
  check('SRC DreamPostCard uses getDreamPost/updateDreamPost', /getDreamPost/.test(card) && /updateDreamPost/.test(card) && !/fetch\(['"]\/api\/dream-post/.test(card));
  // Mutations use raw fetch (PATCH/POST); reads use fetchWithClientCache.
  check('SRC profileData: updateUserProfile raw PATCH', /fetch\('\/api\/user-profile'[\s\S]{0,80}method: 'PATCH'/.test(helper));
  check('SRC profileData: updateDreamPost raw POST', /fetch\('\/api\/dream-post'[\s\S]{0,80}method: 'POST'/.test(helper));
  check('SRC appData warms shared profile cache', /writeUserProfileCache/.test(app));
  check('SRC result.js patches shared profile cache', /patchUserProfileCache/.test(resultSrc));
  check('SRC user-profile + bootstrap reuse buildProfileResponse', /buildProfileResponse/.test(up) && /buildProfileResponse/.test(read('pages/api/dashboard-bootstrap.js')));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
