// lib/server/historyService.js — shared server-side History computations (Step 9).
//
// Centralizes the pieces the landing / quizzes / subjects routes duplicate so
// the combined GET /api/history/landing reuses the EXACT logic (no behavior
// change, no new Sheet schema). Physical Sheet reads collapse via Step 6
// in-flight dedup when these run concurrently. ESM (matches lib/historyRevamp).

import { getUserSessions, getUserAttemptAnswers } from '@/lib/historyData';
import { getHistorySummary, aggregateAttempts } from '@/lib/historyRevamp';

// Default landing quiz list (page 1, limit 3, no filters) — matches the
// frontend's initial loadQuizzes(3, 'all') call exactly.
export const HISTORY_LANDING_QUIZ_LIMIT = 3;

// Paged quiz-session mapping shared with /api/history/quizzes (the exact
// per-item fields the route adds). Filters stay in the route's applyFilters.
export function paginateQuizSessions(sessions, { page = 1, limit = 10 } = {}) {
  const start = (page - 1) * limit;
  const paged = sessions.slice(start, start + limit).map(item => ({
    ...item,
    maxScore: item.questionCount * 2,
    hasMistakes: item.incorrect + item.skipped > 0,
  }));
  return {
    sessions: paged,
    total: sessions.length,
    page,
    hasMore: start + limit < sessions.length,
    filterSummary: {
      quizCount: sessions.length,
      totalWrongSkipped: sessions.reduce((sum, item) => sum + item.incorrect + item.skipped, 0),
    },
  };
}

// Subject rows shared with /api/history/subjects (exact field selection).
export function buildSubjectRows(attempts) {
  return aggregateAttempts(attempts, 'subject').map(item => ({
    subject: item.subject,
    questionCount: item.questionCount,
    correctCount: item.correctCount,
    wrongCount: item.wrongCount,
    skippedCount: item.skippedCount,
    accuracy: item.accuracy,
    lastPracticedAt: item.lastPracticedAt,
    statusLabel: item.statusLabel,
    statusTone: item.statusTone,
    hasMistakes: item.hasMistakes,
  }));
}

// One landing payload combining summary + default quiz page + subjects.
// Reads QuizSessions/AttemptAnswers/SavedQuestions once per logical need;
// concurrent identical physical reads collapse via Step 6 dedup.
export async function buildHistoryLanding(email) {
  const [summary, sessions, attempts] = await Promise.all([
    getHistorySummary(email),
    getUserSessions(email),
    getUserAttemptAnswers(email),
  ]);
  return {
    summary,
    quizzes: paginateQuizSessions(sessions, { page: 1, limit: HISTORY_LANDING_QUIZ_LIMIT }),
    subjects: buildSubjectRows(attempts),
    generatedAt: new Date().toISOString(),
  };
}
