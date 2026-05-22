import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Cache the numeric sheetId to avoid repeated metadata fetches
let cachedSheetId = null;

async function getSheetId(sheets) {
  if (cachedSheetId !== null) return cachedSheetId;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
  if (!tab) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  cachedSheetId = tab.properties.sheetId;
  return cachedSheetId;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;
  const sheets = await getSheetsClient();

  // ── GET: fetch all saved questions for user ──────────────────────────
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:L`,
      });
      const rows = result.data.values || [];
      const userRows = rows
        .filter(r => r[0] === email)
        .map(r => ({
          email:         r[0]  || '',
          questionId:    r[1]  || '',
          subject:       r[2]  || '',
          topic:         r[3]  || '',
          question:      r[4]  || '',
          optionA:       r[5]  || '',
          optionB:       r[6]  || '',
          optionC:       r[7]  || '',
          optionD:       r[8]  || '',
          correctOption: r[9]  || '',
          explanation:   r[10] || '',
          savedAt:       r[11] || '',
        }))
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return res.status(200).json({ saved: userRows });
    } catch (err) {
      console.error('[saved-questions GET]', err.message);
      return res.status(500).json({ error: 'Failed to fetch saved questions' });
    }
  }

  // ── POST: save a question ────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      questionId, subject, topic, question,
      optionA, optionB, optionC, optionD,
      correctOption, explanation,
    } = req.body || {};

    if (!questionId) return res.status(400).json({ error: 'questionId is required' });
    if (!question)   return res.status(400).json({ error: 'question is required' });
    if (!['A', 'B', 'C', 'D'].includes((correctOption || '').toUpperCase())) {
      return res.status(400).json({ error: 'correctOption must be A, B, C, or D' });
    }
    if (!optionA || !optionB || !optionC || !optionD) {
      return res.status(400).json({ error: 'All four options are required' });
    }

    try {
      // Duplicate check — read only email + questionId columns
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:B`,
      });
      const rows = existing.data.values || [];
      const alreadySaved = rows.some(r => r[0] === email && r[1] === questionId);
      if (alreadySaved) return res.status(200).json({ ok: true, alreadySaved: true });

      const savedAt = new Date().toISOString();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:L`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            email,
            questionId,
            subject       || '',
            topic         || '',
            question,
            optionA,
            optionB,
            optionC,
            optionD,
            correctOption.toUpperCase(),
            explanation   || '',
            savedAt,
          ]],
        },
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[saved-questions POST]', err.message);
      return res.status(500).json({ error: 'Failed to save question' });
    }
  }

  // ── DELETE: unsave a question ────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { questionId } = req.body || {};
    if (!questionId) return res.status(400).json({ error: 'questionId is required' });

    try {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:B`,
      });
      const rows = result.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === email && r[1] === questionId);
      if (rowIndex === -1) return res.status(200).json({ ok: true, notFound: true });

      const sheetId = await getSheetId(sheets);
      // rows[0] is sheet row 2 → 0-based sheet index = 1
      const sheetRowIndex = rowIndex + 1;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: sheetRowIndex,
                endIndex:   sheetRowIndex + 1,
              },
            },
          }],
        },
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[saved-questions DELETE]', err.message);
      return res.status(500).json({ error: 'Failed to unsave question' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
