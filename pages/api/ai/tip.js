import { getSkippedTip } from '@/lib/gemini';
import { withApiTrace, markGemini } from '@/lib/apiDiagnostics';
import { buildAiDedupKey, dedupeAiRequest } from '@/lib/server/aiRequestDedup';

export default withApiTrace('/api/ai/tip', handler);
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, correctOption, correctOptionText, explanation, subject, topic } = req.body;

    markGemini();
    const key = buildAiDedupKey('tip', [question, correctOption]);
    const aiTip = await dedupeAiRequest(key, () => getSkippedTip({
      question, correctOption, correctOptionText, explanation, subject, topic,
    }));

    return res.status(200).json({ aiTip: aiTip || null });
  } catch (err) {
    console.error('AI Tip error:', err);
    return res.status(200).json({ aiTip: null });
  }
}
