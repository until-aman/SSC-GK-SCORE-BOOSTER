import { withApiTrace } from '@/lib/apiDiagnostics';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { persistScore } from '@/lib/server/scorePersistence';

// In-memory rate limit map — resets on cold start
const rateLimitMap = new Map();

function checkRateLimit(email) {
  const now = Date.now();
  const window = 60 * 1000;
  const entry = rateLimitMap.get(email);
  if (!entry || now - entry.windowStart > window) {
    rateLimitMap.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count += 1;
  return true;
}

export default withApiTrace('/api/score', handler);
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Compatibility route. The canonical completion flow now writes scores via
  // /api/quiz-session/complete; this remains only for any legacy caller.
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Deprecated API] /api/score called');
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = session.user.email;

  if (!checkRateLimit(email)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const result = await persistScore({ email, name: session.user.name, input: req.body });
    if (result.kind === 'validation') {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[score] Error:', err.message);
    if (err.code === 429 || (err.response && err.response.status === 429)) {
      console.error('[Sheets] Rate limit hit');
    }
    return res.status(500).json({ error: 'Failed to save score' });
  }
}
