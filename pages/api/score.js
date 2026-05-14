import { appendScore } from '@/lib/sheets';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  // Scoring is only for logged-in users according to logic in quiz.js
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { correctAnswers, incorrectAnswers, skipped, totalQuestions, rawScore, subject, topic } = req.body;

  try {
    await appendScore({
      timestamp: new Date().toISOString(),
      email: session.user.email,
      name: session.user.name,
      image: session.user.image || '',
      correctAnswers,
      incorrectAnswers,
      skipped,
      totalQuestions,
      rawScore,
      subject,
      topic,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving score:', error);
    return res.status(500).json({ message: 'Error saving score' });
  }
}
