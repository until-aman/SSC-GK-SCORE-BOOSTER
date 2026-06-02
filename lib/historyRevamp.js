import {
  getMasteryLabel,
  getQuestionMapByIds,
  getUserAttemptAnswers,
  getUserSavedQuestions,
  getUserSessions,
  toNumber,
  truncateText,
} from '@/lib/historyData';

export function statusLabelForAccuracy(accuracy) {
  const value = Number(accuracy) || 0;
  if (value >= 75) return { label: 'Strong', tone: 'green' };
  if (value >= 50) return { label: 'Needs Revision', tone: 'amber' };
  return { label: 'Weak', tone: 'red' };
}

export function attemptStatus(attempt) {
  if (attempt.isSkipped) return 'skipped';
  if (attempt.isCorrect) return 'correct';
  return 'wrong';
}

export function isWithinDateRange(value, dateRange) {
  if (!dateRange || dateRange === 'all') return true;
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return false;
  if (dateRange === 'today') {
    const date = new Date(time);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }
  if (dateRange === '7d' || dateRange === '30d') {
    const days = dateRange === '7d' ? 7 : 30;
    return Date.now() - time <= days * 24 * 60 * 60 * 1000;
  }
  return true;
}

export function summarizeSessions(sessions = [], savedCount = 0) {
  const totalQuestions = sessions.reduce((sum, item) => sum + toNumber(item.questionCount), 0);
  const totalCorrect = sessions.reduce((sum, item) => sum + toNumber(item.correct), 0);
  return {
    totalQuizzes: sessions.length,
    totalQuestions,
    overallAccuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    savedCount,
  };
}

export async function getHistorySummary(email) {
  const [sessions, saved] = await Promise.all([
    getUserSessions(email),
    getUserSavedQuestions(email),
  ]);
  return summarizeSessions(sessions, saved.length);
}

export function aggregateAttempts(attempts = [], keyName) {
  const groups = new Map();
  attempts.forEach(attempt => {
    const key = String(attempt[keyName] || '').trim();
    if (!key) return;
    const current = groups.get(key) || {
      key,
      subject: keyName === 'subject' ? key : attempt.subject,
      topic: keyName === 'topic' ? key : attempt.topic,
      questionIds: new Set(),
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      lastPracticedAt: '',
    };
    current.questionIds.add(attempt.questionId);
    if (attempt.isSkipped) current.skippedCount += 1;
    else if (attempt.isCorrect) current.correctCount += 1;
    else current.wrongCount += 1;
    if (!current.lastPracticedAt || new Date(attempt.attemptedAt || 0) > new Date(current.lastPracticedAt || 0)) {
      current.lastPracticedAt = attempt.attemptedAt;
    }
    groups.set(key, current);
  });

  return Array.from(groups.values()).map(item => {
    const attemptsCount = item.correctCount + item.wrongCount + item.skippedCount;
    const accuracy = attemptsCount ? Math.round((item.correctCount / attemptsCount) * 100) : 0;
    const status = statusLabelForAccuracy(accuracy);
    return {
      ...item,
      questionCount: item.questionIds.size,
      attemptedCount: attemptsCount,
      accuracy,
      statusLabel: status.label,
      statusTone: status.tone,
      hasMistakes: item.wrongCount + item.skippedCount > 0,
      questionIds: undefined,
    };
  }).sort((a, b) => a.accuracy - b.accuracy || b.questionCount - a.questionCount);
}

function latestAttempt(attempts) {
  return [...attempts].sort((a, b) => new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0))[0] || null;
}

export function groupQuestionAttempts(attempts = []) {
  const map = new Map();
  attempts.forEach(attempt => {
    if (!attempt.questionId) return;
    const current = map.get(attempt.questionId) || {
      questionId: attempt.questionId,
      subject: attempt.subject,
      topic: attempt.topic,
      sourceCollection: attempt.sourceCollection || 'general',
      attempts: [],
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
    };
    current.attempts.push(attempt);
    if (attempt.isSkipped) current.skippedCount += 1;
    else if (attempt.isCorrect) current.correctCount += 1;
    else current.wrongCount += 1;
    map.set(attempt.questionId, current);
  });

  return Array.from(map.values()).map(item => {
    const last = latestAttempt(item.attempts);
    const totalAttempts = item.correctCount + item.wrongCount + item.skippedCount;
    const mastery = getMasteryLabel({ ...item, totalAttempts });
    return {
      ...item,
      totalAttempts,
      lastAttemptStatus: last ? attemptStatus(last) : 'unknown',
      lastUserAnswer: last?.userAnswer || '',
      lastAttemptedAt: last?.attemptedAt || '',
      masteryLabel: mastery.label,
      masteryTone: mastery.tone,
    };
  });
}

