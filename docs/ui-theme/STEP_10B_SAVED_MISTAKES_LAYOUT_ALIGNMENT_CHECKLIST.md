# STEP 10B — Saved Questions + Repeated Mistakes Layout Alignment Checklist

## Saved Questions

### Landing (All view)
| Item | Status |
|---|---|
| Summary card with teal bookmark icon chip | ✅ |
| "Your Saved Questions" heading | ✅ |
| Large question count number | ✅ |
| "Questions saved" label | ✅ |
| Scrollable subject chips with counts (All N, Subject N) | ✅ |
| Subject category rows with book icon + chevron | ✅ |
| Clicking category row navigates to subject list | ✅ |

### List View (subject selected)
| Item | Status |
|---|---|
| Subject chips remain visible at top | ✅ |
| Sort dropdown (Recent First / Oldest / Subject / Wrong) | ✅ |
| Question count label | ✅ |
| Question cards with orange topic chip | ✅ |
| 2-line clamped question text | ✅ |
| Teal bookmark button top-right | ✅ |
| "Last Practiced: DD Mon YYYY" footer | ✅ |
| "Correct: XX%" footer | ✅ |
| Progress bar (green/red by percentage) | ✅ |
| Tapping card opens revision overlay | ✅ |
| Sticky "Start Revision" CTA | ✅ |
| Revision overlay (RevisionCard) unchanged | ✅ |
| Infinite scroll sentinel | ✅ |
| Empty state within filtered view | ✅ |

### Logic Preservation
| Item | Status |
|---|---|
| getSavedQuestions / unsaveQuestion unchanged | ✅ |
| handleUnsave optimistic update | ✅ |
| markRevised / revisedIds localStorage | ✅ |
| sortOrder state + filtering | ✅ |
| RevisionCard component unchanged | ✅ |
| Guest mode / sign-in banner | ✅ |
| showCTA delayed animation | ✅ |

---

## Repeated Mistakes

### Landing (no subject selected)
| Item | Status |
|---|---|
| Scrollable subject chips with counts | ✅ |
| Summary card with red info icon | ✅ |
| "Questions You Repeat" heading | ✅ |
| Large count number | ✅ |
| "Repeated Mistakes" label | ✅ |
| "Practice All N" orange CTA | ✅ |
| Subject category rows with red icon + chevron | ✅ |
| Clicking row navigates to subject list | ✅ |
| Empty state when no mistakes | ✅ |

### List View (subject selected)
| Item | Status |
|---|---|
| Topic chips (when subject has multiple topics) | ✅ |
| Question count + Practice All header | ✅ |
| Teal subject chip + orange topic chip on card | ✅ |
| Red "Nx times" repeat count pill | ✅ |
| 2-line question text | ✅ |
| "Last Practiced" + "Correct: XX%" footer | ✅ |
| Bookmark icon button | ✅ |
| Progress bar | ✅ |
| Expandable section (answer details, explanation) | ✅ |
| "Practice Again" button | ✅ |
| "Open/Close" expand button | ✅ |
| Empty state within filtered view | ✅ |

### Logic Preservation
| Item | Status |
|---|---|
| getHistoryQuestions / normalizeHistoryQuery unchanged | ✅ |
| startPractice (single + batch) unchanged | ✅ |
| /api/history/reattempt-filtered call unchanged | ✅ |
| toggleSave optimistic update unchanged | ✅ |
| questionSubject / questionTopic state unchanged | ✅ |
| filteredMistakes useMemo unchanged | ✅ |
| Routing unchanged | ✅ |

---

## Validation
| Check | Status |
|---|---|
| `npm run lint` | ✅ No errors (2 pre-existing warnings) |
| `npm run build` | ✅ Compiled successfully |
| No API files changed | ✅ |
| No Mentor files changed | ✅ |
| No scoring/coins logic changed | ✅ |
| No Google Sheets logic changed | ✅ |
| No route names changed | ✅ |
