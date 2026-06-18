# SSC-GK Score Booster

A comprehensive GK practice, revision, history, mistake-tracking, and analysis platform for SSC exam students. Built with Next.js 14, it offers a complete learning ecosystem with AI mentorship, gamification, and detailed performance analytics.

## Overview

SSC-GK Score Booster is a mobile-first web application designed specifically for SSC (Staff Selection Commission) exam aspirants in India. The platform provides timed multiple-choice quizzes across 8 subjects, featuring an AI mentor that explains answers and provides personalized feedback. All questions are sourced from a Google Sheet database, ensuring up-to-date and exam-relevant content.

## Product Vision

This is a GK practice, revision, history, mistake-tracking, and analysis platform for SSC exam students. The application combines traditional quiz-based learning with modern AI mentorship to create a personalized study experience that helps students improve their scores through consistent practice, mistake analysis, and targeted preparation.

## Core Features

* GK quiz practice
* Subject/topic-based quizzes
* Daily challenge
* SSC PYQ practice
* Quiz result and review
* Quiz history
* Saved questions
* Coins/gamification
* Leaderboard/community
* Mentor/analysis flows
* Google login/guest mode
* AI explanations or AI mentor

## Tech Stack

* Next.js
* React
* Tailwind CSS
* NextAuth
* Google Sheets API
* Vercel deployment

## App Architecture

| Folder | Purpose |
|--------|---------|
| pages | Main application routes (landing, quiz, dashboard, mentor, history, etc.) |
| pages/api | API endpoints for data fetching, mutations, and integrations |
| components | Reusable React components (UI primitives, cards, buttons, etc.) |
| lib | Server-side logic, services, utilities, and business logic |
| lib/data | Data fetching functions for questions, scores, mentor, etc. |
| lib/mentor | Mentor-specific logic, task management, and AI integration |
| lib/mentorCopy | Pre-written mentor messages and conversation flows |
| styles | Global CSS (globals.css) |
| scripts | Test scripts for mentor functionality |

## Main User Flows

### 1. Guest user flow
* Access landing page with guest sign-in option
* Start quizzes without authentication
* Limited features (scores not saved, no history)

### 2. Signed-in user flow
* Full access to all features
* Scores and progress saved to Google Sheets
* Personalized mentor plan and analysis
* Coins, streak, and leaderboard tracking

### 3. Quiz start flow
* From dashboard: Daily challenge or subject selection
* From mentor: Task-based practice recommendations
* From history: Re-attempt previous quizzes
* From saved: Review bookmarked questions

### 4. Quiz attempt flow
* 20-second timer per question with visual countdown
* Real-time answer submission
* Immediate feedback with explanation
* Score calculation (+2/-0.5/0)

### 5. Quiz completion/result flow
* Results page with detailed breakdown
* AI mentor explanations for wrong answers
* Performance insights and recommendations
* Options to save for later review

### 6. History/review flow
* Quiz history with performance metrics
* Repeated mistakes analysis
* Saved questions management
* Coins and streak tracking

### 7. Saved questions flow
* Bookmark questions for later practice
* Create custom question banks
* Cross-device synchronization

### 8. Dashboard flow
* Main hub with stats and quick actions
* Daily challenge showcase
* Subject performance overview
* Recent activity feed

### 9. Mentor/analysis flow
* Personalized daily task plan
* Subject and topic recommendations
* Performance analysis and insights
* Confidence and coverage checks

## API Overview

| API Route | Purpose | Reads/Writes | Data Source |
|-----------|---------|--------------|-------------|
| /api/questions | Fetch questions by subject/topic | Read | Google Sheets |
| /api/score | Submit quiz results | Write | Google Sheets |
| /api/score-history | Save quiz history | Write | Google Sheets |
| /api/saved-questions | Manage saved questions | Read/Write | Google Sheets |
| /api/mentor/plan | Fetch mentor task plan | Read | Google Sheets |
| /api/mentor/task-action | Complete mentor tasks | Write | Google Sheets |
| /api/leaderboard | Get weekly leaderboard | Read | Google Sheets |
| /api/daily-challenge | Get daily challenge questions | Read | Google Sheets |
| /api/analysis-activity | Get user activity data | Read | Google Sheets |
| /api/ai/explain | Get AI explanations | Read | Gemini API |
| /api/ai/tip | Get AI tips | Read | Gemini API |

