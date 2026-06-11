import { getPerformanceSummary } from '@/lib/gemini';
import { withApiTrace, markGemini } from '@/lib/apiDiagnostics';
import { buildAiDedupKey, dedupeAiRequest } from '@/lib/server/aiRequestDedup';

export default withApiTrace('/api/ai/result-insights', handler);
async function handler(req, res) {
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
    markGemini();
    const key = buildAiDedupKey('result-insights', [subject, topic, totalQuestions, correctAnswers, incorrectAnswers, skipped, rawScore, accuracy]);
    const summary = await dedupeAiRequest(key, () => getPerformanceSummary({
      subject,
      topic,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      skipped,
      rawScore,
      accuracy,
    }));

    return res.status(200).json({ aiSummary: summary });
  } catch (error) {
    console.error('Error generating AI result insights:', error);
    return res.status(500).json({ message: 'Error generating AI analysis' });
  }
}
