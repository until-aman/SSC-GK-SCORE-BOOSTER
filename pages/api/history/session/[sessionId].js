import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import {
  getMasteryLabel,
  getQuestionMapByIds,
  getStatsByQuestion,
  getUserAttemptAnswers,
  getUserSavedQuestions,
  getUserSessions,
  parseAnswersSummary,
  splitQuestionIds,
} from '@/lib/historyData';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const authSession = await getServerSession(req, res, authOptions);
  if (!authSession?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const { sessionId } = req.query;
    const email = authSession.user.email;
    const sessions = await getUserSessions(email);
    const quizSession = sessions.find(item => item.sessionId === sessionId);
    if (!quizSession) return res.status(404).json({ success: false, error: 'Session not found' });

    const answerSummary = parseAnswersSummary(quizSession.answersSummaryJSON);
    const summaryIds = answerSummary.map(item => item.q).filter(Boolean);
    const questionIds = splitQuestionIds(quizSession.questionIdsList);
    const orderedIds = questionIds.length ? questionIds : summaryIds;
    const [attempts, savedQuestions] = await Promise.all([
      getUserAttemptAnswers(email),
      getUserSavedQuestions(email),
    ]);
    const relevantAttempts = attempts.filter(item => orderedIds.includes(item.questionId));
    const statsByQuestion = getStatsByQuestion(relevantAttempts);
    const savedIds = new Set(savedQuestions.map(item => item.questionId));
    const questionMap = await getQuestionMapByIds(orderedIds, [
      quizSession,
      ...relevantAttempts.map(item => ({ subject: item.subject, sourceCollection: item.sourceCollection })),
    ]);
    const answerByQuestion = new Map(answerSummary.map(item => [item.q, item]));

    const answers = orderedIds.map((questionId, index) => {
      const question = questionMap[questionId] || {};
      const summary = answerByQuestion.get(questionId) || {};
      const stats = statsByQuestion[questionId] || {
        questionId,
        correctCount: summary.ok ? 1 : 0,
        wrongCount: summary.ok || summary.skip ? 0 : 1,
        skippedCount: summary.skip ? 1 : 0,
        totalAttempts: 1,
      };
      const mastery = getMasteryLabel(stats);
      const isSkipped = Boolean(summary.skip) || summary.a === null || summary.a === undefined || summary.a === '';
      const isCorrect = !isSkipped && Boolean(summary.ok);
      return {
        questionNumber: index + 1,
        questionId,
        subject: question.subject || quizSession.subject,
        topic: question.topic || quizSession.topic,
        question: question.question || '',
        optionA: question.optionA || '',
        optionB: question.optionB || '',
        optionC: question.optionC || '',
        optionD: question.optionD || '',
        correctOption: question.correctOption || '',
        explanation: question.explanation || '',
        userAnswer: isSkipped ? '' : (summary.a || ''),
        isCorrect,
        isSkipped,
        timeTakenSeconds: Number(summary.s) || 0,
        stats,
        masteryLabel: mastery.label,
        masteryTone: mastery.tone,
        isSaved: savedIds.has(questionId),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        session: quizSession,
        answers,
      },
    });
  } catch (err) {
    console.error('[history/session]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load session' });
  }
}
