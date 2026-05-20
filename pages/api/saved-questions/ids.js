import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const sheets = await getSheetsClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B`,
    });
    const rows = result.data.values || [];
    const savedIds = rows
      .filter(r => r[0] === session.user.email)
      .map(r => r[1])
      .filter(Boolean);
    return res.status(200).json({ savedIds });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch saved IDs' });
  }
}
