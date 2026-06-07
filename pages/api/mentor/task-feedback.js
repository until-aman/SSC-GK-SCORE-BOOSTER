import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, appendTaskFeedback } from '@/lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const sheets = await getSheetsClient();
  await appendTaskFeedback(sheets, { email: session.user.email, ...req.body });
  return res.status(200).json({ success: true });
}
