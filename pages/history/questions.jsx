import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const FILTERS = ['all', 'wrong', 'skipped', 'correct', 'saved'];
const TONES = {
  red: ['#fca5a5', 'rgba(239,68,68,.12)'],
  amber: ['#fcd34d', 'rgba(245,158,11,.12)'],
  green: ['#86efac', 'rgba(34,197,94,.12)'],
  blue: ['#93c5fd', 'rgba(59,130,246,.12)'],
  grey: ['#cbd5e1', 'rgba(148,163,184,.10)'],
};

function optionText(question, option) {
  return question[`option${String(option || '').toUpperCase()}`] || '';
}

function QuestionReviewCard({ item, aiCache, setAiCache, onPractice, onToggleSave }) {
  const [open, setOpen] = useState(false);
  const tone = TONES[item.masteryTone] || TONES.grey;
  const cache = aiCache[item.questionId] || { official: item.explanation || '', ai: null, loading: false };

  async function getAIExplanation() {
    if (cache.ai || cache.loading) return;
    setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, loading: true } }));
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: item.question,
          optionA: item.optionA,
          optionB: item.optionB,
          optionC: item.optionC,
          optionD: item.optionD,
          correctOption: item.correctOption,
          userOption: item.lastUserAnswer,
          explanation: item.explanation || '',
          subject: item.subject,
          topic: item.topic,
        }),
      });
      const data = await res.json();
      setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, ai: data.aiExplanation || data.explanation || null, loading: false } }));
    } catch {
      setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, loading: false } }));
    }
  }

  return (
    <article className="history-card">
      <p className="text-xs font-bold text-teal-300">{item.subject} · {item.topic}</p>
      <p className="font-display font-bold text-white leading-relaxed mt-3">"{open ? item.question : item.questionPreview}"</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-red-300">× {item.wrongCount}</span>
        <span className="text-sm font-black text-amber-300">↷ {item.skippedCount}</span>
        <span className="tone-pill" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.masteryLabel}</span>
      </div>
      {open && (
        <div className="mt-4">
          {['A', 'B', 'C', 'D'].map(option => {
            const correct = option === item.correctOption;
            const user = option === item.lastUserAnswer;
            return (
              <div key={option} className={`option-row ${correct ? 'correct' : ''} ${user && !correct ? 'wrong' : ''}`}>
                <span>{option}. {optionText(item, option) || '-'}</span>
                {user && !correct && <b>Your last answer ×</b>}
                {correct && <b>Correct ✓</b>}
              </div>
            );
          })}
          <div className="divider" />
          <p className="text-sm text-slate-300">✓ Correct {item.correctCount}x · × Wrong {item.wrongCount}x · ↷ {item.skippedCount}x</p>
          <div className="divider" />
          {item.explanation ? <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
          {cache.ai && <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p>}
          <button type="button" className="secondary-btn mt-3 w-full" disabled={cache.loading} onClick={getAIExplanation}>{cache.loading ? 'Loading...' : 'Get AI Explanation ✦'}</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mt-5">
        <button type="button" className="secondary-btn" onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Open'}</button>
        <button type="button" className="primary-btn" onClick={() => onPractice(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={() => onToggleSave(item)}>{item.isSaved ? 'Saved ★' : 'Save ☆'}</button>
      </div>
    </article>
  );
}

export default function HistoryQuestionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [aiCache, setAiCache] = useState({});

  const queryTitle = [router.query.subject, router.query.topic].filter(Boolean).join(' · ') || 'Attempted Questions';

  const loadQuestions = useCallback(async function loadQuestions(nextPage = 1, append = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...router.query, page: String(nextPage), limit: '10' });
      const res = await fetch(`/api/history/questions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setData(prev => append ? { ...json.data, questions: [...(prev?.questions || []), ...json.data.questions] } : json.data);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') { setLoading(false); return; }
    loadQuestions(1, false);
  }, [router.isReady, status, router.query.subject, router.query.topic, router.query.status, router.query.questionHistory, loadQuestions]);

  const filtered = useMemo(() => {
    const questions = data?.questions || [];
    if (activeFilter === 'all') return questions;
    if (activeFilter === 'saved') return questions.filter(item => item.isSaved);
    if (activeFilter === 'wrong') return questions.filter(item => item.wrongCount > 0);
    if (activeFilter === 'skipped') return questions.filter(item => item.skippedCount > 0);
    if (activeFilter === 'correct') return questions.filter(item => item.correctCount > 0);
    return questions;
  }, [activeFilter, data?.questions]);

  async function practiceQuestion(question) {
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions: [question],
      quizMode: 'filtered_mistakes',
      subject: question.subject,
      topic: question.topic,
      sourceCollection: question.sourceCollection || 'general',
    }));
    router.push('/quiz?mode=history&count=1&sourceScreen=history');
  }

  async function practiceFilteredSet() {
    const subject = String(router.query.subject || '');
    const topic = String(router.query.topic || '');
    const status = String(router.query.status || 'wrong_skipped');
    const questionHistory = String(router.query.questionHistory || 'all');
    const res = await fetch('/api/history/reattempt-filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject,
        topic,
        answerStatus: status === 'all' ? 'wrong_skipped' : status,
        questionHistory,
        limit: 25,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return;
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions: json.data.questions,
      quizMode: json.data.quizMode,
      subject: subject || 'History',
      topic: topic || 'Filtered Practice',
      sourceCollection: 'general',
    }));
    router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history`);
  }

  async function toggleSave(question) {
    setData(prev => ({ ...prev, questions: prev.questions.map(item => item.questionId === question.questionId ? { ...item, isSaved: !item.isSaved } : item) }));
    await fetch('/api/saved-questions/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...question, action: question.isSaved ? 'unsave' : 'save' }),
    }).catch(() => loadQuestions(page, false));
  }

  return (
    <>
      <Head><title>Question Review - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-28">
        <style>{`
          .history-card{background:#172d47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;margin-bottom:12px}.primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white}.secondary-btn{border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.04);color:#cbd5e1}.chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172d47;color:#94a3b8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap;text-transform:capitalize}.chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#fdba74}.tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900}.option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(148,163,184,.12);background:rgba(255,255,255,.035);border-radius:12px;padding:10px;margin-top:8px;color:#cbd5e1;font-size:13px}.option-row.correct{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);color:#bbf7d0}.option-row.wrong{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.10);color:#fecaca}.divider{height:1px;background:rgba(255,255,255,.07);margin:14px 0}
        `}</style>
        <HistoryTopBar title="Question Review" showBack />
        <main className="px-4 pt-5">
          <header className="mb-4">
            <h1 className="font-display text-xl font-black text-white">{queryTitle}</h1>
            <p className="text-sm text-slate-500">Attempted questions · {router.query.status || 'All'}</p>
          </header>
          {status === 'loading' || loading ? <Loader card size="md" label="Loading questions..." /> : status === 'unauthenticated' ? (
            <div className="history-card text-center text-slate-300">Sign in to review questions.</div>
          ) : (
            <>
              <section className="history-card">
                <p className="font-display font-black text-white">{data?.summary?.totalQuestions || 0} questions attempted</p>
                <p className="text-sm text-slate-400 mt-2">{data?.summary?.wrongCount || 0} wrong · {data?.summary?.skippedCount || 0} skipped · {data?.summary?.correctCount || 0} correct</p>
                {(data?.summary?.wrongCount || 0) + (data?.summary?.skippedCount || 0) > 0 && <button type="button" className="primary-btn mt-4 w-full" onClick={practiceFilteredSet}>Practice Mistakes -&gt;</button>}
              </section>
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">{FILTERS.map(filter => <button key={filter} type="button" className={`chip ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div>
              {filtered.length ? filtered.map(item => <QuestionReviewCard key={item.questionId} item={item} aiCache={aiCache} setAiCache={setAiCache} onPractice={practiceQuestion} onToggleSave={toggleSave} />) : <div className="history-card text-center text-slate-400">No questions match this filter.</div>}
              {data?.hasMore && <button type="button" className="secondary-btn w-full" onClick={() => loadQuestions(page + 1, true)}>Load 10 More</button>}
            </>
          )}
        </main>
      </div>
    </>
  );
}
