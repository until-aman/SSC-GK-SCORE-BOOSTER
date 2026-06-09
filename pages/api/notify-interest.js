import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { getSheetsClient } from '@/lib/sheets';

// Step 10: in-process in-flight guard. The same authenticated user submitting
// twice nearly simultaneously (double-click / retry) shares ONE check+append
// promise, so a second concurrent request can't slip past the existing-record
// check and append a duplicate row. Server-instance-local — Google Sheets has
// no unique index/transaction, so cross-instance concurrency can still (rarely)
// race; the existing email+collection check makes that the only gap.
const interestInflight = new Map();

async function upsertInterest({ email, name, collection }) {
  const sheets = await getSheetsClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;

  // Check for an existing entry with the same normalized email + collection.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'NotifyInterest!A:D',
  });
  const rows = existing.data.values || [];
  const alreadyJoined = rows.some(
    row => row[1]?.toLowerCase() === email.toLowerCase() && row[3] === collection
  );
  if (alreadyJoined) return { alreadyJoined: true };

  // Insert new row: [timestamp, email, name, collection]. (Schema unchanged.)
  const timestamp = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'NotifyInterest!A:D',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[timestamp, email, name, collection]] },
  });
  return { success: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { collection } = req.body;
  if (!collection) return res.status(400).json({ error: 'collection is required' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    // Guest — do not store, tell client to show sign-in prompt
    return res.status(200).json({ guestBlocked: true });
  }

  // Identity from the authenticated session ONLY (never a client-supplied email).
  // Stored with original casing; deduped case-insensitively (unchanged behavior).
  const email = session.user.email;
  const name  = session.user.name || '';
  const dedupeKey = `${email.toLowerCase()}|${collection}`;

  try {
    let pending = interestInflight.get(dedupeKey);
    if (!pending) {
      pending = upsertInterest({ email, name, collection })
        .finally(() => { interestInflight.delete(dedupeKey); });
      interestInflight.set(dedupeKey, pending);
    }
    const result = await pending;
    return res.status(200).json(result);
  } catch (err) {
    console.error('[notify-interest] Error:', err.message);
    return res.status(500).json({ error: 'Failed to save' });
  }
}
