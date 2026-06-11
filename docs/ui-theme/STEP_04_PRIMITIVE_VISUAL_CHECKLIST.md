# Step 04 Primitive Visual Checklist

Expected result after Step 4: shared primitives may appear light, while page-local layouts and cards may still be dark.

## Dashboard

- Shared loaders should be readable on light surfaces.
- Refresh status should use slate text and teal action.
- Watch for dark page-local cards inside the light shell.
- Check for white text on white cards where `AppCard` is used.

## Subject Selection

- Full page migration is not expected yet.
- Check nav overlap and shell consistency.
- Page-local subject cards may remain dark/mixed.

## Quiz Setup

- Shared `AppCard` and `AppButton` may appear light.
- Check button contrast and disabled readability.
- Check select/input areas for mixed dark local styles.

## Quiz Player

- Shared missing/error cards using `AppCard` may appear light.
- Quiz option cards are page-local and may remain dark.
- Check loaders and full-screen overlay readability.

## Result

- Shared `AppCard`, `AppButton`, `SectionHeader`, and `Loader` may appear light.
- Result summary cards may still be mixed/dark if page-local.
- Check reward and review CTA contrast.

## History

- Shared loaders should be white/light.
- Back button should be white with navy icon where used.
- History cards and filters may still be dark until later phases.

## Saved

- Check loader and back-button readability.
- Saved question cards may remain page-local dark/mixed.

## Leaderboard

- Shared `AppCard`, `AppButton`, `SectionHeader`, `RefreshStatus`, and `Loader` may appear light.
- Rank rows may remain page-local dark/mixed.

## Analysis

- Shared sign-in card may appear light in guest/locked states.
- Analysis cards remain page-local until a later phase.

## Profile

- Shared sign-in or loader primitives should be readable.
- Dream Post/Profile cards remain page-local until later.

## Mentor Smoke Only

- Mentor should still build/render.
- Mentor loaders and refresh status may appear lighter.
- Mentor message/task/setup UI should not be redesigned.

## Common Issues To Look For

- broken card contrast
- broken button contrast
- unreadable loader/skeleton
- nav overlap
- white text on white background
- dark card inside light shell
- disabled button readability
- focus ring visibility

