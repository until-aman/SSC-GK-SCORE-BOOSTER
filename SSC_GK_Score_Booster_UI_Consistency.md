# SSC GK Score Booster — UI Consistency PRD

---

## PASTE THIS MESSAGE INTO CLAUDE CODE AFTER UPLOADING THIS FILE

```
I am uploading SSC_GK_Score_Booster_UI_Consistency.md

Read the ENTIRE file before touching any code.
This is a UI-only consistency pass. Zero logic changes. Zero API changes.
Zero color scheme changes. The existing dark design (slate-900 background,
emerald accent, orange streak) stays exactly as it is.

The ONLY goals are:
1. Every screen uses the same card layout structure
2. Typography is consistent across all screens (same sizes, weights, fonts)
3. Buttons look identical across all screens
4. Spacing is consistent across all screens
5. No screen looks visually disconnected from the others

Do not change any onClick handler, API call, router.push, state logic,
or business logic. Only touch className and layout structure.

Implement screens in the order listed under IMPLEMENTATION ORDER.
After each screen, visually verify it matches the design tokens below
before moving to the next screen.
```

---

## 1. Design Tokens (Single Source of Truth)

These are extracted from the existing codebase. Standardise every screen
to use exactly these values. Nothing new is introduced.

### 1.1 Colors (existing — do not change)

```
PAGE BACKGROUND:      #0f172a  (bg-slate-900)
CARD SURFACE:         #1e293b  (bg-slate-800)
CARD ELEVATED:        #263348  (slightly lighter, for nested boxes)
BORDER:               #334155  (border-slate-700)
BORDER SUBTLE:        rgba(255,255,255,0.06)

PRIMARY ACCENT:       #10b981  (emerald-500) — CTAs, active, XP, correct
STREAK / FIRE:        #f97316  (orange-500) — streak, timer warning, fire
GOLD:                 #f59e0b  (amber-500) — rank #1, level badges
DANGER:               #ef4444  (red-500) — wrong answers, sign out

TEXT PRIMARY:         #ffffff  (text-white)
TEXT SECONDARY:       #94a3b8  (text-slate-400)
TEXT MUTED:           #475569  (text-slate-600)
TEXT ACCENT:          #10b981  (text-emerald-400)
TEXT STREAK:          #f97316  (text-orange-400)
```

### 1.2 Typography (standardise across all screens)

Use ONLY these combinations. No other font size or weight is permitted.

```
PAGE TITLE:
  font-display font-black text-xl text-white
  (e.g. "Leaderboard", "Profile", "Streak History")

SECTION HEADING:
  font-display font-bold text-base text-white
  (e.g. "Start a Quiz", "Top This Week", "This Week")

CARD LABEL / STAT NUMBER:
  font-display font-black text-2xl
  (e.g. score numbers, XP count, streak count)

LARGE DISPLAY NUMBER:
  font-display font-black text-3xl text-white
  (e.g. raw score on result page only)

BODY TEXT:
  font-sans font-medium text-sm text-slate-300
  (e.g. descriptions, question text, body copy)

CAPTION / LABEL:
  font-sans font-medium text-xs text-slate-400 uppercase tracking-wide
  (e.g. "Total XP", "Day Streak", column labels)

BUTTON TEXT:
  font-display font-bold text-base
  (all buttons — primary, secondary, ghost)

SMALL LINK / GHOST:
  font-sans font-medium text-sm text-emerald-400
  (e.g. "View all →", "Skip", "Detailed Analysis →")

NAV LABEL:
  font-sans font-medium text-[10px] tracking-wide
  (bottom nav only)

BADGE TEXT:
  font-display font-bold text-xs
  (level badge, XP badge, streak badge)
```

### 1.3 Card Structure (apply to every screen)

Every screen must follow this exact outer → inner structure:

