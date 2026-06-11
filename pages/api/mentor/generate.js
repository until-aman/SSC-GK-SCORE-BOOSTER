import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { loadOrCreateMentorSnapshot } from './plan';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const unlockNextDay = Boolean(req.body?.unlockNextDay);
    const revealCount = unlockNextDay ? 1 : undefined;
    const snapshot = await loadOrCreateMentorSnapshot(session.user.email, { forceRefresh: true, revealCount, unlockNextDay });
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error('[mentor/generate]', err.message);
    return res.status(500).json({ error: 'Could not generate mentor plan.' });
  }
}
