# PRD — SSC GK Score Booster V2
**Version:** 2.0  
**Author:** Aman Antil  
**Stack:** Next.js 14 (Pages Router) · Tailwind CSS · Google Sheets API · NextAuth.js v4 · Gemini 1.5 Flash · Vercel (free Hobby tier)  
**Infrastructure cost target:** $0/month  
**Implementation target:** AI coding assistant must be able to execute this PRD top-to-bottom with zero clarifying questions from the author.

---

## 0. How to Read This PRD

Every section is written so a code-generation AI (Claude Code, Cursor, etc.) can implement it **without asking any follow-up questions**. When a decision could go multiple ways, the choice is stated and the reasoning is given so the AI does not guess. Sections are ordered by dependency: data model → APIs → pages → components → styles. Implement in that order.

---

## 1. Scope of V2 (What Changes, What Stays)

### 1.1 What is new in V2
| # | Change | Scope |
|---|---|---|
| 1 | New auth/landing page (`/`) with Google + Guest CTAs | New page |
| 2 | New dashboard page (`/dashboard`) — replaces old home screen quiz-setup | New page |
| 3 | Quiz setup moved from home to dashboard | Page restructure |
| 4 | XP (experience points) system | New logic + new Sheets tab |
| 5 | Daily streak system (IST timezone) | New logic inside existing `/api/score` |
| 6 | Levels (Aspirant → Scholar → Expert → Champion → Legend) | New logic |
| 7 | Leaderboard split: **This Week** + **All Time** tabs | New logic + new Sheets tab |
| 8 | LeaderboardCache sheet to avoid recomputing on every request | New Sheets tab |
| 9 | Users sheet to store per-user XP, level, streak | New Sheets tab |
| 10 | Bottom navigation bar on all post-auth pages | New component |
| 11 | XP toast on result page | New component |
| 12 | `subject` and `topic` columns added to Scores sheet writes | Schema change |

### 1.2 What does NOT change in V2
- Quiz core logic (timer 20s, +2/−0.5/0 marking, one question at a time, no back button)
- Questions sheet schema (no new required columns)
- AI mentor logic (Gemini explanations for wrong answers, summary on result page)
- Guest mode (full quiz, no score save, not on leaderboard)
- WhatsApp/Telegram share on result page
- Detailed analysis page
- NextAuth.js Google OAuth setup
- Vercel deployment process

---

## 2. Google Sheets: Complete Data Model

The app uses **one Google Spreadsheet** with multiple tabs (sheets). The Spreadsheet ID is stored in the environment variable `GOOGLE_SHEETS_ID`.

### 2.1 `Questions` sheet (existing — minimal changes)

**Do not rename or reorder existing columns.** Only add optional columns at the end.

| Column index | Column name | Type | Required? | Notes |
|---|---|---|---|---|
| A (0) | `ID` | string | Yes | Unique per question, e.g. `POL-001` |
| B (1) | `Subject` | string | Yes | One of: Polity, Geography, Economics, History, Physics, Chemistry, Biology, Current Affairs |
| C (2) | `Topic` | string | Yes | Free text, e.g. "Fundamental Rights" |
| D (3) | `Question` | string | Yes | Full question text |
| E (4) | `OptionA` | string | Yes | |
| F (5) | `OptionB` | string | Yes | |
| G (6) | `OptionC` | string | Yes | |
| H (7) | `OptionD` | string | Yes | |
| I (8) | `CorrectOption` | string | Yes | Exactly one of: A, B, C, D (uppercase) |
| J (9) | `Explanation` | string | No | Used as fallback when AI fails |
| K (10) | `active` | string | No | If present: use only rows where value is exactly `TRUE`. If blank or missing: treat as active. |
| L (11) | `sourceVideoURL` | string | No | Parmar SSC YouTube URL (optional; ignored by quiz logic) |

**Filtering rule (implemented in `/api/questions`):** Include a row if and only if:
- Columns A–I are all non-empty.
- `CorrectOption` is exactly one of `A`, `B`, `C`, `D`.
- Column K (`active`) is either blank/missing OR equals the string `TRUE`.

### 2.2 `Scores` sheet (existing — add 5 new columns)

Row 1 is the header row. Do not move or rename existing columns. Append new columns at the end.

| Column index | Column name | Type | Notes |
|---|---|---|---|
| A (0) | `timestamp` | ISO string | e.g. `2026-05-19T14:30:00.000Z` |
| B (1) | `email` | string | From session |
| C (2) | `name` | string | From session |
| D (3) | `correctAnswers` | number | |
| E (4) | `incorrectAnswers` | number | |
| F (5) | `skipped` | number | |
| G (6) | `totalQuestions` | number | |
| H (7) | `rawScore` | number | Decimal, e.g. `19.5` |
| I (8) | `subject` | string | **NEW in V2** — e.g. `Polity` |
| J (9) | `topic` | string | **NEW in V2** — e.g. `Fundamental Rights` |
| K (10) | `sessionId` | string | **NEW in V2** — UUID generated client-side |
| L (11) | `xpEarned` | number | **NEW in V2** — XP awarded for this quiz session |
| M (12) | `isDailyChallenge` | string | **NEW in V2** — always write `FALSE` in V2 |

**Migration note for existing rows:** Existing rows written before V2 will have columns I–M empty. The leaderboard computation must handle rows with empty columns I–M gracefully (treat `xpEarned` as 0, treat `subject`/`topic` as unknown).

**How to add the new column headers:** Manually open the `Scores` sheet in Google Sheets and type the header names `subject`, `topic`, `sessionId`, `xpEarned`, `isDailyChallenge` in cells I1 through M1. Do this before deploying V2.

### 2.3 `Users` sheet (NEW — create this tab)

Create a new tab named exactly `Users`. Row 1 is the header row. Each subsequent row is one registered user (one row per email address; upserted on first login).

| Column index | Column name | Type | Default on creation | Notes |
|---|---|---|---|---|
| A (0) | `email` | string | (from session) | Primary key; unique per row |
| B (1) | `name` | string | (from session) | Display name |
| C (2) | `streakCount` | number | `0` | Current streak in days |
| D (3) | `lastAttemptDate` | string | `""` | Date in IST format `YYYY-MM-DD`, e.g. `2026-05-19` |
| E (4) | `streakShieldUsed` | string | `FALSE` | Reserved for V3; always write `FALSE` in V2 |
| F (5) | `totalXP` | number | `0` | Cumulative XP across all sessions |
| G (6) | `level` | string | `Aspirant` | Recomputed on every XP update |
| H (7) | `badges` | string | `""` | Reserved for V3; write empty string |
| I (8) | `dailyChallengeAttemptDates` | string | `""` | Reserved for V3; write empty string |
| J (9) | `isPublicOnLeaderboard` | string | `TRUE` | If `FALSE`, exclude from leaderboard |
| K (10) | `createdAt` | string | ISO timestamp | Set once on row creation, never updated |

**Upsert logic:** When a logged-in user hits any authenticated API for the first time, check if their `email` exists in column A of `Users`. If not found, create a new row with defaults. If found, read existing values.

### 2.4 `LeaderboardCache` sheet (NEW — create this tab)

Create a new tab named exactly `LeaderboardCache`. This sheet always has exactly **2 rows**: row 1 is the header, row 2 is the cache.