```
OUTER (page root div):
  className="flex flex-col flex-1 bg-slate-900"
  This is the page background. It fills the full card from _app.js.

INNER SECTIONS (content blocks within the page):
  Each distinct section is wrapped in:
  className="bg-slate-800 rounded-3xl mx-4 [mt-3 or mt-4]"
  Internal padding: p-4 or px-4 py-4

  For elevated/nested boxes inside a section:
  className="bg-slate-700/50 rounded-2xl p-3"

DIVIDERS between list items:
  className="border-b border-slate-700/60 last:border-0"

No section should have a flat bg-slate-900 surface with no card wrapper.
Every content block must visually sit inside a rounded card.
```

### 1.4 Spacing (use only these — no arbitrary values)

```
Between page sections:    mt-3
Between card items:       gap-2 or gap-3
Card internal padding:    p-4
Horizontal page margin:   mx-4
Vertical page start:      pt-4 or pt-safe
Bottom padding (nav):     pb-24
Button vertical padding:  py-4
Input vertical padding:   py-3.5
Icon size (nav):          w-6 h-6
Icon size (inline):       w-5 h-5 or w-4 h-4
Avatar (profile bar):     w-9 h-9
Avatar (list):            w-10 h-10
Avatar (profile page):    w-16 h-16
```

### 1.5 Border Radius (use only these)

```
Page-level cards:     rounded-3xl  (24px)
Buttons:              rounded-2xl  (16px)
Input fields:         rounded-xl   (12px)
Inline pills/badges:  rounded-full
Stat boxes:           rounded-2xl
Avatar circles:       rounded-full
Bottom sheet:         rounded-t-3xl (top corners only)
```

### 1.6 Button Styles (3 variants — identical across ALL screens)

```
PRIMARY (emerald — main CTAs):
  w-full py-4 rounded-2xl
  bg-emerald-500 text-white
  font-display font-bold text-base
  active:scale-95 transition-transform duration-100
  shadow-[0_4px_14px_rgba(16,185,129,0.3)]

  ENABLED + ANIMATED (Start Quiz button):
    Add class: btn-breathe
    (existing CSS animation — green glow pulse)

SECONDARY (slate — non-primary actions):
  w-full py-4 rounded-2xl
  bg-slate-700 border border-slate-600
  text-white font-display font-bold text-base
  active:scale-95 transition-transform duration-100

GHOST (text only):
  text-emerald-400 font-sans font-medium text-sm
  underline underline-offset-2
  (used for Skip, tertiary links, "View all →" inline)

DANGER (sign out only):
  w-full py-4 rounded-2xl
  bg-red-500/10 border border-red-500/20
  text-red-400 font-display font-bold text-base
  active:scale-95 transition-transform duration-100

DISABLED:
  w-full py-4 rounded-2xl
  bg-slate-700 text-slate-500
  font-display font-bold text-base
  cursor-not-allowed opacity-60
```

### 1.7 Bottom Navigation (consistent across dashboard, leaderboard, profile)

```
fixed bottom-0 left-1/2 -translate-x-1/2
w-full max-w-[430px] h-16 z-50
bg-slate-900/95 backdrop-blur-md border-t border-slate-800
flex justify-around items-center px-6

Each tab (flex-col items-center gap-0.5):
  Icon: w-6 h-6 inline SVG stroke-based strokeWidth=1.5
  Label: font-sans font-medium text-[10px] tracking-wide
  Active:   text-emerald-400 + dot (w-1 h-1 bg-emerald-400 rounded-full mt-0.5)
  Inactive: text-slate-600

Active state determined by router.pathname.
```

### 1.8 Input / Dropdown Fields (consistent across all screens)

```
Label above field:
  font-sans font-medium text-xs text-slate-400 uppercase tracking-wide mb-1.5

Field:
  w-full bg-slate-700 border border-slate-600 rounded-xl
  px-4 py-3.5 text-white text-sm font-medium
  placeholder:text-slate-500
  focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none
  appearance-none (for select elements)

Disabled field:
  opacity-40 cursor-not-allowed

Custom chevron for select:
  Wrap in relative div
  Add absolute right-3 top-1/2 -translate-y-1/2 chevron SVG text-slate-400
```

