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
 * Append a score row to the Scores sheet.
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
 * Read all score rows (NOT cached — leaderboard must be fresh).
 * @returns {Array<Array<string>>}
 */
async function getLeaderboardData() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'Scores!A2:K',
  });
  return res.data.values || [];
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

module.exports = {
  getTopicsBySubject,
  getQuestions,
  appendScore,
  getLeaderboardData,
  saveFeedback,
};
