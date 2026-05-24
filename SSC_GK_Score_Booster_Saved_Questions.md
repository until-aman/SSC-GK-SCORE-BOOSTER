# SSC GK Score Booster — Saved Questions Feature PRD

---

## PASTE THIS MESSAGE INTO CLAUDE CODE AFTER UPLOADING THIS FILE

```
I am uploading SSC_GK_Score_Booster_Saved_Questions.md

Read the ENTIRE file before writing a single line of code.
This feature moves saved questions from localStorage to Google Sheets
so they persist across devices and browser clears.

Zero changes to quiz logic, scoring, leaderboard, or any existing API
except the ones explicitly listed in this file.

Implement in the order listed under IMPLEMENTATION ORDER at the bottom.
```

---

## 1. What Changes

**Before:** When user taps the bookmark icon on a question, the question
ID is saved to `localStorage`. Cleared when user clears browser data.

**After:** 
- Logged-in users: saved questions stored in a new `SavedQuestions`
  tab in the existing Google Sheet. Persists forever, works across
  all devices.
- Guest users: keep using localStorage as fallback. Show a banner
  "Login to save questions permanently across devices."

---

## 2. Google Sheets — New Tab

### `SavedQuestions` sheet (NEW — create this tab)

Create a new tab named exactly `SavedQuestions` in the existing
Google Spreadsheet. Row 1 is the header row.

| Column | Name | Type | Notes |
|---|---|---|---|
| A (0) | `email` | string | User's Google email |
| B (1) | `questionId` | string | The `ID` field from Questions sheet |
| C (2) | `subject` | string | e.g. "Polity" |
| D (3) | `topic` | string | e.g. "Fundamental Rights" |
| E (4) | `question` | string | Full question text |
| F (5) | `optionA` | string | |
| G (6) | `optionB` | string | |
| H (7) | `optionC` | string | |
| I (8) | `optionD` | string | |
| J (9) | `correctOption` | string | A / B / C / D |
| K (10) | `explanation` | string | From Questions sheet |
| L (11) | `savedAt` | string | ISO timestamp |

**Why store full question data:** If a question is later removed or
edited in the Questions sheet, the user's saved copy still shows
correctly. This is intentional — saved questions are a snapshot.

**Manually add the header row** in Google Sheets before deploying:
`email | questionId | subject | topic | question | optionA | optionB | optionC | optionD | correctOption | explanation | savedAt`

---

## 3. API Specifications

### 3.1 `POST /api/saved-questions` — Save a question

**File:** `/pages/api/saved-questions.js`

**Auth:** Required. Return `401` if no session.

**Request body:**
```json
{
  "questionId": "POL-001",
  "subject": "Polity",
  "topic": "Fundamental Rights",
  "question": "Which article deals with Right to Equality?",
  "optionA": "Article 12",
  "optionB": "Article 14",
  "optionC": "Article 19",
  "optionD": "Article 21",
  "correctOption": "B",
  "explanation": "Article 14 guarantees equality before law."
}
```

**Validation:**
- `questionId` must be non-empty string
- `question` must be non-empty string
- `correctOption` must be one of A, B, C, D
- All option fields must be non-empty strings

**Logic:**
1. Get `email` from session.
2. Read all rows from `SavedQuestions` tab.
3. Check if a row already exists where `row[0] === email` AND
   `row[1] === questionId`.
4. If already saved → return `200 { "ok": true, "alreadySaved": true }`
   (do not duplicate).
5. If not saved → append new row:
```javascript
[
  email,              // A
  questionId,         // B
  subject,            // C
  topic,              // D
  question,           // E
  optionA,            // F
  optionB,            // G
  optionC,            // H
  optionD,            // I
  correctOption,      // J
  explanation || "",  // K
  new Date().toISOString() // L
]
```
6. Return `200 { "ok": true, "alreadySaved": false }`

**Errors:**
- `400` — validation failed
- `401` — not authenticated
- `500` — Sheets failure

---

### 3.2 `DELETE /api/saved-questions` — Unsave a question

**File:** Same `/pages/api/saved-questions.js` — handle DELETE method.

**Auth:** Required. Return `401` if no session.

**Request body:**
```json
{ "questionId": "POL-001" }
```

