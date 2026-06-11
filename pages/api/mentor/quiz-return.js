import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  appendMentorTaskLog,
  updateMentorTaskStatus,
  upsertStudentTopicState,
} from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const {
    taskId = '',
    planId = '',
    quizSessionId = '',
    subject = '',
    topic = '',
    correct = 0,
    incorrect = 0,
    skipped = 0,
    totalQuestions = 0,
  } = req.body || {};

  if (!taskId) return res.status(400).json({ error: 'taskId is required' });

  try {
    const sheets = await getSheetsClient();
    const now = new Date().toISOString();
    await updateMentorTaskStatus(sheets, session.user.email, taskId, {
      Status: 'completed',
      CompletedAt: now,
    });

    const total = Number(totalQuestions) || Number(correct) + Number(incorrect) + Number(skipped);
    const accuracy = total ? (Number(correct) / total) * 100 : 0;
    const wrongRate = total ? (Number(incorrect) / total) * 100 : 0;
    const skippedRate = total ? (Number(skipped) / total) * 100 : 0;
    const resultCategory = classifyMentorResult(accuracy, wrongRate, skippedRate);
    if (subject && topic) {
      await upsertStudentTopicState(sheets, session.user.email, {
        Subject: subject,
        Topic: topic,
        PracticeStatus: accuracy >= 65 && wrongRate <= 25 ? 'enough_practice' : 'started',
        LastPracticeUpdatedAt: now,
        LastQuizAttemptAt: now,
        RecentAccuracy: Math.round(accuracy),
        ConfidenceLevel: confidenceFromResult(resultCategory),
      }).catch(() => {});
    }

    await appendMentorTaskLog(sheets, {
      email: session.user.email,
      taskId,
      planId,
      actionType: 'return_from_quiz',
      actionValue: { correct, incorrect, skipped, totalQuestions: total, accuracy: Math.round(accuracy), resultCategory },
      sourcePage: 'result',
      quizSessionId,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[mentor/quiz-return]', err.message);
    return res.status(500).json({ error: 'Could not update mentor task.' });
  }
}

function classifyMentorResult(correctRate, wrongRate, skippedRate) {
  if (skippedRate >= 30) return 'LOW_CONFIDENCE';
  if (correctRate >= 80 && wrongRate <= 15 && skippedRate <= 10) return 'EXCELLENT';
  if (correctRate >= 65 && wrongRate <= 25) return 'GOOD';
  if (correctRate < 45 || wrongRate > 40) return 'WEAK';
  return 'AVERAGE';
}

function confidenceFromResult(category) {
  if (category === 'EXCELLENT') return 'strong';
  if (category === 'GOOD') return 'okay';
  if (category === 'LOW_CONFIDENCE') return 'forgotten';
  return 'weak';
}
