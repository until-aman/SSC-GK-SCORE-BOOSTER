# SSC GK Score Booster V2 — Step 2: Backend Architecture
**Goal:** Make the backend survive 8,000 questions and heavy traffic on the Vercel + Google Sheets free tier.

---

## The Core Problem: You Will Hit Rate Limits

Google Sheets API free quota: **60 read requests/minute**.

Here is what your app does today when 100 users are active at the same time:

| User action | Current Sheets reads triggered |
|---|---|
| Dashboard load (×100 users) | 200 reads/min |
| Quiz submission (×100 users) | 100 reads/min |
| History page (×50 users) | 100 reads/min |
| **Total** | **~400 reads/min** |

That is **6.6× over the free quota**. Every user gets a 429 rate-limit error and sees a broken app. The root cause is two specific problems — and both are fixable.

**Root cause 1:** `score.js` reads the **entire Scores sheet** on every single quiz submission just to check if today has any rows for this user.

**Root cause 2:** `getUserRows()` is called in **5 different API files** with zero caching.

After this architecture is applied: the same 100 concurrent users trigger **~8–12 reads/min** — safely within quota.

---

## Architecture Overview: 4 Changes

| Change | What it fixes | Complexity |
|---|---|---|
| **1. Split Questions into per-subject tabs** | 8,000-row monolith → 10 tabs of ~800 rows each | Medium |
| **2. Add per-TTL caching to sheets.js** | Every uncached read becomes a cache hit after first call | Low |
| **3. Eliminate `getLeaderboardData()` from score.js** | Removes the most expensive uncached read from the hot path | Low |
| **4. Cache invalidation on writes** | Ensures cache stays consistent when data is updated | Low |

---

## Change 1: Split Questions into Per-Subject Tabs

### Why

Currently `readAllQuestions()` fetches all 8,000 rows every 5 minutes. Each fetch is one API call that downloads ~2–8 MB of data. When the cache expires and 10 users simultaneously start quizzes on different subjects, all 10 trigger a full re-fetch.

With per-subject tabs, each tab is ~800 rows. The cache is per-subject. A Polity quiz load caches only Polity questions. A History load caches only History. 10 subjects can be cached with 10 reads, each 10× lighter.

### New Sheet Tab Names (exact, case-sensitive)

Create these 10 tabs in your Google Sheet. **Names must match exactly** — the code uses these strings directly.

```
Q_Polity
Q_Geography
Q_Economics
Q_Ancient_History
Q_Medieval_History
Q_Modern_History
Q_Physics
Q_Chemistry
Q_Biology
Q_Current_Affairs
```

### Column Structure (same for all 10 tabs)

Row 1 is the header row:

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H | Col I | Col J |
|---|---|---|---|---|---|---|---|---|---|
| ID | Subject | Topic | Question | OptionA | OptionB | OptionC | OptionD | CorrectOption | Explanation |

This is identical to the existing `Questions` tab. Educators just use the right tab for their subject.

### Migration Script

Run this **once** to migrate your existing Questions data into the new tabs. Do not delete the original `Questions` tab until you've verified the migration.

**File: `scripts/migrate-to-subject-tabs.js`**

```js
// Run with: node scripts/migrate-to-subject-tabs.js
// Requires GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY in environment
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SUBJECT_TO_TAB = {
  'Polity':           'Q_Polity',
  'Geography':        'Q_Geography',
  'Economics':        'Q_Economics',
  'Ancient History':  'Q_Ancient_History',
  'Medieval History': 'Q_Medieval_History',
  'Modern History':   'Q_Modern_History',
  'Physics':          'Q_Physics',
  'Chemistry':        'Q_Chemistry',
  'Biology':          'Q_Biology',
  'Current Affairs':  'Q_Current_Affairs',
};

const HEADERS = [['ID','Subject','Topic','Question','OptionA','OptionB','OptionC','OptionD','CorrectOption','Explanation']];

async function migrate() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // 1. Read all rows from existing Questions tab
  console.log('Reading Questions tab...');
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Questions!A2:J' });
  const allRows = res.data.values || [];
  console.log(`Found ${allRows.length} rows`);

  // 2. Group by subject
  const bySubject = {};
  allRows.forEach(row => {
    const subject = row[1];
    if (!subject || !SUBJECT_TO_TAB[subject]) {
      console.warn(`Skipping row with unknown subject: "${subject}"`);
      return;
    }
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(row);
  });

  // 3. Get existing sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTabs = meta.data.sheets.map(s => s.properties.title);

  // 4. For each subject, create tab if needed, then write rows
  for (const [subject, rows] of Object.entries(bySubject)) {
    const tabName = SUBJECT_TO_TAB[subject];
    console.log(`\nProcessing ${subject} → ${tabName} (${rows.length} rows)`);

    // Create tab if it doesn't exist
    if (!existingTabs.includes(tabName)) {
      console.log(`  Creating tab: ${tabName}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
      });
      // Write header
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: HEADERS },
      });
    }

    // Write rows (append — safe if tab was just created)
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!A2:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    console.log(`  ✅ Written ${rows.length} rows to ${tabName}`);

    // Avoid hitting write quota
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Migration complete. Verify data in each tab before deleting Questions tab.');
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
```

Run it:
```bash
node scripts/migrate-to-subject-tabs.js
```

---

## Change 2: Replace sheets.js with Optimized Version

This is the most important file change. The new version:
- Adds a TTL parameter to `cachedRead` so different data types have appropriate TTLs
- Changes question reads to use per-subject tabs instead of one giant tab
- Adds caching to `getUserRows()` — currently called 5× with zero caching
- Adds cache invalidation to all write functions so cached data never goes stale after a write

**Complete replacement for `lib/sheets.js`:**

```js
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

