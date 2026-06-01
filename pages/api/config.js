import { getAppConfig, getPublicConfig } from '@/lib/config/appConfig';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = await getAppConfig();
    return res.status(200).json({ success: true, config: getPublicConfig(config) });
  } catch (err) {
    console.error('[api/config] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load config' });
  }
}
