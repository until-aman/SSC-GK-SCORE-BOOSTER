import { getTopicsBySubject, VALID_SUBJECTS } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, collection = 'general', includeCounts } = req.query;
    const wantCounts = includeCounts === 'true' || !subject;

    // Fetch topics for the requested subject (or all subjects)
    const topics = await getTopicsBySubject(subject || undefined, collection);

    // Only compute per-subject counts when explicitly requested or no subject filter.
    // Subject-specific requests skip this loop to avoid N redundant sheet reads.
    const subjectCounts = {};
    if (wantCounts) {
      for (const subj of VALID_SUBJECTS) {
        try {
          const subjectTopics = await getTopicsBySubject(subj, collection);
          const topicMap = subjectTopics[subj] || {};
          subjectCounts[subj] = Object.values(topicMap).reduce((sum, n) => sum + n, 0);
        } catch (_) {
          subjectCounts[subj] = 0;
        }
      }
    }

    return res.status(200).json({ topics, subjectCounts });
  } catch (err) {
    console.error('Topics API error:', err);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}
