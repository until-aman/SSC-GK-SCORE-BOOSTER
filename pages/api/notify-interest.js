import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { collection } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection is required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    // Guest — do not store, tell client to show sign-in prompt
    return res.status(200).json({ guestBlocked: true });
  }

  const email = session.user.email;
  const name  = session.user.name || '';

  try {
    const sheets = await getSheetsClient();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // Check for existing entry with same email + collection
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'NotifyInterest!A:D',
    });
    const rows = existing.data.values || [];
    const alreadyJoined = rows.some(
      row => row[1]?.toLowerCase() === email.toLowerCase() && row[3] === collection
    );
    if (alreadyJoined) {
      return res.status(200).json({ alreadyJoined: true });
    }

    // Insert new row: [timestamp, email, name, collection]
    const timestamp = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'NotifyInterest!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[timestamp, email, name, collection]] },
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[notify-interest] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
