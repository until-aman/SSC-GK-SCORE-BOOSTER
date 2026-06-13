import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import SessionRow from '@/components/SessionRow';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getScoreHistory } from '@/lib/data/historyClientData';

const LEVEL_THRESHOLDS = {
  Aspirant: { min: 0, max: 200, next: 'Scholar' },
  Scholar: { min: 200, max: 600, next: 'Expert' },
  Expert: { min: 600, max: 1500, next: 'Champion' },
  Champion: { min: 1500, max: 3000, next: 'Legend' },
  Legend: { min: 3000, max: 3000, next: null },
};

export default function CoinsHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coinsBarWidth, setCoinsBarWidth] = useState(0);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [earnCoinsOpen, setEarnCoinsOpen] = useState(false);

  const isGuest = status === 'unauthenticated';

  const fetchHistory = useCallback(() => {
    setLoading(true);
    getScoreHistory({ scope: getUserCacheScope(session) })
      .then(res => {
        if (res?.data) setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) {
      setLoading(false);
      return;
    }
    fetchHistory();
  }, [status, isGuest, fetchHistory]);

  useEffect(() => {
    if (!data) return;
    const level = data.level || 'Aspirant';
    const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
    const isMax = !thresh.next;
    const pct = isMax
      ? 100
      : Math.min(100, ((data.totalCoins - thresh.min) / (thresh.max - thresh.min)) * 100);
    const t = setTimeout(() => setCoinsBarWidth(pct), 300);
    return () => clearTimeout(t);
  }, [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] px-4 pt-10">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-[var(--ssc-text-primary)]">Coins History</h1>
        </div>
        <Loader card size="md" label="Fetching your Coins history..." />
      </div>
    );
  }

  if (isGuest) {
    return (
      <>
        <Head><title>Coins History - SSC GK Score Booster</title></Head>
        <div className="min-h-screen bg-[var(--ssc-bg)] pb-10">
          <div className="px-4 pt-10 pb-4 flex items-center gap-3">
            <BackButton />
            <h1 className="font-display font-black text-xl text-[var(--ssc-text-primary)]">Coins History</h1>
          </div>
          <GoogleSignInCard
            className="mx-4 mt-8"
            title="Track Your Progress"
            subtitle="Login to save your Coins, track streaks, and see your full quiz history."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        </div>
      </>
    );
  }

  const level = data?.level || 'Aspirant';
  const totalCoins = data?.totalCoins || 0;
  const FILTER_FROM = new Date('2026-05-20T00:00:00+05:30').getTime();
  const sessions = (data?.sessions || []).filter(s => {
    if (!s.timestamp) return false;
    return new Date(s.timestamp).getTime() >= FILTER_FROM;
  });
  const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
  const nextLevel = thresh.next;
  const coinsToNext = nextLevel ? thresh.max - totalCoins : 0;

  return (
    <>
      <Head><title>Coins History - SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes coinsCtaPulse {
          0%, 100% {
            box-shadow: 0 4px 14px rgba(255,107,22,0.30);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 10px 28px rgba(255,107,22,0.48), 0 0 0 6px rgba(255,107,22,0.08);
            transform: scale(1.01);
          }
        }
        .coins-cta-pulse {
          animation: coinsCtaPulse 2.4s ease-in-out infinite;
        }
        .coins-cta-pulse:active {
          animation: none;
          transform: scale(0.98);
          box-shadow: 0 4px 12px rgba(255,107,22,0.22);
        }
      `}</style>
      <div className="min-h-screen bg-[var(--ssc-bg)]" style={{ paddingBottom: 'var(--ssc-bottom-nav-safe-padding, 150px)' }}>
        <div className="px-4 pt-10 pb-4 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-[var(--ssc-text-primary)] flex-1">Coins History</h1>
          <button
            onClick={fetchHistory}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        <div className="mx-4 rounded-3xl px-5 py-5" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7E6 100%)', border: '1px solid rgba(246,179,49,0.34)', boxShadow: 'var(--ssc-shadow-card)' }}>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="font-display font-black text-4xl leading-none" style={{ color: 'var(--ssc-orange-deep)' }}>{totalCoins}</p>
              <p className="font-sans text-sm text-[var(--ssc-text-secondary)] mt-0.5">total coins earned</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full px-3 py-1 font-display font-bold text-sm" style={{ background: 'var(--ssc-success-soft)', color: 'var(--ssc-teal)', border: '1px solid rgba(14,165,164,0.22)' }}>
                ⭐ {level}
              </span>
              {nextLevel && (
                <span className="font-sans text-xs text-[var(--ssc-text-muted)]">{coinsToNext} coins to {nextLevel}</span>
              )}
            </div>
          </div>

          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ssc-disabled-bg)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-coin))', width: `${coinsBarWidth}%` }}
            />
          </div>
          {nextLevel && (
            <div className="flex justify-between font-sans text-xs text-[var(--ssc-text-muted)] mt-1">
              <span>{thresh.min} coins</span>
              <span>{thresh.max} coins</span>
            </div>
          )}
        </div>

        <div className="mx-4 mt-5 rounded-2xl overflow-hidden" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
          <button
            type="button"
            onClick={() => setEarnCoinsOpen(value => !value)}
            className="w-full px-4 py-3 text-left flex items-center justify-between gap-3"
            style={{ borderBottom: earnCoinsOpen ? '1px solid var(--ssc-border-soft)' : '0' }}
          >
            <div>
              <p className="font-display font-bold text-base text-[var(--ssc-text-primary)]">How to earn coins ⚡</p>
              <p className="font-sans text-xs text-[var(--ssc-text-secondary)] mt-0.5">Earn more by playing consistently</p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ssc-text-muted)"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={`transition-transform duration-200 ${earnCoinsOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {earnCoinsOpen && (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ssc-border-soft)' }}>
                    <th className="px-4 py-2.5 text-left font-sans font-medium text-xs text-[var(--ssc-text-muted)] uppercase tracking-wide">Action</th>
                    <th className="px-4 py-2.5 text-right font-sans font-medium text-xs text-[var(--ssc-text-muted)] uppercase tracking-wide">Coins</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { action: 'Complete a quiz (5+ questions)', coins: '+10', color: 'text-[var(--ssc-teal)]' },
                    { action: 'Each correct answer', coins: '+2', color: 'text-[var(--ssc-teal)]' },
                    { action: 'First quiz of the day 🌅', coins: '+10', color: 'text-[var(--ssc-orange-deep)]' },
                    { action: 'Wrong answer', coins: '-0', color: 'text-[var(--ssc-text-muted)]' },
                    { action: 'Skipped question', coins: '-0', color: 'text-[var(--ssc-text-muted)]' },
                  ].map((row, i, arr) => (
                    <tr key={row.action} style={i < arr.length - 1 ? { borderBottom: '1px solid var(--ssc-border-soft)' } : undefined}>
                      <td className="px-4 py-3 font-sans text-sm text-[var(--ssc-text-secondary)]">{row.action}</td>
                      <td className={`px-4 py-3 text-right font-display font-black text-sm ${row.color}`}>{row.coins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3" style={{ background: 'var(--ssc-teal-soft)', borderTop: '1px solid rgba(14,165,164,0.18)' }}>
                <p className="font-sans text-xs" style={{ color: 'var(--ssc-teal)' }}>💡 Coins come from correct answers, accuracy, and completion bonuses.</p>
              </div>
            </>
          )}
        </div>

        <div className="mx-4 mt-4">
          {sessions.length === 0 ? (
            <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
              <span className="text-4xl">🎯</span>
              <p className="font-display font-bold text-base text-[var(--ssc-text-primary)]">No quizzes yet</p>
              <p className="font-sans font-medium text-sm text-[var(--ssc-text-secondary)]">Complete a quiz to start earning Coins and building your history.</p>
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
              <p className="font-display font-bold text-base text-[var(--ssc-text-primary)] mb-3">
                Recent Sessions
                <span className="font-normal font-sans text-xs text-[var(--ssc-text-muted)] ml-2">last {sessions.length}</span>
              </p>
              {(showAllSessions ? sessions : sessions.slice(0, 3)).map((s, i) => (
                <SessionRow key={`${s.timestamp}-${i}`} session={s} />
              ))}

              {sessions.length > 3 && (
                <button
                  onClick={() => setShowAllSessions(v => !v)}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-1 rounded-2xl active:scale-[0.98] transition-transform"
                  style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
                >
                  <span className="font-display font-bold text-sm text-[var(--ssc-teal)]">
                    {showAllSessions ? 'Collapse history' : 'View full history'}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--ssc-teal)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`transition-transform duration-300 ${showAllSessions ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        <div className="mx-4 mt-5">
          <button
            onClick={() => router.push('/dashboard')}
            className="coins-cta-pulse w-full py-4 text-white rounded-2xl font-display font-bold text-base transition-transform"
            style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 14px rgba(255,107,22,0.30)' }}
          >
            Practice Now →
          </button>
        </div>
      </div>
    </>
  );
}
