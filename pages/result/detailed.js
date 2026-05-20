import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const OPTION_KEYS = { A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' };

export default function DetailedAnalysis() {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [preloadedInsights, setPreloadedInsights] = useState({});

  useEffect(() => {
    const stored = sessionStorage.getItem('quizResult');
    if (!stored) { router.push('/'); return; }
    try {
      const parsed = JSON.parse(stored);
      setResult(parsed);
      setPreloadedInsights(parsed.aiData?.insights || {});
    } catch { router.push('/'); }
  }, [router]);

  if (!result) return null;

  return (
    <>
      <Head><title>Detailed Analysis — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-10">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800 px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/result')}
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center active:bg-slate-700 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div>
            <h1 className="font-display font-black text-[18px] text-white leading-none">Detailed Analysis</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">{result.subject} · {result.topic}</p>
          </div>
        </div>

        {/* Question cards */}
        <div className="px-4 pt-4 flex flex-col gap-4">
          {result.questions.map((q, idx) => (
            <QuestionReviewCard
              key={q.id}
              question={q}
              index={idx}
              userAnswer={result.answers[q.id]}
              subject={result.subject}
              topic={result.topic}
              preloadedInsight={preloadedInsights[q.id]}
            />
          ))}
        </div>

        {/* Back button */}
        <div className="px-4 mt-6">
          <button
            onClick={() => router.push('/result')}
            className="w-full py-4 rounded-2xl bg-orange-500 text-white font-display font-bold text-[15px] active:scale-[0.98] transition-transform shadow-[0_0_16px_rgba(249,115,22,0.3)]"
          >
            Back to Results
          </button>
        </div>
      </div>
    </>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#10b981' : 'none'} stroke={filled ? '#10b981' : '#475569'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  );
}

function QuestionReviewCard({ question, index, userAnswer, subject, topic, preloadedInsight }) {
  const [aiInsight, setAiInsight] = useState(preloadedInsight ?? null);
  const [loading, setLoading] = useState(preloadedInsight === undefined);
  const [isSaved, setIsSaved] = useState(false);
  const isCorrect = userAnswer === question.correctOption;
  const isSkipped = !userAnswer || userAnswer === 'SKIPPED';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]');
      setIsSaved(saved.some(q => q.id === question.id));
    } catch {}
  }, [question.id]);

  function toggleSave() {
    try {
      const saved = JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]');
      const updated = isSaved
        ? saved.filter(q => q.id !== question.id)
        : [...saved, { ...question, subject, topic }];
      localStorage.setItem('ssc_saved_questions', JSON.stringify(updated));
      setIsSaved(!isSaved);
    } catch {}
  }

  useEffect(() => {
    if (preloadedInsight !== undefined) {
      setAiInsight(preloadedInsight);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => fetchAiInsight(), index * 200);
    return () => clearTimeout(timer);
  }, [preloadedInsight]);

  async function fetchAiInsight() {
    if (isCorrect) return;
    setLoading(true);
    const endpoint = isSkipped ? '/api/ai/tip' : '/api/ai/explain';
    const body = isSkipped
      ? { question: question.question, correctOption: question.correctOption, correctOptionText: question[OPTION_KEYS[question.correctOption]], explanation: question.explanation, subject, topic }
      : { question: question.question, optionA: question.optionA, optionB: question.optionB, optionC: question.optionC, optionD: question.optionD, correctOption: question.correctOption, userOption: userAnswer, explanation: question.explanation, subject, topic };
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAiInsight(isSkipped ? data.aiTip : (data.aiExplanation || data.fallback));
    } catch {
      setAiInsight(question.explanation || 'Review this concept in your study material.');
    } finally {
      setLoading(false);
    }
  }

  const normalizeText = (text = '') => text.toLowerCase().trim();
  const isExplanationRedundant = (explanation, insight) => {
    if (!explanation || !insight) return false;
    const base = normalizeText(explanation);
    const ai = normalizeText(insight);
    return base === ai || ai.includes(base) || base.includes(ai);
  };

  const statusColor = isCorrect ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : isSkipped ? 'text-slate-400 bg-slate-700/50 border-slate-600/30'
    : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <div className="bg-slate-800/70 border border-slate-700/40 rounded-3xl p-5">
      {/* Card header */}
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Q{index + 1}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSave}
            className="w-7 h-7 flex items-center justify-center rounded-full active:scale-90 transition-transform"
            aria-label={isSaved ? 'Unsave question' : 'Save question'}
          >
            <BookmarkIcon filled={isSaved} />
          </button>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase ${statusColor}`}>
            {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
          </span>
        </div>
      </div>

      {/* Question text */}
      <p className="text-white font-semibold text-sm leading-snug mb-4 whitespace-pre-line">{question.question}</p>

      {/* Options */}
      <div className="flex flex-col gap-2 mb-4">
        {['A', 'B', 'C', 'D'].map(opt => {
          const isThisUser    = userAnswer === opt;
          const isThisCorrect = question.correctOption === opt;
          let cls = 'text-[12px] px-4 py-3 rounded-xl border flex justify-between items-center';
          if (isThisCorrect)                    cls += ' bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold';
          else if (isThisUser && !isThisCorrect) cls += ' bg-red-500/15 border-red-500/40 text-red-300 font-bold';
          else                                  cls += ' bg-slate-900/40 border-slate-700/40 text-slate-500';
          return (
            <div key={opt} className={cls}>
              <span>{opt}. {question[OPTION_KEYS[opt]]}</span>
              {isThisCorrect && <span>✅</span>}
              {isThisUser && !isThisCorrect && <span>❌</span>}
            </div>
          );
        })}
      </div>

      {/* Static explanation */}
      {question.explanation && !isExplanationRedundant(question.explanation, aiInsight) && (
        <div className="mb-3 px-4 py-3 bg-slate-900/60 border border-slate-700/40 rounded-2xl">
          <span className="block text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Explanation</span>
          <p className="text-[12px] text-slate-400 leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {/* AI insight (wrong/skipped only) */}
      {!isCorrect && (
        <div className="px-4 py-4 bg-orange-500/8 border border-orange-500/20 rounded-2xl min-h-[60px] flex flex-col justify-center">
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span>🤖 AI Mentor Insight</span>
            {loading && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping" />}
          </p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-2 bg-orange-500/10 rounded w-full animate-pulse" />
              <div className="h-2 bg-orange-500/10 rounded w-5/6 animate-pulse" />
            </div>
          ) : (
            <p className="text-[12px] text-orange-200 leading-relaxed italic font-medium">
              &quot;{aiInsight || 'Reviewing...'}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
