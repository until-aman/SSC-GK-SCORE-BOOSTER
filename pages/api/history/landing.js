import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getQuestionMapByIds,
  getStatsByQuestion,
  getUserAttemptAnswers,
  getUserSavedQuestions,
  getUserSessions,
  truncateText,
} from '@/lib/historyData';

function isWithinLast7Days(dateValue) {
  const time = new Date(dateValue || 0).getTime();
  return Number.isFinite(time) && Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const email = session.user.email;
    const [sessions, savedQuestions, attempts] = await Promise.all([
      getUserSessions(email),
      getUserSavedQuestions(email),
      getUserAttemptAnswers(email),
    ]);

    const totalQuestions = sessions.reduce((sum, item) => sum + item.questionCount, 0);
    const totalCorrect = sessions.reduce((sum, item) => sum + item.correct, 0);
    const totalCoins = sessions.reduce((sum, item) => sum + item.coinsEarned, 0);
    const weeklyCoins = sessions
      .filter(item => isWithinLast7Days(item.completedAt))
      .reduce((sum, item) => sum + item.coinsEarned, 0);

    const statsByQuestion = getStatsByQuestion(attempts);
    const repeatedStats = Object.values(statsByQuestion)
      .filter(item => item.wrongCount >= 2)
      .sort((a, b) => b.wrongCount - a.wrongCount || b.skippedCount - a.skippedCount)
      .slice(0, 2);

    const previewIds = [
      ...repeatedStats.map(item => item.questionId),
      ...savedQuestions.slice(0, 3).map(item => item.questionId),
    ];
    const hints = [
      ...repeatedStats,
      ...savedQuestions.slice(0, 3).map(item => ({ subject: item.subject, topic: item.topic })),
    ];
    const questionMap = await getQuestionMapByIds(previewIds, hints);

    const repeatedMistakesPreview = repeatedStats.map(item => {
      const question = questionMap[item.questionId] || {};
      return {
        questionId: item.questionId,
        subject: question.subject || item.subject,
        topic: question.topic || item.topic,
        questionPreview: truncateText(question.question, 80),
        wrongCount: item.wrongCount,
        skippedCount: item.skippedCount,
      };
    });

    const savedPreview = savedQuestions.slice(0, 3).map(item => {
      const question = questionMap[item.questionId] || {};
      return {
        savedQuestionId: item.savedQuestionId,
        questionId: item.questionId,
        subject: question.subject || item.subject,
        topic: question.topic || item.topic,
        questionPreview: truncateText(question.question || item.question, 80),
        savedAt: item.savedAt,
        wrongCount: statsByQuestion[item.questionId]?.wrongCount || 0,
        skippedCount: statsByQuestion[item.questionId]?.skippedCount || 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalQuizzes: sessions.length,
          totalQuestions,
          overallAccuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
          savedCount: savedQuestions.length,
          totalCoins,
          weeklyCoins,
        },
        latestQuizzes: sessions.slice(0, 3),
        repeatedMistakesPreview,
        savedPreview,
      },
    });
  } catch (err) {
    console.error('[history/landing]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load history' });
  }
}