---

## 2. Screen-by-Screen Changes

### 2.1 `/` — Auth Landing

```
Root: flex flex-col items-center justify-center flex-1 bg-slate-900 px-6

LOGO BLOCK (text-center mb-8):
  Logo: existing lightbulb image or ⚡ SVG
    w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center
    (keep existing logo — do not change)
  App name: font-display font-black text-xl text-white mt-3
  Tagline: font-sans font-medium text-sm text-slate-400 mt-1

STAT STRIP (bg-slate-800 rounded-3xl px-6 py-4 w-full mb-8):
  flex justify-around
  Each stat (flex-col items-center):
    Number: font-display font-black text-lg text-emerald-400
    Label:  font-sans text-xs text-slate-500 mt-0.5

GOOGLE BUTTON (SECONDARY style from 1.6):
  Left: Google G SVG 20px inline
  Text: "Continue with Google"

OR DIVIDER (flex items-center gap-3 my-4 w-full):
  Line: flex-1 h-px bg-slate-700
  Text: font-sans text-xs text-slate-600 "OR"

GUEST BUTTON (SECONDARY style from 1.6):
  Text: "Play as Guest"
  Color override: text-slate-300 (slightly muted vs primary)

FOOTER (mt-6 text-center):
  font-sans text-xs text-slate-600
  "Made with ❤️ to boost your marks in GK"
```

### 2.2 `/onboarding-slides` — Carousel

```
Root: flex flex-col flex-1 bg-slate-900

TOP BAR (h-12 px-4 flex items-center justify-end):
  Skip: GHOST style (text-slate-500, no underline — just text)

ILLUSTRATION (flex-1 flex flex-col items-center justify-center px-6):
  Emoji circle: keep existing gradient backgrounds (unchanged)
  Title: font-display font-black text-xl text-white text-center
  Subtitle: font-display font-bold text-sm text-center
    keep per-slide colors but ensure minimum contrast on dark bg:
    blue-400, orange-400, emerald-400, amber-400, violet-400
  Body: font-sans font-medium text-sm text-slate-400 text-center
        max-w-[300px] mx-auto leading-relaxed

BOTTOM BAR (h-20 px-6 flex items-center justify-between):
  Dots:
    Active: w-6 h-2.5 bg-emerald-500 rounded-full (NOT white — use accent)
    Inactive: w-2.5 h-2.5 bg-slate-600 rounded-full

  Next button (slides 0-3): SECONDARY style
    Text: "Next →"

  Last slide CTA: PRIMARY style + btn-breathe
    Text: "Start Practising →"
```

### 2.3 `/onboarding` — Name Setup

```
Root: flex flex-col items-center justify-center flex-1 bg-slate-900 px-6

Logo: same as landing page

Heading: PAGE TITLE token — "Welcome!"
Subtext: BODY TEXT token — max-w-[280px] text-center mt-2 mb-8

Name input: INPUT style from 1.8
  Default value: session.user.name

"Let's Go →" button: PRIMARY style — mt-4 w-full
"Skip" link: GHOST style — mt-3 text-center block
```

### 2.4 `/dashboard` — Main Dashboard

