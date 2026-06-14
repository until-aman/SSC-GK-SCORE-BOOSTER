# STEP 09B — History + Quiz History Layout Alignment Report

## Files Inspected
- `pages/history.js`
- `pages/history/quizzes.jsx`
- `components/HistoryTopBar.js`
- `components/ui/AppCard.js`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `components/BackButton.js`
- `styles/globals.css`

## Files Changed
- `components/HistoryTopBar.js` — added `rightAction` prop
- `pages/history.js` — visual overhaul of landing (both guest + auth states)
- `pages/history/quizzes.jsx` — visual overhaul of Quiz History page

## Documentation Created
- `docs/ui-theme/STEP_09B_HISTORY_LAYOUT_ALIGNMENT_REPORT.md` (this file)
- `docs/ui-theme/STEP_09B_HISTORY_LAYOUT_ALIGNMENT_CHECKLIST.md`

---

## How the Preview Was Used

The attached screenshot shows 4 mobile frames:
1. **History landing** — "Review & Improve" heading, 6 vertical list cards with colored icons, helper text, chevrons
2. **Quiz History** — stats bar (4 cols), mode tabs, date chips, attempt cards with 5-col stats row, orange/teal CTAs
3. **Filter bottom sheet** — light white sheet, "Filters" + "Clear All", grouped pill chips, orange Apply CTA
4. **Empty state** — illustration icon, "No Quiz Attempts Yet" heading, orange "Start a Quiz" CTA

The preview was used as the primary layout reference for all section and card structures. All data and routing was preserved from the existing app; only presentation was changed.

---

## History Landing Changes

### What was present
- Benefit strip pill ("Review · Revise · Re-attempt · Track")
- Single grouped card with 6 rows, all using the same orange icon chip
- Plain HTML arrow (→) as row chevron
- No helper text per row

### What was added / changed
- **Intro section**: "Review & Improve" heading (font-display, 22px, bold navy) + "Choose what you want to review today" subtitle — replaces benefit strip
- **Per-feature icon colors**: Quiz History → teal; Saved Questions → orange; Repeated Mistakes → red/danger; Coins History → gold; Streak History → violet; Reports → blue
- **Icon chip size**: 44×44px (up from 32px) with rounded-[13px] corners
- **Helper text**: Short static description added per row using new `.history-feature-body` CSS class
- **SVG chevron**: Replaced `&rarr;` HTML entity with a proper `ChevronSVG` component
- **Header**: Simplified "History" title (removed "PRACTICE ARCHIVE" badge from the header title element)
- **Guest state**: Same visual changes applied; unchanged sign-in modal and locked-feature logic
- **CSS**: Shared `SHARED_STYLES` constant used in both auth + guest states to avoid duplication

### What was NOT changed
- All routes preserved (`/history/quizzes`, `/history/saved`, `/history/mistakes`, `/history/coins`, `/streak`, `/analysis`)
- Sign-in flow unchanged
- Guest mode detection unchanged
- Loading state unchanged

---

## Quiz History Changes

### Stats Summary
- **Before**: 2-col grid (Quizzes, Questions)
- **After**: 4-col 2×2 grid — Attempts, Questions, Saved Qs, Weak Recent
  - "Saved Qs" uses `summary.savedCount` (already in the existing summary payload)
  - "Weak Recent" is frontend-only derived: count of loaded sessions with `badgeTone === 'red' || 'orange'` — labelled "Weak Recent" to be honest about scope (only loaded sessions, not all)
  - No new API calls; no backend change

### Mode Selector
- **Before**: Fixed 4-col pill grid (overflow truncation on small screens)
- **After**: Horizontally scrollable pill row — each tab has equal `font-weight: 800`, teal fill when active, white border when inactive

### Quiz Attempt Cards (QuizCard)
- **Title separator**: Changed from `·` to `–` (en dash) for clarity
- **Date line**: Now shows `{questionCount} Questions · {DD Mon YYYY, HH:MM AM/PM}` using new `formatFullDateTime()` function
- **Stats layout**: Replaced 2-col metric + result row with a single **5-column horizontal stats row**: Score | 🪙 Coins | ✓ Correct | ✗ Wrong | ○ Skipped, separated by 1px dividers
- **Status pill**: Still uses existing `session.badge` + `session.badgeTone` from API; border opacity softened to `33` (was `55`)
- **Buttons**: Practice Mistakes gets a warning circle icon; Review Quiz gets a refresh icon; both are labelled consistently
- **Logic**: All click handlers, routing, and mistake-count logic unchanged

