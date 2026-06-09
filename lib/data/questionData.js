import { fetchWithClientCache, readCache, writeCache, getCacheKey } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getISTDateString } from '@/lib/streak';

// Step 14: full subject banks can be large — keep at most this many in
// localStorage (oldest-first eviction). Measured ~30–120 KB per subject bank,
// so 3 banks stays well within a safe browser-storage budget.
const MAX_QUESTION_BANKS = 3;
const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';

function evictOldQuestionBanks(keepKey) {
  if (typeof window === 'undefined') return;
  try {
    const storagePrefix = getCacheKey('question_bank:'); // versioned prefix
    const keepStorageKey = keepKey ? getCacheKey(keepKey) : null;
    const banks = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(storagePrefix)) continue;
      let ts = 0;
      try { ts = JSON.parse(localStorage.getItem(k)).timestamp || 0; } catch { ts = -1; /* malformed → evict first */ }
      banks.push({ k, ts });
    }
    if (banks.length <= MAX_QUESTION_BANKS) return;
    banks.sort((a, b) => a.ts - b.ts); // oldest/malformed first
    const removeCount = banks.length - MAX_QUESTION_BANKS;
    let removed = 0;
    for (const b of banks) {
      if (removed >= removeCount) break;
      if (b.k === keepStorageKey) continue; // never evict the just-written/active bank
      localStorage.removeItem(b.k);
      removed += 1;
      if (IS_DEV) { try { console.debug('[apidiag] {"kind":"public-cache","event":"question-bank-client-evicted"}'); } catch {} }
    }
  } catch { /* eviction is best-effort; never block quiz loading */ }
}

export function getTopics({ collection = 'general', subject, forceRefresh = false } = {}) {
  const params = new URLSearchParams({ collection });
  if (subject) params.set('subject', subject);

  return fetchWithClientCache({
    key: CACHE_KEYS.TOPICS(collection, subject || 'all'),
    url: `/api/topics?${params.toString()}`,
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
}

export function getDailyChallenge({ forceRefresh = false } = {}) {
  const today = getISTDateString();
  const key = CACHE_KEYS.DAILY_CHALLENGE(today);

  if (typeof window !== 'undefined' && !readCache(key, CACHE_TTL.ONE_DAY)) {
    const legacyKey = `dc_${today}`;
    const legacyCached = localStorage.getItem(legacyKey);
    if (legacyCached) {
      try {
        writeCache(key, JSON.parse(legacyCached), { date: today });
        localStorage.removeItem(legacyKey);
      } catch {}
    }
  }

  return fetchWithClientCache({
    key,
    url: '/api/daily-challenge',
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
}

export async function getQuestionBank({ collection = 'general', subject, forceRefresh = false } = {}) {
  if (!subject) {
    throw new Error('subject is required for getQuestionBank');
  }

  const params = new URLSearchParams({ collection, subject });
  const key = CACHE_KEYS.QUESTION_BANK(collection, subject);

  const result = await fetchWithClientCache({
    key,
    url: `/api/question-bank?${params.toString()}`,
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
  // Bound localStorage growth: keep only the newest MAX_QUESTION_BANKS subject
  // banks (never the one just written). Best-effort; does not touch other caches.
  evictOldQuestionBanks(key);
  return result;
}
