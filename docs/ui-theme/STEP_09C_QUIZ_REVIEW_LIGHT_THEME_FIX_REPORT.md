# Step 09C — Quiz Review + Question Review Light Theme Fix Report

**Branch:** `ui/step-09c-quiz-review-light-theme`
**Date:** 2026-06-15
**Scope:** UI-only — layout and theme conversion to SSC Quest Light

---

## 1. Objective

Convert two review pages from dark theme (`#172D47` backgrounds, light-on-dark text) to the SSC Quest Light design system. Both pages are opened from the Quiz History list:

- **"Review Quiz"** → `pages/history/session/[sessionId].jsx`
- **"Review Questions"** → `pages/history/questions.jsx`

All existing functionality (filtering, carousel navigation, AI explanation, bookmarks, reattempt, practice set) was preserved exactly as-is.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `pages/history/session/[sessionId].jsx` | Full light-theme conversion |
| `pages/history/questions.jsx` | Full light-theme conversion |

---

## 3. Design Tokens Used

All styles use SSC Quest Light CSS custom properties:

| Token | Role |
|-------|------|
| `--ssc-bg` | Page background (replaces dark `--bg-app`) |
| `--ssc-surface` | Card background (replaces `#172D47`) |
| `--ssc-border-soft` | Card borders (replaces `rgba(255,255,255,.08)`) |
| `--ssc-shadow-card` | Card box-shadows |
| `--ssc-text-primary` | Navy headings (replaces `#F8FAFC`) |
| `--ssc-text-secondary` | Slate body text (replaces `#CBD5E1`) |
| `--ssc-text-muted` | Muted labels (replaces `#94A3B8`) |
| `--ssc-teal` | Secondary actions, correct answer color, teal accents |
| `--ssc-teal-soft` | Teal soft backgrounds |
| `--ssc-orange-deep` | Positive score color |

---

## 4. Quiz Review Page (`[sessionId].jsx`) — Changes

### Theme Changes
- Page background: `[background:var(--bg-app)]` → `bg-[var(--ssc-bg)]`
- **TONES constant** updated for light cards:
  - Old: light text colors (`#FCA5A5`, `#FCD34D`, `#86EFAC`) for dark backgrounds
  - New: dark text colors (`#B91C1C`, `#B45309`, `#047857`) for white card backgrounds

### Style Block Rewrite
Complete rewrite of the inline `<style>` block:
- `.review-card` → white surface with `var(--ssc-border-soft)` border + `var(--ssc-shadow-card)` shadow
- `.primary-btn` → orange gradient (same) but added `box-shadow: 0 4px 12px rgba(255,107,22,0.25)`
- `.secondary-btn` → white surface + teal text + soft border (was dark surface + light text)
- `.chip` → white background + soft border (was dark `#172D47`)
- `.chip.active` → orange gradient (was amber-tinted dark)
- `.status.wrong/skipped/correct` → soft-color background + dark text + colored border (was light text only)
- `.session-summary` → white card (was dark `#172D47`)
- `.session-insight` → amber-tinted light card with flex + 💡 icon
- `.carousel-shell` → white card (was dark)
- `.session-action-bar` → gradient uses `var(--ssc-bg)` (was dark `var(--bg-app)`)
- `.session-action-inner` → white frosted glass (was dark `rgba(13,27,46,.96)`)
- `.answer-row.wrong/correct/skipped` → soft-color light backgrounds with colored borders
- `.answer-row .answer-value b` → colored text (`#DC2626` wrong, `var(--ssc-teal)` correct)
- `.review-history-row` → uses `var(--ssc-border-soft)` dividers
- `.explain-box` → teal-tinted light background (was dark `rgba(15,23,42,.55)`)

### JSX Changes
- **Score color**: `scoreColor` computed — red for negative, orange-deep for positive, muted for zero
- **Stat row**: `text-emerald-300`, `text-red-300`, `text-slate-400` replaced with inline `style={{ color: ... }}`
- **Insight card**: Added `💡` emoji + amber text color `#92400E`
- **Answer blocks**: Added `.answer-label` + `.answer-value` wrapper div with ✓/✗ SVG icons
- **AI explanation**: Wrapped in soft violet box (purple tinted) instead of `text-orange-100`
- **Official explanation**: `text-slate-200` → inline `color: var(--ssc-text-secondary)`
- **No explanation**: `text-slate-500` → inline `color: var(--ssc-text-muted)`
- **HistoryTopBar**: Added `badge="HISTORY"` prop to all render paths
- **Loading/error/unauth states**: Changed `[background:var(--bg-app)]` → `bg-[var(--ssc-bg)]`; text colors updated to light theme

### Layout Additions (UI-only, matching preview)
- Check/cross SVG icons next to "Your Answer" and "Correct Answer" text
- Lightbulb emoji before insight text
- ← Previous / Next → arrows in carousel nav buttons
- `📖 Show Explanation` and `↺ Practice Again` icons in action buttons
- `↺ Re-attempt Full Quiz` icon in sticky CTA bar

