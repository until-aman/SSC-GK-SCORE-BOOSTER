import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';

export default function CoinsHistoryPage() {
  const router = useRouter();
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
    <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-24">
      <Head><title>Coins & XP - SSC GK Score Booster</title></Head>
      <button onClick={() => router.push('/history')} className="text-sm font-bold text-slate-400 mb-4">← Back</button>
      <h1 className="t-page-title font-display text-white">Coins & XP</h1>
      <p className="t-page-subtitle text-slate-400 mb-5">Track quiz rewards and XP.</p>
      {loading ? <Loader card size="md" label="Loading rewards..." /> : (
        <div className="rounded-2xl p-5" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
          <p className="font-display font-black text-3xl text-white">{summary?.totalCoins || 0}</p>
          <p className="text-sm text-slate-400 mt-1">Total coins earned</p>
          <p className="text-sm text-orange-300 font-bold mt-4">This week: +{summary?.weeklyCoins || 0}</p>
        </div>
      )}
    </div>
  );
}