```
Root: flex flex-col flex-1 bg-slate-900

PROFILE BAR (h-14 px-4 flex items-center justify-between
             border-b border-slate-800):
  Left (flex items-center gap-3):
    Avatar: w-9 h-9 rounded-full bg-gradient-to-br from-sky-700 to-emerald-700
            flex items-center justify-center font-display font-bold text-sm text-white

    Text (flex-col):
      Name: font-display font-semibold text-sm text-white leading-none
      Level+XP: font-sans text-xs text-slate-400 mt-0.5
                "{level} · {totalXP} XP"
      Guest: font-sans text-xs text-slate-500 "Guest · not saved"

  Right (flex items-center gap-2):
    Streak badge (tap → /streak):
      bg-orange-500/15 border border-orange-500/30 rounded-full
      px-3 py-1.5 flex items-center gap-1.5
      ⚡ SVG orange-500 14px
      "{n} days" font-display font-semibold text-xs text-orange-400

STREAK + RANK ROW (h-12 px-4 flex items-center gap-3):
  Left pill (tap → /streak):
    bg-slate-800 border border-slate-700 rounded-full
    px-4 h-9 flex items-center gap-2
    ⚡ orange-500 14px
    "{n} day streak" font-sans font-semibold text-xs text-white
    "→" text-slate-600 text-xs

  Right pill (tap → /leaderboard):
    bg-slate-800 border border-slate-700 rounded-full
    px-4 h-9 flex items-center gap-2
    🏆 text-amber-400 text-sm
    "#{rank} this week" font-sans font-semibold text-xs text-white
    "→" text-slate-600 text-xs

  Guest pills: text-slate-600, "Login to track streak" / "Play to rank"

QUIZ SETUP (flex-1 px-4 py-3 flex flex-col justify-between):
  Section label: SECTION HEADING token "Start a Quiz"

  Count tiles (flex gap-2):
    Selected: bg-emerald-500 rounded-2xl p-3
      Top: font-sans text-xs text-white/70
      Count: font-display font-black text-xl text-white
      Time: font-sans text-xs text-white/60
      shadow-[0_4px_14px_rgba(16,185,129,0.3)]

    Unselected: bg-slate-700/60 border border-slate-600 rounded-2xl p-3
      Top: font-sans text-xs text-slate-500
      Count: font-display font-black text-xl text-slate-300
      Time: font-sans text-xs text-slate-600

  Subject/Topic: INPUT style from 1.8

  Available count: font-sans text-xs text-slate-500 mt-1 ml-1

  Start Quiz button:
    Disabled: DISABLED style from 1.6
    Enabled: PRIMARY style + btn-breathe
    Text: "Start Quiz →"

LEADERBOARD PREVIEW (bg-slate-800 rounded-3xl mx-4 mb-4 p-4):
  Header: flex justify-between items-center mb-3
    Left: "🏆 Top This Week" SECTION HEADING token
    Right: "View all →" GHOST style (no underline, just text-emerald-400 text-xs)

  Each row: flex items-center py-2.5 border-b border-slate-700/60 last:border-0
    Medal: text-lg w-8 text-center
    Name: font-sans font-semibold text-sm text-white flex-1
    Score: font-display font-bold text-sm text-emerald-400

  Empty: font-sans text-sm text-slate-500 text-center py-4

BOTTOM NAV: spec from 1.7
```

### 2.5 `/quiz` — Quiz Page

```
Root: flex flex-col flex-1 bg-slate-900

TOP BAR (h-12 px-4 flex items-center justify-between
         border-b border-slate-800):
  Left: "{subject} · {topic}"
        font-sans font-medium text-xs text-slate-400 truncate max-w-[160px]
  Center: "Q {n}/{total}"
          font-display font-bold text-sm text-white
  Right: "⚡ +10 XP"
         font-sans font-semibold text-xs text-orange-400

PROGRESS BAR (h-1 bg-slate-800):
  Fill: bg-emerald-500 transition-all duration-300

TIMER RING (mx-auto mt-5 w-20 h-20 relative):
  Track: slate-700 stroke
  Fill: emerald-500 (normal) → orange-500 (≤7s) — keep existing logic
  Center number:
    Normal: font-display font-black text-xl text-white
    Warning: text-orange-400

QUESTION CARD (bg-slate-800 rounded-3xl mx-4 mt-4 px-4 py-4
               border border-slate-700):
  Question: font-display font-bold text-sm text-white leading-relaxed

OPTION BUTTONS (px-4 mt-3 flex flex-col gap-2):
  Default: bg-slate-800 border border-slate-700 rounded-2xl
           px-4 py-3.5 flex items-center gap-3
           active:scale-[0.98] transition-all duration-100

  Letter badge: w-7 h-7 rounded-full bg-slate-700
                font-display font-bold text-xs text-slate-300

  Option text: font-sans font-medium text-sm text-white

  Correct: bg-emerald-500/15 border-emerald-500
    Badge: bg-emerald-500 text-white

  Incorrect: bg-red-500/15 border-red-500
    Badge: bg-red-500 text-white

  Other (after answer): opacity-40

SKIP (text-center mt-3):
  font-sans font-medium text-sm text-slate-500 py-3
  "Skip question →"
```

