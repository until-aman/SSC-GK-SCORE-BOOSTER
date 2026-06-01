const { google } = require('googleapis');

// ─── Cache store ─────────────────────────────────────────────────────
const cache = {};

// TTL constants (milliseconds) — single place to tune all cache durations
const CACHE_TTL = {
  QUESTIONS:          10 * 60 * 1000,  // 10 min — questions rarely change mid-day
  USER_ROWS:           2 * 60 * 1000,  // 2 min  — users update on every quiz
  LEADERBOARD_MEMORY: 30 * 1000,       // 30 sec — in-memory layer on top of Sheets cache
  SAVED_IDS:          30 * 1000,       // 30 sec — bookmark state needs to feel current
  SCORE_HISTORY:       2 * 60 * 1000,  // 2 min  — history doesn't need real-time
};

/**
 * Generic TTL-aware cache read.
 * @param {string} key
 * @param {Function} fetchFn  — async function that returns fresh data
 * @param {number}  ttl       — milliseconds
 */
async function cachedRead(key, fetchFn, ttl = CACHE_TTL.QUESTIONS) {
  const now = Date.now();
  if (cache[key] && (now - cache[key].timestamp) < ttl) {
    return cache[key].data;
  }
  const data = await fetchFn();
  cache[key] = { data, timestamp: now };
  return data;
}

/** Immediately invalidate a cache key (call after writes). */
function invalidateCache(key) {
  delete cache[key];
}

// ─── Auth ────────────────────────────────────────────────────────────
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

// ─── Collection prefixes + subject suffixes ──────────────────────────
const COLLECTION_PREFIX = {
  'general':  '',          // tabs named Polity, Geography, etc. (no prefix)
  'PYQ':      'Q_PYQ_',
  'Parmar':   'Q_Parmar_',
};

const SUBJECT_TO_SUFFIX = {
  'Polity':           'Polity',
  'Geography':        'Geography',
  'Ancient History':  'Ancient_History',
  'Medieval History': 'Medieval_History',
  'Modern History':   'Modern_History',
  'Economics':        'Economics',
  'Physics':          'Physics',
  'Chemistry':        'Chemistry',
  'Biology':          'Biology',
  'Current Affairs':  'Current_Affairs',
  'Static GK':        'Static_GK',
};

const VALID_SUBJECTS = Object.keys(SUBJECT_TO_SUFFIX);

function getTabName(collection, subject) {
  const prefix = COLLECTION_PREFIX[collection] || COLLECTION_PREFIX['general'];
  const suffix = SUBJECT_TO_SUFFIX[subject];
  if (!suffix) return null;
  return prefix + suffix;
}

// ─── Validation ──────────────────────────────────────────────────────
function isValidRow(row) {
  if (!row || row.length < 9) return false;
  const [, subject, topic, question, optA, optB, optC, optD, correctInput] = row;
  if (!subject || !topic || !question || !optA || !optB || !optC || !optD || !correctInput) return false;
  if (!VALID_SUBJECTS.includes(subject)) return false;
  const normalizedInput = correctInput.trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(normalizedInput)) return true;
  const options = [optA, optB, optC, optD].map(o => String(o).trim().toLowerCase());
  return options.includes(String(correctInput).trim().toLowerCase());
}

function rowToQuestion(row) {
  const [id, subject, topic, question, optionA, optionB, optionC, optionD, correctInput, explanation] = row;
  let correctOption = correctInput.trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
    const options = [optionA, optionB, optionC, optionD].map(o => String(o).trim().toLowerCase());
    const matchIndex = options.indexOf(String(correctInput).trim().toLowerCase());
    if (matchIndex !== -1) correctOption = ['A', 'B', 'C', 'D'][matchIndex];
  }
  const sheetQuestionId = String(getHeaderCell(row, row.__headerIndex || {}, 'QuestionId') || '').trim();
  const fallbackQuestionId = `TEMP_${String(subject || 'Question').replace(/\s+/g, '_')}_${row.__sheetRowNumber || ''}`;
  return {
    id: id || '',
    questionId: sheetQuestionId || fallbackQuestionId,
    subject,
    topic,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation: explanation || '',
  };
}

