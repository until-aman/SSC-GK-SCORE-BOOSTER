# Step 09C — Quiz Review + Question Review Light Theme Fix Checklist

**Branch:** `ui/step-09c-quiz-review-light-theme`
**Date:** 2026-06-15

---

## Pre-flight

- [x] Feature branch created from `main`: `ui/step-09c-quiz-review-light-theme`
- [x] Both target files identified and read before editing
- [x] Step 15 global design system rules reviewed
- [x] Preview image analyzed — layout structure mapped to both pages

---

## Quiz Review Page (`pages/history/session/[sessionId].jsx`)

### Theme Conversion
- [x] Page background changed from `[background:var(--bg-app)]` to `bg-[var(--ssc-bg)]`
- [x] `TONES` constant updated — text colors now dark (suitable for light card backgrounds)
- [x] `.review-card` → white surface, `var(--ssc-border-soft)` border, `var(--ssc-shadow-card)` shadow
- [x] `.session-summary` → white card (was `#172D47`)
- [x] `.session-insight` → amber-tinted light card with flex layout
- [x] `.carousel-shell` → white card (was dark)
- [x] `.chip` → white background + soft border (was `#172D47`)
- [x] `.chip.active` → orange gradient fill
- [x] `.status.wrong` → soft red bg + `#DC2626` text + colored border
- [x] `.status.skipped` → soft amber bg + `#D97706` text + colored border
- [x] `.status.correct` → soft teal bg + `var(--ssc-teal)` text + colored border
- [x] `.primary-btn` → orange gradient (same) with `box-shadow`
- [x] `.secondary-btn` → white surface + teal text + soft border (was dark surface + light text)
- [x] `.save-btn` → light gray background (was dark)
- [x] `.answer-row.wrong` → soft red light tint (was dark opaque block)
- [x] `.answer-row.correct` → soft teal light tint (was dark opaque block)
- [x] `.answer-row.skipped` → soft slate light tint
- [x] `.answer-row .answer-value b.wrong` → `#DC2626`; `.correct` → `var(--ssc-teal)`
- [x] `.review-history-row` borders → `var(--ssc-border-soft)`
- [x] `.explain-box` → teal-tinted light background (was dark opaque)
- [x] `.explain-title` → `var(--ssc-teal)` (was `#FDBA74`)
- [x] `.session-action-bar` gradient → `var(--ssc-bg)` (was dark `var(--bg-app)`)
- [x] `.session-action-inner` → white frosted glass (was dark `rgba(13,27,46,.96)`)

### JSX Updates
- [x] `scoreColor` computed: red for negative, orange-deep for positive, muted for zero
- [x] Stat row: Tailwind dark classes replaced with inline `style={{ color: ... }}`
- [x] Insight card: added `💡` emoji + amber text color `#92400E`
- [x] Answer blocks: `.answer-value` wrapper + ✓/✗ SVG icons added
- [x] AI explanation: wrapped in soft violet `div` (purple tinted box)
- [x] Official explanation text: `text-slate-200` → inline `color: var(--ssc-text-secondary)`
- [x] Loading/error/unauth states: background + text colors updated to light theme
- [x] `HistoryTopBar` → added `badge="HISTORY"` to all render paths (loading, unauth, error, main)
- [x] Carousel nav: `← Previous` / `Next →` arrow text added

---

## Question Review Page (`pages/history/questions.jsx`)

### Theme Conversion
- [x] Page background changed from `[background:var(--bg-app)]` to `bg-[var(--ssc-bg)]`
- [x] `TONES` constant updated — dark text colors for light card backgrounds
- [x] `.history-card` → white surface + soft border + shadow (was `#172d47`)
- [x] `.review-summary-card` → white card (was dark gradient)
- [x] `.summary-total` → `var(--ssc-text-primary)` (was `#fff`)
- [x] `.summary-stat.correct/wrong/skipped` → appropriate light-theme colors
- [x] `.carousel-shell` → white card (was dark)
- [x] `.question-review-text` → `var(--ssc-text-primary)` (was `#f8fafc`)
- [x] `.question-history-stats` → `var(--ssc-border-soft)` borders
- [x] `.stat-correct/wrong/skipped` → teal / `#DC2626` / muted
- [x] `.save-icon-btn` → light gray background (was dark)
- [x] `.bottom-action-card` → white frosted glass (was dark)
- [x] `.open-detail-panel` → soft light `rgba(248,250,252,1)` (was dark)
- [x] `.detail-question` → `var(--ssc-text-primary)` (was `#f8fafc`)
- [x] `.answer-summary-row` → white surface + soft border
- [x] `.answer-summary-row.correct/wrong/skipped b` → light-theme colors
- [x] `.explanation-panel` → teal-tinted light background
- [x] `.option-row` → white + soft border (was dark)
- [x] `.option-row.correct/wrong` → light tint versions
- [x] `.divider` → `var(--ssc-border-soft)` (was white opacity)
- [x] `.chip` / `.chip.active` → same light pattern as session review

### JSX Updates
- [x] `HistoryTopBar` → added `badge="HISTORY"` prop
- [x] Header `h1`: `text-white` → `text-[var(--ssc-text-primary)]`
- [x] Header `p`: `text-slate-500` → `text-[var(--ssc-text-muted)]`
- [x] Unauthenticated message: `text-slate-300` → `text-[var(--ssc-text-secondary)]`
- [x] Official explanation: `text-slate-300` → inline `color: var(--ssc-text-secondary)`
- [x] No explanation: `text-slate-500` → inline `color: var(--ssc-text-muted)`
- [x] AI explanation: replaced `text-orange-100 p` with soft violet box
- [x] Empty state: `text-white` → `text-[var(--ssc-text-primary)]`; `text-slate-400` → muted
- [x] `📖 Show Explanation` icon added
- [x] `↺ Practice Again` icon added
- [x] Carousel nav: `← Previous` / `Next →` arrows

---

## Constraints Check

- [x] `pages/api/**` — NOT touched
- [x] Mentor files — NOT touched
- [x] No new API routes
- [x] No Google Sheets changes
- [x] No hardcoded quiz/question data
- [x] No scoring/coins/streak logic changes
- [x] No auth/session/cache/route logic changes
- [x] All filter logic preserved
- [x] All state variables preserved
- [x] All data fetch functions preserved
- [x] AI explanation lazy-load rules preserved (never auto-called)

---

## Quality Checks

- [x] `npm run lint` — passed (zero new warnings)
- [x] `npm run build` — passed (✓ Compiled successfully, 26/26 static pages)
- [x] Both pages appear in build output at expected sizes

---

## Docs

- [x] `docs/ui-theme/STEP_09C_QUIZ_REVIEW_LIGHT_THEME_FIX_REPORT.md` — created
- [x] `docs/ui-theme/STEP_09C_QUIZ_REVIEW_LIGHT_THEME_FIX_CHECKLIST.md` — this file

---

## Git

- [x] Feature branch: `ui/step-09c-quiz-review-light-theme`
- [ ] Commit
- [ ] Push
- [ ] PR created
- [ ] PR merged to `main`
