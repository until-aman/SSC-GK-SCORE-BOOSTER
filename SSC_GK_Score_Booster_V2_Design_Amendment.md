# PRD Design Amendment — SSC GK Score Booster V2
## Visual Design Specification (Reference-Based)

**Appends to:** SSC GK Score Booster V2 PRD  
**Purpose:** Override all generic UI descriptions in the base PRD with pixel-precise specs derived from the 5 reference images provided.  
**Rule:** When this document conflicts with the base PRD on any visual detail, this document wins.

---

## Reference Image Map

| Ref | Source App | What to copy |
|---|---|---|
| Ref-1 | Duolingo streak calendar | Streak weekly tracker UI, circle fill logic, orange lightning bolt |
| Ref-2 | Whoop profile screen | Profile card layout, dark teal colors, level badge with laurel wreath |
| Ref-3 | Yoga fitness dashboard | Dashboard overall structure, date strip, plan card grid layout |
| Ref-4 | Quiz discovery cards | Subject card grid, "Q count" badge, illustration + card pattern |
| Ref-5 | Kahoot Final Scoreboard | Podium (top 3) + flat list (rank 4+) leaderboard layout |

---

## 1. Global Design Tokens (Override base PRD Section 12)

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-page:          #0f172a;   /* slate-900 — page background */
  --bg-card:          #1e293b;   /* slate-800 — card surfaces */
  --bg-card-elevated: #263348;   /* slightly lighter card for emphasis */
  --bg-streak-done:   #f97316;   /* orange-500 — completed streak day */
  --bg-streak-today:  #000000;   /* today's day circle border */
  --bg-podium-hero:   #7c3aed;   /* violet-700 — leaderboard podium bg */

  /* Accents */
  --accent-primary:   #10b981;   /* emerald-500 — XP, CTAs, active states */
  --accent-streak:    #f97316;   /* orange-500 — streak, flame, lightning */
  --accent-gold:      #f59e0b;   /* amber-500 — #1 rank, level badge */
  --accent-silver:    #94a3b8;   /* slate-400 — #2 rank */
  --accent-bronze:    #cd7c2f;   /* custom — #3 rank */

  /* Text */
  --text-primary:     #ffffff;
  --text-secondary:   #94a3b8;   /* slate-400 */
  --text-muted:       #475569;   /* slate-600 */
  --text-accent:      #10b981;   /* emerald-500 */

  /* Borders */
  --border-default:   #334155;   /* slate-700 */
  --border-accent:    rgba(16, 185, 129, 0.3); /* emerald with 30% opacity */
}
```

### Typography

```css
/* Import in pages/_document.js or globals.css */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap');

body {
  font-family: 'Inter', sans-serif;
  background: #0f172a;
}

/* Headings and numbers — use Nunito for gamified feel */
.font-display { font-family: 'Nunito', sans-serif; }
```

**Nunito** is used for all large numbers (XP count, streak count, leaderboard scores) and headings. Its rounded letterforms match the Duolingo/Kahoot style.  
**Inter** is used for all body copy, labels, and UI text.

### Border Radius Scale

```
Cards:         rounded-3xl   (24px)
Buttons:       rounded-2xl   (16px)
Chips/badges:  rounded-full
Input fields:  rounded-xl    (12px)
Tab bar:       rounded-full  (pill)
```

### Shadows

```css
/* Card elevation */
.shadow-card { box-shadow: 0 4px 24px rgba(0,0,0,0.4); }

/* CTA glow (when button is active/enabled) */
.shadow-cta  { box-shadow: 0 0 20px rgba(16,185,129,0.35); }

/* Streak orange glow */
.shadow-streak { box-shadow: 0 0 16px rgba(249,115,22,0.4); }

