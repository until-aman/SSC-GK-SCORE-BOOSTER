import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  appendMentorTaskLog,
  updateMentorTaskStatus,
  upsertStudentTopicState,
} from '@/lib/sheets';
import { shouldRouteQuizCompletionThroughV2 } from '@/lib/mentor/read/taskActionRouting';
import { createSheetsMentorRepository } from '@/lib/mentor/repository';
import { createSheetsMutationRepository, createSheetsIdempotencyStore } from '@/lib/mentor/repository/sheetsMutationRepository';
import { executeV2QuizComplete } from '@/lib/mentor/read/v2TaskActionHandler';

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

    // Phase 9G1: gated V2 quiz-sync COMPLETE (allowlisted users only). Fail-closed:
    // once entered, it does NOT fall back to the legacy write. Manual `complete`
    // (task-action) stays legacy regardless.
    if (shouldRouteQuizCompletionThroughV2({ email: session.user.email })) {
      try {
        const repoSnap = await createSheetsMentorRepository().getMentorSnapshotData({ email: session.user.email });
        const repository = createSheetsMutationRepository({
          sheets,
          email: session.user.email,
          currentGenerationTaskIds: new Set((repoSnap.currentTasks || []).map(t => t.taskId)),
          hiddenTaskIds: new Set((repoSnap.hiddenLegacyTasks || []).map(t => t.taskId)),
        });
        const idempotencyStore = createSheetsIdempotencyStore({ sheets, email: session.user.email });
        const result = await executeV2QuizComplete({
          userIdentity: { email: session.user.email },
          repository,
          idempotencyStore,
          now,
          request: { taskId, planId, quizSessionId, subject, topic, correct, incorrect, skipped, totalQuestions },
          upsertTopicState: async (update) => { await upsertStudentTopicState(sheets, session.user.email, update); },
        });
        if (!result.ok) return res.status(result.httpStatus || 409).json({ success: false, code: result.code, error: result.message || 'Quiz completion could not be saved.' });
        return res.status(200).json({ success: true, idempotent: result.idempotent });
      } catch (v2err) {
        console.error('[mentor/quiz-return] v2 complete error:', v2err.message);
        return res.status(500).json({ success: false, code: 'V2_QUIZ_COMPLETE_ERROR', error: 'Could not update mentor task.' });
      }
    }

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
