// Pure rule-based Mentor plan generator. It does not call APIs or fetch data.

import {
  TASK_TYPE,
  TASK_STATUS,
  TASK_COUNT_BY_TIME,
  DAYS_LEFT_DEFAULT,
  MENTOR_COPY,
  getMentorDayMessage,
} from './mentorCopy';

export const MENTOR_PLAN_VERSION = 'v1';

export function generateTodaysPlan(profile = {}, subjectHistory = [], mistakesPreview = {}, masterTopics = {}, options = {}) {
  const tasks = [];
  const maxTasks = Math.min(3, TASK_COUNT_BY_TIME[profile.dailyGKTime] || 3);
  const historyMap = buildHistoryMap(subjectHistory);
  const repeatedMistakesCount = (mistakesPreview?.repeatedMistakesPreview || []).length;

  function makeTask(task) {
    return {
      status: TASK_STATUS.ACTIVE,
      secondaryAction: 'Maybe later',
      isRequiredForUnlock: true,
      dependsOnTaskIds: [],
      ...task,
    };
  }

  if (repeatedMistakesCount > 0 && tasks.length < maxTasks) {
    const selectedCount = Math.min(repeatedMistakesCount, 25);
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_mistake`,
      taskType: TASK_TYPE.MISTAKE_RECOVERY_TASK,
      subject: '',
      subjectName: 'Repeated Mistakes',
      topic: '',
      displayName: `${repeatedMistakesCount} repeated mistakes`,
      questionCount: selectedCount,
      estimatedMinutes: Math.ceil(selectedCount * 0.6),
      priority: 1,
      reason: 'recent_mistakes',
      whyThisText: `${selectedCount} priority questions selected from ${repeatedMistakesCount} repeated mistakes.`,
      mentorMessage: MENTOR_COPY.MISTAKE_RECOVERY_GUIDANCE,
      ctaLabel: 'Revise Mistakes',
      ctaRoute: '/history/mistakes',
    }));
  }

  const practiceNeeded = getTheoryDoneTopicsWithNoPractice(
    profile.subjectStatus || {},
    profile.topicsCompleted || {},
    historyMap,
    masterTopics
  );
  for (const item of practiceNeeded) {
    if (tasks.length >= maxTasks) break;
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_${item.subjectId}_${tasks.length + 1}`,
      taskType: TASK_TYPE.PRACTICE_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: 25,
      estimatedMinutes: 15,
      priority: 2,
      reason: 'practice_pending',
      whyThisText: 'Theory complete hai, ab practice se confidence strong hoga.',
      mentorMessage: MENTOR_COPY.PRACTICE_GUIDANCE,
      ctaLabel: 'Practice Questions',
      ctaRoute: null,
    }));
  }

  const weakHistoryTopics = getWeakHistoryTopics(subjectHistory, masterTopics);
  for (const item of weakHistoryTopics) {
    if (tasks.length >= maxTasks) break;
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_${item.subjectId}_weak_${tasks.length + 1}`,
      taskType: item.skippedHeavy ? TASK_TYPE.REVISION_TASK : TASK_TYPE.MISTAKE_RECOVERY_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: 25,
      estimatedMinutes: 15,
      priority: item.skippedHeavy ? 2.5 : 2,
      reason: item.skippedHeavy ? 'skipped_heavy' : 'quiz_weak',
      whyThisText: item.skippedHeavy
        ? 'Recent practice mein skips zyada hain. Recall strengthen karna better rahega.'
        : 'Recent practice mein mistakes zyada aa rahi hain.',
      mentorMessage: item.skippedHeavy
        ? MENTOR_COPY.RESULT_LOW_CONFIDENCE
        : MENTOR_COPY.REVISION_GUIDANCE,
      ctaLabel: item.skippedHeavy ? 'Start Revision' : 'Practice Questions',
      ctaRoute: null,
    }));
  }

  const weakTopics = getWeakTopics(profile.topicStrength || {});
  for (const item of weakTopics) {
    if (tasks.length >= maxTasks) break;
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_${item.subjectId}_revision_${tasks.length + 1}`,
      taskType: TASK_TYPE.REVISION_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.topicName,
      questionCount: 25,
      estimatedMinutes: 15,
      priority: 3,
      reason: 'quiz_weak',
      whyThisText: 'Recent performance weak signal de raha hai. Short revision helpful rahega.',
      mentorMessage: MENTOR_COPY.REVISION_GUIDANCE,
      ctaLabel: 'Start Revision',
      ctaRoute: null,
    }));
  }

  const coverageChecks = getCoverageCheckTopics(
    profile.subjectStatus || {},
    profile.topicsCompleted || {},
    masterTopics,
    tasks
  );
  for (const item of coverageChecks) {
    if (tasks.length >= maxTasks) break;
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_${item.subjectId}_coverage_${tasks.length + 1}`,
      taskType: TASK_TYPE.COVERAGE_CHECK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: null,
      estimatedMinutes: 2,
      priority: 3.5,
      reason: 'missing_coverage',
      whyThisText: 'Coverage status clear hoga toh practice task better choose hoga.',
      mentorMessage: `Kya aapne ${item.displayName || item.topicName} ki theory complete ki hai?`,
      ctaLabel: 'Answer Now',
      ctaRoute: null,
      isRequiredForUnlock: false,
    }));
  }

  const theoryPending = getTheoryPendingTopics(
    profile.subjectStatus || {},
    profile.topicsCompleted || {},
    masterTopics,
    tasks
  );
  for (const item of theoryPending) {
    if (tasks.length >= maxTasks) break;
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_${item.subjectId}_theory_${tasks.length + 1}`,
      taskType: TASK_TYPE.THEORY_TASK,
      subject: item.subjectId,
      subjectName: item.subjectName,
      topic: item.topicName,
      displayName: item.displayName,
      questionCount: null,
      estimatedMinutes: 20,
      priority: 4,
      reason: 'missing_coverage',
      whyThisText: 'Practice se pehle theory coverage clear hona zaroori hai.',
      mentorMessage: MENTOR_COPY.THEORY_GUIDANCE,
      ctaLabel: 'I completed theory',
      ctaRoute: null,
    }));
  }

  if (tasks.length < maxTasks) {
    const staleConfidence = getStaleConfidenceTopic(profile.studentTopicState || [], masterTopics);
    tasks.push(makeTask({
      taskId: `MT_${Date.now()}_confidence_${tasks.length + 1}`,
      taskType: TASK_TYPE.CONFIDENCE_CHECK,
      subject: staleConfidence?.subjectId || '',
      subjectName: staleConfidence?.subjectName || 'GK Revision',
      topic: staleConfidence?.topicName || '',
      displayName: staleConfidence?.displayName || 'Quick confidence check',
      questionCount: null,
      estimatedMinutes: 3,
      priority: 5,
      reason: staleConfidence ? 'confidence_stale' : 'missing_confidence',
      whyThisText: staleConfidence
        ? 'Is topic ka confidence update kaafi purana hai.'
        : 'Confidence update se next task better choose hoga.',
      mentorMessage: staleConfidence
        ? `Aapko ${staleConfidence.displayName || staleConfidence.topicName} abhi kitna strong lag raha hai?`
        : 'Aapko aaj GK recall kaisa lag raha hai? Ek quick check se plan better adjust hoga.',
      ctaLabel: 'Answer Now',
      ctaRoute: null,
      isRequiredForUnlock: false,
    }));
  }

  const daysTotal = (profile.daysLeftRange === "I don't know yet" || !profile.daysLeftRange)
    ? DAYS_LEFT_DEFAULT
    : parseDaysLeft(profile.daysLeftRange);
  const onboardingDate = profile.onboardingCompletedAt ? new Date(profile.onboardingCompletedAt) : new Date();
  const dayNumber = Number(options.dayNumberOverride) || Math.max(1, Math.floor((new Date() - onboardingDate) / 86400000) + 1);

  const revealCount = Number(options.revealCount || maxTasks);
  const finalTasks = applyAntiDuplication(tasks).slice(0, maxTasks).map((task, index) => ({
    ...task,
    status: index < revealCount ? TASK_STATUS.ACTIVE : TASK_STATUS.PENDING,
  }));

  return {
    planId: profile.mentorPlanId || `MP_${Date.now()}`,
    version: MENTOR_PLAN_VERSION,
    tasks: finalTasks,
    generatedAt: new Date().toISOString(),
    dayNumber,
    daysTotal,
    mentorDayMessage: getMentorDayMessage(),
  };
}