| Column index | Column name | Type | Notes |
|---|---|---|---|
| A (0) | `cachedAt` | ISO string | Timestamp when cache was last written |
| B (1) | `weeklyJSON` | string | JSON array of leaderboard entries for "This Week" scope |
| C (2) | `allTimeJSON` | string | JSON array of leaderboard entries for "All Time" scope |

Row 2 must be pre-created manually with empty strings in all 3 cells before first deploy. The API will overwrite row 2 on cache miss.

**Cache TTL:** 5 minutes. If `cachedAt` is empty or `(now - cachedAt) > 300,000 ms`, recompute both `weeklyJSON` and `allTimeJSON` and overwrite row 2. Always recompute both scopes together in one write to minimize API calls.

---

## 3. Gamification Rules (Immutable for V2)

### 3.1 XP Formula

XP is computed **server-side only** inside `/api/score`. The frontend never computes or displays XP before receiving the API response.

```
baseXP = (totalQuestions >= 5) ? 10 : 0        // completion bonus
correctXP = correctAnswers * 2                  // per-correct reward
firstQuizBonus = isFirstQuizOfDay ? 10 : 0      // daily first-quiz bonus
dailyChallengeBonus = 0                         // always 0 in V2
xpEarned = baseXP + correctXP + firstQuizBonus + dailyChallengeBonus
```

`isFirstQuizOfDay` is `true` if the user has **zero** rows in the `Scores` sheet for today's IST date (determined before this write).

Minimum XP per qualifying quiz (≥5 questions, 0 correct, not first of day): **10 XP**  
Maximum XP per quiz (25 questions, all correct, first of day): `10 + 50 + 10 = 70 XP`

### 3.2 Level Thresholds

| Level name | XP range |
|---|---|
| Aspirant | 0 – 199 |
| Scholar | 200 – 599 |
| Expert | 600 – 1499 |
| Champion | 1500 – 2999 |
| Legend | 3000+ |

Level is recomputed after every XP update using this function (implement server-side):

```javascript
function computeLevel(totalXP) {
  if (totalXP >= 3000) return "Legend";
  if (totalXP >= 1500) return "Champion";
  if (totalXP >= 600)  return "Expert";
  if (totalXP >= 200)  return "Scholar";
  return "Aspirant";
}
```

### 3.3 Daily Streak Logic

All date comparisons use **IST (UTC+5:30)**.

```javascript
function getISTDateString(date = new Date()) {
  // Returns YYYY-MM-DD in IST
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
```

Streak algorithm (runs inside `/api/score`, after XP is computed, before writing to Scores):

```
today = getISTDateString(now)
Read streakCount and lastAttemptDate from Users row

if lastAttemptDate === "" or lastAttemptDate is null:
  streakCount = 1

else if lastAttemptDate === today:
  streakCount = streakCount  // no change (already played today)

else:
  yesterday = getISTDateString(new Date(now - 86400000))
  if lastAttemptDate === yesterday:
    streakCount = streakCount + 1
  else:
    streakCount = 1  // streak broken
    streakShieldUsed = FALSE  // reset shield

lastAttemptDate = today
```

After algorithm: write `streakCount`, `lastAttemptDate`, and `streakShieldUsed` back to the Users row along with `totalXP` and `level` in **one batch write** to minimize API calls.

---

## 4. File & Directory Structure

Only list files that are **created new** or **modified** in V2. Everything else is untouched.

```
/pages
  index.js                  ← REPLACE: was quiz setup home; now becomes auth/landing page
  dashboard.js              ← NEW: dashboard with streak, XP, quiz setup
  quiz.js                   ← MODIFY: read sessionId, subject, topic from query; minor UI changes
  result.js                 ← MODIFY: call /api/score for logged-in users; show XP toast
  leaderboard.js            ← MODIFY: add This Week / All Time tabs; remove old podium if present
  /api
    user-profile.js         ← NEW
    score.js                ← MODIFY: add XP, streak, new Scores columns
    leaderboard.js          ← MODIFY: add scope param, cache logic
    topics.js               ← NO CHANGE (already exists)
    questions.js            ← NO CHANGE (already exists; apply active filter if not already)
    /ai
      explain.js            ← NO CHANGE
      tip.js                ← NO CHANGE
      summary.js            ← NO CHANGE

/components
  BottomNav.js              ← NEW
  XPToast.js                ← NEW
  LeaderboardTable.js       ← NEW (extracted from leaderboard page for reuse)
  StreakBadge.js            ← NEW
  LevelBadge.js             ← NEW

/lib
  sheets.js                 ← MODIFY: add helpers for Users sheet and LeaderboardCache sheet
  streak.js                 ← NEW: getISTDateString and computeStreak helpers
  xp.js                     ← NEW: computeXP and computeLevel helpers
```

---

## 5. Environment Variables

The following environment variables must exist in Vercel dashboard and in `.env.local` (never committed to git). The AI implementing this must not hardcode any of these values.

| Variable name | What it holds | Example format |
|---|---|---|
| `GOOGLE_SHEETS_ID` | The spreadsheet ID from the Google Sheets URL | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email from Google Cloud Console | `sheets-bot@project-id.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service account private key (with `\n` line breaks) | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `NEXTAUTH_SECRET` | Random 32+ char string for session signing | `openssl rand -base64 32` output |
| `NEXTAUTH_URL` | Full production URL | `https://ssc-gk-score-booster.vercel.app` |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `GOCSPX-...` |
| `GEMINI_API_KEY` | Gemini API key from Google AI Studio | `AIzaSy...` |

---

## 6. Shared Utility Functions (`/lib/`)

### 6.1 `/lib/streak.js`

```javascript
// Returns YYYY-MM-DD string in IST for a given Date (defaults to now)
export function getISTDateString(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// Returns yesterday's YYYY-MM-DD string in IST
export function getISTYesterday(date = new Date()) {
  return getISTDateString(new Date(date.getTime() - 24 * 60 * 60 * 1000));
}

// Computes new streak values given current state and today's IST date string
export function computeStreak({ streakCount, lastAttemptDate, today, yesterday }) {
  if (!lastAttemptDate || lastAttemptDate === "") {
    return { streakCount: 1, streakShieldUsed: false };
  }
  if (lastAttemptDate === today) {
    return { streakCount: Number(streakCount), streakShieldUsed: false };
  }
  if (lastAttemptDate === yesterday) {
    return { streakCount: Number(streakCount) + 1, streakShieldUsed: false };
  }
  // streak broken
  return { streakCount: 1, streakShieldUsed: false };
}
```

### 6.2 `/lib/xp.js`

```javascript
export function computeLevel(totalXP) {
  const xp = Number(totalXP) || 0;
  if (xp >= 3000) return "Legend";
  if (xp >= 1500) return "Champion";
  if (xp >= 600)  return "Expert";
  if (xp >= 200)  return "Scholar";
  return "Aspirant";
}

// XP earned per quiz — called after confirming isFirstQuizOfDay
export function computeXPEarned({ correctAnswers, totalQuestions, isFirstQuizOfDay }) {
  const base = totalQuestions >= 5 ? 10 : 0;
  const correctXP = Number(correctAnswers) * 2;
  const firstBonus = isFirstQuizOfDay ? 10 : 0;
  return base + correctXP + firstBonus;
}
```

### 6.3 `/lib/sheets.js` additions

Add these helper functions to the existing `sheets.js` file. Do not remove or rename existing functions.

