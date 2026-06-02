import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const QuizHistoryIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="16" rx="2" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
    <path d="M9 16h4" />
  </svg>
);

export default function QuizHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history/quizzes?page=1&limit=10')
      .then(res => res.json())
      .then(data => setSessions(data.data?.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen [background:var(--bg-app)] pb-24">
      <Head><title>Quiz History - SSC GK Score Booster</title></Head>
      <HistoryTopBar title="Quiz History" icon={QuizHistoryIcon} />
      <main className="px-4 pt-5">
        <p className="t-page-subtitle text-slate-400 mb-5">Review past quizzes and re-attempt mistakes.</p>
        {loading ? <Loader card size="md" label="Loading quizzes..." /> : (
          <div className="flex flex-col gap-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl p-5 text-slate-400" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>No quiz history yet.</div>
            ) : sessions.map(item => (
              <button key={item.sessionId} onClick={() => router.push(`/history/session/${item.sessionId}`)} className="text-left rounded-2xl p-4 active:scale-[.99] transition-transform" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,.08)' }}>
                <p className="font-display font-bold text-white">{item.subject} &middot; {item.topic}</p>
                <p className="text-sm text-slate-400 mt-1">{item.correct} correct &middot; {item.incorrect} wrong &middot; {item.skipped} skipped</p>
                <p className="text-xs text-orange-300 font-bold mt-2">Open review</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
