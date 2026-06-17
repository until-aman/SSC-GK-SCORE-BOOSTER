# Mentor Task Card UI Redesign Checklist

## Data visibility

- [x] Task type visible.
- [x] Subject visible when available.
- [x] Topic visible when available.
- [x] Question count visible when available.
- [x] Estimated time visible when available.
- [x] Mode/source visible.
- [x] Status visible.
- [x] CTA visible.
- [x] Maybe later visible when existing `onLater` handler is available.

## Display cleanup

- [x] Duplicate text removed from subject/topic display.
- [x] Missing subject falls back to `Mixed GK`.
- [x] Missing topic falls back to `Mixed Topic`.
- [x] Repeated-mistakes placeholder values display cleanly.

## States

- [x] Weak card style uses red status treatment.
- [x] Good card style uses green/teal status treatment.
- [x] Completed card style uses green/teal state and review CTA.
- [x] Later card style uses amber state and resume CTA.
- [x] Locked card style remains muted and readable.

## Surfaces

- [x] Mentor Home card layout updated through shared `MentorTaskCard`.
- [x] View All task card layout updated through shared `MentorTaskCard`.
- [x] Mobile width 390-430px considered through compact card spacing.

## Safety

- [x] No API files changed.
- [x] No Mentor business logic changed.
- [x] No Google Sheets logic changed.
- [x] No task action logic changed.
- [x] No task status schema changed.
