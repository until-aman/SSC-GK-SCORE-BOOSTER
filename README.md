<div align="center">

# SSC Smart Mentor ⚡

### AI-powered SSC GK practice, revision, mistake tracking and daily mentor system

A mobile-first exam preparation platform that helps SSC aspirants practice GK, review mistakes, track progress, and know **what to revise next**.

[Live App](https://ssc-gk-score-booster-v2.vercel.app/) · [Short Link](https://tinyurl.com/ssc-gk-score-booster) · [Portfolio](https://tinyurl.com/aman-antil-portfolio)

</div>

---

## What It Does

| Area             | What it does                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Practice**     | Lets students attempt SSC GK quizzes by subject, topic, PYQ, saved questions, repeated mistakes and mentor tasks |
| **Revision**     | Converts quiz history, wrong answers, skipped questions and saved questions into revision-ready sets             |
| **Mentor**       | Builds a daily study plan based on exam goal, days left, preparation stage, weak areas and pending tasks         |
| **History**      | Tracks quiz attempts, scores, coins, weak attempts, saved questions and repeated mistakes                        |
| **Analysis**     | Shows subject/topic performance, weak areas, trends and next-step recommendations                                |
| **Gamification** | Uses coins, streaks, rank, weekly champions, dream post progress and achievements to build consistency           |
| **AI Help**      | Provides AI explanations, tips and result insights where learning support is useful                              |
| **UX System**    | Uses a mobile-first SSC Quest Light UI with consistent cards, CTAs, empty states, loaders and bottom navigation  |

---

## Product Vision

Most exam-prep apps stop at showing a score.

SSC Smart Mentor tries to answer the next question:

> “What should I revise now?”

The product is built around a simple idea:

```text
Practice → Mistake Detection → Revision Direction → Daily Mentor Plan → Better Practice
```

It is not only a quiz app.
It is a revision and habit-building system for SSC aspirants.

---

## Why I Built This

During SSC preparation, I noticed that aspirants do not lack content.

They have:

* books
* PDFs
* YouTube lectures
* Telegram groups
* test series
* question banks
* apps

But after solving a quiz, most students still do not clearly know:

* which topic is weak
* what to revise today
* which mistakes are repeating
* whether they are improving
* what to practice next

SSC Smart Mentor is designed to solve that gap.

---

## Product Architecture

```text
User
 │
 ▼
Next.js Mobile Web App
 │
 ├── Dashboard
 ├── Quiz Setup
 ├── Quiz Player
 ├── Result & Review
 ├── History
 ├── Saved Questions
 ├── Repeated Mistakes
 ├── Analysis
 ├── Leaderboard
 └── Mentor
 │
 ▼
Client Data Layer
 │
 ├── account-scoped cache
 ├── localStorage/sessionStorage quiz state
 ├── stale-while-revalidate reads
 └── in-flight request deduplication
 │
 ▼
Next.js API Routes
 │
 ├── quiz content APIs
 ├── quiz completion APIs
 ├── history APIs
 ├── saved question APIs
 ├── mentor APIs
 ├── leaderboard APIs
 ├── analysis APIs
 └── AI APIs
 │
 ▼
Server Services
 │
 ├── Google Sheets data access
 ├── server-side cache
 ├── Sheet read deduplication
 ├── quiz completion service
 ├── mentor plan service
 └── Gemini AI service
 │
 ▼
External Systems
 │
 ├── Google Sheets
 ├── Google OAuth / NextAuth
 ├── Gemini API
 └── Vercel
```

---

## Core User Flows

### 1. Quiz Practice Flow

```text
Dashboard / Subjects / Mentor / History
        ↓
Quiz Setup
        ↓
Timed Quiz Player
        ↓
Result Summary
        ↓
Detailed Review
        ↓
Practice Again / Save / Revise Mistakes
```

---

### 2. Mentor Flow

```text
Mentor Setup
        ↓
Exam goal + days left + study time
        ↓
Preparation stage + subject confidence
        ↓
Daily study plan
        ↓
Task-based practice
        ↓
Quiz return updates mentor state
```

---

### 3. History Revision Flow

```text
History
  ↓
Quiz History / Saved Questions / Repeated Mistakes
  ↓
Filter by quiz, subject, topic, wrong, skipped or saved
  ↓
Review questions
  ↓
Practice filtered set
```

---

### 4. Result-to-Revision Flow

```text
Quiz Result
  ↓
Score + correct/wrong/skipped breakdown
  ↓
Weak areas and next-step card
  ↓
Review mistakes
  ↓
Re-attempt filtered questions
```

---

## Feature System

| Feature               | Product Purpose                 | User Value                                                    |
| --------------------- | ------------------------------- | ------------------------------------------------------------- |
| **Daily Challenge**   | Builds daily practice habit     | Student gets a quick daily GK target                          |
| **Subject Practice**  | Allows focused preparation      | Student can practice Polity, Geography, History, Science etc. |
| **Topic Practice**    | Supports micro-revision         | Student can target weak topics                                |
| **SSC PYQs**          | Uses exam-style practice        | Student gets real pattern familiarity                         |
| **Quiz Result**       | Shows performance clearly       | Student knows score, mistakes and skips                       |
| **Detailed Review**   | Converts mistakes into learning | Student can understand each question                          |
| **Saved Questions**   | Creates personal revision bank  | Student can revisit important questions                       |
| **Repeated Mistakes** | Finds recurring weak areas      | Student knows what is hurting score repeatedly                |
| **Quiz History**      | Tracks learning journey         | Student can review attempts and progress                      |
| **Analysis**          | Turns activity into insight     | Student sees weak subjects/topics                             |
| **Mentor Plan**       | Gives daily direction           | Student knows what to do today                                |
| **Coins & Streaks**   | Encourages consistency          | Student builds practice habit                                 |
| **Leaderboard**       | Adds competitive motivation     | Student can compare rank and progress                         |
| **Dream Post**        | Connects effort to aspiration   | Student sees progress toward target post                      |

---

## Current Product Modules

```text
pages/
├── dashboard
├── subjects
├── quiz-setup
├── quiz
├── result
├── history
├── saved-questions
├── repeated-mistakes
├── coins-history
├── streak-history
├── leaderboard
├── analysis
├── profile
├── mentor
├── mentor-setup
└── mentor-tasks
```

---

## Tech Stack

| Layer              | Technology                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| **Frontend**       | Next.js 14, React                                                           |
| **Routing**        | Next.js Pages Router                                                        |
| **Styling**        | Tailwind CSS, global CSS, design tokens                                     |
| **Auth**           | NextAuth + Google OAuth                                                     |
| **Data Source**    | Google Sheets API                                                           |
| **AI Layer**       | Gemini API                                                                  |
| **Deployment**     | Vercel                                                                      |
| **Client Storage** | localStorage, sessionStorage                                                |
| **Caching**        | Client cache, server cache, stale-while-revalidate, in-flight deduplication |

---

## API Structure

The app currently uses a cleaned API architecture with route groups for product-specific needs.

| API Group                | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| **Auth APIs**            | Google login and session handling                        |
| **Dashboard APIs**       | Dashboard bootstrap, profile, rank, streak, coins        |
| **Question APIs**        | Subjects, topics, question banks, daily challenge        |
| **Quiz Completion APIs** | Quiz submission, scoring, attempt saving                 |
| **History APIs**         | Quiz history, session review, subject/topic filters      |
| **Saved APIs**           | Save, unsave, delete and fetch saved questions           |
| **Mentor APIs**          | Mentor profile, plan, task actions, refresh, quiz return |
| **Analysis APIs**        | Activity, performance, weak areas and report data        |
| **Leaderboard APIs**     | Global rank and weekly champions                         |
| **AI APIs**              | Explanation, tips and result insights                    |
| **Feedback APIs**        | Feedback and question reporting                          |

---

## Data Storage

Google Sheets is used as the MVP backend.

Main data areas:

| Data Area              | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| **Questions**          | Stores SSC GK question bank                    |
| **Scores**             | Stores quiz scores and performance             |
| **Quiz Sessions**      | Stores attempt-level quiz history              |
| **Attempt Answers**    | Stores question-level attempt data             |
| **Saved Questions**    | Stores bookmarked questions                    |
| **Users**              | Stores user profile, coins, streak, dream post |
| **Mentor Profile**     | Stores mentor setup and preferences            |
| **Mentor Tasks**       | Stores daily mentor task state                 |
| **Mentor Feedback**    | Stores mentor task feedback                    |
| **Feedback**           | Stores user feedback                           |
| **Reported Questions** | Stores question issue reports                  |

---

## Performance Architecture

The app went through a large optimization pass to make the Google Sheets-backed MVP more reliable.

### Key Optimizations

| Area                | Before                       | After                                |
| ------------------- | ---------------------------- | ------------------------------------ |
| **Dashboard**       | Multiple duplicate reads     | Bootstrap + cache reuse              |
| **Quiz Setup**      | Topic fetch N+1 risk         | Cached topic/question-bank strategy  |
| **Question Bank**   | Repeated reads               | Server cache + client reuse          |
| **Quiz Completion** | Duplicate write risk         | Canonical completion flow            |
| **History**         | Multiple parallel calls      | Consolidated landing/read flows      |
| **Saved Questions** | Refetch-heavy mutations      | Cache patching after save/unsave     |
| **Mentor**          | Mutation followed by refetch | Task action returns updated snapshot |
| **AI Explanations** | Repeated Gemini calls        | Question-level AI cache              |
| **Leaderboard**     | Repeated warm reads          | Cache reuse                          |
| **Sheets Reads**    | Duplicate concurrent reads   | In-flight read deduplication         |

---

## Caching Strategy

```text
Client Cache
 ├── dashboard bootstrap
 ├── profile
 ├── history
 ├── saved questions
 ├── mentor snapshot
 ├── analysis
 ├── leaderboard
 └── AI explanations

Server Cache
 ├── topics
 ├── question banks
 ├── daily challenge
 ├── leaderboard
 └── Sheet reads

Session Storage
 ├── active quiz state
 ├── current question
 ├── selected answers
 └── refresh/back safety state
```

The cache strategy is designed to reduce repeated Google Sheets reads without hiding fresh user actions.

---

## Mentor System

The Mentor is the main product evolution from a simple quiz app to a study-planning system.

### Mentor Inputs

| Input                  | Why it matters                         |
| ---------------------- | -------------------------------------- |
| **Exam goal**          | Creates exam-specific plan direction   |
| **Days left**          | Controls urgency and task density      |
| **Daily study time**   | Keeps plan realistic                   |
| **Preparation stage**  | Changes plan style                     |
| **Subject confidence** | Helps detect weak areas                |
| **Past mistakes**      | Turns history into revision tasks      |
| **Pending tasks**      | Supports continuation instead of reset |

---

### Mentor Task Types

| Task Type    | Example                    |
| ------------ | -------------------------- |
| **Revision** | Revise weak Polity topic   |
| **Practice** | Practice repeated mistakes |
| **Quiz**     | Attempt mixed GK quiz      |
| **Resume**   | Continue paused task       |
| **Review**   | Review completed result    |

---

## SSC Quest Light UI System

The app is being redesigned around a consistent mobile-first UI system called **SSC Quest Light**.

### Design Principles

| Principle             | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| **Mobile-first**      | Optimized for SSC aspirants using phones                   |
| **Light and focused** | Soft background, white cards, clean hierarchy              |
| **Action-oriented**   | Every screen pushes the next useful action                 |
| **Revision-friendly** | Filters, cards and CTAs support quick review               |
| **Consistent**        | Same card, button, chip, empty and loading patterns        |
| **Motivating**        | Coins, streaks, rank and mentor copy encourage consistency |

---

### UI Tokens

| Token             | Usage                                       |
| ----------------- | ------------------------------------------- |
| **Orange**        | Primary CTA, practice action                |
| **Teal**          | Selected state, progress, success direction |
| **Navy**          | Main text and headings                      |
| **Slate**         | Helper text and metadata                    |
| **Soft Red**      | Wrong, weak, needs revision                 |
| **Amber**         | Skipped, medium, warning                    |
| **White Cards**   | Main content surfaces                       |
| **Rounded Cards** | 18–24px radius for premium mobile feel      |

---

## Loading and Empty States

The product avoids dead loading screens.

Instead of only showing:

```text
Loading...
```

the app is moving toward contextual loading states like:

```text
Preparing your quiz history...
Collecting attempts, scores and review data
```

Example loading steps:

* fetching quiz sessions
* organizing results
* preparing filters
* checking weak areas
* finalizing review view

Empty states are also designed to be useful:

```text
No wrong questions found
Good job. Try another filter or review all questions.
```

---

## AI Layer

AI is used only where it improves learning.

| AI Feature             | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| **Answer Explanation** | Helps student understand why an answer is correct |
| **Wrong Answer Help**  | Explains mistake and concept gap                  |
| **Smart Tip**          | Gives short revision/practice suggestion          |
| **Result Insight**     | Summarizes result and next step                   |
| **Mentor Copy**        | Makes the plan feel guided and human              |

AI calls are cached where possible to avoid unnecessary repeated Gemini requests.

---

## Reliability and Safety

Important reliability rules followed in the project:

* do not casually change Google Sheets schema
* avoid duplicate score/history writes
* preserve quiz state on refresh/back behavior
* keep route names stable
* keep cache account-scoped
* do not expose secrets
* keep AI calls controlled
* keep UI changes separate from backend logic
* use documentation after every major change

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/until-aman/SSC-GK-SCORE-BOOSTER-V2.git

# 2. Enter project
cd SSC-GK-SCORE-BOOSTER-V2

# 3. Install dependencies
npm install

# 4. Create environment file
cp .env.example .env.local

# 5. Add keys in .env.local
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# NEXTAUTH_SECRET=
# NEXTAUTH_URL=
# GOOGLE_SHEET_ID=
# GOOGLE_SERVICE_ACCOUNT_KEY=
# GEMINI_API_KEY=

# 6. Run locally
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Common Commands

| Command         | Purpose                      |
| --------------- | ---------------------------- |
| `npm run dev`   | Run local development server |
| `npm run build` | Build production app         |
| `npm run start` | Start production build       |
| `npm run lint`  | Run lint checks              |

The repo also contains additional test and diagnostic scripts for Mentor, quiz refresh behavior, API optimization and regression checks.

Check `package.json` for the full script list.

---

## Project Structure

```text
SSC-GK-SCORE-BOOSTER-V2/
│
├── pages/
│   ├── api/                  # Next.js API routes
│   ├── dashboard.js          # Main dashboard
│   ├── subjects.js           # Subject selection
│   ├── quiz-setup.js         # Quiz configuration
│   ├── quiz.js               # Quiz player
│   ├── result.js             # Result screen
│   ├── history/              # History and review pages
│   ├── mentor.js             # Mentor home
│   ├── mentor-setup.js       # Mentor onboarding/setup
│   ├── analysis.js           # Analysis surface
│   ├── leaderboard.js        # Rank and weekly champions
│   └── profile.js            # User profile
│
├── components/
│   ├── ui/                   # Shared UI primitives
│   ├── MentorTaskCard.jsx    # Mentor task card
│   ├── MentorMessage.jsx     # Mentor guidance message
│   ├── BottomNav.jsx         # Mobile bottom navigation
│   └── ...
│
├── lib/
│   ├── data/                 # Data access helpers
│   ├── mentor/               # Mentor logic
│   ├── services/             # Business services
│   ├── sheets.js             # Google Sheets client wrapper
│   ├── clientCache.js        # Client cache utilities
│   ├── serverCache.js        # Server cache utilities
│   └── gemini.js             # Gemini AI helper
│
├── styles/
│   └── globals.css           # Global styles and theme tokens
│
├── docs/
│   ├── ui-theme/             # UI migration notes and checklists
│   ├── API_*                 # API optimization docs
│   ├── MENTOR_*              # Mentor architecture docs
│   └── ...
│
├── scripts/                  # Test and diagnostic scripts
├── package.json
└── README.md
```

---

## Manual Testing Checklist

Before pushing major changes, test:

| Area                  | Check                                       |
| --------------------- | ------------------------------------------- |
| **Guest Mode**        | Start quiz without login                    |
| **Auth Mode**         | Login and verify saved progress             |
| **Quiz Setup**        | Subject, topic and count selection          |
| **Quiz Player**       | Timer, answer, skip, refresh/back behavior  |
| **Result**            | Score, coins, review CTAs                   |
| **History**           | Quiz-wise, subject-wise, topic-wise filters |
| **Saved Questions**   | Save, unsave, review, practice set          |
| **Repeated Mistakes** | Filter and practice weak questions          |
| **Mentor**            | Setup, plan, task action, view all tasks    |
| **Analysis**          | Performance cards and weak area view        |
| **Leaderboard**       | Rank and weekly champions                   |
| **Profile**           | Coins, streak, dream post, achievements     |
| **Mobile UI**         | 390–430px width, bottom nav, sticky CTAs    |
| **Build**             | `npm run lint` and `npm run build`          |

---

## Cost and MVP Tradeoff

This project intentionally uses a low-cost MVP stack.

| Layer    | Cost Approach                               |
| -------- | ------------------------------------------- |
| Hosting  | Vercel free/hobby-friendly deployment       |
| Database | Google Sheets as MVP backend                |
| Auth     | Google OAuth via NextAuth                   |
| AI       | Gemini only where needed                    |
| Cache    | Client/server cache to reduce backend reads |
| UI       | Tailwind and custom design tokens           |

This stack allowed fast product iteration without maintaining a full database early.

Future scale may require moving from Google Sheets to Supabase/Postgres.

---

## Current Launch Status

Current recommended status:

```text
Closed / monitored cohort
```

Suggested first user group:

```text
10–20 trusted SSC aspirants
```

Before broad public launch, validate:

* Google Sheets read/write behavior
* quiz completion idempotency
* no duplicate score or coin writes
* real user session isolation
* mentor task updates
* AI request volume
* production logs and errors

---

## Roadmap

| Priority        | Next Direction                                        |
| --------------- | ----------------------------------------------------- |
| **UI Polish**   | Finish SSC Quest Light consistency across all screens |
| **Reliability** | Strengthen quiz refresh/back behavior                 |
| **Mentor**      | Improve daily plan quality and task sequencing        |
| **Analytics**   | Improve weak topic and subject-level insights         |
| **Leaderboard** | Add better weekly/monthly ranking views               |
| **Community**   | Improve WhatsApp/community loop                       |
| **Data Layer**  | Move to Supabase/Postgres when scale requires         |
| **Admin Tools** | Build better content and question management system   |

---

## What This Project Demonstrates

This project demonstrates:

* product thinking for a real exam-prep problem
* end-to-end ownership of a live product
* mobile-first UX design
* gamification design
* AI-assisted learning flows
* architecture cleanup
* API optimization
* caching strategy
* Google Sheets-backed MVP design
* practical tradeoffs between speed, cost and scale
* ability to use AI coding tools while still making product decisions

---

## Built By

**Aman Antil**
IIT Kharagpur
Product + Builder

I built this product to solve a real revision-direction problem faced by SSC aspirants.

This project is not only about building quizzes.
It is about converting every quiz attempt into a smarter next action.

---

## License

MIT

</div>
