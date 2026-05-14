import { explainWrongAnswer } from '@/lib/gemini';

export default async function handler(req, res) {
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
    const aiExplanation = await explainWrongAnswer({
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
    });

    return res.status(200).json({ aiExplanation: aiExplanation || null });
  } catch (error) {
    console.error('AI Explain error:', error);
    return res.status(500).json({ error: 'Error generating AI explanation' });
  }
}