### Filter Bottom Sheet (MoreFiltersSheet)
- **Theme**: Fixed "white-text-on-white-background" bug (was `text-white` on `var(--ssc-surface)` which is white in light mode)
- **Header**: "Filters" title (dark navy) + "Clear All" teal link (replaces "× Close" secondary-btn)
- **Sections reordered**: Attempt Status → Question History → Time Period → Quiz Type → Subject
- **Labels**: Uppercase tracking-wide style (matching SSC Quest Light)
- **Attempt Status chips**: `['All', 'Good Attempts', 'Weak Attempts']` — maps to existing `answerStatus` filter values (`all`, `correct`, `wrong_skipped`)
- **Apply CTA**: Full-width orange gradient button "Apply Filters" (replaces the old 50/50 cancel/apply grid)
- **Logic**: All filter state (`draft`, `onApply`, `onReset`) unchanged

### Filter Trigger Button
- Added a "Filters" pill button (funnel icon) in the quiz mode chip row that opens the existing MoreFiltersSheet
- Shows teal highlight when any advanced filter is active
- This was previously wired (`sheetOpen` state existed) but had no trigger in the UI

### Refresh Icon
- Added via new `rightAction` prop on `HistoryTopBar`
- Triggers `loadSummary()` + `loadQuizzes()` — same functions already used on mount

### Empty State
- **Before**: `EmptyPanel` component (plain text + small CTA)
- **After**: Light white card with teal icon chip, "No Quiz Attempts Yet" heading, helper text, orange "Start a Quiz →" CTA button
- Applied in both `allZero` case (no history at all) and filtered empty case (no results for selected filter)

### Date Format Function
Added `formatFullDateTime(value)` — returns `"10 May 2025, 4:30 PM"` format using `en-IN` locale for the month abbreviation.

---

## Icon System Changes
- History landing now uses SVG icon paths with per-feature colors (no emoji, consistent stroke-based icons)
- Quiz cards use inline SVGs for Practice Mistakes (warning circle) and Review Quiz (refresh arrow) buttons
- Stats summary uses small icon chips per stat card
- Filter funnel icon added to filter trigger button
- Refresh icon added to Quiz History header

---

## Frontend-Only UI Behavior Added
1. **Filter trigger button** in quiz mode (opens existing `MoreFiltersSheet` — state was already there, just lacked a trigger)
2. **Refresh button** in Quiz History header (calls existing `loadSummary` + `loadQuizzes`)
3. **"Weak Recent" stat** derived from loaded session `badgeTone` values (presentational only, not saved/sent to API)
4. **Attempt status pill** visual style softened (same data, different border opacity)
5. **formatFullDateTime** — new date formatter (UI only)

---

## Preview Features Skipped (Backend/Data Support Missing)
| Feature | Reason Skipped |
|---|---|
| "72% Best Score" stat | Not in existing `summary` payload; would require new API field |
| "520 Coins Earned" total stat | Not in `summary`; would require new aggregation in API |
| "8 Weak Topics" total stat | Used "Weak Recent" derived from loaded sessions instead |
| Subject dropdown in filter sheet | Kept existing `filter-select` UI (same as before) |
| Sort By filter section | Not in current filter state — would require backend sort param |
| "View By" in filter sheet | Mode selector is top-level, not inside the filter sheet — merging would change UX flow |

---

## Bottom Nav Spacing Confirmation
- `history-shell` padding: `calc(158px + env(safe-area-inset-bottom))` — unchanged
- History landing: `pb-28` class on outer div — unchanged
- Filter sheet: `padding-bottom: calc(20px + env(safe-area-inset-bottom))` — added safe area
- No content hidden behind bottom nav at 390–430px width

---

## Confirmation — No Logic Changed
- ✅ No API files changed
- ✅ No Mentor files touched
- ✅ No history fetch logic changed (`loadSummary`, `loadQuizzes`, `loadSubjects`, `loadTopics`, `loadQuestions` unchanged)
- ✅ No filter logic changed (all filter state management identical)
- ✅ No routing changed
- ✅ No scoring/coins logic changed
- ✅ No Google Sheets logic changed
- ✅ No data model changed

---

## Rollback Instructions
```bash
git revert HEAD
# or restore individual files:
git checkout origin/main -- pages/history.js pages/history/quizzes.jsx components/HistoryTopBar.js
```
