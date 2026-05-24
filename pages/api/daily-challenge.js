import { getDailyChallengeEntry, getMixedQuestions, writeDailyChallengeEntry } from '@/lib/sheets';

const CHALLENGE_SIZE = 25;
const XP_REWARD = 50;

function getISTDateString() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
}

function seedFromDate(dateStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

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

const dailyCache = {};
const dailyMetaCache = {};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const today = getISTDateString();
    const challengeId = `DC_${today.replace(/-/g, '_')}`;

    if (!dailyCache[today]) {
      const allQuestions = await getMixedQuestions('PYQ');
      if (!allQuestions.length) return res.status(503).json({ error: 'No questions available' });

      const questionById = new Map(allQuestions.map(q => [String(q.id), q]));
      const savedChallenge = await getDailyChallengeEntry(today);

      if (savedChallenge?.questionIds?.length) {
        const savedQuestions = savedChallenge.questionIds
          .map(id => questionById.get(String(id)))
          .filter(Boolean)
          .slice(0, Math.min(savedChallenge.totalQuestions || CHALLENGE_SIZE, CHALLENGE_SIZE));

        if (savedQuestions.length) {
          dailyCache[today] = savedQuestions;
          dailyMetaCache[today] = {
            challengeId: savedChallenge.challengeId || challengeId,
            xpReward: savedChallenge.xpReward || XP_REWARD,
          };
        }
      }

      if (!dailyCache[today]) {
        const rand = makePRNG(seedFromDate(today));
        const sorted = [...allQuestions].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const selected = seededShuffle(sorted, rand).slice(0, CHALLENGE_SIZE);
        dailyCache[today] = selected;
        dailyMetaCache[today] = { challengeId, xpReward: XP_REWARD };

        writeDailyChallengeEntry({
          date: today,
          challengeId,
          questionIds: selected.map(q => q.id),
          totalQuestions: selected.length,
          xpReward: XP_REWARD,
          status: 'Active',
        }).catch(() => {});
      }
    }

    const questions = dailyCache[today].slice(0, CHALLENGE_SIZE);
    const meta = dailyMetaCache[today] || { challengeId, xpReward: XP_REWARD };

    return res.status(200).json({
      challengeId: meta.challengeId,
      date: today,
      questions,
      totalQuestions: questions.length,
      xpReward: meta.xpReward,
    });
  } catch (err) {
    console.error('[daily-challenge]', err.message);
    return res.status(500).json({ error: 'Failed to load daily challenge' });
  }
}
