import { fetchWithClientCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

export function getDashboardBootstrap({ forceRefresh = false } = {}) {
  return fetchWithClientCache({
    key: CACHE_KEYS.DASHBOARD_BOOTSTRAP,
    url: '/api/dashboard-bootstrap',
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
}
