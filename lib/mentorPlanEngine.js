// lib/mentorPlanEngine.js
// Pure JS rule-based plan generator.
// No API calls. No fetch(). No imports from pages/.
// All inputs are passed in. Returns tasks array deterministically.

import {
  TASK_TYPE,
  TASK_COUNT_BY_TIME,
  DAYS_LEFT_DEFAULT,
  MENTOR_COPY,
} from './mentorCopy';

/**
 * @param {Object} profile       - camelCase profile from getMentorProfile()
 * @param {Array}  subjectHistory - [{ subject, topics: [{ topic, totalAttempts, accuracy }] }]
 * @param {Object} mistakesPreview - { repeatedMistakesPreview: [{ questionId }] }
 * @param {Object} masterTopics   - { subjects: { SubjectId: { subjectName, topics: [...] } } }
 * @returns {Object} { tasks, generatedAt, dayNumber, daysTotal, mentorDayMessage }
 */
export function generateTodaysPlan(profile, subjectHistory, mistakesPreview, masterTopics) {
  const tasks = [];
  const maxTasks = TASK_COUNT_BY_TIME[profile.dailyGKTime] || 3;

  const historyMap = buildHistoryMap(subjectHistory);
  const repeatedMistakesCount = (mistakesPreview?.repeatedMistakesPreview || []).length;

  // RULE 1: Repeated mistakes
  if (repeatedMistakesCount > 0 && tasks.length < maxTasks) {
    tasks.push({
      taskId: `task_mistake_${Date.now()}`,
      taskType: TASK_TYPE.MISTAKE_REVISION,
      subject: null,
      subjectName: 'Repeated Mistakes',
      topic: null,
      displayName: `${repeatedMistakesCount} repeated mistake${repeatedMistakesCount !== 1 ? 's' : ''}`,
      questionCount: Math.min(repeatedMistakesCount, 25),
      estimatedMinutes: Math.ceil(Math.min(repeatedMistakesCount, 25) * 0.6),
      priority: 1,
      mentorMessage: MENTOR_COPY.MISTAKE_REVISION,
      ctaLabel: 'Revise Mistakes',
      ctaRoute: '/history/mistakes',
    });
  }

  // RULE 2: Theory-done topics with no practice history
  const practiceNeeded = getTheoryDoneTopicsWithNoPractice(
    profile.subjectStatus || {},
    profile.topicsCompleted || {},
    historyMap,
    masterTopics
  );
  for (const item of practiceNeeded) {
    if (tasks.length >= maxTasks) break;
    tasks.push({
      taskId: `task_practice_${item.subjectId}_${Date.now()}`,
      taskType: TASK_TYPE.PRACTICE_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: 25,
      estimatedMinutes: 15,
      priority: 2,
      mentorMessage: MENTOR_COPY.PRACTICE_TASK,
      ctaLabel: 'Start Practice',
      ctaRoute: `/quiz-setup?subject=${encodeURIComponent(item.subjectId)}&topic=${encodeURIComponent(item.topicName)}&count=25&collection=PYQ&sourceScreen=mentor_plan`,
    });
  }

  // RULE 3: Weak topics
  const weakTopics = getWeakTopics(profile.topicStrength || {});
  for (const item of weakTopics) {
    if (tasks.length >= maxTasks) break;
    tasks.push({
      taskId: `task_revision_${item.subjectId}_${Date.now()}`,
      taskType: TASK_TYPE.QUICK_REVISION,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.topicName,
      questionCount: 25,
      estimatedMinutes: 15,
      priority: 3,
      mentorMessage: MENTOR_COPY.QUICK_REVISION,
      ctaLabel: 'Start Revision',
      ctaRoute: `/quiz-setup?subject=${encodeURIComponent(item.subjectId)}&topic=${encodeURIComponent(item.topicName)}&count=25&collection=PYQ&sourceScreen=mentor_plan`,
    });
  }

  // RULE 4: Theory pending (subject not "Not Started" but topics not yet completed)
  const theoryPending = getTheoryPendingTopics(
    profile.subjectStatus || {},
    profile.topicsCompleted || {},
    masterTopics,
    tasks
  );
  for (const item of theoryPending) {
    if (tasks.length >= maxTasks) break;
    tasks.push({
      taskId: `task_theory_${item.subjectId}_${Date.now()}`,
      taskType: TASK_TYPE.THEORY_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: null,
      estimatedMinutes: 20,
      priority: 4,
      mentorMessage: MENTOR_COPY.THEORY_TASK,
      ctaLabel: 'Mark as Done',
      ctaRoute: null,
    });
  }

  // RULE 5: Daily Challenge always last
  if (tasks.length < maxTasks) {
    tasks.push({
      taskId: `task_daily_${Date.now()}`,
      taskType: TASK_TYPE.DAILY_CHALLENGE,
      subject: null,
      subjectName: 'Daily Challenge',
      topic: null,
      displayName: 'Mixed GK · 10 Questions',
      questionCount: 10,
      estimatedMinutes: 10,
      priority: 5,
      mentorMessage: MENTOR_COPY.DAILY_CHALLENGE,
      ctaLabel: 'Start Challenge',
      ctaRoute: '/quiz?mode=daily&sourceScreen=mentor_plan',
    });
  }

  // Compute day number
  const daysTotal = (profile.daysLeftRange === "I don't know yet" || !profile.daysLeftRange)
    ? DAYS_LEFT_DEFAULT
    : parseDaysLeft(profile.daysLeftRange);

  const onboardingDate = profile.onboardingCompletedAt
    ? new Date(profile.onboardingCompletedAt)
    : new Date();
  const dayNumber = Math.max(1,
    Math.floor((new Date() - onboardingDate) / (1000 * 60 * 60 * 24)) + 1
  );

  // Time-based day message
  const hour = new Date().getHours();
  const mentorDayMessage =
    hour < 12 ? MENTOR_COPY.MORNING_GREETING :
    hour < 17 ? MENTOR_COPY.AFTERNOON_GREETING :
    hour < 21 ? MENTOR_COPY.EVENING_GREETING :
    MENTOR_COPY.NIGHT_GREETING;

  return { tasks, generatedAt: new Date().toISOString(), dayNumber, daysTotal, mentorDayMessage };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildHistoryMap(subjectHistory) {
  if (!Array.isArray(subjectHistory)) return {};
  const map = {};
  for (const s of subjectHistory) {
    if (!s?.subject) continue;
    map[s.subject] = map[s.subject] || {};
    if (Array.isArray(s.topics)) {
      for (const t of s.topics) {
        if (!t?.topic) continue;
        map[s.subject][t.topic] = {
          totalAttempts: t.totalAttempts || 0,
          accuracy: t.accuracy || 0,
        };
      }
    }
  }
  return map;
}

function getTheoryDoneTopicsWithNoPractice(subjectStatus, topicsCompleted, historyMap, masterTopics) {
  const results = [];
  for (const [subjectId, status] of Object.entries(subjectStatus)) {
    if (status === 'Not Started') continue;
    const completed = topicsCompleted[subjectId] || [];
    for (const topicName of completed) {
      const hasPractice = (historyMap[subjectId]?.[topicName]?.totalAttempts || 0) > 0;
      if (!hasPractice) {
        const meta = findTopicMeta(masterTopics, subjectId, topicName);
        results.push({
          subjectId,
          subjectName: meta?.subjectName || SUBJECT_DISPLAY_NAMES_FALLBACK[subjectId] || subjectId,
          topicName,
          displayName: meta?.displayName || topicName,
          sscWeightage: meta?.sscWeightage || 'Medium',
        });
      }
    }
  }
  return results.sort(byWeightage);
}

function getWeakTopics(topicStrength) {
  const results = [];
  for (const [subjectId, topics] of Object.entries(topicStrength)) {
    for (const [topicName, strength] of Object.entries(topics)) {
      if (strength === 'Weak') {
        results.push({
          subjectId,
          subjectName: SUBJECT_DISPLAY_NAMES_FALLBACK[subjectId] || subjectId,
          topicName,
        });
      }
    }
  }
  return results;
}

function getTheoryPendingTopics(subjectStatus, topicsCompleted, masterTopics, existingTasks) {
  const results = [];
  const existingKeys = new Set(existingTasks.map(t => `${t.subject}|||${t.topic}`));
  for (const [subjectId, status] of Object.entries(subjectStatus)) {
    if (status === 'Not Started') continue;
    const subjectTopics = masterTopics?.subjects?.[subjectId]?.topics || [];
    const completedSet = new Set(topicsCompleted[subjectId] || []);
    for (const topicMeta of subjectTopics) {
      const key = `${subjectId}|||${topicMeta.topicName}`;
      if (!completedSet.has(topicMeta.topicName) && !existingKeys.has(key)) {
        results.push({
          subjectId,
          subjectName: masterTopics?.subjects?.[subjectId]?.subjectName || subjectId,
          topicName: topicMeta.topicName,
          displayName: topicMeta.displayName || topicMeta.topicName,
          sscWeightage: topicMeta.sscWeightage || 'Medium',
        });
      }
    }
  }
  return results.sort(byWeightage);
}

function findTopicMeta(masterTopics, subjectId, topicName) {
  return masterTopics?.subjects?.[subjectId]?.topics?.find(t => t.topicName === topicName) || null;
}

function byWeightage(a, b) {
  const order = { High: 0, Medium: 1, Low: 2 };
  return (order[a.sscWeightage] ?? 1) - (order[b.sscWeightage] ?? 1);
}

function parseDaysLeft(range) {
  if (!range) return DAYS_LEFT_DEFAULT;
  const m = range.match(/(\d+)/);
  return m ? parseInt(m[1]) : DAYS_LEFT_DEFAULT;
}

// Fallback if masterTopics not yet loaded
const SUBJECT_DISPLAY_NAMES_FALLBACK = {
  Polity: 'Indian Polity',
  Geography: 'Geography',
  Ancient_History: 'Ancient History',
  Medieval_History: 'Medieval History',
  Modern_History: 'Modern History',
  Economics: 'Economics',
  Physics: 'Physics',
  Chemistry: 'Chemistry',
  Biology: 'Biology',
  Current_Affairs: 'Current Affairs',
  Static_GK: 'Static GK',
};
