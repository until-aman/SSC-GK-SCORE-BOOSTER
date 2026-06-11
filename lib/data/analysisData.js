// lib/data/analysisData.js — CLIENT-side Analysis data access (Step 10).
//
// Read-only activity is account-scoped (Step 4) and goes through
// fetchWithClientCache (Step 5 dedup). Guests NEVER call the network helper.
// The interest mutation (POST /api/notify-interest) is NOT routed through the
// read cache; a module-level in-flight guard prevents duplicate submits.

import { fetchWithClientCache, getCacheKey, readCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { buildUserScopedKey } from '@/lib/userCacheScope';

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'analysis', event, ...extra })}`); } catch {}
}

const activityKey = (scope) => buildUserScopedKey(CACHE_KEYS.ANALYSIS_ACTIVITY, scope || 'guest');
const interestKey = (scope) => buildUserScopedKey(CACHE_KEYS.ANALYSIS_INTEREST, scope || 'guest');

// ── Activity (cache-aware GET; logged-in only) ───────────────────────────────
export function getAnalysisActivity({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: activityKey(scope),
    url: '/api/analysis-activity',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

// Mark stale (keep data for instant render; next open → background refresh).
export function markAnalysisActivityStale(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return;
  const key = activityKey(scope);
  const existing = readCache(key);
  if (!existing) return;
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ data: existing.data, timestamp: 0, meta: existing.meta || {} }));
    devLog('analysis-activity-marked-stale', { scope });
  } catch {}
}

// Remove only the broken scoped Analysis entry (no global clear).
export function dropAnalysisActivityCache(scope) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getCacheKey(activityKey(scope))); } catch {}
}

// ── Interest state (account-scoped, server-confirmed) ────────────────────────
// Stored as a scoped boolean flag (no email in key). Guests get no confirmed
// state. Reflects a confirmed server write/check — not an optimistic guess.
export function readAnalysisInterest(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return false;
  try { return localStorage.getItem(interestKey(scope)) === 'true'; } catch { return false; }
}
export function patchAnalysisInterestState(scope, recorded = true) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return;
  try { localStorage.setItem(interestKey(scope), recorded ? 'true' : 'false'); } catch {}
}

// ── Interest mutation (POST; never cached; in-flight deduped) ─────────────────
let interestInflight = null;
export function recordAnalysisInterest({ collection = 'AI Analysis' } = {}) {
  if (interestInflight) { devLog('analysis-interest-pending', { reused: true }); return interestInflight; }
  devLog('analysis-interest-pending', {});
  interestInflight = (async () => {
    const res = await fetch('/api/notify-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && (data.success || data.alreadyJoined);
    if (data.alreadyJoined) devLog('analysis-interest-already-recorded', {});
    else if (ok) devLog('analysis-interest-recorded', {});
    else if (data.guestBlocked) devLog('analysis-interest-guest-blocked', {});
    else devLog('analysis-interest-failed', {});
    return { ok, alreadyRecorded: Boolean(data.alreadyJoined), guestBlocked: Boolean(data.guestBlocked) };
  })().finally(() => { interestInflight = null; });
  return interestInflight;
}