function getHeaderIndex(headers) {
  return (headers || []).reduce((index, header, position) => {
    const key = String(header || '').trim();
    if (key) index[key] = position;
    return index;
  }, {});
}

function getHeaderCell(row, headerIndex, headerName) {
  const position = headerIndex[headerName];
  return typeof position === 'number' ? row[position] : undefined;
}

function isQuestionRowAvailable(row, headerIndex) {
  const rawIsActive = getHeaderCell(row, headerIndex, 'IsActive');
  if (String(rawIsActive ?? 'TRUE').trim().toLowerCase() === 'false') {
    return false;
  }

  const rawQualityStatus = getHeaderCell(row, headerIndex, 'QualityStatus');
  return String(rawQualityStatus ?? 'approved').trim().toLowerCase() === 'approved';
}

function attachQuestionRowMeta(row, headerIndex, sheetRowNumber) {
  const copy = [...row];
  Object.defineProperty(copy, '__headerIndex', {
    value: headerIndex,
    enumerable: false,
  });
  Object.defineProperty(copy, '__sheetRowNumber', {
    value: sheetRowNumber,
    enumerable: false,
  });
  return copy;
}

function columnToLetter(columnNumber) {
  let letter = '';
  let n = columnNumber;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter || 'A';
}

function setRowValueByHeader(row, headerIndex, headerNames, value) {
  const names = Array.isArray(headerNames) ? headerNames : [headerNames];
  const headerName = names.find(name => typeof headerIndex[name] === 'number');
  if (!headerName) return;
  row[headerIndex[headerName]] = value;
}