**Logic:**
1. Get `email` from session.
2. Read all rows from `SavedQuestions` tab (skip header row 1).
3. Find the row index (1-based, accounting for header) where
   `row[0] === email` AND `row[1] === questionId`.
4. If not found → return `200 { "ok": true }` (idempotent).
5. If found → delete that specific row using Google Sheets API
   `batchUpdate` with a `deleteDimension` request.
6. Return `200 { "ok": true }`

**How to delete a specific row using Sheets API:**
```javascript
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  requestBody: {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: SAVED_QUESTIONS_SHEET_ID, // numeric tab ID
          dimension: "ROWS",
          startIndex: rowIndex,     // 0-based index of the row
          endIndex: rowIndex + 1,
        }
      }
    }]
  }
});
```

To get `SAVED_QUESTIONS_SHEET_ID`: call
`sheets.spreadsheets.get({ spreadsheetId })` and find the sheet
where `sheet.properties.title === "SavedQuestions"`. Cache this
value in a module-level variable after first fetch.

---

### 3.3 `GET /api/saved-questions` — Fetch all saved questions

**File:** Same `/pages/api/saved-questions.js` — handle GET method.

**Auth:** Required. Return `401` if no session.

**Query params:** None.

**Logic:**
1. Get `email` from session.
2. Read all rows from `SavedQuestions` tab (skip header row 1).
3. Filter rows where `row[0] === email`.
4. Map to objects:
```javascript
{
  questionId:    row[1],
  subject:       row[2],
  topic:         row[3],
  question:      row[4],
  options: {
    A: row[5],
    B: row[6],
    C: row[7],
    D: row[8],
  },
  correctOption: row[9],
  explanation:   row[10],
  savedAt:       row[11],
}
```
5. Sort by `savedAt` descending (newest first).
6. Return:
```json
{
  "savedQuestions": [...],
  "count": 12
}
```

**Errors:**
- `401` — not authenticated
- `500` — Sheets failure

---

### 3.4 `GET /api/saved-questions/ids` — Check which questions are saved

**File:** `/pages/api/saved-questions/ids.js`

**Purpose:** Used on quiz page to know which questions are already saved
(to show filled vs outline bookmark icon) without fetching full data.

**Auth:** Required. Return `401` if no session.

**Logic:**
1. Get `email` from session.
2. Read all rows from `SavedQuestions` tab.
3. Filter where `row[0] === email`.
4. Return only the IDs:
```json
{ "savedIds": ["POL-001", "GEO-045", "HIS-012"] }
```

---

## 4. Frontend Changes

### 4.1 Quiz Page — Bookmark Button

The existing bookmark button currently calls `localStorage`. Replace
its handler with the following logic:

```javascript
async function handleBookmarkToggle(question) {
  // question object has: id, subject, topic, question, options, correctOption, explanation

  if (!session) {
    // Guest: keep using localStorage
    const saved = JSON.parse(localStorage.getItem("savedQuestions") || "[]");
    const exists = saved.find(q => q.questionId === question.id);
    if (exists) {
      const updated = saved.filter(q => q.questionId !== question.id);
      localStorage.setItem("savedQuestions", JSON.stringify(updated));
      setSavedIds(prev => prev.filter(id => id !== question.id));
    } else {
      saved.push({ questionId: question.id, ...question });
      localStorage.setItem("savedQuestions", JSON.stringify(saved));
      setSavedIds(prev => [...prev, question.id]);
    }
    return;
  }

  // Logged-in: use API
  const isCurrentlySaved = savedIds.includes(question.id);

  // Optimistic update (instant UI response)
  if (isCurrentlySaved) {
    setSavedIds(prev => prev.filter(id => id !== question.id));
  } else {
    setSavedIds(prev => [...prev, question.id]);
  }

  try {
    if (isCurrentlySaved) {
      await fetch("/api/saved-questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
    } else {
      await fetch("/api/saved-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId:    question.id,
          subject:       question.subject,
          topic:         question.topic,
          question:      question.question,
          optionA:       question.options.A,
          optionB:       question.options.B,
          optionC:       question.options.C,
          optionD:       question.options.D,
          correctOption: question.correctOption,
          explanation:   question.explanation || "",
        }),
      });
    }
  } catch {
    // Revert optimistic update on failure
    if (isCurrentlySaved) {
      setSavedIds(prev => [...prev, question.id]);
    } else {
      setSavedIds(prev => prev.filter(id => id !== question.id));
    }
  }
}
```

