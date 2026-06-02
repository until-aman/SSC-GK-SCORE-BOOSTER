import { useEffect, useState } from 'react';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const CoinsHistoryIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8" />
    <path d="M9 10.5A3 3 0 0 1 12 8h2" />
    <path d="M15 13.5A3 3 0 0 1 12 16h-2" />
  </svg>
);

export default function CoinsHistoryPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history/landing')
      .then(res => res.json())
      .then(data => setSummary(data.data?.summary || null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen [background:var(--bg-app)] pb-24">
      <Head><title>Coins History - SSC GK Score Booster</title></Head>
      <HistoryTopBar title="Coins History" icon={CoinsHistoryIcon} />
      <main className="px-4 pt-5">
        <p className="t-page-subtitle text-slate-400 mb-5">Track quiz rewards and activity.</p>
        {loading ? <Loader card size="md" label="Loading rewards..." /> : (
          <div className="rounded-2xl p-5" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
            <p className="font-display font-black text-3xl text-white">{summary?.totalCoins || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Total coins earned</p>
            <p className="text-sm text-orange-300 font-bold mt-4">This week: +{summary?.weeklyCoins || 0}</p>
          </div>
        )}
      </main>
    </div>
  );
}
