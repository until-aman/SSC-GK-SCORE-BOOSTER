import { fetchWithClientCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

export function getLeaderboard({ scope = 'weekly', forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: scope === 'weekly' ? CACHE_KEYS.WEEKLY_LEADERBOARD : `leaderboard:${scope}`,
    url: `/api/leaderboard?scope=${encodeURIComponent(scope)}`,
    maxAgeMs: CACHE_TTL.THIRTY_MINUTES,
    forceRefresh,
  });
}
