# STEP 09B — History Layout Alignment Checklist

## History Landing

| Item | Status |
|---|---|
| Clean header with "History" title | ✅ |
| "Review & Improve" intro heading | ✅ |
| "Choose what you want to review today" subtitle | ✅ |
| Quiz History row with teal icon + helper text + chevron | ✅ |
| Saved Questions row with orange icon + helper text + chevron | ✅ |
| Repeated Mistakes row with red icon + helper text + chevron | ✅ |
| Coins History row with gold icon + helper text + chevron | ✅ |
| Streak History row with violet icon + helper text + chevron | ✅ |
| Reports row with blue icon + helper text + chevron | ✅ |
| SVG chevron (not HTML arrow entity) | ✅ |
| Per-feature colored icon chips (not all orange) | ✅ |
| White grouped card with soft borders and shadow | ✅ |
| Bottom nav safety (pb-28) | ✅ |
| Guest state: same visual changes applied | ✅ |
| Guest state: sign-in modal logic unchanged | ✅ |
| No routes changed | ✅ |

## Quiz History

### Header
| Item | Status |
|---|---|
| Back arrow via showBack prop | ✅ |
| "Quiz History" title | ✅ |
| Refresh icon on the right | ✅ |

### Stats Summary
| Item | Status |
|---|---|
| 4-column 2×2 stat grid | ✅ |
| Attempts stat (totalQuizzes) | ✅ |
| Questions stat (totalQuestions) | ✅ |
| Saved Qs stat (savedCount from summary) | ✅ |
| Weak Recent stat (derived from loaded sessions) | ✅ |
| Stat icons per card | ✅ |
| CountUp animation | ✅ |

### Mode Tabs
| Item | Status |
|---|---|
| Quiz-wise tab | ✅ |
| Subject-wise tab | ✅ |
| Topic-wise tab | ✅ |
| Mistakes tab | ✅ |
| Teal fill when active | ✅ |
| Horizontally scrollable (no overflow clipping) | ✅ |

### Date Chips
| Item | Status |
|---|---|
| All chip | ✅ |
| 7 Days chip | ✅ |
| 30 Days chip | ✅ |
| Custom chip (opens date range modal) | ✅ |
| Filter trigger button (funnel icon) | ✅ |
| Filter button highlights teal when filters active | ✅ |

### Quiz Attempt Cards
| Item | Status |
|---|---|
| Title: Subject – Topic | ✅ |
| Date: "N Questions · DD Mon YYYY, HH:MM AM/PM" | ✅ |
| Attempt status pill (badge from API) | ✅ |
| Status pill soft red/green/amber bg | ✅ |
| 5-col stats row: Score, Coins, Correct, Wrong, Skipped | ✅ |
| 1px vertical dividers between stats | ✅ |
| Practice Mistakes CTA (orange, with icon) | ✅ |
| Review Quiz CTA (teal outline, with icon) | ✅ |
| Practice Mistakes disabled when no mistakes | ✅ |
| White card background | ✅ |
| Soft card shadow | ✅ |
| Rounded 18px corners | ✅ |

### Filter Bottom Sheet
| Item | Status |
|---|---|
| Light white background | ✅ |
| Rounded top corners (24px) | ✅ |
| Sheet handle bar | ✅ |
| "Filters" title in dark navy | ✅ |
| "Clear All" teal link | ✅ |
| Attempt Status section with pill chips | ✅ |
| Question History section with pill chips | ✅ |
| Time Period section with pill chips | ✅ |
| Quiz Type section with pill chips | ✅ |
| Subject dropdown | ✅ |
| Orange "Apply Filters" full-width CTA | ✅ |
| Scrollable sheet (max-height: 88vh) | ✅ |
| Safe bottom spacing | ✅ |
| No logic changes to filter state | ✅ |

### Show More / Show Less
| Item | Status |
|---|---|
| "Show More ↓" button | ✅ |
| "Show Less ↑" button when expanded | ✅ |
| Logic unchanged | ✅ |

### Empty State
| Item | Status |
|---|---|
| Teal icon chip / illustration | ✅ |
| "No Quiz Attempts Yet" heading | ✅ |
| Helper text | ✅ |
| Orange "Start a Quiz →" CTA | ✅ |
| Shown in allZero case | ✅ |
| Shown when filter returns no results | ✅ |

### Bottom Nav Safety
| Item | Status |
|---|---|
| history-shell padding-bottom: calc(158px + safe-area) | ✅ |
| No card cut-off at 390–430px | ✅ |

## Validation

| Check | Status |
|---|---|
| `npm run lint` | ✅ No errors or warnings |
| `npm run build` | ✅ Compiled successfully (26/26 pages) |
| No API files changed | ✅ |
| No Mentor files changed | ✅ |
| No history fetch/filter/action logic changed | ✅ |
| No scoring/coins logic changed | ✅ |
| No Google Sheets logic changed | ✅ |
| No route names changed | ✅ |