---

## 5. Question Review Page (`questions.jsx`) — Changes

### Theme Changes
- Page background: `[background:var(--bg-app)]` → `bg-[var(--ssc-bg)]`
- **TONES constant** updated for light cards (same pattern as above, 5 tones: red/amber/green/blue/grey)

### Style Block Rewrite
Complete rewrite of the inline `<style>` block:
- `.history-card` → white surface + soft border + shadow (was dark `#172d47`)
- `.review-summary-card` → white card (was dark gradient)
- `.summary-total` → `var(--ssc-text-primary)` (was `#fff`)
- `.summary-label` → `var(--ssc-text-muted)` (was `#8fa3bd`)
- `.summary-stat.correct/wrong/skipped` → teal / `#DC2626` / muted (was light-on-dark colors)
- `.carousel-shell` → white card (was dark)
- `.question-review-text` → `var(--ssc-text-primary)` (was `#f8fafc`)
- `.question-kicker` → `var(--ssc-teal)` (kept teal, but now works on white bg)
- `.question-history-stats` → `var(--ssc-border-soft)` dividers (was `rgba(148,163,184,.10)`)
- `.stat-correct/wrong/skipped` → teal / `#DC2626` / muted (was `#5eead4` / `#fca5a5` / `#93a4ba`)
- `.question-action-row .save-icon-btn` → light gray background (was dark)
- `.bottom-action-card` → white frosted glass (was dark `rgba(13,27,46,.72)`)
- `.open-detail-panel` → soft light background `rgba(248,250,252,1)` (was dark `rgba(15,23,42,.28)`)
- `.detail-question` → `var(--ssc-text-primary)` (was `#f8fafc`)
- `.answer-summary-row` → white card + soft border (was dark)
- `.answer-summary-row .correct/wrong/skipped b` → teal / `#DC2626` / muted (was light colors)
- `.explanation-panel` → teal-tinted light background (was dark)
- `.option-row` → white + soft border (was dark)
- `.option-row.correct/wrong` → teal / red tint (lighter values for white bg)
- `.divider` → `var(--ssc-border-soft)` (was `rgba(255,255,255,.07)`)

### JSX Changes
- **Header h1**: `text-white` → `text-[var(--ssc-text-primary)]`
- **Header p**: `text-slate-500` → `text-[var(--ssc-text-muted)]`
- **Unauthenticated**: `text-slate-300` → `text-[var(--ssc-text-secondary)]`
- **Official explanation**: `text-slate-300` → inline `color: var(--ssc-text-secondary)`
- **No explanation**: `text-slate-500` → inline `color: var(--ssc-text-muted)`
- **AI explanation**: replaced `text-orange-100 p` with soft violet box div
- **Empty state**: `text-white` → `text-[var(--ssc-text-primary)]`; `text-slate-400` → `text-[var(--ssc-text-muted)]`
- **HistoryTopBar**: Added `badge="HISTORY"` prop
- **Show Explanation button**: Added `📖` icon
- **Practice Again button**: Added `↺` icon
- **Carousel buttons**: Added ← / → arrows

---

## 6. Functionality Preserved (Unchanged)

All of the following were left completely untouched:

- `getHistorySession()` fetch and response handling
- `getHistoryQuestions()` + `normalizeHistoryQuery()` fetch and response handling
- `toggleSavedQuestion()` optimistic save/unsave flow
- `getAIExplanation()` lazy-load AI call rules (never auto-called)
- Filter logic: 5 filters (`Wrong + Skipped`, `Wrong`, `Skipped`, `Correct`, `Saved`)
- Carousel navigation: `safeActiveQuestionIndex`, `filtered`, `activeQuestionIndex` state
- `startReattempt()` with `sessionStorage` + router.push
- `startQuestionSet()` / `practiceFilteredSet()` functions
- All route logic, auth checks, cache scopes
- `insight()` function output (unchanged)
- `formatDate()`, `formatTime()`, `optionText()` (unchanged)
- Question card expand states (`expanded`, `questionExpanded`)
- AI cache in component state vs page-level `aiCache` object

---

## 7. Build Results

```
✓ Compiled successfully
✓ Generating static pages (26/26)
/history/questions             8.31 kB   114 kB
/history/session/[sessionId]   9.12 kB   115 kB
```

No errors. Two pre-existing ESLint warnings in unrelated files (not introduced in this step).

---

## 8. Constraints Respected

- No `pages/api/**` files touched
- No Mentor files touched
- No new API routes added
- No Google Sheets logic changed
- No hardcoded quiz data, scores, question text, or answers
- No scoring, coins, streak, or cache logic changed
- UI-only: layout polish matching the SSC Quest Light preview