**Load saved IDs on quiz page mount (logged-in only):**
```javascript
useEffect(() => {
  if (status !== "authenticated") return;
  fetch("/api/saved-questions/ids")
    .then(r => r.json())
    .then(data => setSavedIds(data.savedIds || []))
    .catch(() => {});
}, [status]);
```

**Bookmark icon states:**
```jsx
// Filled = saved, outline = not saved
const isSaved = savedIds.includes(question.id);

<button
  onClick={() => handleBookmarkToggle(question)}
  className="active:scale-90 transition-transform"
>
  {isSaved ? (
    // Filled bookmark SVG — emerald-400
    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z"/>
    </svg>
  ) : (
    // Outline bookmark SVG — slate-400
    <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )}
</button>
```

**Guest banner** (show once when guest taps bookmark for first time):
```
Small toast at top of screen (not bottom — bottom nav is there):
  fixed top-4 left-4 right-4 max-w-[430px] mx-auto z-50
  bg-slate-800 border border-emerald-500/30 rounded-2xl px-4 py-3
  flex items-center gap-3
  fade-in-down animation

  🔖 text-lg
  "Login to save questions permanently" font-sans text-sm text-slate-300 flex-1
  [Login] button: text-emerald-400 font-semibold text-sm
    On tap: signIn("google", { callbackUrl: window.location.href })

Auto-dismiss after 3000ms.
Show only once per session using a useRef flag.
```

---

### 4.2 Saved Questions Page — `/saved`

**New page:** `/pages/saved.js`

**Auth:**
- Logged-in: fetch from API
- Guest: read from localStorage
- No session AND no guest cookie → redirect to `/`

**Page layout:**

```
Root: flex flex-col flex-1 bg-slate-900 pb-6

HEADER (px-4 pt-8 pb-4 flex items-center justify-between):
  Left (flex items-center gap-3):
    Back button (same as /streak back button)
    "Saved Questions" — PAGE TITLE token (font-display font-black text-xl text-white)
  Right:
    Count badge: bg-emerald-500/15 border border-emerald-500/30 rounded-full
                 px-3 py-1 font-display font-bold text-xs text-emerald-400
                 "{count} saved"

GUEST BANNER (if guest, mx-4 mt-2):
  bg-slate-800 border border-emerald-500/20 rounded-2xl px-4 py-3
  flex items-center gap-3
  🔒 text-lg
  "Login to sync saved questions across all devices"
  font-sans text-sm text-slate-300 flex-1
  [Login] text-emerald-400 font-semibold text-sm

EMPTY STATE (if no saved questions, text-center py-16):
  🔖 text-5xl mb-4
  "No saved questions yet"
  font-display font-bold text-lg text-slate-400
  "Tap the bookmark icon on any question during a quiz to save it here."
  font-sans text-sm text-slate-500 mt-2 max-w-[260px] mx-auto
  [Start a Quiz →] PRIMARY button mt-6 mx-auto max-w-[200px]
    On tap: router.push("/dashboard")

FILTER ROW (if questions exist, px-4 mt-3):
  Horizontal scroll row of subject filter chips:
    "All" chip + one chip per unique subject in saved questions
    
    Each chip: rounded-full px-4 py-1.5 font-sans font-semibold text-xs
               active:scale-95 transition-transform
    Selected: bg-emerald-500 text-white
    Unselected: bg-slate-800 border border-slate-700 text-slate-400

QUESTION LIST (px-4 mt-3):
  Filter applied client-side. Show all if "All" selected.
  
  Each question card:
    bg-slate-800 border border-slate-700 rounded-3xl p-4 mb-3

    TOP ROW (flex justify-between items-start):
      Left: subject + topic badge
        bg-slate-700 rounded-full px-3 py-1
        font-sans text-xs text-slate-400
        "{subject} · {topic}"
      Right: unsave button (bookmark filled icon, tap to remove)
        w-8 h-8 flex items-center justify-center
        active:scale-90 transition-transform
        Filled bookmark SVG text-emerald-400

    QUESTION TEXT (mt-3):
      font-display font-bold text-sm text-white leading-relaxed

    OPTIONS (mt-3 flex flex-col gap-2):
      Each option row: flex items-center gap-2
        Letter badge: w-6 h-6 rounded-full flex items-center justify-center
                      font-display font-bold text-xs
          Correct option: bg-emerald-500 text-white
          Other options:  bg-slate-700 text-slate-400
        Option text: font-sans text-sm
          Correct: text-emerald-400 font-medium
          Other:   text-slate-400

    EXPLANATION (if exists, mt-3):
      Collapsible — show/hide toggle
      Header (flex items-center gap-2 cursor-pointer):
        💡 text-sm
        "Explanation" font-sans font-semibold text-xs text-slate-400
        Chevron SVG (rotates when expanded)
      Content (when expanded):
        bg-slate-700/50 rounded-xl p-3 mt-2
        font-sans text-sm text-slate-300 leading-relaxed

    SAVED DATE (mt-3):
      font-sans text-xs text-slate-600
      "Saved {formattedDate}"
      Format: "Today", "Yesterday", or "DD MMM YYYY"
```

