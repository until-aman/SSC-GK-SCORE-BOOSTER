import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { buildHistoryLanding } from '@/lib/server/historyService';

// Step 9: single landing source for pages/history/quizzes.jsx. Combines the
// logic of /api/history/summary + /api/history/quizzes (page 1) +
// /api/history/subjects into ONE response so the landing screen makes one GET.
// Those three routes are unchanged and still serve filtered/paged/other callers.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const data = await buildHistoryLanding(session.user.email);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[history/landing]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load history' });
  }
}