/* Podium #1 glow */
.shadow-gold { box-shadow: 0 0 20px rgba(245,158,11,0.5); }
```

---

## 2. Auth/Landing Page (`/`) — Design Spec

**Reference:** Whoop profile (Ref-2) for dark premium feel, yoga app (Ref-3) for layout energy.

### Full Layout (390 × 844px, no scroll)

```
┌─────────────────────────┐
│                         │
│     [Logo 56px]         │  ← centered, mt-16
│   SSC GK Score Booster  │  ← Nunito ExtraBold, text-3xl, text-white
│  Practice. Rank. Win.   │  ← Inter, text-sm, text-slate-400, mt-1
│                         │
│  ●●● Join 500+ aspirants│  ← avatar circles + text, mt-8
│                         │
│ ┌──────┐ ┌──────┐ ┌────┐│
│ │  8   │ │1000+ │ │Free││  ← 3-col stat row, mt-6
│ │Subj. │ │  Qs  │ │    ││
│ └──────┘ └──────┘ └────┘│
│                         │
│ ┌─────────────────────┐ │
│ │ [G] Continue w Google│ │  ← white button, mt-10
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │    Play as Guest    │ │  ← outline button, mt-3
│ └─────────────────────┘ │
│                         │
│  Questions by Parmar SSC│  ← text-xs, text-slate-600, absolute bottom-8
└─────────────────────────┘
```

**Background:** `bg-gradient-to-b from-slate-900 via-[#0c1f35] to-slate-900` — creates a subtle dark blue center glow.

**Logo:** Use a ⚡ lightning bolt SVG (color `#f97316`, orange-500) inside a `w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center` container. The lightning bolt matches the streak visual language.

**Stat boxes:**
```
bg-slate-800/80, border border-slate-700, rounded-2xl
padding: px-4 py-3
Number: Nunito font-black text-xl text-emerald-400
Label:  Inter text-xs text-slate-500 mt-0.5
```

**Google button:**
```
w-full max-w-[320px] mx-auto
bg-white text-slate-900
rounded-2xl py-4 px-6
flex items-center justify-center gap-3
font-semibold text-base
shadow-[0_4px_20px_rgba(255,255,255,0.1)]
active:scale-95 transition-transform duration-150
```
Inside: Google "G" SVG (20×20, use inline SVG, no external fetch), then `"Continue with Google"` text.

**Guest button:**
```
w-full max-w-[320px] mx-auto
bg-transparent
border-2 border-slate-700 text-slate-400
rounded-2xl py-4 px-6
font-medium text-base
active:scale-95 transition-transform duration-150
hover:border-slate-500 hover:text-slate-300
```

---

## 3. Dashboard Page (`/dashboard`) — Design Spec

**Reference:** Yoga app (Ref-3) for structure, Whoop (Ref-2) for profile card, Duolingo (Ref-1) for streak calendar.

### Overall Page Structure (scrollable, dark)

```
┌─────────────────────────┐
│ ← [Avatar] Hello, Aman  │  ← Profile header (Ref-2 inspired)
│        Scholar · 260 XP │
├─────────────────────────┤
│ [🔥 Streak Card]        │  ← Ref-1 inspired calendar
├─────────────────────────┤
│ [Start a Quiz]          │  ← Ref-3 "Your Plan" card
│  [Quick 10Q] [Full 25Q] │
│  Subject ▾   Topic ▾    │
│  [START QUIZ ──────────]│
├─────────────────────────┤
│ 🏆 Top This Week  All→  │  ← Leaderboard preview (Ref-5 mini)
│  🥇 Priya    360 pts    │
│  🥈 Rajesh   280 pts    │
│  🥉 Aman     120 pts    │
├─────────────────────────┤
│ [📚 Discover Subjects]  │  ← Ref-4 subject cards (horizontal scroll)
└─────────────────────────┘
│  🏠   🏆   👤           │  ← Fixed bottom nav
```

---

### 3.1 Profile Header Card (Ref-2 — Whoop profile)

**Container:**
```css
background: linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #0f766e 100%);
/* Tailwind: bg-gradient-to-br from-[#0f4c75] via-[#1b6ca8] to-[#0f766e] */
border-radius: 24px;
padding: 16px;
margin: 16px 16px 0;
```

**Internal layout (flex row, items-center, gap-3):**

Left — Avatar circle:
```
w-16 h-16 rounded-full
bg-white/20 backdrop-blur-sm
border-2 border-white/30
flex items-center justify-center
font-display font-black text-2xl text-white
```
Content: first letter of name (uppercase). Guest → `G`.

Right (flex-1, flex-col, gap-0.5):
- Row 1: `"Hello, {name}"` — `font-display font-extrabold text-lg text-white`
- Row 2 (logged-in): Level badge + XP — see LevelBadge spec below. Format: `[Scholar] · 260 XP`
- Row 2 (guest): `"Guest · progress not saved"` — `text-slate-300 text-sm`
- Row 3: `"Member since May 2025"` — `text-white/60 text-xs`

**Level badge** (inline with Row 2, exactly like Whoop's "LEVEL 18" badge):
```
Wrapping pill: bg-white/15, rounded-full, px-2 py-0.5
Text: font-display font-bold text-xs text-white
Icon: ⭐ (star emoji or small SVG laurel) before text
Example: ⭐ Scholar
```

**Member since:** Parse the ISO `createdAt` field and format as `"MMM YYYY"` (e.g. "May 2025"). Use:
```javascript
const d = new Date(userProfile.createdAt);
const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
// → "May 2025"
```

---

### 3.2 Streak Card (Ref-1 — Duolingo calendar)

**Container:**
```
bg-white rounded-3xl mx-4 mt-3 p-4 shadow-card
```
Yes — **white card** on dark page background. This creates the same contrast as the Duolingo streak widget (white card on warm background). This is intentional — it makes the streak section pop.

**Internal structure:**

**Row 1: 7-day calendar**
```
flex justify-between items-center mb-3
```
7 columns (Mon → Sun, starting Monday). For each day:
- **Column header:** Day abbreviation (`"Mo"`, `"Tu"`, `"We"`, `"Th"`, `"Fr"`, `"Sa"`, `"Su"`) — `text-xs text-slate-500 font-medium text-center mb-1`
- **Circle icon:** `w-9 h-9 rounded-full flex items-center justify-center mx-auto`
  
  Circle states (exactly as in Ref-1):
  
  | State | Background | Content | Border |
  |---|---|---|---|
  | Completed past day | `bg-orange-500` | ⚡ white SVG lightning bolt (16px) | none |
  | Today (already played) | `bg-orange-500` | ⚡ white SVG lightning bolt (16px) | `ring-2 ring-orange-300` |
  | Today (not yet played) | `bg-white` | empty circle | `border-2 border-black` |
  | Future day | `bg-white` | empty | `border-2 border-slate-200` |

  **Lightning bolt SVG (inline, white):**
  ```jsx
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
  ```

**Which days are "completed":** client-side only logic. Do NOT call an API for this. Use the `lastAttemptDate` from `userProfile`. For V2, only mark as completed any day where today's streak is active. Simplification: mark all days from `(today - streakCount + 1)` to `today - 1` as completed (orange), `today` as either done or empty based on whether `lastAttemptDate === todayIST`.

```javascript
// Compute which weekday indices (0=Mon ... 6=Sun) to show as completed
function getCompletedDayIndices(streakCount, lastAttemptDate) {
  const todayIST = getISTDateString(); // YYYY-MM-DD
  const todayDate = new Date(todayIST + "T00:00:00+05:30");
  // Day of week: getDay() gives 0=Sun, shift to 0=Mon
  const todayWeekdayIndex = (todayDate.getDay() + 6) % 7; // 0=Mon
  const completedToday = lastAttemptDate === todayIST;
  const doneDays = new Set();

  // Mark backwards from (today or yesterday) for streakCount days
  const base = completedToday ? todayWeekdayIndex : todayWeekdayIndex - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) doneDays.add(idx);
  }
  return { doneDays, todayWeekdayIndex, completedToday };
}
```

For guests: all 7 circles show as empty (future state). No lightning bolts.

**Row 2: Streak counter + navigation**
```
flex items-center justify-between mt-2
```

Left side:
```
flex items-center gap-2
⚡ icon (orange-500, 20px SVG)
"{streakCount} days" — font-display font-black text-xl text-slate-900
```
For guests: show `"0 days"` in muted gray.

Right side: Two small square buttons (navigation arrows for future week-view navigation — visual only in V2, no functionality yet):
```
flex gap-1
Each button: w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center
Arrow icon: text-orange-500 text-sm
Left arrow: ‹, Right arrow: ›
```
The right arrow should be disabled-looking (full orange) and left arrow lighter, to match Ref-1.

**Subtext below row 2:**
```
text-xs text-slate-500 mt-1
```
Content logic:
- Guest: `"Login to start your streak"`
- `lastAttemptDate === todayIST`: `"You've protected your streak today 🎉"`
- else: `"Complete 1 quiz today to protect your streak!"`

---

### 3.3 Quiz Setup Card (Ref-3 — "Your Plan" section)

**Container:**
```
bg-slate-800 rounded-3xl mx-4 mt-3 p-4
border border-slate-700
```

**Title:**
```
"Start a Quiz" — font-display font-bold text-xl text-white mb-4
```

**Count selector (two tiles side by side — exactly like Ref-3's "Yoga Group" and "Balance" plan tiles):**
```
flex gap-3 mb-4
```

Each tile:
```
flex-1 rounded-2xl p-4 cursor-pointer transition-all duration-200
```

Selected tile (Quick 10Q when `selectedCount === 10`):
```
bg-emerald-500
shadow-[0_4px_16px_rgba(16,185,129,0.4)]
scale-[1.02]
```

Unselected tile:
```
bg-slate-700/60 border border-slate-600
```

Tile content (flex-col):
```
Top row:
  difficulty badge: "Quick" or "Full"
  badge style: text-xs rounded-full px-2 py-0.5
  Selected badge: bg-white/20 text-white
  Unselected badge: bg-slate-600 text-slate-300

Middle:
  Count: "10Q" or "25Q" — font-display font-black text-2xl
  Selected: text-white
  Unselected: text-slate-300

Bottom:
  Duration: "~3 min" or "~8 min" — text-xs
  Selected: text-white/70
  Unselected: text-slate-500
```

**Subject dropdown:**
```
mt-4
Label: "Subject" — text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5
Select element:
  w-full bg-slate-700 text-white rounded-xl px-4 py-3.5 text-sm
  border border-slate-600
  focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none
  appearance-none
  background-image: url("data:image/svg+xml,%3Csvg...chevron SVG...%3E") — add custom chevron
```

Custom chevron for select (add as inline background-image or wrap in a relative div with an absolute-positioned chevron SVG on the right):
```jsx
<div className="relative">
  <select ...>...</select>
  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
</div>
```

**Topic dropdown:** Same style as subject. Disabled state adds `opacity-40 cursor-not-allowed`.

**Available count text (show below topic dropdown after topic is selected):**
```
text-xs text-slate-500 mt-1 ml-1
Content: "X questions available in this topic"
Where X = topics.find(t => t.name === selectedTopic)?.count || 0
```

**Start Quiz Button:**

Disabled state:
```
w-full mt-4 py-4 rounded-2xl
bg-slate-700 text-slate-500 font-display font-bold text-base
cursor-not-allowed
```

Enabled state:
```
w-full mt-4 py-4 rounded-2xl
bg-emerald-500 text-white font-display font-bold text-base
shadow-[0_0_20px_rgba(16,185,129,0.4)]
```

Enabled state animation — button should **breathe** (Duolingo-style pulse):
```css
/* In globals.css */
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 16px rgba(16,185,129,0.3); }
  50%       { box-shadow: 0 0 28px rgba(16,185,129,0.6); }
}
.btn-cta-active {
  animation: breathe 2s ease-in-out infinite;
}
```

Button content (flex, items-center, justify-center, gap-2):
```
"Start Quiz" text + → right-arrow icon (20px, SVG or emoji)
```

On tap: `active:scale-95 transition-transform duration-100`

---

### 3.4 Leaderboard Preview Strip

**Container:**
```
bg-slate-800 rounded-3xl mx-4 mt-3 p-4 border border-slate-700
```

**Header row (flex justify-between items-center mb-3):**
- Left: `"🏆 Top This Week"` — `font-display font-bold text-base text-white`
- Right: `<Link href="/leaderboard">` — `text-emerald-400 text-sm font-medium` — `"View all →"`

**Each preview row (max 3 rows):**
```
flex items-center py-2.5 border-b border-slate-700/60 last:border-0
```
- Medal: `text-xl w-9 text-center` — `🥇` `🥈` `🥉`
- Name: `text-white text-sm font-medium flex-1 ml-1`
- Score: `font-display font-bold text-sm text-emerald-400`

**Empty state:**
```
text-center py-6 text-slate-500 text-sm
"No scores this week. Be the first to play!"
```

---

### 3.5 Subject Discovery Cards (Ref-4 — horizontal scroll row)

This is a **new section** not in the base PRD. Add it to the dashboard **below** the leaderboard preview, **above** the bottom nav.

**Purpose:** Let users discover which subject to practice next. Visually inspired by Ref-4's quiz card grid.

**Section title:**
```
mx-4 mt-4 font-display font-bold text-base text-white mb-3
"📚 Discover Subjects"
```

**Horizontal scroll row:**
```jsx
<div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
  {subjects.map(subject => <SubjectCard key={subject.name} subject={subject} />)}
</div>
```
Add `scrollbar-hide` utility (add to globals.css: `.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .scrollbar-hide::-webkit-scrollbar { display: none; }`).

**Each `SubjectCard` (exactly like Ref-4's discovery cards):**

```
w-36 flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer
bg-slate-800 border border-slate-700
active:scale-95 transition-transform
```

Card internal structure:
```
Top section: h-24 rounded-t-2xl relative
  Background: subject-specific gradient (see gradient map below)
  Content: centered emoji (subject icon, 40px)
  Bottom-right badge: "{count} Qs"
    style: absolute bottom-2 right-2
           bg-slate-900/80 backdrop-blur text-white text-xs
           font-bold px-2 py-0.5 rounded-full

Bottom section: p-2.5
  Subject name: font-display font-bold text-xs text-white
  "Tap to practice": text-slate-500 text-[10px] mt-0.5
```

**Subject gradient map:**
```javascript
const subjectStyles = {
  "Polity":         { gradient: "from-blue-600 to-indigo-700",    icon: "⚖️" },
  "Geography":      { gradient: "from-emerald-600 to-teal-700",   icon: "🌍" },
  "Economics":      { gradient: "from-amber-500 to-orange-600",   icon: "📈" },
  "History":        { gradient: "from-rose-600 to-pink-700",      icon: "🏛️" },
  "Physics":        { gradient: "from-violet-600 to-purple-700",  icon: "⚛️" },
  "Chemistry":      { gradient: "from-cyan-500 to-sky-700",       icon: "🧪" },
  "Biology":        { gradient: "from-green-500 to-emerald-700",  icon: "🧬" },
  "Current Affairs":{ gradient: "from-red-500 to-rose-700",       icon: "📰" },
};
```

**On tap:** Set `selectedSubject` to the subject name, scroll page up to quiz setup card, and fetch topics automatically. This replaces the need to manually pick subject from the dropdown (though the dropdown stays as the primary for accessibility).

---

### 3.6 Bottom Navigation Bar (all pages)

**Reference:** Ref-3 (yoga app bottom nav) — compact icon + label tab bar.

**Container:**
```
fixed bottom-0 left-0 right-0 z-50
bg-slate-900/95 backdrop-blur-md
border-t border-slate-800
```

**Inner wrapper:**
```
max-w-lg mx-auto flex justify-around items-center py-3 px-6
```

**Each nav item (flex-col items-center gap-1):**
```
Active:   text-emerald-400
Inactive: text-slate-600
```

Icon size: `w-6 h-6` (SVG, not emoji — use inline SVGs for crispness)

Label: `text-[10px] font-medium tracking-wide`

**Active indicator** (like Ref-3): Instead of underlining, the active item's icon has a small dot below it: `w-1 h-1 rounded-full bg-emerald-400 mt-0.5`

**Nav items:**

| Index | Icon SVG (description) | Label | Route |
|---|---|---|---|
| 0 | House outline with roof triangle | `"Home"` | `/dashboard` |
| 1 | Trophy/cup outline | `"Ranks"` | `/leaderboard` |
| 2 | Person outline | `"Profile"` | Shows inline toast `"Coming soon!"` — does not navigate |

Use these inline SVGs (24×24 viewBox, stroke-based, strokeWidth=1.5):

```jsx
// Home icon
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
</svg>

// Trophy icon
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M8 21h8m-4-4v4m-6-4a6 6 0 006-6V3H6v8a6 6 0 006 6zm0 0a6 6 0 006-6V3m0 0H6"/>
</svg>

// Person icon
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
</svg>
```

---

## 4. Quiz Page (`/quiz`) — Design Spec

**Minimal changes from V1.** Only visual updates:

### Top Bar
```
bg-slate-900 border-b border-slate-800
px-4 py-3
flex items-center justify-between
```

Left: `"{subject} · {topic}"` — `text-slate-400 text-xs font-medium`

Center: `"Q {current} / {total}"` — `text-white text-sm font-display font-bold`

Right: XP preview — `"⚡ +{estimatedXP} XP"` — `text-orange-400 text-xs font-bold`
`estimatedXP` = base 10 (always, for display; actual computed server-side).

### Timer Ring (replace existing timer bar if present)

Use a circular SVG countdown ring instead of a flat progress bar:

```jsx
// SVG ring timer — 20 second countdown
const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const progress = timeLeft / 20; // 0 to 1
const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

<div className="relative w-20 h-20 mx-auto my-6">
  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
    {/* Background ring */}
    <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="#334155" strokeWidth="4"/>
    {/* Countdown ring */}
    <circle
      cx="36" cy="36" r={RADIUS}
      fill="none"
      stroke={timeLeft <= 7 ? "#f97316" : "#10b981"}
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray={CIRCUMFERENCE}
      strokeDashoffset={strokeDashoffset}
      style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
    />
  </svg>
  {/* Center text */}
  <div className="absolute inset-0 flex items-center justify-center">
    <span className={`font-display font-black text-xl ${timeLeft <= 7 ? "text-orange-400" : "text-white"}`}>
      {timeLeft}
    </span>
  </div>
</div>
```

Ring turns orange when `timeLeft <= 7` (matches existing ticking sound trigger).

### Question Card

```
bg-slate-800 rounded-3xl mx-4 p-5 border border-slate-700
```

Question text: `font-display font-bold text-base text-white leading-relaxed`

### Option Buttons (4 options)

Each option:
```
w-full mt-3 rounded-2xl px-4 py-4
bg-slate-700 border border-slate-600
text-white text-sm font-medium
text-left flex items-center gap-3
active:scale-[0.98] transition-transform
```

Option letter badge (inline left):
```
w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center
text-xs font-display font-bold text-slate-300 flex-shrink-0
```

After selecting:
- Correct: `bg-emerald-500/20 border-emerald-500`. Letter badge: `bg-emerald-500 text-white`
- Incorrect: `bg-red-500/20 border-red-500`. Letter badge: `bg-red-500 text-white`
- Other options dim: `opacity-50`

### Skip Button

```
mt-4 mx-auto block
text-slate-500 text-sm font-medium
underline underline-offset-2
```
Just a text button, no background. `"Skip question →"`

---

## 5. Result Page (`/result`) — Design Spec

### Score Card (top of page)

```
bg-gradient-to-br from-slate-800 to-slate-900
rounded-3xl mx-4 mt-4 p-6
border border-slate-700
```

**Large score number (center):**
```
font-display font-black text-6xl text-white text-center
```
e.g. `"19.5"` (rawScore displayed)

**"marks" label below:**
```
text-slate-400 text-sm text-center mt-1
"marks scored"
```

**3-column stat row (correct / incorrect / skipped):**
```
flex justify-around mt-6
Each column: flex-col items-center
  Number: font-display font-bold text-2xl
    correct → text-emerald-400
    incorrect → text-red-400
    skipped → text-slate-400
  Label: text-xs text-slate-500 mt-1
    "Correct" / "Wrong" / "Skipped"
```

**Accuracy bar (below stat row):**
```
mt-5
Label row: flex justify-between text-xs text-slate-500 mb-1.5
  Left: "Accuracy"
  Right: "{accuracy.toFixed(1)}%"
Bar: h-2 bg-slate-700 rounded-full
  Fill: h-full bg-emerald-500 rounded-full transition-all duration-700
  Width: {accuracy}%
```
Animate the fill bar width from 0 to the actual value on mount (use `useEffect` with a 100ms delay before setting width, so the CSS transition fires).

### XP Toast (Ref-2 inspired — Whoop "DAY STREAK" row style)

```
fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-50
```

Container:
```
bg-gradient-to-r from-emerald-900 to-teal-900
border border-emerald-500/50
rounded-2xl p-4
shadow-[0_8px_32px_rgba(16,185,129,0.3)]
```

Entry animation (slide up + fade in):
```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.xp-toast {
  animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```
`cubic-bezier(0.34, 1.56, 0.64, 1)` = spring bounce effect.

Content layout:
```
Row 1 (flex justify-between items-center):
  Left: "⚡ +{xpEarned} XP" — font-display font-black text-xl text-white
  Right: "🔥 {streakCount} day streak" — text-orange-400 font-bold text-sm

Row 2 (mt-1.5):
  "Level: {level} · {totalXP} XP total" — text-emerald-300 text-sm

Row 3 (if isFirstQuizOfDay, mt-1):
  "🌅 First quiz bonus included!" — text-yellow-300 text-xs
```

Auto-dismiss after 4000ms. Add a thin progress bar at the bottom of the toast that depletes from full to empty over 4 seconds:
```css
@keyframes deplete {
  from { width: 100%; }
  to   { width: 0%; }
}
.toast-progress {
  height: 2px;
  background: rgba(255,255,255,0.3);
  border-radius: 0 0 16px 16px;
  animation: deplete 4s linear forwards;
}
```

### Guest Banner

```
bg-slate-800 border border-emerald-500/30 rounded-2xl mx-4 mt-4 p-4
flex flex-col items-center gap-3
```

Icon: `🔒` emoji, `text-2xl`
Text: `"Login to save your score, XP, and streak"` — `text-slate-300 text-sm text-center`
Button: Same Google button style as landing page but smaller (`py-2.5 text-sm`).

### Action Buttons Row (bottom)

```
flex flex-col gap-3 mx-4 mt-6 mb-24
```

Primary button (`"Back to Home"`):
```
w-full py-4 rounded-2xl
bg-emerald-500 text-white font-display font-bold text-base
shadow-cta
```

Secondary button (`"View Leaderboard"`):
```
w-full py-4 rounded-2xl
bg-slate-800 border border-slate-700 text-slate-300 font-medium text-base
```

Tertiary link (`"View Detailed Analysis →"`):
```
text-center text-slate-500 text-sm underline underline-offset-2
```

---

## 6. Leaderboard Page (`/leaderboard`) — Design Spec (Ref-5 — Kahoot)

**Reference:** Ref-5 exactly. Podium for top 3, flat list for rank 4+.

### Page Header

```
bg-gradient-to-b from-violet-900 to-slate-900
px-4 pt-10 pb-0
```

Title: `"Final Scoreboard"` → change to `"Leaderboard"` — `font-display font-black text-2xl text-white text-center`

**Tab switcher (below title):**
```
flex bg-white/10 rounded-full p-1 mx-auto w-fit mt-4 mb-0
```
Each tab:
```
px-6 py-2 rounded-full text-sm font-display font-bold transition-all
Active:   bg-white text-violet-700
Inactive: text-white/60
```
Tab labels: `"This Week"` and `"All Time"`.

---

### Podium Section (top 3, exactly as Ref-5)

**Container:**
```
bg-gradient-to-b from-violet-800/60 to-transparent
px-4 pt-6 pb-4
```

**Podium layout:** 3 columns, heights stepped, in order: [#2 left] [#1 center, tallest] [#3 right]

```jsx
<div className="flex items-end justify-center gap-3 mt-2">
  {/* #2 — left, medium height */}
  <PodiumEntry rank={2} user={leaders[1]} height="h-24" />
  {/* #1 — center, tallest */}
  <PodiumEntry rank={1} user={leaders[0]} height="h-32" />
  {/* #3 — right, shortest */}
  <PodiumEntry rank={3} user={leaders[2]} height="h-20" />
</div>
```

**`PodiumEntry` component spec:**

```jsx
// PodiumEntry({ rank, user, height })
// height = Tailwind class for the podium block height

<div className="flex flex-col items-center">

  {/* Avatar circle */}
  <div className={`
    w-16 h-16 rounded-full
    flex items-center justify-center
    font-display font-black text-2xl text-white
    border-4
    ${rank === 1 ? "bg-amber-500 border-amber-300 shadow-gold" : ""}
    ${rank === 2 ? "bg-blue-500  border-blue-300" : ""}
    ${rank === 3 ? "bg-rose-500  border-rose-300" : ""}
  `}>
    {user.name.charAt(0).toUpperCase()}
  </div>

  {/* Name */}
  <p className="text-white font-display font-bold text-sm mt-2 text-center max-w-[80px] truncate">
    {user.name.split(" ")[0]}
  </p>

  {/* Score pill (exactly as Ref-5) */}
  <div className="bg-white/20 backdrop-blur rounded-full px-3 py-1 mt-1">
    <span className="text-white font-display font-bold text-xs">
      {user.totalScore.toFixed(1)}
    </span>
  </div>

  {/* Podium block */}
  <div className={`
    w-24 mt-3 rounded-t-xl flex items-center justify-center
    ${height}
    ${rank === 1 ? "bg-amber-500/30 border-t-2 border-amber-500" : ""}
    ${rank === 2 ? "bg-blue-500/20  border-t-2 border-blue-400" : ""}
    ${rank === 3 ? "bg-rose-500/20  border-t-2 border-rose-400" : ""}
  `}>
    {/* Medal icon */}
    <span className="text-3xl">
      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
    </span>
  </div>

</div>
```

**Empty state for podium (fewer than 3 users):** Replace missing slots with a ghost podium entry showing `"?"` in the avatar circle and `"---"` as the name.

---

### Flat List Section (rank 4+)

**Container:**
```
bg-slate-900 rounded-t-3xl mx-0 mt-0 px-4 pt-4 pb-24
```

**Current user rank card** (show if `currentUser !== null`, above the list):
```
bg-violet-900/40 border border-violet-500/40 rounded-2xl p-3 mb-4
flex items-center gap-3
```
Left: `"Rank #{currentUser.rank}"` — `font-display font-black text-lg text-violet-300`
Right: `"{currentUser.name} · {currentUser.totalScore.toFixed(1)} pts"` — `text-white text-sm`

**Each list row (rank 4 onwards):**
```
flex items-center gap-3 py-3
border-b border-slate-800 last:border-0
```

Columns:
```
1. Rank number: font-display font-bold text-base text-slate-400 w-7 text-right
2. Avatar circle:
   w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center
   font-display font-bold text-sm text-slate-300
   (show first letter of name)
3. Name + accuracy (flex-col flex-1):
   Name: text-white font-medium text-sm
   Accuracy: text-slate-500 text-xs "{accuracy.toFixed(0)}% accuracy"
4. Score (right-aligned):
   font-display font-bold text-sm text-emerald-400
   "{totalScore.toFixed(1)} pts"
```

**Highlight current user's row:**
```
bg-violet-900/20 rounded-xl px-2 -mx-2
```

---

## 7. Micro-Animations Summary

Implement all of these. No third-party animation library needed — all CSS or Tailwind.

| Element | Animation | Trigger | Duration |
|---|---|---|---|
| Dashboard profile card | `fadeInDown` (slide from above) | On page mount | 400ms |
| Streak circle (completed days) | Scale 1→1.1→1 bounce | On mount, staggered per day | 80ms per day |
| Start Quiz button (enabled) | Breathing glow pulse | Continuous while `isReady` | 2.5s loop |
| Score accuracy bar | Width 0→actual | On result page mount (100ms delay) | 700ms ease-out |
| XP toast | Slide up + spring bounce | After `/api/score` returns ok | 350ms |
| XP toast progress bar | Width 100→0 | Immediately after toast appears | 4000ms linear |
| Podium entries | Staggered fade-in-up | On leaderboard mount | 100ms, 200ms, 300ms |
| Option button (selected) | scale 0.98→1 | On tap | 100ms |
| Tab switch (leaderboard) | Slide indicator | On tab change | 200ms |
| Timer ring stroke | Smooth depletion | Every second | 1s linear |
| Timer ring color | Orange flash | When `timeLeft === 7` | 300ms ease |

---

## 8. Responsive Behavior

The app is **mobile-first** (390px). On wider screens (tablet+):

```css
/* In globals.css — constrain max width for app-like feel on desktop */
.page-container {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
}
```

Wrap each page's root `<div>` with this class. On desktop, the app appears as a centered phone-width column with dark background on either side.

---

## 9. Loading / Skeleton States

Use skeleton placeholders (not spinners) for all data-loading states. Skeleton style:

```css
.skeleton {
  background: linear-gradient(90deg, #1e293b 25%, #263348 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

| Component | Skeleton shape |
|---|---|
| Profile card | Full card height (`h-24`) rectangle, `rounded-3xl` |
| Streak card | Full card height (`h-36`) rectangle, `rounded-3xl` |
| Leaderboard preview | 3 rows, each `h-10 rounded-xl mb-2` |
| Leaderboard list row | `h-14 rounded-xl mb-2` |
| Podium | 3 columns of varying heights |

---

## 10. "Coming Soon" Inline Toast

When user taps the **Profile** nav item, show an inline small toast at the top of the screen (not the bottom, to not overlap bottom nav):

```
fixed top-4 left-1/2 -translate-x-1/2 z-50
bg-slate-800 border border-slate-700 rounded-full
px-5 py-2.5
text-white text-sm font-medium
shadow-lg
```

Content: `"👤 Profile coming soon!"`

Auto-dismiss after 2000ms. Use `useState` + `setTimeout` pattern (no library).

Entry animation: `fadeInDown` (same keyframe as profile card, 300ms).

---

## 11. Font Import (add to `pages/_document.js`)

```jsx
import Document, { Html, Head, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Inter:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </Head>
        <Body>
          <Main />
          <NextScript />
        </Body>
      </Html>
    );
  }
}
```

---

## 12. globals.css Additions

Add all custom CSS here (do not create separate CSS files):

```css
/* Font utility */
.font-display { font-family: 'Nunito', sans-serif; }

/* Skeleton shimmer */
.skeleton {
  background: linear-gradient(90deg, #1e293b 25%, #263348 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

/* XP toast slide-up */
@keyframes slideUp {
  from { transform: translateY(80px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.xp-toast { animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

/* Toast progress depletion */
@keyframes deplete {
  from { width: 100%; }
  to   { width: 0%; }
}
.toast-progress { animation: deplete 4s linear forwards; }

/* Button glow breathe */
@keyframes breathe {
  0%, 100% { box-shadow: 0 0 16px rgba(16,185,129,0.3); }
  50%       { box-shadow: 0 0 28px rgba(16,185,129,0.6); }
}
.btn-breathe { animation: breathe 2.5s ease-in-out infinite; }

/* fadeInDown */
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down { animation: fadeInDown 0.4s ease-out forwards; }

/* Scrollbar hide for horizontal scroll */
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* Page max-width container */
.page-container { max-width: 430px; margin: 0 auto; min-height: 100vh; }
```

---

*End of Design Amendment*  
*This document defines all visual details. The base PRD defines all logic and API details. Implement both together.*
