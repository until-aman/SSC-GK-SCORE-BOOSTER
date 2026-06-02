import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getCell, readSheet } from '@/lib/historyData';

function columnToLetter(columnNumber) {
  let letter = '';
  let n = columnNumber;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter || 'A';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const { clientSessionId, parentSessionId = '', attemptNumber = 2 } = req.body || {};
  if (!clientSessionId || !parentSessionId) return res.status(400).json({ success: false, error: 'Missing retry metadata' });

  try {
    const { sheets, headers, headerIndex, rows } = await readSheet('QuizSessions');
    const required = ['ClientSessionId', 'UserEmail', 'ParentSessionId', 'IsRetry', 'AttemptNumber'];
    const missing = required.filter(header => typeof headerIndex[header] !== 'number');
    if (missing.length) return res.status(400).json({ success: false, error: `Missing columns: ${missing.join(', ')}` });

    const rowOffset = rows.findIndex(row =>
      String(getCell(row, headerIndex, 'ClientSessionId') || '') === String(clientSessionId) &&
      String(getCell(row, headerIndex, 'UserEmail') || '') === session.user.email
    );
    if (rowOffset === -1) return res.status(404).json({ success: false, error: 'Session row not found' });

    const sheetRowNumber = rowOffset + 2;
    const data = [
      { header: 'ParentSessionId', value: parentSessionId },
      { header: 'IsRetry', value: 'TRUE' },
      { header: 'AttemptNumber', value: Number(attemptNumber) || 2 },
    ].map(item => ({
      range: `QuizSessions!${columnToLetter(headerIndex[item.header] + 1)}${sheetRowNumber}`,
      values: [[item.value]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[history/retry-metadata]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update retry metadata' });
  }
}
