import { kv } from '@vercel/kv';
import { getQuestions } from '@/lib/sheets';

// ─── Cache config ─────────────────────────────────────────────────────────────
//
// Two-layer caching strategy:
//
//  Layer 1 — Vercel KV (Redis, shared across ALL instances)
//    • Active when KV_REST_API_URL + KV_REST_API_TOKEN env vars are set
//    • 1000 users = 1 Sheets call total, everyone else hits Redis
//    • TTL: 4 hours (questions change every few months, not daily)
//
//  Layer 2 — In-memory Map (per serverless instance, fallback)
//    • Always active as a local hot cache
//    • If KV is not connected yet, this is the only layer
//    • Survives repeated requests to the same warm instance

const KV_TTL_SECONDS    = 4 * 60 * 60;   // 4 hours in Redis
const MEM_TTL_MS        = 4 * 60 * 60 * 1000;
const MAX_MEM_ENTRIES   = 200;
const TIMEOUT_MS        = 10_000;

// Check at startup whether KV env vars are wired up
const KV_ENABLED = !!(
  process.env.KV_REST_API_URL &&
  process.env.KV_REST_API_TOKEN
);

// ─── In-memory fallback cache ─────────────────────────────────────────────────
const memCache = new Map(); // key → { questions: [], cachedAt: number }

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > MEM_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return entry.questions;
}

function memSet(key, questions) {
  if (memCache.size >= MAX_MEM_ENTRIES) {
    memCache.delete(memCache.keys().next().value); // evict oldest
  }
  memCache.set(key, { questions, cachedAt: Date.now() });
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Cache key ────────────────────────────────────────────────────────────────
function buildKey(collection, subject, topic) {
  return `questions:${collection}:${subject}:${topic}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subject, topic, collection = 'general' } = req.query;
  if (!subject || !topic) {
    return res.status(400).json({ error: 'subject and topic are required' });
  }

  const key = buildKey(collection, subject, topic);

  // ── Layer 1: in-memory (fastest, no network) ──────────────────────────────
  const memHit = memGet(key);
  if (memHit) {
    console.log(`[questions] mem-hit  ${key} (${memHit.length}q)`);
    return res.status(200).json({ questions: memHit });
  }

  // ── Layer 2: Vercel KV (shared Redis, if connected) ───────────────────────
  if (KV_ENABLED) {
    try {
      const kvHit = await kv.get(key);
      if (kvHit && Array.isArray(kvHit)) {
        console.log(`[questions] kv-hit   ${key} (${kvHit.length}q)`);
        memSet(key, kvHit); // warm local memory for this instance too
        return res.status(200).json({ questions: kvHit });
      }
    } catch (kvErr) {
      // KV read failed — log and continue to Sheets. Never block the user.
      console.warn('[questions] kv read error, falling through to Sheets:', kvErr.message);
    }
  }

  // ── Layer 3: Google Sheets (source of truth) ──────────────────────────────
  try {
    console.log(`[questions] sheets   ${key}`);
    const questions = await withTimeout(
      getQuestions(subject, topic, collection),
      TIMEOUT_MS
    );

    if (questions.length > 0) {
      // Write to both caches so next request is fast
      memSet(key, questions);

      if (KV_ENABLED) {
        kv.set(key, questions, { ex: KV_TTL_SECONDS }).catch(kvErr =>
          console.warn('[questions] kv write error:', kvErr.message)
        ); // fire-and-forget — don't delay the response
      }
    }

    return res.status(200).json({ questions });
  } catch (err) {
    const isTimeout = err.message?.includes('timed out');
    console.error('[questions]', isTimeout ? 'TIMEOUT' : 'ERROR', err.message);
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Request timed out' : 'Failed to read data',
    });
  }
}
