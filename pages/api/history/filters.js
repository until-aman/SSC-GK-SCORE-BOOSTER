import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserSessions } from '@/lib/historyData';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const sessions = await getUserSessions(session.user.email);
    const map = new Map();
    sessions.forEach(item => {
      const key = `${item.subject}|||${item.topic}`;
      const existing = map.get(key) || { subject: item.subject, topic: item.topic, quizCount: 0 };
      existing.quizCount += 1;
      map.set(key, existing);
    });
    return res.status(200).json({ success: true, data: { filters: [...map.values()] } });
  } catch (err) {
    console.error('[history/filters]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load filters' });
  }
}
