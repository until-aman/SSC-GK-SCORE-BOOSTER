# UI Step 16: Mentor Exact Layout Revamp Report

## Scope

Revamped the Mentor tab, Mentor setup flow, and Mentor setup edit flow to follow the attached SSC Quest Light Mentor preview as closely as the current Mentor data, routes, and frontend state allow.

This was a frontend-only UI/layout revamp. No API routes, Mentor generation logic, task action logic, rollover logic, Google Sheets logic, cache logic, route names, saved field names, status values, or backend validation were changed.

## Files Inspected

- `pages/mentor.js`
- `pages/mentor-setup.js`
- `pages/mentor-setup-edit.js`
- `components/MentorMessage.jsx`
- `components/MentorTaskCard.jsx`
- `components/MentorSetupStep.jsx`
- `components/TodaysPlanCard.jsx`
- `components/SubjectStatusPicker.jsx`
- `components/TopicStatusPicker.jsx`
- `components/ui/Loader.jsx`
- `components/ui/RefreshStatus.js`
- `styles/globals.css`
- `lib/mentorCopy.js`
- `lib/data/mentorData.js`
- `docs/ui-theme/STEP_15_GLOBAL_STATES_LIGHT_THEME_REPORT.md`
- `docs/ui-theme/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- latest `docs/ui-theme/` reports relevant to SSC Quest Light

## Files Changed

- `pages/mentor.js`
- `pages/mentor-setup.js`
- `pages/mentor-setup-edit.js`
- `components/MentorMessage.jsx`
- `components/MentorTaskCard.jsx`
- `components/MentorSetupStep.jsx`
- `components/TodaysPlanCard.jsx`
- `components/SubjectStatusPicker.jsx`
- `components/TopicStatusPicker.jsx`

## Preview Usage

The attached `mentor v2.png` preview was used as the primary layout target for:

- light teal-white page background
- sticky light headers
- Mentor pill placement
- Aapka Mentor avatar/message card
- preparation setup summary card
- Today&apos;s Plan progress card
- Today&apos;s Tasks white card list
- task type badges and status pills
- mentor insight card
- setup progress bars
- exam/day option cards
- preparation/time/subject-confidence cards
- plan preview summary and daily preview cards
- sticky orange setup CTA
- bottom-nav-safe spacing

## Mentor Home Changes

- Converted the Mentor page from dark surfaces to SSC Quest Light surfaces.
- Added a light sticky header with Mentor icon, title, Mentor pill, and existing notification bell.
- Restyled the Aapka Mentor card using the existing Mentor message and avatar asset.
- Restyled the Preparation Setup card with white surface, teal side accent, compact pills, and existing Edit route.
- Moved Today&apos;s Plan structure into a preview-aligned white card with progress bar, day label, active/later counts, and task count chip.
- Added a light Mentor Insight card derived from the first active task when available.
- Preserved all data reads, refresh behavior, onboarding checks, guest mode behavior, and task callbacks.

## Today&apos;s Tasks / Task Flow Changes

- Restyled task cards as white cards with semantic accents:
  - revision/practice: orange/amber
  - confidence/quiz-like checks: violet
  - coverage: teal
  - feedback/weakness: red
  - completed: green
  - later: amber
  - blocked: muted slate
- Preserved `onPrimary`, `onDone`, `onLater`, manual done, blocked, completed, snoozed, and pending behavior.
- Restyled the Completed / Later tray as a white accordion card.
- Resume/View buttons remain wired to the existing handlers/routes.

## Setup Exam + Days Left Changes

- Reworked `/mentor-setup` first screen to match the preview grouping: exam options plus days-left options on one slide.
- Used existing supported values only:
  - exam target values from the current page
  - days-left values from the current page
- Selected state uses teal border/background.
- Sticky bottom CTA uses the existing continue flow and disabled state.

## Setup Preparation + Subject Confidence Changes

- Reworked setup second screen to show preparation pace, daily GK time, and subject confidence in a single preview-aligned light layout.
- Kept the existing `pace`, `dailyGKTime`, and `subjectStatus` field names and values.
- `SubjectStatusPicker` now displays explicit status choices per subject instead of a dark cycling row.
- Existing subject status values were preserved:
  - `Not Started`
  - `Theory Done`
  - `Practice Started`

## Setup Plan Preview Changes

- Reworked setup final screen to match the preview&apos;s plan confirmation structure.
- Added a white Preparation Summary card using the current form values.
- Added a white Daily Plan Preview card using `generateTodaysPlan` output from existing frontend logic.
- Kept the final submit/save behavior unchanged.
- The CTA now reads `Create My Plan` and calls the same submit handler.

## Setup Edit Changes

- Converted `/mentor-setup-edit` to the same light visual language.
- Preserved profile loading, topic loading, save, cache clearing, confirm modal, and plan regeneration logic.
- Restyled edit option buttons, subject picker, topic picker, save CTA, and confirmation modal.

## Task State Changes

- Active task states use preview-style cards and CTAs.
- Completed state uses green success pill.
- Later/snoozed state uses amber pill and muted copy.
- Blocked state remains disabled and readable.
- Previously pending tasks use a white card with a paused-for-later pill and existing Resume action.

## Loading / Empty / Error States

- Existing global `Loader` is already SSC Quest Light.
- Mentor empty/setup-needed state now uses a white card, Mentor message, benefit list, and orange CTA.
- Mentor error states now use soft red cards with retry CTA.
- Setup/edit sign-in states inherit existing light `GoogleSignInCard`.

## Modal / Toast Changes

- Mentor question-count, confidence, coverage, blocker, and confirm-task modals now use Step 15 light modal styling.
- Mentor toast now uses a white toast card with semantic success/error text.
- Modal callbacks and toast trigger logic were not changed.

## Bottom Nav / Sticky CTA Spacing

- Mentor Home uses bottom-nav-safe padding.
- Manual 390px browser check confirmed the task CTA and Mentor Insight card can scroll fully above the fixed bottom nav.
- Setup screens use a fixed bottom CTA with enough page bottom padding for 390px mobile width.

## Step 15 Global UI Reuse

Reused Step 15 guidance for:

- white modal cards
- soft overlay
- white toast card
- soft borders/shadows
- navy/slate text hierarchy
- orange primary CTA
- teal secondary/action accents
- semantic green/amber/red state surfaces
- bottom-safe spacing

## Frontend-Only Behavior Added

- Setup fields were rearranged into three visual steps to match the preview more closely.
- Subject/topic status controls now show explicit chip choices, but save values are unchanged.
- Mentor Insight card derives its display from existing active task data when present.

## Preview Features Skipped Due To Missing Current Support

- No separate `/mentor/tasks` task-flow route was added because the current app exposes task flow inside `/mentor`.
- No fake chat action was added because the current Mentor UI does not have a real chat feature.
- No fake weak-subject summary was added to plan preview beyond existing form/plan data.
- No unsupported setup options such as `Final Revision` were added.

## Confirmations

- No API files changed.
- No Google Sheets logic changed.
- No Mentor plan generation logic changed.
- No Mentor setup save/edit logic changed.
- No Mentor task action logic changed.
- No Mentor rollover logic changed.
- No subject/topic status values changed.
- No coins, streak, scoring, auth, cache, or route-name logic changed.

## Validation

- `npm run lint`: passed.
  - Existing unrelated warnings remain in `pages/onboarding-slides.js` and `pages/quiz-setup.js`.
- `npm run build`: passed.
  - Same unrelated hook dependency warnings as lint.
- Manual mobile browser checks at 390px width:
  - `/mentor`: checked unauthenticated preview, guest generated Mentor Home, real generated task card, bottom-nav spacing, no horizontal overflow.
  - `/mentor-setup`: checked guest setup step 1, step 2, and plan preview.
  - `/mentor-setup-edit`: checked loaded DOM state, light content, no horizontal overflow. Screenshot capture timed out in the browser tool, but the route was loaded and readable.

## Rollback Instructions

To roll back Step 16 only, revert:

- `pages/mentor.js`
- `pages/mentor-setup.js`
- `pages/mentor-setup-edit.js`
- `components/MentorMessage.jsx`
- `components/MentorTaskCard.jsx`
- `components/MentorSetupStep.jsx`
- `components/TodaysPlanCard.jsx`
- `components/SubjectStatusPicker.jsx`
- `components/TopicStatusPicker.jsx`
- `docs/ui-theme/STEP_16_MENTOR_EXACT_LAYOUT_REVAMP_REPORT.md`
- `docs/ui-theme/STEP_16_MENTOR_EXACT_LAYOUT_REVAMP_CHECKLIST.md`

Do not revert unrelated pre-existing worktree changes unless intentionally rolling back those separate edits.
