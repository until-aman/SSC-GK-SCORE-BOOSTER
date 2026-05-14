import { getTopicsBySubject } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject } = req.query;
    const topics = await getTopicsBySubject(subject || undefined);
    return res.status(200).json(topics);
  } catch (err) {
    console.error('Topics API error:', err);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}
