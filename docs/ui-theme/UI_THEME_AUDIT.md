# UI Theme Audit: SSC Quest Light Migration

Audit date: 2026-06-11  
Repository folder audited: `festive-engelbart-5368c8`  
Scope: audit-only UI migration map for converting the current dark theme to `SSC Quest Light`.  
Implementation status: no theme implementation started.

## Non-Negotiable Mentor Note

The Mentor tab is under active parallel development. Mentor UI files were audited, but Mentor implementation must be deferred until the user explicitly confirms Mentor coding work is complete.

Future shared-token/component work must be checked against Mentor before merge. Do not make Mentor-specific UI changes in early light-theme phases.

Mentor-sensitive files:

- `pages/mentor.js`
- `pages/mentor-setup.js`
- `pages/mentor-setup-edit.js`
- `components/MentorMessage.jsx`
- `components/MentorTaskCard.jsx`
- `components/MentorSetupStep.jsx`
- `components/TodaysPlanCard.jsx`
- `lib/data/mentorData.js`
- `lib/mentorCopy.js`

## Repo Structure Summary

Framework and package facts from actual files:

- Framework: Next.js `14.2.35`, pages router.
- React: `^18`.
- Auth: `next-auth` `^4.24.14`.
- Styling: Tailwind CSS `^3.4.1`, global CSS, inline `className` strings, inline `style` objects, CSS variables, and a small JS token helper.
- UI primitives: partly centralized in `components/ui` and `lib/designTokens.js`, but many pages duplicate card/button/chip styles directly.
- Main app entry: `pages/_app.js`.
- Document/head/fonts/PWA: `pages/_document.js`.
- Global CSS: `styles/globals.css`.
- Tailwind config: `tailwind.config.js`.
- PostCSS config: `postcss.config.js`.

Main providers and shell:

- `pages/_app.js` wraps the app in `QueryClientProvider`, `SessionProvider`, `CacheScopeGuard`, `PageLoader`, Vercel `Analytics`, and a fixed `BottomNav` on selected routes.
- The root page container uses `min-h-screen app-premium-bg flex justify-center`, max width `430px`, and dark background.
- Bottom nav is outside the overflow container so fixed positioning works.

Global design files:

- `tailwind.config.js`: dark depth ladder, brand orange/teal/gold/purple, semantic answer colors, text colors, borders, animations.
- `styles/globals.css`: CSS variables, app shell/card/button/pill classes, skeletons, shadows, modal sheet classes, typography component classes.
- `lib/designTokens.js`: typography, spacing, `cardStyles`, `buttonStyles`.

Asset folders:

