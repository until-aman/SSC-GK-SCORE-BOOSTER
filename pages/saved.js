import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BottomNav from '@/components/BottomNav';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS   = ['optionA', 'optionB', 'optionC', 'optionD'];

const GoogleSVG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

function QuestionCard({ q, index, onUnsave }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-3xl px-4 py-4 mb-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-[10px] font-bold text-slate-500">Q{index + 1}</span>
          {q.subject && (
            <span className="font-sans text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
              {q.subject}
            </span>
          )}
          {q.topic && (
            <span className="font-sans text-[10px] text-slate-500 truncate max-w-[120px]">{q.topic}</span>
          )}
        </div>
        {/* Unsave button */}
        <button
          onClick={() => onUnsave(q.questionId)}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 active:bg-red-900/30 transition-colors"
          aria-label="Remove from saved"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
          </svg>
        </button>
      </div>

      {/* Question text */}
      <p className="font-display font-bold text-sm text-white leading-snug whitespace-pre-line mb-3">
        {q.question}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        {OPTION_LABELS.map((label, idx) => {
          const optText  = q[OPTION_KEYS[idx]];
          const isCorrect = label === q.correctOption;
          return (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                isCorrect
                  ? 'bg-emerald-500/15 border border-emerald-500/50'
                  : 'bg-slate-700/30 border border-slate-700/30'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-[10px] ${
                isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-slate-300'
              }`}>
                {label}
              </span>
              <span className={`font-sans text-xs leading-snug ${isCorrect ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                {optText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Explanation toggle */}
      {q.explanation ? (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-slate-500 font-sans font-medium active:text-slate-300 transition-colors"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
            {expanded ? 'Hide explanation' : 'Show explanation'}
          </button>
          {expanded && (
            <p className="mt-2 font-sans text-xs text-slate-400 leading-relaxed bg-slate-700/30 rounded-xl px-3 py-2.5 whitespace-pre-line">
              {q.explanation}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function Saved() {
  const { status } = useSession();
  const router = useRouter();
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  const isLoggedIn = status === 'authenticated';
  const isGuest    = status === 'unauthenticated';

  // ── Load questions ────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;

    if (isLoggedIn) {
      fetch('/api/saved-questions')
        .then(r => r.json())
        .then(d => { setQuestions(d.saved || []); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      // Guest: read from localStorage
      try {
        const raw = localStorage.getItem('savedQuestions');
        const parsed = raw ? JSON.parse(raw) : [];
        setQuestions(parsed);
      } catch { setQuestions([]); }
      setLoading(false);
    }
  }, [status, isLoggedIn]);

  // ── Unsave ────────────────────────────────────────────────────────────
  const handleUnsave = useCallback(async (questionId) => {
    if (isLoggedIn) {
      setQuestions(prev => prev.filter(q => q.questionId !== questionId));
      try {
        await fetch('/api/saved-questions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId }),
        });
      } catch {
        // Best-effort; list already updated optimistically
      }
    } else {
      const updated = questions.filter(q => q.questionId !== questionId);
      setQuestions(updated);
      try { localStorage.setItem('savedQuestions', JSON.stringify(updated)); } catch {}
    }
  }, [isLoggedIn, questions]);

  // ── Practice all ─────────────────────────────────────────────────────
  function startPractice(pool) {
    // Map to quiz-compatible shape
    const quizQuestions = pool.map(q => ({
      id:            q.questionId,
      subject:       q.subject,
      topic:         q.topic,
      question:      q.question,
      optionA:       q.optionA,
      optionB:       q.optionB,
      optionC:       q.optionC,
      optionD:       q.optionD,
      correctOption: q.correctOption,
      explanation:   q.explanation || '',
    }));
    try { sessionStorage.setItem('ssc_saved_quiz_questions', JSON.stringify(quizQuestions)); } catch {}
    router.push(`/quiz?mode=saved&count=${quizQuestions.length}`);
  }

  // ── Filter ────────────────────────────────────────────────────────────
  const filtered = activeFilter === 'All'
    ? questions
    : questions.filter(q => q.subject === activeFilter);

  // Available subject chips (only subjects with at least 1 saved question)
  const presentSubjects = ['All', ...Array.from(new Set(questions.map(q => q.subject).filter(Boolean)))];

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] pb-24">
        <div className="px-4 pt-8 pb-3 flex items-center gap-2">
          <div className="skeleton h-7 w-20 rounded-xl" />
          <div className="skeleton h-5 w-8 rounded-full" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-3xl mx-4 mb-3" />
        ))}
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <Head><title>Saved Questions — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-24">

        {/* Header */}
        <div className="px-4 pt-8 pb-3 flex items-center gap-2.5">
          <h1 className="font-display font-black text-xl text-white">Saved</h1>
          {questions.length > 0 && (
            <span className="bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-0.5 font-display font-bold text-xs text-emerald-400">
              {questions.length}
            </span>
          )}
        </div>

        {/* Guest sign-in banner */}
        {isGuest && questions.length > 0 && (
          <div className="mx-4 mb-3 bg-slate-800/80 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm text-white leading-snug">Sync across devices</p>
              <p className="font-sans text-xs text-slate-400 mt-0.5">Sign in to back up your saved questions to the cloud</p>
            </div>
            <button
              onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/saved' }); }}
              className="flex-shrink-0 flex items-center gap-1.5 bg-white text-slate-900 rounded-xl px-3 py-2 font-display font-bold text-xs active:scale-[0.97] transition-transform"
            >
              <GoogleSVG />
              Sign in
            </button>
          </div>
        )}

        {questions.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center px-6 pt-16 gap-4">
            <span className="text-6xl">🔖</span>
            <p className="font-display font-bold text-lg text-white text-center">No saved questions yet</p>
            <p className="font-sans font-medium text-sm text-slate-400 text-center max-w-[260px] leading-relaxed">
              You can bookmark questions from two places:
            </p>
            <div className="flex flex-col gap-2 text-left max-w-[220px]">
              <div className="flex items-start gap-2.5">
                <span className="font-display font-black text-xs text-emerald-400 mt-0.5 flex-shrink-0">1.</span>
                <p className="font-sans text-sm text-slate-300 leading-snug">During a quiz — tap the 🔖 icon on any question card</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="font-display font-black text-xs text-emerald-400 mt-0.5 flex-shrink-0">2.</span>
                <p className="font-sans text-sm text-slate-300 leading-snug">On the Detailed Analysis page after completing a quiz</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 bg-emerald-500 text-white rounded-2xl px-6 py-3 font-display font-bold text-sm active:scale-95 transition-transform"
            >
              Go Practice →
            </button>
          </div>
        ) : (
          <>
            {/* Subject filter chips */}
            {presentSubjects.length > 2 && (
              <div
                className="flex gap-2 overflow-x-auto mb-4"
                style={{ paddingLeft: 16, paddingRight: 16, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {presentSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setActiveFilter(sub)}
                    className={`flex-shrink-0 rounded-full px-3.5 py-1.5 font-display font-bold text-xs transition-colors ${
                      activeFilter === sub
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 border border-slate-700/50 text-slate-400'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            {/* Question list */}
            <div className="px-4">
              {filtered.length === 0 ? (
                <div className="bg-slate-800 rounded-2xl px-4 py-8 text-center">
                  <p className="font-sans text-sm text-slate-400">No saved questions in {activeFilter}</p>
                </div>
              ) : (
                filtered.map((q, idx) => (
                  <QuestionCard
                    key={q.questionId || idx}
                    q={q}
                    index={idx}
                    onUnsave={handleUnsave}
                  />
                ))
              )}
            </div>

            {/* Practice CTA — fixed above bottom nav */}
            {filtered.length > 0 && (
              <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-2 z-40">
                <button
                  onClick={() => startPractice(filtered)}
                  className="w-full bg-emerald-500 text-white rounded-2xl py-4 font-display font-bold text-base active:scale-[0.98] transition-transform shadow-lg"
                >
                  Practice {filtered.length} Question{filtered.length !== 1 ? 's' : ''} →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </>
  );
}
