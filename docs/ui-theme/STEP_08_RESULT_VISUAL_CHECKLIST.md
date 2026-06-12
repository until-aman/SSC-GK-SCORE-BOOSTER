# UI Step 8 Visual Checklist

Expected result: Result and Detailed Result should use SSC Quest Light surfaces. Other screens may remain mixed until their own steps.

## Result Screen

- Result page uses soft teal-white background.
- No-result/loading skeleton appears on a light background.
- Result summary card is white with soft border and shadow.
- Score is readable in orange/warning/slate depending on score value.
- Accuracy is readable in teal.
- Correct count uses success color.
- Wrong count uses danger color.
- Skipped count uses muted slate.
- Review Mistakes CTA is orange, rounded, and readable.
- Practice Again CTA is secondary, rounded, and readable.
- Coins/streak reward card uses light success/gold treatment.
- Next-step SSC PYQ card is white with orange CTA.
- Smart Review Tip / AI analysis card uses a light teal review accent.
- Guest sign-in card remains functional and readable.
- Weekly Champions result card is light and clickable.
- Feedback card is light with orange accent.
- Share result card is light with teal accent.
- Copy Result and WhatsApp share buttons remain readable.
- Feedback success toast uses light modal surface.
- Report issue modal uses white surface, readable chips, readable textarea, and disabled state.
- Content is not hidden behind bottom navigation.
- No white text appears on a white card.

## Detailed Result

- Sticky header is light and readable.
- Filter chips are visible on light background.
- Review Summary card uses white surface and readable status counts.
- Collapsed question cards are white with status chips.
- Correct questions use success soft state and clear Correct label.
- Wrong questions use danger soft state and clear Your answer / Correct labels.
- Skipped questions use warning/muted state and clear Skipped label.
- Explanation panels are readable on light info surfaces.
- AI/review tip panels are readable.
- Save for Revision and Mark as Understood chips remain tappable.
- Bookmark saved and unsaved states are visible.
- Long questions wrap without horizontal overflow.
- Long explanations wrap without horizontal overflow.
- Sticky bottom review CTA does not overlap important content.
- Empty filtered state is readable.
- 390-430px mobile widths remain usable.

## Regression Smoke

- Complete a quiz and land on `/result`.
- Open `/result/detailed` from Review Mistakes.
- Review a correct question.
- Review a wrong question.
- Review a skipped question.
- Save/unsave a question.
- Mark/unmark a question as understood.
- Generate or view AI explanation/tip if available.
- Use Practice Again.
- Use Review Mistakes.
- Use Copy Result.
- Use Share on WhatsApp.
- Open and close the feedback modal.
- Submit feedback if safe in a test environment.
- Smoke-check `/mentor` only; do not judge Mentor visual migration in this step.
