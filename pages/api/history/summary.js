import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getHistorySummary } from '@/lib/historyRevamp';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const data = await getHistorySummary(session.user.email);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[history/summary]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load summary' });
  }
}
