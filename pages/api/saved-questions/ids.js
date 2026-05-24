import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, CACHE_TTL } from '@/lib/sheets';

const SHEET_NAME = 'SavedQuestions';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Server-side in-memory cache: email → { savedIds: [], ts: number }
const savedIdsCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const email = session.user.email;

  // Check in-memory cache (30 sec TTL)
  const cached = savedIdsCache.get(email);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL.SAVED_IDS) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ savedIds: cached.savedIds });
  }

  try {
    const sheets = await getSheetsClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B`,
    });
    const rows = result.data.values || [];
    const savedIds = rows
      .filter(r => r[0] === email)
      .map(r => r[1])
      .filter(Boolean);

    // Store in cache
    savedIdsCache.set(email, { savedIds, ts: Date.now() });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ savedIds });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch saved IDs' });
  }
}

// Export cache invalidation for use by POST/DELETE handlers
export function invalidateSavedIdsCache(email) {
  savedIdsCache.delete(email);
}
