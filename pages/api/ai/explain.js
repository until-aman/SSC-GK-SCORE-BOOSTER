import { explainWrongAnswer } from '@/lib/gemini';
import { withApiTrace, markGemini } from '@/lib/apiDiagnostics';
import { buildAiDedupKey, dedupeAiRequest } from '@/lib/server/aiRequestDedup';

export default withApiTrace('/api/ai/explain', handler);
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    userOption,
    explanation,
    subject,
    topic,
  } = req.body;

  try {
    markGemini();
    // Dedup identical concurrent computations (same question + correct + selected).
    const key = buildAiDedupKey('explain', [question, correctOption, userOption]);
    const aiExplanation = await dedupeAiRequest(key, () => explainWrongAnswer({
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      userOption,
      explanation,
      subject,
      topic,
    }));

    return res.status(200).json({ aiExplanation: aiExplanation || null });
  } catch (error) {
    console.error('AI Explain error:', error);
    return res.status(500).json({ error: 'Error generating AI explanation' });
  }
}
