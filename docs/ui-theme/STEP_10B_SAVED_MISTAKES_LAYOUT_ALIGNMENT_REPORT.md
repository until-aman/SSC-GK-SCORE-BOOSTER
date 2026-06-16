# STEP 10B — Saved Questions + Repeated Mistakes Layout Alignment Report

## Files Changed
- `pages/history/saved.jsx` — visual overhaul with landing + list view
- `pages/history/mistakes.jsx` — visual overhaul with summary card + category rows + new question cards

## Documentation Created
- `docs/ui-theme/STEP_10B_SAVED_MISTAKES_LAYOUT_ALIGNMENT_REPORT.md` (this file)
- `docs/ui-theme/STEP_10B_SAVED_MISTAKES_LAYOUT_ALIGNMENT_CHECKLIST.md`

---

## Saved Questions Changes

### Landing View (activeFilter === 'All')
- **Summary card**: Teal bookmark icon chip, "Your Saved Questions" heading, large count number, "Questions saved" label
- **Subject chips**: Scrollable row — "All {N}", then each subject with its count
- **Category rows**: One card per subject — book icon chip (teal), subject name, count, chevron SVG; clicking sets `activeFilter` to that subject

### List View (subject selected)
- **Sort row**: Count of questions on left, "Recent First" / "Oldest First" / "Subject-wise" / "Wrong First" dropdown on right
- **Question cards** (`.sq-card`): Orange topic chip → 2-line question text → "Last Practiced: DD Mon YYYY" + "Correct: XX%" footer → progress bar; tapping card opens revision overlay; bookmark button top-right removes the saved question
- **Sticky CTA**: "Start Revision: N Questions →" floats above bottom nav when user has scrolled past 4 seconds of activity

### New CSS Classes
`.sq-chips-row`, `.sq-chip`, `.sq-summary-card`, `.sq-summary-icon`, `.sq-subject-row`, `.sq-subject-icon`, `.sq-sort-row`, `.sq-sort-select`, `.sq-card`, `.sq-bookmark-btn`, `.sq-tags-row`, `.sq-topic-tag`, `.sq-question-text`, `.sq-footer`, `.sq-meta`, `.sq-progress-track`, `.sq-progress-fill`, `.sq-empty-card`

### What Was NOT Changed
- All data fetching (`getSavedQuestions`, `unsaveQuestion`) — unchanged
- Revision overlay (`RevisionCard`) — unchanged
- Touch gestures, infinite scroll sentinel — unchanged
- Mark as revised logic — unchanged
- Routing — unchanged
- Guest mode / sign-in banner — unchanged

---

## Repeated Mistakes Changes

### Landing View (no subject selected)
- **Subject chips**: Scrollable — "All {N}", then each subject with count
- **Summary card**: Red info icon chip, "Questions You Repeat" heading, large count, "Repeated Mistakes" label
- **Practice All CTA**: Orange gradient button below summary
- **Subject category rows**: Red warning icon chip, subject name, count, chevron; clicking sets `questionSubject`

### List View (subject selected)
- **Topic chips**: Only shown when a subject is selected and has multiple topics
- **List header**: Question count + "Practice All" secondary button
- **Question cards** (`.rm-card`): Teal subject chip + orange topic chip on left, red "Nx times" pill on right → 2-line question text → "Last Practiced: X" + "· Correct: X%" footer + bookmark → progress bar → expandable section (answer detail, explanation) → "Practice Again" / "Open/Close" buttons

### New CSS Classes
`.rm-summary-card`, `.rm-summary-icon`, `.rm-subject-row`, `.rm-subject-icon`, `.rm-list-header`, `.rm-list-count`, `.rm-card`, `.rm-header`, `.rm-tags`, `.rm-subject-tag`, `.rm-topic-tag`, `.rm-repeat-pill`, `.rm-question-text`, `.rm-footer`, `.rm-meta`, `.rm-correct-label`, `.sq-progress-track`, `.sq-progress-fill`

### What Was NOT Changed
- All data fetching (`getHistoryQuestions`, `normalizeHistoryQuery`) — unchanged
- `startPractice` function (both single and batch) — unchanged
- `/api/history/reattempt-filtered` call — unchanged
- `toggleSave` function — unchanged
- Routing — unchanged
- Filter logic (`questionSubject`, `questionTopic`, `filteredMistakes`) — unchanged

---

## Preview Features Skipped (No Data Support)
| Feature | Reason |
|---|---|
| "By Topic" chip view on Saved landing | Topic grouping not in savedData structure |
| "Recent" chip as view mode | Handled by "Recent First" sort instead |
| Aggregate correct% from multiple attempts on Saved | Only last-attempt data in saved questions |
| "Most Repeated" sort label | API returns data already sorted; no client-side re-sort needed |

---

## Confirmation — No Logic Changed
- No API files changed
- No Mentor files touched
- No scoring/coins logic changed
- No Google Sheets logic changed
- No route names changed
- No data model changed
