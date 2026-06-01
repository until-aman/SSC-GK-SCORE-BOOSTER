import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import DreamPostCard from '@/components/DreamPostCard';

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

const LEVEL_THRESHOLDS = {
  Aspirant: { min: 0,    max: 200,  next: 'Scholar' },
  Scholar:  { min: 200,  max: 600,  next: 'Expert' },
  Expert:   { min: 600,  max: 1500, next: 'Champion' },
  Champion: { min: 1500, max: 3000, next: 'Legend' },
  Legend:   { min: 3000, max: 3000, next: null },
};

const ChevronSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
    <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
  </svg>
);


export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [levelModal, setLevelModal] = useState(false);

  const isGuest    = typeof window !== 'undefined' ? isGuestMode() : false;
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    if (status === 'loading') return;
    if (!isLoggedIn && !isGuest) router.replace('/');
  }, [status, isLoggedIn, isGuest, router]);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    fetch('/api/user-profile')
      .then(r => r.json())
      .then(d => { setProfile(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isLoggedIn]);

  const level      = profile?.level || 'Aspirant';
  const totalCoins = profile?.totalCoins || 0;
  const streak     = profile?.streakCount || 0;

  let memberSince = '';
  if (profile?.createdAt) {
    try { memberSince = new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); } catch {}
  }

  const displayName = isLoggedIn ? (profile?.name || session?.user?.name || 'User') : 'Guest';

  if (status === 'loading' || loading) {
    return (
      <div className="h-screen flex flex-col pb-16 overflow-hidden">
        <div className="h-14 px-4 flex items-center">
          <div className="skeleton h-6 w-24 rounded-lg" />
        </div>
        <div className="skeleton h-24 rounded-3xl mx-4 mt-2" />
        <div className="skeleton h-28 rounded-2xl mx-4 mt-3" />
        <div className="skeleton h-20 rounded-2xl mx-4 mt-3" />
        <div className="skeleton h-36 rounded-2xl mx-4 mt-3" />
      </div>
    );
  }

  return (
    <>
      <Head><title>Profile — SSC GK Score Booster</title></Head>
      <div className="h-screen flex flex-col overflow-hidden pb-16">

        {/* Header bar h-14 */}
        <div className="h-14 px-4 flex items-center flex-shrink-0">
          <h1 className="t-page-title font-display text-white">Profile</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* Avatar card */}
          <div
            className="flex items-center gap-4 px-5 py-5"
            style={{
              background: '#172D47',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 22,
            }}
          >
            {/* Avatar */}
            <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0 bg-white/10">
              {isLoggedIn && session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={displayName}
                  width={72}
                  height={72}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-display font-black text-3xl text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="t-page-title font-display text-white truncate">
                {displayName}
              </span>
              {isLoggedIn && session?.user?.email && (
                <span className="font-sans text-xs text-white/45 truncate">
                  @{session.user.email.split('@')[0]}
                </span>
              )}
              {memberSince && (
                <span className="font-sans text-xs text-white/35">Member since {memberSince}</span>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isLoggedIn ? (
                  <span className="t-badge" style={{ background: 'rgba(253,186,59,0.15)', border: '1px solid rgba(253,186,59,0.3)', color: '#FDBA3B', borderRadius: 999, padding: '2px 10px' }}>
                    ⭐ {level}
                  </span>
                ) : (
                  <span className="t-badge" style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', borderRadius: 999, padding: '2px 10px' }}>
                    Guest Mode
                  </span>
                )}
                {isLoggedIn && (
                  <span className="t-badge" style={{ background: 'rgba(253,186,59,0.10)', border: '1px solid rgba(253,186,59,0.2)', color: '#FDBA3B', borderRadius: 999, padding: '2px 10px' }}>
                    🪙 {totalCoins.toLocaleString()} coins
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {/* Coins → Coins History */}
            <button
              onClick={() => !isGuest && router.push('/history')}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: '#172D47', border: '1px solid rgba(20,184,166,0.20)' }}
            >
              <span className="text-lg leading-none mb-0.5">🪙</span>
              <span className="t-stat-sm font-display" style={{ color: '#14B8A6' }}>{isGuest ? '—' : totalCoins.toLocaleString()}</span>
              <span className="t-stat-label font-sans text-slate-500">Total Coins</span>
            </button>

            {/* Streak → Streak History */}
            <button
              onClick={() => !isGuest && router.push('/streak')}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: '#172D47', border: '1px solid rgba(255,107,22,0.20)' }}
            >
              <span className="text-lg leading-none mb-0.5">🔥</span>
              <span className="t-stat-sm font-display text-orange-400">{isGuest ? '—' : streak}</span>
              <span className="t-stat-label font-sans text-slate-500">Day Streak</span>
            </button>

            {/* Level → level modal */}
            <button
              onClick={() => !isGuest && setLevelModal(true)}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: '#172D47', border: '1px solid rgba(124,92,255,0.20)' }}
            >
              <span className="text-lg leading-none mb-0.5">⭐</span>
              <span className="t-stat-sm font-display text-violet-400 text-center">{isGuest ? '—' : level}</span>
              <span className="t-stat-label font-sans text-slate-500">Level</span>
            </button>
          </div>

          {/* ── Dream Post Card ── */}
          {session && (
            <DreamPostCard coins={totalCoins} />
          )}

          {/* ── Achievements ── */}
          {(() => {
            const achievementsList = [
              // Unlocked based on real profile data
              { icon: '🔥', label: '1-Day\nStreak',      color: '#f97316', glow: 'rgba(249,115,22,0.22)',  unlocked: !isGuest && streak >= 1  },
              { icon: '🧠', label: 'GK\nStarter',         color: '#22d3ee', glow: 'rgba(34,211,238,0.22)',  unlocked: !isGuest && totalCoins > 0  },
              { icon: '⚡', label: 'Daily\nChallenger',   color: '#a78bfa', glow: 'rgba(167,139,250,0.22)', unlocked: !isGuest && totalCoins >= 50 },
              { icon: '🌟', label: '3-Day\nStreak',       color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && streak >= 3  },
              { icon: '🔥', label: '7-Day\nStreak',       color: '#f97316', glow: 'rgba(249,115,22,0.22)',  unlocked: !isGuest && streak >= 7  },
              { icon: '🏆', label: 'Champion',            color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && ['Champion','Legend'].includes(level) },
              { icon: '👑', label: 'Legend',              color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && level === 'Legend' },
              { icon: '📚', label: '100\nQuizzes',        color: '#14B8A6', glow: 'rgba(20,184,166,0.22)',  unlocked: false },
              { icon: '🏅', label: 'Top 100\nRank',       color: '#60a5fa', glow: 'rgba(96,165,250,0.22)',  unlocked: false },
            ];

            const unlocked = achievementsList.filter(b => b.unlocked);
            const locked   = achievementsList.filter(b => !b.unlocked);
            const ordered  = [...unlocked, ...locked];

            return (
              <div className="mt-4">
                <h2 className="t-card-title font-display text-white mb-2 px-1">
                  Achievements
                  <span className="font-sans font-semibold text-xs text-slate-500 ml-2">
                    {unlocked.length}/{achievementsList.length}
                  </span>
                </h2>
                <div
                  className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {ordered.map((badge) => (
                    <div
                      key={badge.label}
                      style={{
                        background: badge.unlocked
                          ? `radial-gradient(ellipse at top, ${badge.glow}, transparent 72%), rgba(255,255,255,0.04)`
                          : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${badge.unlocked ? badge.glow : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 16,
                        padding: '14px 10px 10px',
                        minWidth: 78,
                        maxWidth: 78,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        opacity: badge.unlocked ? 1 : 0.38,
                        filter: badge.unlocked ? 'none' : 'grayscale(1)',
                        transition: 'opacity 0.2s ease',
                        boxShadow: badge.unlocked ? `0 4px 18px ${badge.glow}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1, filter: badge.unlocked ? 'none' : 'grayscale(1)' }}>
                        {badge.unlocked ? badge.icon : '🔒'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: badge.unlocked ? badge.color : '#475569',
                        textAlign: 'center',
                        lineHeight: 1.35,
                        whiteSpace: 'pre-line',
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Action rows */}
          <div className="flex flex-col gap-2 mt-3">
            {/* Streak History */}
            <button
              onClick={() => router.push('/streak')}
              className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#f97316">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span className="t-card-subtitle font-sans text-white flex-1 text-left">Streak History</span>
              <ChevronSVG />
            </button>

            {/* Coins History */}
            <button
              onClick={() => router.push('/history')}
              className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="t-card-subtitle font-sans text-white flex-1 text-left">Coins History</span>
              <ChevronSVG />
            </button>

            {/* Sign Out / Sign In */}
            {isLoggedIn ? (
              <div className="mt-1">
                <p className="t-section-label font-sans text-slate-500 px-1">Account</p>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full flex items-center gap-2 px-1 py-2 active:opacity-60 transition-opacity"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  <span className="font-sans text-sm text-red-400">Sign out</span>
                </button>
              </div>
            ) : (
              <GoogleSignInCard
                title="Save your progress"
                subtitle="Login to save score, Coins, streak & rank."
                buttonText="Sign in"
                callbackUrl="/dashboard"
              />
            )}
          </div>

        </div>
      </div>

      {/* Level Progress Modal */}
      {levelModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setLevelModal(false)}
        >
          <div
            className="w-full max-w-[430px] px-5 pt-5 pb-10"
            style={{ background: '#172D47', borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,0.10)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="font-display font-black text-lg text-white mb-1">Level Progress</h3>
            <p className="font-sans text-xs text-slate-400 mb-4">Earn Coins by completing quizzes to level up.</p>

            {/* Level table */}
            <div className="flex flex-col gap-2">
              {Object.entries(LEVEL_THRESHOLDS).map(([lvl, { min, max, next }]) => {
                const isCurrent = lvl === level;
                const isUnlocked = totalCoins >= min;
                return (
                  <div
                    key={lvl}
                    style={{
                      background: isCurrent ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                      border: isCurrent ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{isUnlocked ? '⭐' : '🔒'}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: isCurrent ? '#c4b5fd' : isUnlocked ? '#ffffff' : '#64748b' }}>
                        {lvl}
                        {isCurrent && <span style={{ fontSize: 10, marginLeft: 6, color: '#a78bfa', fontWeight: 600 }}>← You</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {next ? `${min}–${max} Coins` : `${min}+ Coins`}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setLevelModal(false)}
              className="w-full mt-4 py-3 font-display font-bold text-sm text-white active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14 }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </>
  );
}
