import { CACHE_VERSION } from './cachePolicy';

function storageKey(key) {
  return `${CACHE_VERSION}:${key}`;
}

/**
 * Read a cache entry. Returns the full entry object { data, cachedAt, expiresAt, version }
 * or null if the key doesn't exist or JSON is corrupt.
 */
export function cacheRead(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write data to the cache with a TTL (milliseconds).
 */
export function cacheWrite(key, data, ttlMs) {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const entry = {
      data,
      cachedAt:  now,
      expiresAt: now + ttlMs,
      version:   CACHE_VERSION,
    };
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {}
}

/**
 * Returns true if the entry exists and has not expired.
 */
export function cacheIsFresh(entry, now = Date.now()) {
  return Boolean(
    entry &&
    entry.data !== undefined &&
    typeof entry.expiresAt === 'number' &&
    entry.expiresAt > now
  );
}

/**
 * Delete a single cache entry.
 */
export function cacheDelete(key) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(key));
  } catch {}
}

/**
 * Convenience: read and return data only if fresh, otherwise null.
 */
export function cacheReadFresh(key, now = Date.now()) {
  const entry = cacheRead(key);
  return cacheIsFresh(entry, now) ? entry.data : null;
}
