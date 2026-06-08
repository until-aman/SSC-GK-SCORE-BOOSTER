import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient, getMentorProfile, upsertMentorProfile } from '@/lib/sheets';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });
  const email = session.user.email;

  if (req.method === 'GET') {
    try {
      const profile = await getMentorProfile(await getSheetsClient(), email);
      if (!profile) return res.status(200).json({ exists: false });
      return res.status(200).json({ exists: true, profile });
    } catch (err) {
      console.error('[mentor/profile GET]', err.message);
      return res.status(500).json({ error: 'Failed to load mentor profile' });
    }
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      await upsertMentorProfile(await getSheetsClient(), email, req.body);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[mentor/profile SAVE]', err.message);
      return res.status(500).json({ error: 'Failed to save mentor profile' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
