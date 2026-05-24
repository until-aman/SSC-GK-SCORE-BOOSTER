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
  'CGL2025':  'Q_CGL2025_',
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
  return { id: id || '', subject, topic, question, optionA, optionB, optionC, optionD, correctOption, explanation: explanation || '' };
}

// ─── Read questions for a specific tab (cached per tab name) ─────────
async function readQuestionsForTab(tabName) {
  if (!tabName) return [];
  return cachedRead(`questions:${tabName}`, async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${tabName}!A2:J`,
    });
    return res.data.values || [];
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
  return rows.filter(row => isValidRow(row)).map(rowToQuestion).filter(q => q.topic === topic);
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

async function appendScoreV2({ timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, sessionId, xpEarned, isDailyChallenge = 'FALSE', streakMilestoneBonus = 0, totalXP = 0 }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A:O',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, sessionId, xpEarned, isDailyChallenge, streakMilestoneBonus, totalXP]],
    },
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

async function getDailyChallengeRows(dateStr) {
  return cachedRead(`dailyChallenge:${dateStr}`, async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Daily_Challenge!A2:G',
    });
    const rows = res.data.values || [];
    return rows.filter(r => r[0] === dateStr && r[5] === 'Active');
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
}

// ─── Users tab helpers (NOW CACHED) ─────────────────────────────────

async function getUserRows() {
  return cachedRead('userRows', async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Users!A2:L',
    });
    return res.data.values || [];
  }, CACHE_TTL.USER_ROWS);
}

async function appendUserRow(rowData) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Users!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
  invalidateCache('userRows'); // new user added — invalidate
}

async function updateUserCells(rowIndex, { streakCount, lastAttemptDate, streakShieldUsed, totalXP, level }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Users!C${rowIndex}:G${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[String(streakCount), lastAttemptDate, String(streakShieldUsed).toUpperCase(), String(totalXP), level]],
    },
  });
  invalidateCache('userRows'); // user data changed — invalidate
}

// ─── LeaderboardCache tab helpers ────────────────────────────────────

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
  const { name, email, feedback, subject, topic } = data;
  const timestamp = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Feedback!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[timestamp, email || 'Guest', name || 'Guest', feedback, subject, topic]] },
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
    totalXP:                  Number(row[5]) || 0,
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
  getMixedQuestions,
  appendScore,
  appendScoreV2,
  getLeaderboardData,
  saveFeedback,
  getUserRows,
  appendUserRow,
  updateUserCells,
  getLeaderboardCacheRow,
  updateLeaderboardCacheRow,
  readQuestionsForTab,
  getDailyChallengeRows,
  writeDailyChallengeRows,
  getMixedQuestions,
};
