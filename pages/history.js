import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import SessionRow from '@/components/SessionRow';
import Loader from '@/components/ui/Loader';

const LEVEL_THRESHOLDS = {
  Aspirant: { min: 0,    max: 200,  next: 'Scholar' },
  Scholar:  { min: 200,  max: 600,  next: 'Expert' },
  Expert:   { min: 600,  max: 1500, next: 'Champion' },
  Champion: { min: 1500, max: 3000, next: 'Legend' },
  Legend:   { min: 3000, max: 3000, next: null },
};


export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [xpBarWidth, setXpBarWidth] = useState(0);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const isGuest = status === 'unauthenticated';

  const fetchHistory = useCallback(() => {
    setLoading(true);
    fetch('/api/score-history')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) { setLoading(false); return; }
    fetchHistory();
  }, [status, isGuest, fetchHistory]);

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
      <div className="min-h-screen [background:var(--bg-app)] px-4 pt-10">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-white">XP History</h1>
        </div>
        <Loader card size="md" label="Fetching your XP history…" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <>
        <Head><title>XP History — SSC GK Score Booster</title></Head>
        <div className="min-h-screen [background:var(--bg-app)] pb-10">
          <div className="px-4 pt-10 pb-4 flex items-center gap-3">
            <BackButton />
            <h1 className="font-display font-black text-xl text-white">XP History</h1>
          </div>
          <GoogleSignInCard
            className="mx-4 mt-8"
            title="Track Your Progress"
            subtitle="Login to save your XP, track streaks, and see your full quiz history."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        </div>
      </>
    );
  }

  const level = data?.level || 'Aspirant';
  const totalXP = data?.totalXP || 0;
  const FILTER_FROM = new Date('2026-05-20T00:00:00+05:30').getTime();
  const sessions = (data?.sessions || []).filter(s => {
    if (!s.timestamp) return false;
    return new Date(s.timestamp).getTime() >= FILTER_FROM;
  });
  const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
  const nextLevel = thresh.next;
  const xpToNext = nextLevel ? thresh.max - totalXP : 0;

  return (
    <>
      <Head><title>XP History — SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-10">

        {/* Header */}
        <div className="px-4 pt-10 pb-4 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-white flex-1">XP History</h1>
          <button
            onClick={fetchHistory}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)' }}
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        {/* XP Hero card */}
        <div className="mx-4 rounded-3xl px-5 py-5" style={{ background: '#172D47', border: '1px solid rgba(20,184,166,0.25)' }}>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="font-display font-black text-4xl text-white leading-none">{totalXP}</p>
              <p className="font-sans text-sm text-[#14B8A6] mt-0.5">total XP earned</p>
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
              className="h-full rounded-full transition-all duration-700"
              style={{ background: 'linear-gradient(90deg, #14B8A6, #2DD4BF)', width: `${xpBarWidth}%` }}
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
            <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-4xl">🎯</span>
              <p className="font-display font-bold text-base text-white">No quizzes yet</p>
              <p className="font-sans font-medium text-sm text-slate-400">Complete a quiz to start earning XP and building your history.</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-white rounded-2xl py-3 px-6 font-display font-bold text-sm active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 12px rgba(255,107,22,0.30)' }}
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
              {(showAllSessions ? sessions : sessions.slice(0, 3)).map((s, i) => (
                <SessionRow key={`${s.timestamp}-${i}`} session={s} />
              ))}

              {sessions.length > 3 && (
                <button
                  onClick={() => setShowAllSessions(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-2xl active:scale-[0.98] transition-transform"
                  style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="font-display font-bold text-sm text-[#14B8A6]">
                    {showAllSessions ? 'Collapse history' : 'View full history'}
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round"
                    className={`transition-transform duration-300 ${showAllSessions ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* How to earn XP table */}
        <div className="mx-4 mt-5 rounded-2xl overflow-hidden" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="font-display font-bold text-base text-white">How to earn XP ⚡</p>
            <p className="font-sans text-xs text-slate-400 mt-0.5">Earn more by playing consistently</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2.5 text-left font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-2.5 text-right font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">XP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { action: 'Complete a quiz (5+ questions)', xp: '+10', color: 'text-[#14B8A6]' },
                { action: 'Each correct answer', xp: '+2', color: 'text-[#14B8A6]' },
                { action: 'First quiz of the day 🌅', xp: '+10', color: 'text-orange-400' },
                { action: 'Wrong answer', xp: '−0', color: 'text-slate-500' },
                { action: 'Skipped question', xp: '−0', color: 'text-slate-500' },
              ].map((row, i, arr) => (
                <tr key={row.action} className={i < arr.length - 1 ? 'border-b border-white/[0.05]' : ''}>
                  <td className="px-4 py-3 font-sans text-sm text-slate-300">{row.action}</td>
                  <td className={`px-4 py-3 text-right font-display font-black text-sm ${row.color}`}>{row.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3" style={{ background: 'rgba(20,184,166,0.06)', borderTop: '1px solid rgba(20,184,166,0.18)' }}>
            <p className="font-sans text-xs text-[#14B8A6]">💡 Max XP per quiz = 10 base + 2×correct + 10 first-of-day bonus</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-4 mt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 text-white rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 14px rgba(255,107,22,0.30)' }}
          >
            Practice Now →
          </button>
        </div>

      </div>
    </>
  );
}
