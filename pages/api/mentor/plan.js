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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snapshot = await loadOrCreateMentorSnapshot(session.user.email);
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error('[mentor/plan]', err.message);
    return res.status(500).json({ error: 'Could not load mentor plan.' });
  }
}
