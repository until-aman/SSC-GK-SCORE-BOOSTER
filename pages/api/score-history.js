import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getLeaderboardData, getUserRows, findUserRow, parseUserRow, CACHE_TTL } from '@/lib/sheets';

// Per-user history cache
const historyCache = new Map();

const MILESTONE_LABEL_MAP = {
  15:  '3-Day Streak Bonus',
  30:  '1-Week Streak Bonus',
  50:  '2-Week Streak Bonus',
  100: '1-Month Streak Bonus',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;

  // Check cache (2-min TTL)
  const cached = historyCache.get(email);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL.SCORE_HISTORY) {
    return res.status(200).json(cached.data);
  }

  try {
    const allRows = await getLeaderboardData();
    const userScoreRows = allRows
      .filter(row => row[1] === email)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 20);

    const sessions = [];
    userScoreRows.forEach(row => {
      const milestoneBonus = Number(row[13]) || 0;
      const coins = Number(row[11]) || 0;
      sessions.push({
        type: 'quiz',
        timestamp: row[0] || '',
        subject: row[8] || '',
        topic: row[9] || '',
        correctAnswers: Number(row[3]) || 0,
        totalQuestions: Number(row[6]) || 0,
        rawScore: parseFloat(row[7]) || 0,
        coins,
        accuracy: Number(row[6]) > 0
          ? Math.round((Number(row[3]) / Number(row[6])) * 1000) / 10
          : 0,
      });
      if (milestoneBonus > 0) {
        sessions.push({
          type: 'milestone',
          timestamp: row[0] || '',
          coins: milestoneBonus,
          milestoneLabel: MILESTONE_LABEL_MAP[milestoneBonus] || `${milestoneBonus} coins streak bonus`,
        });
      }
    });

    const allUserRows = await getUserRows();
    const userRow = findUserRow(allUserRows, email);
    const user = userRow ? parseUserRow(userRow) : { totalCoins: 0, level: 'Aspirant' };

    const responseData = { sessions, totalCoins: user.totalCoins, level: user.level };

    // Cache the result
    historyCache.set(email, { data: responseData, ts: Date.now() });

    return res.status(200).json(responseData);
  } catch (err) {
    console.error('[score-history] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load score history' });
  }
}
