import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';

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

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [xpBarWidth, setXpBarWidth] = useState(0);

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

  useEffect(() => {
    if (!profile) return;
    const thresh = LEVEL_THRESHOLDS[profile.level] || LEVEL_THRESHOLDS.Aspirant;
    const isMax = !thresh.next;
    const pct = isMax ? 100 : Math.min(100, ((profile.totalXP - thresh.min) / (thresh.max - thresh.min)) * 100);
    const t = setTimeout(() => setXpBarWidth(pct), 200);
    return () => clearTimeout(t);
  }, [profile]);

  const level      = profile?.level || 'Aspirant';
  const totalXP    = profile?.totalXP || 0;
  const streak     = profile?.streakCount || 0;
  const thresh     = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
  const nextLevel  = thresh.next;
  const xpToNext   = nextLevel ? thresh.max - totalXP : 0;

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
          <h1 className="font-display font-black text-xl text-white">Profile</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

          {/* Avatar card */}
          <div
            className="rounded-3xl px-5 py-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #0f766e 100%)' }}
          >
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/25 flex-shrink-0 bg-white/20">
              {isLoggedIn && session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={displayName}
                  width={64}
                  height={64}
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
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-display font-bold text-lg text-white truncate">{displayName}</span>
              {isLoggedIn && (
                <span className="font-sans text-xs text-white/60 truncate">{session?.user?.email}</span>
              )}
              {memberSince && (
                <span className="font-sans text-xs text-white/50">Member since {memberSince}</span>
              )}
              {isLoggedIn ? (
                <span className="bg-white/15 rounded-full px-2 py-0.5 mt-1 w-fit font-display font-bold text-xs text-white">
                  ⭐ {level}
                </span>
              ) : (
                <span className="bg-slate-500/20 rounded-full px-2 py-0.5 mt-1 w-fit font-sans text-xs text-slate-400">
                  Guest Mode
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1">
              <span className="font-display font-black text-2xl text-emerald-400">{isGuest ? '—' : totalXP}</span>
              <span className="font-sans text-xs text-slate-500 uppercase tracking-wide">Total XP</span>
            </div>
            <div className="bg-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1">
              <span className="font-display font-black text-2xl text-orange-400">{isGuest ? '—' : `🔥 ${streak}`}</span>
              <span className="font-sans text-xs text-slate-500 uppercase tracking-wide">Day Streak</span>
            </div>
            <div className="bg-slate-800 rounded-2xl p-3 flex flex-col items-center gap-1">
              <span className="font-display font-black text-2xl text-violet-400">{isGuest ? '—' : level.charAt(0)}</span>
              <span className="font-sans text-xs text-slate-500 uppercase tracking-wide">Level</span>
            </div>
          </div>

          {/* Level progress bar */}
          <div className="bg-slate-800 rounded-2xl px-4 py-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-white">{level}</span>
              <span className="font-sans text-sm text-slate-500">{nextLevel || '—'}</span>
            </div>
            <div className="mt-2 h-2 bg-slate-700 rounded-3xl border border-slate-700 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${xpBarWidth}%` }}
              />
            </div>
            <p className="text-right font-sans text-xs text-slate-500 mt-1">
              {nextLevel
                ? `${totalXP} / ${thresh.max} XP`
                : '3000+ XP — Maximum Level'}
            </p>
          </div>

          {/* Action rows */}
          <div className="flex flex-col gap-2 mt-3">
            {/* Streak History */}
            <button
              onClick={() => router.push('/streak')}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#f97316">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span className="font-sans font-medium text-sm text-white flex-1 text-left">Streak History</span>
              <ChevronSVG />
            </button>

            {/* XP History */}
            <button
              onClick={() => router.push('/history')}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-sans font-medium text-sm text-white flex-1 text-left">XP History</span>
              <ChevronSVG />
            </button>

            {/* Sign Out / Sign In */}
            {isLoggedIn ? (
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-display font-bold text-base text-red-400 flex-1 text-left">Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/dashboard' }); }}
                className="w-full bg-white text-slate-900 rounded-2xl py-3.5 flex items-center justify-center gap-2 font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                <GoogleSVG />
                Sign in with Google
              </button>
            )}
          </div>

        </div>
      </div>

      <BottomNav />
    </>
  );
}
