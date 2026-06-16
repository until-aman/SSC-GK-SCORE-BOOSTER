import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import DreamPostCard from '@/components/DreamPostCard';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getUserProfile } from '@/lib/data/profileData';

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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--ssc-text-muted)]">
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
    // Shared account-scoped profile cache (warmed by Dashboard bootstrap):
    // fresh → 0 network; stale/missing → 1 GET /api/user-profile (Step 5 deduped).
    getUserProfile({ scope: getUserCacheScope(session) })
      .then(res => { if (res?.data) setProfile(res.data); setLoading(false); })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="h-screen flex flex-col overflow-hidden pb-16 bg-[var(--ssc-bg)]">

        {/* Header bar h-14 */}
        <div className="h-14 px-4 flex items-center justify-between flex-shrink-0">
          <h1 className="t-page-title font-display text-[var(--ssc-text-primary)]">Profile</h1>
          <div className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--ssc-orange)]" />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* Avatar card */}
          <div
            className="flex items-center gap-4 px-5 py-5"
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 22,
              boxShadow: 'var(--ssc-shadow-card)',
            }}
          >
            {/* Avatar with gradient ring + edit button */}
            <div className="relative flex-shrink-0">
              <div
                className="w-[76px] h-[76px] rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f6b331 0%, #f97316 60%, #a78bfa 100%)', padding: 3 }}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-[var(--ssc-teal-soft)]">
                  {isLoggedIn && session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={displayName}
                      width={70}
                      height={70}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display font-black text-3xl text-[var(--ssc-teal)]">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Edit button */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: 'var(--ssc-teal)', border: '2px solid var(--ssc-surface)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="t-page-title font-display text-[var(--ssc-text-primary)] truncate">
                {displayName}
              </span>
              {isLoggedIn && session?.user?.email && (
                <span className="font-sans text-xs text-[var(--ssc-text-secondary)] truncate">
                  @{session.user.email.split('@')[0]}
                </span>
              )}
              {memberSince && (
                <span className="font-sans text-xs text-[var(--ssc-text-muted)]">Member since {memberSince}</span>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isLoggedIn ? (
                  <span className="t-badge" style={{ background: 'rgba(246,179,49,0.16)', border: '1px solid rgba(246,179,49,0.28)', color: 'var(--ssc-coin)', borderRadius: 999, padding: '2px 10px' }}>
                    ⭐ {level}
                  </span>
                ) : (
                  <span className="t-badge" style={{ background: 'var(--ssc-disabled-bg)', border: '1px solid var(--ssc-border-soft)', color: 'var(--ssc-text-secondary)', borderRadius: 999, padding: '2px 10px' }}>
                    Guest Mode
                  </span>
                )}
                {isLoggedIn && (
                  <span className="t-badge" style={{ background: 'rgba(246,179,49,0.12)', border: '1px solid rgba(246,179,49,0.24)', color: 'var(--ssc-coin)', borderRadius: 999, padding: '2px 10px' }}>
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
              onClick={() => !isGuest && router.push('/history/coins')}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(246,179,49,0.26)', boxShadow: 'var(--ssc-shadow-card)' }}
            >
              <span className="text-lg leading-none mb-0.5">🪙</span>
              <span className="t-stat-sm font-display" style={{ color: 'var(--ssc-coin)' }}>{isGuest ? '—' : totalCoins.toLocaleString()}</span>
              <span className="t-stat-label font-sans text-[var(--ssc-text-muted)] uppercase tracking-wide" style={{ fontSize: 9 }}>Total Coins</span>
              <span className="font-sans font-semibold text-[var(--ssc-teal)]" style={{ fontSize: 10, marginTop: 2 }}>Keep learning!</span>
            </button>

            {/* Streak → Streak History */}
            <button
              onClick={() => !isGuest && router.push('/streak')}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(245,158,11,0.26)', boxShadow: 'var(--ssc-shadow-card)' }}
            >
              <span className="text-lg leading-none mb-0.5">🔥</span>
              <span className="t-stat-sm font-display text-[var(--ssc-streak)]">{isGuest ? '—' : streak}</span>
              <span className="t-stat-label font-sans text-[var(--ssc-text-muted)] uppercase tracking-wide" style={{ fontSize: 9 }}>Day Streak</span>
              <span className="font-sans font-semibold text-[var(--ssc-orange)]" style={{ fontSize: 10, marginTop: 2 }}>You&#39;re on fire!</span>
            </button>

            {/* Level → level modal */}
            <button
              onClick={() => !isGuest && setLevelModal(true)}
              className="rounded-[18px] p-3 flex flex-col items-center gap-0.5 active:scale-[0.96] transition-transform"
              style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(109,93,246,0.24)', boxShadow: 'var(--ssc-shadow-card)' }}
            >
              <span className="text-lg leading-none mb-0.5" style={{ filter: 'hue-rotate(220deg)' }}>⭐</span>
              <span className="t-stat-sm font-display text-[var(--ssc-rank)] text-center">{isGuest ? '—' : level}</span>
              <span className="t-stat-label font-sans text-[var(--ssc-text-muted)] uppercase tracking-wide" style={{ fontSize: 9 }}>Level</span>
              <span className="font-sans font-semibold text-[var(--ssc-rank)]" style={{ fontSize: 10, marginTop: 2 }}>Keep it up!</span>
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
              { icon: '🔥', label: '1-Day\nStreak',      color: 'var(--ssc-orange)', glow: 'rgba(249,115,22,0.22)',  unlocked: !isGuest && streak >= 1  },
              { icon: '🧠', label: 'GK\nStarter',         color: '#22d3ee', glow: 'rgba(34,211,238,0.22)',  unlocked: !isGuest && totalCoins > 0  },
              { icon: '⚡', label: 'Daily\nChallenger',   color: 'var(--ssc-rank)', glow: 'rgba(167,139,250,0.22)', unlocked: !isGuest && totalCoins >= 50 },
              { icon: '🌟', label: '3-Day\nStreak',       color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && streak >= 3  },
              { icon: '🔥', label: '7-Day\nStreak',       color: 'var(--ssc-orange)', glow: 'rgba(249,115,22,0.22)',  unlocked: !isGuest && streak >= 7  },
              { icon: '🏆', label: 'Champion',            color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && ['Champion','Legend'].includes(level) },
              { icon: '👑', label: 'Legend',              color: '#fbbf24', glow: 'rgba(251,191,36,0.22)',  unlocked: !isGuest && level === 'Legend' },
              { icon: '📚', label: '100\nQuizzes',        color: 'var(--ssc-teal)', glow: 'rgba(20,184,166,0.22)',  unlocked: false },
              { icon: '🏅', label: 'Top 100\nRank',       color: '#60a5fa', glow: 'rgba(96,165,250,0.22)',  unlocked: false },
            ];

            const unlocked = achievementsList.filter(b => b.unlocked);
            const locked   = achievementsList.filter(b => !b.unlocked);
            const ordered  = [...unlocked, ...locked];

            return (
              <div className="mt-4">
                <h2 className="t-card-title font-display text-[var(--ssc-text-primary)] mb-2 px-1">
                  Achievements
                  <span className="font-sans font-semibold text-xs text-[var(--ssc-text-muted)] ml-2">
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
                          ? `radial-gradient(ellipse at top, ${badge.glow}, transparent 72%), #FFFFFF`
                          : 'var(--ssc-disabled-bg)',
                        border: `1px solid ${badge.unlocked ? badge.glow : 'var(--ssc-border-soft)'}`,
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
                        boxShadow: badge.unlocked ? `0 8px 20px ${badge.glow}` : 'none',
                      }}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1, filter: badge.unlocked ? 'none' : 'grayscale(1)' }}>
                        {badge.unlocked ? badge.icon : '🔒'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: badge.unlocked ? badge.color : 'var(--ssc-disabled-text)',
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
              className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--ssc-orange)">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <div className="flex-1 text-left">
                <span className="t-card-subtitle font-sans text-[var(--ssc-text-primary)] block">Streak History</span>
                <span className="font-sans text-xs text-[var(--ssc-text-muted)]">Track your daily learning streak</span>
              </div>
              <ChevronSVG />
            </button>

            {/* Coins History */}
            <button
              onClick={() => router.push('/history')}
              className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.5">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="flex-1 text-left">
                <span className="t-card-subtitle font-sans text-[var(--ssc-text-primary)] block">Coins History</span>
                <span className="font-sans text-xs text-[var(--ssc-text-muted)]">View your earned coins &amp; history</span>
              </div>
              <ChevronSVG />
            </button>

            {/* Sign Out / Sign In */}
            {isLoggedIn ? (
              <div className="mt-1">
                <p className="t-section-label font-sans text-[var(--ssc-text-muted)] px-1 uppercase tracking-widest mb-2" style={{ fontSize: 10 }}>Account</p>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
                  style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  <div className="flex-1 text-left">
                    <span className="font-sans font-semibold text-sm text-[var(--ssc-danger)] block">Sign out</span>
                    <span className="font-sans text-xs text-[var(--ssc-text-muted)]">Securely sign out from your account</span>
                  </div>
                  <ChevronSVG />
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
          style={{ background: 'var(--ssc-overlay)' }}
          onClick={() => setLevelModal(false)}
        >
          <div
            className="w-full max-w-[430px] px-5 pt-5 pb-10"
            style={{ background: 'var(--ssc-surface)', borderRadius: '22px 22px 0 0', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-float)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--ssc-border-soft)' }} />
            <h3 className="font-display font-black text-lg text-[var(--ssc-text-primary)] mb-1">Level Progress</h3>
            <p className="font-sans text-xs text-[var(--ssc-text-secondary)] mb-4">Earn Coins by completing quizzes to level up.</p>

            {/* Level table */}
            <div className="flex flex-col gap-2">
              {Object.entries(LEVEL_THRESHOLDS).map(([lvl, { min, max, next }]) => {
                const isCurrent = lvl === level;
                const isUnlocked = totalCoins >= min;
                return (
                  <div
                    key={lvl}
                    style={{
                      background: isCurrent ? 'rgba(109,93,246,0.10)' : 'var(--ssc-surface-soft)',
                      border: isCurrent ? '1px solid rgba(109,93,246,0.28)' : '1px solid var(--ssc-border-soft)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{isUnlocked ? '⭐' : '🔒'}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: isCurrent ? 'var(--ssc-rank)' : isUnlocked ? 'var(--ssc-text-primary)' : 'var(--ssc-text-muted)' }}>
                        {lvl}
                        {isCurrent && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--ssc-rank)', fontWeight: 600 }}>← You</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--ssc-text-muted)', fontWeight: 600 }}>
                      {next ? `${min}–${max} Coins` : `${min}+ Coins`}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setLevelModal(false)}
              className="w-full mt-4 py-3 font-display font-bold text-sm text-[var(--ssc-rank)] active:scale-[0.98] transition-transform"
              style={{ background: 'rgba(109,93,246,0.10)', border: '1px solid rgba(109,93,246,0.24)', borderRadius: 14 }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </>
  );
}