// ─── Read questions for a specific tab (cached per tab name) ─────────
async function readQuestionsForTab(tabName) {
  if (!tabName) return [];
  return cachedRead(`questions:${tabName}`, async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${tabName}!A:Z`,
    });
    const [headers, ...rows] = res.data.values || [];
    const headerIndex = getHeaderIndex(headers);
    return rows
      .map((row, index) => attachQuestionRowMeta(row, headerIndex, index + 2))
      .filter(row => isQuestionRowAvailable(row, headerIndex));
  }, CACHE_TTL.QUESTIONS);
}

// ─── Exported: Get topics grouped by subject ─────────────────────────
async function getTopicsBySubject(subjectFilter, collection = 'general') {
  if (subjectFilter === 'Mixed') return { Mixed: ['Mixed'] };
  const subjects = subjectFilter ? [subjectFilter] : VALID_SUBJECTS;
  const result = {};
  for (const subject of subjects) {
    const tabName = getTabName(collection, subject);
    if (!tabName) continue;
    const rows = await readQuestionsForTab(tabName);
    rows.forEach(row => {
      if (!isValidRow(row)) return;
      const [, subj, topic] = row;
      if (!result[subj]) result[subj] = {};
      if (!result[subj][topic]) result[subj][topic] = 0;
      result[subj][topic]++;
    });
  }
  return result;
}

// ─── Mixed: shuffle questions from all subjects in a collection ──────
async function getMixedQuestions(collection) {
  const allSubjects = Object.keys(SUBJECT_TO_SUFFIX);
  const tabNames = allSubjects.map(s => getTabName(collection, s)).filter(Boolean);

  // Fetch all tabs in parallel — avoids 11 sequential Sheets API round-trips
  const results = await Promise.all(
    tabNames.map(tab => readQuestionsForTab(tab).catch(() => []))
  );
  const allRows = results.flat();

  // Fisher-Yates shuffle
  for (let i = allRows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allRows[i], allRows[j]] = [allRows[j], allRows[i]];
  }
  return allRows.filter(row => isValidRow(row)).map(rowToQuestion);
}

// ─── Exported: Get all valid questions for subject + topic ───────────
async function getQuestions(subject, topic, collection = 'general') {
  if (subject === 'Mixed') return getMixedQuestions(collection);
  const tabName = getTabName(collection, subject);
  if (!tabName) return [];
  const rows = await readQuestionsForTab(tabName);
  const valid = rows.filter(row => isValidRow(row)).map(rowToQuestion);
  if (topic === 'All') {
    // Shuffle all questions for this subject (Fisher-Yates), same as Mixed mode
    for (let i = valid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [valid[i], valid[j]] = [valid[j], valid[i]];
    }
    return valid;
  }
  return valid.filter(q => q.topic === topic);
}

async function getQuestionsForSubject(subject, collection = 'general') {
  if (subject === 'Mixed') return getMixedQuestions(collection);

  const tabName = getTabName(collection, subject);
  if (!tabName) return [];

  const rows = await readQuestionsForTab(tabName);
  return rows
    .filter(row => isValidRow(row))
    .map(rowToQuestion);
}

// ─── Score writes ─────────────────────────────────────────────────────

async function appendScore({ timestamp, email, name, image, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A:K',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, image]] },
  });
}

async function getScoresHeaderIndex(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!1:1',
  });
  const headers = (res.data.values || [[]])[0] || [];
  return { headers, headerIndex: getHeaderIndex(headers) };
}

async function hasDuplicateScore(duplicateCheckKey) {
  if (!duplicateCheckKey) return false;

  const sheets = await getSheetsClient();
  const { headerIndex } = await getScoresHeaderIndex(sheets);
  const duplicateColumn = headerIndex.DuplicateCheckKey;
  if (typeof duplicateColumn !== 'number') return false;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A:ZZ',
  });
  const rows = (res.data.values || []).slice(1);
  return rows.slice(-100).some(row => String(row[duplicateColumn] || '') === duplicateCheckKey);
}

async function appendScoreV2({
  timestamp,
  email,
  name,
  correctAnswers,
  incorrectAnswers,
  skipped,
  totalQuestions,
  rawScore,
  subject,
  topic,
  sessionId,
  coins,
  isDailyChallenge = 'FALSE',
  streakMilestoneBonus = 0,
  totalCoins = 0,
  clientSessionId = '',
  duplicateCheckKey = '',
  quizMode = 'normal',
  sourceCollection = '',
  startedAt = '',
  completedAt = '',
  timeSpentSeconds = 0,
  serverSavedAt = '',
  scoreVersion = 'v1',
}) {
  const sheets = await getSheetsClient();
  const { headers, headerIndex } = await getScoresHeaderIndex(sheets);

  if (!headers.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Scores!A:O',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, sessionId, coins, isDailyChallenge, streakMilestoneBonus, totalCoins]],
      },
    });
    invalidateCache(`scoreHistory:${email}`);
    return;
  }

  const row = new Array(headers.length).fill('');
  setRowValueByHeader(row, headerIndex, ['timestamp', 'Timestamp'], timestamp);
  setRowValueByHeader(row, headerIndex, ['email', 'Email'], email);
  setRowValueByHeader(row, headerIndex, ['name', 'Name'], name);
  setRowValueByHeader(row, headerIndex, ['correctAnswers', 'CorrectAnswers'], correctAnswers);
  setRowValueByHeader(row, headerIndex, ['incorrectAnswers', 'IncorrectAnswers'], incorrectAnswers);
  setRowValueByHeader(row, headerIndex, ['skipped', 'Skipped'], skipped);
  setRowValueByHeader(row, headerIndex, ['totalQuestions', 'TotalQuestions'], totalQuestions);
  setRowValueByHeader(row, headerIndex, ['rawScore', 'RawScore'], rawScore);
  setRowValueByHeader(row, headerIndex, ['subject', 'Subject'], subject);
  setRowValueByHeader(row, headerIndex, ['topic', 'Topic'], topic);
  setRowValueByHeader(row, headerIndex, ['sessionId'], sessionId);
  setRowValueByHeader(row, headerIndex, ['xp' + 'Earned'], coins);
  setRowValueByHeader(row, headerIndex, ['isDailyChallenge'], isDailyChallenge);
  setRowValueByHeader(row, headerIndex, ['streakMilestoneBonus'], streakMilestoneBonus);
  setRowValueByHeader(row, headerIndex, ['total' + 'X' + 'P'], totalCoins);

  setRowValueByHeader(row, headerIndex, 'SessionId', sessionId);
  setRowValueByHeader(row, headerIndex, 'ClientSessionId', clientSessionId);
  setRowValueByHeader(row, headerIndex, 'DuplicateCheckKey', duplicateCheckKey);
  setRowValueByHeader(row, headerIndex, 'QuizMode', quizMode);
  setRowValueByHeader(row, headerIndex, 'SourceCollection', sourceCollection);
  setRowValueByHeader(row, headerIndex, 'StartedAt', startedAt);
  setRowValueByHeader(row, headerIndex, 'CompletedAt', completedAt);
  setRowValueByHeader(row, headerIndex, 'TimeSpentSeconds', timeSpentSeconds);
  setRowValueByHeader(row, headerIndex, 'ServerSavedAt', serverSavedAt);
  setRowValueByHeader(row, headerIndex, 'ScoreVersion', scoreVersion);

  const endColumn = columnToLetter(Math.max(row.length, 1));
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Scores!A:${endColumn}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  // Score history cache is now stale for this user
  invalidateCache(`scoreHistory:${email}`);
}

// ─── Leaderboard data (used only for leaderboard compute, not score.js) ─
async function getLeaderboardData() {
  const sheets = await getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const mainRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Scores!A2:O' });
  const mainRows = mainRes.data.values || [];
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const parmarTabExists = meta.data.sheets.some(s => s.properties.title === SHEET_NAMES.PARMAR_SCORES);
    if (parmarTabExists) {
      const parmarRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAMES.PARMAR_SCORES}!A2:M` });
      return [...mainRows, ...(parmarRes.data.values || [])];
    }
  } catch (_) {}
  return mainRows;
}

