import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getSheetsClient,
  getUserRows,
  findUserRow,
  createDefaultUserRow,
  parseUserRow,
  appendUserRow,
} from '@/lib/sheets';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── PATCH: update display name (onboarding) ──────────────────────
  if (req.method === 'PATCH') {
    try {
      const { name } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name is required' });
      }
      const rows = await getUserRows();
      const rowIndex = rows.findIndex(r => r[0] === session.user.email);
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
      }
      // Update col B (name) — row index is 0-based in array, +2 for header + 1-based
      const sheetRow = rowIndex + 2;
      const sheets = await getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `Users!B${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[name.trim()]] },
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[user-profile PATCH] Error:', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── GET ───────────────────────────────────────────────────────────
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await getUserRows();
    const userRow = findUserRow(rows, session.user.email);

    const sessionImage = session.user.image || '';

    if (!userRow) {
      const newRow = createDefaultUserRow(session.user.email, session.user.name, sessionImage);
      await appendUserRow(newRow);
      const user = parseUserRow(newRow);
      return res.status(200).json({
        email: user.email,
        name: user.name,
        totalCoins: user.totalCoins,
        level: user.level,
        streakCount: user.streakCount,
        lastAttemptDate: user.lastAttemptDate,
        createdAt: user.createdAt,
        image: user.image,
        isNewUser: true,
      });
    }

    const user = parseUserRow(userRow);

    // Keep col L (image) up-to-date with the current Google profile photo
    if (sessionImage && sessionImage !== user.image) {
      try {
        const rowIndex = rows.findIndex(r => r[0] === session.user.email);
        const sheetRow = rowIndex + 2;
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `Users!L${sheetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[sessionImage]] },
        });
        user.image = sessionImage;
      } catch (imgErr) {
        console.warn('[user-profile] Could not update image:', imgErr.message);
      }
    }

    return res.status(200).json({
      email: user.email,
      name: user.name,
      totalCoins: user.totalCoins,
      level: user.level,
      streakCount: user.streakCount,
      lastAttemptDate: user.lastAttemptDate,
      createdAt: user.createdAt,
      image: user.image,
      isNewUser: false,
    });
  } catch (err) {
    console.error('[user-profile] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
