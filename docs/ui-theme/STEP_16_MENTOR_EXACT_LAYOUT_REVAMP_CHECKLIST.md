# UI Step 16: Mentor Exact Layout Revamp Checklist

## Mentor Home

- [x] Light sticky header
- [x] Mentor title and Mentor pill
- [x] Existing notification bell retained
- [x] Aapka Mentor card uses white/light surface
- [x] Mentor avatar/illustration retained from existing asset
- [x] Preparation Setup card uses white surface and teal accent
- [x] Existing exam, days-left, study-time, pace, and start date values are used
- [x] Edit button routes to existing setup edit flow
- [x] Today&apos;s Plan card uses white surface
- [x] Task completion count shown from existing progress
- [x] Day count shown from existing plan
- [x] Progress bar uses teal
- [x] Active/later count uses existing task state
- [x] Today&apos;s Tasks section shown
- [x] Task type badges shown
- [x] Task CTAs retained
- [x] Mentor insight card added from existing active task data
- [x] Completed / Later accordion retained and restyled
- [x] Previously Pending section retained and restyled
- [x] Bottom nav spacing checked at 390px

## Today&apos;s Tasks / Task Flow

- [x] Task cards use white surfaces
- [x] Active task cards are readable
- [x] Completed task card state uses green success
- [x] Later/snoozed task state uses amber
- [x] Blocked task state remains disabled/muted
- [x] Revision/practice task accents use orange/amber
- [x] Confidence/quiz-like task accents use violet/teal
- [x] Weak/feedback task accents use red
- [x] Resume/View actions retained
- [x] Bottom CTA/task CTA area scrolls above bottom nav
- [x] No separate task route added because current app does not expose one

## Setup Flow

- [x] Setup header is light
- [x] Progress indicator uses teal active bars
- [x] Exam options use supported existing values
- [x] Days-left options use supported existing values
- [x] Exam and days-left appear in preview-aligned grouped layout
- [x] Preparation stage uses existing pace values
- [x] Daily GK time uses existing values
- [x] Subject confidence picker uses existing subject status values
- [x] Subject rows/cards use white surfaces
- [x] Subject status selected states are visually distinct
- [x] Topic/status picker in edit flow uses light rows and existing topic status values
- [x] Plan preview shows existing form answers
- [x] Plan preview uses generated preview tasks from existing frontend logic
- [x] Create plan CTA uses existing submit handler
- [x] Disabled states use light disabled tokens
- [x] Loading/saving states preserved
- [x] Edit setup flow is light

## Loading / Empty / Error

- [x] Loading uses existing global light Loader
- [x] Empty/setup-needed card is light
- [x] Empty/setup-needed CTA is orange
- [x] Error states use soft red cards
- [x] Retry action retained

## Modals / Toasts

- [x] Question count modal is light
- [x] Confidence modal is light
- [x] Coverage modal is light
- [x] Blocker modal is light
- [x] Confirm task modal is light
- [x] Mentor toast uses white semantic state surface
- [x] No modal/toast logic changed

## General

- [x] No dark Mentor cards remain in checked Mentor surfaces
- [x] No white text on white cards found in checked routes
- [x] Orange CTA white text is intentional
- [x] No horizontal overflow at 390px
- [x] No bottom nav overlap after scrolling to bottom of Mentor Home
- [x] No sticky setup CTA overlap observed on setup preview screens
- [x] No API files changed
- [x] No Mentor business logic changed
- [x] No setup schema or status values changed
- [x] No Google Sheets logic changed
- [x] `npm run lint` passed
- [x] `npm run build` passed
- [x] Manual 390px checks completed for `/mentor` and `/mentor-setup`
- [x] `/mentor-setup-edit` DOM/light/overflow check completed; browser screenshot capture timed out
