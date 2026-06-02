import { useEffect, useState } from 'react';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const SavedQuestionsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12v17l-6-3-6 3V4z" />
  </svg>
);

export default function HistorySavedPage() {
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
    <div className="min-h-screen [background:var(--bg-app)] pb-24">
      <Head><title>Saved Questions - SSC GK Score Booster</title></Head>
      <HistoryTopBar title="Saved Questions" icon={SavedQuestionsIcon} />
      <main className="px-4 pt-5">
        <p className="t-page-subtitle text-slate-400 mb-5">Revise your bookmarked questions.</p>
        {loading ? <Loader card size="md" label="Loading saved questions..." /> : (
          <div className="flex flex-col gap-3">
            {saved.length === 0 ? (
              <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No saved questions yet.</div>
            ) : saved.map(item => (
              <div key={item.questionId} className="rounded-2xl p-4" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
                <p className="text-xs font-bold text-teal-400">{item.subject} &middot; {item.topic}</p>
                <p className="font-display font-bold text-white mt-2">{item.question}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
