export const LEADERBOARD_CACHE_KEY = 'ssc_leaderboard_cache_v1';
export const LEGACY_WEEKLY_CHAMPIONS_CACHE_KEY = 'ssc_weekly_champions';
export const LEADERBOARD_REFRESH_LOCK_KEY = 'ssc_leaderboard_refresh_started_at';
export const LEADERBOARD_CACHE_TTL = 30 * 60 * 1000;

export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function normalizeLeader(leader, index = 0) {
  return {
    rank: leader?.rank || index + 1,
    name: leader?.name || 'User',
    xp: Math.round(Number(leader?.xp ?? leader?.totalScore ?? 0)),
    avatar: leader?.avatar || leader?.image || '',
    level: leader?.level || 'Aspirant',
    email: leader?.email || '',
  };
}

export function toDisplayLeader(entry) {
  return {
    rank: entry?.rank,
    name: entry?.name,
    totalScore: Number(entry?.xp || 0),
    image: entry?.avatar || '',
    level: entry?.level || 'Aspirant',
    email: entry?.email || '',
  };
}

export function buildLeaderboardCache({ leaders = [], currentUser = null, source = 'api', now = Date.now() }) {
  const top10 = leaders.slice(0, 10).map(normalizeLeader);
  const user = currentUser ? normalizeLeader(currentUser, currentUser.rank ? currentUser.rank - 1 : top10.length) : null;
  const top3Floor = top10[2]?.xp || 0;

  return {
    weekKey: getWeekKey(new Date(now)),
    top10,
    userRank: user ? { ...user, gapToTop3: Math.max(0, top3Floor - user.xp) } : null,
    lastFetchedAt: now,
    expiresAt: now + LEADERBOARD_CACHE_TTL,
    source,
  };
}

export function readLeaderboardCache() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const legacy = localStorage.getItem(LEGACY_WEEKLY_CHAMPIONS_CACHE_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy);
    const leaders = Array.isArray(parsed) ? parsed : parsed?.leaders || [];
    if (!leaders.length) return null;
    return buildLeaderboardCache({
      leaders,
      now: parsed?.updatedAt ? new Date(parsed.updatedAt).getTime() : Date.now(),
      source: 'cache',
    });
  } catch {
    return null;
  }
}

export function writeLeaderboardCache(cache) {
  if (typeof window === 'undefined' || !cache) return;
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function isLeaderboardCacheFresh(cache, now = Date.now()) {
  return Boolean(
    cache?.weekKey === getWeekKey(new Date(now)) &&
    Array.isArray(cache?.top10) &&
    cache.top10.length > 0 &&
    Number(cache.expiresAt) > now
  );
}

export function claimLeaderboardRefresh(now = Date.now()) {
  if (typeof window === 'undefined') return true;
  try {
    const lastRefreshStartedAt = Number(localStorage.getItem(LEADERBOARD_REFRESH_LOCK_KEY) || 0);
    if (Number.isFinite(lastRefreshStartedAt) && now - lastRefreshStartedAt < LEADERBOARD_CACHE_TTL) {
      return false;
    }
    localStorage.setItem(LEADERBOARD_REFRESH_LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

export function formatLastUpdated(timestamp) {
  if (!timestamp) return null;
  const diffMs = Date.now() - Number(timestamp);
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `Last updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `Last updated ${hours} hr${hours === 1 ? '' : 's'} ago`;
}