// ─── Subject → Tab mapping ───────────────────────────────────────────
const SUBJECT_TO_TAB = {
  'Polity':           'Q_Polity',
  'Geography':        'Q_Geography',
  'Economics':        'Q_Economics',
  'Ancient History':  'Q_Ancient_History',
  'Medieval History': 'Q_Medieval_History',
  'Modern History':   'Q_Modern_History',
  'Physics':          'Q_Physics',
  'Chemistry':        'Q_Chemistry',
  'Biology':          'Q_Biology',
  'Current Affairs':  'Q_Current_Affairs',
};

const VALID_SUBJECTS = Object.keys(SUBJECT_TO_TAB);

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

// ─── Read questions for a specific subject (cached per-subject) ──────
async function readQuestionsForSubject(subject) {
  const tab = SUBJECT_TO_TAB[subject];
  if (!tab) return [];
  return cachedRead(`questions:${subject}`, async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${tab}!A2:J`,
    });
    return res.data.values || [];
  }, CACHE_TTL.QUESTIONS);
}

// ─── Exported: Get topics grouped by subject ─────────────────────────
async function getTopicsBySubject(subjectFilter) {
  const subjects = subjectFilter ? [subjectFilter] : VALID_SUBJECTS;
  const result = {};
  for (const subject of subjects) {
    if (subjectFilter && subject !== subjectFilter) continue;
    const rows = await readQuestionsForSubject(subject);
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

// ─── Exported: Get all valid questions for subject + topic ───────────
async function getQuestions(subject, topic) {
  const rows = await readQuestionsForSubject(subject);
  return rows
    .filter(row => isValidRow(row) && row[1] === subject && row[2] === topic)
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
  SUBJECT_TO_TAB,
  VALID_SUBJECTS,
  CACHE_TTL,
  invalidateCache,
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
```

---

## Change 3: Remove getLeaderboardData() from score.js Hot Path

This is the single most impactful change. Currently, every quiz submission reads the **entire Scores sheet** just to answer the question: "Has this user already submitted a quiz today?"

The answer to that question already exists in the Users tab, column D: `lastAttemptDate`. Compare it with today's IST date. Done. Zero extra API calls.

**In `pages/api/score.js`, find and replace this block:**

OLD (lines 83–92 approximately):
```js
// Check if first quiz of day for this email
const allScoreRows = await getLeaderboardData();
const todayScoresForEmail = allScoreRows.filter(row => {
  if (!row[1] || row[1] !== email) return false;
  if (!row[0]) return false;
  try {
    return getISTDateString(new Date(row[0])) === today;
  } catch { return false; }
});
const isFirstQuizOfDay = todayScoresForEmail.length === 0;

// Read Users tab and find/create user row
const userRows = await getUserRows();
```

NEW (replace the entire block with this):
```js
// Read Users tab and find/create user row
// NOTE: getUserRows() is now cached (2-min TTL) in sheets.js
const userRows = await getUserRows();
```

Then find the line where `user` is parsed from `userRow`:
```js
const user = parseUserRow(userRow);
```

And immediately after that line, add:
```js
// isFirstQuizOfDay: compare Users tab lastAttemptDate with today.
// No extra API call needed — data is already in the user row.
const isFirstQuizOfDay = !user.lastAttemptDate || user.lastAttemptDate !== today;
```

Also remove `getLeaderboardData` from the import list at the top of score.js, since it is no longer used there:
```js
// REMOVE getLeaderboardData from this import:
import {
  appendScoreV2,
  // getLeaderboardData,   ← DELETE THIS LINE
  getUserRows,
  findUserRow,
  ...
} from '@/lib/sheets';
```

**Impact:** Removes 1 uncached full-sheet read from every single quiz submission. At 1,000 submissions/day, this saves 1,000 API calls/day — the single largest quota saving in the entire app.

---

## Change 4: Add Server-Side Cache to saved-questions/ids.js

Every time a logged-in user starts a quiz, the app calls `/api/saved-questions/ids` to know which questions are already bookmarked. This reads the entire SavedQuestions sheet (all users, all questions) and filters in JS. No cache.

**Replace `pages/api/saved-questions/ids.js` with this:**

```js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, CACHE_TTL } from '@/lib/sheets';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Server-side in-memory cache: email → { savedIds: [], ts: number }
const savedIdsCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;

  // Check in-memory cache (30 sec TTL)
  const cached = savedIdsCache.get(email);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL.SAVED_IDS) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ savedIds: cached.savedIds });
  }

  try {
    const sheets = await getSheetsClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B`,
    });
    const rows = result.data.values || [];
    const savedIds = rows
      .filter(r => r[0] === email)
      .map(r => r[1])
      .filter(Boolean);

    // Store in cache
    savedIdsCache.set(email, { savedIds, ts: Date.now() });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ savedIds });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch saved IDs' });
  }
}

