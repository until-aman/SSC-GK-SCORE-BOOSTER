import { getPerformanceSummary } from '@/lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const {
    subject,
    topic,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    skipped,
    rawScore,
    accuracy,
  } = req.body || {};

  try {
    const summary = await getPerformanceSummary({
      subject,
      topic,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      skipped,
      rawScore,
      accuracy,
    });

    return res.status(200).json({ aiSummary: summary });
  } catch (error) {
    console.error('Error generating AI result insights:', error);
    return res.status(500).json({ message: 'Error generating AI analysis' });
  }
}
