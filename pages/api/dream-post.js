import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient, getUserRows, findUserRow, invalidateCache } from '@/lib/sheets';

const DREAM_POST_TARGET = 8000;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') return handleGet(req, res, session);
  if (req.method === 'POST') return handlePost(req, res, session);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res, session) {
  try {
    const email = session.user.email;
    const rows = await getUserRows();
    const userRow = findUserRow(rows, email);

    if (!userRow) {
      return res.status(200).json({
        dreamPost: '',
        dreamPostUpdatedAt: null,
        dreamPostUnlockedAt: null,
        coins: 0,
      });
    }

    const coins = Number(userRow[5]) || 0;
    // getUserRows() reads A2:L (cols 0–11). New cols M/N/O (12/13/14)
    // must be read directly. Row in sheet = array index + 2.
    const rowIndex = rows.indexOf(userRow) + 2;

    const sheets = await getSheetsClient();
    const dreamRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Users!M${rowIndex}:O${rowIndex}`,
    });

    const dreamRow = (dreamRes.data.values || [[]])[0] || [];
    return res.status(200).json({
      dreamPost:           dreamRow[0] || '',
      dreamPostUpdatedAt:  dreamRow[1] || null,
      dreamPostUnlockedAt: dreamRow[2] || null,
      coins,
    });
  } catch (err) {
    console.error('[dream-post GET]', err);
    return res.status(500).json({ error: 'Failed to load dream post' });
  }
}

async function handlePost(req, res, session) {
  try {
    const email = session.user.email;
    let { dreamPost } = req.body;

    if (typeof dreamPost !== 'string') {
      return res.status(400).json({ error: 'Invalid dream post value' });
    }
    dreamPost = dreamPost.trim();
    if (!dreamPost || dreamPost.length < 2 || dreamPost.length > 40) {
      return res.status(400).json({ error: 'Invalid dream post value' });
    }

    const rows = await getUserRows();
    const userRow = findUserRow(rows, email);
    if (!userRow) return res.status(404).json({ error: 'User not found' });

    const coins = Number(userRow[5]) || 0;
    const rowIndex = rows.indexOf(userRow) + 2;

    const sheets = await getSheetsClient();

    // Read existing dreamPostUnlockedAt so we never overwrite it
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Users!M${rowIndex}:O${rowIndex}`,
    });
    const existingRow = (existingRes.data.values || [[]])[0] || [];
    const existingUnlockedAt = existingRow[2] || null;

    const now = new Date().toISOString();
    // Write-once: only set unlockedAt if not already set AND coins >= target
    const newUnlockedAt = existingUnlockedAt
      ? existingUnlockedAt
      : (coins >= DREAM_POST_TARGET ? now : null);

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Users!M${rowIndex}:O${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[dreamPost, now, newUnlockedAt || '']],
      },
    });

    invalidateCache('userRows');

    return res.status(200).json({
      success: true,
      dreamPost,
      dreamPostUpdatedAt: now,
      dreamPostUnlockedAt: newUnlockedAt,
    });
  } catch (err) {
    console.error('[dream-post POST]', err);
    return res.status(500).json({ error: 'Failed to save dream post' });
  }
}
