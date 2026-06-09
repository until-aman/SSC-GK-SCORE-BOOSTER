// lib/data/historyClientData.js — CLIENT-side cache-aware History reads (Step 9).
//
// Distinct from the server-side lib/historyData.js. All authenticated History
// reads are account-scoped (Step 4) and go through fetchWithClientCache so Step 5
// in-flight dedup applies (the three landing loaders share ONE /api/history/landing
// request). Mutations (reattempt / retry-metadata / saved toggles) NEVER route
// through here.

import { fetchWithClientCache, getCacheKey, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { buildUserScopedKey } from '@/lib/userCacheScope';

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'history', event, ...extra })}`); } catch {}
}

// Stable, normalized query string for keys (sorted params; no leading '?').
export function normalizeHistoryQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .forEach(k => usp.set(k, String(params[k])));
  return usp.toString();
}

const scoped = (baseKey, scope) => buildUserScopedKey(baseKey, scope || 'guest');

// ── Reads (cache-aware) ──────────────────────────────────────────────────────

export function getHistoryLanding({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_LANDING, scope),
    url: '/api/history/landing',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export function getHistoryQuizzes({ scope, query = '', forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_QUIZZES(query), scope),
    url: `/api/history/quizzes${query ? `?${query}` : ''}`,
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export function getHistoryQuestions({ scope, query = '', forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_QUESTIONS(query), scope),
    url: `/api/history/questions${query ? `?${query}` : ''}`,
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export function getHistorySubjects({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_SUBJECTS, scope),
    url: '/api/history/subjects',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export function getHistoryTopics({ scope, subject, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_TOPICS(subject), scope),
    url: `/api/history/topics?subject=${encodeURIComponent(subject || '')}`,
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export function getHistorySession({ scope, sessionId, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.HISTORY_SESSION(sessionId), scope),
    url: `/api/history/session/${sessionId}`,
    maxAgeMs: CACHE_TTL.THIRTY_MINUTES,
    forceRefresh,
  });
}

export function getScoreHistory({ scope, forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scoped(CACHE_KEYS.SCORE_HISTORY, scope),
    url: '/api/score-history',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

// ── Stale-marking (keeps data for immediate render; next read → background refresh) ──

function markStale(baseKey, scope) {
  if (typeof window === 'undefined') return;
  const key = scoped(baseKey, scope);
  const existing = readCache(key);
  if (!existing) return;
  try {
    // Rewrite with timestamp 0 so the next fetchWithClientCache treats it as
    // stale (renders cached data, refreshes once) without deleting it.
    localStorage.setItem(getCacheKey(key), JSON.stringify({ data: existing.data, timestamp: 0, meta: existing.meta || {} }));
  } catch {}
}

// After a quiz completion / retry-metadata write: mark the account-scoped
// landing + summary + subjects + score-history stale. Per-query quizzes/questions
// caches can't be enumerated by exact key here, so the landing default (the only
// thing shown without an explicit user query) is the one that must reflect the
// new session immediately on next open. Does NOT touch other users, question
// banks, Dashboard, Daily Challenge, Saved or Mentor caches.
export function markHistoryCachesStale(scope) {
  if (!scope || scope === 'guest') return;
  markStale(CACHE_KEYS.HISTORY_LANDING, scope);
  markStale(CACHE_KEYS.HISTORY_SUMMARY, scope);
  markStale(CACHE_KEYS.HISTORY_SUBJECTS, scope);
  markStale(CACHE_KEYS.SCORE_HISTORY, scope);
  devLog('history-cache-marked-stale', { scope });
}

// Remove a broken/parse-failed scoped entry (single key only; no global clear).
export function dropHistoryCache(baseKey, scope) {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getCacheKey(scoped(baseKey, scope))); } catch {}
}
