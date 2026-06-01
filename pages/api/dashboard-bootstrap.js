import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import {
  getUserRows,
  findUserRow,
  parseUserRow,
  getTopicsBySubject,
  VALID_SUBJECTS,
  COLLECTION_PREFIX,
  getLeaderboardCacheRow,
} from '@/lib/sheets';

// Only collections that have active question data in the sheet.
const BOOTSTRAP_COLLECTIONS = ['PYQ', 'Parmar'];

// ─── Section helpers ─────────────────────────────────────────────────────────

/** Returns a profile object for the session user, or null for guests. */
async function fetchProfile(session) {
  if (!session?.user?.email) return null;
  const rows = await getUserRows();
  const userRow = findUserRow(rows, session.user.email);
  if (!userRow) return null;
  const user = parseUserRow(userRow);
  return {
    email:           user.email,
    name:            user.name,
    totalCoins:      user.totalCoins,
    level:           user.level,
    streakCount:     user.streakCount,
    lastAttemptDate: user.lastAttemptDate,
    createdAt:       user.createdAt,
    image:           user.image,
  };
}

/** Reads the cached weekly top-10 from the LeaderboardCache sheet tab. */
async function fetchLeaderboard() {
  const cacheRow = await getLeaderboardCacheRow();
  let weeklyTop = [];
  try {
    const parsed = JSON.parse(cacheRow.weeklyJSON || '[]');
    weeklyTop = Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch { /* malformed JSON — return empty list */ }
  return { weeklyTop };
}

/**
 * Counts total questions and per-subject breakdown for a single collection.
 * Returns { totalQuestions: 0, subjectCounts: {} } for unknown collections
 * instead of letting getTopicsBySubject fall back to the 'general' prefix.
 */
async function fetchCollectionCounts(collection) {
  // Guard: only fetch collections that have a known sheet prefix.
  // Unknown collections (e.g. CGL2025 after removal) return empty counts.
  if (!Object.prototype.hasOwnProperty.call(COLLECTION_PREFIX, collection)) {
    return { totalQuestions: 0, subjectCounts: {} };
  }

  // getTopicsBySubject(undefined, collection) iterates all VALID_SUBJECTS internally.
  const topicsBySubject = await getTopicsBySubject(undefined, collection);

  const subjectCounts = {};
  for (const subject of VALID_SUBJECTS) {
    const topicMap = topicsBySubject[subject] || {};
    subjectCounts[subject] = Object.values(topicMap).reduce((sum, n) => sum + n, 0);
  }
  const totalQuestions = Object.values(subjectCounts).reduce((sum, n) => sum + n, 0);
  return { totalQuestions, subjectCounts };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const generatedAt = new Date().toISOString();
  const errors = [];

  // ── Session (optional — guests get profile: null) ──────────────────
  let session = null;
  try {
    session = await getServerSession(req, res, authOptions);
  } catch (err) {
    errors.push({ section: 'session', message: err.message });
  }

  // ── Profile ────────────────────────────────────────────────────────
  let profile = null;
  try {
    profile = await fetchProfile(session);
  } catch (err) {
    console.error('[dashboard-bootstrap] profile error:', err.message);
    errors.push({ section: 'profile', message: err.message });
  }

  // ── Leaderboard ────────────────────────────────────────────────────
  let leaderboard = { weeklyTop: [] };
  try {
    leaderboard = await fetchLeaderboard();
  } catch (err) {
    console.error('[dashboard-bootstrap] leaderboard error:', err.message);
    errors.push({ section: 'leaderboard', message: err.message });
  }

  // ── Collections — fetch all in parallel, isolate each failure ──────
  const collections = {};
  await Promise.all(
    BOOTSTRAP_COLLECTIONS.map(async (col) => {
      try {
        collections[col] = await fetchCollectionCounts(col);
      } catch (err) {
        console.error(`[dashboard-bootstrap] collections.${col} error:`, err.message);
        errors.push({ section: `collections.${col}`, message: err.message });
        collections[col] = { totalQuestions: 0, subjectCounts: {} };
      }
    })
  );

  // Prevent browser from aggressively caching — localStorage handles client-side caching.
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    success: true,
    generatedAt,
    profile,
    leaderboard,
    collections,
    errors,
  });
}
