import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, getMasterTopics } from '@/lib/sheets';

function normalizeSubjectId(subjectId) {
  return String(subjectId || '').replace(/^Q_PYQ_/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await getMasterTopics(await getSheetsClient());

  // Group by SubjectId
  const subjects = {};
  for (const row of rows) {
    const subjectId = normalizeSubjectId(row.SubjectId);
    if (!subjects[subjectId]) {
      subjects[subjectId] = {
        subjectName: row.SubjectName,
        displayOrder: parseInt(row.DisplayOrder) || 99,
        topics: [],
      };
    }
    subjects[subjectId].topics.push({
      topicId: row.TopicId,
      topicName: row.TopicName,
      displayName: row.DisplayName || row.TopicName,
      displayOrder: parseInt(row.DisplayOrder) || 99,
      questionCount: parseInt(row.QuestionCount) || 0,
      sscWeightage: row.SSCWeightage || 'Medium',
    });
  }

  // Sort topics within each subject
  for (const subjectId of Object.keys(subjects)) {
    subjects[subjectId].topics.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return res.status(200).json({ subjects });
}