### 2.6 `/result` — Result Page

```
Root: flex flex-col flex-1 bg-slate-900 pb-6

SCORE CARD (bg-slate-800 rounded-3xl mx-4 mt-4 px-6 py-6
            border border-slate-700 text-center):
  Score: font-display font-black text-3xl text-white
  "marks scored": font-sans text-sm text-slate-400 mt-1

  3-stat row (flex justify-around mt-5):
    Each: flex-col items-center
      Number: font-display font-black text-2xl
        correct → text-emerald-400
        wrong → text-red-400
        skipped → text-slate-400
      Label: font-sans text-xs text-slate-500 uppercase tracking-wide mt-1

  Accuracy bar (mt-5):
    Labels: flex justify-between font-sans text-xs text-slate-500 mb-1.5
    Track: h-2 bg-slate-700 rounded-full
    Fill: bg-emerald-500 rounded-full transition-all duration-700

XP SAVE CARD (bg-emerald-900/30 border border-emerald-500/30
              rounded-3xl mx-4 mt-3 p-4):
  Row 1 (flex justify-between):
    "⚡ +{xpEarned} XP earned" font-display font-bold text-base text-white
    "🔥 {n} day streak" font-sans font-semibold text-sm text-orange-400
  Row 2: "Level: {level} · {totalXP} XP" font-sans text-sm text-emerald-400
  Row 3 (if first quiz today):
    "🌅 First quiz bonus included!" font-sans text-xs text-amber-400

GUEST BANNER (bg-slate-800 border border-emerald-500/20
              rounded-3xl mx-4 mt-3 p-4 text-center):
  "🔒" text-2xl
  "Login to save your score, XP, and streak"
  font-sans text-sm text-slate-300 mt-2
  Google button (SECONDARY style, smaller py-2.5) mt-3

ACTION BUTTONS (px-4 mt-4 flex flex-col gap-3):
  "Back to Home": PRIMARY style
  "View Leaderboard": SECONDARY style
  "Detailed Analysis →": GHOST style text-center block

WHATSAPP (bg-slate-800 border border-slate-700 rounded-3xl
          mx-4 mt-3 px-4 py-3.5 flex items-center gap-3):
  WhatsApp SVG (green, 22px)
  "Challenge your friends →"
  font-sans font-semibold text-sm text-emerald-400
```

### 2.7 `/leaderboard` — Leaderboard Page

```
Root: flex flex-col flex-1 bg-slate-900

STICKY HEADER (bg-slate-900/95 backdrop-blur px-4 pt-8 pb-0
               sticky top-0 z-10 border-b border-slate-800):
  Title: PAGE TITLE token "Leaderboard"

  TABS (mt-3 flex bg-slate-800 rounded-full p-1 w-fit):
    Active: bg-emerald-500 text-white rounded-full px-5 py-1.5
            font-display font-bold text-sm
    Inactive: text-slate-400 px-5 py-1.5
              font-display font-bold text-sm

PODIUM (bg-gradient-to-b from-violet-900/40 to-transparent px-4 pt-5 pb-3):
  Keep existing podium structure. Standardise text inside:
    Names: font-display font-bold text-sm text-white (truncate max-w-[72px])
    Score pills: bg-white/15 rounded-full px-2.5 py-0.5
                 font-display font-bold text-xs text-white
    Podium block text (rank numbers): keep medal emojis

FLAT LIST (bg-slate-900 px-4 pb-24):
  Current user card:
    bg-violet-900/30 border border-violet-500/30 rounded-2xl p-3 mb-4
    "#{rank}" font-display font-black text-lg text-violet-300 w-10
    Name: font-sans font-semibold text-sm text-white
    Score: font-display font-bold text-sm text-emerald-400

  Not ranked: font-sans text-sm text-slate-500 text-center py-4
              "Play a quiz to earn your first marks."

  Each row: flex items-center gap-3 py-3
            border-b border-slate-800 last:border-0
    Rank: font-display font-bold text-sm text-slate-500 w-8 text-right
    Avatar: w-10 h-10 rounded-full bg-slate-700
            font-display font-bold text-sm text-slate-300
    Name: font-sans font-semibold text-sm text-white flex-1
    Accuracy: font-sans text-xs text-slate-500
    Score: font-display font-bold text-sm text-emerald-400 text-right

  Current user row highlight:
    bg-violet-900/20 rounded-xl -mx-1 px-1

BOTTOM NAV: spec from 1.7
```

