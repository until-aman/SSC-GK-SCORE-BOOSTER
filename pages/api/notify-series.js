import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
const { getSheetsClient, SHEET_NAMES } = require('@/lib/sheets');

const TAB = SHEET_NAMES.SERIES_NOTIFICATIONS;
const HEADERS = ['Timestamp', 'Email', 'Name', 'SeriesID', 'SeriesTitle'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { seriesId, seriesTitle } = req.body || {};
  if (!seriesId || !seriesTitle) return res.status(400).json({ error: 'Missing fields' });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || 'guest';
  const name  = session?.user?.name  || 'Guest';

  const sheetId = process.env.GOOGLE_SHEET_ID;

  try {
    const sheets = await getSheetsClient();

    // Ensure tab exists — create with header if missing
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tabExists = meta.data.sheets.some(s => s.properties.title === TAB);

    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
      });
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TAB}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS] },
      });
    }

    // Prevent duplicate notifications for same email + series
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${TAB}!A:E`,
    });
    const rows = existing.data.values || [];
    const alreadyNotified = rows.some(row => row[1] === email && row[3] === seriesId);

    if (alreadyNotified) return res.status(200).json({ ok: true, alreadyNotified: true });

    // Save the notification
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${TAB}!A:E`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), email, name, seriesId, seriesTitle]],
      },
    });

    return res.status(200).json({ ok: true, alreadyNotified: false });
  } catch (err) {
    console.error('[notify-series]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
