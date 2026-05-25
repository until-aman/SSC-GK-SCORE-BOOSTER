# Loading System & AI Timeout — Implementation Guide

**Project:** SSC GK Score Booster  
**Stack:** Next.js 14 · Tailwind CSS · Gemini 1.5 Flash · Google Sheets API  
**Scope:** Loading states across all screens + 5-second AI timeout with automatic fallback  

---

## Overview

Two concerns are solved here together:

1. **Loading UX** — every async operation in the app shows a consistent animated GIF loader so users always know something is happening.
2. **AI timeout** — every Gemini API call has a hard 5-second limit. If the AI doesn't respond in time, the sheet's existing `Explanation` field is shown silently. The user never sees a broken or hanging state.

---

## File Structure

```
lib/
  fetchAI.js                    ← core timeout logic; all AI calls go through here

components/ui/
  Loader.jsx                    ← base loading component (GIF + label)
  PageLoader.jsx                ← route-transition overlay (wired in _app.js)
  aiComponents.jsx              ← ResultScreen + QuestionAnalysisCard with timeout
```

---

## 1. `lib/fetchAI.js` — AI Timeout Core

### What it does

All three Gemini endpoints are wrapped in a single internal helper `callAIWithTimeout()` that uses `AbortController` to kill the request after 5 seconds.

```
Request sent
    │
    ├─ Responds in < 5s ──→ return { text: aiText,    source: "ai"       }
    ├─ No response at 5s ──→ return { text: fallback,  source: "fallback" }
    ├─ HTTP error (4xx/5xx)→ return { text: fallback,  source: "fallback" }
    └─ Network failure   ──→ return { text: fallback,  source: "fallback" }
```

`AbortController` is used — not `Promise.race` — because it **cancels the actual HTTP request**. `Promise.race` only ignores the slow promise; the request keeps running in the background and consumes a Gemini API call.

### Timeout constant

```js
// lib/fetchAI.js
const AI_TIMEOUT_MS = 5000; // change here to update everywhere at once
```

### Three exported helpers

| Helper | Endpoint | Fallback when AI times out |
|---|---|---|
| `fetchAIExplain()` | `POST /api/ai/explain` | `question.explanation` from Google Sheet |
| `fetchAITip()` | `POST /api/ai/tip` | `question.explanation` from Google Sheet |
| `fetchAISummary()` | `POST /api/ai/summary` | Generic string built client-side from score data |

The summary fallback is built **entirely from data already in React state**, so it never needs a second network call:

```
"You scored 13 marks with 70% accuracy (7 correct, 2 incorrect, 1 skipped). Keep practicing to improve!"
```

### Usage

```js
import { fetchAIExplain, fetchAITip, fetchAISummary } from "@/lib/fetchAI";

// Wrong-answer explanation
const { text, source } = await fetchAIExplain({
  question:         "Which article abolishes untouchability?",
  correctOption:    "Article 17",
  userAnswer:       "Article 14",
  sheetExplanation: "Article 17 of the Constitution abolishes untouchability.",
});

// Skipped question tip
const { text, source } = await fetchAITip({
  question:         "Which article abolishes untouchability?",
  correctOption:    "Article 17",
  sheetExplanation: "Article 17 of the Constitution abolishes untouchability.",
});

// End-of-quiz performance summary
const { text, source } = await fetchAISummary({
  correctAnswers:   7,
  incorrectAnswers: 2,
  skipped:          1,
  totalQuestions:   10,
  rawScore:         13,
  subject:          "Polity",
  topic:            "Fundamental Rights",
});

// source === "fallback" → AI timed out; text is still usable
```

---

## 2. `components/ui/Loader.jsx` — Base Component

Single component, four display modes controlled by props.

### Props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `label` | `string` | `""` | Optional text shown below the GIF |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | 28px / 52px / 80px |
| `fullScreen` | `boolean` | `false` | Fixed full-viewport overlay |
| `card` | `boolean` | `false` | Card-framed inline loader |

### Mode reference

```jsx
// Inline — default, centered in its container
<Loader />
<Loader label="Loading topics…" />

// Inline small — for inside cards and per-question rows
<Loader size="sm" label="AI mentor is explaining…" />

// Card-framed — replaces content area while loading
<Loader card size="md" label="Fetching rankings from the scoreboard…" />

// Full-screen overlay — page transitions only
<Loader fullScreen size="lg" label="Setting up your quiz…" />
```

### GIF source

```
https://media1.tenor.com/m/WX_LDjYUrMsAAAAC/loading.gif
```

Clean black-and-white spinner. Transparent background. Renders correctly on both white and dark surfaces. Uses `next/image` with `unoptimized` so Vercel doesn't try to process an external GIF URL.

---

## 3. `components/ui/PageLoader.jsx` — Route Transitions

Registers on `router.events` in `_app.js`. Shows a full-screen overlay with a contextual label whenever the user navigates between pages.

### Wire-up in `pages/_app.js`

```jsx
import PageLoader from "@/components/ui/PageLoader";

export default function App({ Component, pageProps }) {
  return (
    <>
      <PageLoader />
      <Component {...pageProps} />
    </>
  );
}
```

### Route-to-label mapping

| Route | Label shown |
|---|---|
| `/` | Going home… |
| `/quiz` | Setting up your quiz… |
| `/result` | Loading your results… |
| `/analysis` | Loading detailed analysis… |
| `/leaderboard` | Fetching the leaderboard… |
| Any other | Loading… |

---

