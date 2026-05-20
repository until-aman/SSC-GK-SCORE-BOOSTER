# SSC GK Score Booster — Mobile-First Redesign PRD
## Complete specification + Claude Code kickoff message

---

## PASTE THIS MESSAGE INTO CLAUDE CODE AFTER UPLOADING THIS FILE

```
I am uploading SSC_GK_Score_Booster_Mobile_Redesign.md.
Read the entire file before writing a single line of code.
This file contains the complete specification for a mobile-first redesign
of the existing Next.js 14 + Tailwind + Google Sheets + NextAuth app.

Implement every section in the order listed under IMPLEMENTATION ORDER
at the bottom of this file. Confirm each step is done before moving to
the next. Do not install any new npm packages. Do not touch any
/pages/api/ai/* files or quiz core logic.
```

---

## 0. Core Design Philosophy

**One screen = one task.**
The dashboard must fit entirely within a 375 × 812px screen with no
scrolling. If something does not fit, it moves to its own dedicated page
accessible via a tap. Students will open this app on a bus, in 60 seconds
between tasks. Every screen must be instantly scannable.

**Mobile-first breakpoints:**
- Base design: 375px width (iPhone SE, most Android budget phones)
- Max column width on desktop: 430px centered, dark gutter (#080e1a) on sides
- No horizontal scroll anywhere
- All tap targets minimum 44×44px

**Navigation model:**
- Bottom nav (3 tabs): Home · Ranks · Profile
- Dedicated sub-pages for streak history and XP history
- No nested navigation beyond 2 levels deep

---

## 1. Global Shell (pages/_app.js)

Wrap every page in this shell. This owns the mobile centering constraint.

```jsx
export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-[#080e1a] flex justify-center">
        <div
          className="w-full max-w-[430px] min-h-screen bg-[#0f172a]
                     relative overflow-x-hidden flex flex-col"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Component {...pageProps} />
        </div>
      </div>
    </SessionProvider>
  );
}
```

Remove any conflicting max-width or centering from individual page root divs.

---

## 2. Design Tokens (globals.css — full replacement of token section)

```css
/* ── Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Inter:wght@400;500;600&display=swap');

body {
  font-family: 'Inter', sans-serif;
  background: #0f172a;
  -webkit-font-smoothing: antialiased;
}
.font-display { font-family: 'Nunito', sans-serif; }

/* ── Animations ── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg,#1e293b 25%,#263348 50%,#1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes slideUp {
  from { transform: translateY(80px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.xp-toast { animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }

@keyframes deplete {
  from { width: 100%; }
  to   { width: 0%; }
}
.toast-progress { animation: deplete 4s linear forwards; }

@keyframes breathe {
  0%,100% { box-shadow: 0 0 16px rgba(16,185,129,0.3); }
  50%     { box-shadow: 0 0 28px rgba(16,185,129,0.6); }
}
.btn-breathe { animation: breathe 2.5s ease-in-out infinite; }

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }

@keyframes popIn {
  0%   { transform: scale(0.8); opacity: 0; }
  70%  { transform: scale(1.05); }
  100% { transform: scale(1);   opacity: 1; }
}
.pop-in { animation: popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }

/* ── Scrollbar hide ── */
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* ── Bottom sheet overlay ── */
.sheet-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 40; backdrop-filter: blur(2px);
}
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sheet-panel {
  position: fixed; bottom: 0; left: 50%; z-index: 50;
  width: 100%; max-width: 430px;
  transform: translateX(-50%);
  animation: sheetUp 0.3s cubic-bezier(0.32,0.72,0,1) forwards;
}
```

---

## 3. Page Inventory

| Route | File | Type | Description |
|---|---|---|---|
| `/` | pages/index.js | Full screen | Auth landing |
| `/dashboard` | pages/dashboard.js | Full screen (no scroll) | Main home |
| `/quiz` | pages/quiz.js | Full screen | Quiz question |
| `/result` | pages/result.js | Scrollable | Result + analysis |
| `/leaderboard` | pages/leaderboard.js | Scrollable | Ranks tabs |
| `/profile` | pages/profile.js | Full screen (no scroll) | User stats + sign out |
| `/streak` | pages/streak.js | NEW full screen | Streak calendar history |
| `/history` | pages/history.js | NEW scrollable | XP/points session log |
| `/onboarding` | pages/onboarding.js | Full screen | First-time name setup |

---

## 4. SCREEN SPECS

---

### 4.1 Auth Landing — `/`

**Redirect rule:** If session exists → `redirect to /dashboard` via getServerSideProps.

**Layout (full screen, no scroll, flex-col justify-between):**

```
SAFE AREA TOP (pt-safe or pt-10)
│
│  ⚡ [logo]                  ← 56px orange lightning SVG, centered
│  SSC GK Score Booster       ← Nunito Black 26px white, centered, mt-3
│  Practice. Rank. Win.       ← Inter 13px slate-400, centered, mt-1
│
│  ┌────────────────────────┐
│  │  8 Subjects            │  ← 3-col stat strip
│  │  1000+ Questions       │     bg-slate-800/60 rounded-2xl
│  │  Free Forever          │     px-4 py-3 mx-6 mt-8
│  └────────────────────────┘
│
│  [Continue with Google]     ← white button, full width mx-6 mt-8
│  [Play as Guest]            ← outline button, full width mx-6 mt-3
│
│  "Questions sourced from    ← Inter 11px slate-600, centered
│   Parmar SSC"
SAFE AREA BOTTOM (pb-safe or pb-8)
```

**Stat strip (3 columns, flex, justify-around inside the box):**
```
Each column: flex-col items-center
  Number: Nunito Black 18px emerald-400
  Label:  Inter 11px slate-500 mt-0.5
```

**Google button:**
```
mx-6 w-[calc(100%-48px)]
bg-white text-slate-900 rounded-2xl py-4
flex items-center justify-center gap-3
font-semibold text-base
active:scale-95 transition-transform duration-100
shadow-[0_4px_20px_rgba(255,255,255,0.08)]
```
Inline Google G SVG (20px), then "Continue with Google" text.

**Guest button:**
```
mx-6 w-[calc(100%-48px)]
border-2 border-slate-700 text-slate-300
rounded-2xl py-4 font-medium text-base
active:scale-95 transition-transform duration-100
```
On tap: `document.cookie = "userMode=guest; path=/; max-age=86400"` then
`router.push("/dashboard")`.

**Background:**
`bg-gradient-to-b from-[#0a1628] via-[#0f172a] to-[#0c1a0e]`
Subtle top-to-bottom dark blue→dark green gradient.

---

### 4.2 Dashboard — `/dashboard` (NO SCROLL — everything fits one screen)

**Layout uses fixed heights to guarantee no overflow on 375×812px.**

**Auth guard:**
- Session loading → full screen skeleton (3 shimmer blocks)
- No session AND no `userMode=guest` cookie → redirect to `/`
- `data.isNewUser === true` from `/api/user-profile` → redirect to `/onboarding`

**Fetch on mount (logged-in only):** `GET /api/user-profile`
**Fetch on mount (all users):** `GET /api/leaderboard?scope=weekly&preview=true`

**Full layout (flex-col, h-screen, no overflow-y-auto):**

```
┌─────────────────────────────┐ ← 375px wide
│ PROFILE BAR           h-14  │
├─────────────────────────────┤
│ STREAK PILL + RANK PILL h-12│
├─────────────────────────────┤
│                             │
│  QUIZ SETUP CARD      flex-1│
│  (fills remaining space)    │
│                             │
├─────────────────────────────┤
│ BOTTOM NAV            h-16  │
└─────────────────────────────┘
```

---

#### PROFILE BAR (h-14, px-4, flex items-center justify-between)

Left side (flex items-center gap-3):
```
Avatar circle:
  w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-emerald-600
  flex items-center justify-center
  Nunito Black 16px text-white
  Content: first letter of name. Guest → G

Name + level (flex-col):
  Name: Inter 600 14px text-white leading-none
  Level: Inter 400 11px text-slate-400 (e.g. "Scholar · 260 XP")
  Guest: "Guest · progress not saved" in text-slate-500 11px
```

Right side (flex items-center gap-2):
```
Streak badge (tap → /streak):
  bg-orange-500/15 border border-orange-500/30
  rounded-full px-3 py-1.5
  flex items-center gap-1.5
  ⚡ inline SVG (orange-500, 14px)
  "{streakCount} days" — Nunito Bold 13px text-orange-400
  Guest: show "0 days" in slate-600

Notification bell (placeholder, no functionality):
  w-9 h-9 rounded-full bg-slate-800
  flex items-center justify-center
  🔔 16px (or bell SVG in slate-500)
```

---

#### STREAK + RANK PILL ROW (h-12, px-4, flex items-center gap-3)

Left pill (flex-1, tap → /streak):
```
bg-slate-800 rounded-2xl px-3 h-9
flex items-center gap-2
⚡ orange-500 SVG 14px
"8 day streak" — Inter 600 12px text-white
"→" — text-slate-500 12px
```

Right pill (flex-1, tap → /leaderboard):
```
bg-slate-800 rounded-2xl px-3 h-9
flex items-center gap-2
🏆 14px (or trophy SVG text-amber-400)
"#15 this week" — Inter 600 12px text-white
"→" — text-slate-500 12px
```

For guests: left pill shows "Login to track streak", right pill shows
"Play to rank".

These two pills are the ONLY entry points to /streak and /leaderboard from
the dashboard (besides bottom nav for leaderboard). Keep them compact.

---

#### QUIZ SETUP CARD (flex-1, px-4, py-3, flex flex-col justify-between)

This card fills all remaining vertical space between the pill row and
bottom nav. It must use flex justify-between to space elements evenly
within whatever height flex-1 gives it on the device.

**Card container:**
```
flex-1 mx-0 bg-slate-800/40 rounded-3xl px-4 py-4
flex flex-col justify-between
border border-slate-700/50
```

**Top: Section label**
```
"Start a Quiz" — Nunito Bold 16px text-white
```

**Middle section (flex-col gap-3):**

Count selector (flex gap-2):
```
Two tiles side by side:
  flex-1 rounded-2xl py-3 px-3 text-center cursor-pointer
  transition-all duration-200 active:scale-95

Selected:
  bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]
  Top label: "Quick" or "Full" — Inter 11px text-white/70
  Count: "10Q" or "25Q" — Nunito Black 20px text-white
  Time: "~3 min" or "~8 min" — Inter 11px text-white/60

Unselected:
  bg-slate-700/60 border border-slate-600/50
  Top label: Inter 11px text-slate-500
  Count: Nunito Black 20px text-slate-300
  Time: Inter 11px text-slate-600
```

Subject selector:
```
Label: "Subject" — Inter 500 11px text-slate-400 uppercase tracking-wide mb-1
Select wrapper (relative div):
  select: w-full bg-slate-700 border border-slate-600 rounded-xl
          px-4 py-3 text-white text-sm font-medium
          focus:border-emerald-500 focus:outline-none appearance-none
  Chevron SVG: absolute right-3 top-1/2 -translate-y-1/2
               w-4 h-4 text-slate-400 pointer-events-none
Options: Polity, Geography, Economics, History,
         Physics, Chemistry, Biology, Current Affairs
On change: reset topic, fetch /api/topics?subject=...
```

Topic selector (same style as subject):
```
Label: "Topic" — same label style
Disabled when !selectedSubject (opacity-40 cursor-not-allowed)
Options: from /api/topics response
After topic selected, show below:
  "{count} questions available" — Inter 11px text-slate-500
```

**Bottom: Start Quiz button**

Disabled (no subject/topic selected):
```
w-full py-4 rounded-2xl
bg-slate-700 text-slate-500 font-display font-bold text-base
cursor-not-allowed
```

Enabled:
```
w-full py-4 rounded-2xl
bg-emerald-500 text-white font-display font-bold text-base
btn-breathe class (CSS glow animation)
active:scale-[0.98] transition-transform duration-100
flex items-center justify-center gap-2
"Start Quiz →"
```

On tap:
```javascript
const sessionId = crypto.randomUUID();
router.push(
  `/quiz?subject=${encodeURIComponent(selectedSubject)}`+
  `&topic=${encodeURIComponent(selectedTopic)}`+
  `&count=${selectedCount}&sessionId=${sessionId}`
);
```

---

#### BOTTOM NAV (h-16, fixed bottom-0)

```
fixed bottom-0 left-1/2 -translate-x-1/2
w-full max-w-[430px]
bg-slate-900/95 backdrop-blur-md border-t border-slate-800
flex justify-around items-center
h-16 px-4 z-50
```

3 items (flex-col items-center gap-0.5):
```
Icon: w-6 h-6 inline SVG (stroke-based, strokeWidth=1.5)
Label: Inter 10px font-medium tracking-wide
Active:   text-emerald-400, active dot (w-1 h-1 bg-emerald-400 rounded-full)
Inactive: text-slate-600, no dot

Tabs:
  Home (🏠 SVG) → /dashboard
  Ranks (🏆 SVG) → /leaderboard
  Profile (👤 SVG) → /profile
```

Active state determined by `router.pathname`.
All 3 tabs use `router.push()` (no full page reload).

**SVG paths (24×24 viewBox, stroke="currentColor", fill="none"):**

Home:
```svg
<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10
         a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4
         a1 1 0 001 1m-6 0h6" strokeWidth="1.5"/>
```

Trophy:
```svg
<path d="M8 21h8m-4-4v4M5 3H3a2 2 0 000 4c0 3.3 2.7 6 6 6s6-2.7 6-6
         a2 2 0 000-4h-2M5 3h14M5 3v8" strokeWidth="1.5"/>
```

Person:
```svg
<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      strokeWidth="1.5"/>
```

---

### 4.3 Quiz Page — `/quiz`

**Full screen, one question at a time, no scroll.**

**Redirect:** If subject/topic/count missing from query → `router.replace("/dashboard")`.

**Layout (flex-col, h-screen):**

```
┌─────────────────────────────┐
│ TOP BAR                h-12 │  subject · topic · "⚡+10 XP"
├─────────────────────────────┤
│ PROGRESS BAR           h-1  │  thin line, fills as questions answered
├─────────────────────────────┤
│                             │
│  TIMER RING            h-20 │  centered SVG ring countdown
│                             │
│  QUESTION TEXT         auto │  max 4 lines, scrollable if needed
│                             │
│  OPTION A              h-12 │
│  OPTION B              h-12 │  4 options
│  OPTION C              h-12 │
│  OPTION D              h-12 │
│                             │
│  [Skip question →]     h-10 │  text button
└─────────────────────────────┘
```

**Top bar (h-12 px-4 flex items-center justify-between):**
```
Left: "{subject} · {topic}" — Inter 500 11px text-slate-400 truncate max-w-[180px]
Center: "Q {n}/{total}" — Nunito Bold 14px text-white
Right: "⚡+10 XP" — Inter 600 12px text-orange-400
```

**Progress bar (h-1 bg-slate-800):**
```
Fill: h-full bg-emerald-500 transition-all duration-300
Width: (questionIndex / totalQuestions * 100)%
```

**Timer ring (w-20 h-20 mx-auto mt-4):**
```jsx
const RADIUS = 28;
const CIRC = 2 * Math.PI * RADIUS;
const offset = CIRC * (1 - timeLeft / 20);
const isWarning = timeLeft <= 7;

<svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
  <circle cx="36" cy="36" r={RADIUS} fill="none"
    stroke="#1e293b" strokeWidth="5"/>
  <circle cx="36" cy="36" r={RADIUS} fill="none"
    stroke={isWarning ? "#f97316" : "#10b981"} strokeWidth="5"
    strokeLinecap="round"
    strokeDasharray={CIRC}
    strokeDashoffset={offset}
    style={{transition:"stroke-dashoffset 1s linear,stroke 0.3s"}}/>
</svg>
<div className="absolute inset-0 flex items-center justify-center">
  <span className={`font-display font-black text-xl
    ${isWarning ? "text-orange-400" : "text-white"}`}>
    {timeLeft}
  </span>
</div>
```

**Question text (px-4 mt-4):**
```
bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-700/50
Nunito Bold 15px text-white leading-relaxed
Max 4 lines visible; overflow-y-auto if longer (rare)
```

**Option buttons (px-4 mt-2 flex flex-col gap-2):**
```
Each: rounded-2xl px-4 py-3.5 flex items-center gap-3
      bg-slate-800 border border-slate-700 active:scale-[0.98]
      transition-all duration-100

Letter badge: w-7 h-7 rounded-full bg-slate-700
              flex items-center justify-center flex-shrink-0
              Nunito Bold 12px text-slate-300

Option text: Inter 500 14px text-white flex-1

After answer selected:
  Correct:   bg-emerald-500/15 border-emerald-500
             Badge: bg-emerald-500 text-white
  Incorrect: bg-red-500/15 border-red-500
             Badge: bg-red-500 text-white
  Other options: opacity-40
```

**Skip button (text-center mt-2):**
```
text-slate-500 Inter 13px font-medium
"Skip question →"
Min touch target: py-3 (so actual tap area is adequate)
```

---

### 4.4 Result Page — `/result` (scrollable — only page that intentionally scrolls)

**Top section (sticky, visible without scroll):**
```
bg-[#0f172a] px-4 pt-10 pb-4 border-b border-slate-800
```

Score:
```
Center aligned
Nunito Black 64px text-white → rawScore (e.g. "19.5")
"marks scored" below → Inter 13px text-slate-400
```

3-stat row (correct / wrong / skipped):
```
flex justify-around mt-4
Each: flex-col items-center
  Number: Nunito Black 24px
    correct → text-emerald-400
    wrong → text-red-400
    skipped → text-slate-400
  Label: Inter 11px text-slate-500 mt-0.5 uppercase tracking-wide
```

Accuracy bar:
```
mt-4 h-2 bg-slate-800 rounded-full overflow-hidden
Fill: bg-emerald-500 h-full transition-all duration-700 ease-out
Width animates from 0 → accuracy% on mount (100ms delay)
Label row above bar: flex justify-between text-xs text-slate-500 mb-1
  Left: "Accuracy"   Right: "{accuracy.toFixed(1)}%"
```

**Scrollable section below:**

XP Toast / save confirmation (logged-in):
```
bg-gradient-to-r from-emerald-900/60 to-teal-900/60
border border-emerald-500/30 rounded-2xl p-4 mx-4 mt-4
Row 1: "⚡ +{xpEarned} XP earned" — Nunito Black 18px text-white
       "🔥 {streakCount} day streak" — Inter 600 12px text-orange-400
Row 2: "Level: {level} · {totalXP} XP total" — Inter 14px text-emerald-300
Row 3 (if first quiz today):
       "🌅 First quiz bonus included!" — Inter 12px text-yellow-300
```
Entry: xp-toast CSS animation (spring slide-up).

Guest save banner:
```
bg-slate-800 border border-emerald-500/20 rounded-2xl p-4 mx-4 mt-4
flex flex-col items-center gap-3 text-center
"🔒" text-2xl
"Login to save your score, XP, and streak" Inter 14px text-slate-300
[Sign in with Google] — white button (compact: py-2.5 text-sm)
```

Action buttons (mx-4 mt-4 flex flex-col gap-3):
```
Primary: "Back to Home"
  bg-emerald-500 text-white rounded-2xl w-full py-4
  Nunito Bold 16px shadow-[0_0_20px_rgba(16,185,129,0.3)]

Secondary: "View Leaderboard"
  bg-slate-800 border border-slate-700 text-slate-300 rounded-2xl w-full py-4
  Nunito Bold 16px

Tertiary: "Detailed Analysis →"
  text-center text-slate-500 Inter 13px underline underline-offset-2
  (links to /analysis page — existing, no change)
```

WhatsApp share (mt-4 mb-8 mx-4):
```
bg-[#25d366]/10 border border-[#25d366]/30 rounded-2xl p-4
flex items-center gap-3
WhatsApp icon SVG (green, 24px)
"Challenge your friends →" Inter 600 14px text-[#25d366]
On tap: existing share logic (unchanged)
```

---

### 4.5 Leaderboard Page — `/leaderboard`

**Layout (flex-col, scrollable below the sticky header):**

**Sticky header:**
```
bg-gradient-to-b from-[#2e1065] to-transparent
px-4 pt-10 pb-0 sticky top-0 z-10 backdrop-blur-sm
```

Title: `"Leaderboard"` — Nunito Black 22px text-white

Tab switcher (mt-3 mb-0):
```
flex bg-slate-800/80 rounded-full p-1 w-fit
```
Each tab: `px-5 py-1.5 rounded-full Nunito Bold 13px transition-all`
Active: `bg-white text-violet-700`
Inactive: `text-slate-400`

**Podium (top 3 — Kahoot style, visible without scroll):**
```
bg-gradient-to-b from-violet-900/50 to-transparent
px-4 pt-4 pb-2
flex items-end justify-center gap-2
```

Order: [#2 left] [#1 center, tallest] [#3 right]

Each podium entry (flex-col items-center):
```
Avatar circle:
  #1: w-16 h-16 bg-amber-500 border-4 border-amber-300
      shadow-[0_0_20px_rgba(245,158,11,0.5)]
  #2: w-14 h-14 bg-blue-500 border-4 border-blue-300
  #3: w-14 h-14 bg-rose-500 border-4 border-rose-300
  All: rounded-full flex items-center justify-center
       Nunito Black text-white
  Content: first letter of name (uppercase)

Name: Nunito Bold text-white text-center truncate
  #1: text-sm max-w-[72px]
  #2, #3: text-xs max-w-[60px]

Score pill:
  bg-white/15 backdrop-blur rounded-full px-2.5 py-0.5 mt-1
  Nunito Bold text-white
  #1: text-sm    #2,#3: text-xs

Podium block:
  w-24 rounded-t-xl mt-2 flex items-center justify-center
  #1: h-20 bg-amber-500/25 border-t-2 border-amber-500
  #2: h-14 bg-blue-500/20  border-t-2 border-blue-400
  #3: h-10 bg-rose-500/20  border-t-2 border-rose-400
  Inside: medal emoji text-3xl (🥇🥈🥉)
```

Ghost entry (if fewer than 3 users — replace missing slot):
```
Avatar: bg-slate-700, "?" text, border-slate-600
Name: "---" text-slate-600
Score: "0"
Podium block: bg-slate-700/30 border-slate-700
```

**Scrollable list (rank 4+):**
```
bg-[#0f172a] rounded-t-3xl px-4 pt-4 pb-24
```

Current user card (if ranked, show before list):
```
bg-violet-900/30 border border-violet-500/30 rounded-2xl p-3 mb-4
flex items-center gap-3
"#{rank}" — Nunito Black 20px text-violet-300 w-10
Avatar: w-9 h-9 rounded-full bg-violet-700 Nunito Bold 14px text-white
Name + score: flex-col flex-1
  Name: Inter 600 14px text-white
  "{totalScore.toFixed(1)} pts · {accuracy.toFixed(0)}% accuracy"
  Inter 12px text-slate-400
```

Not on leaderboard message (logged-in, not ranked):
```
bg-slate-800/50 rounded-2xl p-4 mb-4 text-center
"You are not on the leaderboard yet." Inter 14px text-slate-400
"Play a quiz to earn your first marks." Inter 12px text-slate-500 mt-1
```

Guest message:
```
"Sign in to appear on the leaderboard." + Google button
```

Each list row (rank 4+):
```
flex items-center gap-3 py-3 border-b border-slate-800 last:border-0

Rank: Nunito Bold 15px text-slate-500 w-8 text-right
Avatar: w-10 h-10 rounded-full bg-slate-700
        Nunito Bold 14px text-slate-300
        First letter of name
Name + accuracy (flex-col flex-1):
  Name: Inter 600 14px text-white
  "{accuracy.toFixed(0)}% accuracy" Inter 11px text-slate-500
Score: Nunito Bold 14px text-emerald-400 text-right
```

Highlight current user's row:
```
bg-violet-900/20 rounded-xl -mx-1 px-1
```

Include `<BottomNav />` (Ranks tab active).

---

### 4.6 Profile Page — `/profile` (NO SCROLL — fits one screen)

**Auth guard:** No session AND no guest cookie → redirect to `/`.

**Layout (flex-col, h-screen, pb-16 for bottom nav):**

```
┌─────────────────────────────┐
│ HEADER BAR            h-14  │  "Profile" title
├─────────────────────────────┤
│                             │
│ AVATAR CARD          ~h-36  │  name, email, level badge
│                             │
├─────────────────────────────┤
│ STATS ROW (3 boxes)  ~h-28  │  XP · Streak · Level
├─────────────────────────────┤
│ LEVEL PROGRESS BAR   ~h-20  │
├─────────────────────────────┤
│ ACTION ROWS          ~h-36  │  Streak History · XP History · Sign Out
└─────────────────────────────┘
│ BOTTOM NAV           h-16   │
```

**Header bar (h-14 px-4 flex items-center):**
```
"Profile" — Nunito Bold 20px text-white
```

**Avatar card (mx-4 mt-2):**
```
bg-gradient-to-br from-[#0f4c75] via-[#1b6ca8] to-[#0f766e]
rounded-3xl px-5 py-4 flex items-center gap-4
```
Left: Avatar circle `w-16 h-16 rounded-full bg-white/20 border-2 border-white/25 Nunito Black 26px text-white`

Right (flex-col gap-0.5):
```
Name: Nunito Bold 18px text-white
Email: Inter 12px text-white/60 (logged-in only)
"Member since {MMM YYYY}": Inter 11px text-white/50
Level badge pill: bg-white/15 rounded-full px-2 py-0.5 mt-1 w-fit
  "⭐ {level}" — Nunito Bold 12px text-white
Guest: "Guest Mode" badge in slate-500/20
```

Skeleton while loading: `h-24 skeleton rounded-3xl mx-4 mt-2`

**Stats row (mx-4 mt-3 grid grid-cols-3 gap-2):**
```
Each box: bg-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1
  Number: Nunito Black 22px
    XP: text-emerald-400
    Streak: text-orange-400 (with 🔥)
    Level: text-violet-400
  Label: Inter 10px text-slate-500 uppercase tracking-wide
    "Total XP" / "Day Streak" / "Level"
```
Guest: all 3 show "—" in slate-600.

**Level progress bar (mx-4 mt-3 bg-slate-800 rounded-2xl px-4 py-3):**
```
Flex row: current level name (Nunito Bold 13px text-white)
          spacer
          next level name (Inter 13px text-slate-500)
Bar: mt-2 h-2 bg-slate-700 rounded-full
  Fill: bg-emerald-500 h-full rounded-full transition-all duration-700
  Width: computed % within current level range

XP label (mt-1 text-right Inter 11px text-slate-500):
  "{currentXP} / {nextThreshold} XP"
  Legend: "3000+ XP — Maximum Level"

Level thresholds:
  Aspirant:  0   – 199  (next: 200)
  Scholar:   200 – 599  (next: 600)
  Expert:    600 – 1499 (next: 1500)
  Champion: 1500 – 2999 (next: 3000)
  Legend:   3000+       (maxed)
```

**Action rows (mx-4 mt-3 flex flex-col gap-2):**

Row style (shared):
```
w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5
flex items-center gap-3 active:scale-[0.98] transition-transform
```

Row 1: Streak History (tap → /streak)
```
Icon: ⚡ SVG orange-500 20px
Label: "Streak History" — Inter 600 14px text-white
Right: chevron → text-slate-500
```

Row 2: XP History (tap → /history)
```
Icon: 📊 SVG or bar chart SVG emerald-500 20px
Label: "XP History" — Inter 600 14px text-white
Right: chevron → text-slate-500
```

Row 3: Sign Out (logged-in only)
```
Icon: logout arrow SVG text-red-400 20px
Label: "Sign Out" — Inter 600 14px text-red-400
On tap: signOut({ callbackUrl: "/" })
```

Row 3 for guest: "Sign in with Google" (full white button style, py-3.5)
```
On tap: clear userMode cookie, signIn("google", { callbackUrl: "/dashboard" })
```

Chevron SVG (16×16):
```svg
<path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5"
      fill="none" strokeLinecap="round"/>
```

Logout SVG (20×20):
```svg
<path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0
         01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      stroke="currentColor" strokeWidth="1.5" fill="none"/>
```

Include `<BottomNav />` (Profile tab active).

---

### 4.7 Streak History Page — `/streak` (NEW)

**Purpose:** Shows the user's full streak calendar and daily quiz activity.
Accessible from dashboard streak pill and profile → Streak History.

**Header (px-4 pt-10 pb-4 flex items-center gap-3):**
```
Back arrow (tap → router.back()):
  w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center
  ← SVG text-white

"Streak History" — Nunito Bold 20px text-white
```

**Streak hero card (mx-4 mt-2):**
```
bg-gradient-to-br from-orange-900/40 to-amber-900/20
border border-orange-500/30 rounded-3xl px-5 py-5
flex items-center justify-between
```
Left:
```
"🔥" text-4xl
"{streakCount}" — Nunito Black 48px text-white leading-none
"day streak" — Inter 13px text-orange-300 mt-0.5
```
Right:
```
Best streak row: "🏆 Best: {bestStreak} days" Inter 12px text-orange-300
(For V2, best = current. Store separately in V3.)
Status text:
  If played today: "✓ Protected today" text-emerald-400 12px
  Else: "Play today to extend!" text-orange-400 12px
```

**This Week calendar (mx-4 mt-4 bg-slate-800 rounded-3xl p-4):**

Title: `"This Week"` — Nunito Bold 14px text-white mb-3

7-day row (flex justify-between):
```
Each day (flex-col items-center gap-1.5):
  Day label: "Mo","Tu","We","Th","Fr","Sa","Su"
             Inter 11px text-slate-500
  Circle (w-10 h-10 rounded-full flex items-center justify-center):
    Completed:  bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]
                Content: ⚡ white SVG (16px lightning bolt)
    Today done: bg-orange-500 ring-2 ring-orange-300 ring-offset-2
                ring-offset-slate-800
                Content: ⚡ white SVG
    Today todo: bg-white/5 border-2 border-white
                Content: empty
    Future:     bg-slate-700/50 border border-slate-600
                Content: empty
```

Lightning bolt SVG (white, 16×16):
```svg
<svg width="16" height="16" viewBox="0 0 24 24" fill="white">
  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
</svg>
```

Streak count + navigation (flex justify-between items-center mt-3):
```
Left: ⚡ orange SVG 18px + "{n} days" Nunito Black 18px text-slate-900
      (white card → slate-900 text)
Wait — this section is on dark background, so:
Left: ⚡ orange SVG 18px + "{n} days" Nunito Black 18px text-white

Right: two small nav buttons (visual only in V2):
  Each: w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center
  ‹ and › in text-slate-400 text-sm
```

**How to compute which days are orange (client-side, no extra API):**
```javascript
function getStreakDays(streakCount, lastAttemptDate) {
  // returns Set of weekday indices (0=Mon...6=Sun) that are "done"
  const todayIST = getISTDateString();
  const todayDate = new Date(todayIST + "T00:00:00+05:30");
  const todayIdx = (todayDate.getDay() + 6) % 7; // 0=Mon
  const playedToday = lastAttemptDate === todayIST;
  const done = new Set();
  const base = playedToday ? todayIdx : todayIdx - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) done.add(idx);
  }
  return { done, todayIdx, playedToday };
}
```

**Motivation card (mx-4 mt-4 bg-slate-800 rounded-2xl px-4 py-4):**
```
Subtext based on streak:
  0 days: "Start your first streak today! 🚀"
  1–3:    "You're building momentum! Keep going 💪"
  4–6:    "Almost a week! Don't break now 🔥"
  7–13:   "One week down! You're unstoppable 🏆"
  14+:    "Legend in the making! {n} days strong ⚡"

Style: Inter 14px text-slate-300 text-center py-2
```

**CTA button (mx-4 mt-4):**
```
"Practice Now →" — emerald-500 button (full width, py-4 rounded-2xl)
On tap: router.push("/dashboard")
```

**No bottom nav on this page** (it's a sub-page, back arrow suffices).

---

### 4.8 XP History Page — `/history` (NEW)

**Purpose:** Shows a log of every quiz session with XP earned. Motivates
users to play more by showing progress over time.

**Header (same back-arrow pattern as /streak):**
```
Back arrow → router.back()
"XP History" — Nunito Bold 20px text-white
```

**XP hero card (mx-4 mt-2):**
```
bg-gradient-to-br from-emerald-900/40 to-teal-900/20
border border-emerald-500/30 rounded-3xl px-5 py-5
flex items-center justify-between
```
Left:
```
"⚡" text-4xl
"{totalXP}" — Nunito Black 48px text-white
"total XP" — Inter 13px text-emerald-300 mt-0.5
```
Right:
```
Level badge (large):
  Nunito Black 20px text-white
  "{level}" with level-specific color (same color map as LevelBadge)
  "Level" label Inter 11px text-slate-400 below
Next milestone:
  Inter 11px text-slate-500
  "{xpToNext} XP to {nextLevel}"
  e.g. "140 XP to Expert"
```

**Data source for history:**
Call `GET /api/score-history` (new endpoint — see Section 5).
Returns last 20 quiz sessions for the logged-in user, newest first.

**Session list (scrollable, mx-4 mt-4 pb-24):**

Section title: `"Recent Sessions"` — Nunito Bold 14px text-white mb-3

Empty state:
```
text-center py-12
"⚡" text-4xl mb-3
"No quiz sessions yet." Inter 14px text-slate-400
"Play your first quiz to earn XP!" Inter 12px text-slate-500 mt-1
[Play Now →] emerald button mt-4
```

Each session row:
```
bg-slate-800 rounded-2xl px-4 py-3.5 mb-2
flex items-center gap-3
```
Left: Subject icon (emoji from subjectStyles map, 24px in a
      32×32 rounded-xl bg-slate-700 flex items-center justify-center)

Middle (flex-col flex-1 gap-0.5):
```
"{subject} · {topic}" — Inter 600 13px text-white truncate max-w-[180px]
"{formattedDate}" — Inter 11px text-slate-500
  Format: "Today", "Yesterday", or "DD MMM" (e.g. "15 May")
```

Right (flex-col items-end gap-0.5):
```
"+{xpEarned} XP" — Nunito Bold 15px text-emerald-400
"{correct}/{total} correct" — Inter 11px text-slate-500
```

Loading state: 5 skeleton rows (h-16 rounded-2xl skeleton mb-2).

Guest state:
```
Full page message (centered):
"Login to track your XP history." + Google sign-in button
```

**No bottom nav** (sub-page).

---

### 4.9 Onboarding Page — `/onboarding`

**Purpose:** First-time users set display name before entering dashboard.

**Auth guard:** No session → redirect to `/`.

**Check on mount:** Call `GET /api/user-profile`. If `data.isNewUser === false`
→ `router.replace("/dashboard")` immediately.

**Layout (flex-col items-center justify-center min-h-screen px-6):**

```
⚡ logo SVG (orange-500, 56px) — centered

"Welcome!" — Nunito Black 28px text-white text-center mt-6

"You're all set. Just tell us what to call you on the leaderboard."
Inter 14px text-slate-400 text-center mt-2 mb-8

[Name input field]

[Let's Go → button]

"Skip, use my Google name" link
```

Name input:
```
w-full max-w-[320px]
bg-slate-800 border border-slate-700 rounded-2xl
px-4 py-4 text-white text-base font-medium
placeholder: "Your display name"
focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500
Default value: session.user.name
```

Let's Go button:
```
w-full max-w-[320px] mt-4 py-4 rounded-2xl
bg-emerald-500 text-white Nunito Bold 16px
btn-breathe class
active:scale-[0.98]
```
On tap: `PATCH /api/user-profile` with `{ name: enteredName.trim() }`
→ on resolve (success or fail): `router.push("/dashboard")`

Skip link:
```
text-slate-500 Inter 13px underline underline-offset-2 mt-3
On tap: router.push("/dashboard") directly
```

---

## 5. New API Endpoint

### `GET /api/score-history`

**Purpose:** Returns last 20 quiz sessions for the logged-in user.

**Auth:** Required. Return `401` if no session.

**Logic:**
1. Get `email` from session.
2. Read all rows from `Scores` tab.
3. Filter rows where `row[1] === email`.
4. Sort by `row[0]` (timestamp) descending.
5. Take first 20 rows.
6. Map each row to:
```json
{
  "timestamp": "2026-05-19T14:30:00.000Z",
  "subject": "Polity",
  "topic": "Fundamental Rights",
  "correctAnswers": 12,
  "totalQuestions": 20,
  "rawScore": 19.5,
  "xpEarned": 34,
  "accuracy": 60.0
}
```
`accuracy = (correctAnswers / totalQuestions) * 100`
`xpEarned` from `row[11]` (column L) — use `Number(row[11]) || 0`

7. Return:
```json
{
  "sessions": [...],
  "totalXP": 298,
  "level": "Scholar"
}
```

**Error:** `500` on Sheets failure.

---

## 6. Sign-Out Fix (pages/api/auth/[...nextauth].js)

Add this `callbacks` block to the NextAuth config object (do not remove
existing providers or session config):

```javascript
callbacks: {
  async redirect({ url, baseUrl }) {
    if (url.startsWith(baseUrl)) return url;
    if (url.startsWith("/")) return `${baseUrl}${url}`;
    return `${baseUrl}/`;
  },
},
```

After adding this, `signOut({ callbackUrl: "/" })` will always land on
the app landing page, not NextAuth's default page.

Also verify: `NEXTAUTH_URL` in Vercel env vars matches the production URL
exactly (`https://ssc-gk-score-booster.vercel.app`). In `.env.local`:
`NEXTAUTH_URL=http://localhost:3000`.

---

## 7. isNewUser Flag (pages/api/user-profile.js)

When user row is NOT found and must be created, add `"isNewUser": true`
to the response. When row already exists, add `"isNewUser": false`.

```javascript
if (!userRow) {
  // create new row
  await appendToUsers(defaultRow);
  return res.status(200).json({ ...parsedDefaults, isNewUser: true });
} else {
  return res.status(200).json({ ...parsedUser, isNewUser: false });
}
```

In `/pages/dashboard.js`, after fetching user profile:
```javascript
if (data.isNewUser === true) {
  router.replace("/onboarding");
  return;
}
```

---

## 8. Subject Emoji + Color Map (shared across pages)

Create `/lib/subjects.js` and import wherever needed:

```javascript
export const subjectStyles = {
  "Polity":          { gradient: "from-blue-600 to-indigo-700",   icon: "⚖️",  color: "blue" },
  "Geography":       { gradient: "from-emerald-600 to-teal-700",  icon: "🌍",  color: "emerald" },
  "Economics":       { gradient: "from-amber-500 to-orange-600",  icon: "📈",  color: "amber" },
  "History":         { gradient: "from-rose-600 to-pink-700",     icon: "🏛️",  color: "rose" },
  "Physics":         { gradient: "from-violet-600 to-purple-700", icon: "⚛️",  color: "violet" },
  "Chemistry":       { gradient: "from-cyan-500 to-sky-700",      icon: "🧪",  color: "cyan" },
  "Biology":         { gradient: "from-green-500 to-emerald-700", icon: "🧬",  color: "green" },
  "Current Affairs": { gradient: "from-red-500 to-rose-700",      icon: "📰",  color: "red" },
};

export function getSubjectStyle(subject) {
  return subjectStyles[subject] || {
    gradient: "from-slate-600 to-slate-700",
    icon: "📚",
    color: "slate"
  };
}
```

Used in: `/history` (session row icon), `/dashboard` (subject dropdown
could show icon next to selected subject name as visual cue).

---

## 9. Component Checklist

| Component | File | Used in |
|---|---|---|
| BottomNav | /components/BottomNav.js | dashboard, leaderboard, profile |
| XPToast | /components/XPToast.js | result |
| StreakBadge | /components/StreakBadge.js | dashboard profile bar |
| LevelBadge | /components/LevelBadge.js | profile, onboarding |
| PodiumEntry | /components/PodiumEntry.js | leaderboard |
| SessionRow | /components/SessionRow.js | history |
| BackButton | /components/BackButton.js | streak, history (reusable) |

**BackButton component spec:**
```jsx
// Props: none. Uses router.back() on tap.
<button onClick={() => router.back()}
  className="w-9 h-9 rounded-full bg-slate-800 flex items-center
             justify-center active:scale-90 transition-transform">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" className="w-5 h-5 text-white">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</button>
```

---

## 10. Files That Must NOT Be Touched

```
/pages/api/auth/[...nextauth].js   ← ONLY add the callbacks block (Section 6)
/pages/api/ai/explain.js           ← no change
/pages/api/ai/tip.js               ← no change
/pages/api/ai/summary.js           ← no change
/pages/analysis.js                 ← no change
/pages/api/topics.js               ← no change
/pages/api/questions.js            ← no change
next.config.js                     ← no change
vercel.json                        ← no change
```

---

## 11. Implementation Order

**Do steps in this exact order. Verify each before proceeding.**

```
STEP 1 — globals.css
  Replace token section with full CSS from Section 2.
  Add Nunito + Inter import to pages/_document.js.

STEP 2 — _app.js shell
  Wrap Component with mobile-first shell (Section 1).
  Remove conflicting max-width from individual pages.

STEP 3 — Shared files
  Create /lib/subjects.js (Section 8).
  Add isNewUser flag to /pages/api/user-profile.js (Section 7).
  Add callbacks to /pages/api/auth/[...nextauth].js (Section 6).
  Create /pages/api/score-history.js (Section 5).

STEP 4 — Components
  Create all components listed in Section 9.
  BottomNav must use inline SVGs, not emojis.
  BackButton must be a reusable component.

STEP 5 — Auth landing /pages/index.js
  Full replacement per Section 4.1.

STEP 6 — Onboarding /pages/onboarding.js
  New page per Section 4.9.

STEP 7 — Dashboard /pages/dashboard.js
  Full replacement per Section 4.2.
  Must fit 375×812 with NO vertical scroll.
  Add isNewUser check → redirect to /onboarding.

STEP 8 — Quiz /pages/quiz.js
  Modify per Section 4.3.
  Add circular SVG timer ring.
  Add progress bar at top.

STEP 9 — Result /pages/result.js
  Modify per Section 4.4.
  Add XP toast, guest banner, updated button styles.

STEP 10 — Profile /pages/profile.js
  New page per Section 4.6.
  signOut({ callbackUrl: "/" }) on sign out button.

STEP 11 — Streak history /pages/streak.js
  New page per Section 4.7.
  Use getStreakDays() logic to compute circle states.

STEP 12 — XP history /pages/history.js
  New page per Section 4.8.
  Calls GET /api/score-history.

STEP 13 — Leaderboard /pages/leaderboard.js
  Full replacement per Section 4.5.
  Kahoot-style podium (top 3) + flat list.
```

---

## 12. Verification Checklist

Run these after completing all steps:

```
[ ] Open on laptop → 430px centered column, dark gutter on both sides

[ ] Open on mobile (375px) → fills full screen, no gutter

[ ] Dashboard → NO vertical scroll on any standard phone screen

[ ] Dashboard → Subject dropdown → topics load → Start Quiz button glows

[ ] Start Quiz → quiz page shows circular timer ring, shrinks each second

[ ] Complete quiz as guest → result page shows "Login to save" banner

[ ] Complete quiz as logged-in → XP toast slides up with spring animation

[ ] Tap streak pill on dashboard → /streak opens with calendar

[ ] /streak → orange lightning circles for streak days, empty for rest

[ ] Tap XP History on profile → /history opens with session log

[ ] /history → shows subject emoji, date, "+XX XP", correct/total

[ ] Tap Sign Out on profile → lands on / (NOT /auth/signin)

[ ] New Google account → sees /onboarding with name pre-filled

[ ] Existing account → goes directly to /dashboard (no onboarding)

[ ] /leaderboard → podium visible immediately (top 3), list below

[ ] Bottom nav → active tab highlighted with emerald dot
```

---

*End of SSC GK Score Booster Mobile-First Redesign PRD*
*Paste the message at the top of this file into Claude Code after uploading.*
