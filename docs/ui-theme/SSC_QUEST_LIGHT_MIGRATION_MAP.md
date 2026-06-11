# SSC Quest Light Migration Map

Status: plan-only. No UI code has been changed.

## Theme Direction

`SSC Quest Light` should feel light, calm, premium, mobile-first, habit-forming, and clear for SSC aspirants. It should preserve the app’s gamified motivation through streak, coins, rank, and Dream Post progress without feeling childish or stressful.

## Mentor-Deferred Rule

Do not implement Mentor-specific light-theme changes until the user explicitly confirms the parallel Mentor coding work is complete.

Early shared-token work must be validated against Mentor but should not intentionally redesign:

- `pages/mentor.js`
- `pages/mentor-setup.js`
- `pages/mentor-setup-edit.js`
- `components/MentorMessage.jsx`
- `components/MentorTaskCard.jsx`
- `components/MentorSetupStep.jsx`
- `components/TodaysPlanCard.jsx`

## Non-Negotiable Constraints

Do not change:

- quiz logic
- scoring
- API logic
- Google Sheets logic
- cache logic
- auth logic
- routes
- business logic
- Mentor-specific files before explicit approval

## Proposed Token Mapping

| Token | Hex | Replaces current values | Intended usage | Affected screens | Accessibility note | Risk |
|---|---|---|---|---|---|---|
| `app-bg` | `#F3FBFA` | `#0D1B2E`, `var(--bg-app)`, `[background:var(--bg-app)]` | default app background | all pages | low-stress, enough contrast with white cards via border/shadow | High |
| `app-bg-alt` | `#F8FAFC` | dark alternate backgrounds | alternate page bands | landing, analysis, onboarding | use sparingly to avoid flatness | Low |
| `surface` | `#FFFFFF` | `#172D47`, `bg-[#172d47]`, `bg-card` | normal cards | all card-heavy pages | needs border/shadow on white bg | High |
| `surface-soft` | `#F8FEFD` | `#112236`, nested dark cards | nested cards, filter strips | history, quiz setup, mentor later | keep readable with navy text | Medium |
| `surface-elevated` | `#FFFFFF` | `#1E3554`, `bg-elevated` | raised cards, modals, bottom nav | dashboard, nav, modals | use shadow, not dark fill | Medium |
| `border-soft` | `#DDE8F0` | `border-white/[0.08]`, `rgba(255,255,255,0.08)` | card/input borders | all pages | visible but quiet | High |
| `text-primary` | `#102033` | `text-white`, `#F0F4F8` | headings/body primary | all pages | AAA/AA on white likely strong | High |
| `text-secondary` | `#5B6B82` | `text-slate-400`, `#94A3B8` | body/meta | all pages | check small captions | Medium |
| `text-muted` | `#8A98AA` | `text-slate-500`, `#64748B`, `#7A8FA6` | captions, disabled-ish labels | all pages | avoid below 12px | Medium |
| `text-inverse` | `#FFFFFF` | current white text | only on dark/orange CTAs | CTA, badges | keep contrast on orange | Low |
| `brand-orange` | `#FF6A00` | `#FF6B16`, `#FF7A1A`, `#f97316` | primary CTA, active nav, selected chips | dashboard, quiz, result | white text okay; navy text may improve | Medium |
| `brand-orange-deep` | `#F45100` | `#FF5A00`, `#E55E0E` | hover/gradient stop | CTAs | avoid large red-orange blocks | Low |
| `brand-teal` | `#0EA5A4` | `#14B8A6`, `#2DD4BF` | learning/progress/success | progress, analysis, mentor later | good on white if dark enough | Medium |
| `brand-teal-soft` | `#E8F8F6` | teal alpha on dark | soft teal chips/cards | progress hints, selected states | pair with teal/navy text | Low |
| `coin-gold` | `#F6B331` | `#F59E0B`, `#FCD34D` | coins/rewards | dashboard, result, profile, streak | use dark text on gold fills | Medium |
| `rank-violet` | `#6D5DF6` | `#7C5CFF`, `#7C3AED`, `#6366F1` | rank/achievement sparingly | leaderboard, achievements | avoid low contrast violet text | Medium |
| `streak-amber` | `#F59E0B` | amber/orange streak colors | streak active/reward | dashboard, streak | avoid color-only state | Medium |
| `success` | `#12B886` | `#22C55E`, green | correct/success | quiz, result, history | use icon and label | High |
| `success-soft` | `#E7FAF3` | green alpha dark | success background | quiz feedback, toast | pair with dark green/navy text | Medium |
| `warning` | `#F59E0B` | amber warning | low time, streak risk | quiz/streak | needs text/icon | High |
| `warning-soft` | `#FFF7E6` | amber alpha dark | warning cards | quiz/streak | pair with deep amber/navy | Medium |
| `danger` | `#EF4444` | red wrong/error | wrong/error | quiz/result/history | use not color-only | High |
| `danger-soft` | `#FEECEC` | red alpha dark | wrong answer bg | quiz/result | text must be dark red/navy | High |
| `info` | `#2563EB` | blue/indigo accents | neutral info | onboarding/analysis | use sparingly | Low |
| `info-soft` | `#EFF6FF` | blue alpha dark | info cards | onboarding | good contrast with navy | Low |
| `disabled-bg` | `#EEF3F7` | opacity-only disabled | disabled controls | setup/mentor later | visible shape | Medium |
| `disabled-text` | `#9AA8B8` | `text-disabled`, opacity | disabled labels | all forms | avoid below 12px | Medium |
| `focus-ring` | `#0EA5A4` | orange/teal focus mixes | keyboard focus | inputs/buttons | must be visible on white | High |
| `overlay` | `rgba(16,32,51,0.45)` | black overlays | modals/sheets | all modals | keep backdrop readable | Medium |

