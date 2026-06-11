# Step 03 Visual Smoke Checklist

Expected result after Step 3: the app shell and bottom navigation should look light, while many page cards may still look dark.

## Required Smoke Checks

- App loads without a runtime error.
- Outer background is soft teal-white.
- Mobile app frame remains centered and max-width constrained.
- Bottom nav is fixed and visible.
- Bottom nav routes still work:
  - Home
  - Rank
  - Analysis
  - History
  - Mentor
- Active nav item is orange.
- Inactive nav items are muted slate.
- Analysis tooltip still appears if localStorage allows it.
- Pages with bottom nav have safe bottom spacing.
- Mentor route compiles/renders without Mentor-specific redesign.

## Screens To Inspect

- `/dashboard`
- `/leaderboard`
- `/analysis`
- `/history`
- `/mentor`
- `/quiz`
- `/result`

## Expected Non-Changes

- Dashboard cards may remain dark.
- Quiz cards/options may remain dark.
- Result cards may remain dark.
- History cards may remain dark.
- Analysis cards may remain dark.
- Profile and Dream Post cards may remain dark.
- Mentor message/task cards may remain dark.

## Validation Commands

- `npm run lint`
- `npm run build`

