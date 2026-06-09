import { fetchWithClientCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { buildUserScopedKey } from '@/lib/userCacheScope';
import { writeUserProfileCache } from '@/lib/data/profileData';

// `scope` (from getUserCacheScope(session)) isolates an account's bootstrap
// payload (which contains profile data) from other accounts / guest on the same
// browser. Defaults to 'guest'. No API/TTL change.
export async function getDashboardBootstrap({ forceRefresh = false, scope = 'guest' } = {}) {
  const result = await fetchWithClientCache({
    key: buildUserScopedKey(CACHE_KEYS.DASHBOARD_BOOTSTRAP, scope),
    url: '/api/dashboard-bootstrap',
    maxAgeMs: CACHE_TTL.ONE_DAY,
    forceRefresh,
  });
  // Step 12: warm the shared profile cache from a valid existing-user bootstrap
  // profile so Profile/Streak/Onboarding open with zero extra requests.
  try {
    const p = result?.data?.profile;
    if (p && p.isNewUser === false && p.email) writeUserProfileCache(scope, p);
  } catch {}
  return result;
}