function buildHistoryMap(subjectHistory) {
  if (!Array.isArray(subjectHistory)) return {};
  const map = {};
  for (const subject of subjectHistory) {
    if (!subject?.subject) continue;
    map[subject.subject] = map[subject.subject] || {};
    for (const topic of subject.topics || []) {
      if (!topic?.topic) continue;
      map[subject.subject][topic.topic] = {
        totalAttempts: topic.totalAttempts || 0,
        accuracy: topic.accuracy || 0,
      };
    }
  }
  return map;
}

function getTheoryDoneTopicsWithNoPractice(subjectStatus, topicsCompleted, historyMap, masterTopics) {
  const results = [];
  for (const [subjectId, status] of Object.entries(subjectStatus || {})) {
    if (status === 'Not Started') continue;
    for (const topicName of topicsCompleted[subjectId] || []) {
      const hasPractice = (historyMap[subjectId]?.[topicName]?.totalAttempts || 0) > 0;
      if (hasPractice) continue;
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
  return results.sort(byWeightage);
}

function getWeakTopics(topicStrength) {
  const results = [];
  for (const [subjectId, topics] of Object.entries(topicStrength || {})) {
    for (const [topicName, strength] of Object.entries(topics || {})) {
      if (strength === 'Weak' || strength === 'weak') {
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

function getWeakHistoryTopics(subjectHistory, masterTopics) {
  const results = [];
  for (const subject of subjectHistory || []) {
    const subjectId = subject.subject;
    for (const topic of subject.topics || []) {
      if (!topic.topic || (topic.totalAttempts || 0) < 5) continue;
      const skippedRate = ((topic.skippedCount || 0) / topic.totalAttempts) * 100;
      const wrongRate = ((topic.wrongCount || 0) / topic.totalAttempts) * 100;
      const correctRate = Number(topic.accuracy || 0);
      if (skippedRate < 30 && correctRate >= 65 && wrongRate <= 25) continue;
      const meta = findTopicMeta(masterTopics, subjectId, topic.topic);
      results.push({
        subjectId,
        subjectName: meta?.subjectName || SUBJECT_DISPLAY_NAMES_FALLBACK[subjectId] || subjectId,
        topicName: topic.topic,
        displayName: meta?.displayName || topic.topic,
        sscWeightage: meta?.sscWeightage || 'Medium',
        skippedHeavy: skippedRate >= 30,
        score: skippedRate >= 30 ? 20 + skippedRate : 30 + wrongRate + (65 - Math.min(correctRate, 65)),
        lastAttemptAt: topic.lastAttemptAt || '',
      });
    }
  }
  return results.sort((a, b) => b.score - a.score || new Date(b.lastAttemptAt || 0) - new Date(a.lastAttemptAt || 0));
}

function getStaleConfidenceTopic(stateRows, masterTopics) {
  const now = Date.now();
  const candidates = (stateRows || [])
    .filter(row => row.Subject && row.Topic)
    .map(row => {
      const last = row.LastConfidenceUpdatedAt ? new Date(row.LastConfidenceUpdatedAt).getTime() : 0;
      const daysOld = last ? Math.floor((now - last) / 86400000) : 999;
      const subjectId = row.Subject;
      const meta = findTopicMeta(masterTopics, subjectId, row.Topic);
      return {
        subjectId,
        subjectName: meta?.subjectName || SUBJECT_DISPLAY_NAMES_FALLBACK[subjectId] || subjectId,
        topicName: row.Topic,
        displayName: meta?.displayName || row.Topic,
        daysOld,
      };
    })
    .filter(item => item.daysOld >= 14);
  return candidates.sort((a, b) => b.daysOld - a.daysOld)[0] || null;
}

function getTheoryPendingTopics(subjectStatus, topicsCompleted, masterTopics, existingTasks) {
  const results = [];
  const existingKeys = new Set(existingTasks.map(task => `${task.subject}|||${task.topic}`));
  for (const [subjectId, status] of Object.entries(subjectStatus || {})) {
    if (status === 'Not Started') continue;
    const subjectTopics = masterTopics?.subjects?.[subjectId]?.topics || [];
    const completedSet = new Set(topicsCompleted[subjectId] || []);
    for (const topicMeta of subjectTopics) {
      const key = `${subjectId}|||${topicMeta.topicName}`;
      if (completedSet.has(topicMeta.topicName) || existingKeys.has(key)) continue;
      results.push({
        subjectId,
        subjectName: masterTopics?.subjects?.[subjectId]?.subjectName || subjectId,
        topicName: topicMeta.topicName,
        displayName: topicMeta.displayName || topicMeta.topicName,
        sscWeightage: topicMeta.sscWeightage || 'Medium',
      });
    }
  }
  return results.sort(byWeightage);
}

function getCoverageCheckTopics(subjectStatus, topicsCompleted, masterTopics, existingTasks) {
  const results = [];
  const existingKeys = new Set(existingTasks.map(task => `${task.subject}|||${task.topic}`));
  for (const [subjectId, status] of Object.entries(subjectStatus || {})) {
    if (status === 'Not Started') continue;
    const completedTopics = topicsCompleted[subjectId] || [];
    if (completedTopics.length > 0) continue;
    const firstTopic = masterTopics?.subjects?.[subjectId]?.topics?.[0];
    if (!firstTopic) continue;
    const key = `${subjectId}|||${firstTopic.topicName}`;
    if (existingKeys.has(key)) continue;
    results.push({
      subjectId,
      subjectName: masterTopics?.subjects?.[subjectId]?.subjectName || SUBJECT_DISPLAY_NAMES_FALLBACK[subjectId] || subjectId,
      topicName: firstTopic.topicName,
      displayName: firstTopic.displayName || firstTopic.topicName,
      sscWeightage: firstTopic.sscWeightage || 'Medium',
    });
  }
  return results.sort(byWeightage);
}

function applyAntiDuplication(tasks) {
  const seen = new Set();
  return tasks.filter(task => {
    const key = `${task.subject || task.taskType}|||${task.topic || task.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findTopicMeta(masterTopics, subjectId, topicName) {
  return masterTopics?.subjects?.[subjectId]?.topics?.find(topic => topic.topicName === topicName) || null;
}

function byWeightage(a, b) {
  const order = { High: 0, Medium: 1, Low: 2 };
  return (order[a.sscWeightage] ?? 1) - (order[b.sscWeightage] ?? 1);
}

function parseDaysLeft(range) {
  const match = String(range || '').match(/(\d+)/);
  return match ? Number(match[1]) : DAYS_LEFT_DEFAULT;
}

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
