import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserAttemptAnswers } from '@/lib/historyData';
import { buildSubjectRows } from '@/lib/server/historyService';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const attempts = await getUserAttemptAnswers(session.user.email);
    const subjects = buildSubjectRows(attempts);
    return res.status(200).json({ success: true, data: { subjects } });
  } catch (err) {
    console.error('[history/subjects]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load subjects' });
  }
}