// Export cache invalidation for use by POST/DELETE handlers
export function invalidateSavedIdsCache(email) {
  savedIdsCache.delete(email);
}
```

Also update `pages/api/saved-questions.js` to invalidate this cache after POST and DELETE:

At the top of saved-questions.js, add:
```js
import { invalidateSavedIdsCache } from './saved-questions/ids';
```

In the POST handler, after the successful append, add:
```js
invalidateSavedIdsCache(email);
```

In the DELETE handler, after the successful batchUpdate, add:
```js
invalidateSavedIdsCache(email);
```

---

## Change 5: Add In-Memory Cache Layer to leaderboard.js

The leaderboard already uses a Sheets-based cache (LeaderboardCache tab). But checking that cache requires a Sheets API call itself. Add a 30-second in-memory layer so the Sheets cache tab is only read once every 30 seconds, not on every leaderboard page load.

**In `pages/api/leaderboard.js`, add at the top of the file (outside the handler):**

```js
// In-memory leaderboard cache (30 sec) — sits in front of Sheets-based cache
// Resets on cold start, which is fine — prevents hammering on warm instances
let memCache = { data: null, ts: 0 };
const MEM_CACHE_TTL = 30 * 1000;
```

**Inside the handler, as the first thing after the method check:**

```js
// Check in-memory cache first (avoids even the LeaderboardCache tab read)
const scope = req.query.scope === 'all' ? 'all' : 'weekly';
const preview = req.query.preview === 'true';
const nowMs = Date.now();

if (memCache.data && (nowMs - memCache.ts) < MEM_CACHE_TTL) {
  const fullList = scope === 'all' ? memCache.data.allTimeLeaders : memCache.data.weeklyLeaders;
  const leaders = preview ? fullList.slice(0, 3) : fullList;
  const session = await getServerSession(req, res, authOptions);
  const currentUser = session ? fullList.find(u => u.email === session.user.email) || null : null;
  return res.status(200).json({ scope, leaders, currentUser });
}
```

**At the point where leaders are computed (just before the return statement), populate the memory cache:**

```js
// Populate in-memory cache for next 30 seconds
memCache = { data: { weeklyLeaders, allTimeLeaders }, ts: Date.now() };
```

**Also invalidate the memory cache in score.js after every submission.** In `pages/api/score.js`, the line that clears the Sheets-based leaderboard cache:
```js
updateLeaderboardCacheRow('', '', '').catch(() => {});
```
This already works. The in-memory cache will naturally expire after 30 seconds — no change needed there.

---

## Change 6: Add Cache to score-history.js

The history page calls `getLeaderboardData()` on every load — the entire Scores sheet, uncached.

**Replace `pages/api/score-history.js` with this:**

```js
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getLeaderboardData, getUserRows, findUserRow, parseUserRow, CACHE_TTL } from '@/lib/sheets';

// Per-user history cache
const historyCache = new Map();

