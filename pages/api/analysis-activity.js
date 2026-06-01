import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getLeaderboardData, getUserRows, findUserRow, parseUserRow, CACHE_TTL } from '@/lib/sheets';

// Per-user activity cache (reuse the score-history TTL — same underlying data)
const activityCache = new Map();

/**
 * Returns aggregated real activity for the logged-in user, computed from the
 * existing Scores sheet (read-only). This is the ONLY section of the Analysis
 * tab backed by real data — everything else on the page is static sample.
 *
 * Scores columns: A timestamp | B email | C name | D correct | E incorrect |
 * F skipped | G totalQuestions | H rawScore | I subject | J topic | K sessionId |
 * L coins | M isDailyChallenge | N streakBonus | O total coins
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  // Guests have no retrievable history → treat as zero-history.
  if (!session?.user?.email) {
    return res.status(200).json({ hasHistory: false, isGuest: true });
  }

  const email = session.user.email;

  const cached = activityCache.get(email);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL.SCORE_HISTORY) {
    return res.status(200).json(cached.data);
  }

  try {
    const allRows = await getLeaderboardData();
    const userRows = allRows.filter(row => row[1] === email);

    if (userRows.length === 0) {
      const data = { hasHistory: false, isGuest: false };
      activityCache.set(email, { data, ts: Date.now() });
      return res.status(200).json(data);
    }

    // Total quizzes = number of score rows
    const totalQuizzes = userRows.length;

    // Total questions = sum of column G (totalQuestions)
    const totalQuestions = userRows.reduce((sum, r) => sum + (Number(r[6]) || 0), 0);

    // Most practiced subject = most frequent column I (subject)
    const subjectCounts = {};
    userRows.forEach(r => {
      const subj = (r[8] || '').trim();
      if (subj) subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
    });
    let mostPracticed = '';
    let topCount = 0;
    for (const [subj, count] of Object.entries(subjectCounts)) {
      if (count > topCount) { topCount = count; mostPracticed = subj; }
    }

    // Last quiz = most recent column A (timestamp)
    let lastQuizAt = '';
    userRows.forEach(r => {
      if (r[0] && (!lastQuizAt || new Date(r[0]) > new Date(lastQuizAt))) lastQuizAt = r[0];
    });

    // Coins are read from the Users sheet aggregate column.
    let coins = 0;
    try {
      const usersRows = await getUserRows();
      const userRow = findUserRow(usersRows, email);
      if (userRow) coins = parseUserRow(userRow).totalCoins || 0;
    } catch { /* coins fall back to 0 */ }

    const data = {
      hasHistory: true,
      isGuest: false,
      totalQuizzes,
      totalQuestions,
      coins,
      mostPracticed,
      lastQuizAt,
    };

    activityCache.set(email, { data, ts: Date.now() });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[analysis-activity] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load activity' });
  }
}
