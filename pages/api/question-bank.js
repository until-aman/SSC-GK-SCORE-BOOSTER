import { kv } from '@vercel/kv';
import { getQuestionsForSubject } from '@/lib/sheets';
import { getServerCache, setServerCache } from '@/lib/server/serverCache';

const KV_TTL_SECONDS = 4 * 60 * 60;
const MEM_TTL_MS = 4 * 60 * 60 * 1000;   // unchanged 4h server mem TTL
const MAX_MEM_ENTRIES = 100;             // unchanged bound
const TIMEOUT_MS = 10_000;

const KV_ENABLED = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
);

// Step 14: the bespoke in-memory Map is replaced by the shared bounded
// serverCache (same 4h TTL + 100-entry bound). KV behavior is unchanged.
function memGet(key) {
  const v = getServerCache(`qbank:${key}`);
  return v === undefined ? null : v;
}
function memSet(key, questions) {
  setServerCache(`qbank:${key}`, questions, MEM_TTL_MS, { maxEntries: MAX_MEM_ENTRIES });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function buildKey(collection, subject) {
  return `questionBank:${collection}:${subject}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { collection = 'general', subject } = req.query;
  if (!subject) {
    return res.status(400).json({ error: 'subject is required' });
  }

  const key = buildKey(collection, subject);
  const generatedAt = new Date().toISOString();

  const memHit = memGet(key);
  if (memHit) {
    return res.status(200).json({
      success: true,
      collection,
      subject,
      questions: memHit,
      count: memHit.length,
      generatedAt,
    });
  }

  if (KV_ENABLED) {
    try {
      const kvHit = await kv.get(key);
      if (kvHit && Array.isArray(kvHit)) {
        memSet(key, kvHit);
        return res.status(200).json({
          success: true,
          collection,
          subject,
          questions: kvHit,
          count: kvHit.length,
          generatedAt,
        });
      }
    } catch (kvErr) {
      console.warn('[question-bank] kv read error, falling through to Sheets:', kvErr.message);
    }
  }

  try {
    const questions = await withTimeout(
      getQuestionsForSubject(subject, collection),
      TIMEOUT_MS
    );

    if (questions.length > 0) {
      memSet(key, questions);

      if (KV_ENABLED) {
        kv.set(key, questions, { ex: KV_TTL_SECONDS }).catch(kvErr =>
          console.warn('[question-bank] kv write error:', kvErr.message)
        );
      }
    }

    return res.status(200).json({
      success: true,
      collection,
      subject,
      questions,
      count: questions.length,
      generatedAt,
    });
  } catch (err) {
    const isTimeout = err.message?.includes('timed out');
    console.error('[question-bank]', isTimeout ? 'TIMEOUT' : 'ERROR', err.message);
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Request timed out' : 'Failed to read data',
    });
  }
}