const MILESTONE_LABEL_MAP = {
  15:  '3-Day Streak Bonus',
  30:  '1-Week Streak Bonus',
  50:  '2-Week Streak Bonus',
  100: '1-Month Streak Bonus',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;

  // Check cache (2-min TTL)
  const cached = historyCache.get(email);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL.SCORE_HISTORY) {
    return res.status(200).json(cached.data);
  }

  try {
    const allRows = await getLeaderboardData();
    const userScoreRows = allRows
      .filter(row => row[1] === email)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 20);

    const sessions = [];
    userScoreRows.forEach(row => {
      const milestoneBonus = Number(row[13]) || 0;
      sessions.push({
        type: 'quiz',
        timestamp: row[0] || '',
        subject: row[8] || '',
        topic: row[9] || '',
        correctAnswers: Number(row[3]) || 0,
        totalQuestions: Number(row[6]) || 0,
        rawScore: parseFloat(row[7]) || 0,
        xpEarned: Number(row[11]) || 0,
        accuracy: Number(row[6]) > 0
          ? Math.round((Number(row[3]) / Number(row[6])) * 1000) / 10
          : 0,
      });
      if (milestoneBonus > 0) {
        sessions.push({
          type: 'milestone',
          timestamp: row[0] || '',
          xpEarned: milestoneBonus,
          milestoneLabel: MILESTONE_LABEL_MAP[milestoneBonus] || `${milestoneBonus} XP Streak Bonus`,
        });
      }
    });

    const allUserRows = await getUserRows();
    const userRow = findUserRow(allUserRows, email);
    const user = userRow ? parseUserRow(userRow) : { totalXP: 0, level: 'Aspirant' };

    const responseData = { sessions, totalXP: user.totalXP, level: user.level };

    // Cache the result
    historyCache.set(email, { data: responseData, ts: Date.now() });

    return res.status(200).json(responseData);
  } catch (err) {
    console.error('[score-history] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load score history' });
  }
}
```

---

## Summary: API Calls Before vs After

| User Action | Before | After |
|---|---|---|
| Dashboard load | 3–5 reads | 0–2 reads (cache hits after first load) |
| Quiz start (warm cache) | 1 read (questions) + 1 read (savedIds) | 0 reads (both cached) |
| Quiz start (cold cache) | 1 read | 1 read (per-subject, 10× smaller payload) |
| Quiz submission | 2 reads + 3 writes | **0 reads** + 2 writes + 1 cache invalidate |
| History page | 2 reads | 0 reads (cached) |
| Leaderboard page | 1–3 reads | 0–1 reads (memory cache + Sheets cache) |
| **100 concurrent users** | **~400 reads/min (6.6× over quota)** | **~8–12 reads/min (safe)** |

---

## Implementation Order for Claude Code

Give these to Claude Code **one at a time**, in this exact order. Do not combine them.

**Instruction 1 — Migration script:**
> Create the file `scripts/migrate-to-subject-tabs.js` with exactly the migration code in Step 2 spec, Change 1. Do not modify any other file.

**Instruction 2 — Replace sheets.js:**
> Replace the entire contents of `lib/sheets.js` with the new version in Step 2 spec, Change 2. Do not modify any other file.

**Instruction 3 — Fix score.js hot path:**
> In `pages/api/score.js`: (1) Remove `getLeaderboardData` from the import. (2) Remove the entire block that calls `getLeaderboardData()` and filters for `todayScoresForEmail`. (3) After the `const user = parseUserRow(userRow)` line, add `const isFirstQuizOfDay = !user.lastAttemptDate || user.lastAttemptDate !== today;`. Exact instructions are in Step 2 spec, Change 3.

**Instruction 4 — Cache saved IDs:**
> Replace `pages/api/saved-questions/ids.js` with the new version in Step 2 spec, Change 4. Then add `invalidateSavedIdsCache(email)` in the POST and DELETE handlers in `pages/api/saved-questions.js` as described.

**Instruction 5 — Cache leaderboard in memory:**
> Add the in-memory leaderboard cache to `pages/api/leaderboard.js` exactly as described in Step 2 spec, Change 5.

**Instruction 6 — Cache score history:**
> Replace `pages/api/score-history.js` with the new version in Step 2 spec, Change 6.

**Instruction 7 — Run migration (you do this manually, not Claude Code):**
> Run `node scripts/migrate-to-subject-tabs.js` in your terminal. Verify all 10 subject tabs are created in your Google Sheet with correct data. Then do a test quiz on each subject to confirm questions load. After 1 week of stable operation, you may delete the original Questions tab.

---

## What You Must Do in Google Sheets Manually

Before running the migration script, the Google Sheets steps you handle yourself:

1. Keep the original `Questions` tab as-is (backup).
2. After `migrate-to-subject-tabs.js` runs, verify each new tab has the right rows.
3. Educators: tell them to add new questions to their subject tab (`Q_Polity`, `Q_History` etc.), not to the old `Questions` tab.
4. The `LeaderboardCache`, `Scores`, `Users`, `Feedback`, `SavedQuestions` tabs stay exactly as-is — no changes needed.

---

*Step 2 complete. This spec covers every failing point in the backend. Step 3 is targeted code fixes using the audit from Step 1.*