// ─── Daily Challenge helpers ──────────────────────────────────────────

function splitDailyQuestionIds(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map(id => id.trim())
    .filter(Boolean);
}

function uniqueQuestionIds(ids) {
  return [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))];
}

async function getDailyChallengeEntry(dateStr) {
  return cachedRead(`dailyChallenge:${dateStr}`, async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Daily_Challenge!A2:G',
    });
    const rows = res.data.values || [];
    const activeRows = rows.filter(r => r[0] === dateStr && String(r[5] || '').toLowerCase() === 'active');
    if (!activeRows.length) return null;

    const compactRows = activeRows.filter(r => splitDailyQuestionIds(r[2]).length > 1);
    if (compactRows.length) {
      const row = compactRows[compactRows.length - 1];
      const questionIds = uniqueQuestionIds(splitDailyQuestionIds(row[2]));
      return {
        date: row[0],
        challengeId: row[1],
        questionIds,
        totalQuestions: Number(row[3]) || questionIds.length,
        coinReward: Number(row[4]) || 50,
        status: row[5],
        layout: 'compact',
      };
    }

    const oldRows = [...activeRows].sort((a, b) => (Number(a[3]) || 0) - (Number(b[3]) || 0));
    const questionIds = uniqueQuestionIds(oldRows.map(r => r[2]));
    return {
      date: dateStr,
      challengeId: oldRows[0]?.[1] || '',
      questionIds,
      totalQuestions: questionIds.length,
      coinReward: Number(oldRows[0]?.[4]) || 50,
      status: 'Active',
      layout: 'legacy',
    };
  }, 24 * 60 * 60 * 1000); // 24-hour TTL
}

async function writeDailyChallengeRows(rows) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Daily_Challenge!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
  rows.forEach(row => invalidateCache(`dailyChallenge:${row[0]}`));
}

async function writeDailyChallengeEntry({ date, challengeId, questionIds, totalQuestions, coinReward, status = 'Active' }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Daily_Challenge!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        date,
        challengeId,
        questionIds.join(','),
        totalQuestions || questionIds.length,
        coinReward,
        status,
      ]],
    },
  });
  invalidateCache(`dailyChallenge:${date}`);
}

