// lib/data/profileData.js — shared CLIENT profile + Dream Post data (Step 12).
//
// One account-scoped profile cache (`user_profile:<scope>`) shared by Profile,
// Streak and Onboarding. Reads go through fetchWithClientCache (Step 5 dedup);
// mutations use raw fetch and patch the cache (never the read cache). The
// Dashboard bootstrap helper also writes this cache (see lib/data/appData.js),
// so opening the Dashboard warms the shared profile for these screens.

import { fetchWithClientCache, getCacheKey, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { buildUserScopedKey } from '@/lib/userCacheScope';

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'profile', event, ...extra })}`); } catch {}
}

const profileKey = (scope) => buildUserScopedKey(CACHE_KEYS.USER_PROFILE, scope || 'guest');
const dreamKey = (scope) => buildUserScopedKey(CACHE_KEYS.DREAM_POST, scope || 'guest');

// A profile is "complete" for Profile/Streak display when it has the existing
// user's normalized fields. A bare new-user marker ({isNewUser:true}) is NOT
// complete for display but is enough for Onboarding's decision.
export function isCompleteProfile(p) {
  return Boolean(p && typeof p.email === 'string' && p.email && p.isNewUser === false);
}

// ── Profile cache ────────────────────────────────────────────────────────────
export function readUserProfileCache(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return null;
  const e = readCache(profileKey(scope));
  return e ? e.data : null;
}
export function writeUserProfileCache(scope, profile) {
  if (typeof window === 'undefined' || !scope || scope === 'guest' || !profile) return;
  writeCache(profileKey(scope), profile);
  devLog('profile-cache-patched', { reason: 'write' });
}
export function patchUserProfileCache(scope, partial) {
  if (typeof window === 'undefined' || !scope || scope === 'guest' || !partial) return;
  const e = readCache(profileKey(scope));
  const base = e?.data || {};
  // Safe merge — never overwrite an existing field with undefined.
  const next = { ...base };
  Object.keys(partial).forEach(k => { if (partial[k] !== undefined) next[k] = partial[k]; });
  writeCache(profileKey(scope), next);
  devLog('profile-cache-patched', { reason: 'patch' });
}
export function markUserProfileStale(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return;
  const key = profileKey(scope);
  const e = readCache(key);
  if (!e) return;
  try { localStorage.setItem(getCacheKey(key), JSON.stringify({ data: e.data, timestamp: 0, meta: e.meta || {} })); } catch {}
}
export function dropUserProfileCache(scope) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getCacheKey(profileKey(scope))); } catch {}
}

// Cache-aware GET /api/user-profile (only hits network when missing/stale).
export function getUserProfile({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: profileKey(scope),
    url: '/api/user-profile',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

// PATCH name (existing route). Patches the shared cache; no follow-up GET.
export async function updateUserProfile({ scope, name }) {
  const res = await fetch('/api/user-profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && data.ok;
  if (ok) patchUserProfileCache(scope, { name, isNewUser: false });
  return { ok };
}

// ── Dream Post cache (one source of truth: dream_post:<scope>) ────────────────
export function readDreamPostCache(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return null;
  const e = readCache(dreamKey(scope));
  return e ? e.data : null;
}
export function patchDreamPostCache(scope, partial) {
  if (typeof window === 'undefined' || !scope || scope === 'guest' || !partial) return;
  const e = readCache(dreamKey(scope));
  const base = e?.data || {};
  const next = { ...base };
  Object.keys(partial).forEach(k => { if (partial[k] !== undefined) next[k] = partial[k]; });
  writeCache(dreamKey(scope), next);
  devLog('dream-post-cache-patched', {});
}
export function markDreamPostStale(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return;
  const key = dreamKey(scope);
  const e = readCache(key);
  if (!e) return;
  try { localStorage.setItem(getCacheKey(key), JSON.stringify({ data: e.data, timestamp: 0, meta: e.meta || {} })); } catch {}
}
export function dropDreamPostCache(scope) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getCacheKey(dreamKey(scope))); } catch {}
}

export function getDreamPost({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: dreamKey(scope),
    url: '/api/dream-post',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

let dreamInflight = null;
export async function updateDreamPost({ scope, dreamPost }) {
  if (dreamInflight) return dreamInflight;
  dreamInflight = (async () => {
    const res = await fetch('/api/dream-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dreamPost }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.success;
    if (ok) {
      patchDreamPostCache(scope, {
        dreamPost: data.dreamPost,
        dreamPostUpdatedAt: data.dreamPostUpdatedAt,
        dreamPostUnlockedAt: data.dreamPostUnlockedAt,
      });
      devLog('dream-post-mutation-success', {});
    }
    return { ok, error: data.error, ...data };
  })().finally(() => { dreamInflight = null; });
  return dreamInflight;
}
