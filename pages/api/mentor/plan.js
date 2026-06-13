import { withApiTrace } from '@/lib/apiDiagnostics';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import {
  getSheetsClient,
  getMentorProfileWithPlanState,
  getMasterTopics,
  getActiveMentorPlan,
  createMentorPlanSnapshot,
  getStudentTopicState,
} from '@/lib/sheets';
import { getUserAttemptAnswers } from '@/lib/historyData';
import { generateTodaysPlan } from '@/lib/mentorPlanEngine';
import { getMentorDayMessage } from '@/lib/mentorCopy';
import { createSheetsMentorRepository, runMentorShadowComparison } from '@/lib/mentor/repository';
import { isMentorRepoV2Enabled, isMentorCanonicalDayReadEnabled, isMentorDailyRolloverV2Enabled, isMentorPendingLifecycleV2Enabled, isMentorDailyRolloverUserAllowed } from '@/lib/mentor/repository/featureFlags';
import { processDailyRollover } from '@/lib/mentor/services/dailyRolloverService';
import { executeDailyRolloverWrite } from '@/lib/mentor/services/rolloverWriteExecutor';
import { userScopeFromIdentity } from '@/lib/mentor/services/taskMutationService';
import { createSheetsMutationRepository, createSheetsIdempotencyStore, createSheetsPlanWriter } from '@/lib/mentor/repository/sheetsMutationRepository';
import { applyRepoV2Compatibility } from '@/lib/mentor/read/serveCompatibleSnapshot';

function normalizeSubjectId(subjectId) {
  return String(subjectId || '').replace(/^Q_PYQ_/, '');
}

function buildMasterTopics(rows = []) {
  const subjects = {};
  rows.forEach(row => {
    const subjectId = normalizeSubjectId(row.SubjectId);
    if (!subjectId) return;
    if (!subjects[subjectId]) subjects[subjectId] = { subjectName: row.SubjectName, topics: [] };
    subjects[subjectId].topics.push({
      topicName: row.TopicName,
      displayName: row.DisplayName || row.TopicName,
      sscWeightage: row.SSCWeightage || 'Medium',
    });
  });
  return { subjects };
}

function buildSubjectHistory(attempts = []) {
  const map = {};
  attempts.forEach(attempt => {
    const subject = normalizeSubjectId(attempt.subject);
    const topic = attempt.topic || '';
    if (!subject || !topic) return;
    map[subject] = map[subject] || {};
    map[subject][topic] = map[subject][topic] || { subject, topic, totalAttempts: 0, correct: 0, wrong: 0, skipped: 0, lastAttemptAt: '' };
    map[subject][topic].totalAttempts += 1;
    if (attempt.isCorrect) map[subject][topic].correct += 1;
    else if (attempt.isSkipped) map[subject][topic].skipped += 1;
    else map[subject][topic].wrong += 1;
    if (attempt.attemptedAt && (!map[subject][topic].lastAttemptAt || new Date(attempt.attemptedAt) > new Date(map[subject][topic].lastAttemptAt))) {
      map[subject][topic].lastAttemptAt = attempt.attemptedAt;
    }
  });
  return Object.entries(map).map(([subject, topics]) => ({
    subject,
    topics: Object.values(topics).map(item => ({
      topic: item.topic,
      totalAttempts: item.totalAttempts,
      accuracy: item.totalAttempts ? (item.correct / item.totalAttempts) * 100 : 0,
      wrongCount: item.wrong,
      skippedCount: item.skipped,
      lastAttemptAt: item.lastAttemptAt,
    })),
  }));
}

function buildMistakesPreview(attempts = []) {
  const wrongCount = {};
  attempts.forEach(attempt => {
    if (!attempt.questionId || attempt.isSkipped || attempt.isCorrect) return;
    wrongCount[attempt.questionId] = (wrongCount[attempt.questionId] || 0) + 1;
  });
  return {
    repeatedMistakesPreview: Object.entries(wrongCount)
      .filter(([, count]) => count >= 2)
      .map(([questionId]) => ({ questionId })),
  };
}

function mergeStudentTopicState(profile, stateRows = []) {
  const topicStrength = { ...(profile.topicStrength || {}) };
  const topicsCompleted = { ...(profile.topicsCompleted || {}) };
  const subjectStatus = { ...(profile.subjectStatus || {}) };

  stateRows.forEach(row => {
    const subject = normalizeSubjectId(row.Subject);
    const topic = row.Topic || '';
    if (!subject || !topic) return;
    const confidence = String(row.ConfidenceLevel || '').toLowerCase();
    const theory = String(row.TheoryStatus || '').toLowerCase();
    const practice = String(row.PracticeStatus || '').toLowerCase();

    if (confidence && confidence !== 'unknown') {
      topicStrength[subject] = topicStrength[subject] || {};
      topicStrength[subject][topic] = confidence === 'forgotten' ? 'Weak' : confidence.charAt(0).toUpperCase() + confidence.slice(1);
    }
    if (theory === 'done' && !(topicsCompleted[subject] || []).includes(topic)) {
      topicsCompleted[subject] = [...(topicsCompleted[subject] || []), topic];
      if (!subjectStatus[subject] || subjectStatus[subject] === 'Not Started') subjectStatus[subject] = 'Theory Done';
    }
    if (practice && practice !== 'unknown') {
      if (!subjectStatus[subject] || subjectStatus[subject] === 'Not Started') subjectStatus[subject] = 'Practice Started';
    }
  });

  return {
    ...profile,
    subjectStatus,
    topicsCompleted,
    topicStrength,
    studentTopicState: stateRows,
  };
}

