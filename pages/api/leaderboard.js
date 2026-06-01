import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getLeaderboardData,
  getUserRows,
  getLeaderboardCacheRow,
  updateLeaderboardCacheRow,
} from '@/lib/sheets';
import { getISTDateString } from '@/lib/streak';

const CACHE_TTL = 60 * 1000; // 1 minute fallback (cache is also invalidated on every score save)

// In-memory leaderboard cache (30 sec) — sits in front of Sheets-based cache
// Resets on cold start, which is fine — prevents hammering on warm instances
let memCache = { data: null, ts: 0 };
const MEM_CACHE_TTL = 30 * 1000;

// Weekly leaderboard — sum coins earned (col L = index 11) from score rows
function computeWeeklyLeaderboard(scoreRows, publicEmails, imageMap = {}, levelMap = {}) {
  const grouped = {};

  scoreRows.forEach(row => {
    const email = row[1];
    if (!email || !publicEmails.has(email)) return;
    const coins = parseFloat(row[11]) || 0;
    if (!grouped[email]) {
      grouped[email] = { email, name: row[2] || email, totalScore: 0 };
    }
    if (row[2]) grouped[email].name = row[2];
    grouped[email].totalScore += coins;
  });

  return Object.values(grouped)
    .map(u => ({
      ...u,
      totalScore: Math.round(u.totalScore),
      level: levelMap[u.email] || 'Aspirant',
      image: imageMap[u.email] || '',
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((e, i) => ({ ...e, rank: i + 1 }))
    .slice(0, 50);
}

// All-time leaderboard — use total coins from Users sheet (col F = index 5)
function computeAllTimeLeaderboard(userRows, publicEmails, imageMap = {}) {
  return userRows
    .filter(r => r[0] && publicEmails.has(r[0]))
    .map(r => ({
      email:      r[0],
      name:       r[1] || r[0],
      totalScore: parseInt(r[5]) || 0,
      level:      r[6] || 'Aspirant',
      image:      imageMap[r[0]] || '',
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((e, i) => ({ ...e, rank: i + 1 }))
    .slice(0, 50);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check in-memory cache first (avoids even the LeaderboardCache tab read)
  const scope = req.query.scope === 'all' ? 'all' : 'weekly';
  const preview = req.query.preview === 'true';
  const nowMs = Date.now();

  if (memCache.data && (nowMs - memCache.ts) < MEM_CACHE_TTL) {
    const fullList = scope === 'all' ? memCache.data.allTimeLeaders : memCache.data.weeklyLeaders;
    const leaders = preview ? fullList.slice(0, 3) : fullList;
    const session = await getServerSession(req, res, authOptions);
    const currentUser = session ? fullList.find(u => u.email === session.user.email) || null : null;
    return res.status(200).json({ scope, leaders, currentUser });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    // Check cache — treat any read failure as stale (e.g. tab not yet created)
    let cacheRow = { cachedAt: '', weeklyJSON: '', allTimeJSON: '' };
    try { cacheRow = await getLeaderboardCacheRow(); } catch (_) {}
    const now = Date.now();
    let weeklyLeaders, allTimeLeaders;

    const cacheStale = !cacheRow.cachedAt ||
      (now - new Date(cacheRow.cachedAt).getTime()) > CACHE_TTL;

    if (cacheStale) {
      // Recompute both scopes
      const allScoreRows = await getLeaderboardData();
      const allUserRows = await getUserRows();

      const publicEmails = new Set(
        allUserRows
          .filter(r => r[9] !== 'FALSE')
          .map(r => r[0])
      );

      // Build image map: email → profile photo URL (col L = index 11)
      const imageMap = {};
      allUserRows.forEach(r => { if (r[0]) imageMap[r[0]] = r[11] || ''; });

      // Build level map: email → level (col G = index 6)
      const levelMap = {};
      allUserRows.forEach(r => { if (r[0]) levelMap[r[0]] = r[6] || 'Aspirant'; });

      // Weekly: last 7 days — ranked by coins earned this week
      const weekStart = getISTDateString(new Date(now - 6 * 24 * 60 * 60 * 1000));
      const weeklyRows = allScoreRows.filter(row => {
        if (!row[0]) return false;
        try {
          return getISTDateString(new Date(row[0])) >= weekStart;
        } catch { return false; }
      });

      weeklyLeaders  = computeWeeklyLeaderboard(weeklyRows, publicEmails, imageMap, levelMap);
      allTimeLeaders = computeAllTimeLeaderboard(allUserRows, publicEmails, imageMap);

      try {
        await updateLeaderboardCacheRow(
          new Date().toISOString(),
          JSON.stringify(weeklyLeaders),
          JSON.stringify(allTimeLeaders)
        );
      } catch (_) { /* cache tab missing — skip, still return results */ }
    } else {
      try {
        weeklyLeaders = JSON.parse(cacheRow.weeklyJSON || '[]');
        allTimeLeaders = JSON.parse(cacheRow.allTimeJSON || '[]');
      } catch {
        weeklyLeaders = [];
        allTimeLeaders = [];
      }
    }

    // Populate in-memory cache for next 30 seconds
    memCache = { data: { weeklyLeaders, allTimeLeaders }, ts: Date.now() };

    const fullList = scope === 'all' ? allTimeLeaders : weeklyLeaders;
    const leaders = preview ? fullList.slice(0, 3) : fullList;

    let currentUser = null;
    if (session) {
      currentUser = fullList.find(u => u.email === session.user.email) || null;
    }

    return res.status(200).json({ scope, leaders, currentUser });
  } catch (err) {
    console.error('[leaderboard] Error:', err.message);
    if (err.code === 429 || (err.response && err.response.status === 429)) {
      console.error('[Sheets] Rate limit hit');
    }
    try {
      const session = await getServerSession(req, res, authOptions);
      const fallbackRow = await getLeaderboardCacheRow();
      const weeklyLeaders = JSON.parse(fallbackRow.weeklyJSON || '[]');
      const allTimeLeaders = JSON.parse(fallbackRow.allTimeJSON || '[]');
      const fullList = scope === 'all' ? allTimeLeaders : weeklyLeaders;
      if (fullList.length) {
        const leaders = preview ? fullList.slice(0, 3) : fullList;
        const currentUser = session ? fullList.find(u => u.email === session.user.email) || null : null;
        return res.status(200).json({ scope, leaders, currentUser, stale: true });
      }
    } catch (_) {}
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
}
