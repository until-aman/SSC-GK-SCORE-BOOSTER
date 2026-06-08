import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, appendMentorTaskLog } from '@/lib/sheets';
import { loadOrCreateMentorSnapshot } from './plan';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snapshot = await loadOrCreateMentorSnapshot(session.user.email, { forceRefresh: true });
    const sheets = await getSheetsClient();
    await appendMentorTaskLog(sheets, {
      email: session.user.email,
      planId: snapshot.plan?.planId || '',
      actionType: 'refresh_plan',
      actionValue: { force: Boolean(req.body?.force) },
      sourcePage: 'mentor',
    }).catch(() => {});
    return res.status(200).json({ ...snapshot, message: 'Mentor plan refreshed' });
  } catch (err) {
    console.error('[mentor/refresh]', err.message);
    return res.status(500).json({ error: 'Could not refresh plan. Please try again.' });
  }
}