```javascript
// Tab name constants — must match actual sheet tab names exactly
export const SHEET_NAMES = {
  QUESTIONS: "Questions",
  SCORES: "Scores",
  USERS: "Users",
  FEEDBACK: "Feedback",
  LEADERBOARD_CACHE: "LeaderboardCache",
};

// ---- Users sheet helpers ----

// Returns the Users row for a given email, or null if not found.
// rows = array of arrays (from sheets.getRows(SHEET_NAMES.USERS))
export function findUserRow(rows, email) {
  return rows.find((r) => r[0] === email) || null;
}

// Creates default values for a new Users row
export function createDefaultUserRow(email, name) {
  return [
    email,           // A: email
    name,            // B: name
    "0",             // C: streakCount
    "",              // D: lastAttemptDate
    "FALSE",         // E: streakShieldUsed
    "0",             // F: totalXP
    "Aspirant",      // G: level
    "",              // H: badges
    "",              // I: dailyChallengeAttemptDates
    "TRUE",          // J: isPublicOnLeaderboard
    new Date().toISOString(), // K: createdAt
  ];
}

// Parses a Users row array into a typed object
export function parseUserRow(row) {
  return {
    email: row[0] || "",
    name: row[1] || "",
    streakCount: Number(row[2]) || 0,
    lastAttemptDate: row[3] || "",
    streakShieldUsed: row[4] === "TRUE",
    totalXP: Number(row[5]) || 0,
    level: row[6] || "Aspirant",
    badges: row[7] || "",
    dailyChallengeAttemptDates: row[8] || "",
    isPublicOnLeaderboard: row[9] !== "FALSE", // default true
    createdAt: row[10] || "",
  };
}
```

---

## 7. API Specifications (Complete)

### 7.1 `GET /api/user-profile`

**Purpose:** Called by `/dashboard` on page load for logged-in users to get XP, level, streak.

**Authentication:** Required. Returns `401` if no session.

**Request:** No body. No query params.

**Logic (step by step):**
1. Get session via `getServerSession(req, res, authOptions)`.
2. If no session → return `401 { error: "Unauthorized" }`.
3. Call Google Sheets API: read all rows from `Users` tab.
4. Find row where `row[0] === session.user.email`.
5. If not found:
   a. Create new row using `createDefaultUserRow(email, name)`.
   b. Append row to `Users` sheet.
   c. Parse the newly created row.
6. If found: parse it with `parseUserRow`.
7. Return `200` with JSON body:

```json
{
  "email": "user@example.com",
  "name": "Aman",
  "totalXP": 260,
  "level": "Scholar",
  "streakCount": 5,
  "lastAttemptDate": "2026-05-18",
  "createdAt": "2025-12-01T10:00:00.000Z"
}
```

**Error responses:**
- `401` — no session
- `500` — Google Sheets API failure (return `{ error: "Internal server error" }`)

---

### 7.2 `GET /api/topics?subject=SUBJECT` (no change — document for completeness)

**Purpose:** Returns topic list for a given subject, filtered by `active`.

**Authentication:** Not required.

**Query params:** `subject` (string, required).

**Logic:**
1. Read all rows from `Questions` tab.
2. Filter: `row[1] === subject` AND (`row[10]` is empty OR `row[10] === "TRUE"`).
3. Also validate rows: columns A–I must all be non-empty, `row[8]` (CorrectOption) must be one of `A`, `B`, `C`, `D`.
4. Extract unique values from `row[2]` (Topic column).
5. For each unique topic, count matching rows.
6. Return sorted alphabetically.

**Response:**
```json
{
  "topics": [
    { "name": "Fundamental Rights", "count": 42 },
    { "name": "Judiciary", "count": 18 }
  ]
}
```

---

### 7.3 `GET /api/questions?subject=S&topic=T&count=N` (no change — document for completeness)

**Purpose:** Returns randomly sampled and shuffled questions for a quiz.

**Authentication:** Not required.

**Query params:** `subject`, `topic`, `count` (all required).

**Logic:**
1. Read all rows from `Questions` tab.
2. Filter: `row[1] === subject` AND `row[2] === topic` AND valid row (see 7.2 filter rules).
3. If filtered pool has fewer rows than `count`, use all rows.
4. Randomly sample min(count, pool.length) distinct rows using Fisher-Yates or equivalent.
5. Shuffle the sampled rows.
6. Return array of question objects.

**Response:**
```json
{
  "questions": [
    {
      "id": "POL-001",
      "question": "Which article of the Indian Constitution deals with the Right to Equality?",
      "options": {
        "A": "Article 12",
        "B": "Article 14",
        "C": "Article 19",
        "D": "Article 21"
      },
      "correctOption": "B",
      "explanation": "Article 14 guarantees equality before law."
    }
  ]
}
```

**Do not** include `sourceVideoURL`, `active`, or any other non-quiz field in the response.

---

### 7.4 `POST /api/score` (existing — significant additions)

**Purpose:** Save quiz result; compute and store XP; update streak and level; return updated stats to frontend.

**Authentication:** Required. Return `401` if no session.

**Rate limiting:** In-memory Map: max 10 writes per `email` per 60-second window. On breach, return `429 { error: "Too many requests" }`. Use module-level variable:

```javascript
const rateLimitMap = new Map(); // email → { count: number, windowStart: number }
```

**Request body (JSON):**

