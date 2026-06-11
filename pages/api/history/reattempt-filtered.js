import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuestionMapByIds, getUserAttemptAnswers, shuffle } from '@/lib/historyData';
import { applyQuestionFilters, groupQuestionAttempts } from '@/lib/historyRevamp';

function sortScore(item) {
  if (item.correctCount === 0 && item.totalAttempts > 0) return 4;
  if (item.wrongCount >= 2) return 3;
  if (item.wrongCount >= 1) return 2;
  if (item.skippedCount >= 1) return 1;
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const {
      subject = '',
      topic = '',
      answerStatus = 'wrong_skipped',
      questionHistory = 'all',
      limit = 25,
    } = req.body || {};

    const attempts = await getUserAttemptAnswers(session.user.email);
    const groups = applyQuestionFilters(groupQuestionAttempts(attempts), {
      subject,
      topic,
      status: answerStatus,
      questionHistory,
    })
      .sort((a, b) => sortScore(b) - sortScore(a) || new Date(b.lastAttemptedAt || 0) - new Date(a.lastAttemptedAt || 0))
      .slice(0, Math.min(50, Math.max(1, Number(limit) || 25)));

    const questionIds = groups.map(item => item.questionId);
    if (!questionIds.length) return res.status(400).json({ success: false, error: 'No questions to practice' });

    const questionMap = await getQuestionMapByIds(questionIds, groups);
    const questions = shuffle(questionIds.map(id => questionMap[id]).filter(Boolean));
    if (!questions.length) return res.status(404).json({ success: false, error: 'Questions not found' });

    return res.status(200).json({
      success: true,
      data: {
        questions,
        questionCount: questions.length,
        quizMode: 'filtered_mistakes',
        sourceInfo: {
          subject,
          topic,
          answerStatus,
          questionHistory,
        },
      },
    });
  } catch (err) {
    console.error('[history/reattempt-filtered]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to start filtered practice' });
  }
}
