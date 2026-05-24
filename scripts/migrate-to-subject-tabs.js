// Run with: node scripts/migrate-to-subject-tabs.js
// Requires GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY in environment
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SUBJECT_TO_TAB = {
  'Polity':           'Q_Polity',
  'Geography':        'Q_Geography',
  'Economics':        'Q_Economics',
  'Ancient History':  'Q_Ancient_History',
  'Medieval History': 'Q_Medieval_History',
  'Modern History':   'Q_Modern_History',
  'Physics':          'Q_Physics',
  'Chemistry':        'Q_Chemistry',
  'Biology':          'Q_Biology',
  'Current Affairs':  'Q_Current_Affairs',
};

const HEADERS = [['ID','Subject','Topic','Question','OptionA','OptionB','OptionC','OptionD','CorrectOption','Explanation']];

async function migrate() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // 1. Read all rows from existing Questions tab
  console.log('Reading Questions tab...');
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Questions!A2:J' });
  const allRows = res.data.values || [];
  console.log(`Found ${allRows.length} rows`);

  // 2. Group by subject
  const bySubject = {};
  allRows.forEach(row => {
    const subject = row[1];
    if (!subject || !SUBJECT_TO_TAB[subject]) {
      console.warn(`Skipping row with unknown subject: "${subject}"`);
      return;
    }
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(row);
  });

  // 3. Get existing sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTabs = meta.data.sheets.map(s => s.properties.title);

  // 4. For each subject, create tab if needed, then write rows
  for (const [subject, rows] of Object.entries(bySubject)) {
    const tabName = SUBJECT_TO_TAB[subject];
    console.log(`\nProcessing ${subject} → ${tabName} (${rows.length} rows)`);

    // Create tab if it doesn't exist
    if (!existingTabs.includes(tabName)) {
      console.log(`  Creating tab: ${tabName}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
      });
      // Write header
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: HEADERS },
      });
    }

    // Write rows (append — safe if tab was just created)
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!A2:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    console.log(`  ✅ Written ${rows.length} rows to ${tabName}`);

    // Avoid hitting write quota
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Migration complete. Verify data in each tab before deleting Questions tab.');
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
