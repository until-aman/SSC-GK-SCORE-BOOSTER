import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  appendMentorTaskLog,
  updateMentorTaskStatus,
  upsertStudentTopicState,
} from '@/lib/sheets';

const ACTION_TO_STATUS = {
  complete: 'completed',
  snooze: 'snoozed',
  response: 'completed',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const {
    taskId = '',
    planId = '',
    actionType = '',
    actionValue = '',
    subject = '',
    topic = '',
  } = req.body || {};

  if (!taskId || !['complete', 'snooze', 'response', 'launch_practice'].includes(actionType)) {
    return res.status(400).json({ error: 'Invalid mentor task action' });
  }

  try {
    const sheets = await getSheetsClient();
    const now = new Date().toISOString();
    const status = ACTION_TO_STATUS[actionType];
    if (status) {
      const statusUpdates = {
        Status: status,
        CompletedAt: status === 'completed' ? now : '',
        SnoozedUntil: status === 'snoozed' ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() : '',
      };
      if (status === 'snoozed') statusUpdates.SnoozeCount = '__increment__';
      await updateMentorTaskStatus(sheets, session.user.email, taskId, {
        ...statusUpdates,
      });
    }

    if (actionType === 'response' && subject && topic) {
      const theoryStatus = normalizeTheoryStatus(actionValue);
      const update = {
        Subject: subject,
        Topic: topic,
      };
      if (theoryStatus) {
        update.TheoryStatus = theoryStatus;
        update.LastTheoryUpdatedAt = now;
      } else {
        const confidence = normalizeConfidence(actionValue);
        if (confidence !== 'unknown') {
          update.ConfidenceLevel = confidence;
          update.LastConfidenceUpdatedAt = now;
        }
      }
      if (update.TheoryStatus || update.ConfidenceLevel) {
        await upsertStudentTopicState(sheets, session.user.email, update).catch(() => {});
      }
    }

    if (actionType === 'complete' && subject && topic) {
      await upsertStudentTopicState(sheets, session.user.email, {
        Subject: subject,
        Topic: topic,
        TheoryStatus: 'done',
        LastTheoryUpdatedAt: now,
      }).catch(() => {});
    }

    await appendMentorTaskLog(sheets, {
      email: session.user.email,
      taskId,
      planId,
      actionType,
      actionValue,
      sourcePage: 'mentor',
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[mentor/task-action]', err.message);
    return res.status(500).json({ error: 'Task complete hua, lekin save nahi ho paya. Please retry.' });
  }
}

function normalizeConfidence(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'need revision') return 'weak';
  if (['weak', 'okay', 'strong', 'forgot', 'forgotten'].includes(text)) {
    return text === 'forgot' ? 'forgotten' : text;
  }
  return 'unknown';
}

function normalizeTheoryStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'theory complete') return 'done';
  if (text === 'started') return 'in_progress';
  if (text === 'not yet') return 'not_started';
  return '';
}
