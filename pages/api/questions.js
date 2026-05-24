import { getQuestions } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, topic, collection = 'general' } = req.query;
    if (!subject || !topic) {
      return res.status(400).json({ error: 'subject and topic are required' });
    }

    const questions = await getQuestions(subject, topic, collection);
    return res.status(200).json({ questions });
  } catch (err) {
    console.error('Questions API error:', err);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}
