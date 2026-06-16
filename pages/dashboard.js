import { useState, useEffect, useMemo, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import MentorMessage from '@/components/MentorMessage';
import NotificationBell from '@/components/NotificationBell';
import WhatsAppBell from '@/components/WhatsAppBell';
import Loader from '@/components/ui/Loader';
import RefreshStatus from '@/components/ui/RefreshStatus';
import AppCard from '@/components/ui/AppCard';
import { getSubjectStyle, subjectStyles } from '@/lib/subjects';
import { getISTDateString } from '@/lib/streak';
import {
  readCache,
  writeCache,
  clearAllAppCache,
} from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getDashboardBootstrap } from '@/lib/data/appData';
import { getUserCacheScope, buildUserScopedKey } from '@/lib/userCacheScope';
import { migrateGuestSavedQuestions } from '@/lib/data/savedData';
import { readMentorSnapshotCache } from '@/lib/data/mentorData';
import { getLeaderboard } from '@/lib/data/leaderboardData';
import { getDailyChallenge, getTopics } from '@/lib/data/questionData';
import { MENTOR_COPY } from '@/lib/mentorCopy';

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
function Avatar({ imageUrl, name, size = 36, borderClass = 'border-2 border-white/20' }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();

  if (imageUrl && !imgError) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${borderClass}`}
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
      className={`rounded-full bg-gradient-to-br from-blue-600 to-[#14B8A6] flex items-center justify-center flex-shrink-0 ${borderClass}`}
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
/* ─── Daily Challenge cache helpers (module-level — used by both Dashboard and SocialProofCarousel) ── */
function getDCCacheKey() {
  return CACHE_KEYS.DAILY_CHALLENGE(getISTDateString());
}

async function prefetchDailyChallenge() {
  try {
    await getDailyChallenge();
  } catch (_) {}
}

/* ─── Social Proof Carousel ───────────────────────────────────────────────── */
function SocialProofCarousel({ userProfile, topPlayers, isLoggedIn, session, playedToday }) {
  const [slide, setSlide]             = useState(0);

  useEffect(() => {
    prefetchDailyChallenge();
  }, []);

  // Build slide list from available data
  const slides = useMemo(() => {
    const items = [];

    // ① Honest, non-numeric encouragement — always first.
    // (Replaces a previously fabricated daily-activity count, Step 7 PHASE J.)
    items.push({
      emoji: '🔥',
      main:  'Practise GK daily to boost your score',
      sub:   'Consistency is what pushes your rank up',
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
          sub:   'Play today to protect your bonus Coins',
          color: '#ef4444',
        });
      } else if (streak === 0) {
        items.push({
          emoji: '🎯',
          main:  'Start your streak today',
          sub:   'Daily practice builds rank the fastest',
          color: '#14B8A6',
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

      // ④ Coins + level
      if ((userProfile.totalCoins || 0) > 0) {
        items.push({
          emoji: '🪙',
          main:  `${userProfile.totalCoins.toLocaleString()} coins · Level: ${userProfile.level || 'Aspirant'}`,
          sub:   'Every quiz adds coins — keep stacking',
          color: '#06b6d4',
        });
      }

    } else {
      // Guest slides — honest, non-numeric copy.
      // (Replaces a previously fabricated weekly-ranked count, Step 7 PHASE J.)
      items.push(
        {
          emoji: '🏆',
          main:  'Climb the weekly leaderboard',
          sub:   'Sign in to claim your spot on the board',
          color: '#f59e0b',
        },
        {
          emoji: '📈',
          main:  'Build a daily practice habit',
          sub:   'Sign in to track your streak & rank',
          color: '#6366f1',
        },
      );
    }

    return items;
  }, [userProfile, topPlayers, isLoggedIn, session, playedToday]);

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
      <style suppressHydrationWarning>{`
        @keyframes proofFade {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .proof-slide { animation: proofFade 0.36s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="app-card" style={{
        padding: '14px 16px 12px',
      }}>
        {/* Slide content */}
        <div key={slide} className="proof-slide" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{current.emoji}</span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="font-display" style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              lineHeight: 1.35, margin: 0,
            }}>
              {current.main}
            </p>
            <p style={{
              fontSize: 11, color: 'var(--text-muted)',
              marginTop: 3, lineHeight: 1.3,
            }}>
              {current.sub}
            </p>
          </div>

          {/* Accent bar */}
          <div style={{
            width: 3, height: 36, borderRadius: 4,
            background: current.color, flexShrink: 0, opacity: 0.45,
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
                  background: i === slide ? current.color : 'var(--ssc-border-soft)',
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
  const [parmarWaitlistCount, setParmarWaitlistCount] = useState(null); // null = not fetched yet; 0 = hide counter
  const [notifyToast,      setNotifyToast]      = useState(null); // { msg, type }
  const [subjectChecking,  setSubjectChecking]  = useState(null); // subject name being checked
  const [lowQModal,        setLowQModal]        = useState(null); // subject name with low questions
  const [modal,            setModal]            = useState(null);  // coming-soon modal for discover cards — stores collection name
  const [notified,         setNotified]         = useState(false);
  const [notifyLoading,    setNotifyLoading]    = useState(false);
  // 'default' | 'loading' | 'done' | 'already' | 'guest-prompt'
  const [notifyModalView,  setNotifyModalView]  = useState('default');
  const [collectionTotals, setCollectionTotals] = useState({});   // { [collection]: totalCount }
  const [champsSlide, setChampsSlide] = useState(0);
  const [champsPaused, setChampsPaused] = useState(false);
  const [bootstrapRefreshing, setBootstrapRefreshing] = useState(false);
  const [bootstrapUpdatedAt, setBootstrapUpdatedAt] = useState(null);
  const [bootstrapMsg, setBootstrapMsg] = useState(null);
  const [leaderboardMsg, setLeaderboardMsg] = useState(null);
  const [showMentorSetupBanner, setShowMentorSetupBanner] = useState(false);
  const profileFallbackRequested = useRef(false);
  const savedQuestionsMigrated = useRef(false);

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
      const { data } = await getTopics({ subject });
      const topicMap = data.topics?.[subject] || {};
      const total = Object.values(topicMap).reduce((sum, n) => sum + n, 0);
      if (total < 10) {
        setLowQModal(subject);
      } else {
        router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}&sourceScreen=dashboard`);
      }
    } catch {
      // On error just navigate — don't block the user
      router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}&sourceScreen=dashboard`);
    } finally {
      setSubjectChecking(null);
    }
  }

  function closeModal() {
    setModal(null);
    setNotified(false);
    setNotifyLoading(false);
    setNotifyModalView('default');
  }

  function handleClearAppCache() {
    const removed = clearAllAppCache();
    setBootstrapMsg(`Cleared ${removed} app cache ${removed === 1 ? 'entry' : 'entries'}.`);
  }

  async function handleNotifyInterest() {
    if (notifyModalView === 'loading' || notifyModalView === 'done' || notifyModalView === 'already') return;
    // Guest: show sign-in prompt, do not hit the API
    if (!isLoggedIn) {
      setNotifyModalView('guest-prompt');
      return;
    }
    setNotifyModalView('loading');
    try {
      const res  = await fetch('/api/notify-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: modal }),
      });
      const data = await res.json();
      if (data.alreadyJoined) {
        setNotifyModalView('already');
      } else {
        setNotifyModalView('done');
        setNotified(true);
      }
    } catch {
      setNotifyModalView('done');
      setNotified(true);
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
      const { data } = await getTopics({ collection });
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
  const cacheScope = getUserCacheScope(session);

  useEffect(() => {
    if (status === 'loading') return;
    if (!isLoggedIn && !isGuest) router.replace('/');
  }, [status, isLoggedIn, isGuest, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Show the "Build My GK Plan" banner only when the account genuinely has no
    // mentor plan. The legacy `mentor_onboarded` flag is device-local and can be
    // missing even when a plan exists (built on another device / cleared storage),
    // which made Home disagree with the Mentor tab. Prefer the account-scoped
    // mentor snapshot that the Mentor tab populates; self-heal the flag.
    const onboarded = localStorage.getItem('mentor_onboarded') === 'true';
    const snapshot = readMentorSnapshotCache(cacheScope);
    const hasPlan = Boolean(snapshot && (snapshot.exists || snapshot.profile || snapshot.plan?.tasks?.length));
    if (hasPlan && !onboarded) {
      try { localStorage.setItem('mentor_onboarded', 'true'); } catch {}
    }
    setShowMentorSetupBanner(!onboarded && !hasPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, cacheScope]);

  // Migrate any locally-saved guest questions to the cloud (runs once on login).
  // Step 11: ONE batched POST /api/saved-questions (server appends only missing
  // rows, idempotent). Guest keys are cleared ONLY after a confirmed success, so
  // a failed migration can be retried without data loss.
  async function migrateLocalSavedQuestions() {
    try {
      const raw = localStorage.getItem('ssc_saved_questions') || localStorage.getItem('savedQuestions');
      if (!raw) return;
      const questions = JSON.parse(raw);
      if (!Array.isArray(questions) || questions.length === 0) {
        localStorage.removeItem('ssc_saved_questions');
        localStorage.removeItem('savedQuestions');
        return;
      }
      const valid = questions.filter(q => q && (q.questionId || q.id) && q.question && q.correctOption);
      if (valid.length === 0) {
        localStorage.removeItem('ssc_saved_questions');
        localStorage.removeItem('savedQuestions');
        return;
      }
      const result = await migrateGuestSavedQuestions({ scope: cacheScope, questions: valid });
      if (result.ok) {
        localStorage.removeItem('ssc_saved_questions');
        localStorage.removeItem('savedQuestions');
      }
      // On failure: keep guest keys for a later retry (do NOT clear).
    } catch {}
  }

  // Profile fallback WITHOUT /api/user-profile (Step 7): when bootstrap returns
  // no usable profile for a signed-in user, retry the SAME canonical route once
  // (force-refresh). New-user detection (isNewUser) now comes from bootstrap, so
  // the onboarding redirect is preserved without a second route.
  function loadProfileViaBootstrap() {
    if (profileFallbackRequested.current) return;
    profileFallbackRequested.current = true;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[apidiag] {"kind":"journey","journey":"dashboard","trigger":"dashboard-user-profile-call-removed","route":"/api/dashboard-bootstrap"}');
    }
    getDashboardBootstrap({ forceRefresh: true, scope: cacheScope })
      .then(result => {
        if (result.data?.profile?.isNewUser) { router.replace('/onboarding'); return; }
        applyBootstrapData(result.data, result.timestamp || Date.now());
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
  }

  function applyBootstrapData(data, timestamp) {
    if (!data) return;
    // Brand-new account (no Users row yet) → onboarding, never render as profile.
    if (data.profile?.isNewUser) {
      router.replace('/onboarding');
      return;
    }
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
    if (timestamp) {
      setBootstrapUpdatedAt(timestamp);
      setWeeklyUpdatedAt(timestamp);
    }
  }

  async function loadWeeklyLeaderboard({ forceRefresh = false } = {}) {
    setWeeklyUpdating(forceRefresh);
    try {
      const cached = readCache(CACHE_KEYS.WEEKLY_LEADERBOARD, CACHE_TTL.THIRTY_MINUTES);
      if (!forceRefresh && cached) {
        const cachedPlayers = getWeeklyPlayers(cached.data);
        if (cachedPlayers.length > 0) {
          setTopPlayers(cachedPlayers);
          setHasWeeklyCache(true);
          setWeeklyUpdatedAt(cached.timestamp);
          setWeeklyLoading(false);
          if (cached.isFresh) {
            setWeeklyUpdating(false);
            return;
          }
        }
      }

      const result = await getLeaderboard({
        scope: 'weekly',
        forceRefresh,
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
      const result = await getDashboardBootstrap({
        forceRefresh: true,
        scope: cacheScope,
      });
      applyBootstrapData(result.data, result.timestamp || Date.now());
      setBootstrapMsg(null);
      sessionStorage.setItem(SESSION_REFRESH_KEY, '1');
      if (result.stale) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
      if (isLoggedIn && !result.data?.profile) loadProfileViaBootstrap();
    } catch {
      setBootstrapMsg("Couldn't refresh right now. Showing saved data.");
      if (isLoggedIn && !userProfile) loadProfileViaBootstrap();
    } finally {
      setBootstrapRefreshing(false);
    }
  }

  // Bootstrap: load dashboard data from cache then silently refresh once per session.
  useEffect(() => {
    if (status === 'loading') return;
    const cached = readCache(buildUserScopedKey(CACHE_KEYS.DASHBOARD_BOOTSTRAP, cacheScope), CACHE_TTL.ONE_DAY);
    if (cached) {
      applyBootstrapData(cached.data, cached.timestamp);
      if (!cached.isFresh) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
    } else {
      if (!isLoggedIn) setProfileLoading(false);
    }
    const cachedHasLeaderboard = getWeeklyPlayers(cached?.data).length > 0;
    const cachedHasProfile = Boolean(cached?.data?.profile);
    if (cached) {
      if (!cachedHasLeaderboard) loadWeeklyLeaderboard();
      if (isLoggedIn && !cachedHasProfile) {
        loadProfileViaBootstrap();
      } else if (isLoggedIn && cachedHasProfile && !cached.data?.profile?.isNewUser) {
        // PHASE D: dynamic profile fields (coins/streak/level) must not be shown
        // up to a day stale. Cached profile renders instantly above; then freshen
        // silently via the SAME /api/dashboard-bootstrap route if the cache is
        // older than the dynamic-data window. Background only — no /api/user-profile.
        const ageMs = Date.now() - (cached.timestamp || 0);
        if (ageMs > CACHE_TTL.TEN_MINUTES && !profileFallbackRequested.current) {
          profileFallbackRequested.current = true;
          getDashboardBootstrap({ forceRefresh: true, scope: cacheScope })
            .then(result => applyBootstrapData(result.data, result.timestamp || Date.now()))
            .catch(() => {});
        }
      }
      setWeeklyLoading(false);
      return;
    }
    getDashboardBootstrap({
      forceRefresh: false,
      scope: cacheScope,
    }).then(result => {
      applyBootstrapData(result.data, result.timestamp || Date.now());
      sessionStorage.setItem(SESSION_REFRESH_KEY, '1');
      if (result.stale) setBootstrapMsg('Showing saved data. Tap refresh for latest.');
      if (getWeeklyPlayers(result.data).length === 0) loadWeeklyLeaderboard();
      if (isLoggedIn && !result.data?.profile) loadProfileViaBootstrap();
      setWeeklyLoading(false);
    }).catch(() => {
      if (cached) setBootstrapMsg("Couldn't refresh right now. Showing saved data.");
      if (!cachedHasLeaderboard) loadWeeklyLeaderboard();
      if (isLoggedIn && !cachedHasProfile) loadProfileViaBootstrap();
      setWeeklyLoading(false);
    });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-advance Weekly Champions carousel
  useEffect(() => {
    if (topPlayers.length < 2 || champsPaused) return;
    const t = setInterval(() => setChampsSlide(s => (s + 1) % Math.min(topPlayers.length, 3)), 4000);
    return () => clearInterval(t);
  }, [topPlayers.length, champsPaused]);

  // Run localStorage -> cloud migration once the logged-in profile is available.
  useEffect(() => {
    if (!isLoggedIn) { setProfileLoading(false); return; }
    if (!userProfile || savedQuestionsMigrated.current) return;
    savedQuestionsMigrated.current = true;
    migrateLocalSavedQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userProfile]);

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const displayName     = isLoggedIn ? (userProfile?.name || session?.user?.name || 'User') : 'Guest';
  const googlePhoto     = session?.user?.image || null;
  const profileImage    = userProfile?.image || googlePhoto || '';
  const streakCount     = userProfile?.streakCount || 0;
  const lastAttemptDate = userProfile?.lastAttemptDate || '';
  const level           = userProfile?.level || 'Aspirant';
  const totalCoins      = userProfile?.totalCoins ?? 0;
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
        const cached = readCache(getDCCacheKey(), CACHE_TTL.ONE_DAY)?.data;
        if (cached) {
          sessionStorage.setItem('dailyChallengeQuestions', JSON.stringify(cached));
        }
        router.push('/quiz?mode=daily&sourceScreen=daily_challenge');
      }}
      style={{
        margin: '4px 20px 20px',
        borderRadius: '22px',
        padding: '22px 22px 20px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F4 100%)',
        border: '1px solid rgba(255, 106, 0, 0.18)',
        boxShadow: 'var(--ssc-shadow-card)',
      }}
    >
      <div className="t-section-label" style={{ color: '#f97316', marginBottom: '8px' }}>
        🔥 Daily Challenge
      </div>
      <div className="t-card-title" style={{ color: 'var(--ssc-text-primary)', marginBottom: '10px' }}>
        Today&apos;s Mixed GK Challenge
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {[['📝', '25 Questions'], ['⏱', '~7 min'], ['🪙', '+50 Coins']].map(([icon, label]) => (
          <span key={label} className="t-badge" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--ssc-surface)',
            color: 'var(--ssc-text-secondary)',
            border: '1px solid var(--ssc-border-soft)',
            padding: '4px 10px',
            borderRadius: '20px',
          }}>{icon} {label}</span>
        ))}
      </div>
      <div className="btn-daily-pulse daily-challenge-cta t-button-lg" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        color: '#ffffff',
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
      <div
        className="app-page dashboard-light-page"
        style={{
          '--bg-app': 'var(--ssc-bg)',
          '--bg-page': 'var(--ssc-bg)',
          '--bg-card': 'var(--ssc-surface)',
          '--bg-card-soft': 'var(--ssc-surface-soft)',
          '--bg-card-hover': 'var(--ssc-surface)',
          '--border-soft': 'var(--ssc-border-soft)',
          '--text-primary': 'var(--ssc-text-primary)',
          '--text-secondary': 'var(--ssc-text-secondary)',
          '--text-muted': 'var(--ssc-text-muted)',
          '--accent-orange': 'var(--ssc-orange)',
          '--accent-orange-hover': 'var(--ssc-orange-deep)',
          '--accent-orange-soft': '#FFF1E8',
          '--accent-green': 'var(--ssc-teal)',
          '--accent-green-soft': 'var(--ssc-teal-soft)',
          '--shadow-soft': 'var(--ssc-shadow-card)',
        }}
      >
        <div className="app-shell !px-4 pb-20">
          <div className="skeleton h-14 rounded-2xl pt-4" />
          <div className="skeleton h-28 rounded-3xl mt-3" />
          <div className="skeleton h-8 w-40 rounded-xl mt-5" />
          <div className="flex gap-3 mt-3 overflow-hidden">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 w-28 rounded-3xl flex-shrink-0" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Dashboard — SSC GK Score Booster</title></Head>
      <div
        className="app-page dashboard-light-page"
        style={{
          '--bg-app': 'var(--ssc-bg)',
          '--bg-page': 'var(--ssc-bg)',
          '--bg-card': 'var(--ssc-surface)',
          '--bg-card-soft': 'var(--ssc-surface-soft)',
          '--bg-card-hover': 'var(--ssc-surface)',
          '--border-soft': 'var(--ssc-border-soft)',
          '--text-primary': 'var(--ssc-text-primary)',
          '--text-secondary': 'var(--ssc-text-secondary)',
          '--text-muted': 'var(--ssc-text-muted)',
          '--accent-orange': 'var(--ssc-orange)',
          '--accent-orange-hover': 'var(--ssc-orange-deep)',
          '--accent-orange-soft': '#FFF1E8',
          '--accent-green': 'var(--ssc-teal)',
          '--accent-green-soft': 'var(--ssc-teal-soft)',
          '--shadow-soft': 'var(--ssc-shadow-card)',
        }}
      >
      <div className="app-shell !px-0 pb-20">

        {/* ── STICKY HEADER BAR ── */}
        <div
          className="sticky top-0 z-50 px-4 flex items-center justify-between"
          style={{
            height: '58px',
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--ssc-border-soft)',
            borderRadius: '0 0 22px 22px',
            boxShadow: '0 10px 30px rgba(16,32,51,0.08)',
          }}
        >
          {/* Left: Bolt + App name */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-[#FFF1E8] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--ssc-orange)">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center" style={{ color: 'var(--ssc-text-primary)' }}>
              SSC GK SCORE BOOSTER
            </span>
          </div>

          {/* Right: WhatsApp bell */}
          <WhatsAppBell />
        </div>

        {showMentorSetupBanner && (
          <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
            <MentorMessage
              message={MENTOR_COPY.NO_PLAN}
              variant="info"
            />
            <button
              onClick={() => router.push('/mentor-setup')}
              className="mt-3 w-full py-3 rounded-2xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:bg-orange-700 transition-colors"
            >
              Build My GK Plan
            </button>
            <button
              onClick={() => setShowMentorSetupBanner(false)}
              className="mt-2 w-full py-2 text-xs text-slate-400"
            >
              Remind me later
            </button>
          </div>
        )}

        {/* ── GREETING ── */}
        <div style={{ padding: '18px 20px 8px' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[20px] leading-[1.2] font-extrabold" style={{ color: 'var(--text-primary)' }}>
                Good {timeOfDay},{' '}
                <span style={{ color: '#14B8A6' }}>
                  {displayName?.split(' ')[0] || 'Aspirant'} 👋
                </span>
              </div>
              <div className="mt-1">
                <div className="font-body text-[13px] leading-[1.45] font-medium" style={{ color: 'var(--text-muted)' }}>
                  Keep your streak alive today 🔥
                </div>
                <div className="mt-1">
                  <RefreshStatus
                    updatedAt={bootstrapUpdatedAt}
                    isRefreshing={bootstrapRefreshing}
                    onRefresh={handleBootstrapRefresh}
                    refreshText={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/profile')}
              aria-label="Open profile"
              className="flex-shrink-0 transition-transform active:scale-95"
              style={{
                width: 52,
                height: 52,
                borderRadius: '9999px',
                padding: 3,
                background: 'linear-gradient(135deg, #FF8A1F 0%, #FF5A00 100%)',
                boxShadow: '0 0 0 3px rgba(255, 138, 31, 0.14), 0 12px 24px rgba(255, 90, 0, 0.2)',
              }}
            >
              <Avatar imageUrl={profileImage} name={displayName} size={46} borderClass="border-0" />
            </button>
          </div>
        </div>

        {/* ── STAT MINI-CARDS (mirrors profile screen layout) ── */}
        <div className="grid grid-cols-3 gap-2 px-4 mb-3">
          {/* Coins → /history */}
          <button
            onClick={() => !isGuest && router.push('/history')}
            className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
            style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.18)', boxShadow: 'var(--ssc-shadow-card)' }}
          >
            <span className="text-lg leading-none mb-0.5">🪙</span>
            <span className="t-stat-sm font-display" style={{ color: '#14B8A6' }}>
              {isGuest ? '—' : totalCoins >= 10000 ? `${(totalCoins / 1000).toFixed(1)}k` : totalCoins.toLocaleString()}
            </span>
            <span className="t-stat-label font-sans" style={{ color: 'var(--ssc-text-secondary)' }}>Total Coins</span>
          </button>

          {/* Streak → /streak */}
          <button
            onClick={() => !isGuest && router.push('/streak')}
            className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
            style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(255,106,0,0.18)', boxShadow: 'var(--ssc-shadow-card)' }}
          >
            <span className="text-lg leading-none mb-0.5">🔥</span>
            <span className="t-stat-sm font-display text-orange-400">
              {isGuest ? '—' : streakCount}
            </span>
            <span className="t-stat-label font-sans" style={{ color: 'var(--ssc-text-secondary)' }}>Day Streak</span>
          </button>

          {/* Rank → /leaderboard */}
          <button
            onClick={() => router.push('/leaderboard')}
            className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
            style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(109,93,246,0.18)', boxShadow: 'var(--ssc-shadow-card)' }}
          >
            <span className="text-lg leading-none mb-0.5">🏆</span>
            <span className="t-stat-sm font-display text-violet-400">
              {isGuest || !weeklyRank ? '—' : `#${weeklyRank}`}
            </span>
            <span className="t-stat-label font-sans" style={{ color: 'var(--ssc-text-secondary)' }}>Rank</span>
          </button>
        </div>
        {/* ── DAILY CHALLENGE HERO CARD ── */}
        {dailyChallengeCard}

        {/* ── STREAK HISTORY CARD ── */}
        {isLoggedIn && !profileLoading && (
          <AppCard
            as="button"
            onClick={() => router.push('/streak')}
            interactive
            className="mx-4 app-card w-[calc(100%-2rem)] text-left"
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
                  circleCls += 'bg-[#FF6B16] ';
                  if (isTodayDone) circleCls += 'ring-1 ring-[#FF6B16]/60 ring-offset-1 ring-offset-white';
                } else if (isTodayTodo) {
                  circleCls += 'bg-[#FFF1E8] border border-[#FF6B16]/50';
                } else if (isMissed) {
                  circleCls += 'bg-[#FEECEC] border border-red-200';
                } else {
                  // future
                  circleCls += 'bg-white border border-[var(--ssc-border-soft)]';
                }

                return (
                  <div key={day} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{day}</span>
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
              <span className="font-display font-black text-base" style={{ color: 'var(--text-primary)' }}>{streakCount} day{streakCount !== 1 ? 's' : ''}</span>
              {playedToday
                ? <span className="font-sans text-xs ml-auto" style={{ color: '#14B8A6' }}>✓ Protected today</span>
                : <span className="font-sans text-xs text-orange-400 ml-auto">Play to extend!</span>
              }
            </div>
          </AppCard>
        )}

        {/* ── GUEST SIGN-IN NUDGE ── */}
        {isGuest && (
          <GoogleSignInCard
            className="mx-4 mt-5 app-card"
            title="Save your progress"
            subtitle="Login to save score, Coins, streak & rank."
            buttonText="Sign in"
            callbackUrl="/dashboard"
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--border-soft)',
              boxShadow: 'var(--shadow-soft)',
            }}
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
            const cached = readCache(getDCCacheKey(), CACHE_TTL.ONE_DAY)?.data;
            if (cached) {
              sessionStorage.setItem('dailyChallengeQuestions', JSON.stringify(cached));
            }
            router.push('/quiz?mode=daily&sourceScreen=daily_challenge');
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
            {[['📝', '25 Questions'], ['⏱', '~7 min'], ['🪙', '+50 Coins']].map(([icon, label]) => (
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

        {/* ── DISCOVER QUIZZES ── */}
        <div className="mt-5 mb-4" style={{ padding: '0 20px' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="t-section-label app-section-label" style={{ margin: 0 }}>Discover Quizzes</p>
            <button
              type="button"
              onClick={() => router.push('/subjects')}
              className="t-button-sm font-sans font-bold active:opacity-70"
              style={{ color: 'var(--ssc-teal)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>

          {/* SSC PYQs — full-width primary card */}
          <div style={{
            background: 'var(--ssc-surface)',
            border: '1px solid var(--ssc-border-soft)',
            borderRadius: 22,
            padding: 20,
            marginBottom: 12,
            boxShadow: 'var(--ssc-shadow-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999, flexShrink: 0,
                background: 'var(--ssc-teal-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, lineHeight: 1,
                fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
              }}>📚</div>
              <div style={{ minWidth: 0 }}>
                <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 3px', fontSize: 16 }}>SSC PYQs</p>
                <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: 0, fontSize: 13, lineHeight: 1.4 }}>Practice real previous year questions</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {['7,000+ Questions', 'Exam-level', 'Subject-wise'].map(chip => (
                <span key={chip} className="t-badge" style={{
                  color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)',
                  border: '1px solid rgba(14,165,164,0.20)',
                  borderRadius: 999, padding: '4px 10px', lineHeight: 1.5,
                }}>{chip}</span>
              ))}
            </div>

            <button
              onClick={() => handleDiscoverClick('PYQ', '/subjects?collection=PYQ')}
              className="w-full active:scale-[0.98] transition-transform font-display font-bold text-white"
              style={{
                padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)',
                boxShadow: '0 8px 20px rgba(255,90,0,0.22)', fontSize: 15,
              }}
            >
              Start PYQ Practice →
            </button>
          </div>

          {/* Parmar SSC — full-width secondary card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setModal('Parmar')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModal('Parmar'); } }}
            className="active:scale-[0.98] transition-transform"
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 22,
              padding: 20,
              boxShadow: 'var(--ssc-shadow-card)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 16,
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 999, flexShrink: 0,
              background: '#F2EAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, lineHeight: 1,
              fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
            }}>🎬</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 3px', fontSize: 16 }}>Parmar SSC</p>
              <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 10px', fontSize: 13, lineHeight: 1.4 }}>Video-wise GK quizzes coming soon</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="t-badge" style={{
                  color: '#7C3AED', background: '#F2EAFE',
                  border: '1px solid rgba(124,58,237,0.20)',
                  borderRadius: 999, padding: '4px 10px', lineHeight: 1.5,
                }}>Coming Soon</span>
                <span className="font-display font-bold" style={{ color: 'var(--ssc-orange-deep)', fontSize: 13 }}>
                  Notify Me →
                </span>
              </div>
            </div>

            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-secondary)" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </div>

        {/* ── WEEKLY CHAMPIONS ── */}
        <div className="mb-4" style={{ padding: '0 20px' }}>
          {/* Section header — outside the card, same pattern as DISCOVER QUIZZES */}
          <div className="flex items-center justify-between mb-3">
            <p className="t-section-label app-section-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              WEEKLY CHAMPIONS
            </p>
            <button
              type="button"
              onClick={() => router.push('/leaderboard')}
              className="t-button-sm font-sans font-bold active:opacity-70"
              style={{ color: 'var(--ssc-teal)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              View full leaderboard →
            </button>
          </div>

          {/* Card — champions only, no inner header */}
          <div
            className="app-card"
            role="button"
            tabIndex={0}
            onClick={() => router.push('/leaderboard')}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push('/leaderboard');
              }
            }}
            style={{ padding: 18, cursor: 'pointer', transition: 'transform 150ms ease' }}
            onPointerDown={e => { setChampsPaused(true); e.currentTarget.style.transform = 'scale(0.98)'; }}
            onPointerUp={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
            onPointerLeave={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
            onTouchStart={() => setChampsPaused(true)}
            onTouchEnd={() => setChampsPaused(false)}
            onTouchCancel={() => setChampsPaused(false)}
          >
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
                <div className="grid grid-cols-3 gap-2">
                  {topPlayers.slice(0, 3).map((player, idx) => {
                    const isSelf = player.email === session?.user?.email;
                    const rankColors = [
                      { bg: '#FFF7E6', border: '#F6B331', text: '#F59E0B' },
                      { bg: '#EEF3F7', border: '#9AA8B8', text: '#64748B' },
                      { bg: '#FFF1E8', border: '#F97316', text: '#EA580C' },
                    ][idx] || { bg: 'var(--ssc-surface-soft)', border: 'var(--ssc-border-soft)', text: 'var(--ssc-text-secondary)' };
                    const tagLabel  = idx === 0 ? 'Champion' : (player.level || 'Scholar');
                    const tagColors = [
                      { bg: '#FFF7E6', color: '#F59E0B' },
                      { bg: '#EEF3F7', color: '#64748B' },
                      { bg: '#FFF1E8', color: '#EA580C' },
                    ][idx] || { bg: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-muted)' };
                    return (
                      <div
                        key={player.email || player.name || idx}
                        className="text-center"
                        style={{
                          minWidth: 0,
                          padding: '2px 4px 0',
                          borderLeft: idx === 1 ? '1px solid var(--ssc-border-soft)' : 'none',
                          borderRight: idx === 1 ? '1px solid var(--ssc-border-soft)' : 'none',
                        }}
                      >
                        <div style={{ position: 'relative', width: 46, height: 46, margin: '0 auto 8px' }}>
                          <Avatar imageUrl={player.image || null} name={player.name} size={42} />
                          <span style={{
                            position: 'absolute',
                            left: -7,
                            top: -2,
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: rankColors.bg,
                            border: `1px solid ${rankColors.border}`,
                            color: rankColors.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 900,
                            boxShadow: '0 4px 10px rgba(16,32,51,0.08)',
                          }}>
                            {idx + 1}
                          </span>
                        </div>
                        <p className="font-display font-black truncate" style={{ color: isSelf ? 'var(--ssc-teal)' : 'var(--ssc-text-primary)', fontSize: 12, margin: 0 }}>
                          {(player.name || 'User').split(' ')[0]}
                        </p>
                        <span style={{
                          display: 'inline-block',
                          marginTop: 3,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: tagColors.bg,
                          color: tagColors.color,
                          fontSize: 10,
                          fontWeight: 800,
                        }}>
                          {tagLabel}
                        </span>
                        <p className="font-sans font-bold" style={{ color: 'var(--ssc-text-secondary)', fontSize: 11, margin: '4px 0 0' }}>
                          {Math.round(player.totalScore || 0).toLocaleString()} Coins
                        </p>
                      </div>
                    );
                  })}
                </div>

                {(leaderboardMsg || weeklyUpdating || weeklyUpdatedAt) && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--ssc-border-soft)' }}>
                    <RefreshStatus
                      updatedAt={weeklyUpdatedAt}
                      isRefreshing={weeklyUpdating}
                      onRefresh={e => {
                        e.stopPropagation();
                        handleLeaderboardRefresh();
                      }}
                      refreshText={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10"/>
                          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                        </svg>
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* ── LOW QUESTIONS MODAL ── */}
      </div>

      {lowQModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'var(--ssc-overlay)' }}
          onClick={() => setLowQModal(null)}
        >
          <div
            className="w-full max-w-[360px] px-6 py-8 text-center"
            style={{ borderRadius: 22, background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-float)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-5xl mb-5">🚧</div>
            <h3 className="font-display font-black text-xl mb-3" style={{ color: 'var(--ssc-text-primary)' }}>
              {lowQModal} is still being built out.
            </h3>
            <p className="font-sans font-medium text-sm leading-relaxed mb-7" style={{ color: 'var(--ssc-text-secondary)' }}>
              Check back soon — questions are being added every day! 🙌
            </p>
            <button
              onClick={() => setLowQModal(null)}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform text-white"
              style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)' }}
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
          style={{ background: 'var(--ssc-overlay)' }}
          onClick={() => setComingSoonModal(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-t-3xl px-6 pt-6 pb-10 text-center"
            style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderBottom: 'none', boxShadow: 'var(--ssc-shadow-float)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--ssc-border-soft)' }} />
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="font-display font-black text-xl mb-2" style={{ color: 'var(--ssc-text-primary)' }}>Coming Soon!</h3>
            <p className="font-sans font-medium text-sm leading-relaxed mb-6" style={{ color: 'var(--ssc-text-secondary)' }}>
              This series will be available soon. Tap the 🔔 on any card to get notified when it goes live!
            </p>
            <button
              onClick={() => setComingSoonModal(false)}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform text-white"
              style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)' }}
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
            background: 'var(--ssc-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 24,
              padding: '24px 22px 22px',
              maxWidth: 360,
              width: '100%',
              position: 'relative',
              boxShadow: 'var(--ssc-shadow-float)',
            }}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#64748b', lineHeight: 1,
              }}
            >×</button>

            {/* ── VIEW: done ── */}
            {notifyModalView === 'done' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>✅</div>
                <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 8px' }}>
                  You&apos;re on the list!
                </p>
                <p className="t-body" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 20px' }}>
                  We&apos;ll notify you when this series is ready.
                </p>
                <button onClick={closeModal} className="t-button-lg font-display"
                  style={{ width: '100%', background: 'rgba(255,107,22,0.12)', border: '1px solid rgba(255,107,22,0.25)', color: '#FF6B16', borderRadius: 12, padding: '13px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Got it
                </button>
              </div>
            )}

            {/* ── VIEW: already joined ── */}
            {notifyModalView === 'already' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 34, marginBottom: 12 }}>🔔</div>
                <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 8px' }}>
                  Already joined
                </p>
                <p className="t-body" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 20px' }}>
                  You&apos;re already on the waitlist for this series.
                </p>
                <button onClick={closeModal} className="t-button-lg font-display"
                  style={{ width: '100%', background: 'rgba(255,107,22,0.12)', border: '1px solid rgba(255,107,22,0.25)', color: '#FF6B16', borderRadius: 12, padding: '13px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Got it
                </button>
              </div>
            )}

            {/* ── VIEW: guest sign-in prompt ── */}
            {notifyModalView === 'guest-prompt' && (
              <div>
                <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 8px' }}>
                  Sign in to get notified
                </p>
                <p className="t-body" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 20px' }}>
                  We need your email to notify you when this series launches.
                </p>
                <button
                  onClick={() => signIn('google', { callbackUrl: window.location.href })}
                  style={{ width: '100%', background: '#ffffff', color: '#3c4043', borderRadius: 12, padding: '11px 16px', fontSize: 14, fontWeight: 600, border: '1px solid #dadce0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'Roboto, sans-serif', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </button>
                <button onClick={() => setNotifyModalView('default')} className="font-display"
                  style={{ marginTop: 10, width: '100%', background: 'transparent', color: '#475569', borderRadius: 12, padding: '10px 0', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Maybe later
                </button>
              </div>
            )}

            {/* ── VIEW: default / loading ── */}
            {(notifyModalView === 'default' || notifyModalView === 'loading') && (
              <div>
                <span className="t-badge" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FF7A1A', background: 'rgba(255,122,26,0.12)', border: '1px solid rgba(255,122,26,0.20)', borderRadius: 999, padding: '3px 10px', display: 'inline-block', marginBottom: 14 }}>WAITLIST</span>

                <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: '0 0 6px' }}>
                  🔥 Want Parmar SSC quizzes?
                </p>
                <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 12px' }}>
                  Video-wise GK practice in quiz format.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                  {[['📹', 'Video-wise'], ['📝', 'Exam-style'], ['⚡', 'Quick revision']].map(([icon, label]) => (
                    <span key={label} className="t-badge" style={{ color: 'var(--ssc-text-secondary)', background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)', borderRadius: 999, padding: '5px 11px' }}>
                      {icon} {label}
                    </span>
                  ))}
                </div>

                <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', margin: '0 0 16px' }}>
                  Join the waitlist to help us prioritize this series.
                </p>

                {parmarWaitlistCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,122,26,0.08)', border: '1px solid rgba(255,122,26,0.18)' }}>
                    <span style={{ fontSize: 13 }}>🔥</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', margin: 0 }}>
                      {parmarWaitlistCount.toLocaleString()} students already interested
                    </p>
                  </div>
                )}

                <button
                  onClick={handleNotifyInterest}
                  disabled={notifyModalView === 'loading'}
                  className="font-display"
                  style={{ width: '100%', background: notifyModalView === 'loading' ? 'var(--ssc-disabled-bg)' : 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))', color: notifyModalView === 'loading' ? 'var(--ssc-disabled-text)' : '#fff', borderRadius: 16, padding: '14px 0', fontSize: 15, fontWeight: 700, border: 'none', cursor: notifyModalView === 'loading' ? 'default' : 'pointer', boxShadow: notifyModalView === 'loading' ? 'none' : 'var(--ssc-shadow-cta)', transition: 'opacity 0.2s ease' }}
                >
                  {notifyModalView === 'loading' ? 'Saving…' : '🔔 Notify Me When Ready'}
                </button>

                <p style={{ fontSize: 11, color: '#4A5A6B', textAlign: 'center', margin: '10px 0 0' }}>
                  No spam. Only one launch update.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NOTIFY TOAST ── */}
      {notifyToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[390px] z-50">
          <div
            className="rounded-[18px] px-4 py-3.5 flex items-center gap-3"
            style={{
              background: 'var(--ssc-surface)',
              border: `1px solid ${
                notifyToast.type === 'success' ? 'rgba(18,184,134,0.22)'
                : notifyToast.type === 'info' ? 'rgba(37,99,235,0.18)'
                : 'rgba(239,68,68,0.22)'
              }`,
              boxShadow: 'var(--ssc-shadow-float)',
            }}
          >
            <span
              className="text-xl flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
              style={{
                background: notifyToast.type === 'success' ? 'var(--ssc-success-soft)'
                  : notifyToast.type === 'info' ? 'var(--ssc-info-soft)'
                  : 'var(--ssc-danger-soft)',
              }}
            >
              {notifyToast.type === 'success' ? '🎉' : notifyToast.type === 'info' ? '🔔' : '⚠️'}
            </span>
            <p className="font-sans font-medium text-sm leading-snug" style={{ color: 'var(--ssc-text-primary)' }}>{notifyToast.msg}</p>
          </div>
        </div>
      )}
    </>
  );
}
