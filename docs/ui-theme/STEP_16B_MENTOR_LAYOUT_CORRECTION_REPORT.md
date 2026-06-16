# STEP 16B Mentor Layout Correction Report

## Files inspected
- pages/mentor.js
- pages/mentor-setup.js
- pages/mentor-setup-edit.js
- components/MentorMessage.jsx
- components/MentorTaskCard.jsx
- components/MentorSetupStep.jsx
- components/TodaysPlanCard.jsx
- components/SubjectStatusPicker.jsx
- components/TopicStatusPicker.jsx
- components/ui/AppCard.js
- components/ui/AppButton.js
- components/ui/Loader.jsx
- components/ui/RefreshStatus.js
- components/BackButton.js
- styles/globals.css
- lib/designTokens.js
- lib/data/mentorData.js
- lib/mentorCopy.js

## Files changed
- pages/mentor.js
- pages/mentor-setup.js
- components/MentorMessage.jsx
- components/MentorTaskCard.jsx
- components/MentorSetupStep.jsx
- components/SubjectStatusPicker.jsx

## How the target preview was used
The attached Mentor preview was used as the source of truth for the Mentor Home hierarchy, compact card rhythm, Mentor hero card, preparation setup card, Today&apos;s Plan summary, compact task cards, setup progress/header, subject confidence row layout, and plan preview summary.

## What was wrong before
The previous Mentor tab was mostly a light recolor. It kept a separate sync pill above the main content, used a generic mentor message card instead of the preview hero, task cards were too tall, subject confidence rows were bulky, and the page did not visually match the compact phone layout in the preview.

## Mentor Home correction
Mentor Home now starts with a compact Aapka Mentor hero card, followed by Preparation Setup, Today&apos;s Plan, Today&apos;s Tasks, Mentor Insight, and pending sections. The standalone refresh/sync row was removed from the primary preview hierarchy.

## Today&apos;s Plan correction
The existing Today&apos;s Plan component remains the data source, but its task cards were tightened to match the preview: icon chip, type badge, title, helper text, metadata, status pill, and a compact CTA.

## Task card correction
Task cards now use compact white cards with soft type accents, small status pills, inline metadata, and one clear CTA. The old large stacked action card layout was removed.

## Setup slide correction
The setup shell was tightened with compact spacing, progress bar styling, safe sticky CTA, and ASCII-safe navigation labels. Option cards were reduced in size and made closer to the preview grid.

## Plan preview correction
The plan preview now includes Weak Subjects in the preparation summary using existing subject status values only.

## Preview features skipped due to missing data support
- Chat CTA: skipped because the current Mentor flow has no existing chat action or route.
- Six-step setup count: skipped because the current setup flow has three real steps.
- Exact preparation stage labels: skipped because the current schema stores pace values, not stage values.
- Weak/Average/Strong/Not Started four-state subject confidence: partially matched visually; the current schema supports three subject values, so labels map to existing values only.
- Separate Today&apos;s Tasks route: skipped because no separate route was present in the current Mentor flow.

## No logic/API changes
- No API files changed.
- No Mentor generation, save, edit, rollover, task action, cache, auth, quiz routing, or Google Sheets logic changed.
- No backend schema or Google Sheet columns changed.

## Rollback
Revert the following files:

```bash
git checkout -- pages/mentor.js pages/mentor-setup.js components/MentorMessage.jsx components/MentorTaskCard.jsx components/MentorSetupStep.jsx components/SubjectStatusPicker.jsx docs/ui-theme/STEP_16B_MENTOR_LAYOUT_CORRECTION_REPORT.md docs/ui-theme/STEP_16B_MENTOR_LAYOUT_CORRECTION_CHECKLIST.md
```