- `public/favicon.ico`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/manifest.json`
- `public/Mentor icon.png`
- `public/sakshi.png`
- `public/sw.js`
- `public/animations/mentor-pointer.json`
- `public/images/logo.png`

Existing design/theme docs found:

- No dedicated current-theme migration doc existed before this audit.
- API/performance docs exist under `docs/`.
- Mentor architecture docs exist under `docs/mentor-architecture/`.

## Actual Page and Route Inventory

User-facing pages:

- `pages/index.js`: landing/login, guest CTA, Google sign-in.
- `pages/dashboard.js`: home dashboard.
- `pages/subjects.js`: subject selection.
- `pages/quiz-setup.js`: quiz setup.
- `pages/quiz.js`: quiz player.
- `pages/result.js`: result summary and persistence trigger UI.
- `pages/result/detailed.js`: detailed result/question review.
- `pages/leaderboard.js`: leaderboard.
- `pages/history.js`: history landing, guest preview/locked states.
- `pages/history/quizzes.jsx`: quiz history.
- `pages/history/questions.jsx`: question history/detailed list.
- `pages/history/saved.jsx`: saved questions under History.
- `pages/history/mistakes.jsx`: repeated mistakes.
- `pages/history/coins.jsx`: coins history.
- `pages/history/session/[sessionId].jsx`: session detail.
- `pages/saved.js`: saved questions page.
- `pages/streak.js`: streak page.
- `pages/analysis.jsx`: analysis tab and locked/sample report.
- `pages/personal-ai-analysis.jsx`: personal AI analysis page.
- `pages/profile.js`: profile tab.
- `pages/mentor.js`: Mentor tab.
- `pages/mentor-setup.js`: Mentor setup flow.
- `pages/mentor-setup-edit.js`: Mentor setup edit flow.
- `pages/onboarding.js`: user onboarding name setup.
- `pages/onboarding-slides.js`: onboarding slides.

Global/shell pages:

- `pages/_app.js`
- `pages/_document.js`

API pages are not UI implementation targets, but some contain strings/comments with UI-like terms:

- `pages/api/...`
- `pages/api/mentor/plan.js`
- `pages/api/mentor/task-action.js`

## Shared Component Inventory

Component files:

- `components/BackButton.js`
- `components/BottomNav.js`
- `components/CacheScopeGuard.jsx`
- `components/CoinsToast.js`
- `components/Confetti.js`
- `components/DreamPostCard.jsx`
- `components/GoogleSignInCard.js`
- `components/HistoryTopBar.js`
- `components/MentorMessage.jsx`
- `components/MentorSetupStep.jsx`
- `components/MentorTaskCard.jsx`
- `components/NotificationBell.js`
- `components/PodiumEntry.js`
- `components/SessionRow.js`
- `components/SubjectStatusPicker.jsx`
- `components/TodaysPlanCard.jsx`
- `components/TopicStatusPicker.jsx`
- `components/TopPerformers.js`
- `components/WhatsAppBell.jsx`
- `components/ui/AppButton.js`
- `components/ui/AppCard.js`
- `components/ui/Loader.jsx`
- `components/ui/PageLoader.jsx`
- `components/ui/RefreshStatus.js`
- `components/ui/SectionHeader.js`

Shared UI primitives currently centralized:

| Primitive | File | Shared/Duplicated | Dark dependency | SSC Quest Light direction | Mentor risk |
|---|---|---:|---|---|---|
| App root shell | `pages/_app.js`, `styles/globals.css` | Shared | `app-premium-bg`, `--bg-app` | Soft teal-white app background with centered mobile shell | High |
| Bottom nav | `components/BottomNav.js` | Shared | dark translucent nav, orange active, muted icons | White pill nav with soft shadow; orange active; slate inactive | High |
| Card | `components/ui/AppCard.js`, `lib/designTokens.js`, `.app-card` | Shared and duplicated | `bg-[#172D47]`, dark borders | white surface, subtle border, soft shadow | High |
| Button | `components/ui/AppButton.js`, `.app-button-primary`, many page buttons | Shared and duplicated | orange gradient on dark | orange CTA with deep navy/white text depending contrast | Medium |
| Loader/skeleton | `components/ui/Loader.jsx`, `.skeleton` | Shared | dark shimmer `#172D47/#1E3554` | pale teal/slate shimmer | Medium |
| Section header | `components/ui/SectionHeader.js` | Shared | white text | deep navy title, slate subtitle | Low |
| Refresh status | `components/ui/RefreshStatus.js` | Shared | teal/dark muted | teal refresh action on light surface | Low |
| Top bars | `components/HistoryTopBar.js`, local page bars | Duplicated | dark sticky translucent | white/elevated sticky bars | Medium |
| Modal/sheet | `styles/globals.css`, page-local modals | Duplicated | black overlay, dark card | soft overlay, white sheet, accessible contrast | Medium |
| Toast | `components/CoinsToast.js`, page-local toasts | Duplicated | dark card, orange/gold | white elevated toast, reward gold/orange | Low |
| Dream Post card | `components/DreamPostCard.jsx` | Shared/Profile | dark progress card | white progress card with teal/gold progress | Medium |
| Mentor cards | `components/MentorMessage.jsx`, `components/MentorTaskCard.jsx`, `components/TodaysPlanCard.jsx` | Mentor-specific | many dark `slate` and custom hex classes | defer until Mentor complete | Very high |
| Pickers | `components/SubjectStatusPicker.jsx`, `components/TopicStatusPicker.jsx` | Mentor setup | dark slate controls | defer; later light chips/selectors | High |

## Current Styling System

Styling methods found:

- Tailwind utility classes in page/component `className`.
- Arbitrary Tailwind values such as `[background:var(--bg-app)]`, `bg-[#172d47]`.
- Inline `style={{ ... }}` objects across 41 files.
- CSS variables in `styles/globals.css`.
- Page-local `<style>` blocks for animations and page-specific classes.
- JS constants for colors in pages such as `ORANGE`, `BG_CARD`, `TEXT_SEC`.
- No CSS modules found.

Existing dark tokens:

- `--color-bg-base`, `--bg-app`: `#0D1B2E`
- `--color-bg-surface`, `--bg-card-soft`: `#112236`
- `--color-bg-card`, `--bg-card`: `#172D47`
- `--color-bg-elevated`: `#1E3554`
- `--color-orange`, `--accent-orange`: `#FF6B16`
- `--color-teal`: `#14B8A6`
- `--color-gold`: `#F59E0B`
- `--text-primary`: `#F0F4F8`
- `--text-secondary`: `#B8C4D4`
- `--text-muted`: `#7A8FA6`

## Main Dark-Theme Pattern Inventory

High-frequency classes/tokens:

| Pattern | Count/Files | Current purpose | Future role | Risk |
|---|---:|---|---|---|
| `text-white` | 118 matches / 33 files | primary text on dark surfaces | `text-primary` deep navy on light; inverse only on orange CTAs | High |
| hardcoded hex colors | 1069 matches / 42 files | surfaces, text, borders, accents | map to tokens | High |
| `bg-[#172d47]`, `#172D47` | `#172D47` 85 matches; class hits 9 | card surface | `surface` or `surface-elevated` | High |
| `#112236` / `bg-[#112236]` | 27 hex; 12 class hits | deep nested surface | `surface-soft` | High |
| `[background:var(--bg-app)]` | 25 class tokens | page background | `app-bg` | High |
| `bg-slate-*` | 27 matches / 10 files | dark setup and Mentor surfaces | light slate/disabled/muted states | Medium |
| `text-slate-400`, `text-slate-500` | 59 / 52 class-token hits | muted text | secondary/muted text | Medium |
| `border-white/[0.08]`, `border-white/10` | many across cards | dark hairline borders | `border-soft` | High |
| `shadow`, `shadow-*` | 138 matches / 29 files | elevation/glow | softer light shadows | Medium |
| `backdrop`, `blur` | 17 / 18 files | glass and modal overlays | keep sparingly, lighter overlays | Medium |
| `gradient`, `from-*`, `to-*`, `via-*` | 32 gradient files | CTA, stat, gamified accents | retain CTAs/reward accents; reduce dark gradients | Medium |
| `bg-black`, black overlays | 2 files plus inline rgba | modal dim/mentor overlay | `overlay` token | Medium |
| `bg-white` | 13 files | Google buttons, text-on-light exceptions | surface and inverse controls | Medium |

Frequent hex colors:

| Hex | Count | Current purpose | Future role |
|---|---:|---|---|
| `#14B8A6` | 134 | teal success/progress/mentor accent | `brand-teal` |
| `#172D47` | 85 | card background | replace with `surface` |
| `#f97316` | 38 | orange icon/action | `brand-orange`/deep |
| `#64748B` | 30 | muted text | `text-muted` |
| `#F8FAFC` | 30 | near-white text | `text-inverse` only |
| `#112236` | 27 | nested dark surface | `surface-soft` |
| `#FF5A00` | 26 | CTA gradient | `brand-orange-deep` |
| `#1E3554` | 24 | elevated dark surface | `surface-elevated` |
| `#FF7A1A` | 24 | CTA gradient | `brand-orange` |
| `#F0F4F8` | 21 | primary text | `text-primary` dark navy |
| `#F59E0B` | 18 | gold/reward | `coin-gold`, `streak-amber` |
| `#22C55E` | 15 | correct/success | `success` |
| `#EF4444` | 11 | wrong/error | `danger` |

## Design Primitive Audit

| Primitive | Current files | Current styling | Recommended light direction | Shared later? |
|---|---|---|---|---|
| Page wrapper | `_app.js`, page roots | `app-premium-bg`, `[background:var(--bg-app)]`, max 430px | `bg-[#F3FBFA]`, safe bottom padding, content max 430 | Yes |
| Top header | `dashboard.js`, `mentor.js`, `history.js`, `HistoryTopBar.js`, `leaderboard.js` | dark sticky/translucent | white sticky with subtle shadow/border | Yes |
| Bottom nav | `BottomNav.js` | fixed dark glass pill | white pill, orange active, slate icons | Yes |
| Cards | `AppCard`, page-local divs | dark blue, white alpha border | white cards, `#DDE8F0` border, subtle shadow | Yes |
| Stat cards | `dashboard.js`, `profile.js`, `streak.js` | dark cards with orange/teal/gold/violet accents | white stats with compact icon chips | Yes |
| CTA button | `AppButton`, page buttons | orange gradients, white text | orange solid/gradient, strong contrast | Yes |
| Secondary button | `AppButton`, many page buttons | dark alpha surface | white/soft teal surface, slate text | Yes |
| Chips/badges | many pages | orange/teal alpha on dark | pastel fills, dark text | Yes |
| Progress bar | dashboard/streak/dream/mentor/quiz | dark track, teal/orange fill | pale track, teal/orange fill | Yes |
| Quiz options | `pages/quiz.js` | dark rows; green/red feedback | white options; selected orange/teal; wrong soft red | Keep page-specific |
| Inputs/selects | onboarding, setup, Mentor setup, pickers | dark surface, white text | white input, deep navy text, teal focus | Yes |
| Modals/dialogs | dashboard, quiz, analysis, history, mentor, notification | black overlay, dark cards | translucent overlay + white modal | Yes |
| Toasts | `CoinsToast.js`, dashboard notify toast | dark/elevated | white elevated with gold/orange accent | Yes |
| Empty/error states | page-local | dark cards, muted slate | white/soft state cards; clear icon/color | Yes |
| History card | history pages/components | deep blue cards | white cards with subject chips | Yes |
| Saved question card | `history/saved.jsx`, `saved.js` | dark card, bookmark controls | white cards; bookmark teal/gold | Yes |
| Analysis cards | `analysis.jsx`, `personal-ai-analysis.jsx` | dark premium cards, locked preview blur | white cards, soft teal/orange highlights | Eventually |
| Mentor cards | Mentor files | dark blue/orange/teal | defer | No early change |
| Streak calendar | `streak.js`, dashboard | dark circular day cells | white/soft teal with orange active | Yes |
| Notification cards | `NotificationBell.js`, `WhatsAppBell.jsx` | dark modal/tooltip | white/green/orange accents | Yes |

## Page-by-Page UI Audit

### Landing/Login: `pages/index.js`

- Imports: `useRouter`, `Head`.
- Current UI: full dark hero, ambient glows, logo wrap, stats card, guest CTA, Google CTA, exam tags.
- Background: `[background:var(--bg-app)]` plus animated colored glows.
- Text: `text-white`, `text-slate-400`, `text-slate-600`, teal stats.
- Cards/buttons: dark translucent stats card; orange/outlined guest CTA; white Google CTA.
- States: guest mode cookie, Google sign-in, onboarding redirect.
- Risks: hero glows can look muddy on light; guest CTA has border animation; stats card must remain readable.
- Future step: Landing/login/onboarding phase after core surfaces are stable.
- Risk: medium.

### Dashboard/Home: `pages/dashboard.js`

- Imports shared sign-in, MentorMessage, NotificationBell, WhatsAppBell, Loader, RefreshStatus, AppCard, data/cache helpers.
- Sections: top bar, notification bell, greeting, last updated refresh status, coins/streak/rank cards, Daily Challenge, streak calendar, social proof carousel, discover quizzes, weekly champions, Dream Post/Mentor setup prompt, WhatsApp/community popups and modals.
- Background: root app background plus many dark cards.
- Text: `text-white`, slate muted, orange/teal/gold/violet accents.
- Buttons: orange Daily Challenge CTA, subject/discover cards, notify CTAs.
- Loading/empty/error: profile/loading skeletons; leaderboard fallback messages; low-question/coming-soon modals.
- Mobile risks: dense top stat grid, fixed/bottom overlays, WhatsApp bubble, bottom nav overlap.
- Must stay prominent: Daily Challenge, coins/streak/rank, streak habit, Dream Post progress.
- Future step: after shell/primitives.
- Risk: high.

### Subject Selection: `pages/subjects.js`

- Current UI: subject/category list, search, collection routing, Mixed GK/collection cards, fixed bottom action where applicable.
- Background: app dark.
- Text/buttons: slate muted text, orange CTA, subject accent gradients from `lib/subjects.js`.
- Loading/empty: loading states and low/no questions states.
- Mobile risks: horizontal/scroll cards and fixed bottom CTA.
- Future step: with quiz setup.
- Risk: medium.

### Quiz Setup: `pages/quiz-setup.js`

- Current UI: question count cards, subject/topic dropdowns, availability text, start quiz CTA, setup/summary states.
- Uses AppButton/AppCard plus many inline styles.
- Background/cards: dark cards and white-alpha borders.
- Inputs: dark select/dropdowns.
- Risks: select readability on mobile browsers, disabled count states, no-question messaging.
- Future step: with subject selection.
- Risk: high.

### Quiz Player: `pages/quiz.js`

- Current UI: loading/resume/error states, top progress, timer ring, scoring row, question card, bookmark, option cards, skip, exit modal, guest save banner, result transition loader.
- Timer: visible ring and panic/low-time animations.
- Option states: base dark row; selected/correct green; wrong red; disabled opacity.
- Loading/error: custom dark loader and `Couldn't load quiz` card.
- Risks: selected/correct/wrong must be distinguishable beyond color; timer contrast; long GK question wrapping; fixed retry buttons; exit modal overlay.
- Must not touch: quiz logic, timer duration, scoring, persistence.
- Future step: after setup.
- Risk: very high.

### Result: `pages/result.js`

- Current UI: summary score/accuracy, correct/wrong/skipped, coins toast/reward, feedback sheet, AI insights, weekly champions, Mentor return CTAs, detailed review CTA, practice again.
- Background/cards: dark with orange/teal/gold accents.
- States: missing result, saving coins, AI loading/error, feedback sent/copy, Mentor return context.
- Risks: reward hierarchy, mentor-return actions, feedback modal, score color semantics.
- Future step: after quiz player.
- Risk: high.

### Detailed Result / Detailed Analysis: `pages/result/detailed.js`

- Current UI: per-question detail cards, correct/wrong/skipped states, explanation cards, AI explain/tip states, bookmark/save state, filters.
- Background: dark.
- Risks: answer contrast, explanation readability, saved marker, AI loading/error fallback.
- Future step: with Result.
- Risk: high.

### Leaderboard: `pages/leaderboard.js`

- Current UI: fixed header, weekly/all tabs, your rank card, top 3 champions, rank rows, refresh status, fixed practice CTA.
- Background: dark; rank card violet/teal gradient; rows dark.
- States: loading, error, empty, guest sign-in.
- Risks: top 3 colors, fixed CTA/bottom nav overlap, all-time vs weekly tab contrast.
- Future step: after saved/history.
- Risk: medium.

### History Landing: `pages/history.js`

- Current UI: HistoryTopBar, guest locked feature menu, benefit strip, blurred preview, lock modal, logged-in feature menu.
- Background: dark; cards `#172D47`; orange icons; white Google CTA.
- States: guest locked modal, loading, logged-in menu.
- Risks: preview blur on light, modal contrast, feature rows.
- Future step: History phase.
- Risk: medium.

### Quiz History: `pages/history/quizzes.jsx`

- Current UI: filters/chips, session cards, mistake filter, practice all, open/reattempt actions.
- Background/cards: dark blue cards and orange selected chips.
- States: loading, empty, error, filters.
- Risks: sticky/scroll filters, repeated mistakes parity, CTA hierarchy.
- Future step: History phase.
- Risk: high.

### Repeated Mistakes: `pages/history/mistakes.jsx`

- Current UI: repeated mistake cards, subject/topic filters, practice/retry CTAs.
- Must match quiz-history mistake filter layout in future.
- Risks: wrong/skipped counts, status chips, card density.
- Future step: saved + repeated mistakes phase.
- Risk: high.

### Saved Questions: `pages/history/saved.jsx`, `pages/saved.js`

- Current UI: search/filter, saved question cards, revision/reattempt CTA, unsave controls, empty state.
- Risks: search input contrast, bookmark state, fixed CTA overlap, empty state clarity.
- Future step: saved + repeated mistakes phase.
- Risk: high.

### Coins History: `pages/history/coins.jsx`

- Current UI: reward/coin ledger cards, history top bar, empty/loading.
- Uses gold/orange accents.
- Risk: gold contrast on light.
- Future step: History family or Profile/Dream/Streak phase.
- Risk: medium.

### Streak: `pages/streak.js`

- Current UI: current streak hero, status/best streak pills, weekly/month calendar, milestones, sticky CTA.
- Background/cards: dark, orange flame/streak, gold rewards.
- Risks: month cells on light, sticky CTA vs nav, active/missed/future states.
- Future step: Profile + Dream Post + Streak.
- Risk: high.

### Mentor: `pages/mentor.js` and Mentor components

- Current UI: sticky Mentor top bar, sign-in preview, MentorMessage, preparation setup, Today’s Plan progress, active task cards, count/confidence/coverage/blocker/manual completion modals, Completed/Later tray.
- Current styling: `#172d47`, `#112236`, `bg-slate-800`, `border-white/[0.08]`, orange CTA, teal progress, amber later chips.
- Current active work: Repository V2 read path and Mentor task lifecycle are actively being changed.
- Risks from shared changes: `AppCard`, `AppButton`, `BottomNav`, `app-page`, `.skeleton`, text classes, nav, global CSS variables.
- Recommendation: audit only; do not implement Mentor UI until explicit confirmation.
- Future step: last UI implementation phase before final accessibility pass.
- Risk: very high.

### Analysis: `pages/analysis.jsx`, `pages/personal-ai-analysis.jsx`

- Current UI: real activity strip, static sample premium analysis, locked feature cards, subject health, practice plan, topic intelligence, marks recovery, interest CTA, sign-in gate.
- Background: dark; sample cards with orange/teal/gold/violet/red status colors.
- States: guest, logged-in, no history, revealed/locked preview, interest CTA loading/error.
- Risks: sample-vs-real labels, premium lock blur, weak-topic red soft states.
- Future step: after leaderboard.
- Risk: medium-high.

### Profile: `pages/profile.js`

- Current UI: profile header/avatar/name/member info, stat cards, DreamPostCard, achievements, links, sign out.
- Imports DreamPostCard.
- Risks: sign out danger style, dream progress, achievements/reward colors.
- Future step: Profile + Dream Post + Streak.
- Risk: medium.

### Dream Post: `components/DreamPostCard.jsx`

- Current UI: loading skeleton, fetch error, edit form/select/input, no-post setup, unlocked state, progress state.
- Dark dependencies: `bg-[#172D47]`, `bg-[#112236]`, `text-[#F0F4F8]`, `#F59E0B`, `#14B8A6`.
- Risks: select native dropdown readability, target progress, same-value edit.
- Future step: Profile + Dream Post + Streak.
- Risk: medium-high.

### Onboarding: `pages/onboarding.js`, `pages/onboarding-slides.js`

- Current UI: name input, loading skeletons, orange CTA, skip link; slides with dark fullscreen, colored glow, bottom card and fixed CTA.
- Risks: fixed button/safe-area, slide contrast, input readability.
- Future step: Landing/login/onboarding phase.
- Risk: medium.

## Typography Audit

Current fonts:

- `Nunito` for headings/numbers via `font-display`.
- `Inter` for body via default body font and `font-sans`.
- Fonts are centralized in `_document.js`, Tailwind `fontFamily`, and `styles/globals.css`.

Current typography classes:

- `t-page-title`: 26px/32, Nunito 800.
- `t-page-subtitle`: 15px/22.
- `t-section-label`: 12px uppercase with 0.12em letter spacing.
- `t-card-title`: 17px/23 Nunito 800.
- `t-card-subtitle`: 14px/20.
- `t-body`: 15px/24.
- `t-button-lg`: 16px.
- `t-button-sm`: 14px.
- `t-badge`: 11px.
- `t-stat-lg`: 28px.
- `t-stat-sm`: 18px.
- `t-nav-label`: 11px.

Observed inconsistencies:

- Many pages still hardcode `text-[11px]`, `text-[13px]`, inline `fontSize`, and local styles instead of `t-*`.
- Dense history/mentor/quiz cards use 11px labels that can be small on mobile.
- Dashboard, Leaderboard, Streak, Analysis use rich inline typography; migration should normalize without flattening hierarchy.

Recommended SSC Quest Light scale:

| Role | Recommendation |
|---|---|
| App title | Nunito 22-24px, 900 |
| Page title | Nunito 22px, 900 |
| Section title | Nunito 18px, 800 |
| Card title | Nunito 16-17px, 800 |
| Stat number | Nunito 24-28px, 900 |
| Body | Inter 14-15px, 500 |
| Small body | Inter 13px, 500 |
| Caption | Inter 11-12px, 600 |
| Button | Inter/Nunito 15-16px, 800 |
| Chip/badge | Inter 11-12px, 700 |

## Spacing, Radius, Shadow Audit

Current patterns:

- Page horizontal padding: usually `px-4` or inline 16px.
- Bottom padding: `pb-20`, `pb-24`, `pb-28`, plus fixed bottom nav.
- Card padding: mostly `p-4`, `px-4 py-3`, or inline 14-20px.
- Radius: `rounded-2xl`, `rounded-3xl`, `rounded-[18px]`, `rounded-[22px]`, `rounded-[24px]`, global `--radius-card: 24px`.
- Bottom nav radius: 28px.
- Buttons: usually 14-18px radius; full-width CTAs.
- Shadows: dark glow/soft shadows, orange/teal/gold glows, `shadow-2xl`, inline `0 24px 60px rgba(...)`.
- Sticky/fixed elements: bottom nav, quiz retry, leaderboard CTA, streak CTA, subjects CTA, onboarding CTA, toasts.

Recommended SSC Quest Light standards:

- Page padding: `16px` mobile.
- Page top spacing: `12-16px` after sticky header.
- Section gap: `20px`.
- Card padding: standard `16px`; dense rows `12px`.
- Card radius: `18px` standard, `22px` hero/summary cards.
- Button radius: `16px`.
- Chip radius: full pill.
- Modal radius: `24px`.
- Border: `1px solid #DDE8F0`.
- Shadow levels:
  - `shadow-card`: `0 8px 24px rgba(16,32,51,0.08)`
  - `shadow-float`: `0 16px 40px rgba(16,32,51,0.12)`
  - CTA shadow: orange glow only on primary CTAs.

## Accessibility and Mobile-First Audit

Issues found:

- Many state differences rely heavily on color: quiz correct/wrong, streak day status, rank top 3, history filters.
- Several labels use 10-11px text, especially badges, metadata, bottom nav labels, calendar cells.
- Fixed CTAs can overlap bottom nav or content on small screens.
- Modal overlays use black/dark cards; light migration must preserve focus/contrast and small-screen max-height scrolling.
- Native `select` controls in dark cards may be hard to read on some mobile browsers.
- `text-white/60`, `rgba(255,255,255,0.3)`, `text-slate-500` can become too faint if directly ported.
- Some icons are inline SVGs with labels, but a few decorative icons need `aria-hidden` review during final pass.
- Long GK questions and option text rely on wrapping inside dark option cards; light cards need stable spacing.
- Loading skeletons are dark and will be invisible or too heavy on light unless remapped.
- Bottom nav is fixed and must reserve page bottom padding consistently.

Future fixes:

- Add non-color markers for correct/wrong: check/cross icons and labels.
- Use minimum 44px hit targets for nav, chips, close buttons, and quiz options.
- Standardize disabled states with visible text and not opacity-only.
- Preserve `aria-label` on icon buttons during refactors.
- Test 360px width and short-height devices for fixed CTAs.

## Risk Audit

| Risk | Files/screens | Why it matters | Safe migration advice | Test |
|---|---|---|---|---|
| Quiz option states | `pages/quiz.js` | core answering UX and scoring confidence | migrate option states last in quiz phase; keep icons/animations | answer correct/wrong/skipped/timeout |
| Timer low-time | `pages/quiz.js` | urgency and timeout clarity | keep strong warning but avoid panic-red overuse | simulate low time/timeout |
| Result score states | `pages/result.js` | reward/score trust | preserve correct/wrong/skipped colors and copy | complete daily/normal/mentor quiz |
| Dropdown readability | `pages/quiz-setup.js`, onboarding, Mentor setup | mobile native select contrast | use white input + dark text + teal focus | iOS/Android select test |
| History filters | `history/*.jsx` | repeated mistakes and reattempt workflow | tokenized chips and sticky areas | filter All/Subject/Topic |
| Saved cards | `history/saved.jsx`, `pages/saved.js` | revision workflow | clear bookmark states | save/unsave/revise |
| Mentor states | Mentor files | active parallel work | defer Mentor | visual smoke only after Mentor complete |
| Analysis premium labels | `analysis.jsx` | locked/sample trust | keep sample labels distinct | guest/logged-in/no-history |
| Leaderboard rank colors | `leaderboard.js` | rank hierarchy | keep gold/violet sparingly | weekly/all tabs |
| Dream Post progress | `DreamPostCard.jsx` | habit-forming goal | teal/gold progress on white | edit/unlocked/progress |
| Bottom nav active | `BottomNav.js` | global navigation | update with shell step; verify all nav routes | tap all nav tabs |
| Modals/popups | dashboard/quiz/history/analysis/mentor | conversion and confirmation | common modal tokens | open/close each modal |
| Skeleton contrast | globals/Loader | perceived loading | pale shimmer | loading pages |
| Disabled buttons | setup/mentor/onboarding | avoid confusing blocked states | visible disabled bg/text | disabled count/start |
| Guest/auth states | index/history/analysis/mentor/profile | sign-in conversion | test both cookies/session | guest and Google session |
| Long questions | quiz/result/history | mobile readability | line-height and card padding | long question fixture |
| Focus states | inputs/buttons | keyboard accessibility | teal ring | tab through forms |
| Shared component affects Mentor | AppCard/AppButton/BottomNav/globals | Mentor active work | defer or feature-check | Mentor smoke after shared phase |

## Phase K Search Counts

Actual search results over `pages`, `components`, `styles`, and `lib` code files:

| Search | Files | Matches |
|---|---:|---:|
| `className=` | 48 | 1539 |
| hardcoded hex colors | 42 | 1069 |
| `text-white` | 33 | 118 |
| `bg-[#` | 8 | 55 |
| `bg-slate` | 10 | 27 |
| `bg-gray` | 1 | 4 |
| `border-slate` | 7 | 7 |
| `shadow` | 29 | 138 |
| `fixed bottom` | 8 | 10 |
| `sticky` | 10 | 12 |
| `modal/dialog/popup/toast` | 12 | 203 |

Files containing `fixed bottom`:

- `pages/dashboard.js`
- `pages/history/saved.jsx`
- `pages/leaderboard.js`
- `pages/mentor.js`
- `pages/onboarding-slides.js`
- `pages/quiz.js`
- `pages/subjects.js`
- `components/CoinsToast.js`

Files containing `sticky`:

- `pages/analysis.jsx`
- `pages/dashboard.js`
- `pages/history/saved.jsx`
- `pages/history.js`
- `pages/mentor.js`
- `pages/personal-ai-analysis.jsx`
- `pages/result/detailed.js`
- `pages/subjects.js`
- `components/HistoryTopBar.js`
- `lib/gemini.js`

## File Lists Requested In Phase K

### `pages/`

- `pages/analysis.jsx`
- `pages/dashboard.js`
- `pages/history.js`
- `pages/index.js`
- `pages/leaderboard.js`
- `pages/mentor-setup-edit.js`
- `pages/mentor-setup.js`
- `pages/mentor.js`
- `pages/onboarding-slides.js`
- `pages/onboarding.js`
- `pages/personal-ai-analysis.jsx`
- `pages/profile.js`
- `pages/quiz-setup.js`
- `pages/quiz.js`
- `pages/result.js`
- `pages/saved.js`
- `pages/streak.js`
- `pages/subjects.js`
- `pages/_app.js`
- `pages/_document.js`
- `pages/history/coins.jsx`
- `pages/history/mistakes.jsx`
- `pages/history/questions.jsx`
- `pages/history/quizzes.jsx`
- `pages/history/saved.jsx`
- `pages/history/session/[sessionId].jsx`
- `pages/result/detailed.js`
- API route files under `pages/api/**` were listed during audit but are not UI migration targets.

### `components/`

- `components/BackButton.js`
- `components/BottomNav.js`
- `components/CacheScopeGuard.jsx`
- `components/CoinsToast.js`
- `components/Confetti.js`
- `components/DreamPostCard.jsx`
- `components/GoogleSignInCard.js`
- `components/HistoryTopBar.js`
- `components/MentorMessage.jsx`
- `components/MentorSetupStep.jsx`
- `components/MentorTaskCard.jsx`
- `components/NotificationBell.js`
- `components/PodiumEntry.js`
- `components/SessionRow.js`
- `components/SubjectStatusPicker.jsx`
- `components/TodaysPlanCard.jsx`
- `components/TopicStatusPicker.jsx`
- `components/TopPerformers.js`
- `components/WhatsAppBell.jsx`
- `components/ui/AppButton.js`
- `components/ui/AppCard.js`
- `components/ui/Loader.jsx`
- `components/ui/PageLoader.jsx`
- `components/ui/RefreshStatus.js`
- `components/ui/SectionHeader.js`

### `styles/`

- `styles/globals.css`

### `lib/data/`

- `lib/data/aiData.js`
- `lib/data/analysisData.js`
- `lib/data/appData.js`
- `lib/data/historyClientData.js`
- `lib/data/leaderboardData.js`
- `lib/data/mentorData.js`
- `lib/data/profileData.js`
- `lib/data/questionData.js`
- `lib/data/savedData.js`

