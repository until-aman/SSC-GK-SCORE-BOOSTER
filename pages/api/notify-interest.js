import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { collection } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection is required' });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || 'Guest';
  const name = session?.user?.name || 'Guest';
  const timestamp = new Date().toISOString();
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'NotifyInterest!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, email, name, collection]],
      },
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[notify-interest] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
