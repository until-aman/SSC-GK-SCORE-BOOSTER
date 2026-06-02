import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getQuestionMapByIds,
  getUserSavedQuestions,
  getUserSessions,
  parseAnswersSummary,
  shuffle,
  splitQuestionIds,
} from '@/lib/historyData';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const { sourceType, sessionId } = req.body || {};
    let questionIds = [];
    let quizMode = 'reattempt_mistakes';
    let parentSessionId = sessionId || '';
    let sourceSession = null;

    if (sourceType === 'session_full' || sourceType === 'session_mistakes') {
      const sessions = await getUserSessions(session.user.email);
      sourceSession = sessions.find(item => item.sessionId === sessionId);
      if (!sourceSession) return res.status(404).json({ success: false, error: 'Session not found' });

      if (sourceType === 'session_full') {
        questionIds = splitQuestionIds(sourceSession.questionIdsList);
        quizMode = 'reattempt_full';
      } else {
        questionIds = parseAnswersSummary(sourceSession.answersSummaryJSON)
          .filter(item => item && item.ok === false)
          .map(item => item.q)
          .filter(Boolean);
        quizMode = 'reattempt_mistakes';
      }
    } else if (sourceType === 'saved_questions') {
      const saved = await getUserSavedQuestions(session.user.email);
      questionIds = saved.map(item => item.questionId).filter(Boolean);
      quizMode = 'reattempt_saved';
      parentSessionId = '';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid sourceType' });
    }

    const uniqueIds = [...new Set(questionIds)];
    if (!uniqueIds.length) return res.status(400).json({ success: false, error: 'No questions to re-attempt' });

    const questionMap = await getQuestionMapByIds(uniqueIds, sourceSession ? [sourceSession] : []);
    const questions = shuffle(uniqueIds.map(id => questionMap[id]).filter(Boolean));
    if (!questions.length) return res.status(404).json({ success: false, error: 'Questions not found' });

    return res.status(200).json({
      success: true,
      data: {
        questions,
        quizMode,
        parentSessionId,
        questionCount: questions.length,
        subject: sourceSession?.subject || 'Saved',
        topic: sourceSession?.topic || 'Revision',
        sourceCollection: sourceSession?.sourceCollection || 'general',
      },
    });
  } catch (err) {
    console.error('[history/reattempt]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to start re-attempt' });
  }
}