export function applyQuestionFilters(groups = [], query = {}) {
  const status = String(query.status || query.answerStatus || 'all').toLowerCase();
  const questionHistory = String(query.questionHistory || 'all').toLowerCase();
  return groups.filter(item => {
    if (query.subject && item.subject !== query.subject) return false;
    if (query.topic && item.topic !== query.topic) return false;
    if (status === 'wrong' && item.wrongCount < 1) return false;
    if (status === 'skipped' && item.skippedCount < 1) return false;
    if (status === 'correct' && item.correctCount < 1) return false;
    if ((status === 'wrong_skipped' || status === 'mistakes') && item.wrongCount + item.skippedCount < 1) return false;
    if (questionHistory === 'repeated' && item.wrongCount < 2) return false;
    if (questionHistory === 'never_correct' && !(item.correctCount === 0 && item.totalAttempts >= 1)) return false;
    if (questionHistory === 'mastered' && !(item.correctCount >= 2 && item.wrongCount === 0)) return false;
    return true;
  });
}

export async function getQuestionResults(email, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const [attemptsRaw, saved] = await Promise.all([
    getUserAttemptAnswers(email),
    getUserSavedQuestions(email),
  ]);
  const savedIds = new Set(saved.map(item => item.questionId));
  const quizType = String(query.quizType || 'all').toLowerCase();
  const attempts = attemptsRaw.filter(item => {
    if (!isWithinDateRange(item.attemptedAt, query.dateRange)) return false;
    if (quizType === 'all') return true;
    const mode = String(item.quizMode || '').toLowerCase();
    if (quizType === 'reattempt') return mode.includes('reattempt') || mode.includes('revision') || mode.includes('filtered');
    if (quizType === 'daily_challenge') return mode === 'daily_challenge' || mode === 'dailychallenge';
    if (quizType === 'normal') return !mode || mode === 'normal' || mode === 'standard';
    return true;
  });
  const status = String(query.status || query.answerStatus || 'all').toLowerCase();
  const filteredGroups = applyQuestionFilters(groupQuestionAttempts(attempts), query)
    .filter(item => status === 'saved' ? savedIds.has(item.questionId) : true)
    .sort((a, b) => {
      const priority = (item) => {
        if (item.correctCount === 0 && item.totalAttempts > 0) return 5;
        if (item.wrongCount >= 2) return 4;
        if (item.wrongCount >= 1) return 3;
        if (item.skippedCount >= 1) return 2;
        return 1;
      };
      return priority(b) - priority(a) || new Date(b.lastAttemptedAt || 0) - new Date(a.lastAttemptedAt || 0);
    });
  const start = (page - 1) * limit;
  const pagedGroups = filteredGroups.slice(start, start + limit);
  const questionMap = await getQuestionMapByIds(
    pagedGroups.map(item => item.questionId),
    pagedGroups
  );

  const questions = pagedGroups.map(item => {
    const question = questionMap[item.questionId] || {};
    return {
      questionId: item.questionId,
      subject: question.subject || item.subject,
      topic: question.topic || item.topic,
      question: question.question || '',
      questionPreview: truncateText(question.question || '', 90),
      options: [question.optionA, question.optionB, question.optionC, question.optionD].filter(value => value !== undefined),
      optionA: question.optionA || '',
      optionB: question.optionB || '',
      optionC: question.optionC || '',
      optionD: question.optionD || '',
      correctAnswer: question.correctOption || '',
      correctOption: question.correctOption || '',
      lastUserAnswer: item.lastUserAnswer,
      lastAttemptStatus: item.lastAttemptStatus,
      correctCount: item.correctCount,
      wrongCount: item.wrongCount,
      skippedCount: item.skippedCount,
      totalAttempts: item.totalAttempts,
      masteryLabel: item.masteryLabel,
      masteryTone: item.masteryTone,
      explanation: question.explanation || '',
      isSaved: savedIds.has(item.questionId),
      lastAttemptedAt: item.lastAttemptedAt,
      sourceCollection: item.sourceCollection || 'general',
    };
  });

  return {
    questions,
    total: filteredGroups.length,
    page,
    limit,
    hasMore: start + limit < filteredGroups.length,
    summary: {
      totalQuestions: filteredGroups.length,
      wrongCount: filteredGroups.filter(item => item.wrongCount > 0).length,
      skippedCount: filteredGroups.filter(item => item.skippedCount > 0).length,
      correctCount: filteredGroups.filter(item => item.correctCount > 0).length,
    },
  };
}
