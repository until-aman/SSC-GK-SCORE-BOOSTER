import { getAppConfig, getPublicConfig } from '@/lib/config/appConfig';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 14: no frontend caller (verified). Kept; returns ONLY allowlisted
  // public fields via getPublicConfig (no Sheet IDs/keys/secrets). Removal candidate.
  if (process.env.NODE_ENV !== 'production') console.debug('[apidiag] {"kind":"public-cache","event":"config-route-deprecated"}');

  try {
    const config = await getAppConfig();
    return res.status(200).json({ success: true, config: getPublicConfig(config) });
  } catch (err) {
    console.error('[api/config] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load config' });
  }
}