```json
{
  "correctAnswers": 12,
  "incorrectAnswers": 5,
  "skipped": 3,
  "totalQuestions": 20,
  "rawScore": 19.5,
  "subject": "Polity",
  "topic": "Fundamental Rights",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Validation (return `400` on failure):**
- `correctAnswers`, `incorrectAnswers`, `skipped`, `totalQuestions`, `rawScore` must all be numbers, `>= 0`.
- `correctAnswers + incorrectAnswers + skipped === totalQuestions` (allow ±0.001 float tolerance).
- `subject` must be a non-empty string.
- `topic` must be a non-empty string.
- `sessionId` must be a non-empty string.
- `isDailyChallenge` is optional; if absent, treat as `false`.

**Logic (step by step):**

1. Check rate limit for `session.user.email`.
2. Validate request body as above.
3. Get `today = getISTDateString(now)`.
4. Read all rows from `Scores` tab where `row[1] === email`.
5. Check if any of those rows has a `timestamp` whose IST date equals `today`. Set `isFirstQuizOfDay = (none found)`.
6. Compute `xpEarned = computeXPEarned({ correctAnswers, totalQuestions, isFirstQuizOfDay })`.
7. Append new row to `Scores` tab:

```
[
  new Date().toISOString(),   // A: timestamp
  session.user.email,          // B: email
  session.user.name,           // C: name
  correctAnswers,              // D
  incorrectAnswers,            // E
  skipped,                     // F
  totalQuestions,              // G
  rawScore,                    // H
  subject,                     // I  ← NEW
  topic,                       // J  ← NEW
  sessionId,                   // K  ← NEW
  xpEarned,                    // L  ← NEW
  "FALSE"                      // M: isDailyChallenge ← NEW
]
```

8. Read all rows from `Users` tab. Find row for this email.
9. If not found: create default row (same as `/api/user-profile` upsert logic).
10. Parse user row → get `streakCount`, `lastAttemptDate`, `totalXP`.
11. Compute `yesterday = getISTYesterday(now)`.
12. Apply `computeStreak({ streakCount, lastAttemptDate, today, yesterday })`.
13. Compute `newTotalXP = totalXP + xpEarned`.
14. Compute `newLevel = computeLevel(newTotalXP)`.
15. Find the row index (1-based) of the user's row in `Users` tab.
16. Batch-update that row in `Users` tab. Only these columns change:
    - C: `newStreakCount`
    - D: `today` (lastAttemptDate)
    - E: `FALSE` (streakShieldUsed — always FALSE in V2)
    - F: `newTotalXP`
    - G: `newLevel`
    
    Use a batch update (single API call) rather than row-by-row writes. The range is `Users!C{rowIndex}:G{rowIndex}`.

17. Return `200`:

```json
{
  "ok": true,
  "xpEarned": 34,
  "totalXP": 298,
  "level": "Scholar",
  "streakCount": 6,
  "isFirstQuizOfDay": true
}
```

**Error responses:**
- `400` — validation failed (include descriptive `error` string)
- `401` — not authenticated
- `429` — rate limit exceeded
- `500` — Sheets failure (still show quiz results to user; frontend handles gracefully)

---

### 7.5 `GET /api/leaderboard?scope=weekly&preview=false`

**Purpose:** Returns ranked list of users for "This Week" or "All Time" scope.

**Authentication:** Optional. If session exists, response includes `currentUser` object for the logged-in user's rank.

**Query params:**

| Param | Values | Default | Notes |
|---|---|---|---|
| `scope` | `weekly`, `all` | `weekly` | |
| `preview` | `true`, `false` | `false` | If `true`, return only top 3 |

**Cache logic:**
1. Read row 2 of `LeaderboardCache` tab → get `cachedAt`, `weeklyJSON`, `allTimeJSON`.
2. If `cachedAt` is empty OR `(Date.now() - new Date(cachedAt).getTime()) > 300000` (5 minutes):
   - Recompute both scopes (see computation below).
   - Write row 2 of `LeaderboardCache` with new `cachedAt`, `weeklyJSON`, `allTimeJSON` in one batch write.
3. Parse JSON for the requested scope.

**Leaderboard computation (runs when cache is stale):**

```
// Read all Scores rows (skip header row 1)
allScoreRows = read all data from Scores tab (rows 2..end)

// For weekly: filter rows where timestamp's IST date is within last 7 days inclusive
weekStart = getISTDateString(new Date(now - 6 * 24 * 60 * 60 * 1000))
weeklyRows = allScoreRows.filter(r => getISTDateString(new Date(r[0])) >= weekStart)

// Read Users to check isPublicOnLeaderboard
allUserRows = read all data from Users tab (rows 2..end)
publicEmails = Set of emails where row[9] !== "FALSE"

For each scope (weekly uses weeklyRows, all uses allScoreRows):
  groupByEmail = {}
  for each row:
    email = row[1]
    if email not in publicEmails: skip (private user)
    name = row[2]
    rawScore = Number(row[7]) or 0
    totalQuestions = Number(row[6]) or 0
    correctAnswers = Number(row[3]) or 0

    if email not in groupByEmail:
      groupByEmail[email] = { email, name, totalScore: 0, totalQuestionsAttempted: 0, totalCorrect: 0 }
    
    groupByEmail[email].totalScore += rawScore
    groupByEmail[email].totalQuestionsAttempted += totalQuestions
    groupByEmail[email].totalCorrect += correctAnswers

  // Compute accuracy for each user
  for each user in groupByEmail:
    user.overallAccuracy = user.totalQuestionsAttempted > 0
      ? (user.totalCorrect / user.totalQuestionsAttempted) * 100
      : 0

  // Sort
  sorted = sort by:
    1. totalScore DESC
    2. overallAccuracy DESC
    3. totalQuestionsAttempted DESC

  // Assign ranks
  sorted.forEach((u, i) => u.rank = i + 1)

  // Limit to top 50 entries in cache
  result = sorted.slice(0, 50)
  
  Store result as JSON string in weeklyJSON or allTimeJSON
```

**Response construction:**

1. Parse the JSON for the requested scope.
2. If `preview=true`, slice to top 3.
3. If session exists:
   - Find session email in the **full cached array** (not the sliced one).
   - If found, include as `currentUser`.
   - If not found, set `currentUser: null`.

**Response:**
```json
{
  "scope": "weekly",
  "leaders": [
    {
      "rank": 1,
      "name": "Priya S",
      "totalScore": 360.0,
      "totalQuestionsAttempted": 180,
      "overallAccuracy": 80.0
    },
    {
      "rank": 2,
      "name": "Rajesh K",
      "totalScore": 280.5,
      "totalQuestionsAttempted": 140,
      "overallAccuracy": 75.5
    }
  ],
  "currentUser": {
    "rank": 15,
    "name": "Aman",
    "totalScore": 120.0,
    "totalQuestionsAttempted": 70,
    "overallAccuracy": 68.5
  }
}
```

If `currentUser` is not on leaderboard: `"currentUser": null`.  
If no scores exist: `"leaders": []`, `"currentUser": null`.

---

### 7.6 `POST /api/feedback` (existing — no logic change, document for completeness)

**Purpose:** Save user feedback.

**Authentication:** Optional.

**Request body:**
```json
{
  "feedback": "The Polity questions are great!",
  "attempts": 3,
  "correctAnswers": 20,
  "accuracy": 70.5,
  "selectedCategories": "Polity|History"
}
```

**Logic:** Append one row to `Feedback` tab:
```
[timestamp, email_or_"guest", feedback, attempts, correctAnswers, accuracy, selectedCategories]
```

**Response:** `200 { "ok": true }` or `500 { "error": "..." }`.

---

## 8. Page Specifications

### 8.1 `/` — Auth / Landing Page (REPLACES existing home)

**Purpose:** First page every user sees. Converts visitor to player (Google login) or guest.

**Auth redirect:** If user is already logged in (session exists), redirect immediately to `/dashboard` using `getServerSideProps`. Do not render the landing page for logged-in users.

```javascript
export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (session) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
}
```

**Design (dark theme, mobile-first, 390px base):**

Background: full-screen gradient `from-slate-900 via-slate-800 to-emerald-950`.

**Layout (top to bottom):**

1. **Logo + App name block** (centered, top 15% of screen)
   - Logo: 💡 emoji or SVG lightbulb icon, 56×56px, color `#10b981` (emerald-500)
   - App name: `SSC GK Score Booster` in `font-bold text-2xl text-white`
   - Tagline: `Practice smarter. Rank higher.` in `text-sm text-slate-400`
   - Spacing: `mt-16 mb-2` on logo, `mt-2` on tagline

2. **Social proof strip** (just below logo block)
   - Show 3 circular "user avatar" placeholders in a row (overlapping, `-space-x-2`)
   - Each circle: `w-8 h-8 rounded-full bg-emerald-800 border-2 border-slate-900 flex items-center justify-center text-xs text-white`
   - Text next to them: `text-slate-400 text-sm` — `"Join 500+ aspirants practising daily"`
   - This is static copy; no API call.

3. **Hero stats row** (3 boxes in a row, below social proof)
   - Each box: `bg-slate-800/60 rounded-xl px-4 py-3 text-center`
   - Stats (static copy):
     - `"8 Subjects"` with label `"Covered"`
     - `"1000+ Q"` with label `"Questions"`
     - `"Free"` with label `"Always"`
   - Number style: `text-lg font-bold text-emerald-400`
   - Label style: `text-xs text-slate-500`

