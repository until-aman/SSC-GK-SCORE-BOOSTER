/**
 * One-time migration script for SSC GK Score Booster V2.
 *
 * Run with: node scripts/migrate-sheets.js
 *
 * What it does:
 *  1. Updates Scores tab header row (cols A-M)
 *  2. Creates Users tab with header row
 *  3. Creates LeaderboardCache tab with header + empty data row
 *
 * Requires: GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY in .env.local
 */

// Load .env.local manually (no dotenv dependency needed)
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
} catch { /* .env.local not found — rely on existing process.env */ }
const { google } = require('googleapis');

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheetMetadata(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return res.data.sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }));
}

async function createTab(sheets, spreadsheetId, title) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  console.log(`  Created tab: ${title}`);
}

async function run() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    console.error('ERROR: GOOGLE_SHEET_ID not set in .env.local');
    process.exit(1);
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('\n=== SSC GK Score Booster V2 — Sheet Migration ===\n');

  const existingSheets = await getSheetMetadata(sheets, spreadsheetId);
  const existingTitles = existingSheets.map(s => s.title);
  console.log('Existing tabs:', existingTitles.join(', '));

  // 1. Update Scores header row (cols A-M)
  console.log('\n[1/3] Updating Scores tab header row...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Scores!A1:M1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'timestamp', 'email', 'name',
        'correctAnswers', 'incorrectAnswers', 'skipped', 'totalQuestions', 'rawScore',
        'subject', 'topic', 'sessionId', 'xpEarned', 'isDailyChallenge',
      ]],
    },
  });
  console.log('  Scores header updated to 13 columns (A-M).');

  // 2. Create Users tab
  console.log('\n[2/3] Setting up Users tab...');
  if (!existingTitles.includes('Users')) {
    await createTab(sheets, spreadsheetId, 'Users');
  } else {
    console.log('  Users tab already exists — skipping creation.');
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Users!A1:K1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'email', 'name', 'streakCount', 'lastAttemptDate', 'streakShieldUsed',
        'totalXP', 'level', 'badges', 'dailyChallengeAttemptDates',
        'isPublicOnLeaderboard', 'createdAt',
      ]],
    },
  });
  console.log('  Users header row written.');

  // 3. Create LeaderboardCache tab
  console.log('\n[3/3] Setting up LeaderboardCache tab...');
  if (!existingTitles.includes('LeaderboardCache')) {
    await createTab(sheets, spreadsheetId, 'LeaderboardCache');
  } else {
    console.log('  LeaderboardCache tab already exists — skipping creation.');
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'LeaderboardCache!A1:C1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['cachedAt', 'weeklyJSON', 'allTimeJSON']] },
  });
  // Ensure row 2 exists (empty strings so UPDATE later works)
  const cacheCheck = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'LeaderboardCache!A2:C2',
  });
  if (!cacheCheck.data.values || cacheCheck.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'LeaderboardCache!A2:C2',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['', '', '']] },
    });
    console.log('  LeaderboardCache row 2 (empty cache) written.');
  } else {
    console.log('  LeaderboardCache row 2 already exists — skipping.');
  }
  console.log('  LeaderboardCache header row written.');

  console.log('\n=== Migration complete! ===');
  console.log('You can now delete this script (scripts/migrate-sheets.js).');
}

run().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
