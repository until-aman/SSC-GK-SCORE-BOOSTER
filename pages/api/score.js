import { getServerSession } from 'next-auth/next';
import { createHash } from 'crypto';
import { authOptions } from './auth/[...nextauth]';
import {
  appendScoreV2,
  hasDuplicateScore,
  getUserRows,
  findUserRow,
  createDefaultUserRow,
  parseUserRow,
  appendUserRow,
  updateUserCells,
  updateUserAggregateStats,
  updateLeaderboardCacheRow,
} from '@/lib/sheets';
import { getISTDateString, getISTYesterday, computeStreak } from '@/lib/streak';
import { computeLevel, STREAK_MILESTONES } from '@/lib/coins';

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

function generateSessionId() {
  return `SESSION_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDuplicateTimeBucket(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Date(Math.round(date.getTime() / 60000) * 60000).toISOString();
}

function generateDuplicateKey(email, subject, topic, timestamp) {
  const bucket = getDuplicateTimeBucket(timestamp);
  return createHash('md5')
    .update(`${email || ''}|${subject || ''}|${topic || ''}|${bucket}`)
    .digest('hex')
    .slice(0, 16);
}

function calculateCoins({ correct, accuracy, completionStatus }) {
  const baseCoins = correct * 2;
  const accuracyBonus = accuracy >= 80 ? 10 : accuracy >= 60 ? 5 : 0;
  const completionBonus = completionStatus === 'completed' ? 5 : 0;
  return baseCoins + accuracyBonus + completionBonus;
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
    clientSessionId,
    quizMode = 'normal',
    sourceCollection = '',
    startedAt = '',
    timeSpentSeconds = 0,
  } = req.body;

  // Validate
  const nonNegNums = [correctAnswers, incorrectAnswers, skipped, totalQuestions];
  if (nonNegNums.some(v => typeof v !== 'number' || v < 0)) {
    return res.status(400).json({ error: 'Invalid score fields: must be non-negative numbers' });
  }
  if (typeof rawScore !== 'number') {
    return res.status(400).json({ error: 'Invalid score fields: rawScore must be a number' });
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
  const resolvedSessionId =
    (typeof sessionId === 'string' && sessionId) ||
    (typeof clientSessionId === 'string' && clientSessionId) ||
    generateSessionId();

  try {
    const now = new Date();
    const completedAt = now.toISOString();
    const serverSavedAt = completedAt;
    const duplicateCheckKey = generateDuplicateKey(
      email,
      subject,
      topic,
      startedAt || clientSessionId || resolvedSessionId || completedAt
    );

    const alreadySaved = await hasDuplicateScore(duplicateCheckKey);
    if (alreadySaved) {
      return res.status(200).json({
        ok: true,
        success: true,
        alreadySaved: true,
        message: 'Already saved',
      });
    }

    const today = getISTDateString(now);
    const yesterday = getISTYesterday(now);

    // Read Users tab and find/create user row
    // NOTE: getUserRows() is now cached (2-min TTL) in sheets.js
    const userRows = await getUserRows();
    let userRow = findUserRow(userRows, email);
    let rowIndex;

    if (!userRow) {
      const newRow = createDefaultUserRow(email, session.user.name);
      await appendUserRow(newRow);
      userRow = newRow;
      rowIndex = userRows.length + 2;
    } else {
      rowIndex = userRows.findIndex(r => r[0] === email) + 2;
    }

    const user = parseUserRow(userRow);

    // isFirstQuizOfDay: compare Users tab lastAttemptDate with today.
    // No extra API call needed — data is already in the user row.
    const isFirstQuizOfDay = !user.lastAttemptDate || user.lastAttemptDate !== today;

    // Compute streak first so milestone celebrations still know whether a threshold was crossed.
    const streakResult = computeStreak({
      streakCount:     user.streakCount,
      lastAttemptDate: user.lastAttemptDate,
      today,
      yesterday,
    });

    // Coins use the single server-side formula.
    const accuracy = totalQuestions ? (correctAnswers / totalQuestions) * 100 : 0;
    const coins = calculateCoins({
      correct: correctAnswers,
      accuracy,
      completionStatus: 'completed',
    });

    // Check if a streak milestone was just crossed (for UI celebration)
    const milestoneCrossed = STREAK_MILESTONES[streakResult.streakCount]
      && user.streakCount < streakResult.streakCount
      ? STREAK_MILESTONES[streakResult.streakCount]
      : null;

    // Milestone bonus amount (for separate column tracking)
    const milestoneBonus = milestoneCrossed ? milestoneCrossed.bonus : 0;

    // Compute totals BEFORE writing to sheet
    const newTotalCoins = user.totalCoins + coins;
    const newLevel = computeLevel(newTotalCoins);

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
      sessionId: resolvedSessionId,
      coins,
      isDailyChallenge: subject === 'Daily Challenge' ? 'TRUE' : 'FALSE',
      streakMilestoneBonus: milestoneBonus,
      totalCoins: newTotalCoins,
      clientSessionId: clientSessionId || '',
      duplicateCheckKey,
      quizMode,
      sourceCollection,
      startedAt,
      completedAt,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      serverSavedAt,
      scoreVersion: 'v1',
    });

    // Batch update Users row (cols C-G)
    await updateUserCells(rowIndex, {
      streakCount: streakResult.streakCount,
      lastAttemptDate: today,
      streakShieldUsed: false,
      totalCoins: newTotalCoins,
      level: newLevel,
    });

    await updateUserAggregateStats(rowIndex, {
      completedAt,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      skipped,
      rawScore,
    });

    // Invalidate leaderboard cache so rankings reflect new coins immediately.
    updateLeaderboardCacheRow('', '', '').catch(() => {});

    let profileSnapshot = null;
    try {
      profileSnapshot = {
        name:            user.name || session.user.name || '',
        email,
        totalCoins:      newTotalCoins,
        level:           newLevel,
        streakCount:     streakResult.streakCount,
        lastAttemptDate: today,
        playedToday:     true,
      };
    } catch (snapshotErr) {
      console.warn('[score] Could not build profile snapshot:', snapshotErr.message);
    }

    return res.status(200).json({
      ok: true,
      coins,
      totalCoins: newTotalCoins,
      level: newLevel,
      streakCount: streakResult.streakCount,
      lastAttemptDate: today,
      isFirstQuizOfDay,
      streakMilestone: milestoneCrossed,  // { bonus, label } or null
      profileSnapshot,
    });
  } catch (err) {
    console.error('[score] Error:', err.message);
    if (err.code === 429 || (err.response && err.response.status === 429)) {
      console.error('[Sheets] Rate limit hit');
    }
    return res.status(500).json({ error: 'Failed to save score' });
  }
}
