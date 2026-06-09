import { CACHE_VERSION } from './cachePolicy';

// ─── Internal helpers ────────────────────────────────────────────────────────

function storageKey(key) {
  return `${CACHE_VERSION}:${key}`;
}

function safeGetItem(prefixedKey) {
  try {
    return localStorage.getItem(prefixedKey);
  } catch {
    return null;
  }
}

function safeSetItem(prefixedKey, value) {
  try {
    localStorage.setItem(prefixedKey, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(prefixedKey) {
  try {
    localStorage.removeItem(prefixedKey);
  } catch {}
}

// Development-only structured cache diagnostics. Emits the same `[apidiag]`
// JSON line shape as lib/apiDiagnostics.js so a single summarizer can parse
// both client and server events. Imports nothing server-only (no async_hooks),
// so it never bloats or breaks the browser bundle. Does NOT change behaviour.
function devCacheLog(status, details = {}) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    console.debug(`[apidiag] ${JSON.stringify({ kind: 'cache', status, ...details })}`);
  } catch {}
}

// ─── 1. getCacheKey ──────────────────────────────────────────────────────────

/** Returns the prefixed localStorage key for a given logical cache key. */
export function getCacheKey(key) {
  return storageKey(key);
}

// ─── 2. readCache ────────────────────────────────────────────────────────────

/**
 * Read a cache entry. Returns a rich object or null.
 *
 * Return shape when entry exists:
 *   { data, timestamp, meta, age, isFresh, source: 'localStorage' }
 *
 * Returns null on SSR, missing key, or corrupt JSON.
 * maxAgeMs is optional; isFresh is false when omitted and age > 0.
 */
export function readCache(key, maxAgeMs) {
  if (typeof window === 'undefined') return null;

  const raw = safeGetItem(storageKey(key));
  if (!raw) return null;

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    devCacheLog('parse-failed', { key });
    return null;
  }

  if (!entry || typeof entry.timestamp !== 'number' || entry.data === undefined) return null;

  const age = Date.now() - entry.timestamp;
  const isFresh = typeof maxAgeMs === 'number' ? age < maxAgeMs : false;

  return {
    data:      entry.data,
    timestamp: entry.timestamp,
    meta:      entry.meta || {},
    age,
    isFresh,
    source:    'localStorage',
  };
}

// ─── 3. writeCache ───────────────────────────────────────────────────────────

/**
 * Write data to the cache.
 * Stores { data, timestamp, meta }.
 * Returns true on success, false on failure.
 */
export function writeCache(key, data, meta = {}) {
  if (typeof window === 'undefined') return false;

  const entry = {
    data,
    timestamp: Date.now(),
    meta,
  };

  return safeSetItem(storageKey(key), JSON.stringify(entry));
}

// ─── 4. clearCache ───────────────────────────────────────────────────────────

/** Remove a single cache entry by key. Silent on error or SSR. */
export function clearCache(key) {
  if (typeof window === 'undefined') return;
  safeRemoveItem(storageKey(key));
}

/** Remove all localStorage entries owned by this app cache version. */
export function clearAllAppCache() {
  if (typeof window === 'undefined') return 0;

  const prefix = `${CACHE_VERSION}:`;
  const keysToRemove = [];

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }

    keysToRemove.forEach(key => safeRemoveItem(key));
    return keysToRemove.length;
  } catch {
    return 0;
  }
}

// ─── 5. patchCache ───────────────────────────────────────────────────────────

/**
 * Partially update cached data without a full re-fetch.
 *
 * - If no existing cache, returns null (nothing to patch).
 * - If patcher is a function, calls patcher(existingData) and stores the result.
 * - If patcher is a plain object, shallow-merges it into existingData.
 * - Writes the updated value back and returns the updated data.
 */
export function patchCache(key, patcher) {
  if (typeof window === 'undefined') return null;

  const existing = readCache(key);
  if (!existing) return null;

  let updated;
  if (typeof patcher === 'function') {
    updated = patcher(existing.data);
  } else if (patcher !== null && typeof patcher === 'object') {
    updated = { ...existing.data, ...patcher };
  } else {
    updated = patcher;
  }

  writeCache(key, updated, existing.meta);
  return updated;
}

// ─── 6. isCacheFresh ─────────────────────────────────────────────────────────

/** Returns true if the cached entry for key exists and is within maxAgeMs. */
export function isCacheFresh(key, maxAgeMs) {
  const entry = readCache(key, maxAgeMs);
  return Boolean(entry?.isFresh);
}

// ─── 7. formatLastUpdated ────────────────────────────────────────────────────

/**
 * Convert a timestamp to a human-readable string.
 *
 * Examples:
 *   Just now          (< 60 s)
 *   5 min ago         (< 60 min)
 *   Today, 9:42 AM    (same calendar day)
 *   Yesterday, 8:10 PM
 *   fallback: locale date string
 */