4. **CTA buttons** (centered, below stats)
   - Primary: `"Continue with Google"` button
     - Style: `w-full max-w-xs bg-white text-slate-900 font-semibold text-base py-3 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform`
     - Icon: Google "G" SVG (standard colored logo, 20×20px) — use inline SVG, do not fetch externally
     - On click: `signIn("google", { callbackUrl: "/dashboard" })`
   - Secondary: `"Play as Guest"` button (below primary, `mt-3`)
     - Style: `w-full max-w-xs border border-slate-600 text-slate-300 font-medium text-base py-3 px-6 rounded-2xl active:scale-95 transition-transform`
     - On click: set cookie `userMode=guest; path=/; max-age=86400` then `router.push("/dashboard")`
     - Guest cookie is read by dashboard to show guest state; it is not a session.

5. **"Powered by Parmar SSC" footer** (bottom of screen)
   - Text: `"Questions sourced from Parmar SSC"`
   - Style: `text-xs text-slate-600 text-center pb-6`

**No scroll needed on this page.** Everything fits in one screen on a 390px × 844px viewport.

---

### 8.2 `/dashboard` — Main Dashboard (NEW PAGE)

**Auth handling:**
- On page load, check `session` (via `useSession()`).
- If `session` is loading: show full-screen skeleton (3 rounded rectangles, pulsing).
- If no session AND no `userMode=guest` cookie: redirect to `/`.
- Guest is identified by: `session === null` AND `document.cookie` contains `userMode=guest`.

**API calls on mount (logged-in users only):**
- `GET /api/user-profile` → store as `userProfile` in state
- `GET /api/leaderboard?scope=weekly&preview=true` → store as `leaderboardPreview` in state

**State variables:**

```javascript
const [userProfile, setUserProfile] = useState(null);       // from /api/user-profile
const [leaderboardPreview, setLeaderboardPreview] = useState([]); // top 3 from leaderboard
const [selectedSubject, setSelectedSubject] = useState("");
const [selectedTopic, setSelectedTopic] = useState("");
const [topics, setTopics] = useState([]);                   // from /api/topics
const [topicsLoading, setTopicsLoading] = useState(false);
const [selectedCount, setSelectedCount] = useState(10);     // 10 or 25
const isReady = !!selectedSubject && !!selectedTopic;       // derived
```

**Layout (dark theme, mobile-first, scrollable, no fixed height):**

---

**Section 1 — Profile header card**

- Container: `bg-gradient-to-r from-sky-900 to-emerald-800 rounded-3xl p-4 mx-4 mt-4 shadow-lg`
- Entrance animation: `animate-fadeInDown` (custom Tailwind animation, see Section 11)
- Left side: Avatar circle
  - `w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white`
  - Content: first letter of name (e.g. `A` for Aman) — uppercase. For guest: `G`.
- Right side (flex-1, pl-3):
  - Line 1: `"Hello, {name}"` — `text-white font-semibold text-lg`
  - Line 2 (logged-in): `"{level} · {totalXP} XP"` — `text-emerald-300 text-sm`
  - Line 2 (guest): `"Guest mode · progress not saved"` — `text-slate-400 text-sm`
  - Line 3 (logged-in): `"Member since {month} {year}"` — `text-slate-400 text-xs` (parse `createdAt`)
  - Line 3 (guest): show nothing

---

**Section 2 — Daily Streak card**

- Container: `bg-slate-800 rounded-3xl p-4 mx-4 mt-3`
- Row 1 (space-between): Title `"Daily Streak"` in `text-white font-semibold text-base` | flame icon `🔥 text-orange-400` (24px)
- Row 2: Large streak number
  - `text-5xl font-black text-white` — e.g. `8`
  - Inline with: `"days"` in `text-slate-400 text-lg ml-2 self-end mb-1`
- Row 3: Subtext (one line, `text-sm text-slate-400 mt-1`):
  - If guest: `"Login to start your streak"`
  - If `lastAttemptDate === todayIST` (compute in client): `"Streak protected today! Come back tomorrow."`
  - Else: `"Complete 1 quiz today to protect your streak!"`
- Row 4: Weekday chips (Sun Mon Tue Wed Thu Fri Sat)
  - 7 chips in a row, `flex gap-1 mt-3 justify-between`
  - Each chip: `flex-1 text-center text-xs py-1 rounded-lg`
  - Today's chip: `bg-emerald-500 text-white font-bold`
  - Other chips: `bg-slate-700 text-slate-400`
  - Determine "today" index in client using `new Date().getDay()` (0=Sun)
  - These chips are visual only; no click behaviour.

---

**Section 3 — Quiz Setup card**

- Container: `bg-slate-800 rounded-3xl p-4 mx-4 mt-3`
- Title: `"Start a Quiz"` in `text-white font-semibold text-base mb-3`

- **Count selector** (two option buttons side by side, `flex gap-2 mb-4`):
  - Button for 10: label `"Quick · 10Q"`, subtext `"~3 min"`
  - Button for 25: label `"Full · 25Q"`, subtext `"~8 min"`
  - Selected state: `bg-emerald-500 text-white shadow-lg shadow-emerald-500/20`
  - Unselected state: `bg-slate-700 text-slate-300`
  - Each button: `flex-1 py-3 rounded-2xl text-center text-sm font-semibold transition-all`

- **Subject dropdown** (`mt-3`):
  - Label: `"Subject"` in `text-xs text-slate-400 mb-1`
  - `<select>` element, style: `w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:border-emerald-500 focus:outline-none appearance-none`
  - Placeholder option: `<option value="">-- Choose a subject --</option>` (disabled, selected by default)
  - Populate with hardcoded list (no API call needed for subjects):
    `Polity, Geography, Economics, History, Physics, Chemistry, Biology, Current Affairs`
  - On change: set `selectedSubject`, reset `selectedTopic` to `""`, reset `topics` to `[]`, call `fetchTopics(newSubject)`.

- **Topic dropdown** (`mt-3`):
  - Label: `"Topic"` in `text-xs text-slate-400 mb-1`
  - If `topicsLoading`: show `"Loading topics…"` text in place of dropdown
  - `<select>` disabled when `!selectedSubject`
  - Style when disabled: add `opacity-50 cursor-not-allowed`
  - Placeholder option: `<option value="">-- Choose a topic --</option>`
  - Options: `topics.map(t => <option key={t.name} value={t.name}>{t.name} ({t.count} Q)</option>)`
  - On change: set `selectedTopic`.

- **`fetchTopics(subject)` function:**
  ```javascript
  async function fetchTopics(subject) {
    setTopicsLoading(true);
    setTopics([]);
    try {
      const res = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      setTopics(data.topics || []);
    } catch {
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }
  ```

- **Start Quiz button** (`mt-4`):
  - Disabled state (`!isReady`):
    - `bg-slate-600 text-slate-400 cursor-not-allowed rounded-2xl w-full py-4 text-base font-semibold`
  - Enabled state (`isReady`):
    - `bg-emerald-500 text-white rounded-2xl w-full py-4 text-base font-semibold shadow-lg shadow-emerald-500/30`
    - Add pulse animation class: `animate-pulse-slow` (see Section 11 for CSS)
    - Remove animation if `!isReady`
  - On click (only when `isReady`):
    ```javascript
    const sessionId = crypto.randomUUID();
    router.push(
      `/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(selectedTopic)}&count=${selectedCount}&sessionId=${sessionId}`
    );
    ```

