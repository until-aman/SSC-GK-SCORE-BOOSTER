import { getQuestionsForSubject, getSheetsClient, VALID_SUBJECTS } from '@/lib/sheets';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const COLLECTIONS = ['general', 'PYQ', 'Parmar'];

export function buildHeaderIndex(headers = []) {
  return headers.reduce((index, header, position) => {
    const key = String(header || '').trim();
    if (key) index[key] = position;
    return index;
  }, {});
}

export function getCell(row, headerIndex, names, fallback = '') {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const position = headerIndex[name];
    if (typeof position === 'number' && row[position] !== undefined) return row[position];
  }
  return fallback;
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toBool(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function truncateText(value, length = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

export function shuffle(items = []) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function readSheet(tabName) {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:ZZ`,
  });
  const values = response.data.values || [];
  const headers = values[0] || [];
  const headerIndex = buildHeaderIndex(headers);
  const rows = values.slice(1);
  return { sheets, headers, headerIndex, rows };
}

export function normalizeSessionRow(row, headerIndex) {
  const questionCount = toNumber(getCell(row, headerIndex, 'QuestionCount'));
  const correct = toNumber(getCell(row, headerIndex, 'Correct'));
  const incorrect = toNumber(getCell(row, headerIndex, 'Incorrect'));
  const skipped = toNumber(getCell(row, headerIndex, 'Skipped'));
  const accuracy = toNumber(getCell(row, headerIndex, 'Accuracy'), questionCount ? (correct / questionCount) * 100 : 0);
  const quizMode = String(getCell(row, headerIndex, 'QuizMode', 'normal') || 'normal');

  return {
    sessionId: String(getCell(row, headerIndex, 'SessionId') || ''),
    userId: String(getCell(row, headerIndex, 'UserId') || ''),
    userEmail: String(getCell(row, headerIndex, 'UserEmail') || ''),
    userName: String(getCell(row, headerIndex, 'UserName') || ''),
    startedAt: String(getCell(row, headerIndex, 'StartedAt') || ''),
    completedAt: String(getCell(row, headerIndex, 'CompletedAt') || ''),
    subject: String(getCell(row, headerIndex, 'Subject') || 'Quiz'),
    topic: String(getCell(row, headerIndex, 'Topic') || 'Mixed'),
    sourceCollection: String(getCell(row, headerIndex, 'SourceCollection') || 'general'),
    quizMode,
    questionCount,
    correct,
    incorrect,
    skipped,
    score: toNumber(getCell(row, headerIndex, 'Score')),
    accuracy: Math.round(accuracy),
    timeSpentSeconds: toNumber(getCell(row, headerIndex, 'TimeSpentSeconds')),
    coinsEarned: toNumber(getCell(row, headerIndex, ['CoinsEarned', 'XPEarned', 'XP'])),
    completionStatus: String(getCell(row, headerIndex, 'CompletionStatus') || ''),
    isDailyChallenge: toBool(getCell(row, headerIndex, 'IsDailyChallenge')),
    parentSessionId: String(getCell(row, headerIndex, 'ParentSessionId') || ''),
    isRetry: toBool(getCell(row, headerIndex, 'IsRetry')),
    attemptNumber: toNumber(getCell(row, headerIndex, 'AttemptNumber'), 1),
    questionIdsList: String(getCell(row, headerIndex, 'QuestionIdsList') || ''),
    answersSummaryJSON: String(getCell(row, headerIndex, 'AnswersSummaryJSON') || ''),
  };
}

export function getSessionBadge(session) {
  const skippedPct = session.questionCount ? (session.skipped / session.questionCount) * 100 : 0;
  const mode = String(session.quizMode || '').toLowerCase();
  if (skippedPct > 20) return { label: 'Many Skipped', tone: 'blue' };
  if (session.accuracy < 50) return { label: 'Weak Attempt', tone: 'red' };
  if (session.accuracy < 75) return { label: 'Needs Revision', tone: 'amber' };
  if (mode.includes('reattempt')) return { label: 'Re-attempt', tone: 'orange' };
  if (mode === 'daily_challenge' || mode === 'dailychallenge' || session.isDailyChallenge) return { label: 'Daily Challenge', tone: 'purple' };
  return { label: 'Strong', tone: 'green' };
}

export function parseAnswersSummary(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function splitQuestionIds(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export async function getUserSessions(email) {
  const { headerIndex, rows } = await readSheet('QuizSessions');
  return rows
    .map(row => normalizeSessionRow(row, headerIndex))
    .filter(row => row.userEmail === email || row.userId === email)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
    .map(session => ({ ...session, badge: getSessionBadge(session).label, badgeTone: getSessionBadge(session).tone }));
}

export function normalizeAttemptRow(row, headerIndex) {
  return {
    attemptAnswerId: String(getCell(row, headerIndex, 'AttemptAnswerId') || ''),
    sessionId: String(getCell(row, headerIndex, 'SessionId') || ''),
    userId: String(getCell(row, headerIndex, 'UserId') || ''),
    userEmail: String(getCell(row, headerIndex, 'UserEmail') || ''),
    attemptedAt: String(getCell(row, headerIndex, 'AttemptedAt') || ''),
    subject: String(getCell(row, headerIndex, 'Subject') || ''),
    topic: String(getCell(row, headerIndex, 'Topic') || ''),
    questionId: String(getCell(row, headerIndex, 'QuestionId') || ''),
    sourceCollection: String(getCell(row, headerIndex, 'SourceCollection') || 'general'),
    userAnswer: String(getCell(row, headerIndex, 'UserAnswer') || ''),
    correctAnswer: String(getCell(row, headerIndex, 'CorrectAnswer') || ''),
    isCorrect: toBool(getCell(row, headerIndex, 'IsCorrect')),
    isSkipped: toBool(getCell(row, headerIndex, 'IsSkipped')),
    timeTakenSeconds: toNumber(getCell(row, headerIndex, 'TimeTakenSeconds')),
    quizMode: String(getCell(row, headerIndex, 'QuizMode') || ''),
  };
}

export async function getUserAttemptAnswers(email) {
  const { headerIndex, rows } = await readSheet('AttemptAnswers');
  return rows
    .map(row => normalizeAttemptRow(row, headerIndex))
    .filter(row => row.userEmail === email || row.userId === email);
}

export function getStatsByQuestion(attempts) {
  const stats = {};
  attempts.forEach(attempt => {
    if (!attempt.questionId) return;
    if (!stats[attempt.questionId]) {
      stats[attempt.questionId] = {
        questionId: attempt.questionId,
        subject: attempt.subject,
        topic: attempt.topic,
        sourceCollection: attempt.sourceCollection || 'general',
        correctCount: 0,
        wrongCount: 0,
        skippedCount: 0,
        totalAttempts: 0,
      };
    }
    stats[attempt.questionId].totalAttempts += 1;
    if (attempt.isSkipped) stats[attempt.questionId].skippedCount += 1;
    else if (attempt.isCorrect) stats[attempt.questionId].correctCount += 1;
    else stats[attempt.questionId].wrongCount += 1;
  });
  return stats;
}

export function getMasteryLabel(stats = {}) {
  const correctCount = toNumber(stats.correctCount);
  const wrongCount = toNumber(stats.wrongCount);
  const skippedCount = toNumber(stats.skippedCount);
  const totalAttempts = toNumber(stats.totalAttempts, correctCount + wrongCount + skippedCount);
  if (wrongCount >= 2) return { label: 'Repeated Mistake', tone: 'red' };
  if (skippedCount >= 2) return { label: 'Often Skipped', tone: 'amber' };
  if (correctCount >= 2 && wrongCount === 0 && skippedCount === 0) return { label: 'Mastered', tone: 'green' };
  if (correctCount > 0 && wrongCount > 0) return { label: 'Improving', tone: 'blue' };
  if (correctCount === 0 && (wrongCount > 0 || skippedCount > 0)) return { label: 'Needs Revision', tone: 'orange' };
  if (totalAttempts === 1) return { label: 'First Attempt', tone: 'grey' };
  return { label: 'First Attempt', tone: 'grey' };
}

export function normalizeSavedRow(row, headerIndex) {
  return {
    savedQuestionId: String(getCell(row, headerIndex, ['SavedQuestionId', 'Id']) || ''),
    email: String(getCell(row, headerIndex, ['UserEmail', 'Email'], row[0] || '') || ''),
    questionId: String(getCell(row, headerIndex, 'QuestionId', row[1] || '') || ''),
    subject: String(getCell(row, headerIndex, 'Subject', row[2] || '') || ''),
    topic: String(getCell(row, headerIndex, 'Topic', row[3] || '') || ''),
    question: String(getCell(row, headerIndex, 'Question', row[4] || '') || ''),
    optionA: String(getCell(row, headerIndex, 'OptionA', row[5] || '') || ''),
    optionB: String(getCell(row, headerIndex, 'OptionB', row[6] || '') || ''),
    optionC: String(getCell(row, headerIndex, 'OptionC', row[7] || '') || ''),
    optionD: String(getCell(row, headerIndex, 'OptionD', row[8] || '') || ''),
    correctOption: String(getCell(row, headerIndex, 'CorrectOption', row[9] || '') || ''),
    explanation: String(getCell(row, headerIndex, 'Explanation', row[10] || '') || ''),
    savedAt: String(getCell(row, headerIndex, ['SavedAt', 'CreatedAt'], row[11] || '') || ''),
    status: String(getCell(row, headerIndex, 'Status') || 'active'),
  };
}

export async function getUserSavedQuestions(email) {
  const { headerIndex, rows } = await readSheet('SavedQuestions');
  return rows
    .map(row => normalizeSavedRow(row, headerIndex))
    .filter(row => row.email === email && row.status.toLowerCase() !== 'removed')
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}

function questionToMapEntries(question) {
  const keys = [question.questionId, question.id].filter(Boolean).map(String);
  return keys.map(key => [key, {
    id: question.questionId || question.id,
    questionId: question.questionId || question.id,
    subject: question.subject,
    topic: question.topic,
    question: question.question,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctOption: question.correctOption,
    explanation: question.explanation || '',
  }]);
}

export async function getQuestionMapByIds(questionIds, hints = []) {
  const wanted = new Set(questionIds.map(String).filter(Boolean));
  const map = {};
  if (!wanted.size) return map;

  const hintedGroups = new Map();
  hints.forEach(hint => {
    const subject = hint.subject && VALID_SUBJECTS.includes(hint.subject) ? hint.subject : null;
    if (!subject) return;
    const collection = hint.sourceCollection || hint.collection || 'general';
    const key = `${collection}:${subject}`;
    if (!hintedGroups.has(key)) hintedGroups.set(key, { collection, subject });
  });

  const groups = hintedGroups.size
    ? [...hintedGroups.values()]
    : COLLECTIONS.flatMap(collection => VALID_SUBJECTS.map(subject => ({ collection, subject })));

  for (const group of groups) {
    if (Object.keys(map).length >= wanted.size) break;
    const questions = await getQuestionsForSubject(group.subject, group.collection).catch(() => []);
    questions.forEach(question => {
      questionToMapEntries(question).forEach(([key, value]) => {
        if (wanted.has(key)) map[key] = value;
      });
    });
  }

  if (Object.keys(map).length < wanted.size && hintedGroups.size) {
    for (const collection of COLLECTIONS) {
      for (const subject of VALID_SUBJECTS) {
        if (Object.keys(map).length >= wanted.size) break;
        const key = `${collection}:${subject}`;
        if (hintedGroups.has(key)) continue;
        const questions = await getQuestionsForSubject(subject, collection).catch(() => []);
        questions.forEach(question => {
          questionToMapEntries(question).forEach(([questionKey, value]) => {
            if (wanted.has(questionKey)) map[questionKey] = value;
          });
        });
      }
    }
  }

  return map;
}
