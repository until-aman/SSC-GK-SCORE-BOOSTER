import { useEffect, useState } from 'react';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const RepeatedMistakesIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
  </svg>
);

export default function RepeatedMistakesPage() {
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
    <div className="min-h-screen [background:var(--bg-app)] pb-24">
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <HistoryTopBar title="Repeated Mistakes" icon={RepeatedMistakesIcon} />
      <main className="px-4 pt-5">
        <p className="t-page-subtitle text-slate-400 mb-5">Practice questions you got wrong multiple times.</p>
        {loading ? <Loader card size="md" label="Loading mistakes..." /> : (
          <div className="flex flex-col gap-3">
            {mistakes.length === 0 ? (
              <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No repeated mistakes yet.</div>
            ) : mistakes.map(item => (
              <div key={item.questionId} className="rounded-2xl p-4" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
                <p className="text-xs font-bold text-teal-400">{item.subject} &middot; {item.topic}</p>
                <p className="font-display font-bold text-white mt-2">{item.questionPreview}</p>
                <p className="text-sm text-red-300 font-bold mt-2">Wrong {item.wrongCount}x &middot; Skipped {item.skippedCount}x</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
