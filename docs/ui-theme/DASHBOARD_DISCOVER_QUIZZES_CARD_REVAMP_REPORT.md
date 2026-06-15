# Dashboard Discover Quizzes Card Revamp Report

**Branch:** `ui/dashboard-discover-quizzes-revamp`
**Scope:** UI/layout only — Discover Quizzes section on Dashboard

---

## 1. Files Inspected

| File | Purpose |
|------|---------|
| `pages/dashboard.js` | Dashboard page — only file changed |
| `components/ui/AppCard.js` | Inspected — not changed |
| `components/ui/AppButton.js` | Inspected — not changed |
| `styles/globals.css` | Inspected — not changed |
| `lib/designTokens.js` | Inspected — not changed |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `pages/dashboard.js` | Discover Quizzes layout revamp — JSX only, no logic changed |

---

## 3. How the Preview Was Used

The attached preview image guided:
- Switching from 2-column cramped grid to stacked full-width cards
- SSC PYQs as a primary card with chips row + orange CTA button
- Parmar SSC as a secondary card with Coming Soon pill + "Notify Me →" text action
- Icon sizes (56×56 circle), card padding (20px), border-radius (22px)
- Chip styling: teal pills for PYQs, violet pill for Coming Soon

---

## 4. Old Layout Issue

The Discover Quizzes section used `grid grid-cols-2 gap-3` — two narrow equal-width cards side by side. Each card had to fit an icon, title, description, and pill in ~half the screen width, making them cramped and hard to scan.

---

## 5. New Stacked Card Layout

Two full-width cards stacked vertically inside the same `padding: '0 20px'` wrapper.

---

## 6. SSC PYQs Card Changes

- **Full-width** white card (was half-width)
- **Icon**: 56×56 teal circle with 📚 emoji (was 42×42 with ▣ symbol)
- **Title**: "SSC PYQs" at 16px (was 14px)
- **Description**: "Practice real previous year questions" (was "Previous year questions by topic")
- **Chips row**: `7,000+ Questions` · `Exam-level` · `Subject-wise` in teal pills
- **CTA button**: Full-width "Start PYQ Practice →" orange gradient button at bottom
- **Click behavior**: `handleDiscoverClick('PYQ', '/subjects?collection=PYQ')` — unchanged

---

## 7. Parmar SSC Card Changes

- **Full-width** white card (was half-width)
- **Icon**: 56×56 violet circle with 🎬 emoji (was 42×42 with ◒ symbol)
- **Title**: "Parmar SSC" at 16px (was 14px)
- **Description**: "Video-wise GK quizzes coming soon" (was "Parmar SSC special quizzes")
- **Coming Soon pill**: Violet tinted (`#7C3AED` text, `#F2EAFE` bg)
- **Notify Me →**: Orange text action on the right of the chips row
- **Arrow chip**: 32×32 circle chevron on far right
- **Click behavior**: `setModal('Parmar')` on the whole card — unchanged (opens existing notify modal)

---

## 8. View All Behavior

Unchanged. "View all →" button routes to `/subjects` via `router.push('/subjects')`.

---

## 9. PYQ Route Confirmation

All PYQ clicks use the existing route `/subjects?collection=PYQ` via `handleDiscoverClick('PYQ', '/subjects?collection=PYQ')`. No route changed.

---

## 10. Parmar Waitlist/Notify Behavior Confirmation

`setModal('Parmar')` is preserved on the Parmar card click. The existing notify modal, `handleNotifyInterest`, `notifyState`, `notifyLoading`, `notifyModalView`, and `parmarWaitlistCount` are all untouched.

---

## 11. Normal Dashboard Impact

Only the Discover Quizzes card layout changed. All other dashboard sections (topbar, stats, WEEKLY CHAMPIONS, bottom nav) are unaffected.

---

## 12. Bottom Nav Spacing

Unchanged. `pb-28` on the page wrapper ensures content clears the fixed bottom nav.

---

## 13. No API / Mentor / Logic Changes

- No `pages/api/**` files changed
- No Mentor files changed
- No data fetching, cache, auth, or business logic changed

---

## 14. Build Results

```
✓ Compiled successfully
No new errors.
```

---

## 15. Rollback Instructions

```bash
git checkout main
git branch -D ui/dashboard-discover-quizzes-revamp
```

Or after merge, revert the commit on `main`:
```bash
git revert HEAD
```
