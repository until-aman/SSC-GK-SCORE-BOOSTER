import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getLeaderboardData,
  getUserRows,
  getLeaderboardCacheRow,
  updateLeaderboardCacheRow,
} from '@/lib/sheets';
import { getISTDateString } from '@/lib/streak';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function computeLeaderboardFromRows(scoreRows, publicEmails, imageMap = {}) {
  const groupByEmail = {};

  scoreRows.forEach(row => {
    const email = row[1];
    if (!email) return;
    if (!publicEmails.has(email)) return;

    const name = row[2] || email;
    const rawScore = parseFloat(row[7]) || 0;
    const totalQuestions = parseInt(row[6]) || 0;
    const correctAnswers = parseInt(row[3]) || 0;

    if (!groupByEmail[email]) {
      groupByEmail[email] = { email, name, totalScore: 0, totalQuestionsAttempted: 0, totalCorrect: 0 };
    }
    if (row[2]) groupByEmail[email].name = row[2];
    groupByEmail[email].totalScore += rawScore;
    groupByEmail[email].totalQuestionsAttempted += totalQuestions;
    groupByEmail[email].totalCorrect += correctAnswers;
  });

  const entries = Object.values(groupByEmail).map(u => ({
    ...u,
    totalScore: Math.round(u.totalScore * 100) / 100,
    overallAccuracy: u.totalQuestionsAttempted > 0
      ? Math.round((u.totalCorrect / u.totalQuestionsAttempted) * 10000) / 100
      : 0,
  }));

  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.overallAccuracy !== a.overallAccuracy) return b.overallAccuracy - a.overallAccuracy;
    return b.totalQuestionsAttempted - a.totalQuestionsAttempted;
  });

  return entries.map((e, i) => ({ ...e, rank: i + 1, image: imageMap[e.email] || '' })).slice(0, 50);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const scope = req.query.scope === 'all' ? 'all' : 'weekly';
  const preview = req.query.preview === 'true';

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

      // Weekly: last 7 days inclusive
      const weekStart = getISTDateString(new Date(now - 6 * 24 * 60 * 60 * 1000));
      const weeklyRows = allScoreRows.filter(row => {
        if (!row[0]) return false;
        try {
          return getISTDateString(new Date(row[0])) >= weekStart;
        } catch { return false; }
      });

      weeklyLeaders = computeLeaderboardFromRows(weeklyRows, publicEmails, imageMap);
      allTimeLeaders = computeLeaderboardFromRows(allScoreRows, publicEmails, imageMap);

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
    return res.status(500).json({ error: 'Failed to load leaderboard' });
  }
}
