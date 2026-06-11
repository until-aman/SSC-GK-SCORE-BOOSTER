# Step 03 App Shell And Bottom Navigation Report

Theme: SSC Quest Light  
Date: 2026-06-11  
Scope: app shell, page background layer, fixed bottom navigation, and safe bottom spacing.

## Files Changed

Source files:

- `pages/_app.js`
- `components/BottomNav.js`
- `styles/globals.css`

Documentation files:

- `docs/ui-theme/STEP_03_APP_SHELL_NAV_REPORT.md`
- `docs/ui-theme/STEP_03_VISUAL_SMOKE_CHECKLIST.md`

## Previous Docs Read

The Step 1 documents are present in this checkout under `docs/ui-theme/`:

- `docs/ui-theme/UI_THEME_AUDIT.md`
- `docs/ui-theme/SSC_QUEST_LIGHT_MIGRATION_MAP.md`
- `docs/ui-theme/UI_COMPONENT_INVENTORY.md`

Step 2 documents read:

- `docs/ui-theme/STEP_02_THEME_FOUNDATION_REPORT.md`
- `docs/ui-theme/STEP_02_THEME_TOKENS_REFERENCE.md`
- `docs/ui-theme/STEP_02_VISUAL_SMOKE_CHECKLIST.md`

## Changes Made

### `pages/_app.js`

- Replaced the old dark root shell class on the outer app wrapper with `ssc-app-root`.
- Replaced the old dark inner frame class with `ssc-app-frame`.
- Added `ssc-app-frame-with-nav` only when the existing `showNav` condition is true.
- Preserved the provider stack, `PageLoader`, `Analytics`, route list, and `BottomNav` placement.

### `styles/globals.css`

- Set `body` background to `var(--ssc-bg)` so overscroll and desktop margins match the light shell.
- Added Step 3 shell utilities:
  - `.ssc-app-root`
  - `.ssc-app-frame`
  - `.ssc-app-frame-with-nav`
  - `.ssc-bottom-nav-safe-area`
- Updated `.app-page` background to use the SSC Quest Light shell gradient and `--ssc-bg`.
- Preserved `.app-premium-bg` and all legacy dark variables/classes for backward compatibility.

### `components/BottomNav.js`

- Converted the fixed nav pill from dark glass to white/elevated light shell styling.
- Kept all routes, labels, icons, click handlers, tooltip timing, localStorage key, and active-route logic unchanged.
- Updated active tab background to a soft orange surface.
- Updated active/inactive icon and label colors to SSC Quest Light orange and muted slate.
- Updated the analysis tooltip surface to white with soft orange border and deep navy/slate text.

## What Was Not Changed

- No API route logic.
- No business logic.
- No route names.
- No navigation route list.
- No cache logic.
- No scoring logic.
- No quiz logic or timer logic.
- No Google Sheets logic.
- No page cards or page-local content redesign.
- No Mentor-specific files.

## Expected Visual Result

The app should now feel lighter at the shell level:

- soft teal-white app background
- centered mobile frame
- white floating bottom nav
- orange active nav item
- safer bottom spacing for fixed navigation

Many cards and page sections are expected to remain dark until later steps.

## Mentor Deferred Confirmation

No Mentor-specific files were edited. Mentor may inherit the shared shell and bottom navigation changes, but Mentor task/message/setup UI was not redesigned.

## Known Risks

- Some pages have their own full-screen dark backgrounds that may still cover the new shell.
- Pages with fixed bottom CTAs may still need page-specific spacing audits in their later migration phase.
- Mentor can be indirectly affected by shared shell/nav styling, so it requires smoke checking after this step.

## Rollback Instructions

To roll back Step 3 only:

1. Revert `pages/_app.js`.
2. Revert `components/BottomNav.js`.
3. Revert the Step 3 additions/changes in `styles/globals.css`.
4. Remove:
   - `docs/ui-theme/STEP_03_APP_SHELL_NAV_REPORT.md`
   - `docs/ui-theme/STEP_03_VISUAL_SMOKE_CHECKLIST.md`

Do not revert unrelated pre-existing Mentor/API worktree changes.

