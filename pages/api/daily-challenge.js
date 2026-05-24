import { getMixedQuestions, writeDailyChallengeRows } from '@/lib/sheets';

const CHALLENGE_SIZE = 25;
const XP_REWARD = 50;

function getISTDateString() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
}

// Deterministic seed from date string (e.g. "2026-05-24")
function seedFromDate(dateStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Mulberry32 seeded PRNG — same seed always produces same sequence
function makePRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// In-memory cache so we only call getMixedQuestions once per day per process
const dailyCache = {};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const today = getISTDateString();
    const challengeId = `DC_${today.replace(/-/g, '_')}`;

    if (!dailyCache[today]) {
      const allQuestions = await getMixedQuestions('PYQ');
      if (!allQuestions.length) return res.status(503).json({ error: 'No questions available' });

      const rand = makePRNG(seedFromDate(today));
      // Sort by ID first so the input is always in the same order regardless of
      // how getMixedQuestions shuffled internally — seeded shuffle then gives
      // the same 25 every time for the same date.
      const sorted = [...allQuestions].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const selected = seededShuffle(sorted, rand).slice(0, CHALLENGE_SIZE);
      dailyCache[today] = selected;

      // Write to sheet for audit log — fire-and-forget, does not affect response
      const createdAt = new Date().toISOString();
      writeDailyChallengeRows(
        selected.map((q, i) => [today, challengeId, q.id, i + 1, XP_REWARD, 'Active', createdAt])
      ).catch(() => {});
    }

    const questions = dailyCache[today];

    return res.status(200).json({
      challengeId,
      date: today,
      questions,
      totalQuestions: questions.length,
      xpReward: XP_REWARD,
    });

  } catch (err) {
    console.error('[daily-challenge]', err.message);
    return res.status(500).json({ error: 'Failed to load daily challenge' });
  }
}