---

**Section 4 — Leaderboard preview strip**

- Container: `bg-slate-800 rounded-3xl p-4 mx-4 mt-3 mb-24`
  - `mb-24` provides space above bottom nav
- Header row (space-between):
  - Left: `"🏆 Top This Week"` in `text-white font-semibold text-base`
  - Right: `<Link href="/leaderboard">` — `text-emerald-400 text-sm`— `"View all →"`
- If `leaderboardPreview` is loading: 3 skeleton rows (pulse)
- If empty: `"No scores yet this week. Be the first!"` in `text-slate-500 text-sm text-center py-4`
- For each of top 3 leaders:
  - Row: `flex items-center py-2 border-b border-slate-700 last:border-0`
  - Left: rank medal icon — `🥇` (1), `🥈` (2), `🥉` (3) — `text-xl w-8`
  - Middle: name in `text-white text-sm font-medium flex-1`
  - Right: score in `text-emerald-400 font-bold text-sm`

---

**Section 5 — Bottom Navigation (fixed)**

See component spec in Section 10.1.

---

### 8.3 `/quiz` — Quiz Page (MODIFY existing)

**Changes from V1:**

1. Read `subject`, `topic`, `count`, `sessionId` from `router.query`.
   - If any of `subject`, `topic`, `count` is missing or invalid → `router.replace("/dashboard")`.
   - If `sessionId` is missing → generate one client-side: `const sessionId = crypto.randomUUID()`.

2. Pass `subject`, `topic`, `sessionId` through to result page via `router.push`:
   ```javascript
   router.push(
     `/result?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&sessionId=${sessionId}&correct=${correct}&incorrect=${incorrect}&skipped=${skipped}&total=${total}&score=${score}`
   );
   ```
   All existing result params stay. Just add `subject`, `topic`, `sessionId`.

3. **Top bar additions** (inside existing quiz header):
   - Show `"{subject} · {topic}"` in `text-slate-400 text-xs` (left side of header)
   - Show `"+10 XP if you finish this quiz"` in `text-emerald-400 text-xs` (right side of header)
   - This is static text tied to the base XP rule; it is always shown regardless of whether user is logged in.

4. Everything else on the quiz page (timer, options, skip, scoring logic, question display) is **unchanged**.

---

### 8.4 `/result` — Result Page (MODIFY existing)

**Changes from V1:**

1. Read `subject`, `topic`, `sessionId` from `router.query` (in addition to existing params).

2. **For logged-in users:** on page mount (after router is ready), call `/api/score`:
   ```javascript
   useEffect(() => {
     if (status !== "authenticated") return; // useSession hook
     fetch("/api/score", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         correctAnswers: Number(router.query.correct),
         incorrectAnswers: Number(router.query.incorrect),
         skipped: Number(router.query.skipped),
         totalQuestions: Number(router.query.total),
         rawScore: Number(router.query.score),
         subject: router.query.subject || "",
         topic: router.query.topic || "",
         sessionId: router.query.sessionId || crypto.randomUUID(),
         isDailyChallenge: false,
       }),
     })
       .then((r) => r.json())
       .then((data) => {
         if (data.ok) {
           setXPResult(data); // { xpEarned, totalXP, level, streakCount, isFirstQuizOfDay }
           setShowXPToast(true);
           setTimeout(() => setShowXPToast(false), 4000); // auto-dismiss after 4s
         }
       })
       .catch(() => {
         // silent fail — quiz results still show
       });
   }, [status, router.isReady]);
   ```

3. **For guest users:** do NOT call `/api/score`. Show a banner instead:
   - Style: `bg-slate-800 border border-emerald-500/30 rounded-2xl p-4 mx-4 mt-4 text-center`
   - Text: `"Login to save your score, XP, and streak."` — `text-slate-300 text-sm`
   - Button: `"Sign in with Google"` — `bg-emerald-500 text-white text-sm font-semibold py-2 px-6 rounded-xl mt-2 inline-block`
   - On click: `signIn("google", { callbackUrl: "/dashboard" })`

4. **XP toast** — render `<XPToast>` component (see Section 10.2) when `showXPToast === true`.

5. **Navigation buttons** (add/modify existing):
   - Primary: `"Back to Home"` → `router.push("/dashboard")`
   - Secondary: `"View Leaderboard"` → `router.push("/leaderboard")`
   - Keep existing: `"View Detailed Analysis"` link
   - Keep existing: WhatsApp + Telegram share buttons

6. Everything else on the result page (score card, AI summary, detailed analysis link, feedback form) is **unchanged**.

---

### 8.5 `/leaderboard` — Leaderboard Page (MODIFY existing)

**Changes from V1:**

1. **Remove** existing podium + list design entirely. Replace with the following layout.

2. **Tab state:** `activeTab` — `"weekly"` (default) or `"all"`.

3. **Data fetching:**
   ```javascript
   async function fetchLeaderboard(scope) {
     setLoading(true);
     const res = await fetch(`/api/leaderboard?scope=${scope}`);
     const data = await res.json();
     setLeaders(data.leaders || []);
     setCurrentUser(data.currentUser || null);
     setLoading(false);
   }
   ```
   Call on mount with `"weekly"`. Call again when tab changes.

4. **Layout:**

   - Header: `"Leaderboard"` in `text-white text-2xl font-bold mx-4 mt-4`

   - **Tabs** (`flex mt-4 mx-4 bg-slate-800 rounded-2xl p-1`):
     - Two buttons: `"This Week"` and `"All Time"`
     - Active tab: `bg-emerald-500 text-white rounded-xl`
     - Inactive tab: `text-slate-400`
     - Each: `flex-1 text-center py-2 text-sm font-semibold transition-all`

   - **Current user's rank card** (show only if `currentUser !== null`):
     - Container: `bg-emerald-900/40 border border-emerald-500/30 rounded-2xl p-4 mx-4 mt-4`
     - Content: `"Your rank: #{currentUser.rank}"` | `"{currentUser.name}"` | `"{currentUser.totalScore} pts"` | `"{currentUser.overallAccuracy.toFixed(1)}% accuracy"`
   
   - **"Not on leaderboard" message** (show when `currentUser === null` AND user is logged in):
     - `"You are not on the leaderboard yet. Play a quiz to earn your first marks."` in `text-slate-500 text-sm text-center mx-4 mt-4`

   - **Guest banner** (show when user is not logged in):
     - `"Sign in to appear on the leaderboard."` with a Google sign-in button.

   - **Leaders table** (`mt-4 mx-4 mb-24`):
     - If loading: show 5 skeleton rows
     - If empty: `"No scores yet. Be the first to play!"`
     - For each leader (up to 50 rows): one row component (see `LeaderboardTable` component in Section 10.3)

5. **Bottom nav** visible on this page.

---

## 9. New Pages Route Summary

| Route | File | Auth requirement | Notes |
|---|---|---|---|
| `/` | `pages/index.js` | None (redirect if logged in) | New landing/auth page |
| `/dashboard` | `pages/dashboard.js` | Optional (guest allowed) | New dashboard |
| `/quiz` | `pages/quiz.js` | None | Minor modifications |
| `/result` | `pages/result.js` | None | XP toast + score API call |
| `/leaderboard` | `pages/leaderboard.js` | Optional | Tab redesign |
| `/analysis` | `pages/analysis.js` | None | No change |

