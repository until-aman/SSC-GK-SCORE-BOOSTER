import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';
import { invalidateSavedIdsCache } from './ids';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
let cachedSheetId = null;

async function getSheetId(sheets) {
  if (cachedSheetId !== null) return cachedSheetId;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const tab = meta.data.sheets.find(sheet => sheet.properties.title === SHEET_NAME);
  if (!tab) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  cachedSheetId = tab.properties.sheetId;
  return cachedSheetId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const {
    questionId,
    action,
    subject = '',
    topic = '',
    question = '',
    optionA = '',
    optionB = '',
    optionC = '',
    optionD = '',
    correctOption = '',
    explanation = '',
  } = req.body || {};

  if (!questionId || !['save', 'unsave'].includes(action)) {
    return res.status(400).json({ success: false, error: 'questionId and valid action are required' });
  }

  try {
    const sheets = await getSheetsClient();
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B`,
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === session.user.email && row[1] === questionId);

    if (action === 'save') {
      if (rowIndex !== -1) return res.status(200).json({ success: true, data: { isSaved: true, alreadySaved: true } });
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:L`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            session.user.email,
            questionId,
            subject,
            topic,
            question,
            optionA,
            optionB,
            optionC,
            optionD,
            String(correctOption || '').toUpperCase(),
            explanation,
            new Date().toISOString(),
          ]],
        },
      });
      invalidateSavedIdsCache(session.user.email);
      return res.status(200).json({ success: true, data: { isSaved: true } });
    }

    if (rowIndex !== -1) {
      const sheetId = await getSheetId(sheets);
      const sheetRowIndex = rowIndex + 1;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: sheetRowIndex, endIndex: sheetRowIndex + 1 },
            },
          }],
        },
      });
      invalidateSavedIdsCache(session.user.email);
    }
    return res.status(200).json({ success: true, data: { isSaved: false } });
  } catch (err) {
    console.error('[saved-questions/toggle]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update saved question' });
  }
}
