import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';
import { getSubjectStyle, subjectStyles } from '@/lib/subjects';
import { getISTDateString } from '@/lib/streak';

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

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [userProfile, setUserProfile]   = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [topPlayers, setTopPlayers]     = useState([]);
  const [seriesScrollPct,  setSeriesScrollPct]  = useState(0);
  const [comingSoonModal,  setComingSoonModal]  = useState(false);
  const [notifyState,      setNotifyState]      = useState({}); // { [seriesId]: 'idle'|'loading'|'done'|'already' }
  const [notifyToast,      setNotifyToast]      = useState(null); // { msg, type }
  const [subjectChecking,  setSubjectChecking]  = useState(null); // subject name being checked
  const [lowQModal,        setLowQModal]        = useState(null); // subject name with low questions
  const seriesCarouselRef  = useRef(null);

  const handleSeriesScroll = useCallback(() => {
    const el = seriesCarouselRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setSeriesScrollPct(max > 0 ? el.scrollLeft / max : 0);
  }, []);

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

  // Fetch top 10 weekly players
  useEffect(() => {
    fetch('/api/leaderboard?scope=weekly')
      .then(r => r.json())
      .then(data => setTopPlayers((data.leaders || []).slice(0, 10)))
      .catch(() => {});
  }, []);

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

  const displayName     = isLoggedIn ? (userProfile?.name || session?.user?.name || 'User') : 'Guest';
  const googlePhoto     = session?.user?.image || null;
  const streakCount     = userProfile?.streakCount || 0;
  const lastAttemptDate = userProfile?.lastAttemptDate || '';
  const level           = userProfile?.level || 'Aspirant';
  const totalXP         = userProfile?.totalXP || 0;
  const playedToday     = lastAttemptDate === getISTDateString();
  const { done, todayIdx } = getStreakDays(streakCount, lastAttemptDate);

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
            <Avatar imageUrl={googlePhoto} name={displayName} size={36} />
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
            <button
              onClick={() => isLoggedIn && router.push('/profile')}
              className="bg-yellow-500/20 border border-yellow-400/50 rounded-full px-3 py-1.5 flex items-center gap-1.5"
            >
              <span className="text-[14px] leading-none" style={{ filter: 'drop-shadow(0 0 4px rgba(234,179,8,0.7))' }}>🪙</span>
              <span className={`font-display font-bold text-xs ${isGuest ? 'text-slate-600' : 'text-yellow-400'}`}>
                {isGuest ? '0' : totalXP}
              </span>
            </button>
            <NotificationBell streakCount={userProfile?.streakCount || 0} />
          </div>
        </div>

        {/* ── WELCOME MESSAGE ── */}
        <div className="px-4 mb-4">
          <h2 className="font-display font-black text-3xl text-white leading-tight">
            {getGreeting()},
          </h2>
          <h2 className="font-display font-black text-3xl leading-tight" style={{
            background: 'linear-gradient(90deg, #10b981, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {displayName.split(' ')[0]} 👋
          </h2>
          <p className="font-sans font-medium text-sm text-slate-400 mt-1">
            {isGuest
              ? 'Sign in to save your progress and streak.'
              : playedToday
                ? "You've already played today. Keep it up! 🔥"
                : "Ready to boost your GK score today?"}
          </p>
        </div>

        {/* ── STREAK HISTORY CARD ── */}
        {isLoggedIn && !profileLoading && (
          <button
            onClick={() => router.push('/streak')}
            className="mx-4 bg-slate-800 border border-slate-700/50 rounded-3xl px-4 py-4 w-[calc(100%-2rem)] text-left active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-bold text-base text-white">This Week</span>
              <div className="flex items-center gap-1 text-slate-500">
                <span className="font-sans text-xs">View all</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
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
              <LightningSVG size={16} color="#f97316" />
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
          <div className="mx-4 mt-5 bg-slate-800/80 border border-emerald-500/20 rounded-2xl px-4 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm text-white leading-snug">Save your progress</p>
              <p className="font-sans text-xs text-slate-400 mt-0.5">Sign in to track XP, streaks &amp; rank</p>
            </div>
            <button
              onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/dashboard' }); }}
              className="flex-shrink-0 flex items-center gap-2 bg-white text-slate-900 rounded-xl px-3 py-2 font-display font-bold text-xs active:scale-[0.97] transition-transform"
            >
              <svg width="14" height="14" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
                <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in
            </button>
          </div>
        )}

        {/* ── TOP THIS WEEK — horizontal carousel ── */}
        <div className="mt-5">
          <div className="px-4 flex items-center justify-between mb-3">
            <p className="font-display font-bold text-base text-white">Top this week</p>
            <button
              onClick={() => router.push('/leaderboard')}
              className="flex items-center gap-1 text-emerald-400 text-xs font-sans font-medium"
            >
              See all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {topPlayers.length === 0 ? (
            <div className="mx-4 bg-slate-800 rounded-2xl px-4 py-4 text-center">
              <p className="font-sans text-xs text-slate-500">No scores yet this week. Be the first!</p>
            </div>
          ) : (
            <div
              className="flex gap-3 overflow-x-auto"
              style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {topPlayers.map((player, i) => {
                const isSelf = player.email === session?.user?.email;
                return (
                  <div
                    key={player.email || i}
                    className={`flex-shrink-0 flex flex-col items-center rounded-2xl px-3 pt-4 pb-3 ${
                      isSelf
                        ? 'bg-emerald-900/40 border border-emerald-500/40'
                        : 'bg-slate-800 border border-slate-700/50'
                    }`}
                    style={{ width: 80 }}
                  >
                    {/* Avatar + medal badge overlapping */}
                    <div className="relative mb-2">
                      <Avatar imageUrl={player.image || null} name={player.name} size={44} />
                      {/* Medal sits half on avatar, half below-left */}
                      <span
                        className="absolute text-[16px] leading-none"
                        style={{ bottom: -6, left: -6 }}
                      >
                        {RANK_MEDALS[i] || (
                          <span className="bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center font-display font-black text-[10px] text-slate-300">
                            {i + 1}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Name */}
                    <p className={`font-sans font-medium text-xs text-center leading-tight truncate w-full ${
                      isSelf ? 'text-emerald-300' : 'text-white'
                    }`}>
                      {(player.name || 'User').split(' ')[0]}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── DISCOVER SUBJECTS — horizontal carousel ── */}
        <div className="mt-5">
          <div className="px-4 mb-3">
            <p className="font-display font-bold text-base text-white">Discover Subjects</p>
          </div>
          <div
            className="flex gap-3 overflow-x-auto"
            style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {SUBJECTS.map(subject => {
              const style = getSubjectStyle(subject);
              const isChecking = subjectChecking === subject;
              return (
                <button
                  key={subject}
                  onClick={() => handleSubjectClick(subject)}
                  disabled={!!subjectChecking}
                  className={`bg-gradient-to-br ${style.gradient} rounded-3xl px-5 py-5 flex flex-col items-start gap-3 transition-transform shadow-lg flex-shrink-0 ${isChecking ? 'opacity-80' : 'active:scale-[0.97]'}`}
                  style={{ width: 130, minHeight: 120 }}
                >
                  {isChecking ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <span className="text-3xl">{style.icon}</span>
                  )}
                  <span className="font-display font-bold text-sm text-white leading-tight text-left">{subject}</span>
                </button>
              );
            })}
          </div>

        </div>

        {/* ── PARMAR SSC SERIES ── */}
        <div className="mt-6 mb-4">
          <div className="px-4 mb-1">
            <p className="font-display font-bold text-base text-white">Parmar SSC content in Quiz format</p>
            <p className="font-sans text-xs text-slate-500 mt-0.5">Practice series in quiz format</p>
          </div>

          <div
            ref={seriesCarouselRef}
            onScroll={handleSeriesScroll}
            className="flex gap-3 overflow-x-auto mt-3"
            style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {PARMAR_SERIES.map(series => {
              const ns = notifyState[series.id] || 'idle';
              const notified = ns === 'done' || ns === 'already';
              return (
                <div
                  key={series.id}
                  onClick={() => setComingSoonModal(true)}
                  className={`bg-gradient-to-br ${series.gradient} rounded-3xl px-4 pt-3 pb-4 flex flex-col items-start gap-2 active:scale-[0.97] transition-transform shadow-lg flex-shrink-0 relative cursor-pointer`}
                  style={{ width: 150, minHeight: 140 }}
                >
                  {/* Notify bell — top right */}
                  <button
                    onClick={(e) => handleNotify(e, series)}
                    className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      notified
                        ? 'bg-white/30'
                        : 'bg-black/20 active:scale-90'
                    }`}
                    title={notified ? 'Notified!' : 'Notify me'}
                  >
                    {ns === 'loading' ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : notified ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                      </svg>
                    )}
                  </button>

                  {/* Icon */}
                  <span className="text-3xl mt-1">{series.icon}</span>

                  {/* Title */}
                  <div className="flex-1">
                    <p className="font-display font-bold text-sm text-white leading-tight">{series.title}</p>
                    {series.subtitle && (
                      <p className="font-display font-bold text-xs text-white/80 leading-tight mt-0.5">{series.subtitle}</p>
                    )}
                  </div>

                  {/* Coming Soon pill */}
                  <span className="bg-black/25 rounded-full px-2.5 py-1 text-xs text-white font-display font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 inline-block animate-pulse" />
                    Coming Soon
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scroll progress bar */}
          <div className="mx-4 mt-3 h-1 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-150"
              style={{ width: `${Math.round(seriesScrollPct * 100)}%`, minWidth: '33%' }}
            />
          </div>
        </div>

      </div>
      <BottomNav />

      {/* ── LOW QUESTIONS MODAL ── */}
      {lowQModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setLowQModal(null)}
        >
          <div
            className="w-full max-w-[360px] bg-[#1e293b] border border-slate-700/60 rounded-3xl px-6 py-8 text-center"
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
