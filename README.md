# SSC GK Quiz App

A **mobile-first, web-only SSC GK quiz application** built with Next.js 14. Users (SSC exam aspirants in India) can take timed multiple-choice quizzes on subjects like Polity, History, Geography, etc. Questions come exclusively from a Google Sheet. An AI (Gemini 1.5 Flash) acts as a mentor — it explains answers and gives performance feedback, but never generates questions.

## Features

- **8 Subjects**: Polity, Geography, Economics, History, Physics, Chemistry, Biology, Current Affairs
- **Google Sheets Backend**: Questions and scores stored in Google Sheets
- **AI Mentor**: Gemini 1.5 Flash explains wrong answers, gives tips for skipped questions, and provides performance summaries
- **Google Sign In**: Track scores and appear on the global leaderboard
- **Guest Mode**: Play without signing in (scores won't be saved)
- **Timed Quiz**: 20-second countdown per question with visual timer
- **SSC Scoring**: +2 correct, -0.5 incorrect, 0 skipped
- **Global Leaderboard**: Ranked by total score, accuracy, and questions attempted

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (Pages Router) |
| Styling | Tailwind CSS |
| Auth | NextAuth.js v4 with Google OAuth |
| Database | Google Sheets (via googleapis) |
| AI Mentor | Gemini 1.5 Flash REST API |
| Deployment | Vercel (free tier) |

## Setup Instructions

### 1. Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Add **3 tabs** named exactly: `Questions`, `Scores`, `Feedback`
4. In the **Questions** tab, add these headers in Row 1:
   - A: ID | B: Subject | C: Topic | D: Question | E: OptionA | F: OptionB | G: OptionC | H: OptionD | I: CorrectOption | J: Explanation
5. In the **Scores** tab, add these headers in Row 1:
   - A: timestamp | B: email | C: name | D: correctAnswers | E: incorrectAnswers | F: skipped | G: totalQuestions | H: rawScore | I: subject | J: topic

### 2. Enable Google APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Sheets API** and **Google Drive API**

### 3. Create Google OAuth Credentials

1. Go to APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the **Client ID** and **Client Secret**

### 4. Create a Service Account

1. Go to IAM & Admin → Service Accounts → Create Service Account
2. Give it any name (e.g. "ssc-quiz-sheets")
3. Click the service account → Keys tab → Add Key → JSON
4. Download the JSON key file
5. Open the JSON file, copy the entire contents, minify to one line (use [jsonformatter.org/json-minify](https://jsonformatter.org/json-minify))
6. **Share your Google Sheet** with the service account email (found in the JSON as `client_email`) — give it **Editor** access

### 5. Get a Gemini API Key

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key" → Create API Key

### 6. Configure Environment

1. Open `.env.local` in the project root
2. Fill in all values:

```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GEMINI_API_KEY=your_gemini_key
```

> To generate `NEXTAUTH_SECRET`, run: `openssl rand -base64 32`

### 7. Run the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Vercel Deployment

1. Go to [vercel.com](https://vercel.com) → Import your project folder
2. Add all 6 environment variables in the Vercel dashboard
3. Change `NEXTAUTH_URL` to your Vercel domain (e.g. `https://ssc-quiz.vercel.app`)
4. Add the Vercel domain to your Google OAuth authorized redirect URIs

## Scoring Rules

- ✅ Correct answer: **+2 marks**
- ❌ Incorrect answer: **-0.5 marks**
- ⏭️ Skipped: **0 marks**

## License

MIT