### 2.8 `/profile` — Profile Page

```
Root: flex flex-col flex-1 bg-slate-900 pb-16

HEADER (h-14 px-4 flex items-center border-b border-slate-800):
  PAGE TITLE token "Profile"

AVATAR CARD (bg-gradient-to-br from-sky-900 via-[#1b6ca8] to-emerald-900
             rounded-3xl mx-4 mt-4 px-5 py-5 flex items-center gap-4):
  Avatar: w-16 h-16 rounded-full bg-white/20 border-2 border-white/30
          font-display font-black text-2xl text-white
  Right:
    Name: font-display font-bold text-lg text-white
    Email: font-sans text-xs text-white/60
    Member since: font-sans text-xs text-white/50
    Level badge: bg-white/15 rounded-full px-2.5 py-0.5 w-fit mt-1
                 BADGE TEXT token "⭐ {level}"

STATS ROW (mx-4 mt-3 grid grid-cols-3 gap-2):
  Each box: bg-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1
            border border-slate-700
    Number: font-display font-black text-2xl
      XP: text-emerald-400
      Streak: text-orange-400
      Level: text-violet-400
    Label: CAPTION token

LEVEL PROGRESS (bg-slate-800 border border-slate-700
                rounded-3xl mx-4 mt-3 px-4 py-4):
  Row: flex justify-between items-center mb-2
    Current: font-display font-bold text-sm text-white
    Next: font-sans text-sm text-slate-500
  Bar: h-2 bg-slate-700 rounded-full
    Fill: bg-emerald-500 transition-all duration-700
  XP label: font-sans text-xs text-slate-500 mt-1.5 text-right

ACTION ROWS (mx-4 mt-3 flex flex-col gap-2):
  Streak History row:
    bg-slate-800 border border-slate-700 rounded-2xl
    px-4 py-4 flex items-center gap-3
    active:scale-[0.98] transition-transform
    ⚡ SVG orange-500 18px
    "Streak History" font-sans font-semibold text-sm text-white flex-1
    Chevron SVG text-slate-600 16px

  XP History row: (same structure)
    📊 SVG emerald-500 18px
    "XP History" font-sans font-semibold text-sm text-white flex-1

  Sign Out: DANGER style from 1.6 (full width pill)
    Logout SVG red-400 18px inline left
    "Sign Out"

  Guest "Sign in" row: SECONDARY style
    Google G SVG + "Sign in with Google"

BOTTOM NAV: spec from 1.7
```

### 2.9 `/streak` — Streak History Page