---

## 10. Component Specifications

### 10.1 `BottomNav` component (`/components/BottomNav.js`)

Sticky bottom navigation bar visible on `/dashboard`, `/leaderboard`.

```jsx
// Renders a fixed bottom bar with 3 nav items
// Props: none (uses useRouter to detect active route)
```

**Visual spec:**
- Container: `fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex justify-around items-center py-2 px-4 z-50`
- Max width: `max-w-lg mx-auto` (keeps it centered on desktop)
- 3 items:

| Tab | Icon | Label | Route |
|---|---|---|---|
| Home | `🏠` or house SVG | `"Home"` | `/dashboard` |
| Leaderboard | `🏆` or trophy SVG | `"Leaderboard"` | `/leaderboard` |
| Profile | `👤` or person SVG | `"Profile"` | `/profile` (placeholder — show "Coming soon" toast on tap) |

- Each item: `flex flex-col items-center gap-1 flex-1`
- Active state (route matches): icon + label in `text-emerald-400`, add `font-semibold`
- Inactive state: icon + label in `text-slate-500`
- Icon size: `text-xl`
- Label size: `text-xs`
- On tap, use `router.push()` (no `<a>` tag, to avoid full page reload)
- Profile tap: `toast.info("Profile page coming soon!")` — use a simple inline state toast (no external library needed)

---

### 10.2 `XPToast` component (`/components/XPToast.js`)

Animated toast that slides in from the bottom after a quiz is saved.

**Props:**
```typescript
{
  xpEarned: number,        // e.g. 34
  totalXP: number,         // e.g. 298
  level: string,           // e.g. "Scholar"
  streakCount: number,     // e.g. 6
  isFirstQuizOfDay: boolean,
  visible: boolean,        // controls show/hide
}
```

**Visual spec:**
- Position: `fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto`
- Container: `bg-slate-800 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl`
- Entrance animation: slide up + fade in over 300ms (use Tailwind `translate-y` transition):
  - Hidden: `translate-y-full opacity-0`
  - Visible: `translate-y-0 opacity-100`
  - Add `transition-all duration-300` class
- Content layout (two rows):
  - Row 1: `"⚡ +{xpEarned} XP earned"` in `text-emerald-400 font-bold text-base`
  - Row 2 (flex, space-between):
    - Left: `"Level: {level} · {totalXP} XP total"` in `text-slate-300 text-sm`
    - Right: `"🔥 {streakCount} day streak"` in `text-orange-400 text-sm font-semibold`
  - If `isFirstQuizOfDay`: add a third row: `"🌅 First quiz of the day bonus included!"` in `text-yellow-400 text-xs mt-1`
- Auto-dismiss: parent controls via `visible` prop + `setTimeout` (4000ms). Component just reads `visible`.

---

### 10.3 `LeaderboardTable` component (`/components/LeaderboardTable.js`)

Renders a list of leaderboard rows.

**Props:**
```typescript
{
  leaders: Array<{
    rank: number,
    name: string,
    totalScore: number,
    totalQuestionsAttempted: number,
    overallAccuracy: number,
  }>,
  currentUserEmail?: string, // to highlight current user's row
  loading: boolean,
}
```

**Visual spec:**
- If `loading`: render 5 skeleton rows (`bg-slate-700 animate-pulse rounded-xl h-14 mb-2`)
- For each leader row:
  - Container: `flex items-center py-3 px-4 rounded-2xl mb-2`
  - Highlight if `leader.email === currentUserEmail`: add `bg-emerald-900/40 border border-emerald-500/30`
  - Normal: `bg-slate-800`
  - Columns:
    - Rank (w-10): `"#1"`, `"#2"`, `"#3"` with medal emoji prefix `🥇🥈🥉` for top 3; plain `"#N"` for others. Style: `text-sm font-bold text-slate-300`
    - Name (flex-1): `text-white text-sm font-medium`
    - Score + accuracy (text-right):
      - Score: `text-emerald-400 font-bold text-sm`
      - Accuracy: `text-slate-500 text-xs`

---

### 10.4 `StreakBadge` component (`/components/StreakBadge.js`)

Small inline badge showing streak count, used in profile header and toast.

**Props:** `{ streakCount: number }`

**Visual:** `🔥 {streakCount}` in `bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-1 rounded-full`

---

### 10.5 `LevelBadge` component (`/components/LevelBadge.js`)

Small inline badge showing user level.

**Props:** `{ level: string }`

**Color map:**
```javascript
const levelColors = {
  Aspirant:  "bg-slate-600 text-slate-300",
  Scholar:   "bg-blue-600/30 text-blue-400",
  Expert:    "bg-purple-600/30 text-purple-400",
  Champion:  "bg-yellow-600/30 text-yellow-400",
  Legend:    "bg-emerald-600/30 text-emerald-400",
};
```

**Visual:** `{level}` text in `text-xs font-bold px-2 py-1 rounded-full` + color from map.

---

## 11. Tailwind CSS Additions (`tailwind.config.js`)

Add these custom animations to `tailwind.config.js` under `theme.extend`:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        'fadeInDown': 'fadeInDown 0.4s ease-out',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
```

---

## 12. Design System (Global)

Apply these globally. Existing pages that are not modified should not be touched. New pages must use these tokens.

| Token | Value | Usage |
|---|---|---|
| Background (page) | `bg-slate-900` | All page backgrounds |
| Card surface | `bg-slate-800` | All card containers |
| Border | `border-slate-700` | Dividers, card borders |
| Primary accent | `emerald-500` (`#10b981`) | CTAs, active states, XP |
| Secondary accent | `orange-400` (`#fb923c`) | Streak, fire icons |
| Text primary | `text-white` | Headings, important labels |
| Text secondary | `text-slate-300` | Body text |
| Text muted | `text-slate-500` | Labels, captions, empty states |
| Danger | `text-red-400` | Incorrect answers |
| Border radius (cards) | `rounded-3xl` | All card containers |
| Border radius (buttons) | `rounded-2xl` | All buttons |
| Font | System default (no Google Fonts import needed) | |

---

## 13. Guest Mode Implementation Details

Guest state is determined by the following logic (client-side only):

```javascript
// In _app.js or a custom hook
function isGuestMode() {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith("userMode=guest"));
}
```

Guest cookie is set by the "Play as Guest" button on `/`:
```javascript
document.cookie = "userMode=guest; path=/; max-age=86400"; // 24 hours
router.push("/dashboard");
```

Guest cookie is cleared when user signs in with Google. In NextAuth's `signIn` callback or the Google button handler, clear the cookie:
```javascript
document.cookie = "userMode=; path=/; max-age=0";
signIn("google", { callbackUrl: "/dashboard" });
```

On `/dashboard`, the guest detection logic:
```javascript
const { data: session, status } = useSession();
const isGuest = status === "unauthenticated" && isGuestMode();
const isLoggedIn = status === "authenticated";
// If not guest and not logged in and not loading → redirect to /
useEffect(() => {
  if (status === "loading") return;
  if (!isGuest && !isLoggedIn) router.replace("/");
}, [status]);
```

---

## 14. Error Handling Rules

These rules apply uniformly across all new code:

