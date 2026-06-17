const QUIZ_LAUNCHABLE_TASK_TYPES = new Set([
  'practice_task',
  'mistake_recovery_task',
  'revision_task',
]);

const NON_QUIZ_TASK_TYPES = new Set([
  'coverage_check',
  'confidence_check',
  'feedback_task',
  'pace_unlock_task',
]);

const SUBJECT_ALIASES = {
  Q_PYQ_Polity: 'Polity',
  Q_PYQ_Geography: 'Geography',
  Q_PYQ_Economics: 'Economics',
  Q_PYQ_Ancient_History: 'Ancient History',
  Q_PYQ_Medieval_History: 'Medieval History',
  Q_PYQ_Modern_History: 'Modern History',
  Q_PYQ_Physics: 'Physics',
  Q_PYQ_Chemistry: 'Chemistry',
  Q_PYQ_Biology: 'Biology',
  Q_PYQ_Current_Affairs: 'Current Affairs',
  Q_PYQ_Static_GK: 'Static GK',
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSubject(value) {
  const raw = clean(value);
  if (!raw) return '';
  if (SUBJECT_ALIASES[raw]) return SUBJECT_ALIASES[raw];
  return raw.replace(/^Q_PYQ_/, '').replace(/_/g, ' ');
}

function normalizeTopic(value) {
  return clean(value).replace(/_/g, ' ');
}

function isPlaceholderSubject(value) {
  const normalized = normalizeSubject(value).toLowerCase();
  return !normalized || normalized === 'repeated mistakes' || normalized === 'mentor task';
}

function resolveSubject(task) {
  if (task?.reason === 'recent_mistakes' && isPlaceholderSubject(task.subject || task.subjectName || task.subjectId)) {
    return 'Mixed GK';
  }
  return normalizeSubject(task?.subject || task?.subjectName || task?.subjectId);
}

function resolveTopic(task, subject) {
  const topic = normalizeTopic(task?.topic || task?.topicName || '');
  if (topic) return topic;
  if (task?.reason === 'recent_mistakes' || task?.taskType === 'mistake_recovery_task') return 'Repeated Mistakes';
  if (subject) return 'All';
  return '';
}

function resolveMode(task) {
  if (task?.taskType === 'mistake_recovery_task' || task?.reason === 'recent_mistakes' || task?.ctaRoute === '/history/mistakes') {
    return {
      mode: 'repeated_mistakes',
      questionSource: 'repeated_mistakes',
    };
  }
  if (task?.taskType === 'revision_task') {
    return {
      mode: 'revision',
      questionSource: 'questions',
    };
  }
  return {
    mode: 'normal_practice',
    questionSource: 'questions',
  };
}

function getQuestionCount(task, fallbackCount) {
  const explicit = Number(fallbackCount || task?.questionCount || task?.questionsCount || task?.totalQuestions || 0);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 25;
}

function isMentorQuizLaunchableTask(task) {
  if (!task) return false;
  if (NON_QUIZ_TASK_TYPES.has(task.taskType)) return false;
  if (task.reason === 'recent_mistakes' || task.ctaRoute === '/history/mistakes') return true;
  return QUIZ_LAUNCHABLE_TASK_TYPES.has(task.taskType);
}

function resolveMentorQuizLaunchContext(task, options = {}) {
  if (!isMentorQuizLaunchableTask(task)) {
    return {
      ok: false,
      error: 'This mentor task does not launch a quiz.',
      reason: 'NON_QUIZ_TASK',
    };
  }

  const subject = resolveSubject(task);
  if (!subject) {
    return {
      ok: false,
      error: 'Mentor task is missing a subject, so quiz cannot start safely.',
      reason: 'MISSING_SUBJECT',
    };
  }

  const topic = resolveTopic(task, subject);
  if (!topic) {
    return {
      ok: false,
      error: 'Mentor task is missing a topic, so quiz cannot start safely.',
      reason: 'MISSING_TOPIC',
    };
  }

  const { mode, questionSource } = resolveMode(task);
  const planId = clean(task.planId || options.planId || '');
  const taskId = clean(task.taskId || '');
  const collection = clean(task.collection || task.sourceCollection || options.collection || 'PYQ');
  const questionCount = getQuestionCount(task, options.questionCount);

  return {
    ok: true,
    source: 'mentor',
    taskId,
    planId,
    subject,
    topic,
    mode,
    questionSource,
    questionCount,
    collection,
    locked: true,
    returnUrl: options.returnUrl || '/mentor',
  };
}

module.exports = {
  QUIZ_LAUNCHABLE_TASK_TYPES,
  NON_QUIZ_TASK_TYPES,
  isMentorQuizLaunchableTask,
  resolveMentorQuizLaunchContext,
};