## 4. Screen-by-Screen Loading States

### Quiz Setup (`pages/index.jsx`)

| Trigger | Loader shown | Where |
|---|---|---|
| Page mount | `<Loader label="Fetching subjects from question bank…" />` | Replaces subject dropdown |
| Subject selected | `<Loader size="sm" label="Loading topics…" />` | Below subject dropdown |

No AI calls on this screen. Only Sheets API reads.

---

### Quiz Screen (`pages/quiz.jsx`)

| Trigger | Loader shown | Where |
|---|---|---|
| Page mount | `<Loader card size="lg" label="Preparing your quiz… questions loading from sheet" />` | Replaces entire question card |

All questions are fetched once in a single Sheets API call and held in React state. No mid-quiz loading states needed.

---

### Result Screen (`pages/result.jsx`)

| Trigger | Loader shown | Timeout | Fallback |
|---|---|---|---|
| Page mount | `<Loader card size="sm" label="Your AI mentor is reviewing your performance…" />` | **5 seconds** | Generic score summary built from quiz data |

```jsx
// components/ui/aiComponents.jsx — ResultScreen
useEffect(() => {
  async function loadSummary() {
    setLoadingSummary(true);

    const { text, source } = await fetchAISummary({ ...quizData });
    //                                               ↑
    //                         5s timeout fires here if Gemini is slow
    //                         source === "fallback" → client-built summary shown

    setSummary(text);
    setSummarySource(source);
    setLoadingSummary(false);
  }
  loadSummary();
}, [quizData]);
```

When `source === "fallback"`, a one-line italic note is shown below the summary:

```
⚡ Quick summary — AI mentor took too long.
```

This is optional — remove it if you prefer the fallback to appear identical to an AI response.

---

### Detailed Analysis (`pages/analysis.jsx`)

| Trigger | Loader shown | Timeout | Fallback |
|---|---|---|---|
| User taps "Show AI explanation ↓" | `<Loader size="sm" label="AI mentor is explaining…" />` | **5 seconds** | `question.explanation` from Google Sheet |

Each question card loads its AI explanation **independently and lazily** — the explanation only fetches when the user taps the toggle, not on page load. This avoids a burst of 10+ concurrent Gemini calls which would hit rate limits and slow every card down.

```jsx
// Logic inside QuestionAnalysisCard
async function loadExplanation() {
  if (explanation || loading) return;   // guard: already loaded or in-flight
  setLoading(true);
  setExpanded(true);

  // Wrong answer → explain; Skipped → tip; Correct → sheet text, no AI call
  const result = isSkipped
    ? await fetchAITip({ ... })
    : !isCorrect
      ? await fetchAIExplain({ ... })
      : { text: question.explanation, source: "sheet" };

  setExplanation(result.text);
  setSource(result.source);
  setLoading(false);
}
```

Correct answers skip the AI call entirely and show the sheet explanation directly.

---

### Leaderboard (`pages/leaderboard.jsx`)

| Trigger | Loader shown | Timeout | Fallback |
|---|---|---|---|
| Page mount | `<Loader card size="md" label="Fetching rankings from the scoreboard…" />` | None — Sheets read, not AI | N/A |

No AI calls. Only a Sheets API read via `GET /api/leaderboard`.

---

## 5. Fallback Behaviour Summary

| Screen | AI call | If AI times out (> 5s) | User sees |
|---|---|---|---|
| Result | `POST /api/ai/summary` | `fetchAISummary` returns generic string | Score-based summary, always readable |
| Analysis — wrong answer | `POST /api/ai/explain` | `fetchAIExplain` returns `question.explanation` | Sheet explanation |
| Analysis — skipped | `POST /api/ai/tip` | `fetchAITip` returns `question.explanation` | Sheet explanation |
| Analysis — correct | No call | N/A | Sheet explanation directly |

The sheet `Explanation` column is the guaranteed baseline. AI is additive — when it's fast it improves the explanation; when it's slow the sheet text covers for it.

---

## 6. Constraints Respected

- **AI is mentor only.** `fetchAI.js` only calls `/api/ai/explain`, `/api/ai/tip`, and `/api/ai/summary`. It never calls any endpoint that could generate questions or change the `CorrectOption`.
- **Sheet data always wins.** If AI and sheet explanations conflict, the user sees the sheet explanation in the fallback path. AI text is layered on top, never a replacement for verified content.
- **No difficulty fields.** No difficulty filters anywhere in this system.
- **Marking scheme untouched.** Loading and timeout logic is entirely UI-layer. It does not touch `rawScore`, `correctAnswers`, `incorrectAnswers`, or leaderboard ranking.
- **Guest mode.** The loading and AI timeout system works identically for guest and logged-in users. The only difference (score saving) happens in a separate API call unrelated to this system.

---

## 7. Quick Reference — What to Import Where

```
pages/_app.js         → import PageLoader from "@/components/ui/PageLoader"
pages/index.jsx       → import Loader from "@/components/ui/Loader"
pages/quiz.jsx        → import Loader from "@/components/ui/Loader"
pages/result.jsx      → import { ResultScreen } from "@/components/ui/aiComponents"
pages/analysis.jsx    → import { QuestionAnalysisCard } from "@/components/ui/aiComponents"
pages/leaderboard.jsx → import Loader from "@/components/ui/Loader"
```

`aiComponents.jsx` handles the `fetchAI` import internally — screens using `ResultScreen` or `QuestionAnalysisCard` do not need to import `fetchAI.js` directly.
