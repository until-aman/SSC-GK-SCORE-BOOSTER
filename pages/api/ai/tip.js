import { getSkippedTip } from '@/lib/gemini';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, correctOption, correctOptionText, explanation, subject, topic } = req.body;

    const aiTip = await getSkippedTip({
      question, correctOption, correctOptionText, explanation, subject, topic,
    });

    return res.status(200).json({ aiTip: aiTip || null });
  } catch (err) {
    console.error('AI Tip error:', err);
    return res.status(200).json({ aiTip: null });
  }
}