// ─── Users tab helpers (NOW CACHED) ─────────────────────────────────

async function getUserRows() {
  return cachedRead('userRows', async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Users!A2:ZZ',
    });
    return res.data.values || [];
  }, CACHE_TTL.USER_ROWS);
}

async function getUsersHeaderIndex(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Users!1:1',
  });
  const headers = (res.data.values || [[]])[0] || [];
  return { headers, headerIndex: getHeaderIndex(headers) };
}

function generateUserId() {
  return `USER_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function applyDefaultUserFields(row, headerIndex) {
  setRowValueByHeader(row, headerIndex, 'UserId', generateUserId());
  setRowValueByHeader(row, headerIndex, 'lastActiveAt', '');
  setRowValueByHeader(row, headerIndex, 'totalQuizzes', 0);
  setRowValueByHeader(row, headerIndex, 'totalQuestionsAttempted', 0);
  setRowValueByHeader(row, headerIndex, 'totalCorrect', 0);
  setRowValueByHeader(row, headerIndex, 'totalIncorrect', 0);
  setRowValueByHeader(row, headerIndex, 'totalSkipped', 0);
  setRowValueByHeader(row, headerIndex, 'lifetimeScore', 0);
  setRowValueByHeader(row, headerIndex, 'premiumStatus', 'free');
}

async function appendUserRow(rowData) {
  const sheets = await getSheetsClient();
  const { headers, headerIndex } = await getUsersHeaderIndex(sheets);
  const row = headers.length > rowData.length ? new Array(headers.length).fill('') : [...rowData];
  rowData.forEach((value, index) => { row[index] = value; });
  applyDefaultUserFields(row, headerIndex);
  const endColumn = columnToLetter(Math.max(row.length, 12));
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Users!A:${endColumn}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  invalidateCache('userRows'); // new user added — invalidate
}

async function updateUserCells(rowIndex, { streakCount, lastAttemptDate, streakShieldUsed, totalCoins, level }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Users!C${rowIndex}:G${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[String(streakCount), lastAttemptDate, String(streakShieldUsed).toUpperCase(), String(totalCoins), level]],
    },
  });
  invalidateCache('userRows'); // user data changed — invalidate
}

// ─── LeaderboardCache tab helpers ────────────────────────────────────

function getNumericCell(row, headerIndex, headerName) {
  const value = getHeaderCell(row, headerIndex, headerName);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function updateUserAggregateStats(rowIndex, {
  completedAt,
  totalQuestions,
  correctAnswers,
  incorrectAnswers,
  skipped,
  rawScore,
} = {}) {
  try {
    const sheets = await getSheetsClient();
    const { headerIndex } = await getUsersHeaderIndex(sheets);
    const requiredHeaders = [
      'UserId',
      'lastActiveAt',
      'totalQuizzes',
      'totalQuestionsAttempted',
      'totalCorrect',
      'totalIncorrect',
      'totalSkipped',
      'lifetimeScore',
      'premiumStatus',
    ];
    const missingHeaders = requiredHeaders.filter(header => typeof headerIndex[header] !== 'number');
    if (missingHeaders.length) {
      console.warn('[Users] Skipping aggregate stats update; missing columns:', missingHeaders.join(', '));
      return;
    }

    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Users!A${rowIndex}:ZZ${rowIndex}`,
    });
    const row = (rowRes.data.values || [[]])[0] || [];
    const valuesByHeader = {
      lastActiveAt: completedAt || new Date().toISOString(),
      totalQuizzes: getNumericCell(row, headerIndex, 'totalQuizzes') + 1,
      totalQuestionsAttempted: getNumericCell(row, headerIndex, 'totalQuestionsAttempted') + (Number(totalQuestions) || 0),
      totalCorrect: getNumericCell(row, headerIndex, 'totalCorrect') + (Number(correctAnswers) || 0),
      totalIncorrect: getNumericCell(row, headerIndex, 'totalIncorrect') + (Number(incorrectAnswers) || 0),
      totalSkipped: getNumericCell(row, headerIndex, 'totalSkipped') + (Number(skipped) || 0),
      lifetimeScore: getNumericCell(row, headerIndex, 'lifetimeScore') + (Number(rawScore) || 0),
      premiumStatus: getHeaderCell(row, headerIndex, 'premiumStatus') || 'free',
    };

    if (!getHeaderCell(row, headerIndex, 'UserId')) {
      valuesByHeader.UserId = generateUserId();
    }

    const data = Object.entries(valuesByHeader).map(([headerName, value]) => {
      const column = columnToLetter(headerIndex[headerName] + 1);
      return { range: `Users!${column}${rowIndex}`, values: [[value]] };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });
    invalidateCache('userRows');
  } catch (err) {
    console.warn('[Users] Aggregate stats update skipped:', err.message);
  }
}

