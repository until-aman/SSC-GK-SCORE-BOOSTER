# UI Step 15: Global States Visual Checklist

## Modals

- Notification reminder modal uses white card, navy title, slate body text.
- Notification blocked state uses soft danger treatment.
- Notification enabled/saved state uses teal success treatment.
- WhatsApp/community modal uses white card and soft overlay.
- Dashboard coming-soon/waitlist modal surfaces remain light and readable.
- Close buttons are visible and tappable.
- Modal content fits 390-430px mobile width.

## Toasts

- Coins toast is white, elevated, and readable.
- Dashboard notify toast is white with semantic icon chip.
- Toasts sit above the bottom navigation.
- Toast progress indicator is visible on light background.
- Success, info, warning, and error toasts do not rely only on color.

## Empty States

- Future empty states should use `.ssc-empty-state`.
- Use a friendly icon chip, navy title, slate explanation, and one clear CTA.
- Check no history, no saved, no repeated mistakes, no leaderboard, no analysis, no search results, and no questions available states during final QA.

## Loading

- `Loader` remains light with teal spinner.
- `PageLoader` remains functional.
- `.skeleton` remains pale teal/slate.
- Button loading states should use disabled tokens and readable text.

## Errors

- Future errors should use `.ssc-error-state`.
- Retry cards should use white surface, soft danger/warning icon chip, and orange/teal action.
- API/auth/invalid result errors should stay readable and calm.

## Notification / Community

- Notification bell is visible on light headers.
- Time chips have active/inactive contrast.
- WhatsApp tooltip is white and readable.
- WhatsApp modal CTA remains green and route behavior remains unchanged.

## Reusable UI System

- `.ssc-modal-overlay` and `.ssc-modal-card` are the preferred modal foundation.
- `.ssc-toast-card` is the preferred toast foundation.
- `.ssc-empty-state` and `.ssc-error-state` are the preferred state-card foundations.
- `.ssc-icon-chip` is the preferred state icon treatment.
- `.ssc-light-button-primary`, `.ssc-light-button-secondary`, `.ssc-light-chip`, `.ssc-light-input`, and `.ssc-light-disabled` remain the preferred primitive helpers.
- Use SSC semantic colors consistently: teal/info, success, warning, danger, coin gold, rank violet.

## General

- No white text on white cards.
- No dark global state surfaces unless documented as a deferred legacy surface.
- No modal or toast should overflow horizontally.
- Focus states should remain visible.
- Disabled states should remain readable.
- Bottom-nav-safe spacing should be preserved.
- Mentor should smoke-render, but Mentor-specific UI remains deferred.