export function formatLastUpdated(timestamp) {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return null;

  const ts  = Number(timestamp);
  const now = Date.now();
  const diffMs = now - ts;

  if (diffMs < 0) return null;

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins} min ago`;

  const then  = new Date(ts);
  const today = new Date();
  const timeStr = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const thenDate  = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDiff   = Math.round((todayDate - thenDate) / 86_400_000);

  if (dayDiff === 0) return `Today, ${timeStr}`;
  if (dayDiff === 1) return `Yesterday, ${timeStr}`;
  return then.toLocaleDateString();
}

// ─── In-flight read-request registry (browser-tab-local, in-memory) ──────────
// Dedupes identical concurrent cache-aware READS so only one network request
// runs; other callers reuse the same active Promise. Keyed by method|cacheKey|url
// — the cacheKey already encodes account scope + params (Step 4), so different
// accounts / params / scopes never share a Promise. Entries are ALWAYS removed
// in finally(); resolved Promises are never retained (no response-body cache here).
const inflightReads = new Map();

function inflightReadKey({ key, url, fetchOptions }) {
  const method = (fetchOptions && fetchOptions.method ? fetchOptions.method : 'GET').toUpperCase();
  return `${method}|${key}|${url}`;
}

// Development-only inspector for active in-flight count. Not used in production UI.
export function __getInflightReadCount() {
  return inflightReads.size;
}

// ─── 8. fetchWithClientCache ─────────────────────────────────────────────────

/**
 * Fetch data with a localStorage cache layer.
 *
 * Options:
 *   key           — cache key (logical, un-prefixed)
 *   url           — API URL to fetch
 *   maxAgeMs      — freshness window in ms
 *   forceRefresh  — skip fresh-cache short-circuit (default false)
 *   fetchOptions  — passed directly to fetch()
 *   onCache(entry)  — called when a cached entry is found (fresh or stale)
 *   onFresh(data)   — called after a successful API response is written to cache
 *
 * Return shape:
 *   { data, fromCache, refreshed, stale, timestamp, error }
 */
export async function fetchWithClientCache({
  key,
  url,
  maxAgeMs,
  forceRefresh = false,
  fetchOptions = {},
  onCache,
  onFresh,
}) {
  // Always read existing cache so we can fall back to it on fetch failure.
  const cached = readCache(key, maxAgeMs);

  if (!forceRefresh && cached) {
    if (typeof onCache === 'function') onCache(cached);

    // Fresh — return immediately without hitting the network.
    if (cached.isFresh) {
      devCacheLog('fresh-hit', { key, url, ageMs: cached.age, maxAgeMs, ranNetwork: false, usedStale: false, forceRefresh });
      return {
        data:       cached.data,
        fromCache:  true,
        refreshed:  false,
        stale:      false,
        timestamp:  cached.timestamp,
        error:      null,
      };
    }
    devCacheLog('stale-hit', { key, url, ageMs: cached.age, maxAgeMs, forceRefresh });
  } else if (forceRefresh) {
    devCacheLog('force-refresh', { key, url, forceRefresh: true });
  } else {
    devCacheLog('miss', { key, url });
  }

  // Stale or missing — fetch from API, deduplicated across concurrent callers.
  // The cache write + network log run exactly once inside the shared Promise.
  const dedupeKey = inflightReadKey({ key, url, fetchOptions });
  let inflight = inflightReads.get(dedupeKey);
  if (inflight) {
    devCacheLog('inflight-reused', { key, url, forceRefresh, active: inflightReads.size });
  } else {
    devCacheLog('inflight-new', { key, url, forceRefresh, active: inflightReads.size + 1 });
    inflight = (async () => {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const wrote = writeCache(key, data);
      devCacheLog(wrote ? 'write-success' : 'write-failed', { key, url });
      devCacheLog('network-refresh', { key, url, ranNetwork: true, usedStale: false });
      return { data, timestamp: Date.now() };
    })();
    inflightReads.set(dedupeKey, inflight);
    // Always clear — on success AND failure — so the map never grows and a later
    // retry can create a fresh request. The actual callers handle rejection via
    // their own `await inflight` below; this cleanup chain must swallow so it is
    // never surfaced as an unhandled rejection.
    inflight
      .finally(() => {
        inflightReads.delete(dedupeKey);
        devCacheLog('inflight-cleared', { key, active: inflightReads.size });
      })
      .catch(() => {});
  }

  try {
    const { data, timestamp } = await inflight;
    // onFresh fires per-caller (each caller that requested this resource), with
    // the shared, already-written data — unchanged from prior behaviour.
    if (typeof onFresh === 'function') onFresh(data);
    return {
      data,
      fromCache:  false,
      refreshed:  true,
      stale:      false,
      timestamp,
      error:      null,
    };
  } catch (err) {
    devCacheLog('inflight-failed', { key, url });
    // Network/parse failure — return stale cache if available (each caller uses
    // its own `cached` snapshot read at entry, so stale fallback is per-caller).
    if (cached) {
      devCacheLog('stale-fallback', { key, url, usedStale: true, ranNetwork: true, errorCategory: err?.name || 'Error' });
      return {
        data:       cached.data,
        fromCache:  true,
        refreshed:  false,
        stale:      true,
        timestamp:  cached.timestamp,
        error:      err,
      };
    }

    // No cache at all — propagate error to caller.
    throw err;
  }
}

// ─── Legacy exports (kept for backward compatibility) ────────────────────────
// These were created in the prior step. Nothing imports them yet, but they are
// preserved to avoid breaking any future callers that may reference them.

export function cacheRead(key) {
  if (typeof window === 'undefined') return null;
  const raw = safeGetItem(storageKey(key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function cacheWrite(key, data, ttlMs) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  safeSetItem(storageKey(key), JSON.stringify({
    data,
    cachedAt:  now,
    expiresAt: now + ttlMs,
    version:   CACHE_VERSION,
  }));
}

export function cacheIsFresh(entry, now = Date.now()) {
  return Boolean(
    entry &&
    entry.data !== undefined &&
    typeof entry.expiresAt === 'number' &&
    entry.expiresAt > now
  );
}

export function cacheDelete(key) {
  if (typeof window === 'undefined') return;
  safeRemoveItem(storageKey(key));
}

export function cacheReadFresh(key, now = Date.now()) {
  const entry = cacheRead(key);
  return cacheIsFresh(entry, now) ? entry.data : null;
}
