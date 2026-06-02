import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';

const FALLBACK_SUMMARY = {
  totalQuizzes: 0,
  totalQuestions: 0,
  overallAccuracy: 0,
  savedCount: 0,
  totalCoins: 0,
};

const ORANGE = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
const BG_CARD = '#172D47';
const BG_DEEP = '#112236';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRI = '#F0F4F8';
const TEXT_SEC = '#94A3B8';
const TEXT_MUT = '#64748B';

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const historyFeatures = [
  {
    title: 'Quiz History',
    body: 'Review attempted quizzes and re-attempt weak areas.',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
  },
  {
    title: 'Saved Questions',
    body: 'Revise bookmarked questions topic-wise.',
    icon: (
      <>
        <path d="M6 4h12v17l-6-3-6 3V4z" />
      </>
    ),
  },
  {
    title: 'Repeated Mistakes',
    body: 'See which questions you keep getting wrong.',
    icon: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      </>
    ),
  },
  {
    title: 'Coins History',
    body: 'Track quiz rewards and bonuses.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M9 10.5A3 3 0 0 1 12 8h2" />
        <path d="M15 13.5A3 3 0 0 1 12 16h-2" />
      </>
    ),
  },
  {
    title: 'Streak History',
    body: 'Monitor your practice consistency.',
    icon: (
      <>
        <path d="M8 14a4 4 0 1 0 8 0c0-3-4-4-2.5-9C10 7 8 10 8 14z" />
        <path d="M12 18a2 2 0 0 0 2-2c0-1.5-2-2-1.2-4.5C11 12.6 10 14 10 16a2 2 0 0 0 2 2z" />
      </>
    ),
  },
];