**State:**
```javascript
const [savedQuestions, setSavedQuestions] = useState([]);
const [loading, setLoading] = useState(true);
const [selectedSubject, setSelectedSubject] = useState("All");
const [expandedExplanations, setExpandedExplanations] = useState(new Set());
```

**Data loading:**
```javascript
useEffect(() => {
  if (status === "loading") return;

  if (status === "authenticated") {
    fetch("/api/saved-questions")
      .then(r => r.json())
      .then(data => {
        setSavedQuestions(data.savedQuestions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return;
  }

  // Guest: read from localStorage
  try {
    const local = JSON.parse(localStorage.getItem("savedQuestions") || "[]");
    setSavedQuestions(local);
  } catch {
    setSavedQuestions([]);
  }
  setLoading(false);
}, [status]);
```

**Unsave from this page:**
```javascript
async function handleUnsave(questionId) {
  // Optimistic remove from UI
  setSavedQuestions(prev => prev.filter(q => q.questionId !== questionId));

  if (status === "authenticated") {
    try {
      await fetch("/api/saved-questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
    } catch {
      // Re-fetch to restore correct state on failure
      fetch("/api/saved-questions")
        .then(r => r.json())
        .then(data => setSavedQuestions(data.savedQuestions || []));
    }
  } else {
    // Guest: update localStorage
    try {
      const local = JSON.parse(localStorage.getItem("savedQuestions") || "[]");
      const updated = local.filter(q => q.questionId !== questionId);
      localStorage.setItem("savedQuestions", JSON.stringify(updated));
    } catch {}
  }
}
```

**Loading skeleton:**
```
3 cards, each: h-40 rounded-3xl skeleton mx-4 mb-3
```

---

### 4.3 Add Saved Tab to Bottom Nav

Update `BottomNav.js` to add a 4th tab:

```
4 tabs now: Home · Ranks · Saved · Profile

Home (🏠 SVG) → /dashboard
Ranks (🏆 SVG) → /leaderboard
Saved (🔖 SVG) → /saved
Profile (👤 SVG) → /profile

Bookmark SVG (24×24, stroke-based):
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M5 4a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 20V4z"
        strokeLinecap="round" strokeLinejoin="round"/>
</svg>

Active (on /saved page): fill="currentColor" text-emerald-400
  (filled bookmark when on saved page)
Inactive: fill="none" stroke="currentColor" text-slate-600
```

Add `pb-24` to `/saved` page root div to account for 4-tab nav height.

---

### 4.4 Migration from localStorage (one-time, on first login)

When a logged-in user opens the app and has questions saved in
localStorage (from when they were a guest), migrate them to Sheets:

**Where to run this:** In `/pages/dashboard.js`, after
`/api/user-profile` loads successfully (user is confirmed logged-in).

