import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getUserAttemptAnswers } from '@/lib/historyData';
import { aggregateAttempts } from '@/lib/historyRevamp';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const subject = String(req.query.subject || '').trim();
  if (!subject) return res.status(400).json({ success: false, error: 'subject is required' });

  try {
    const attempts = (await getUserAttemptAnswers(session.user.email)).filter(item => item.subject === subject);
    const topics = aggregateAttempts(attempts, 'topic').map(item => ({
      topic: item.topic,
      subject,
      questionCount: item.questionCount,
      correctCount: item.correctCount,
      wrongCount: item.wrongCount,
      skippedCount: item.skippedCount,
      accuracy: item.accuracy,
      lastPracticedAt: item.lastPracticedAt,
      statusLabel: item.statusLabel,
      statusTone: item.statusTone,
      hasMistakes: item.hasMistakes,
    }));
    return res.status(200).json({ success: true, data: { subject, topics } });
  } catch (err) {
    console.error('[history/topics]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load topics' });
  }
}
