# UI Step 5 - Dashboard SSC Quest Light Migration

## Scope

Migrated only the Dashboard/Home screen toward SSC Quest Light.

## Files Inspected

- `pages/dashboard.js`
- `components/NotificationBell.js`
- `components/WhatsAppBell.jsx`
- `components/TopPerformers.js`
- `components/GoogleSignInCard.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/RefreshStatus.js`
- `lib/designTokens.js`
- `styles/globals.css`

## Files Changed

- `pages/dashboard.js`

No API, Mentor-specific, route, cache, scoring, quiz, Google Sheets, or auth files were changed.

## Dashboard Sections Migrated

- Header/top app bar: changed from dark glass to light translucent white with soft border and shadow.
- Greeting area: inherited SSC Quest Light text tokens through Dashboard-scoped CSS variables.
- Daily Challenge: changed to a white/soft-orange hero card with orange CTA and light metadata pills.
- Coins/Streak/Rank cards: changed to white cards with soft borders, shadows, and token-based label color.
- Streak habit card: inherited light card variables and updated day circles for light surfaces.
- Guest sign-in nudge: inherits light Dashboard card variables.
- Social proof carousel: inactive indicators now use the light border token.
- Discover Quizzes: changed cards from dark navy to white cards with soft accent strips.
- Weekly Champions: changed champion slide cards from dark navy to soft white/teal/orange surfaces.
- Dashboard-owned low-question and coming-soon modals: changed to light modal surfaces and readable navy/slate text.

## Sections Skipped

- `components/WhatsAppBell.jsx` tooltip/modal remains for a later modal/toast pass because it is also used by Mentor and Analysis.
- `components/NotificationBell.js` was inspected but not changed because Dashboard currently renders `WhatsAppBell` in the top bar and notification modal polish belongs to the global modal/toast phase.
- `components/TopPerformers.js` was inspected but not changed because the Dashboard uses an inline Weekly Champions implementation.

## Visual Changes

- Dashboard now uses the SSC Quest Light shell: soft teal-white app background, white cards, navy/slate text, orange CTAs, teal progress/learning accents, gold reward accents, and violet rank accents.
- Dashboard-scoped CSS variable overrides allow existing Dashboard-owned `app-card` usage to render light without affecting other pages.
- Orange remains focused on primary CTAs and action highlights.

## Shared Components Changed

None.

## Indirect Impact

No shared component source was changed. The only indirect visual behavior is within Dashboard children that inherit the Dashboard-scoped CSS variables.

## Mentor Deferred Confirmation

No Mentor-specific file was edited. Mentor remains deferred. The shared `WhatsAppBell` was intentionally left unchanged to avoid redesigning Mentor indirectly.

## Known Remaining Mixed-Theme Areas

- Shared `WhatsAppBell` tooltip/modal can still appear dark when opened from Dashboard.
- Other pages remain partially or fully dark until their dedicated migration steps.
- Page-specific duplicated card styles outside Dashboard are not changed.

## Rollback

Revert only `pages/dashboard.js` to undo Step 5. No schema, API, route, auth, cache, or business logic rollback is needed.