## Color Role Decisions

- Orange remains the primary action color, not general decoration.
- Teal becomes learning/progress/success mentor-like accent.
- Gold is reserved for coins, rewards, streak bonuses, and top-rank highlights.
- Violet is reserved for rank/achievement and should be used sparingly.
- Red/green answer states must include icons/text, not color only.
- Dark navy remains only as text and limited inverse areas, not the app background.

## Component Migration Recommendations

| Component/primitive | Recommendation | Do not touch initially | Preview required | Risk |
|---|---|---|---|---|
| Global CSS/Tailwind tokens | Add light token aliases while preserving legacy names until pages migrate | routes/API/cache | all main pages smoke | High |
| `AppCard` | Change only after checking pages using it; likely white surface + border + soft shadow | Mentor-specific behaviour | dashboard/result/quiz setup | High |
| `AppButton` | Tokenize primary/secondary; orange primary | click handlers | quiz setup/result/dashboard | Medium |
| `BottomNav` | White floating pill, orange active, slate inactive | route list | all nav tabs | High |
| `Loader`/`.skeleton` | Pale shimmer and deep navy labels | loading logic | all loading states | Medium |
| `HistoryTopBar` | Light sticky top bar | history data fetch | history family | Medium |
| `GoogleSignInCard` | White/elevated card, existing Google button | auth callback | guest pages | Low |
| `DreamPostCard` | White progress card with teal/gold | profile data logic | profile | Medium |
| `NotificationBell`/`WhatsAppBell` | Light modal and tooltip | notification scheduling | dashboard/mentor | Medium |
| Mentor components | Defer | all Mentor files | later separate approval | Very high |

## Page Migration Recommendations

