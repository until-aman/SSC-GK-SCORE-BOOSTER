import { withApiTrace } from '@/lib/apiDiagnostics';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  appendMentorTaskLog,
  getActiveMentorPlan,
  updateMentorTaskStatus,
  upsertStudentTopicState,
} from '@/lib/sheets';
import { loadOrCreateMentorSnapshot } from './plan';
import { isMentorTaskStateMachineV2Enabled } from '@/lib/mentor/repository/featureFlags';
import { evaluateTaskTransition, TASK_ACTION } from '@/lib/mentor/domain/taskStateMachine';
import { COMPLETION_SOURCE, PENDING_REASON } from '@/lib/mentor/domain/enums';

const ACTION_TO_STATUS = {
  complete: 'completed',
  snooze: 'snoozed',
  response: 'completed',
};

export default withApiTrace('/api/mentor/task-action', handler);
async function handler(req, res) {
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
    if (isMentorTaskStateMachineV2Enabled()) {
      await shadowValidateTaskAction({ sheets, email: session.user.email, taskId, planId, actionType, actionValue }).catch(() => {});
    }
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

    // Step 8: for non-launch actions, return the SAME authoritative snapshot the
    // client used to fetch separately via GET /api/mentor/plan, so the client
    // patches its state/cache from this response and skips the follow-up GET.
    // This reuses the existing snapshot builder (existing active plan → no
    // regeneration), so it does not add a new full-plan rebuild. launch_practice
    // navigates away and needs no snapshot.
    if (actionType !== 'launch_practice') {
      try {
        const snapshot = await loadOrCreateMentorSnapshot(session.user.email);
        return res.status(200).json({ success: true, snapshot });
      } catch (snapErr) {
        // Mutation already succeeded; the client falls back to a plan refresh.
        console.error('[mentor/task-action] snapshot build failed:', snapErr.message);
        return res.status(200).json({ success: true });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[mentor/task-action]', err.message);
    return res.status(500).json({ error: 'Task complete hua, lekin save nahi ho paya. Please retry.' });
  }
}

async function shadowValidateTaskAction({ sheets, email, taskId, planId, actionType, actionValue }) {
  const plan = await getActiveMentorPlan(sheets, email);
  const task = (plan?.tasks || []).find(item => item.taskId === taskId);
  if (!task) return;
  const action = mapLegacyAction(actionType, actionValue);
  const result = evaluateTaskTransition({
    task: { ...task, type: task.taskType || task.type, planVersion: 1, isCurrentGeneration: true },
    action,
    context: {
      expectedPlanId: planId || plan.planId,
      expectedPlanVersion: 1,
      pendingReason: PENDING_REASON.USER_POSTPONED,
      completionSource: actionType === 'response' ? COMPLETION_SOURCE.MENTOR_RESPONSE : COMPLETION_SOURCE.MANUAL_RECOVERY,
      manualRecoveryVerified: actionValue === 'manual_recovery',
    },
  });
  console.info('[mentor-task-sm-v2:shadow]', JSON.stringify({
    action,
    legacyAction: actionType,
    legacyCurrentStatus: task.status,
    canonicalMappedStatus: task.status === 'snoozed' ? 'pending' : task.status,
    allowed: Boolean(result.allowed),
    proposedNextStatus: result.allowed ? result.nextTask.status : null,
    diagnosticCode: result.allowed ? null : result.code,
  }));
}

function mapLegacyAction(actionType, actionValue) {
  if (actionType === 'snooze') return TASK_ACTION.POSTPONE;
  if (actionType === 'response') return TASK_ACTION.COMPLETE;
  if (actionType === 'launch_practice') return TASK_ACTION.START;
  if (actionType === 'complete' && actionValue === 'manual_recovery') return TASK_ACTION.COMPLETE_MANUAL_RECOVERY;
  if (actionType === 'complete') return TASK_ACTION.COMPLETE;
  return '';
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