| Scenario | Behaviour |
|---|---|
| `/api/user-profile` fails (500) | Dashboard shows generic "Guest-style" view with name from `session.user.name` and all XP/streak as 0. No error toast — silently degrade. |
| `/api/score` fails (500, 429, network) | Result page still shows quiz results. Show inline `"Could not save your score, but your results are shown here."` in `text-yellow-400 text-sm text-center mt-2`. Do not retry. |
| `/api/leaderboard` fails | Show `"Could not load leaderboard. Please try again."` with a retry button. |
| `/api/topics` fails | Set `topics = []`; show `"Could not load topics. Refresh and try again."` below the topic dropdown. |
| Google Sheets API rate limit (429 from Google) | Catch error, return 500 to client. Log to console on server with message `"[Sheets] Rate limit hit"`. |
| Invalid quiz query params | Redirect to `/dashboard` with no error message. |
| XPToast state: `xpEarned = 0` | Still show toast with `"+0 XP"` — this only happens for quizzes with <5 questions; do not suppress toast. |

---

## 15. Page Transition & Routing Map

```
/  (landing)
 ├── [Google sign in] → NextAuth callback → /dashboard
 └── [Play as Guest] → set cookie → /dashboard

/dashboard
 ├── [Start Quiz] → /quiz?subject=S&topic=T&count=N&sessionId=UUID
 └── [View all →] (leaderboard preview) → /leaderboard

/quiz
 └── [Quiz complete] → /result?...all params...

/result
 ├── [Back to Home] → /dashboard
 ├── [View Leaderboard] → /leaderboard
 └── [View Detailed Analysis] → /analysis?...existing params...

/leaderboard
 └── [Home tab] → /dashboard (via BottomNav)
```

---

## 16. What Does NOT Need to Change

The following files must not be touched unless explicitly fixing a bug found during V2 implementation:

- `/pages/api/auth/[...nextauth].js`
- `/pages/api/ai/explain.js`
- `/pages/api/ai/tip.js`
- `/pages/api/ai/summary.js`
- `/pages/analysis.js`
- `/lib/gemini.js` (or equivalent AI helper)
- `next.config.js`
- `vercel.json` (if exists)
- `.env.local` (the file; the values inside may need new entries for new variables)

---

## 17. Implementation Order (Recommended for AI Code Agent)

Implement in this exact order to avoid dependency issues:

1. **Create utility files** → `/lib/streak.js`, `/lib/xp.js`, add helpers to `/lib/sheets.js`
2. **Create Google Sheets tabs** → add `Users` tab headers, `LeaderboardCache` tab headers, add columns I–M to `Scores` tab headers (manually, or via a one-time migration script)
3. **`GET /api/user-profile`** → test with a real Google session
4. **Modify `POST /api/score`** → add XP + streak logic + new Scores columns
5. **`GET /api/leaderboard`** → add scope param + cache logic
6. **Create components** → `BottomNav`, `XPToast`, `LeaderboardTable`, `StreakBadge`, `LevelBadge`
7. **Create `/pages/index.js`** (auth/landing page) — replace existing
8. **Create `/pages/dashboard.js`** — new dashboard
9. **Modify `/pages/quiz.js`** — read new query params, minor header change
10. **Modify `/pages/result.js`** — call `/api/score`, show XP toast, guest banner
11. **Modify `/pages/leaderboard.js`** — new tab design, use `LeaderboardTable` component
12. **Update `tailwind.config.js`** — add custom animations

---

## 18. Checklist: What the Developer (You, Aman) Must Provide

The AI coding agent cannot proceed on these items — they require your manual action or your private credentials.

### 🔑 Credentials & Config (provide before deploying)
- [ ] **Google Sheets Spreadsheet ID** — open your sheet, copy the long ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`
- [ ] **Verify tab names** — confirm the exact tab names in your spreadsheet are: `Questions`, `Scores`, `Feedback`. The AI will create `Users` and `LeaderboardCache` as new tabs via API or manual creation.
- [ ] **Service account JSON** — confirm `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` are already set in Vercel environment variables and `.env.local`. If not, go to Google Cloud Console → IAM → Service Accounts → your account → Keys → create JSON key.
- [ ] **Gemini API key** — confirm `GEMINI_API_KEY` is in Vercel environment variables.
- [ ] **NextAuth variables** — confirm `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are in Vercel.

### 📋 Google Sheets Manual Setup (do before first deploy of V2)
- [ ] **Add new headers to `Scores` tab**: In row 1, add to cells I1–M1: `subject`, `topic`, `sessionId`, `xpEarned`, `isDailyChallenge`
- [ ] **Create `Users` tab**: New tab named exactly `Users`. Add header row: `email | name | streakCount | lastAttemptDate | streakShieldUsed | totalXP | level | badges | dailyChallengeAttemptDates | isPublicOnLeaderboard | createdAt`
- [ ] **Create `LeaderboardCache` tab**: New tab named exactly `LeaderboardCache`. Add header row: `cachedAt | weeklyJSON | allTimeJSON`. Then manually add a row 2 with three empty string cells `"" | "" | ""` so the API can update it.
- [ ] **Verify `Questions` tab**: Confirm your questions exist with correct column order (ID, Subject, Topic, Question, OptionA, OptionB, OptionC, OptionD, CorrectOption, Explanation). The `active` column (K) is optional — if you haven't added it, all rows are treated as active.

### 🎨 Content & Copy (decide before implementation)
- [ ] **Parmar SSC branding**: Do you want `"Questions sourced from Parmar SSC"` in the footer, or a different exact phrase? (Default in this PRD: `"Questions sourced from Parmar SSC"`)
- [ ] **App tagline**: Confirm `"Practice smarter. Rank higher."` is the one you want on the landing page.
- [ ] **Social proof copy**: The PRD uses static text `"Join 500+ aspirants practising daily"`. Change the number to whatever is accurate or aspirational for launch.
- [ ] **Subject list**: Confirm the 8 subjects are correct: `Polity, Geography, Economics, History, Physics, Chemistry, Biology, Current Affairs`. If your Questions sheet uses different Subject values (e.g. "Political Science" instead of "Polity"), align them.

### 🗒️ Questions Content
- [ ] **Minimum question count**: Confirm you have enough questions in the `Questions` sheet to support a "Full 25Q" quiz for at least 2 topics per subject. If not, the topic dropdown will show `(8 Q)` next to a topic and the user can still select it — only 8 questions will be served.
- [ ] **Parmar SSC video URLs**: If you want to populate the `sourceVideoURL` column in Questions for future use, do this manually in the sheet — it has no effect on V2 UI.

### 🧪 Testing (do yourself before sharing the link)
- [ ] Sign in with Google → confirm you land on `/dashboard` and your name appears
- [ ] Play as guest → confirm quiz works and result page shows "Login to save score" banner
- [ ] Complete a quiz as logged-in → confirm XP toast appears on result page
- [ ] Check `Scores` tab → confirm new row appeared with all 13 columns populated
- [ ] Check `Users` tab → confirm your row appeared with correct XP, level, streak
- [ ] Visit `/leaderboard` → confirm "This Week" and "All Time" tabs both load
- [ ] Break a streak by manually editing `lastAttemptDate` to 3 days ago in Users tab → play a quiz → confirm streak resets to 1

---

*End of PRD — SSC GK Score Booster V2*  
*All implementation decisions are stated. All ambiguities are resolved. The AI coding agent should not need to ask any clarifying questions.*
