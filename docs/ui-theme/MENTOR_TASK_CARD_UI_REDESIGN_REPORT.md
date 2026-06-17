# Mentor Task Card UI Redesign Report

## Files inspected

- `components/MentorTaskCard.jsx`
- `components/TodaysPlanCard.jsx`
- `pages/mentor.js`
- `lib/mentorPlanEngine.js`
- `lib/sheets.js`

## Files changed

- `components/MentorTaskCard.jsx`

## What was wrong with the old task card

- The card could repeat the same value in the title and subject/topic line, such as `Repeated Mistakes` followed by `Repeated Mistakes - Repeated Mistakes`.
- Subject and topic were not separated clearly enough.
- The metadata row looked flat and did not read as a premium SSC Quest Light card.
- Completed and later states were visually softer than required and could lose their main action in compact layout.
- The visual hierarchy did not clearly answer mode, subject, topic, time, question count, reason, status, and action.

## New card structure

The task card now uses this structure:

- Left task icon chip.
- Top row with task type pill and right status pill.
- Main task title.
- Clear subject/topic line.
- Existing mentor reason/description text.
- Metadata row with time, question count, and source/mode.
- Bottom action row with low-emphasis `Maybe later` where available and the primary CTA.

## Subject/topic display rules

- Subject comes from existing `subject`, `subjectName`, or `subjectId`.
- Topic comes from existing `topic`, `topicName`, or safe display fallback.
- Missing subject displays as `Mixed GK`.
- Missing topic displays as `Mixed Topic`.
- Repeated-mistake placeholder data displays as `Mixed GK - Repeated Mistakes`.
- Duplicate subject/topic text is cleaned for display only.

## Metadata row changes

- Metadata now consistently shows available time, question count, and mode/source.
- Existing fields are used: `estimatedMinutes`, `durationMinutes`, `timeMinutes`, `questionCount`, `questionsCount`, `totalQuestions`, `sourceLabel`, `reason`, and `taskType`.
- No fake metadata is created when values are not available.

## Status pill changes

- Weak uses soft red.
- Medium and Later use soft amber.
- Good and Completed use soft green/teal.
- Locked uses neutral slate.

## CTA changes

- Compact cards use a balanced bottom action row.
- View All cards keep a stronger CTA treatment while matching the same card language.
- `Maybe later` remains a small low-emphasis text action when the existing handler is present.
- `Resume` and `Review Result` remain visible for later/completed task states.

## Duplicate text cleanup

- Repeated labels such as `Repeated Mistakes - Repeated Mistakes` are cleaned in the display helpers.
- Underlying task data is not changed.

## Confirmation no logic changed

- No task action handler was changed.
- No task status values were changed.
- No Mentor plan, setup, rollover, or API logic was changed.
- No API or Google Sheets files were changed.

## Rollback instructions

Revert `components/MentorTaskCard.jsx` to the previous version to restore the old Mentor task card UI.
