# SSC GK Score Booster — Onboarding Slides PRD

---

## PASTE THIS MESSAGE INTO CLAUDE CODE AFTER UPLOADING THIS FILE

```
I am uploading SSC_GK_Score_Booster_Onboarding_Slides.md

Read the ENTIRE file before writing a single line of code.
This file specifies a multi-screen onboarding carousel to add to the
existing Next.js 14 + Tailwind + NextAuth project.

Implement in the order listed under IMPLEMENTATION ORDER at the bottom.
Do not reorder steps. Complete and verify each step before moving to next.
```

---

## 1. What to Build

A full-screen swipeable onboarding carousel shown to first-time users
(both Google sign-in and guest). Appears ONCE before the dashboard.
After completing or skipping, a flag is set so it never shows again.

---

## 2. Flow Integration

```
New Google user:
  / → NextAuth → /onboarding (name setup) → /onboarding-slides → /dashboard

Guest user (first time):
  / → tap "Play as Guest" → /onboarding-slides → /dashboard

Returning user (any):
  / → skip /onboarding-slides entirely → /dashboard directly
```

**Flag:** `localStorage` key `"ssc_onboarding_done"`
- If `localStorage.getItem("ssc_onboarding_done") === "true"` → skip slides
- After last slide OR Skip tap → `localStorage.setItem("ssc_onboarding_done","true")`
- Then `router.push("/dashboard")`

`localStorage` is acceptable here because onboarding state is purely a
UI preference, not user data. No server storage needed.

---

## 3. Slide Data

Define as a constant array at the top of `/pages/onboarding-slides.js`:

```javascript
const SLIDES = [
  {
    id: 1,
    emoji: "📚",
    emojiBg: "from-blue-600 to-indigo-700",
    subtitleColor: "text-blue-400",
    title: "Pick Your Topic",
    subtitle: "Choose any subject — Polity, History, Geography and more.",
    body: "Select a topic, choose how many questions you want, and hit Start. Questions are hand-curated and verified — no AI-generated content, ever.",
    cta: "Next",
  },
  {
    id: 2,
    emoji: "⏱️",
    emojiBg: "from-orange-500 to-rose-600",
    subtitleColor: "text-orange-400",
    title: "Beat the Clock",
    subtitle: "20 seconds per question. Just like the real SSC exam.",
    body: "Answer correctly for +2 marks. Wrong answer costs −0.5. Skip if unsure. The timer trains you to make fast, accurate decisions under pressure.",
    cta: "Next",
  },
  {
    id: 3,
    emoji: "⚡",
    emojiBg: "from-emerald-500 to-teal-600",
    subtitleColor: "text-emerald-400",
    title: "Earn XP & Level Up",
    subtitle: "Every correct answer earns you XP points.",
    body: "Complete a quiz for +10 XP. Each correct answer adds +2 XP. Play your first quiz of the day for a bonus +10 XP. Rise from Aspirant all the way to Legend.",
    cta: "Next",
  },
  {
    id: 4,
    emoji: "🏆",
    emojiBg: "from-amber-500 to-yellow-600",
    subtitleColor: "text-amber-400",
    title: "Climb the Leaderboard",
    subtitle: "See how you rank against thousands of aspirants.",
    body: "Every quiz you complete adds to your score on the global leaderboard. This week's top scorer gets the podium. Can you hold the #1 spot?",
    cta: "Next",
  },
  {
    id: 5,
    emoji: "🔥",
    emojiBg: "from-violet-600 to-purple-700",
    subtitleColor: "text-violet-400",
    title: "Make It a Daily Habit",
    subtitle: "One quiz a day keeps the exam failures away.",
    body: "Students who practice daily score 40% higher in SSC GK. Build your streak, protect it every day, and watch your accuracy climb week by week.",
    cta: "Start Practising →",
  },
];
```

---

## 4. Page Spec — `/pages/onboarding-slides.js`

**Auth guard:** None. Both guests and logged-in users see this page.

**On mount check:**
```javascript
useEffect(() => {
  try {
    if (localStorage.getItem("ssc_onboarding_done") === "true") {
      router.replace("/dashboard");
    }
  } catch {
    // localStorage blocked (private mode) — show slides anyway
  }
}, []);
```

**State:**
```javascript
const [currentSlide, setCurrentSlide] = useState(0);
const touchStartX = useRef(null);
```

**Helper:**
```javascript
function setOnboardingDone() {
  try {
    localStorage.setItem("ssc_onboarding_done", "true");
  } catch {
    // ignore — just proceed to dashboard
  }
}
```

