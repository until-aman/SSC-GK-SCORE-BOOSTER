import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { loadOrCreateMentorSnapshot } from './plan';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const snapshot = await loadOrCreateMentorSnapshot(session.user.email);
    return res.status(200).json(snapshot);
  } catch (err) {
    console.error('[mentor/today-plan]', err.message);
    return res.status(500).json({ error: 'Could not load mentor plan.' });
  }
}
