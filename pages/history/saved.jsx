import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';

export default function HistorySavedPage() {
  const router = useRouter();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/saved-questions')
      .then(res => res.json())
      .then(data => setSaved(data.saved || []))
      .catch(() => setSaved([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-24">
      <Head><title>Saved Questions - SSC GK Score Booster</title></Head>
      <button onClick={() => router.push('/history')} className="text-sm font-bold text-slate-400 mb-4">← Back</button>
      <h1 className="t-page-title font-display text-white">Saved Questions</h1>
      <p className="t-page-subtitle text-slate-400 mb-5">Revise your bookmarked questions.</p>
      {loading ? <Loader card size="md" label="Loading saved questions..." /> : (
        <div className="flex flex-col gap-3">
          {saved.length === 0 ? (
            <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No saved questions yet.</div>
          ) : saved.map(item => (
            <div key={item.questionId} className="rounded-2xl p-4" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
              <p className="text-xs font-bold text-teal-400">{item.subject} · {item.topic}</p>
              <p className="font-display font-bold text-white mt-2">{item.question}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
