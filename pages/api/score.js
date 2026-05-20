import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  appendScoreV2,
  getLeaderboardData,
  getUserRows,
  findUserRow,
  createDefaultUserRow,
  parseUserRow,
  appendUserRow,
  updateUserCells,
} from '@/lib/sheets';
import { getISTDateString, getISTYesterday, computeStreak } from '@/lib/streak';
import { computeXPEarned, computeLevel } from '@/lib/xp';

// In-memory rate limit map — resets on cold start
const rateLimitMap = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const window = 60 * 1000;
  const entry = rateLimitMap.get(email);
  if (!entry || now - entry.windowStart > window) {
    rateLimitMap.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = session.user.email;

  if (!checkRateLimit(email)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const {
    correctAnswers,
    incorrectAnswers,
    skipped,
    totalQuestions,
    rawScore,
    subject,
    topic,
    sessionId,
  } = req.body;

  // Validate
  const nums = [correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore];
  if (nums.some(v => typeof v !== 'number' || v < 0)) {
    return res.status(400).json({ error: 'Invalid score fields: must be non-negative numbers' });
  }
  const sumCheck = correctAnswers + incorrectAnswers + skipped;
  if (Math.abs(sumCheck - totalQuestions) > 0.001) {
    return res.status(400).json({ error: 'correctAnswers + incorrectAnswers + skipped must equal totalQuestions' });
  }
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'subject is required' });
  }
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'topic is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const now = new Date();
    const today = getISTDateString(now);
    const yesterday = getISTYesterday(now);

    // Check if first quiz of day for this email
    const allScoreRows = await getLeaderboardData();
    const todayScoresForEmail = allScoreRows.filter(row => {
      if (!row[1] || row[1] !== email) return false;
      if (!row[0]) return false;
      try {
        return getISTDateString(new Date(row[0])) === today;
      } catch { return false; }
    });
    const isFirstQuizOfDay = todayScoresForEmail.length === 0;

    // Compute XP
    const xpEarned = computeXPEarned({ correctAnswers, totalQuestions, isFirstQuizOfDay });

    // Append score row
    await appendScoreV2({
      timestamp: now.toISOString(),
      email,
      name: session.user.name,
      correctAnswers,
      incorrectAnswers,
      skipped,
      totalQuestions,
      rawScore,
      subject,
      topic,
      sessionId,
      xpEarned,
      isDailyChallenge: 'FALSE',
    });

    // Read Users tab and find/create user row
    const userRows = await getUserRows();
    let userRow = findUserRow(userRows, email);
    let rowIndex;

    if (!userRow) {
      const newRow = createDefaultUserRow(email, session.user.name);
      await appendUserRow(newRow);
      userRow = newRow;
      rowIndex = userRows.length + 2; // header is row 1, new row appended at end
    } else {
      rowIndex = userRows.findIndex(r => r[0] === email) + 2; // +1 for header, +1 for 1-based
    }

    const user = parseUserRow(userRow);

    // Compute streak
    const streakResult = computeStreak({
      streakCount: user.streakCount,
      lastAttemptDate: user.lastAttemptDate,
      today,
      yesterday,
    });

    const newTotalXP = user.totalXP + xpEarned;
    const newLevel = computeLevel(newTotalXP);

    // Batch update Users row (cols C-G)
    await updateUserCells(rowIndex, {
      streakCount: streakResult.streakCount,
      lastAttemptDate: today,
      streakShieldUsed: false,
      totalXP: newTotalXP,
      level: newLevel,
    });

    return res.status(200).json({
      ok: true,
      xpEarned,
      totalXP: newTotalXP,
      level: newLevel,
      streakCount: streakResult.streakCount,
      isFirstQuizOfDay,
    });
  } catch (err) {
    console.error('[score] Error:', err.message);
    if (err.code === 429 || (err.response && err.response.status === 429)) {
      console.error('[Sheets] Rate limit hit');
    }
    return res.status(500).json({ error: 'Failed to save score' });
  }
}