| Page | Scope | Likely files | Files not to touch | Preview | Tests | Risk | Rollback |
|---|---|---|---|---|---|---|---|
| Theme foundation | tokens only | `tailwind.config.js`, `styles/globals.css`, `lib/designTokens.js` | pages/API/Mentor specifics | all pages visual smoke | lint/build | High | revert token commit |
| App shell/nav | background/top/bottom nav | `_app.js`, `BottomNav.js`, shared top bars | API/cache | dashboard/history/mentor nav | nav route clicks | High | restore shell/nav files |
| Shared primitives | cards/buttons/chips/loaders | `components/ui/*`, `globals.css` | Mentor-specific files | dashboard/setup/result | component smoke | High | revert primitives |
| Dashboard | home light cards | `pages/dashboard.js`, notification/WhatsApp components if needed | business/data helpers | home logged-in/guest | daily challenge, modals | High | revert dashboard files |
| Subject + setup | selection/setup light forms | `pages/subjects.js`, `pages/quiz-setup.js` | question APIs | subject/search/setup | start quiz | High | revert page pair |
| Quiz player | question/option/timer states | `pages/quiz.js` | scoring/session logic | active quiz | correct/wrong/skip/timeout | Very high | revert quiz UI only |
| Result + detailed | score/review light states | `pages/result.js`, `pages/result/detailed.js` | save score/mentor return logic | result/detailed | completion save, review | High | revert result files |
| History family | landing/quizzes/session/questions | `pages/history*.jsx`, `HistoryTopBar`, `SessionRow` | history APIs | history guest/logged-in | filters/reattempt | High | revert history pages |
| Saved + mistakes | revision cards | `pages/history/saved.jsx`, `pages/saved.js`, `pages/history/mistakes.jsx` | saved APIs | saved/mistakes | save/unsave/practice | High | revert pages |
| Leaderboard | rank light cards | `pages/leaderboard.js`, `PodiumEntry`, `TopPerformers` | leaderboard API/cache | weekly/all | refresh/CTA | Medium | revert leaderboard |
| Analysis | premium light report | `pages/analysis.jsx`, `pages/personal-ai-analysis.jsx` | analysis APIs | guest/logged-in | reveal/interest CTA | Medium-high | revert analysis |
| Profile + Dream + Streak | profile ecosystem | `pages/profile.js`, `DreamPostCard.jsx`, `pages/streak.js` | profile APIs | profile/streak | edit Dream Post | Medium-high | revert group |
| Landing/onboarding | first-run flow | `pages/index.js`, `pages/onboarding.js`, `pages/onboarding-slides.js`, `GoogleSignInCard` | auth config | landing + onboarding | guest/Google path | Medium | revert group |
| Modals/toasts/final states | polish pass | `NotificationBell`, `WhatsAppBell`, `CoinsToast`, page modals | logic | every modal | open/close/keyboard | Medium | revert modal files |
| Mentor deferred | only after approval | Mentor files listed above | non-Mentor pages unless shared phase | Mentor | plan/task/modals | Very high | dedicated revert |
| Accessibility final | contrast/responsive | all touched UI files | logic | 360px/430px/short height | keyboard, color states | High | targeted fixes |

## Future Implementation Order

1. Theme tokens and Tailwind/global CSS foundation.
2. App shell, page background, top bars, bottom nav.
3. Shared primitives: cards, buttons, pills, badges, progress bars, inputs.
4. Dashboard.
5. Subject selection + quiz setup.
6. Quiz player.
7. Result + detailed result.
8. History landing + quiz history.
9. Saved questions + repeated mistakes.
10. Leaderboard.
11. Analysis.
12. Profile + Dream Post + Streak.
13. Landing/login/onboarding.
14. Empty/loading/error/modals/toasts.
15. Mentor tab only after separate Mentor coding work is complete.
16. Accessibility/responsive final pass.
17. Full UI regression.

## Required Preview And Testing By Phase

Every implementation phase should run:

- `npm run lint`
- `npm run build`
- Browser preview at mobile width around 390-430px.
- One guest-state check.
- One logged-in-state check where possible.

Critical workflow tests:

- Home Daily Challenge starts quiz.
- Subject -> Quiz Setup -> Quiz -> Result works.
- Correct/wrong/skipped states are visually clear.
- Result save flow still completes.
- History filters and reattempt actions still work.
- Saved question save/unsave still works.
- Bottom nav routes all work.
- Mentor page still renders after shared changes, even if not redesigned.

## Files That Must Not Be Changed During Step 1

This audit step must not change:

- `tailwind.config.js`
- `styles/globals.css`
- `lib/designTokens.js`
- `pages/**`
- `components/**`
- `lib/**`
- `pages/api/**`

Only docs should be added.