function buildSnapshot(profile, plan) {
  const tasks = plan?.tasks || [];
  const mentorMessage = plan?.mentorDayMessage || getMentorDayMessage(new Date());
  const activeTasks = tasks.filter(task => task.status === 'active').slice(0, 3);
  const completedToday = tasks.filter(task => task.status === 'completed');
  const deferredTasks = tasks.filter(task => task.status === 'snoozed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const total = tasks.filter(task => ['active', 'completed', 'snoozed', 'blocked'].includes(task.status)).length;
  const completed = completedToday.length;
  return {
    exists: Boolean(profile),
    profile,
    plan: plan ? {
      ...plan,
      dayNumber: plan.activeDayNumber || plan.dayNumber || 1,
      daysTotal: Number(profile?.daysLeftRange?.match?.(/(\d+)/)?.[1] || 45),
      mentorDayMessage: mentorMessage,
      tasks,
    } : null,
    activeTasks,
    completedToday,
    deferredTasks,
    pendingTasks,
    progress: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
    },
    mentorMessage,
    lastSyncAt: new Date().toISOString(),
  };
}

// Phase 9B-Prep: the Repository V2 read overlay was extracted to
// `lib/mentor/read/serveCompatibleSnapshot.js` (imported above) so GET
// /api/mentor/plan and the future V2 task-action response share one contract.

export async function loadOrCreateMentorSnapshot(email, { forceRefresh = false, revealCount, unlockNextDay = false } = {}) {
  const sheets = await getSheetsClient();
  const profile = await getMentorProfileWithPlanState(sheets, email);
  if (!profile) return buildSnapshot(null, null);
  let dayNumberOverride = null;

  if (!forceRefresh) {
    const existing = await getActiveMentorPlan(sheets, email);
    if (existing?.tasks?.length) return buildSnapshot(profile, existing);
  } else if (unlockNextDay) {
    const existing = await getActiveMentorPlan(sheets, email).catch(() => null);
    dayNumberOverride = Number(existing?.activeDayNumber || existing?.dayNumber || profile.activeDayNumber || 1) + 1;
  }

  const [topicRows, attempts, topicState] = await Promise.all([
    getMasterTopics(sheets).catch(() => []),
    getUserAttemptAnswers(email).catch(() => []),
    getStudentTopicState(sheets, email).catch(() => []),
  ]);
  const profileWithState = mergeStudentTopicState(profile, topicState);
  const generated = generateTodaysPlan(
    profileWithState,
    buildSubjectHistory(attempts),
    buildMistakesPreview(attempts),
    buildMasterTopics(topicRows),
    { revealCount, dayNumberOverride }
  );
  const savedPlan = await createMentorPlanSnapshot(sheets, email, profileWithState, generated);
  return buildSnapshot(profileWithState, {
    ...savedPlan,
    mentorDayMessage: generated.mentorDayMessage,
    dayNumber: generated.dayNumber,
    daysTotal: generated.daysTotal,
  });
}

