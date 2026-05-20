const { google } = require('googleapis');

// ─── In-memory cache ─────────────────────────────────────────────────
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function cachedRead(key, fetchFn) {
  const now = Date.now();
  if (cache[key] && (now - cache[key].timestamp) < CACHE_TTL) {
    return cache[key].data;
  }
  const data = await fetchFn();
  cache[key] = { data, timestamp: now };
  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  // The private_key field contains literal \n — replace with actual newlines
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

// ─── Validation ──────────────────────────────────────────────────────
const VALID_SUBJECTS = [
  'Polity', 'Geography', 'Economics', 'History',
  'Physics', 'Chemistry', 'Biology', 'Current Affairs',
];

function isValidRow(row) {
  // Columns: A=ID, B=Subject, C=Topic, D=Question, E=OptionA, F=OptionB, G=OptionC, H=OptionD, I=CorrectOption, J=Explanation
  if (!row || row.length < 9) return false;
  const [, subject, topic, question, optA, optB, optC, optD, correctInput] = row;
  if (!subject || !topic || !question || !optA || !optB || !optC || !optD || !correctInput) return false;
  if (!VALID_SUBJECTS.includes(subject)) return false;

  const normalizedInput = correctInput.trim().toUpperCase();
  // Check if it's already a letter
  if (['A', 'B', 'C', 'D'].includes(normalizedInput)) return true;

  // Otherwise, check if the text matches any option text exactly
  const options = [optA, optB, optC, optD].map(o => String(o).trim().toLowerCase());
  const inputLower = String(correctInput).trim().toLowerCase();
  if (options.includes(inputLower)) return true;

  return false;
}

function rowToQuestion(row) {
  const [id, subject, topic, question, optionA, optionB, optionC, optionD, correctInput, explanation] = row;
  
  let correctOption = correctInput.trim().toUpperCase();
  
  // If not a letter, find which option matches the text
  if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
    const options = [optionA, optionB, optionC, optionD].map(o => String(o).trim().toLowerCase());
    const inputLower = String(correctInput).trim().toLowerCase();
    const matchIndex = options.indexOf(inputLower);
    if (matchIndex !== -1) {
      correctOption = ['A', 'B', 'C', 'D'][matchIndex];
    }
  }

  return {
    id: id || '',
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

// ─── Read all question rows (cached) ────────────────────────────────
async function readAllQuestions() {
  return cachedRead('allQuestions', async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Questions!A2:J',
    });
    return res.data.values || [];
  });
}

// ─── Exported functions ──────────────────────────────────────────────

/**
 * Get topics grouped by subject, with question counts.
 * @param {string} [subjectFilter] — optional, filter to a single subject
 * @returns {{ [subject: string]: { [topic: string]: number } }}
 */
async function getTopicsBySubject(subjectFilter) {
  const rows = await readAllQuestions();
  const result = {};

  rows.forEach(row => {
    if (!isValidRow(row)) return;
    const [, subject, topic] = row;
    if (subjectFilter && subject !== subjectFilter) return;

    if (!result[subject]) result[subject] = {};
    if (!result[subject][topic]) result[subject][topic] = 0;
    result[subject][topic]++;
  });

  return result;
}

/**
 * Get all valid questions for a given subject + topic.
 * @param {string} subject
 * @param {string} topic
 * @returns {Array<Object>}
 */
async function getQuestions(subject, topic) {
  const rows = await readAllQuestions();
  return rows
    .filter(row => isValidRow(row) && row[1] === subject && row[2] === topic)
    .map(rowToQuestion);
}

/**
 * Append a score row to the Scores sheet (V1 compat — kept for reference).
 */
async function appendScore({ timestamp, email, name, image, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A:K',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, image]],
    },
  });
}

/**
 * Append a V2 score row (13 columns) to the Scores sheet.
 */
