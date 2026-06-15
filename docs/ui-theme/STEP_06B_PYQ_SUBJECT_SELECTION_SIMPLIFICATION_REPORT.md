# Step 06B — PYQ Subject Selection Simplification Report

**Branch:** `ui/step-06b-pyq-subject-simplification`
**Scope:** UI/layout only — PYQ mode conditional improvements to `/subjects?collection=PYQ`

---

## 1. Files Inspected

| File | Purpose |
|------|---------|
| `pages/subjects.js` | Main subjects page — only file changed |
| `components/ui/AppCard.js` | Inspected — not changed |
| `components/ui/AppButton.js` | Inspected — not changed |
| `styles/globals.css` | Inspected — not changed |
| `lib/designTokens.js` | Inspected — not changed |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `pages/subjects.js` | PYQ-conditional UI improvements — no logic changed |

---

## 3. How the Attached Preview Was Used

The preview image was used as the layout reference for:
- PYQ context card: `📚 Previous Year Questions` title + description + 3 chips + `🏆` trophy
- Subject card simplification: no secondary subtitle, count shows "N PYQs" instead of "N Questions"
- Section grouping labels: `Core SSC Subjects` / `Science` / `History` in PYQ mode
- Search placeholder: `Search PYQ subjects...`
- 2-column grid layout for all subject cards (already in place)

**Title correction applied:** Preview shows "SSC PYQ Practice" but per spec the heading remains `Select a subject`.

---

## 4. No Separate Page Created

`/subjects?collection=PYQ` continues to use the same existing `pages/subjects.js` page.
No new file was created. No new route was added.

---

## 5. Route Confirmation

Route remains: `/subjects?collection=PYQ`

The `isPYQ` flag is derived at runtime: `const isPYQ = collection === 'PYQ';`

All PYQ-specific UI is gated behind this flag. Normal `/subjects` is unaffected.

---

## 6. Header/Title/Subtitle Changes

| Element | Normal mode | PYQ mode |
|---------|-------------|----------|
| Title (h1) | `Select a subject` | `Select a subject` |
| Subtitle | `Choose a subject to continue` | `Choose a subject to start previous year questions` |

---

## 7. Search Placeholder Change

| Mode | Placeholder |
|------|-------------|
| Normal | `Search subjects…` |
| PYQ | `Search PYQ subjects...` |

---

## 8. PYQ Context Card

Shown only when `isPYQ`. Replaces the `Mixed GK Challenge` card which is hidden in PYQ mode.

- Icon: 📚 (teal-tinted circle, 48×48, rounded-14)
- Title: `Previous Year Questions` (navy, t-card-title)
- Description: `Practice real SSC exam questions subject-wise.` (slate)
- Trophy: 🏆 decorative on right
- Chips row: dynamic count (`N PYQs` from summed displayCounts, falls back to `7,000+ PYQs`), `Exam-level`, `Subject-wise`
- Style: white card, soft border, 20px radius, `var(--ssc-shadow-card)`, subtle teal glow top-left

---

## 9. Subject Card Simplification

In PYQ mode (`isPYQ === true`):
- Secondary subtitle (e.g. "Constitution • Govt", "Maps • Climate") is hidden — not rendered
- Count pill shows `N PYQs` instead of `N Questions`
- Card `min-height` reduced from `116px` to `90px` via `.subject-card-pyq` CSS class

In normal mode: all previous card content unchanged.

---

## 10. Section Label Changes

| Section | Normal label | PYQ label |
|---------|--------------|-----------|
| Group 1 | `Popular Subjects` | `Core SSC Subjects` |
| Group 2 | `Science` | `Science` |
| Group 3 | `History` | `History` |

`SUBJECT_SECTIONS` now has a `pyqLabel` field per section. Rendered as `isPYQ ? section.pyqLabel : section.label`.

---

## 11. Normal `/subjects` Impact

No change. All PYQ-specific rendering is behind `isPYQ` conditionals. Opening `/subjects` without `?collection=PYQ` shows the original layout:
- Title: `Select a subject`
- Subtitle: `Choose a subject to continue`
- Search placeholder: `Search subjects…`
- Mixed GK Challenge card visible
- PYQ context card hidden
- Subject cards show subtitle + "N Questions"
- Section labels use original names

---

## 12. Bottom Nav Spacing

Unchanged. `pb-28` on the wrapper + `<div style={{ height: 88 }} />` at the bottom — last card clears the fixed nav on all screen sizes.

---

## 13. Functionality Preserved (Unchanged)

- Subject click → `/quiz-setup?subject=...&collection=...&sourceScreen=dashboard`
- Topic/quiz setup flow
- `displayCounts` from API / localStorage cache
- Search filtering logic
- `collection` query param handling
- All state, effects, and query logic
- Error banner + retry
- Skeleton loading shimmer
- Slow-fetch hint

---

## 14. API / Mentor / Logic — Not Touched

- No `pages/api/**` files changed
- No Mentor files changed
- No Google Sheets logic changed
- No new routes added
- No auth/cache/session logic changed

---

## 15. Build Results

```
✓ Compiled successfully
/subjects   11.3 kB   114 kB
```

No errors. Two pre-existing ESLint warnings in unrelated files.

---

## 16. Rollback Instructions

```bash
git checkout main
git branch -D ui/step-06b-pyq-subject-simplification
```

Or after merge, revert the single commit on `main`:
```bash
git revert HEAD
```
