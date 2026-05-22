import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getLeaderboardData, getUserRows, findUserRow, parseUserRow } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const email = session.user.email;

    // Get all score rows
    const allRows = await getLeaderboardData();

    // Filter to this user, sort newest first, take 20
    const userRows = allRows
      .filter(row => row[1] === email)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 20);

    const sessions = userRows.map(row => ({
      timestamp: row[0] || '',
      subject: row[8] || '',
      topic: row[9] || '',
      correctAnswers: Number(row[3]) || 0,
      totalQuestions: Number(row[6]) || 0,
      rawScore: parseFloat(row[7]) || 0,
      xpEarned: Number(row[11]) || 0,
      streakMilestoneBonus: Number(row[13]) || 0,
      accuracy: Number(row[6]) > 0
        ? Math.round((Number(row[3]) / Number(row[6])) * 1000) / 10
        : 0,
    }));

    // Get XP + level from Users tab
    const userRows2 = await getUserRows();
    const userRow = findUserRow(userRows2, email);
    const user = userRow ? parseUserRow(userRow) : { totalXP: 0, level: 'Aspirant' };

    return res.status(200).json({
      sessions,
      totalXP: user.totalXP,
      level: user.level,
    });
  } catch (err) {
    console.error('[score-history] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load score history' });
  }
}
