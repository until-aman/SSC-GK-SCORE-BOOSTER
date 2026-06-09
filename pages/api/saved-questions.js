import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';
import { invalidateSavedIdsCache } from './saved-questions/ids';
import { buildSavedRow, findSavedRowIndex, normalizeMigrationBatch, MAX_MIGRATION_BATCH } from '@/lib/server/savedQuestionsService';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Step 11: in-process in-flight guard for single saves + batch migrations,
// keyed by `email|<questionId|batch>`. Concurrent identical submits share one
// check+append promise so a duplicate can't slip past the existing-row check.
// Server-instance-local (Sheets has no unique index/transaction).
const saveInflight = new Map();

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

  // ── POST: batch guest migration ({ questions: [...] }) ──────────────────
  if (req.method === 'POST' && Array.isArray(req.body?.questions)) {
    if (req.body.questions.length > MAX_MIGRATION_BATCH * 4) {
      return res.status(413).json({ error: 'Too many questions in one request' });
    }
    const batch = normalizeMigrationBatch(req.body.questions); // dedup + bound + validate
    const dedupeKey = `${email}|batch`;
    try {
      let pending = saveInflight.get(dedupeKey);
      if (!pending) {
        pending = (async () => {
          // Read existing saved IDs ONCE; append only the missing questions.
          const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A2:B` });
          const rows = existing.data.values || [];
          const savedSet = new Set(rows.filter(r => r[0] === email).map(r => r[1]));
          const toAppend = batch.filter(q => !savedSet.has(q.questionId || q.id));
          const skipped = batch.length - toAppend.length;
          if (toAppend.length > 0) {
            await sheets.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${SHEET_NAME}!A:L`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: toAppend.map(q => buildSavedRow(email, q)) },
            });
            invalidateSavedIdsCache(email);
          }
          return { ok: true, migrated: toAppend.length, skipped, failed: 0 };
        })().finally(() => saveInflight.delete(dedupeKey));
        saveInflight.set(dedupeKey, pending);
      }
      return res.status(200).json(await pending);
    } catch (err) {
      console.error('[saved-questions POST batch]', err.message);
      return res.status(500).json({ error: 'Failed to migrate saved questions' });
    }
  }

  // ── POST: save a single question ─────────────────────────────────────
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
      const dedupeKey = `${email}|${questionId}`;
      let pending = saveInflight.get(dedupeKey);
      if (!pending) {
        pending = (async () => {
          // Duplicate check — read only email + questionId columns
          const existing = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A2:B`,
          });
          const rows = existing.data.values || [];
          if (findSavedRowIndex(rows, email, questionId) !== -1) return { ok: true, alreadySaved: true };

          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:L`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [buildSavedRow(email, { questionId, subject, topic, question, optionA, optionB, optionC, optionD, correctOption, explanation })],
            },
          });
          invalidateSavedIdsCache(email);
          return { ok: true };
        })().finally(() => saveInflight.delete(dedupeKey));
        saveInflight.set(dedupeKey, pending);
      }
      return res.status(200).json(await pending);
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
      invalidateSavedIdsCache(email);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[saved-questions DELETE]', err.message);
      return res.status(500).json({ error: 'Failed to unsave question' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