---

### 4.1 Page Layout

```
Background: bg-[#0f172a] min-h-screen flex flex-col
WebkitTapHighlightColor: transparent (inline style on root div)

┌─────────────────────────────┐  375px wide
│  TOP BAR               h-12 │  Skip button
├─────────────────────────────┤
│                             │
│                             │
│   ILLUSTRATION              │  emoji circle, title, subtitle, body
│   (flex-1, centered)        │
│                             │
│                             │
├─────────────────────────────┤
│  BOTTOM BAR            h-20 │  dot indicators + CTA button
└─────────────────────────────┘
```

---

### 4.2 Top Bar

```
h-12 px-6 flex items-center justify-end
```

Skip button — show only on slides 0–3 (hide on slide 4, the last):
```
text-slate-500 Inter 14px font-medium py-3 px-2
active:text-slate-300 transition-colors
```
On tap:
```javascript
setOnboardingDone();
router.push("/dashboard");
```

---

### 4.3 Illustration Section

```
flex-1 flex flex-col items-center justify-center px-6
```

Wrap the entire content block in a div with a `key` prop set to
`currentSlide`. This forces React to remount the div on every slide
change, which re-triggers the CSS entry animation:

```jsx
<div
  key={currentSlide}
  className="fade-in-down flex flex-col items-center w-full"
>
  {/* emoji circle */}
  {/* title */}
  {/* subtitle */}
  {/* body */}
</div>
```

`fade-in-down` must already exist in `globals.css` from the Mobile
Redesign PRD. If it does not exist, add this to `globals.css`:
```css
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in-down { animation: fadeInDown 0.3s ease-out forwards; }
```

**Emoji circle:**
```
w-48 h-48 rounded-full
bg-gradient-to-br {slide.emojiBg}
flex items-center justify-center
shadow-[0_0_60px_rgba(0,0,0,0.4)]
text-7xl
mb-8
```

**Title:**
```
font-family: Nunito (font-display class)
font-weight: 900 (font-black)
font-size: text-2xl
color: text-white
text-align: text-center
line-height: leading-tight
margin-bottom: mb-2
```

**Subtitle:**
```
font-family: Nunito (font-display class)
font-weight: 700 (font-bold)
font-size: text-base
color: {slide.subtitleColor} — set per slide from SLIDES array
text-align: text-center
margin-bottom: mb-3
```

**Body text:**
```
font-family: Inter
font-size: text-sm (14px)
color: text-slate-400
text-align: text-center
line-height: leading-relaxed
max-width: max-w-[300px]
margin: mx-auto
```

---

### 4.4 Swipe Support

Attach `onTouchStart` and `onTouchEnd` to the root page wrapper div:

```javascript
function handleTouchStart(e) {
  touchStartX.current = e.touches[0].clientX;
}

function handleTouchEnd(e) {
  if (touchStartX.current === null) return;
  const delta = touchStartX.current - e.changedTouches[0].clientX;
  if (delta > 50 && currentSlide < SLIDES.length - 1) {
    setCurrentSlide(s => s + 1); // swipe left → next
  }
  if (delta < -50 && currentSlide > 0) {
    setCurrentSlide(s => s - 1); // swipe right → previous
  }
  touchStartX.current = null;
}
```

Minimum swipe distance to trigger: 50px. Prevents accidental slides.

---

### 4.5 Bottom Bar

```
h-20 px-6 flex items-center justify-between
```

**Left: Dot indicators**

```jsx
<div className="flex gap-2 items-center">
  {SLIDES.map((_, i) => (
    <button
      key={i}
      onClick={() => setCurrentSlide(i)}
      className={`rounded-full transition-all duration-300
        ${i === currentSlide
          ? "w-6 h-2.5 bg-white"
          : "w-2.5 h-2.5 bg-slate-600"
        }`}
    />
  ))}
</div>
```

Active dot: pill shape `w-6 h-2.5 bg-white`
Inactive dot: circle `w-2.5 h-2.5 bg-slate-600`
Dots are tappable — jump directly to that slide.

**Right: CTA button**

Slides 0–3 (not last):
```
bg-slate-700 text-white rounded-2xl px-6 py-3
font-display font-bold text-base
"Next →"
active:scale-95 transition-transform duration-100
```
On tap: `setCurrentSlide(s => s + 1)`

