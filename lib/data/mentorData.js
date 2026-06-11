// lib/data/mentorData.js — client-side Mentor READ access (Step 8).
//
// Centralizes the account/date-scoped Mentor snapshot cache, freshness
// assessment, stale-marking, and in-flight dedup of identical plan reads.
// Mutations (task-action / refresh / generate / quiz-return / feedback) are
// NOT routed through here — only safe reads. Route names are unchanged.

import { getISTDateKey } from '@/lib/mentorCopy';
import { getUserCacheScope } from '@/lib/userCacheScope';

// Dynamic Mentor data (tasks can be completed/snoozed during the day) → short
// freshness window even though the cache key already includes the IST date.
export const MENTOR_FRESH_MS = 10 * 60 * 1000; // CACHE_TTL.TEN_MINUTES equivalent

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'mentor', event, ...extra })}`); } catch {}
}

// Canonical account- + date-scoped key: mentor_snapshot_v3:<scope>:<IST-date>.
export function mentorCacheKey(scope) {
  return `mentor_snapshot_v3:${scope || 'guest'}:${getISTDateKey()}`;
}
export function mentorScopeFromEmail(email) {
  return email ? getUserCacheScope({ user: { email } }) : 'guest';
}

export function readMentorSnapshotCache(scope) {
  if (typeof window === 'undefined') return null;
  const key = mentorCacheKey(scope);
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Broken JSON → remove ONLY this scoped entry (never a global clear).
    try { localStorage.removeItem(key); } catch {}
    devLog('mentor-cache-parse-failed', { scope });
    return null;
  }
}

export function writeMentorSnapshotCache(scope, snapshot) {
  if (typeof window === 'undefined' || !snapshot) return;
  try {
    localStorage.setItem(mentorCacheKey(scope), JSON.stringify({ ...snapshot, _cachedAt: Date.now() }));
  } catch {}
}

// Freshness uses the client write-stamp when present, else the server-issued
// lastSyncAt. A snapshot explicitly marked stale (_cachedAt:0) is never fresh.
export function isMentorSnapshotFresh(snapshot) {
  if (!snapshot) return false;
  const t = typeof snapshot._cachedAt === 'number'
    ? snapshot._cachedAt
    : Date.parse(snapshot.lastSyncAt || '');
  if (!t) return false;
  return (Date.now() - t) < MENTOR_FRESH_MS;
}

// Mark the scoped snapshot stale WITHOUT deleting it, so the next Mentor open
// renders the cached plan instantly and background-refreshes once.
export function markMentorCacheStale(scope) {
  if (typeof window === 'undefined') return;
  const key = mentorCacheKey(scope);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const snap = JSON.parse(raw);
    snap._cachedAt = 0;
    localStorage.setItem(key, JSON.stringify(snap));
    devLog('mentor-cache-marked-stale', { scope });
  } catch {}
}

// ── In-flight dedup for identical plan reads (Mentor uses direct fetch) ───────
const inflight = new Map();
function dedup(key, loader) {
  const existing = inflight.get(key);
  if (existing) { devLog('mentor-plan-inflight-reused', { key }); return existing; }
  const p = loader().finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

// GET /api/mentor/plan (deduped). Returns the parsed snapshot or throws.
export function fetchMentorPlan() {
  return dedup('plan', async () => {
    devLog('mentor-plan-network');
    const res = await fetch('/api/mentor/plan', { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not load mentor plan.');
    return data;
  });
}

// POST /api/mentor/refresh (deduped for identical simultaneous manual refreshes
// only — distinct user mutations are never merged because they share no key).
export function fetchMentorRefresh() {
  return dedup('refresh', async () => {
    devLog('mentor-manual-refresh');
    const res = await fetch('/api/mentor/refresh', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not refresh plan. Please try again.');
    return data;
  });
}
