import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';

export default function RepeatedMistakesPage() {
  const router = useRouter();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history/landing')
      .then(res => res.json())
      .then(data => setMistakes(data.data?.repeatedMistakesPreview || []))
      .catch(() => setMistakes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen [background:var(--bg-app)] px-4 pt-8 pb-24">
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <button onClick={() => router.push('/history')} className="text-sm font-bold text-slate-400 mb-4">← Back</button>
      <h1 className="t-page-title font-display text-white">Repeated Mistakes</h1>
      <p className="t-page-subtitle text-slate-400 mb-5">Practice questions you got wrong multiple times.</p>
      {loading ? <Loader card size="md" label="Loading mistakes..." /> : (
        <div className="flex flex-col gap-3">
          {mistakes.length === 0 ? (
            <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No repeated mistakes yet.</div>
          ) : mistakes.map(item => (
            <div key={item.questionId} className="rounded-2xl p-4" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
              <p className="text-xs font-bold text-teal-400">{item.subject} · {item.topic}</p>
              <p className="font-display font-bold text-white mt-2">{item.questionPreview}</p>
              <p className="text-sm text-red-300 font-bold mt-2">Wrong {item.wrongCount}x · Skipped {item.skippedCount}x</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