```javascript
async function migrateLocalSavedQuestions() {
  try {
    const local = JSON.parse(localStorage.getItem("savedQuestions") || "[]");
    if (local.length === 0) return;

    // Upload each to API
    for (const q of local) {
      await fetch("/api/saved-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId:    q.questionId || q.id,
          subject:       q.subject || "",
          topic:         q.topic || "",
          question:      q.question || "",
          optionA:       q.options?.A || q.optionA || "",
          optionB:       q.options?.B || q.optionB || "",
          optionC:       q.options?.C || q.optionC || "",
          optionD:       q.options?.D || q.optionD || "",
          correctOption: q.correctOption || "",
          explanation:   q.explanation || "",
        }),
      });
    }

    // Clear localStorage after successful migration
    localStorage.removeItem("savedQuestions");
    console.log(`Migrated ${local.length} saved questions to cloud.`);
  } catch {
    // Silent fail — localStorage stays intact, try again next login
  }
}

// Call this once after user profile loads:
useEffect(() => {
  if (status !== "authenticated") return;
  if (!userProfile) return;
  migrateLocalSavedQuestions();
}, [status, userProfile]);
```

---

## 5. Files to Create / Modify

| File | Action |
|---|---|
| `/pages/api/saved-questions.js` | CREATE — handles GET, POST, DELETE |
| `/pages/api/saved-questions/ids.js` | CREATE — returns saved IDs only |
| `/pages/saved.js` | CREATE — saved questions page |
| `/components/BottomNav.js` | MODIFY — add 4th Saved tab |
| `/pages/quiz.js` | MODIFY — replace localStorage bookmark with API |
| `/pages/dashboard.js` | MODIFY — add localStorage migration on mount |

---

## 6. Files NOT to Touch

```
All other /pages/api/* files
/pages/analysis.js
/pages/leaderboard.js
/pages/result.js
/pages/streak.js
/pages/history.js
/pages/profile.js
next.config.js
vercel.json
```

---

## 7. Implementation Order

```
STEP 1 — Google Sheets
  Manually add SavedQuestions tab with header row as specified in Section 2.
  (Or write a one-time migration script if preferred.)

STEP 2 — GET/POST/DELETE /api/saved-questions
  Create /pages/api/saved-questions.js
  Handle all 3 methods in one file using req.method switch.
  Test each method independently before moving on.

STEP 3 — GET /api/saved-questions/ids
  Create /pages/api/saved-questions/ids.js
  This is a fast read — just returns IDs array.

STEP 4 — Modify /pages/quiz.js
  Replace localStorage bookmark logic with handleBookmarkToggle function.
  Load savedIds on mount from /api/saved-questions/ids.
  Add guest toast banner (shows once per session).

STEP 5 — Create /pages/saved.js
  Full spec in Section 4.2.
  Guest reads from localStorage, logged-in reads from API.
  Subject filter chips work client-side.
  Explanation collapsible works with local state.

STEP 6 — Modify /components/BottomNav.js
  Add 4th Saved tab with bookmark SVG.
  Active state: filled bookmark icon on /saved route.

STEP 7 — Modify /pages/dashboard.js
  Add localStorage migration logic from Section 4.4.
  Runs once silently after user profile loads.
```

---

## 8. Verification Checklist

```
[ ] Guest taps bookmark on quiz question → question saved to localStorage
[ ] Guest taps bookmark again → question removed from localStorage
[ ] Guest sees toast banner "Login to save permanently" on first bookmark tap
[ ] Guest visits /saved → sees their localStorage saved questions

[ ] Logged-in user taps bookmark → bookmark fills immediately (optimistic)
[ ] API call succeeds → row appears in SavedQuestions sheet with correct data
[ ] Same user taps bookmark again → removed from UI and from sheet
[ ] Tapping same question twice never creates duplicate row in sheet

[ ] Guest logs in → localStorage saved questions migrated to sheet
[ ] After migration → localStorage cleared
[ ] Revisit /saved after migration → questions still visible (now from sheet)

[ ] /saved page loads correct questions for logged-in user
[ ] /saved page subject filter chips work (filter by subject client-side)
[ ] Explanation section collapses and expands correctly
[ ] Unsave from /saved page removes question from UI and sheet immediately

[ ] BottomNav shows 4 tabs: Home · Ranks · Saved · Profile
[ ] /saved tab shows filled bookmark icon when active
[ ] Bottom nav Saved tab badge or icon looks consistent with other tabs

[ ] Two different logged-in users see only their own saved questions
[ ] Questions saved on mobile appear when same user opens on desktop
```

---

*End of SSC GK Score Booster Saved Questions PRD*
*Paste the message at the top of this file into Claude Code after uploading.*
