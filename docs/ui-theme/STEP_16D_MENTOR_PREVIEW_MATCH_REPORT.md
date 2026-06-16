# STEP 16D Mentor Preview Match Report

## Files inspected

- `pages/mentor.js`
- `components/MentorTaskCard.jsx`
- `components/TodaysPlanCard.jsx`
- `components/MentorMessage.jsx`
- `public/Mentor icon.png`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `components/BackButton.js`
- `styles/globals.css`
- `lib/designTokens.js`

## Files changed

- `pages/mentor.js`
- `components/MentorTaskCard.jsx`
- `components/TodaysPlanCard.jsx`
- `docs/ui-theme/STEP_16D_MENTOR_PREVIEW_MATCH_REPORT.md`
- `docs/ui-theme/STEP_16D_MENTOR_PREVIEW_MATCH_CHECKLIST.md`

## How the attached preview was used

The attached `mentor v2 final.png` was used as the visual source of truth for the Mentor Home order, Today&apos;s Tasks preview, View All task filters, card state styling, task metadata hierarchy, mentor illustration placement, and sticky bottom action row.

## Mentor Home match

- Mentor Home keeps the preview order: header, Aapka Mentor card, Preparation Setup card, Today&apos;s Plan card, Today&apos;s Tasks preview, Mentor Insight card, bottom nav spacing.
- The main tab now shows only a short Today&apos;s Tasks preview with a maximum of 3 active tasks.
- Completed/Later and Previously Pending trays were removed from the main Mentor tab.

## View All Tasks match

- The in-page Today&apos;s Tasks View All screen keeps the preview structure: back header, title, filter icon, All/Active/Completed/Later chips, full task list, sticky Plan Overview/Start Next Task row.
- Completed and Later tasks remain available through the View All filters.
- Later tasks use the existing resume action.

## Task card states

- Task cards now expose subject and topic on a dedicated line.
- Metadata row now prioritizes estimated time, question count, and mode/source.
- Later tasks show a Resume CTA in the View All flow.
- Existing status pills remain mapped to Weak, Medium, Good, Completed, Later, and Locked colors.

## Task review/question flow

- Mentor practice/revision tasks continue to use the existing quiz/review routing and shared question flow.
- No quiz answer checking, previous/next behavior, explanation logic, bookmark logic, or result logic was changed for this Mentor UI pass.

## Mentor illustration/avatar handling

- Used the existing `public/Mentor icon.png` asset through `TeacherMentorIcon`.
- No external image dependency was added.
- The illustration remains left-aligned in the Aapka Mentor card and soft teal icon containers.

## Task metadata visibility changes

- Subject visible: from `subject`, `subjectName`, or `subjectId`.
- Topic visible: from `topic`, `topicName`, `displayName`, or task title.
- Questions visible when `questionCount`, `questionsCount`, or `totalQuestions` exists.
- Time visible when `estimatedMinutes`, `durationMinutes`, or `timeMinutes` exists.
- Mode/source visible from source label, task reason, task status, or task type.

## Completed/Later tray removal

- Removed Completed/Later tray rendering from the main Mentor tab.
- Removed the Previously Pending long section from the main Mentor tab.
- Completed/Later/Pending tasks remain accessible in View All.

## Global components reused

- Reused SSC Quest Light colors, white card surfaces, soft borders, soft shadows, rounded cards, teal chips, orange CTAs, status pills, fixed bottom nav spacing, and existing Mentor icon asset.

## Preview features skipped due to missing data support

- Exact task labels such as `Mostly Wrong` or `Mostly Incorrect` only appear when current task data/reason supports them.
- Exact mentor copy may differ because the UI uses existing Mentor copy and API snapshot messages.
- Exact review-question screen was not rewritten because Mentor tasks route into the existing quiz/question flow and the request forbids changing quiz/review logic.

## Confirmations

- No Mentor API route was changed for this Step 16D UI pass.
- No Mentor business logic, task status values, setup schema, rollover logic, or Google Sheets logic was changed for this Step 16D UI pass.
- No new backend APIs, Sheet columns, or fake task values were added.

## Rollback instructions

Revert these files to roll back this Mentor preview-match correction:

- `pages/mentor.js`
- `components/MentorTaskCard.jsx`
- `components/TodaysPlanCard.jsx`
- `docs/ui-theme/STEP_16D_MENTOR_PREVIEW_MATCH_REPORT.md`
- `docs/ui-theme/STEP_16D_MENTOR_PREVIEW_MATCH_CHECKLIST.md`
