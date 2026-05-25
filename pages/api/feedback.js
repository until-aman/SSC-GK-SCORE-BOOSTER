import { saveFeedback } from '@/lib/sheets';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    const feedbackPill = req.body.Feedback_pill ?? req.body.feedback_pill ?? req.body.feedbackPill ?? '';
    const feedbackMessage = String(
      req.body.Feedback_message ?? req.body.feedback_message ?? req.body.feedbackMessage ?? req.body.feedback ?? ''
    ).trim();

    if (feedbackMessage.length < 7) {
      return res.status(400).json({ error: 'Feedback message must be at least 7 characters' });
    }

    await saveFeedback({
      name: session?.user?.name,
      email: session?.user?.email,
      feedbackPill,
      feedbackMessage,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
}
