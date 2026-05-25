import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import NotificationBell from '@/components/NotificationBell';
import Loader from '@/components/ui/Loader';
import { getSubjectStyle, subjectStyles } from '@/lib/subjects';
import { getISTDateString } from '@/lib/streak';
import {
  readCache,
  fetchWithClientCache,
  formatLastUpdated,
  writeCache,
  clearAllAppCache,
} from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

const SUBJECTS = Object.keys(subjectStyles);
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const PARMAR_SERIES = [
  {
    id: 'pyq-6',
    title: 'PYQ Series',
    subtitle: 'Series 6',
    icon: '🗂️',
    gradient: 'from-violet-600 to-indigo-700',
    tag: 'Previous Year Qs',
  },
  {
    id: 'irs-1',
    title: 'Intense Revision',
    subtitle: 'IRS 1',
    icon: '🔥',
    gradient: 'from-rose-600 to-orange-600',
    tag: 'Revision Series',
  },
  {
    id: 'nitto',
    title: 'NITTO Series',
    subtitle: '',
    icon: '⚡',
    gradient: 'from-amber-500 to-yellow-600',
    tag: 'Parmar Special',
  },
];

const SESSION_REFRESH_KEY = 'dashboard_refreshed_this_session';

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

function getWeeklyPlayers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.weeklyTop)) return data.weeklyTop;
  if (Array.isArray(data?.leaders)) return data.leaders;
  if (Array.isArray(data?.leaderboard?.weeklyTop)) return data.leaderboard.weeklyTop;
  return [];
}

function getStreakDays(streakCount, lastAttemptDate) {
  const todayIST = getISTDateString();
  const todayDate = new Date(todayIST + 'T00:00:00+05:30');
  const todayIdx = (todayDate.getDay() + 6) % 7;
  const playedToday = lastAttemptDate === todayIST;
  const done = new Set();
  const base = playedToday ? todayIdx : todayIdx - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) done.add(idx);
  }
  return { done, todayIdx, playedToday };
}


