# Dashboard Discover Quizzes Card Revamp Checklist

## Section Header
- [ ] "DISCOVER QUIZZES" label visible on the left
- [ ] "View all →" link visible on the right
- [ ] "View all →" navigates to `/subjects`

## SSC PYQs Card
- [ ] Card is full-width (not cramped half-width)
- [ ] 📚 icon in teal circle visible
- [ ] Title: "SSC PYQs" visible and large
- [ ] Description: "Practice real previous year questions" visible
- [ ] Chips row: "7,000+ Questions", "Exam-level", "Subject-wise" all visible
- [ ] "Start PYQ Practice →" orange button visible at bottom of card
- [ ] Clicking button routes to `/subjects?collection=PYQ`
- [ ] Clicking card body also routes to `/subjects?collection=PYQ`

## Parmar SSC Card
- [ ] Card is full-width (not cramped half-width)
- [ ] 🎬 icon in violet circle visible
- [ ] Title: "Parmar SSC" visible
- [ ] Description: "Video-wise GK quizzes coming soon" visible
- [ ] "Coming Soon" violet pill visible
- [ ] "Notify Me →" orange text action visible
- [ ] Clicking anywhere on the card opens existing Parmar notify modal
- [ ] Notify modal still works (no regression)

## Layout
- [ ] Old two-column cramped grid is gone
- [ ] Cards are stacked vertically with breathing room
- [ ] No content hidden behind bottom nav
- [ ] Layout looks clean at 390–430px width

## No Regressions
- [ ] No API files changed
- [ ] No Mentor files changed
- [ ] Dashboard data fetching unchanged
- [ ] PYQ route unchanged (`/subjects?collection=PYQ`)
- [ ] `handleDiscoverClick` logic unchanged
- [ ] Parmar waitlist/notify logic unchanged
- [ ] `npm run lint` — no new errors
- [ ] `npm run build` — compiles successfully
