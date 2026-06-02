import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getQuestionResults } from '@/lib/historyRevamp';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const data = await getQuestionResults(session.user.email, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[history/questions]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load questions' });
  }
}
