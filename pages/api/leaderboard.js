import { getLeaderboardData } from '@/lib/sheets';

function computeLeaderboard(rows) {
  const userMap = {};

  rows.forEach(row => {
    const [timestamp, email, name, correctStr, incorrectStr, skippedStr,
           totalStr, scoreStr] = row;
    if (!email || !scoreStr) return;

    if (!userMap[email]) {
      userMap[email] = { email, name: name || email,
                         totalScore: 0, totalQuestionsAttempted: 0, totalCorrect: 0 };
    }

    userMap[email].totalScore += parseFloat(scoreStr) || 0;
    userMap[email].totalQuestionsAttempted += parseInt(totalStr) || 0;
    userMap[email].totalCorrect += parseInt(correctStr) || 0;
  });

  const entries = Object.values(userMap).map(u => ({
    ...u,
    score: Math.round(u.totalScore * 100) / 100, // Alias for UI
    totalScore: Math.round(u.totalScore * 100) / 100,
    overallAccuracy: u.totalQuestionsAttempted > 0
      ? Math.round((u.totalCorrect / u.totalQuestionsAttempted) * 10000) / 100
      : 0,
  }));

  // Tie-break rules:
  // 1. Higher totalScore first
  // 2. If equal: higher overallAccuracy
  // 3. If still equal: higher totalQuestionsAttempted
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.overallAccuracy !== a.overallAccuracy) return b.overallAccuracy - a.overallAccuracy;
    return b.totalQuestionsAttempted - a.totalQuestionsAttempted;
  });

  return entries.map((e, i) => ({ ...e, rank: i + 1 })).slice(0, 100);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await getLeaderboardData();
    const leaderboard = computeLeaderboard(rows);
    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard API error:', err);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}
