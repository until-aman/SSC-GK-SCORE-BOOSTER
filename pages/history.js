import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';

const FALLBACK_SUMMARY = {
  totalQuizzes: 0,
  totalQuestions: 0,
  overallAccuracy: 0,
  savedCount: 0,
  totalCoins: 0,
};

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
    return (
      <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-24">
        <Head><title>History - SSC GK Score Booster</title></Head>
        <h1 className="t-page-title font-display text-white mb-1">My History</h1>
        <p className="t-page-subtitle text-slate-400 mb-5">Your practice archive</p>
        <GoogleSignInCard
          title="Sign in to see your history"
          subtitle="Track quizzes, saved questions, mistakes, Coins and reports."
          buttonText="Continue with Google"
          callbackUrl="/history"
        />
      </div>
    );
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
