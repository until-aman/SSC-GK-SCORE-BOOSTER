/**
 * lib/server/scorePersistence.js
 *
 * Server-side score persistence extracted VERBATIM from pages/api/score.js so
 * the canonical completion route (/api/quiz-session/complete) and the
 * compatibility route (/api/score) share one implementation.
 *
 * Preserves exactly: Scores column order (via appendScoreV2), Users updates,
 * the `calculateCoins` formula, level thresholds (computeLevel), streak logic,
 * duplicate detection (hasDuplicateScore + duplicateCheckKey), the leaderboard
 * cache invalidation, and the response fields consumed by pages/result.js.
 *
 * NOTHING here changes formulas, columns, tabs, or thresholds.
 *
 * Returns a discriminated result so callers map HTTP status codes identically:
 *   { kind: 'validation', status: 400, error }
 *   { kind: 'duplicate',  status: 200, data: { ok, success, alreadySaved, message } }
 *   { kind: 'success',    status: 200, data: { ok, coins, totalCoins, level,
 *                                              streakCount, lastAttemptDate,
 *                                              isFirstQuizOfDay, streakMilestone,
 *                                              profileSnapshot } }
 * Throws on unexpected error → caller returns 500 (matching current behaviour).
 */

import { createHash } from 'crypto';
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

// EXACT current formula from pages/api/score.js — do not change.
function calculateCoins({ correct, accuracy, completionStatus }) {
  const baseCoins = correct * 2;
  const accuracyBonus = accuracy >= 80 ? 10 : accuracy >= 60 ? 5 : 0;
  const completionBonus = completionStatus === 'completed' ? 5 : 0;
  return baseCoins + accuracyBonus + completionBonus;
}

/**
 * @param {object} args
 * @param {string} args.email   authenticated user email (caller resolves session)
 * @param {string} args.name    user display name
 * @param {object} args.input   the score body fields (same shape /api/score received)
 */
export async function persistScore({ email, name, input }) {
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
  } = input || {};

  // ── Validation (identical to /api/score) ──────────────────────────────
  const nonNegNums = [correctAnswers, incorrectAnswers, skipped, totalQuestions];
  if (nonNegNums.some(v => typeof v !== 'number' || v < 0)) {
    return { kind: 'validation', status: 400, error: 'Invalid score fields: must be non-negative numbers' };
  }
  if (typeof rawScore !== 'number') {
    return { kind: 'validation', status: 400, error: 'Invalid score fields: rawScore must be a number' };
  }
  const sumCheck = correctAnswers + incorrectAnswers + skipped;
  if (Math.abs(sumCheck - totalQuestions) > 0.001) {
    return { kind: 'validation', status: 400, error: 'correctAnswers + incorrectAnswers + skipped must equal totalQuestions' };
  }
  if (!subject || typeof subject !== 'string') {
    return { kind: 'validation', status: 400, error: 'subject is required' };
  }
  if (!topic || typeof topic !== 'string') {
    return { kind: 'validation', status: 400, error: 'topic is required' };
  }

  const resolvedSessionId =
    (typeof sessionId === 'string' && sessionId) ||
    (typeof clientSessionId === 'string' && clientSessionId) ||
    generateSessionId();

  const now = new Date();
  const completedAt = now.toISOString();
  const serverSavedAt = completedAt;
  const duplicateCheckKey = generateDuplicateKey(
    email,
    subject,
    topic,
    startedAt || clientSessionId || resolvedSessionId || completedAt
  );

  // ── Independent Scores duplicate protection ───────────────────────────
  const alreadySaved = await hasDuplicateScore(duplicateCheckKey);
  if (alreadySaved) {
    return { kind: 'duplicate', status: 200, data: { ok: true, success: true, alreadySaved: true, message: 'Already saved' } };
  }

  const today = getISTDateString(now);
  const yesterday = getISTYesterday(now);

  const userRows = await getUserRows();
  let userRow = findUserRow(userRows, email);
  let rowIndex;
  if (!userRow) {
    const newRow = createDefaultUserRow(email, name);
    await appendUserRow(newRow);
    userRow = newRow;
    rowIndex = userRows.length + 2;
  } else {
    rowIndex = userRows.findIndex(r => r[0] === email) + 2;
  }

  const user = parseUserRow(userRow);
  const isFirstQuizOfDay = !user.lastAttemptDate || user.lastAttemptDate !== today;

  const streakResult = computeStreak({
    streakCount:     user.streakCount,
    lastAttemptDate: user.lastAttemptDate,
    today,
    yesterday,
  });

  const accuracy = totalQuestions ? (correctAnswers / totalQuestions) * 100 : 0;
  const coins = calculateCoins({ correct: correctAnswers, accuracy, completionStatus: 'completed' });

  const milestoneCrossed = STREAK_MILESTONES[streakResult.streakCount]
    && user.streakCount < streakResult.streakCount
    ? STREAK_MILESTONES[streakResult.streakCount]
    : null;
  const milestoneBonus = milestoneCrossed ? milestoneCrossed.bonus : 0;

  const newTotalCoins = user.totalCoins + coins;
  const newLevel = computeLevel(newTotalCoins);

  await appendScoreV2({
    timestamp: now.toISOString(),
    email,
    name,
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
      name:            user.name || name || '',
      email,
      totalCoins:      newTotalCoins,
      level:           newLevel,
      streakCount:     streakResult.streakCount,
      lastAttemptDate: today,
      playedToday:     true,
    };
  } catch (snapshotErr) {
    console.warn('[scorePersistence] Could not build profile snapshot:', snapshotErr.message);
  }

  return {
    kind: 'success',
    status: 200,
    data: {
      ok: true,
      coins,
      totalCoins: newTotalCoins,
      level: newLevel,
      streakCount: streakResult.streakCount,
      lastAttemptDate: today,
      isFirstQuizOfDay,
      streakMilestone: milestoneCrossed,
      profileSnapshot,
      sessionId: resolvedSessionId,
    },
  };
}
