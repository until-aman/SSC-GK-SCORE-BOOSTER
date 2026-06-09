// lib/server/serverCache.js — shared bounded server-process TTL cache (Step 14).
//
// Reuses a COMPLETED safe public result for a TTL (distinct from Step 6's
// in-flight physical-read dedup). Server-process-local memory; no new env var,
// no paid dependency. Failed loaders are NOT cached. Identical concurrent
// loaders share one Promise. Never store user-private data under a global key.

'use strict';

const IS_DEV = process.env.NODE_ENV !== 'production';
const CACHE_VERSION = 'sc_v1';

const store = new Map();      // key -> { value, expiresAt, storedAt }
const pending = new Map();    // key -> Promise (in-flight loader)
const DEFAULT_MAX_ENTRIES = 200;

function emit(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'public-cache', event, ...extra })}`); } catch {}
}

function vkey(key) { return `${CACHE_VERSION}:${key}`; }

function evictIfNeeded(max) {
  if (store.size <= max) return;
  // Remove oldest-stored entries first.
  const entries = [...store.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
  const removeCount = store.size - max;
  for (let i = 0; i < removeCount; i += 1) { store.delete(entries[i][0]); emit('public-server-cache-evicted', {}); }
}

function getServerCache(key) {
  const k = vkey(key);
  const entry = store.get(k);
  if (!entry) { emit('public-server-cache-miss', {}); return undefined; }
  if (Date.now() > entry.expiresAt) { store.delete(k); emit('public-server-cache-stale', {}); return undefined; }
  emit('public-server-cache-hit', {});
  return entry.value;
}

function setServerCache(key, value, ttlMs, { maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const k = vkey(key);
  store.set(k, { value, expiresAt: Date.now() + ttlMs, storedAt: Date.now() });
  evictIfNeeded(maxEntries);
  emit('public-server-cache-write', {});
}

function deleteServerCache(key) { store.delete(vkey(key)); }

function clearServerCachePrefix(prefix) {
  const p = vkey(prefix);
  for (const k of [...store.keys()]) if (k.startsWith(p)) store.delete(k);
}

// Return cached value if fresh; else run loader once (shared across concurrent
// callers), cache a successful result, and return it. Loader errors propagate
// and are NOT cached.
async function getOrLoadServerCache(key, ttlMs, loader, opts = {}) {
  const cached = getServerCache(key);
  if (cached !== undefined) return cached;
  const k = vkey(key);
  if (pending.has(k)) return pending.get(k);
  const p = (async () => loader())()
    .then((value) => { if (value !== undefined && value !== null) setServerCache(key, value, ttlMs, opts); return value; })
    .finally(() => { pending.delete(k); });
  pending.set(k, p);
  return p;
}

function getServerCacheStats() { return { size: store.size, pending: pending.size }; }

module.exports = {
  CACHE_VERSION,
  getServerCache,
  setServerCache,
  deleteServerCache,
  clearServerCachePrefix,
  getOrLoadServerCache,
  getServerCacheStats,
};