async function getLeaderboardCacheRow() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'LeaderboardCache!A2:C2',
  });
  const row = (res.data.values || [[]])[0] || [];
  return { cachedAt: row[0] || '', weeklyJSON: row[1] || '', allTimeJSON: row[2] || '' };
}

async function updateLeaderboardCacheRow(cachedAt, weeklyJSON, allTimeJSON) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'LeaderboardCache!A2:C2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[cachedAt, weeklyJSON, allTimeJSON]] },
  });
}

// ─── Feedback write ───────────────────────────────────────────────────

async function saveFeedback(data) {
  const sheets = await getSheetsClient();
  const { name, email, feedbackPill = '', feedbackMessage = '', subject = '', topic = '' } = data;
  const timestamp = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Feedback!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[timestamp, email || 'Guest', name || 'Guest', feedbackPill, feedbackMessage, subject, topic]] },
  });
}

// ─── Sheet names ──────────────────────────────────────────────────────
const SHEET_NAMES = {
  QUESTIONS:            'Questions',           // legacy — keep as backup
  SCORES:               'Scores',
  PARMAR_SCORES:        'ParmarSeriesScores',
  USERS:                'Users',
  FEEDBACK:             'Feedback',
  LEADERBOARD_CACHE:    'LeaderboardCache',
  SERIES_NOTIFICATIONS: 'SeriesNotifications',
};

// ─── Pure user row helpers ────────────────────────────────────────────

function findUserRow(rows, email) {
  return rows.find(r => r[0] === email) || null;
}

function createDefaultUserRow(email, name, image = '') {
  return [email, name, '0', '', 'FALSE', '0', 'Aspirant', '', '', 'TRUE', new Date().toISOString(), image];
}

function parseUserRow(row) {
  return {
    email:                    row[0] || '',
    name:                     row[1] || '',
    streakCount:              Number(row[2]) || 0,
    lastAttemptDate:          row[3] || '',
    streakShieldUsed:         row[4] === 'TRUE',
    totalCoins:               Number(row[5]) || 0,
    level:                    row[6] || 'Aspirant',
    badges:                   row[7] || '',
    dailyChallengeAttemptDates: row[8] || '',
    isPublicOnLeaderboard:    row[9] !== 'FALSE',
    createdAt:                row[10] || '',
    image:                    row[11] || '',
  };
}

module.exports = {
  SHEET_NAMES,
  COLLECTION_PREFIX,
  SUBJECT_TO_SUFFIX,
  VALID_SUBJECTS,
  CACHE_TTL,
  invalidateCache,
  getTabName,
  getSheetsClient,
  findUserRow,
  createDefaultUserRow,
  parseUserRow,
  getTopicsBySubject,
  getQuestions,
  getQuestionsForSubject,
  getMixedQuestions,
  appendScore,
  appendScoreV2,
  hasDuplicateScore,
  getLeaderboardData,
  saveFeedback,
  getUserRows,
  appendUserRow,
  updateUserCells,
  updateUserAggregateStats,
  getLeaderboardCacheRow,
  updateLeaderboardCacheRow,
  readQuestionsForTab,
  getDailyChallengeRows: getDailyChallengeEntry,
  getDailyChallengeEntry,
  writeDailyChallengeRows,
  writeDailyChallengeEntry,
  getMixedQuestions,
};
