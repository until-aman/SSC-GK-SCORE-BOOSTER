import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BottomNav from '@/components/BottomNav';

export default function Saved() {
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ssc_saved_questions');
      setQuestions(stored ? JSON.parse(stored) : []);
    } catch { setQuestions([]); }
    setLoaded(true);
  }, []);

  function removeQuestion(id) {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    try { localStorage.setItem('ssc_saved_questions', JSON.stringify(updated)); } catch {}
  }

  function clearAll() {
    setQuestions([]);
    try { localStorage.removeItem('ssc_saved_questions'); } catch {}
  }

  function startPractice() {
    try { sessionStorage.setItem('ssc_saved_quiz_questions', JSON.stringify(questions)); } catch {}
    router.push(`/quiz?mode=saved&count=${questions.length}`);
  }

  if (!loaded) return null;

  return (
    <>
      <Head><title>Saved Questions — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-28">

        {/* Header */}
        <div className="px-4 pt-8 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-[22px] text-white">Saved</h1>
            {questions.length > 0 && (
              <span className="bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-[12px] font-bold text-emerald-400">
                {questions.length}
              </span>
            )}
          </div>
          {questions.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[12px] text-slate-500 active:text-slate-300 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {questions.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center px-6 pt-16 gap-4">
            <span className="text-6xl">🔖</span>
            <p className="font-display font-bold text-[18px] text-white text-center">No saved questions yet</p>
            <p className="text-slate-500 text-[13px] text-center max-w-[260px] leading-relaxed">
              Tap the bookmark icon on any question in Detailed Analysis to save it for later practice.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 bg-emerald-500 text-white rounded-2xl px-6 py-3 font-display font-bold text-sm active:scale-95 transition-transform"
            >
              Go Practice →
            </button>
          </div>
        ) : (
          <>
            {/* ── Question list ── */}
            <div className="px-4 flex flex-col gap-3">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500">Q{idx + 1}</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 truncate max-w-[120px]">
                          {q.subject}
                        </span>
                        {q.topic && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{q.topic}</span>
                        )}
                      </div>
                      <p className="font-sans font-medium text-sm text-white leading-snug whitespace-pre-line">
                        {q.question}
                      </p>
                    </div>
                    {/* Remove bookmark */}
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 active:bg-slate-700 transition-colors"
                      aria-label="Remove from saved"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Practice button fixed above nav ── */}
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-2 z-40">
              <button
                onClick={startPractice}
                className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-display font-bold text-[15px] btn-breathe active:scale-[0.98] transition-transform shadow-cta"
              >
                Practice All ({questions.length} question{questions.length !== 1 ? 's' : ''}) →
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}