async function appendScoreV2({ timestamp, email, name, correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic, sessionId, xpEarned, isDailyChallenge = 'FALSE' }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A:M',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        timestamp, email, name,
        correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore,
        subject, topic, sessionId, xpEarned, isDailyChallenge,
      ]],
    },
  });
}

/**
 * Read all score rows (NOT cached — leaderboard must be fresh).
 * @returns {Array<Array<string>>}
 */
async function getLeaderboardData() {
  const sheets = await getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // Always read main Scores tab
  const mainRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Scores!A2:M',
  });
  const mainRows = mainRes.data.values || [];

  // Also read ParmarSeriesScores if the tab exists (same column schema)
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const parmarTabExists = meta.data.sheets.some(
      s => s.properties.title === SHEET_NAMES.PARMAR_SCORES
    );
    if (parmarTabExists) {
      const parmarRes = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${SHEET_NAMES.PARMAR_SCORES}!A2:M`,
      });
      return [...mainRows, ...(parmarRes.data.values || [])];
    }
  } catch (_) {
    // ParmarSeriesScores not yet created — fall through
  }

  return mainRows;
}

// ─── Users sheet helpers ─────────────────────────────────────────────

async function getUserRows() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Users!A2:L',   // col L = image URL
  });
  return res.data.values || [];
}

async function appendUserRow(rowData) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Users!A:L',    // col L = image URL
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
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
}

// ─── LeaderboardCache helpers ────────────────────────────────────────

async function getLeaderboardCacheRow() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'LeaderboardCache!A2:C2',
  });
  const row = (res.data.values || [[]])[0] || [];
  return {
    cachedAt: row[0] || '',
    weeklyJSON: row[1] || '',
    allTimeJSON: row[2] || '',
  };
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

/**
 * Save user feedback.
 */
async function saveFeedback(data) {
  const sheets = await getSheetsClient();
  const { name, email, feedback, subject, topic } = data;
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Feedback!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[timestamp, email || 'Guest', name || 'Guest', feedback, subject, topic]],
    },
  });
}

// ─── SHEET_NAMES constant ────────────────────────────────────────────
const SHEET_NAMES = {
  QUESTIONS: 'Questions',
  SCORES: 'Scores',
  PARMAR_SCORES: 'ParmarSeriesScores',   // Future: Parmar SSC series quiz scores
  USERS: 'Users',
  FEEDBACK: 'Feedback',
  LEADERBOARD_CACHE: 'LeaderboardCache',
  SERIES_NOTIFICATIONS: 'SeriesNotifications',
};

// ─── Pure Users row helpers (no IO) ─────────────────────────────────

function findUserRow(rows, email) {
  return rows.find((r) => r[0] === email) || null;
}

function createDefaultUserRow(email, name, image = '') {
  return [
    email,
    name,
    '0',
    '',
    'FALSE',
    '0',
    'Aspirant',
    '',
    '',
    'TRUE',
    new Date().toISOString(),
    image,           // col L — Google profile photo URL
  ];
}

function parseUserRow(row) {
  return {
    email: row[0] || '',
    name: row[1] || '',
    streakCount: Number(row[2]) || 0,
    lastAttemptDate: row[3] || '',
    streakShieldUsed: row[4] === 'TRUE',
    totalXP: Number(row[5]) || 0,
    level: row[6] || 'Aspirant',
    badges: row[7] || '',
    dailyChallengeAttemptDates: row[8] || '',
    isPublicOnLeaderboard: row[9] !== 'FALSE',
    createdAt: row[10] || '',
    image: row[11] || '',  // col L — Google profile photo URL
  };
}

module.exports = {
  SHEET_NAMES,
  getSheetsClient,
  findUserRow,
  createDefaultUserRow,
  parseUserRow,
  getTopicsBySubject,
  getQuestions,
  appendScore,
  appendScoreV2,
  getLeaderboardData,
  saveFeedback,
  getUserRows,
  appendUserRow,
  updateUserCells,
  getLeaderboardCacheRow,
  updateLeaderboardCacheRow,
};