```
Root: flex flex-col flex-1 bg-slate-900 pb-6

HEADER (px-4 pt-8 pb-4 flex items-center gap-3):
  Back button: w-9 h-9 rounded-full bg-slate-800 border border-slate-700
               flex items-center justify-center ← SVG text-white
  PAGE TITLE token "Streak History"

HERO CARD (bg-gradient-to-br from-orange-900/50 to-amber-900/30
           border border-orange-500/30 rounded-3xl mx-4 mt-2 px-5 py-5
           flex items-center justify-between):
  Left:
    "🔥" text-4xl
    "{n}" font-display font-black text-4xl text-white
    "day streak" font-sans text-sm text-orange-300 mt-0.5
  Right:
    Status: font-sans text-xs text-orange-300
    "✓ Protected today" or "Play today to extend!"

CALENDAR CARD (bg-slate-800 border border-slate-700
               rounded-3xl mx-4 mt-3 p-4):
  Title: SECTION HEADING token "This Week" mb-3

  7-day row (flex justify-between):
    Day label: font-sans text-xs text-slate-500 text-center mb-1.5
    Circle (w-9 h-9 rounded-full mx-auto flex items-center justify-center):
      Completed: bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]
                 ⚡ white SVG 16px
      Today-done: bg-orange-500 ring-2 ring-orange-300 ring-offset-2
                  ring-offset-slate-800 ⚡ white SVG
      Today-todo: bg-slate-900 border-2 border-white empty
      Future: bg-slate-700 border border-slate-600 empty

  Counter row (flex justify-between items-center mt-3):
    Left: ⚡ orange-500 16px + "{n} days"
          font-display font-bold text-lg text-white
    Right: two nav buttons bg-slate-700 rounded-lg w-8 h-8
           text-slate-400 (visual only)

MOTIVATION CARD (bg-slate-800 border border-slate-700
                 rounded-3xl mx-4 mt-3 px-4 py-4 text-center):
  font-sans font-medium text-sm text-slate-300
  Motivational text based on streakCount (keep existing logic)

CTA (mx-4 mt-4):
  PRIMARY style "Practice Now →"
```

### 2.10 `/history` — XP History Page

```
Root: flex flex-col flex-1 bg-slate-900 pb-6

HEADER (same structure as /streak header):
  "XP History" PAGE TITLE token

HERO CARD (bg-gradient-to-br from-emerald-900/50 to-teal-900/30
           border border-emerald-500/30 rounded-3xl mx-4 mt-2 px-5 py-5
           flex items-center justify-between):
  Left:
    "⚡" text-4xl
    "{totalXP}" font-display font-black text-4xl text-white
    "total XP" font-sans text-sm text-emerald-300 mt-0.5
  Right:
    Level: font-display font-black text-xl text-white
    "Level" CAPTION token below
    "{xpToNext} XP to {nextLevel}" font-sans text-xs text-slate-400 mt-1

SESSION LIST (px-4 mt-4):
  Title: SECTION HEADING token "Recent Sessions" mb-3

  Each session (bg-slate-800 border border-slate-700
                rounded-2xl px-4 py-3.5 mb-2
                flex items-center gap-3):
    Subject icon box: w-9 h-9 rounded-xl bg-slate-700
                      flex items-center justify-center text-xl
    Middle (flex-col flex-1 gap-0.5):
      "{subject} · {topic}" font-sans font-semibold text-sm text-white truncate
      "{date}" font-sans text-xs text-slate-500
    Right (flex-col items-end gap-0.5):
      "+{xpEarned} XP" font-display font-bold text-sm text-emerald-400
      "{correct}/{total} correct" font-sans text-xs text-slate-500

  Empty state (text-center py-12):
    "⚡" text-4xl mb-3
    font-sans text-sm text-slate-400
    [PRIMARY button "Play Now →"] mt-4

  Loading: 5 skeleton rows h-16 rounded-2xl skeleton mb-2

  Guest state (text-center py-12):
    font-sans text-sm text-slate-400
    [SECONDARY button "Sign in with Google"] mt-4
```

---

## 3. Skeleton Loading (consistent across all screens)

All loading states use this pattern — no spinners anywhere:

