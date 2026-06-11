# UI Component Inventory

This optional inventory supports `docs/UI_THEME_AUDIT.md` and `docs/SSC_QUEST_LIGHT_MIGRATION_MAP.md`.

## Shared Components

| File | What it does | Used by | Current style dependency | Future action |
|---|---|---|---|---|
| `components/BottomNav.js` | Fixed mobile bottom navigation for Home, Rank, Analysis, History, Mentor | `_app.js` route list | dark glass inline styles, orange active | migrate in shell phase; verify Mentor |
| `components/BackButton.js` | Reusable back button | history/result/detail pages | custom hex, white/dark | light icon button |
| `components/CoinsToast.js` | Coins/reward toast | result/profile-like reward flows | fixed bottom, dark/gold | white elevated reward toast |
| `components/DreamPostCard.jsx` | Dream Post progress/edit card | profile | dark card, dark inputs, teal/gold progress | profile phase |
| `components/GoogleSignInCard.js` | Sign-in prompt card | dashboard/history/leaderboard/analysis | dark card + white Google button | light sign-in card |
| `components/HistoryTopBar.js` | Sticky history top bar | history family | dark translucent top bar | light sticky header |
| `components/NotificationBell.js` | Push reminder bell and modal | dashboard | dark modal, chips, orange CTA | modal/toast phase |
| `components/PodiumEntry.js` | Leaderboard podium entry | leaderboard/dashboard champion areas | dark/violet/gold | leaderboard phase |
| `components/SessionRow.js` | History session row | history pages | dark row/chips | history phase |
| `components/TopPerformers.js` | Top performers list/card | dashboard/result/leaderboard | mixed dark/light exceptions | leaderboard/dashboard phase |
| `components/WhatsAppBell.jsx` | WhatsApp tooltip/modal | dashboard/mentor | dark tooltip/modal, green CTA | modal/toast phase |

## UI Primitives

| File | Primitive | Current classes | Dark dependency | Should become canonical? |
|---|---|---|---|---|
| `components/ui/AppCard.js` | Card wrapper | from `lib/designTokens.cardStyles` | `bg-[#172D47]`, white alpha border | Yes |
| `components/ui/AppButton.js` | Button wrapper | from `lib/designTokens.buttonStyles` | no color by default; page styles supply color | Yes |
| `components/ui/Loader.jsx` | Loader/skeleton | `bg-slate`, border-slate, dark spinner | dark shimmer | Yes |
| `components/ui/PageLoader.jsx` | route loader | likely global dark loader | app bg | Yes |
| `components/ui/RefreshStatus.js` | refresh chip/status | teal icons, inline colors | dark context | Yes |
| `components/ui/SectionHeader.js` | section title | title/subtitle class merging | text color passed by callers | Yes |

## Mentor-Specific Components

| File | Purpose | Current styling | Migration rule |
|---|---|---|---|
| `components/MentorMessage.jsx` | teacher icon + mentor speech card | orange/teal icon, `bg-slate-800`, `text-slate-*`, left border | defer |
| `components/MentorTaskCard.jsx` | task state card, CTA, manual done fallback | dark cards, orange CTA, teal completed, amber later | defer |
| `components/MentorSetupStep.jsx` | setup step shell | `bg-slate-950`, dark stepper | defer |
| `components/TodaysPlanCard.jsx` | plan progress, task list, Completed/Later tray | dark progress/tray/card states | defer |
| `components/SubjectStatusPicker.jsx` | Mentor setup subject status picker | slate surfaces | defer |
| `components/TopicStatusPicker.jsx` | Mentor setup topic status picker | slate surfaces | defer |

## Duplicated Page-Local Components/Patterns

These should be normalized only after the first token/shell pass:

- Dashboard `Avatar`, `SocialProofCarousel`, stat cards, Daily Challenge card, discover quiz cards, weekly champions.
- Result `ChampionAvatar`, feedback sheet, AI insight card, Mentor return buttons.
- Leaderboard rank card, top 3 card, rank rows, fixed practice CTA.
- History guest preview, feature rows, locked modal, history filter chips.
- Quiz option card, timer ring, exit modal, guest bookmark banner.
- Analysis locked/sample feature rows, subject health cards, topic cards.
- Streak calendar cells, milestone cards, sticky CTA.
- Onboarding slide card and fixed CTA.

## Shared-Change Risk Against Mentor

Shared files whose early changes can unintentionally alter Mentor:

- `styles/globals.css`
- `lib/designTokens.js`
- `components/ui/AppCard.js`
- `components/ui/AppButton.js`
- `components/ui/Loader.jsx`
- `components/BottomNav.js`
- `components/WhatsAppBell.jsx`
- `components/GoogleSignInCard.js`

For each shared phase, include a Mentor smoke test but do not redesign Mentor-specific files.