## Data Storage

* Google Sheets tabs: `Questions`, `Scores`, `Feedback`
* localStorage/sessionStorage: Guest session data and quiz state
* Auth/session data: User profiles and preferences

## Environment Variables

| Variable | Purpose |
|----------|---------|
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret |
| NEXTAUTH_SECRET | NextAuth secret key |
| NEXTAUTH_URL | NextAuth base URL |
| GOOGLE_SHEET_ID | Google Sheet ID for data |
| GOOGLE_SERVICE_ACCOUNT_KEY | Service account JSON key |
| GEMINI_API_KEY | Gemini AI API key |

## Local Setup

1. Clone repo
2. Install dependencies
3. Add environment variables
4. Run development server
5. Open localhost

## Scripts

| Command | Purpose |
|---------|---------|
| dev | Run Next.js development server |
| build | Build for production |
| start | Start production server |
| lint | Run ESLint |
| test:mentor-repo | Test mentor repository |
| test:mentor-plan-day | Test mentor plan generation |
| test:mentor-state-machine | Test mentor task state machine |
| test:mentor-rollover | Test mentor daily rollover |
| test:mentor-sheets | Test mentor sheets migration |
| test:mentor-sheets-writer | Test mentor sheets writer |
| test:mentor-sheets-retry | Test mentor sheets retry logic |
| test:mentor-background-rollover | Test mentor background rollover |
| test:mentor-mutation-service | Test mentor mutation service |
| test:mentor-read-overlay | Test mentor read overlay |
| test:mentor-v2-postpone | Test mentor v2 postpone |
| test:mentor-v2-cohort | Test mentor v2 cohort |
| mentor:v2-monitor | Monitor mentor v2 mutations |
| mentor:sheets-migration:dry-run | Dry run mentor sheets migration |
| mentor:sheets-migration:write-plan | Write mentor sheets migration plan |
| mentor:sheets-migration:apply | Apply mentor sheets migration |
| test:mentor-pending-surfacing | Test mentor pending surfacing |
| test:mentor-v2-resume | Test mentor v2 resume |
| test:mentor-pending-ui | Test mentor pending UI |
| test:mentor-v2-complete-design | Test mentor v2 complete design |
| test:mentor-v2-complete | Test mentor v2 complete |
| test:mentor-route-readiness | Test mentor route readiness |
| test:mentor-monitor-alerts | Test mentor monitor alerts |
| test:mentor-allow-all | Test mentor allow all |
| test:mentor-monitor-workflow | Test mentor monitor workflow |
| test:mentor-cron-monitor | Test mentor cron monitor |
| test:quiz-refresh-leave-modal | Test quiz refresh leave modal |
| test:mentor-quiz-launch | Test mentor quiz launch |
| test:mentor-rollover-dry-run | Test mentor rollover dry run |
| test:mentor-rollover-write | Test mentor rollover write |

## Current Product Priorities

* make flows more reliable
* improve quiz refresh/back behavior
* unify UI across tabs
* reduce duplicate API calls
* improve mobile-first premium design
* strengthen history, saved questions, analysis, and mentor flows

## Notes for Future Contributors / AI Coding Agents

* Understand the repo before editing.
* Do not change Google Sheets schema casually.
* Do not rename API routes casually.
* Keep quiz state, history writes, coins, and auth flows stable.
* Make small targeted changes.
* After every change, list files changed and manual testing steps.

## Manual Testing Checklist

* Start quiz as guest
* Start quiz as signed-in user
* Submit quiz
* Review result
* Refresh during quiz
* Press back during quiz
* Check history
* Save/unsave question
* Open dashboard
* Open analysis/mentor if present
* Check mobile layout