export default withApiTrace('/api/mentor/plan', handler);
async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let snapshot = await loadOrCreateMentorSnapshot(session.user.email);
    // Phase 8C: serve Mentor reads via Repository V2 (generation isolation +
    // canonical day) when enabled. Read-only; falls back to legacy on any error.
    if (isMentorRepoV2Enabled() && snapshot && snapshot.exists) {
      try {
        const repo = createSheetsMentorRepository();
        const repoSnapshot = await repo.getMentorSnapshotData({ email: session.user.email });
        snapshot = applyRepoV2Compatibility(snapshot, repoSnapshot);
      } catch (repoErr) {
        console.error('[mentor/plan] repo-v2 overlay failed, serving legacy:', repoErr.message);
      }
    }
    if (isMentorCanonicalDayReadEnabled()) {
      const repo = createSheetsMentorRepository();
      const canonical = await repo.getMentorSnapshotData({ email: session.user.email });
      snapshot.canonicalPlanDay = {
        planStartLocalDate: canonical.planStartLocalDate,
        planStartSource: canonical.planStartSource,
        timezone: canonical.timezone,
        totalPlanDays: canonical.totalPlanDays,
        calendarDay: canonical.calendarDay,
        unlockedDay: canonical.unlockedDay,
        activePlanDay: canonical.activePlanDay,
        isPlanComplete: canonical.isPlanComplete,
        daysRemaining: canonical.daysRemaining,
        serverGeneratedAt: canonical.serverGeneratedAt,
      };
      if (snapshot.plan) {
        snapshot.plan = {
          ...snapshot.plan,
          canonicalDayNumber: canonical.activePlanDay,
          canonicalCalendarDay: canonical.calendarDay,
          canonicalDaysTotal: canonical.totalPlanDays,
        };
      }
    }
    // Phase 2: read-only shadow comparison (Mentor Repository v2). No-op unless
    // MENTOR_REPO_V2_SHADOW is enabled; fire-and-forget; never alters the response.
    if (process.env.MENTOR_REPO_V2_SHADOW === 'true') {
      runMentorShadowComparison(
        { email: session.user.email },
        { ...snapshot, studentTopicState: snapshot.profile?.studentTopicState || [] }
      ).catch(() => {});
    }
    if (isMentorDailyRolloverV2Enabled() || isMentorPendingLifecycleV2Enabled()) {
      // Phase 10C: real user scope hash (no full email in keys/logs/monitor).
      const userScope = userScopeFromIdentity({ email: session.user.email });
      if (isMentorDailyRolloverUserAllowed(userScope)) {
        // WRITE path (Phase 10D-FIX-3): AWAITED before the response is sent. On Vercel the
        // serverless function is frozen/reclaimed once the HTTP response returns, which
        // truncated the previous fire-and-forget rollover mid-write (partial moves, missing
        // events/marker/ROLLOVER row). Awaiting guarantees the multi-write sequence finishes
        // within the function's active lifetime. Only the narrow allowlisted cohort reaches
        // this (isMentorDailyRolloverUserAllowed is false unless MENTOR_DAILY_ROLLOVER_V2 is
        // true AND the user is allow-all/allowlisted), and it does heavy work once/day (then
        // idempotent replay = one read), so the bounded added latency is acceptable.
        // A write failure is logged but never fails the user's plan response.
        try {
          const repo = createSheetsMentorRepository();
          const canonical = await repo.getMentorSnapshotData({ email: session.user.email });
          const sheets = await getSheetsClient();
          const result = await executeDailyRolloverWrite({
            snapshot: canonical,
            userScope,
            activePlan: canonical.activePlan,
            now: canonical.serverGeneratedAt,
            mutationRepository: createSheetsMutationRepository({ sheets, email: session.user.email }),
            idempotencyStore: createSheetsIdempotencyStore({ sheets, email: session.user.email }),
            planWriter: createSheetsPlanWriter({ sheets, email: session.user.email }),
            totalPlanDays: canonical.totalPlanDays,
          });
          // Bug B (Phase 10D-FIX): rollover write failures MUST be visible, never swallowed.
          if (!result || result.ok === false) {
            console.error('[mentor-rollover-write] FAILED', { code: result && result.code, reason: result && result.reason, error: result && result.error, applied: result && result.appliedCount, lastProcessedWritten: result && result.lastProcessedWritten, diagnostics: result && result.diagnostics });
          } else {
            console.log('[mentor-rollover-write]', { ok: result.ok, idempotent: result.idempotent, rolloverRequired: result.rolloverRequired, applied: result.appliedCount, finalDay: result.finalDay, lastProcessedWritten: result.lastProcessedWritten, diagnostics: result.diagnostics });
          }
        } catch (err) {
          // Never fail the plan response on a rollover write error — log and move on.
          console.error('[mentor-rollover-write] threw', err && err.message, err && err.stack);
        }
      } else {
        // SHADOW path — compute only, log-only, NO writes. Safe to leave fire-and-forget:
        // a truncated shadow writes nothing, so serverless freeze is harmless here.
        const repo = createSheetsMentorRepository();
        repo.getMentorSnapshotData({ email: session.user.email })
          .then(async canonical => {
            const result = await processDailyRollover({
              userScope,
              activePlan: canonical.activePlan,
              repositorySnapshot: canonical,
              currentServerTime: canonical.serverGeneratedAt,
              idempotencyStore: { get: async () => null, save: async () => {} },
            });
            if (!result?.ok) return;
            console.log('[mentor-rollover-shadow]', {
              calendarDay: result.calendarDay,
              lastProcessedCalendarDay: result.lastProcessedCalendarDay,
              rolloverRequired: result.rolloverRequired,
              wouldMoveToPendingCount: result.movedToPendingCount || 0,
              wouldRescheduleCount: result.rescheduledCount || 0,
              wouldFeatureTask: Boolean(result.featuredPendingTaskId),
              currentGenerationTaskCount: snapshot.activeTasks?.length || 0,
              diagnosticCodes: result.diagnostics || [],
            });
          })
          .catch(err => console.error('[mentor-rollover] unhandled', err && err.message, err && err.stack));
      }
    }
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error('[mentor/plan]', err.message);
    return res.status(500).json({ error: 'Could not load mentor plan.' });
  }
}
