import { fetchWithClientCache, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getISTDateString } from '@/lib/streak';

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

export function getQuestionBank({ collection = 'general', subject, forceRefresh = false } = {}) {
  if (!subject) {
    throw new Error('subject is required for getQuestionBank');
  }

  const params = new URLSearchParams({ collection, subject });

  return fetchWithClientCache({
    key: CACHE_KEYS.QUESTION_BANK(collection, subject),
    url: `/api/question-bank?${params.toString()}`,
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
}
