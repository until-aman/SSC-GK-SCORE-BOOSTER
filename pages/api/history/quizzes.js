import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserSessions } from '@/lib/historyData';

function applyFilters(sessions, query) {
  let filtered = [...sessions];
  if (query.dateRange === '7d' || query.dateRange === '30d') {
    const days = query.dateRange === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered = filtered.filter(item => new Date(item.completedAt || 0).getTime() >= cutoff);
  }
  if (query.status === 'weak') filtered = filtered.filter(item => item.accuracy < 50);
  if (query.answerType === 'wrong_skipped') filtered = filtered.filter(item => item.incorrect > 0 || item.skipped > 0);
  if (query.quizMode) filtered = filtered.filter(item => String(item.quizMode || '').toLowerCase() === String(query.quizMode).toLowerCase());
  return filtered;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(25, Math.max(1, Number(req.query.limit) || 10));
    const sessions = applyFilters(await getUserSessions(session.user.email), req.query);
    const start = (page - 1) * limit;
    const paged = sessions.slice(start, start + limit);

    return res.status(200).json({
      success: true,
      data: {
        sessions: paged,
        total: sessions.length,
        page,
        hasMore: start + limit < sessions.length,
        filterSummary: {
          quizCount: sessions.length,
          totalWrongSkipped: sessions.reduce((sum, item) => sum + item.incorrect + item.skipped, 0),
        },
      },
    });
  } catch (err) {
    console.error('[history/quizzes]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load quizzes' });
  }
}
