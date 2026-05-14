import { saveFeedback } from '@/lib/sheets';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    const { feedback, subject, topic } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    await saveFeedback({
      name: session?.user?.name,
      email: session?.user?.email,
      feedback,
      subject,
      topic
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
}
