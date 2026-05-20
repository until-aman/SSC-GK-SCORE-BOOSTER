import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import SessionRow from '@/components/SessionRow';

const LEVEL_THRESHOLDS = {
  Aspirant: { min: 0,    max: 200,  next: 'Scholar' },
  Scholar:  { min: 200,  max: 600,  next: 'Expert' },
  Expert:   { min: 600,  max: 1500, next: 'Champion' },
  Champion: { min: 1500, max: 3000, next: 'Legend' },
  Legend:   { min: 3000, max: 3000, next: null },
};

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [xpBarWidth, setXpBarWidth] = useState(0);

  const isGuest = status === 'unauthenticated';

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) { setLoading(false); return; }
    fetch('/api/score-history')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, isGuest]);

  useEffect(() => {
    if (!data) return;
    const level = data.level || 'Aspirant';
    const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
    const isMax = !thresh.next;
    const pct = isMax
      ? 100
      : Math.min(100, ((data.totalXP - thresh.min) / (thresh.max - thresh.min)) * 100);
    const t = setTimeout(() => setXpBarWidth(pct), 300);
    return () => clearTimeout(t);
  }, [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] px-4 pt-10">
        <div className="skeleton h-9 w-48 rounded-xl mb-4" />
        <div className="skeleton h-28 rounded-3xl mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl mb-2" />
        ))}
      </div>
    );
  }

  if (isGuest) {
    return (
      <>
        <Head><title>XP History — SSC GK Score Booster</title></Head>
        <div className="min-h-screen bg-[#0f172a] pb-10">
          <div className="px-4 pt-10 pb-4 flex items-center gap-3">
            <BackButton />
            <h1 className="font-display font-black text-xl text-white">XP History</h1>
          </div>
          <div className="mx-4 mt-8 bg-slate-800 border border-emerald-500/20 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
            <span className="text-4xl">📊</span>
            <p className="font-display font-bold text-lg text-white">Track Your Progress</p>
            <p className="font-sans font-medium text-sm text-slate-400 leading-relaxed">Login to save your XP, track streaks, and see your full quiz history.</p>
            <button
              onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/dashboard' }); }}
              className="bg-white text-slate-900 rounded-xl py-3 px-6 flex items-center gap-2 font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              <GoogleSVG />
              Sign in with Google
            </button>
          </div>
        </div>
      </>
    );
  }

  const level = data?.level || 'Aspirant';
  const totalXP = data?.totalXP || 0;
  const sessions = data?.sessions || [];
  const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
  const nextLevel = thresh.next;
  const xpToNext = nextLevel ? thresh.max - totalXP : 0;

  return (
    <>
      <Head><title>XP History — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-10">

        {/* Header */}
        <div className="px-4 pt-10 pb-4 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-white">XP History</h1>
        </div>

        {/* XP Hero card */}
        <div className="mx-4 bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-3xl px-5 py-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="font-display font-black text-4xl text-white leading-none">{totalXP}</p>
              <p className="font-sans text-sm text-emerald-300 mt-0.5">total XP earned</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="bg-white/10 rounded-full px-3 py-1 font-display font-bold text-sm text-white">
                ⭐ {level}
              </span>
              {nextLevel && (
                <span className="font-sans text-xs text-slate-400">{xpToNext} XP to {nextLevel}</span>
              )}
            </div>
          </div>

          {/* XP progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${xpBarWidth}%` }}
            />
          </div>
          {nextLevel && (
            <div className="flex justify-between font-sans text-xs text-slate-500 mt-1">
              <span>{thresh.min} XP</span>
              <span>{thresh.max} XP</span>
            </div>
          )}
        </div>

        {/* Session list */}
        <div className="mx-4 mt-4">
          {sessions.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
              <span className="text-4xl">🎯</span>
              <p className="font-display font-bold text-base text-white">No quizzes yet</p>
              <p className="font-sans font-medium text-sm text-slate-400">Complete a quiz to start earning XP and building your history.</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-emerald-500 text-white rounded-2xl py-3 px-6 font-display font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Play Now →
              </button>
            </div>
          ) : (
            <>
              <p className="font-display font-bold text-base text-white mb-3">
                Recent Sessions
                <span className="font-normal font-sans text-xs text-slate-500 ml-2">last {sessions.length}</span>
              </p>
              {sessions.map((s, i) => (
                <SessionRow key={`${s.timestamp}-${i}`} session={s} />
              ))}
            </>
          )}
        </div>

        {/* CTA */}
        <div className="mx-4 mt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform"
          >
            Practice Now →
          </button>
        </div>

      </div>
    </>
  );
}