Slide 4 (last):
```
bg-emerald-500 text-white rounded-2xl px-6 py-3
font-display font-bold text-base
btn-breathe class (glow pulse animation)
"Start Practising →"
active:scale-95 transition-transform duration-100
```
On tap:
```javascript
setOnboardingDone();
router.push("/dashboard");
```

`btn-breathe` must exist in `globals.css`. If missing, add:
```css
@keyframes breathe {
  0%,100% { box-shadow: 0 0 16px rgba(16,185,129,0.3); }
  50%     { box-shadow: 0 0 28px rgba(16,185,129,0.6); }
}
.btn-breathe { animation: breathe 2.5s ease-in-out infinite; }
```

---

## 5. Modify `/pages/index.js` — Guest Button

Find the guest button tap handler. Replace the `router.push` call:

**Before:**
```javascript
document.cookie = "userMode=guest; path=/; max-age=86400";
router.push("/dashboard");
```

**After:**
```javascript
document.cookie = "userMode=guest; path=/; max-age=86400";
const alreadySeen = (() => {
  try {
    return localStorage.getItem("ssc_onboarding_done") === "true";
  } catch {
    return false;
  }
})();
router.push(alreadySeen ? "/dashboard" : "/onboarding-slides");
```

---

## 6. Modify `/pages/onboarding.js` — Name Setup Page

Find the "Let's Go" button tap handler AND the "Skip" link tap handler.
In both, replace `router.push("/dashboard")`:

**Before (both handlers):**
```javascript
router.push("/dashboard");
```

**After (both handlers):**
```javascript
const alreadySeen = (() => {
  try {
    return localStorage.getItem("ssc_onboarding_done") === "true";
  } catch {
    return false;
  }
})();
router.push(alreadySeen ? "/dashboard" : "/onboarding-slides");
```

This ensures new Google users see the slides after setting their name,
but existing users who somehow land on `/onboarding` again skip slides.

---

## 7. Files That Must NOT Be Touched

```
/pages/api/auth/[...nextauth].js
/pages/api/ai/*
/pages/analysis.js
/pages/api/topics.js
/pages/api/questions.js
/pages/api/score.js
/pages/api/leaderboard.js
/pages/api/user-profile.js
next.config.js
vercel.json
```

---

## 8. Implementation Order

```
STEP 1 — Check globals.css
  Confirm fade-in-down and btn-breathe animations exist.
  If either is missing, add the CSS blocks from Section 4.3 and 4.5.
  Do not duplicate if already present.

STEP 2 — Create /pages/onboarding-slides.js
  Full spec in Sections 3, 4.1 through 4.5.
  SLIDES array at top of file.
  Swipe handlers via useRef and onTouchStart/onTouchEnd.
  key prop on content wrapper for slide transition animation.
  setOnboardingDone helper function.
  Mount check: redirect to /dashboard if flag already set.

STEP 3 — Modify /pages/index.js
  Guest button handler only — per Section 5.
  No other changes to this file.

STEP 4 — Modify /pages/onboarding.js
  Both "Let's Go" and "Skip" handlers — per Section 6.
  No other changes to this file.
```

---

## 9. Verification Checklist

Run all checks after completing all 4 steps:

```
[ ] Clear localStorage in browser devtools

[ ] Tap "Play as Guest" on / → lands on /onboarding-slides slide 1
    (Pick Your Topic with 📚 blue circle)

[ ] Slide 1 → swipe left → slide 2 appears with fade-in-down animation

[ ] Swipe right on slide 2 → goes back to slide 1

[ ] Tap a dot indicator → jumps directly to that slide

[ ] Tap "Skip" on slide 2 → lands on /dashboard
    → refresh /dashboard → does NOT see slides again

[ ] Clear localStorage again

[ ] Go through all 5 slides using "Next →" button

[ ] On slide 5 → CTA button shows "Start Practising →" in emerald
    with glowing pulse animation

[ ] Tap "Start Practising →" → lands on /dashboard

[ ] Refresh /dashboard → slides do NOT show again

[ ] Clear localStorage → slides show again from slide 1

[ ] Active dot is wide pill shape (w-6), inactive are small circles (w-2.5)

[ ] Each slide change: emoji circle fades in from slightly above

[ ] New Google sign-in (first time) →
    /onboarding (name setup) → /onboarding-slides → /dashboard

[ ] Returning Google user → /dashboard directly (no slides)

[ ] On a real mobile device: swipe gesture works smoothly
    (50px threshold, no accidental triggers)
```

---

*End of SSC GK Score Booster Onboarding Slides PRD*
*Paste the message at the top of this file into Claude Code after uploading.*
