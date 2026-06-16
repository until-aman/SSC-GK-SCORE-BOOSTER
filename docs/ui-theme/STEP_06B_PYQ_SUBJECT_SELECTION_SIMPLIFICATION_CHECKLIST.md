# Step 06B — PYQ Subject Selection Simplification Checklist

## Route & Page
- [ ] `/subjects?collection=PYQ` opens the same existing page (not a new route)
- [ ] URL stays `/subjects?collection=PYQ` throughout the flow

## Header
- [ ] Heading says `Select a subject`
- [ ] Subtitle says `Choose a subject to start previous year questions`
- [ ] Back button present (top left)
- [ ] Help icon present (top right)

## Search
- [ ] Search placeholder says `Search PYQ subjects...`
- [ ] Searching filters subjects correctly in PYQ mode

## PYQ Context Card
- [ ] Context card visible in PYQ mode (📚 icon, 🏆 trophy, title, description, chips)
- [ ] Mixed GK Challenge card hidden in PYQ mode
- [ ] Chips show count (`N PYQs`), `Exam-level`, `Subject-wise`

## Subject Cards
- [ ] Cards show subject name
- [ ] Cards show `N PYQs` count (not `N Questions`)
- [ ] Secondary subtitles hidden (no "Constitution • Govt", "Maps • Climate", etc.)
- [ ] Cards are visually cleaner (shorter min-height)
- [ ] Subject icon still visible
- [ ] Arrow button still visible

## Section Labels
- [ ] Group 1 shows `Core SSC Subjects` (not `Popular Subjects`)
- [ ] Group 2 shows `Science`
- [ ] Group 3 shows `History`

## Interaction
- [ ] Clicking a subject navigates to `/quiz-setup?subject=...&collection=PYQ&sourceScreen=dashboard`
- [ ] Topic selection and quiz setup flow still works end-to-end
- [ ] Search still filters subjects correctly

## Normal `/subjects` (no collection param)
- [ ] Heading still says `Select a subject`
- [ ] Subtitle says `Choose a subject to continue`
- [ ] Search placeholder says `Search subjects…`
- [ ] Mixed GK Challenge card visible
- [ ] PYQ context card hidden
- [ ] Subject cards show secondary subtitle
- [ ] Count shows `N Questions`
- [ ] Section labels use original names (`Popular Subjects`, `Science`, `History`)

## Design
- [ ] No dark cards
- [ ] No heavy gradients on subject cards
- [ ] White/soft teal page background
- [ ] Cards have white background, soft border, soft shadow

## Bottom Nav
- [ ] Bottom nav visible on page
- [ ] Last subject card not hidden behind bottom nav
- [ ] Content has sufficient bottom padding

## No Regressions
- [ ] No API files changed
- [ ] No Mentor files changed
- [ ] No quiz/topic/quiz-setup logic changed
- [ ] No Google Sheets logic changed
- [ ] `npm run lint` — no new errors
- [ ] `npm run build` — compiles successfully
