import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, appendTaskFeedback, upsertStudentTopicState } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const sheets = await getSheetsClient();
  const now = new Date().toISOString();
  await appendTaskFeedback(sheets, {
    email: session.user.email,
    mentorActionSavedAt: now,
    ...req.body,
  });

  const subject = req.body?.subject || '';
  const topic = req.body?.topic || '';
  if (subject && topic) {
    await upsertStudentTopicState(sheets, session.user.email, {
      Subject: subject,
      Topic: topic,
      ConfidenceLevel: confidenceFromFeedback(req.body?.feedbackChip, req.body?.resultCategory),
      LastConfidenceUpdatedAt: now,
      MentorPriorityScore: priorityFromFeedback(req.body?.feedbackChip, req.body?.resultCategory),
    }).catch(() => {});
  }
  return res.status(200).json({ success: true });
}

function confidenceFromFeedback(chip, category) {
  const normalizedChip = String(chip || '').toLowerCase();
  const normalizedCategory = String(category || '').toUpperCase();
  if (normalizedChip === 'good' && ['EXCELLENT', 'GOOD'].includes(normalizedCategory)) return 'strong';
  if (normalizedChip === 'good') return 'okay';
  if (normalizedChip === 'forgot facts') return 'forgotten';
  if (normalizedChip === 'need revision' || normalizedChip === 'concept not clear' || normalizedChip === 'too difficult') return 'weak';
  if (normalizedCategory === 'LOW_CONFIDENCE') return 'forgotten';
  if (normalizedCategory === 'WEAK') return 'weak';
  return 'okay';
}

function priorityFromFeedback(chip, category) {
  const normalizedChip = String(chip || '').toLowerCase();
  const normalizedCategory = String(category || '').toUpperCase();
  if (normalizedCategory === 'WEAK' || normalizedChip === 'too difficult') return 35;
  if (normalizedCategory === 'LOW_CONFIDENCE' || normalizedChip === 'forgot facts') return 30;
  if (normalizedChip === 'need revision' || normalizedChip === 'concept not clear') return 25;
  return 10;
}