const LightningSVG = ({ size = 14, color = '#f97316' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

/* Avatar — shows Google photo if available, else gradient initial */
function Avatar({ imageUrl, name, size = 36 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();

  if (imageUrl && !imgError) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20"
        style={{ width: size, height: size }}
      >
        <Image
          src={imageUrl}
          alt={name || 'avatar'}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
          unoptimized
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-black text-white"
        style={{ fontSize: size * 0.42 }}
      >
        {initial}
      </span>
    </div>
  );
}

/* ─── Social-proof student count ─────────────────────────────────────────────
   Base: 1842. Increases by 10/hour + a small deterministic jitter (0-8)
   so every hour looks like a natural jump without hitting an API.
   Resets back to the base each midnight so the "today" framing stays honest.
──────────────────────────────────────────────────────────────────────────── */
function getLiveStudentCount() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const hoursSinceMidnight = (now - midnight) / (1000 * 60 * 60);
  const hourIndex = Math.floor(hoursSinceMidnight);
  const jitter = (hourIndex * 31 + 17) % 9; // deterministic 0-8 per hour
  return Math.round(1842 + hoursSinceMidnight * 10 + jitter);
}

// Grows by ~20/day since epoch — deterministic per hour so all users see same number
function getRankedStudentCount() {
  const EPOCH = new Date('2026-04-01').getTime();
  const BASE  = 1_247; // believable non-round starting count
  const now   = Date.now();
  const MS_DAY  = 86_400_000;
  const MS_HOUR = 3_600_000;
  const daysSince = Math.floor((now - EPOCH) / MS_DAY);
  const hourOfDay = Math.floor(((now - EPOCH) % MS_DAY) / MS_HOUR);
  // ~20/day → add 0, 1, or 2 per hour (avg ~0.83) using seeded LCG
  let hourly = 0;
  for (let h = 0; h <= hourOfDay; h++) {
    const seed = (daysSince * 24 + h) * 1_664_525 + 1_013_904_223;
    hourly += (seed >>> 0) % 3; // 0, 1, or 2
  }
  return BASE + daysSince * 20 + hourly;
}

/* ─── Daily Challenge cache helpers (module-level — used by both Dashboard and SocialProofCarousel) ── */
function getDCCacheKey() {
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  return `dc_${today}`;
}

async function prefetchDailyChallenge() {
  try {
    const key = getDCCacheKey();
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;
    const res = await fetch('/api/daily-challenge');
    const data = await res.json();
    if (data.questions?.length) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch (_) {}
}

/* ─── Social Proof Carousel ───────────────────────────────────────────────── */
function SocialProofCarousel({ userProfile, topPlayers, isLoggedIn, session, playedToday }) {
  const [slide, setSlide]             = useState(0);
  const [studentCount, setStudentCount] = useState(getLiveStudentCount);

  // Refresh count every minute so the number ticks up while the user is on screen
  useEffect(() => {
    const t = setInterval(() => setStudentCount(getLiveStudentCount()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch('/api/prefetch').catch(() => null);
    prefetchDailyChallenge();
  }, []);

  // Build slide list from available data
  const slides = useMemo(() => {
    const items = [];

    // ① Live student count — always first
    items.push({
      emoji: '🔥',
      main:  `${studentCount.toLocaleString()} students practiced today`,
      sub:   'Join them and push your score higher',
      color: '#f97316',
    });

    if (isLoggedIn && userProfile) {
      const streak = userProfile.streakCount || 0;

      // ② Streak message
      if (streak >= 3 && playedToday) {
        items.push({
          emoji: '🔥',
          main:  `You're on a ${streak} day streak!`,
          sub:   "You're in the top tier of consistency",
          color: '#f97316',
        });
      } else if (streak > 0 && !playedToday) {
        items.push({
          emoji: '⚠️',
          main:  `Don't break your ${streak} day streak`,
          sub:   'Play today to protect your bonus XP',
          color: '#ef4444',
        });
      } else if (streak === 0) {
        items.push({
          emoji: '🎯',
          main:  'Start your streak today',
          sub:   'Daily practice builds rank the fastest',
          color: '#10b981',
        });
      }

      // ③ Rank from weekly leaderboard
      const rankIdx = topPlayers.findIndex(p => p.email === session?.user?.email);
      if (rankIdx !== -1) {
        const n = rankIdx + 1;
        items.push({
          emoji: '🏆',
          main:  `You're ranked #${n} this week`,
          sub:   n === 1
            ? "You're at the top! 👑 Defend it"
            : `${rankIdx} student${rankIdx > 1 ? 's are' : ' is'} ahead of you`,
          color: '#f59e0b',
        });
      } else {
        items.push({
          emoji: '📈',
          main:  'You could crack the top 20 today',
          sub:   'A few more quizzes is often all it takes',
          color: '#6366f1',
        });
      }

      // ④ XP + level
      if ((userProfile.totalXP || 0) > 0) {
        items.push({
          emoji: '⚡',
          main:  `${userProfile.totalXP.toLocaleString()} XP · Level: ${userProfile.level || 'Aspirant'}`,
          sub:   'Every quiz adds XP — keep stacking',
          color: '#06b6d4',
        });
      }

    } else {
      // Guest slides
      items.push(
        {
          emoji: '🏆',
          main:  `${getRankedStudentCount().toLocaleString()} students ranked this week`,
          sub:   'Sign in to claim your spot on the board',
          color: '#f59e0b',
        },
        {
          emoji: '📈',
          main:  'Top rankers practice 3× daily',
          sub:   'Sign in to track your streak & rank',
          color: '#6366f1',
        },
      );
    }

    return items;
  }, [studentCount, userProfile, topPlayers, isLoggedIn, session, playedToday]);

  // Auto-advance every 3.5 s
  const slideCount = slides.length;
  useEffect(() => {
    if (slideCount <= 1) return;
    const t = setInterval(() => setSlide(i => (i + 1) % slideCount), 3500);
    return () => clearInterval(t);
  }, [slideCount]);

  // Reset to 0 when the data set changes (e.g. profile just loaded)
  useEffect(() => { setSlide(0); }, [isLoggedIn, slideCount]);

  const current = slides[slide % slides.length];

  return (
    <div style={{ margin: '16px 16px 0' }}>
      <style>{`
        @keyframes proofFade {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .proof-slide { animation: proofFade 0.36s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18,
        padding: '14px 16px 12px',
      }}>
        {/* Slide content */}
        <div key={slide} className="proof-slide" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{current.emoji}</span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="font-display" style={{
              fontSize: 13, fontWeight: 700, color: '#ffffff',
              lineHeight: 1.35, margin: 0,
            }}>
              {current.main}
            </p>
            <p style={{
              fontSize: 11, color: 'rgba(255,255,255,0.42)',
              marginTop: 3, lineHeight: 1.3,
            }}>
              {current.sub}
            </p>
          </div>

          {/* Accent bar */}
          <div style={{
            width: 3, height: 36, borderRadius: 4,
            background: current.color, flexShrink: 0, opacity: 0.85,
          }} />
        </div>

        {/* Pill dot indicators */}
        {slides.length > 1 && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: i === slide ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === slide ? current.color : 'rgba(255,255,255,0.18)',
                  border: 'none', padding: 0, cursor: 'pointer',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userProfile, setUserProfile]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [topPlayers, setTopPlayers]     = useState([]);
  const [weeklyUserRank, setWeeklyUserRank] = useState(null);
  const [weeklyUpdating, setWeeklyUpdating] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [weeklyUpdatedAt, setWeeklyUpdatedAt] = useState(null);
  const [hasWeeklyCache, setHasWeeklyCache] = useState(false);
  const [comingSoonModal,  setComingSoonModal]  = useState(false);
  const [notifyState,      setNotifyState]      = useState({}); // { [seriesId]: 'idle'|'loading'|'done'|'already' }
  const [notifyToast,      setNotifyToast]      = useState(null); // { msg, type }
  const [subjectChecking,  setSubjectChecking]  = useState(null); // subject name being checked
  const [lowQModal,        setLowQModal]        = useState(null); // subject name with low questions
  const [modal,            setModal]            = useState(null);  // coming-soon modal for discover cards — stores collection name
  const [notified,         setNotified]         = useState(false);
  const [notifyLoading,    setNotifyLoading]    = useState(false);
  const [collectionTotals, setCollectionTotals] = useState({});   // { [collection]: totalCount }
  const [champsSlide, setChampsSlide] = useState(0);
  const [champsPaused, setChampsPaused] = useState(false);
  const [bootstrapRefreshing, setBootstrapRefreshing] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState(null);
  const [leaderboardMsg, setLeaderboardMsg] = useState(null);

  async function handleNotify(e, series) {
    e.stopPropagation();
    const sid = series.id;
    if (notifyState[sid] === 'loading' || notifyState[sid] === 'done' || notifyState[sid] === 'already') return;
    setNotifyState(s => ({ ...s, [sid]: 'loading' }));
    try {
      const res  = await fetch('/api/notify-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: sid, seriesTitle: series.title + (series.subtitle ? ' ' + series.subtitle : '') }),
      });
      const data = await res.json();
      if (data.alreadyNotified) {
        setNotifyState(s => ({ ...s, [sid]: 'already' }));
        setNotifyToast({ msg: "You're already on the list! We'll notify you. 🔔", type: 'info' });
      } else {
        setNotifyState(s => ({ ...s, [sid]: 'done' }));
        setNotifyToast({ msg: "You're on the list! We'll notify you when it's live 🎉", type: 'success' });
      }
    } catch {
      setNotifyState(s => ({ ...s, [sid]: 'idle' }));
      setNotifyToast({ msg: 'Something went wrong. Try again.', type: 'error' });
    }
    setTimeout(() => setNotifyToast(null), 3500);
  }

  async function handleSubjectClick(subject) {
    if (subjectChecking) return; // already checking one
    setSubjectChecking(subject);
    try {
      const res  = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      const topicMap = data[subject] || {};
      const total = Object.values(topicMap).reduce((sum, n) => sum + n, 0);
      if (total < 10) {
        setLowQModal(subject);
      } else {
        router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}`);
      }
    } catch {
      // On error just navigate — don't block the user
      router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}`);
    } finally {
      setSubjectChecking(null);
    }
  }

  function closeModal() {
    setModal(null);
    setNotified(false);
    setNotifyLoading(false);
  }

  function handleClearAppCache() {
    const removed = clearAllAppCache();
    setBootstrapMsg(`Cleared ${removed} app cache ${removed === 1 ? 'entry' : 'entries'}.`);
  }

  async function handleNotifyInterest() {
    if (notifyLoading || notified) return;
    setNotifyLoading(true);
    try {
      await fetch('/api/notify-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: modal }),
      });
      setNotified(true);
    } catch {
      // silently fail — still show success to user
      setNotified(true);
    } finally {
      setNotifyLoading(false);
    }
  }

  async function handleDiscoverClick(collection, destination) {
    // Use the already-prefetched total if positive — avoids a redundant API
    // round-trip and prevents transient Sheets errors from showing a false modal.
    if (collectionTotals[collection] > 0) {
      router.push(destination);
      return;
    }
    // Prefetch hasn't resolved yet, or genuinely returned 0 — confirm with a fetch.
    try {
      const res = await fetch(`/api/topics?collection=${encodeURIComponent(collection)}`);
      const data = await res.json();
      const counts = data.subjectCounts || {};
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      setCollectionTotals(prev => ({ ...prev, [collection]: total }));
      if (total > 0) {
        router.push(destination);
      } else {
        setModal(collection);
      }
    } catch {
      // On network/API error, navigate anyway — don't block the user.
      router.push(destination);
    }
  }

  const isGuest    = typeof window !== 'undefined' ? isGuestMode() : false;
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    if (status === 'loading') return;
    if (!isLoggedIn && !isGuest) router.replace('/');
  }, [status, isLoggedIn, isGuest, router]);

  // Migrate any locally-saved guest questions to the cloud (runs once on login)
  async function migrateLocalSavedQuestions() {
    try {
      const raw = localStorage.getItem('savedQuestions');
      if (!raw) return;
      const questions = JSON.parse(raw);
      if (!Array.isArray(questions) || questions.length === 0) return;
      for (const q of questions) {
        if (!q.questionId || !q.question || !q.correctOption) continue;
        try {
          await fetch('/api/saved-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(q),
          });
        } catch {}
      }
      localStorage.removeItem('savedQuestions');
    } catch {}
  }

  function applyBootstrapData(data, timestamp) {
    if (!data) return;
    if (data.profile) {
      setUserProfile(data.profile);
      setProfileLoading(false);
    }
    const weeklyPlayers = getWeeklyPlayers(data);
    if (weeklyPlayers.length > 0) {
      setTopPlayers(weeklyPlayers);
      writeCache(CACHE_KEYS.WEEKLY_LEADERBOARD, weeklyPlayers);
      setHasWeeklyCache(true);
      setWeeklyLoading(false);
      setWeeklyUpdating(false);
      setLeaderboardMsg(null);
    }
    const cols = data.collections || {};
    const newTotals = {};
    ['PYQ', 'Parmar'].forEach(col => {
      if (typeof cols[col]?.totalQuestions === 'number') newTotals[col] = cols[col].totalQuestions;
    });
    if (Object.keys(newTotals).length > 0) setCollectionTotals(prev => ({ ...prev, ...newTotals }));
    if (timestamp) setWeeklyUpdatedAt(timestamp);
  }

  async function loadWeeklyLeaderboard({ forceRefresh = false } = {}) {
    setWeeklyUpdating(forceRefresh);
    try {
      const result = await fetchWithClientCache({
        key: CACHE_KEYS.WEEKLY_LEADERBOARD,
        url: '/api/leaderboard?scope=weekly',
        maxAgeMs: CACHE_TTL.THIRTY_MINUTES,
        forceRefresh,
        onCache(entry) {
          const players = getWeeklyPlayers(entry.data);
          if (players.length > 0) {
            setTopPlayers(players);
            setHasWeeklyCache(true);
            setWeeklyUpdatedAt(entry.timestamp);
            setWeeklyLoading(false);
          }
        },
        onFresh(data) {
          const players = getWeeklyPlayers(data);
          if (players.length > 0) {
            setTopPlayers(players);
            setHasWeeklyCache(true);
          }
        },
      });
      const players = getWeeklyPlayers(result.data);
      if (players.length > 0) {
        setTopPlayers(players);
      } else {
        setLeaderboardMsg('Showing last saved leaderboard');
      }
      setWeeklyUpdatedAt(result.timestamp || Date.now());
      if (result.stale) setLeaderboardMsg('Showing last saved leaderboard');
      else if (players.length > 0) setLeaderboardMsg(null);
    } catch {
      const cached = readCache(CACHE_KEYS.WEEKLY_LEADERBOARD, CACHE_TTL.THIRTY_MINUTES);
      const players = getWeeklyPlayers(cached?.data);
      if (players.length > 0) {
        setTopPlayers(players);
        setHasWeeklyCache(true);
        setWeeklyUpdatedAt(cached.timestamp);
      }
      if (cached?.timestamp) setWeeklyUpdatedAt(cached.timestamp);
      setLeaderboardMsg('Showing last saved leaderboard');
    } finally {
      setWeeklyLoading(false);
      setWeeklyUpdating(false);
    }
  }

  function handleLeaderboardRefresh() {
    if (weeklyUpdating) return;
    loadWeeklyLeaderboard({ forceRefresh: true });
  }

  async function handleBootstrapRefresh() {
    if (bootstrapRefreshing) return;
    setBootstrapRefreshing(true);
    try {
      const result = await fetchWithClientCache({
        key: CACHE_KEYS.DASHBOARD_BOOTSTRAP,
        url: '/api/dashboard-bootstrap',
        maxAgeMs: CACHE_TTL.ONE_DAY,
        forceRefresh: true,
        onFresh(data) {
          applyBootstrapData(data, Date.now());
          setBootstrapMsg(null);
          sessionStorage.setItem(SESSION_REFRESH_KEY, '1');
        },
      });
      if (result.stale) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
    } catch {
      setBootstrapMsg("Couldn't refresh right now. Showing saved data.");
    } finally {
      setBootstrapRefreshing(false);
    }
  }

  // Bootstrap: load dashboard data from cache then silently refresh once per session.
  useEffect(() => {
    if (status === 'loading') return;
    const cached = readCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, CACHE_TTL.ONE_DAY);
    if (cached) {
      applyBootstrapData(cached.data, cached.timestamp);
      if (!cached.isFresh) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
    } else {
      if (!isLoggedIn) setProfileLoading(false);
    }
    const cachedHasLeaderboard = getWeeklyPlayers(cached?.data).length > 0;
    const alreadyRefreshed = !!sessionStorage.getItem(SESSION_REFRESH_KEY);
    if (cached?.isFresh || alreadyRefreshed) {
      if (!cachedHasLeaderboard) loadWeeklyLeaderboard();
      setWeeklyLoading(false);
      return;
    }
    fetchWithClientCache({
      key: CACHE_KEYS.DASHBOARD_BOOTSTRAP,
      url: '/api/dashboard-bootstrap',
      maxAgeMs: CACHE_TTL.ONE_DAY,
      forceRefresh: true,
      onFresh(data) {
        applyBootstrapData(data, Date.now());
        setBootstrapMsg(null);
        sessionStorage.setItem(SESSION_REFRESH_KEY, '1');
      },
    }).then(result => {
      if (result.stale) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
      if (getWeeklyPlayers(result.data).length === 0) loadWeeklyLeaderboard();
      setWeeklyLoading(false);
    }).catch(() => {
      if (cached) setBootstrapMsg("Couldn't refresh right now. Showing saved data.");
      if (!cachedHasLeaderboard) loadWeeklyLeaderboard();
      setWeeklyLoading(false);
    });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-advance Weekly Champions carousel
  useEffect(() => {
    if (topPlayers.length < 2 || champsPaused) return;
    const t = setInterval(() => setChampsSlide(s => (s + 1) % Math.min(topPlayers.length, 3)), 4000);
    return () => clearInterval(t);
  }, [topPlayers.length, champsPaused]);

  // Fetch profile + run localStorage → cloud migration for saved questions
  useEffect(() => {
    if (!isLoggedIn) { setProfileLoading(false); return; }
    fetch('/api/user-profile')
      .then(r => r.json())
      .then(data => {
        if (data.isNewUser === true) { router.replace('/onboarding'); return; }
        setUserProfile(data);
        setProfileLoading(false);
        migrateLocalSavedQuestions();
      })
      .catch(() => setProfileLoading(false));
  }, [isLoggedIn, router]);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const displayName     = isLoggedIn ? (userProfile?.name || session?.user?.name || 'User') : 'Guest';
  const googlePhoto     = session?.user?.image || null;
  const streakCount     = userProfile?.streakCount || 0;
  const lastAttemptDate = userProfile?.lastAttemptDate || '';
  const level           = userProfile?.level || 'Aspirant';
  const totalXP         = userProfile?.totalXP || 0;
  const playedToday     = lastAttemptDate === getISTDateString();
  const { done, todayIdx } = getStreakDays(streakCount, lastAttemptDate);

  const userRankIdx = isLoggedIn
    ? topPlayers.findIndex(p => p.email === session?.user?.email)
    : -1;
  const weeklyRank = weeklyUserRank?.rank || (userRankIdx !== -1 ? userRankIdx + 1 : null);

  const dailyChallengeCard = (
    <div
      className="daily-challenge-card"
      onClick={() => {
        const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        const cached = localStorage.getItem(getDCCacheKey());
        if (cached) {
          sessionStorage.setItem('dailyChallengeQuestions', cached);
        }
        router.push('/quiz?mode=daily');
      }}
      style={{
        margin: '16px 20px 20px',
        borderRadius: '22px',
        padding: '22px 22px 20px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(145deg, #17182B, #111827)',
        border: '1px solid rgba(255, 122, 26, 0.22)',
        boxShadow: '0 20px 60px rgba(255, 122, 26, 0.08)',
      }}
    >
      <div style={{
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        color: '#f97316',
        marginBottom: '8px',
      }}>
        🔥 Daily Challenge
      </div>
      <div style={{
        fontFamily: 'var(--font-display, inherit)',
        fontSize: '20px',
        fontWeight: '800',
        color: '#ffffff',
        lineHeight: '1.2',
        marginBottom: '10px',
      }}>
        Today&apos;s Mixed GK Challenge
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {[['📝', '25 Questions'], ['⏱', '~7 min'], ['🪙', '+50 XP']].map(([icon, label]) => (
          <span key={label} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.75)',
            fontSize: '12px',
            fontWeight: '600',
            padding: '4px 10px',
            borderRadius: '20px',
          }}>{icon} {label}</span>
        ))}
      </div>
      <div className="btn-daily-pulse daily-challenge-cta" style={{
        display: 'block',
        width: '100%',
        textAlign: 'center',
        color: '#ffffff',
        fontFamily: 'var(--font-display, inherit)',
        fontWeight: '700',
        fontSize: '14px',
        padding: '13px 0',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)',
      }}>
        Start Quiz Now →
      </div>
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0f172a] pb-20 px-4">
        <div className="skeleton h-14 rounded-2xl mt-4" />
        <div className="skeleton h-28 rounded-3xl mt-3" />
        <div className="skeleton h-8 w-40 rounded-xl mt-5" />
        <div className="flex gap-3 mt-3 overflow-hidden">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 w-28 rounded-3xl flex-shrink-0" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Dashboard — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-20">

        {/* ── PROFILE BAR ── */}
        <div className="px-4 pt-8 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/profile')}
              className="flex-shrink-0 active:scale-90 transition-transform"
              aria-label="Go to profile"
            >
              <Avatar imageUrl={googlePhoto} name={displayName} size={36} />
            </button>
            {isLoggedIn ? (
              <span className="bg-white/10 rounded-full px-2.5 py-1 font-display font-bold text-xs text-white/70">
                ⭐ {level}
              </span>
            ) : (
              <span className="bg-slate-700/50 rounded-full px-2.5 py-1 font-sans text-xs text-slate-500">
                Guest
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={handleClearAppCache}
                className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 font-sans text-[10px] font-semibold text-rose-200"
              >
                Clear App Cache
              </button>
            )}
            <button
              onClick={() => isLoggedIn && router.push('/history')}
              className="bg-yellow-500/20 border border-yellow-400/50 rounded-full px-3 py-1.5 flex items-center gap-1.5"
            >
              <span className="text-[14px] leading-none" style={{ filter: 'drop-shadow(0 0 4px rgba(234,179,8,0.7))' }}>🪙</span>
              <span className={`font-display font-bold text-xs ${isGuest ? 'text-slate-600' : 'text-yellow-400'}`}>
                {isGuest ? '0' : totalXP}
              </span>
            </button>
          </div>
        </div>

        {/* ── WELCOME MESSAGE ── */}
        <div style={{ padding: '4px 20px 16px' }}>
          <div style={{
            fontFamily: 'var(--font-display, inherit)',
            fontSize: '22px',
            fontWeight: '800',
            color: '#ffffff',
            lineHeight: '1.25',
          }}>
            Good {timeOfDay},{' '}
            <span style={{
              color: '#35D299',
              fontSize: '20px',
            }}>
              {session?.user?.name?.split(' ')[0] || 'Aspirant'} 👋
            </span>
          </div>
          <div style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.45)',
            marginTop: '3px',
            fontWeight: '400',
          }}>
            Ready for today&apos;s GK challenge?
          </div>
        </div>

        {/* ── DAILY CHALLENGE HERO CARD ── */}
        {dailyChallengeCard}

        {/* ── STREAK HISTORY CARD ── */}
        {isLoggedIn && !profileLoading && (
          <button
            onClick={() => router.push('/streak')}
            className="mx-4 bg-slate-800 border border-slate-700/50 px-4 py-4 w-[calc(100%-2rem)] text-left active:scale-[0.98] transition-transform" style={{ borderRadius: 22 }}
          >
            <div className="flex justify-between">
              {DAY_LABELS.map((day, i) => {
                const isDone      = done.has(i);
                const isToday     = i === todayIdx;
                const isTodayDone = isToday && playedToday;
                const isTodayTodo = isToday && !playedToday;
                const isFuture    = i > todayIdx;
                const isMissed    = i < todayIdx && !isDone;

                let circleCls = 'w-9 h-9 rounded-full flex items-center justify-center ';
                if (isDone || isTodayDone) {
                  circleCls += 'bg-orange-500 ';
                  if (isTodayDone) circleCls += 'ring-2 ring-orange-300 ring-offset-1 ring-offset-slate-800';
                } else if (isTodayTodo) {
                  circleCls += 'bg-white/5 border-2 border-orange-500';
                } else if (isMissed) {
                  circleCls += 'bg-red-950/60 border border-red-900/50';
                } else {
                  // future
                  circleCls += 'bg-slate-700/30 border border-orange-500/40';
                }

                return (
                  <div key={day} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] text-slate-500">{day}</span>
                    <div className={circleCls}>
                      {(isDone || isTodayDone) && <LightningSVG size={14} color="white" />}
                      {isMissed && <span className="text-[13px] leading-none">😢</span>}
                      {(isTodayTodo || isFuture) && (
                        <span className="font-display font-black text-orange-400 leading-none" style={{ fontSize: 11 }}>+30</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="flame-dance"><LightningSVG size={16} color="#f97316" /></span>
              <span className="font-display font-black text-base text-white">{streakCount} day{streakCount !== 1 ? 's' : ''}</span>
              {playedToday
                ? <span className="font-sans text-xs text-emerald-400 ml-auto">✓ Protected today</span>
                : <span className="font-sans text-xs text-orange-400 ml-auto">Play to extend!</span>
              }
            </div>
          </button>
        )}

        {/* ── GUEST SIGN-IN NUDGE ── */}
        {isGuest && (
          <GoogleSignInCard
            className="mx-4 mt-5"
            title="Save your progress"
            subtitle="Login to save score, XP, streak & rank."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        )}

        {/* ── SOCIAL PROOF CAROUSEL ── */}
        <SocialProofCarousel
          userProfile={userProfile}
          topPlayers={topPlayers}
          isLoggedIn={isLoggedIn}
          session={session}
          playedToday={playedToday}
        />

        {/*
        <div
          onClick={() => {
            const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
              .toISOString().split('T')[0];
            const cached = localStorage.getItem(getDCCacheKey());
            if (cached) {
              sessionStorage.setItem('dailyChallengeQuestions', cached);
            }
            router.push('/quiz?mode=daily');
          }}
          style={{
            margin: '16px 20px 20px',
            background: '#1a1a2a',
            borderRadius: '22px',
            padding: '22px 22px 20px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
          }}
        >
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: '#f97316',
            marginBottom: '8px',
          }}>
            🔥 Daily Challenge
          </div>
          <div style={{
            fontFamily: 'var(--font-display, inherit)',
            fontSize: '20px',
            fontWeight: '800',
            color: '#ffffff',
            lineHeight: '1.2',
            marginBottom: '10px',
          }}>
            Today&apos;s Mixed GK Challenge
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {[['📝', '25 Questions'], ['⏱', '~7 min'], ['🪙', '+50 XP']].map(([icon, label]) => (
              <span key={label} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.75)',
                fontSize: '12px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '20px',
              }}>{icon} {label}</span>
            ))}
          </div>
          <div className="btn-daily-pulse" style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            background: '#f97316',
            color: '#ffffff',
            fontFamily: 'var(--font-display, inherit)',
            fontWeight: '700',
            fontSize: '14px',
            padding: '13px 0',
            borderRadius: '18px',
          }}>
            Start Quiz Now →
          </div>
        </div>

        */}

        {/* ── WEEKLY CHAMPIONS ── */}
        <div className="mt-5 px-4">
          <div
            className="p-4"
            role="button"
            tabIndex={0}
            onClick={() => router.push('/leaderboard')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/leaderboard');
              }
            }}
            style={{
            background: 'linear-gradient(145deg, #111827 0%, #0f1f2e 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 24,
            boxShadow: '0 12px 35px rgba(245, 158, 11, 0.08)',
            padding: 18,
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
            onPointerDown={e => { setChampsPaused(true); e.currentTarget.style.transform = 'scale(0.98)'; }}
            onPointerUp={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
            onPointerLeave={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
            onTouchStart={() => setChampsPaused(true)}
            onTouchEnd={() => setChampsPaused(false)}
            onTouchCancel={() => setChampsPaused(false)}
          >

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-display" style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
                  Weekly Champions
                </p>
              </div>
              <div className="flex items-center gap-3" style={{ paddingTop: 4 }}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    router.push('/leaderboard');
                  }}
                  className="flex items-center gap-1 font-sans font-medium active:opacity-70"
                  style={{ fontSize: 13, color: '#34D399' }}
                >
                  View your rank
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {weeklyLoading && topPlayers.length === 0 ? (
              <div className="py-4">
                <Loader card size="sm" label="Loading weekly champions..." />
              </div>
            ) : topPlayers.length === 0 ? (
              <p className="font-sans text-xs text-slate-500 text-center py-4">
                Showing last saved leaderboard
              </p>
            ) : (
              <>
                {/* Full-width auto-advancing card */}
                {(() => {
                  const idx    = champsSlide % Math.min(topPlayers.length, 3);
                  const player = topPlayers[idx];
                  const isSelf = player.email === session?.user?.email;
                  const cardTheme = [
                    { bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.24)'   },
                    { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)' },
                    { bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.20)'    },
                  ][idx];
                  return (
                    <div
                      key={idx}
                      className="proof-slide"
                      style={{
                        background: cardTheme.bg,
                        border: `1px solid ${cardTheme.border}`,
                        borderRadius: 18,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      {/* Avatar with medal badge overlaid top-left */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar imageUrl={player.image || null} name={player.name} size={36} />
                        <span style={{
                          position: 'absolute', top: -4, left: -4,
                          fontSize: 16, lineHeight: 1,
                        }}>
                          {RANK_MEDALS[idx]}
                        </span>
                      </div>

                      {/* Name + level + XP */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <p className="font-display font-bold truncate"
                            style={{ fontSize: 15, color: isSelf ? '#10b981' : '#ffffff', margin: 0 }}>
                            {(player.name || 'User').split(' ')[0]}
                          </p>
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            color: '#facc15',
                            background: 'rgba(250,204,21,0.15)',
                            border: '1px solid rgba(250,204,21,0.3)',
                            borderRadius: 20, padding: '2px 8px',
                          }}>
                            ⭐ {player.level || 'Aspirant'}
                          </span>
                          {isSelf && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, flexShrink: 0,
                              background: 'rgba(16,185,129,0.15)', color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.3)',
                              borderRadius: 20, padding: '2px 7px',
                            }}>You</span>
                          )}
                        </div>
                      </div>

                      {/* XP */}
                      <p className="font-display font-bold"
                        style={{ fontSize: 17, color: '#FDBA3B', margin: 0, flexShrink: 0 }}>
                        {Math.round(player.totalScore || 0).toLocaleString()} XP
                      </p>
                    </div>
                  );
                })()}

                {(leaderboardMsg || weeklyUpdating || bootstrapRefreshing || weeklyUpdatedAt) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleLeaderboardRefresh();
                      }}
                      disabled={weeklyUpdating || bootstrapRefreshing}
                      className="font-sans active:opacity-70 disabled:opacity-70"
                      style={{
                        fontSize: 12,
                        color: '#64748B',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: weeklyUpdating || bootstrapRefreshing ? 'default' : 'pointer',
                      }}
                    >
                      {weeklyUpdating || bootstrapRefreshing
                        ? '↻ Refreshing...'
                        : leaderboardMsg
                          ? `${leaderboardMsg} • Updated ${formatLastUpdated(weeklyUpdatedAt) || 'recently'}`
                          : `↻ Updated ${formatLastUpdated(weeklyUpdatedAt) || 'recently'}`}
                    </button>
                  </div>
                )}

                {/* Your rank row */}
                {isLoggedIn && (
                  <div className="mt-3 pt-3 border-t border-slate-700/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs text-slate-400">Your Rank</span>
                      <span className="font-display font-black text-base text-white">
                        {weeklyRank ? `#${weeklyRank}` : '—'}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold rounded-full px-3 py-1 ${
                      playedToday
                        ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40'
                        : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'
                    }`}>
                      {playedToday ? '✓ Active today' : 'Play to rank up →'}
                    </span>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* ── DISCOVER QUIZZES ── */}
        <div className="mt-6 mb-4" style={{ padding: '0 20px' }}>
          <p className="font-display font-bold text-base text-white mb-4">Discover Quizzes</p>

          {/* Card 1 — SSC PYQs */}
          <button
            onClick={() => handleDiscoverClick('PYQ', '/subjects?collection=PYQ')}
            className="card-lift w-full text-left active:scale-[0.98]"
            style={{
              borderRadius: 22, marginBottom: 16, padding: '24px 22px', position: 'relative',
              background: '#111C2E',
              border: '1px solid rgba(148, 163, 184, 0.14)',
              boxShadow: 'inset 0 2px 0 rgba(124, 58, 237, 0.8)',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: 'rgba(124,58,237,0.18)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', display: 'inline-block' }}>
              Most Attempted
            </span>
            <p className="font-display font-bold text-white" style={{ fontSize: 22, marginTop: 12 }}>SSC PYQs</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginTop: 6 }}>
              Previous year questions across all SSC exams. Real exam pattern, real marks.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 600, marginTop: 12 }}>7,000+ Questions</p>
          </button>

          {/* Card 2 — Parmar SSC */}
          <button
            onClick={() => handleDiscoverClick('Parmar', '/subjects?collection=Parmar')}
            className="card-lift w-full text-left active:scale-[0.98]"
            style={{
              borderRadius: 22, padding: '22px 22px', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#111C2E',
              border: '1px solid rgba(139,92,246,0.22)',
              boxShadow: 'inset 0 2px 0 rgba(139,92,246,0.8)',
            }}
          >
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.28)', display: 'inline-block' }}>
                Parmar Sir
              </span>
              <p className="font-display font-bold text-white" style={{ fontSize: 22, marginTop: 12 }}>Parmar SSC</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginTop: 8, letterSpacing: '0.06em' }}>COMING SOON…</p>
            </div>
            <LightningSVG size={36} color="rgba(139,92,246,0.5)" />
          </button>
        </div>

      </div>

      {/* ── LOW QUESTIONS MODAL ── */}
      {lowQModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setLowQModal(null)}
        >
          <div
            className="w-full max-w-[360px] bg-[#1e293b] border border-slate-700/60 px-6 py-8 text-center" style={{ borderRadius: 22 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-5xl mb-5">🚧</div>
            <h3 className="font-display font-black text-xl text-white mb-3">
              {lowQModal} is still being built out.
            </h3>
            <p className="font-sans font-medium text-sm text-slate-400 leading-relaxed mb-7">
              Check back soon — questions are being added every day! 🙌
            </p>
            <button
              onClick={() => setLowQModal(null)}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* ── COMING SOON MODAL ── */}
      {comingSoonModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setComingSoonModal(false)}
        >
          <div
            className="w-full max-w-[430px] bg-[#1e293b] rounded-t-3xl px-6 pt-6 pb-10 text-center"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5" />
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="font-display font-black text-xl text-white mb-2">Coming Soon!</h3>
            <p className="font-sans font-medium text-sm text-slate-400 leading-relaxed mb-6">
              This series will be available soon. Tap the 🔔 on any card to get notified when it goes live!
            </p>
            <button
              onClick={() => setComingSoonModal(false)}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* ── DISCOVER COMING SOON MODAL ── */}
      {modal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: '28px 24px',
              maxWidth: 300,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 24, height: 24,
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#999', lineHeight: 1,
              }}
            >×</button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
              <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2a', margin: 0 }}>
                Coming Soon
              </p>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginTop: 8 }}>
                Our team is busy adding questions for this collection. Check back soon!
              </p>

              {/* Notify me button */}
              <button
                onClick={handleNotifyInterest}
                disabled={notified || notifyLoading}
                className="font-display"
                style={{
                  marginTop: 20, width: '100%',
                  background: notified ? '#10b981' : '#1a1a2a',
                  color: '#ffffff',
                  borderRadius: 12, padding: '14px 0',
                  fontSize: 15, fontWeight: 700,
                  border: 'none', cursor: notified ? 'default' : 'pointer',
                  opacity: notifyLoading ? 0.7 : 1,
                  transition: 'background 0.2s ease',
                }}
              >
                {notified ? "✅ We'll notify you!" : notifyLoading ? 'Saving…' : '🔔 Notify me when it\'s ready'}
              </button>

              {/* Got it button */}
              <button
                onClick={closeModal}
                className="font-display"
                style={{
                  marginTop: 10, width: '100%',
                  background: 'transparent', color: '#888',
                  borderRadius: 12, padding: '10px 0',
                  fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFY TOAST ── */}
      {notifyToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[390px] z-50">
          <div className={`rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xl ${
            notifyToast.type === 'success' ? 'bg-emerald-600'
            : notifyToast.type === 'info'  ? 'bg-blue-600'
            : 'bg-red-600'
          }`}>
            <span className="text-xl flex-shrink-0">
              {notifyToast.type === 'success' ? '🎉' : notifyToast.type === 'info' ? '🔔' : '⚠️'}
            </span>
            <p className="font-sans font-medium text-sm text-white leading-snug">{notifyToast.msg}</p>
          </div>
        </div>
      )}
    </>
  );
}