function FeatureIcon({ children }) {
  return (
    <div className="history-feature-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

const HistoryHeaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

function HistoryGuestState() {
  function handleSignIn() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: '/history' });
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <style>{`
          .history-guest-card {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            padding: 0 20px;
          }
          .history-benefit-strip {
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${BG_DEEP};
            border: 1px solid ${BORDER};
            border-radius: 999px;
            padding: 9px 14px;
            color: ${TEXT_SEC};
            font-size: 12px;
            font-weight: 800;
            line-height: 1.35;
            text-align: center;
          }
          .history-feature-row {
            display: flex;
            align-items: center;
            gap: 16px;
            min-height: 72px;
            padding: 14px 0;
            border-bottom: 1px solid ${BORDER};
          }
          .history-feature-row:last-child {
            border-bottom: none;
          }
          .history-feature-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: ${ORANGE_DIM};
            color: ${ORANGE};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .history-arrow {
            color: ${TEXT_MUT};
            flex-shrink: 0;
            margin-left: auto;
          }
          .history-preview-shell {
            position: relative;
            height: 240px;
            overflow: hidden;
            border-radius: 18px;
            background: transparent;
          }
          .history-preview-blur {
            filter: blur(6px);
            opacity: .4;
            pointer-events: none;
            user-select: none;
            padding: 4px;
          }
          .history-lock-card {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            pointer-events: none;
          }
          .history-preview-block {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
          }
          .history-google-btn {
            width: 100%;
            border: none;
            border-radius: 14px;
            padding: 14px 0;
            background: #fff;
            color: #0F172A;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
          }
          .history-google-btn:active {
            transform: scale(.98);
          }
        `}</style>

        <div
          className="sticky top-0 z-50 px-4 flex items-center justify-between"
          style={{
            height: '58px',
            background: 'rgba(15,32,52,0.88)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(20,184,166,0.18)',
            borderRadius: '0 0 22px 22px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <HistoryHeaderIcon />
            </div>
            <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center text-white">
              My History
            </span>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              PRACTICE ARCHIVE
            </span>
          </div>
        </div>

        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '22px 16px 110px', boxSizing: 'border-box' }}>

        <section className="history-benefit-strip mb-[18px]">
          Review quizzes, revise mistakes, track rewards, and continue where you left off.
        </section>

        <section className="history-guest-card mb-[18px]">
          {historyFeatures.map(feature => (
            <div key={feature.title} className="history-feature-row">
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <span className="font-display min-w-0 flex-1 text-[15px] leading-none font-extrabold" style={{ color: TEXT_PRI }}>{feature.title}</span>
              <svg className="history-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          ))}
        </section>

        <section className="history-preview-shell mb-[18px]">
          <div className="history-preview-blur">
            {[
              {
                title: 'Polity • Fundamental Rights',
                meta: '68% Accuracy',
                body: 'Review / Re-attempt',
                accent: ORANGE,
              },
              {
                title: 'Saved Question',
                meta: 'Question preview',
                body: 'Saved for revision',
                accent: '#14B8A6',
              },
              {
                title: 'Repeated Mistake',
                meta: 'Wrong 3x',
                body: 'Practice now',
                accent: '#EF4444',
              },
              {
                title: 'Rewards',
                meta: 'Total Coins',
                body: 'Weekly XP',
                accent: '#F59E0B',
              },
            ].map(({ title, meta, body, accent }) => (
              <div key={title} className="history-preview-block">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-black text-[14px]" style={{ color: TEXT_PRI }}>{title}</p>
                    <p className="font-sans text-[11px] mt-1" style={{ color: TEXT_MUT }}>{meta}</p>
                  </div>
                  <div className="h-8 w-8 rounded-xl" style={{ background: `${accent}33` }} />
                </div>
                <p className="font-sans text-[12px] mt-3" style={{ color: TEXT_SEC }}>{body}</p>
                <div className="h-2 w-2/3 rounded bg-white/10 mt-3" />
              </div>
            ))}
          </div>
          <div className="history-lock-card">
            <div className="text-center rounded-2xl px-6 py-[18px]" style={{ background: 'rgba(13,27,46,.92)', border: `1px solid ${BORDER}`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
              <div className="w-[42px] h-[42px] rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: ORANGE_DIM }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="font-display text-[15px] font-extrabold mb-1" style={{ color: TEXT_PRI }}>Your history is waiting</p>
              <p className="font-sans text-[12px]" style={{ color: TEXT_MUT }}>Sign in to unlock your quiz archive</p>
            </div>
          </div>
        </section>

        <section className="history-guest-card text-center" style={{ padding: '18px 20px', marginBottom: 0 }}>
          <button className="history-google-btn" onClick={handleSignIn}>
            <GoogleSVG />
            Continue with Google
          </button>
          <p className="font-sans text-[11px] text-slate-500 mt-3">
            Free &bull; No payment &bull; Saves your progress across devices
          </p>
        </section>
        </div>
      </div>
    </>
  );
}

function StatCell({ value, label, suffix = '' }) {
  return (
    <div className="history-stat">
      <p className="font-display font-black text-[19px] leading-none text-white">
        {value}{suffix}
      </p>
      <p className="font-sans text-[12px] font-semibold text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function ActionCard({ index, title, meta, body, onOpen }) {
  return (
    <div className="history-action-card">
      <div className="flex items-start gap-3">
        <div className="history-card-index">{index}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-black text-[16px] leading-tight text-white">{title}</h2>
              <p className="font-sans text-[12px] font-bold text-orange-300 mt-1">{meta}</p>
            </div>
            <button onClick={onOpen} className="history-open-btn">Open</button>
          </div>
          <p className="font-sans text-[13px] leading-relaxed text-slate-400 mt-2">{body}</p>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState(FALLBACK_SUMMARY);
  const [repeatedCount, setRepeatedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isGuest = status === 'unauthenticated';

  async function loadHistoryHub() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/history/landing');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setSummary(data.data?.summary || FALLBACK_SUMMARY);
      setRepeatedCount((data.data?.repeatedMistakesPreview || []).length);
    } catch {
      setError("Couldn't load history. Check connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) {
      setLoading(false);
      return;
    }
    loadHistoryHub();
  }, [status, isGuest]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-24">
        <Head><title>History - SSC GK Score Booster</title></Head>
        <h1 className="t-page-title font-display text-white mb-1">My History</h1>
        <p className="t-page-subtitle text-slate-400 mb-5">Your practice archive</p>
        <Loader card size="md" label="Loading history..." />
      </div>
    );
  }

  if (isGuest) {
    return <HistoryGuestState />;
  }

  const cards = [
    {
      title: 'Quiz History',
      meta: `${summary.totalQuizzes || 0} quizzes attempted`,
      body: 'Review past quizzes and re-attempt mistakes.',
      onOpen: () => router.push('/history/quizzes'),
    },
    {
      title: 'Saved Questions',
      meta: `${summary.savedCount || 0} saved questions`,
      body: 'Revise your bookmarked questions.',
      onOpen: () => router.push('/history/saved'),
    },
    {
      title: 'Repeated Mistakes',
      meta: `${repeatedCount} repeated mistakes`,
      body: 'Practice questions you got wrong multiple times.',
      onOpen: () => router.push('/history/mistakes'),
    },
    {
      title: 'Coins & XP',
      meta: `${summary.totalCoins || 0} coins earned`,
      body: 'Track quiz rewards and XP.',
      onOpen: () => router.push('/history/coins'),
    },
    {
      title: 'Streak History',
      meta: 'Current streak: 0 days',
      body: 'Track your practice consistency.',
      onOpen: () => router.push('/streak'),
    },
    {
      title: 'Reports',
      meta: 'Coming soon',
      body: 'Your weekly GK analysis will appear here.',
      onOpen: () => router.push('/analysis'),
    },
  ];

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-28">
        <style>{`
          .history-stat {
            background: #172D47;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 14px;
            padding: 13px 14px;
          }
          .history-action-card {
            background: #172D47;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 16px;
            padding: 14px;
          }
          .history-card-index {
            width: 28px;
            height: 28px;
            border-radius: 10px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,122,26,.14);
            color: #FDBA74;
            font-family: var(--font-display, inherit);
            font-size: 13px;
            font-weight: 900;
          }
          .history-open-btn {
            border: 1px solid rgba(255,122,26,.36);
            border-radius: 12px;
            background: rgba(255,122,26,.12);
            color: #FDBA74;
            font-size: 12px;
            font-weight: 900;
            padding: 8px 13px;
            cursor: pointer;
            flex-shrink: 0;
          }
          .history-open-btn:active {
            transform: scale(.97);
          }
        `}</style>

        <header className="mb-5">
          <h1 className="t-page-title font-display text-white">My History</h1>
          <p className="font-display text-[15px] font-bold text-slate-300 mt-2">Your practice archive</p>
          <p className="font-sans text-[13px] leading-relaxed text-slate-500 mt-1">
            Choose what you want to review or revise.
          </p>
        </header>

        {error ? (
          <div className="history-action-card text-center">
            <p className="font-display font-bold text-white">{error}</p>
            <button onClick={loadHistoryHub} className="history-open-btn mt-4">Retry</button>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 mb-5">
              <StatCell value={summary.totalQuizzes || 0} label="Quizzes" />
              <StatCell value={summary.totalQuestions || 0} label="Questions" />
              <StatCell value={summary.overallAccuracy || 0} suffix="%" label="Accuracy" />
              <StatCell value={summary.savedCount || 0} label="Saved" />
            </section>

            <section className="flex flex-col gap-3">
              {cards.map((card, index) => (
                <ActionCard key={card.title} index={index + 1} {...card} />
              ))}
            </section>
          </>
        )}
      </div>
    </>
  );
}