```css
/* Already in globals.css — verify it exists */
.skeleton {
  background: linear-gradient(90deg,#1e293b 25%,#263348 50%,#1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

Loading placeholder shapes:
```
Profile card skeleton: h-24 rounded-3xl skeleton mx-4 mt-4
Stat row skeleton: h-20 rounded-2xl skeleton mx-4 mt-3
List row skeleton: h-14 rounded-2xl skeleton mb-2
Leaderboard row: h-12 rounded-xl skeleton mb-2
```

Never use a spinning circle loader. Always use skeleton shimmer.

---

## 4. Files NOT to Touch

```
All /pages/api/* files        — zero changes
/pages/analysis.js            — zero changes
next.config.js                — zero changes
vercel.json                   — zero changes
All quiz logic (state, timer) — zero changes
All router.push calls         — zero changes
All onClick handlers          — zero changes
```

---

## 5. Implementation Order

```
STEP 1 — globals.css
  Verify skeleton, btn-breathe, fade-in-down, slideUp, deplete,
  breatheOrange all exist. Add any that are missing.
  Do not remove any existing animations.

STEP 2 — _app.js
  Verify the shell wrapper matches Section 1.3.
  The outer div must be bg-slate-900, card div bg-slate-800 or white.
  Wait — keep the existing dark shell. Do not change _app.js outer colors.
  Only ensure the inner card max-w-[430px] constraint is correct.

STEP 3 — BottomNav component
  Apply spec from Section 1.7 exactly.
  Emerald active state, slate-600 inactive.
  Verify active dot appears on correct tab per router.pathname.

STEP 4 — /pages/index.js
  Apply Section 2.1. Typography tokens only. No color changes.

STEP 5 — /pages/onboarding-slides.js
  Apply Section 2.2. Dot colors → emerald-500 active.

STEP 6 — /pages/onboarding.js
  Apply Section 2.3.

STEP 7 — /pages/dashboard.js
  Apply Section 2.4. This is the most complex — go field by field.
  After: verify no scroll on 375×812 viewport.

STEP 8 — /pages/quiz.js
  Apply Section 2.5.

STEP 9 — /pages/result.js
  Apply Section 2.6.

STEP 10 — /pages/leaderboard.js
  Apply Section 2.7.

STEP 11 — /pages/profile.js
  Apply Section 2.8.

STEP 12 — /pages/streak.js
  Apply Section 2.9.

STEP 13 — /pages/history.js
  Apply Section 2.10.
```

---

## 6. Verification Checklist

```
TYPOGRAPHY
[ ] Every page title uses: font-display font-black text-xl text-white
[ ] Every section heading uses: font-display font-bold text-base text-white
[ ] Every body text uses: font-sans font-medium text-sm text-slate-300
[ ] Every caption uses: font-sans font-medium text-xs text-slate-400
[ ] No arbitrary text sizes (no text-[13px], text-[15px], etc.)
[ ] No text-lg, text-2xl used for body copy (only for display numbers)

BUTTONS
[ ] All primary CTAs are emerald-500 rounded-2xl py-4 w-full
[ ] All secondary buttons are slate-700 border-slate-600 rounded-2xl
[ ] Sign Out is red-500/10 border red-500/20 rounded-2xl
[ ] Disabled state is slate-700 opacity-60 cursor-not-allowed
[ ] Start Quiz glows with btn-breathe when enabled

CARDS
[ ] Every content block sits inside bg-slate-800 rounded-3xl mx-4
[ ] No content sits directly on bg-slate-900 without a card wrapper
[ ] All cards have border border-slate-700

SPACING
[ ] All horizontal margins are mx-4 (no mx-3, mx-5, mx-6)
[ ] Section spacing is mt-3 between cards
[ ] Button padding is py-4 (not py-3 or py-5)
[ ] Input padding is py-3.5

BOTTOM NAV
[ ] Appears on: dashboard, leaderboard, profile
[ ] Active tab is text-emerald-400 with dot
[ ] Inactive tab is text-slate-600
[ ] Height is h-16

LOADING
[ ] No spinning loaders anywhere
[ ] All loading states use skeleton shimmer class
[ ] Skeleton shapes match the content they replace
```

---

*End of SSC GK Score Booster UI Consistency PRD*
*Paste the message at the top of this file into Claude Code after uploading.*
