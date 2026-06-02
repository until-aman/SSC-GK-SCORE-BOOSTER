import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const FILTERS = ['Wrong + Skipped', 'Wrong', 'Skipped', 'Correct', 'Saved', 'All'];
const TONES = {
  red: ['#FCA5A5', 'rgba(239,68,68,0.12)'],
  amber: ['#FCD34D', 'rgba(245,158,11,0.12)'],
  green: ['#86EFAC', 'rgba(34,197,94,0.12)'],
  blue: ['#93C5FD', 'rgba(59,130,246,0.12)'],
  orange: ['#FDBA74', 'rgba(255,122,26,0.12)'],
  grey: ['#CBD5E1', 'rgba(148,163,184,0.10)'],
};

const QuizReviewIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

function formatDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently';
  return date.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatTime(seconds) {
  const total = Number(seconds) || 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins ? `${mins}m ${secs}s` : `${secs}s`;
}

function optionText(question, option) {
  if (!option) return '';
  return question[`option${option}`] || '';
}

function insight(session) {
  const incorrect = Number(session.incorrect) || 0;
  const skipped = Number(session.skipped) || 0;
  const accuracy = Number(session.accuracy) || 0;
  if (skipped > 0 && incorrect > 0) return `You lost ${incorrect * 0.5} marks and left ${skipped} questions unanswered. Re-attempt ${incorrect + skipped} questions to recover marks.`;
  if (incorrect > 0) return `You lost ${incorrect * 0.5} marks from wrong answers. Practice the ${incorrect} wrong questions to fix these gaps.`;
  if (skipped > 0) return `You skipped ${skipped} questions. Revise this topic once before attempting again.`;
  if (accuracy >= 75) return 'Strong performance. Re-attempt to push accuracy above 85%.';
  return 'Review this attempt and practice again to improve accuracy.';
}

function QuestionCard({ item, onToggleSave, onPracticeOne }) {
  const [expanded, setExpanded] = useState(false);
  const [cache, setCache] = useState(null);
  const tone = TONES[item.masteryTone] || TONES.grey;
  const status = item.isSkipped ? 'Skipped' : item.isCorrect ? 'Correct' : 'Wrong';

  // AI CALL RULES FOR HISTORY TAB
  // 1. NEVER call AI automatically on any page load
  // 2. NEVER call AI for all questions when review screen opens
  // 3. NEVER call AI for correct answers (no explanation needed by default)
  // 4. ONLY call AI when user explicitly taps "Get AI Explanation" button
  // 5. ALWAYS check component state cache before calling AI
  // 6. ALWAYS show official sheet explanation first if it exists
  // 7. ALWAYS fall back to official explanation silently if AI fails
  // 8. CACHE AI response in component state (key: questionId)
  //    so repeated taps on same question never call API twice
  function handleShowExplanation() {
    setExpanded(value => !value);
    if (cache) return;
    setCache({ official: item.explanation || '', ai: null, loading: false });
  }

  async function handleGetAIExplanation() {
    if (item.isCorrect) return;
    if (cache?.ai || cache?.loading) return;
    setCache(prev => ({ ...(prev || { official: item.explanation || '', ai: null }), loading: true }));
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
          userOption: item.userAnswer,
          explanation: item.explanation || '',
          subject: item.subject,
          topic: item.topic,
        }),
      });
      const data = await res.json();
      setCache(prev => ({ ...(prev || {}), ai: data.aiExplanation || data.explanation || null, loading: false }));
    } catch {
      setCache(prev => ({ ...(prev || { official: item.explanation || '', ai: null }), loading: false }));
    }
  }

  return (
    <div className="review-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-black text-white">Q{item.questionNumber}</span>
          <span className={`status ${status.toLowerCase()}`}>{status}</span>
          <span className="text-xs text-slate-500">{item.timeTakenSeconds || 0}s taken</span>
        </div>
        <button onClick={() => onToggleSave(item)} className="save-btn">{item.isSaved ? '★ Saved' : '☆ Save'}</button>
      </div>

      <p className="font-display font-bold text-white leading-relaxed mb-4">{item.question}</p>

      {item.isSkipped ? (
        <p className="text-sm text-amber-200 mb-2">↷ You skipped this question</p>
      ) : (
        <p className={`text-sm mb-2 ${item.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
          {item.isCorrect ? '✓' : '✕'} Your Answer: {optionText(item, item.userAnswer) || item.userAnswer || '-'} {item.userAnswer && `(Option ${item.userAnswer})`}
        </p>
      )}
      {!item.isCorrect && (
        <p className="text-sm text-emerald-300 mb-4">✓ Correct Answer: {optionText(item, item.correctOption) || item.correctOption} (Option {item.correctOption})</p>
      )}

      <div className="divider" />
      <p className="text-xs text-slate-400 mb-2">Your history on this question:</p>
      <p className="text-sm font-bold text-slate-200 mb-3">✓ Correct {item.stats.correctCount}x · ✕ Wrong {item.stats.wrongCount}x · ↷ Skipped {item.stats.skippedCount}x</p>
      <span className="mastery" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}44` }}>{item.masteryLabel}</span>

      {!item.isCorrect && (
        <>
          <div className="divider" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleShowExplanation} className="secondary-btn">{expanded ? 'Hide Explanation' : 'Show Explanation'}</button>
            <button onClick={() => onPracticeOne(item)} className="primary-btn">Practice Again</button>
          </div>
          {expanded && cache && (
            <div className="explain-box">
              {cache.official ? <p className="text-sm text-slate-200 leading-relaxed">{cache.official}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
              {cache.ai && <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p>}
              {cache.loading ? (
                <div className="mt-3 space-y-2"><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
              ) : (
                <button onClick={handleGetAIExplanation} className="secondary-btn mt-3 w-full">Get AI Explanation</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SessionReviewPage() {
  const { status } = useSession();
  const router = useRouter();
  const { sessionId } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('Wrong + Skipped');
  const [starting, setStarting] = useState(false);

  const loadSession = useCallback(async function loadSession() {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/history/session/${sessionId}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setData(json.data);
    } catch {
      setError('This session is no longer available.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') { setLoading(false); return; }
    loadSession();
  }, [router.isReady, sessionId, status, loadSession]);

  const session = data?.session;
  const answers = useMemo(() => data?.answers || [], [data?.answers]);
  const filtered = useMemo(() => {
    if (activeFilter === 'All') return answers;
    if (activeFilter === 'Wrong + Skipped') return answers.filter(item => !item.isCorrect);
    if (activeFilter === 'Wrong') return answers.filter(item => !item.isCorrect && !item.isSkipped);
    if (activeFilter === 'Skipped') return answers.filter(item => item.isSkipped);
    if (activeFilter === 'Correct') return answers.filter(item => item.isCorrect);
    if (activeFilter === 'Saved') return answers.filter(item => item.isSaved);
    return answers;
  }, [answers, activeFilter]);

  async function toggleSave(item) {
    setData(prev => ({
      ...prev,
      answers: prev.answers.map(answer => answer.questionId === item.questionId ? { ...answer, isSaved: !answer.isSaved } : answer),
    }));
    try {
      await fetch('/api/saved-questions/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, action: item.isSaved ? 'unsave' : 'save', sessionId }),
      });
    } catch {
      setData(prev => ({
        ...prev,
        answers: prev.answers.map(answer => answer.questionId === item.questionId ? { ...answer, isSaved: item.isSaved } : answer),
      }));
    }
  }

  async function startReattempt(sourceType, poolItem = null) {
    setStarting(true);
    try {
      if (poolItem) {
        sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
          questions: [poolItem],
          quizMode: 'reattempt_mistakes',
          parentSessionId: session.sessionId,
          attemptNumber: (session.attemptNumber || 1) + 1,
          subject: session.subject,
          topic: session.topic,
          sourceCollection: session.sourceCollection,
        }));
        router.push('/quiz?mode=history&count=1&sourceScreen=history');
        return;
      }
      const res = await fetch('/api/history/reattempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType, sessionId: session.sessionId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
        questions: json.data.questions,
        quizMode: json.data.quizMode,
        parentSessionId: json.data.parentSessionId,
        attemptNumber: (session.attemptNumber || 1) + 1,
        subject: json.data.subject,
        topic: json.data.topic,
        sourceCollection: json.data.sourceCollection,
      }));
      router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history`);
    } catch {
      setStarting(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack />
        <main className="px-4 pt-5">
          <Loader card size="md" label="Loading review..." />
        </main>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack />
        <main className="px-4 pt-5">
          <p className="font-display font-bold text-white mb-2">Sign in to see your history.</p>
          <button className="primary-btn" onClick={() => router.push('/api/auth/signin')}>Continue with Google</button>
        </main>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack />
        <main className="px-4 pt-5">
          <div className="review-card text-center">
            <p className="font-display font-bold text-white">This session is no longer available.</p>
            <button className="primary-btn mt-4" onClick={() => router.push('/history')}>Back to History</button>
          </div>
        </main>
      </div>
    );
  }

  const mistakes = session.incorrect + session.skipped;

  return (
    <>
      <Head><title>Review Session - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-36">
        <style>{`
          .review-card{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;margin-bottom:12px}
          .primary-btn{border:0;border-radius:14px;background:linear-gradient(135deg,#FF7A1A,#FF4D00);color:white;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}
          .secondary-btn{border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(255,255,255,.04);color:#CBD5E1;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}
          .chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172D47;color:#94A3B8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap}
          .chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#FDBA74}
          .status{border-radius:999px;padding:3px 8px;font-size:11px;font-weight:900}.status.wrong{background:rgba(239,68,68,.12);color:#FCA5A5}.status.skipped{background:rgba(245,158,11,.12);color:#FCD34D}.status.correct{background:rgba(34,197,94,.12);color:#86EFAC}
          .save-btn{border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.04);border-radius:999px;color:#CBD5E1;font-size:12px;font-weight:800;padding:7px 10px}
          .divider{height:1px;background:rgba(255,255,255,.07);margin:14px 0}.mastery{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:900}.explain-box{background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.10);border-radius:14px;padding:13px;margin-top:12px}
        `}</style>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack />
        <main className="px-4 pt-5">
        <header className="mb-4">
          <h1 className="font-display text-xl font-black text-white">{session.subject} • {session.topic}</h1>
          <p className="font-sans text-xs text-slate-500">Attempted {formatDate(session.completedAt)}</p>
          <p className="font-sans text-sm text-slate-300 mt-3">Score: <b>{session.score} / {session.questionCount * 2}</b> | Accuracy: <b>{session.accuracy}%</b> | Time: <b>{formatTime(session.timeSpentSeconds)}</b></p>
        </header>

        <div className="review-card">
          <div className="grid grid-cols-4 gap-2 text-center">
            <span className="text-emerald-300 font-black">✓ {session.correct}</span>
            <span className="text-red-300 font-black">✕ {session.incorrect}</span>
            <span className="text-amber-300 font-black">↷ {session.skipped}</span>
            <span className="text-orange-300 font-black">+{session.coinsEarned}</span>
          </div>
        </div>

        <div className="review-card">
          <p className="text-sm text-slate-200 leading-relaxed">{insight(session)}</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
          {FILTERS.map(filter => <button key={filter} onClick={() => setActiveFilter(filter)} className={`chip ${activeFilter === filter ? 'active' : ''}`}>{filter}</button>)}
        </div>

        {filtered.length ? filtered.map(item => (
          <QuestionCard key={item.questionId} item={item} onToggleSave={toggleSave} onPracticeOne={q => startReattempt('session_mistakes', q)} />
        )) : (
          <div className="review-card text-center text-slate-400">No questions in this filter.</div>
        )}
        </main>
      </div>

      {mistakes > 0 && (
        <div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 px-4 pb-2">
          <div className="grid grid-cols-2 gap-2 rounded-[18px] p-2" style={{ background: 'rgba(13,27,46,.96)', border: '1px solid rgba(255,255,255,.08)' }}>
            <button disabled={starting} className="primary-btn" onClick={() => startReattempt('session_mistakes')}>Practice {mistakes} Mistakes -&gt;</button>
            <button disabled={starting} className="secondary-btn" onClick={() => startReattempt('session_full')}>Re-attempt Full Quiz</button>
          </div>
        </div>
      )}
    </>
  );
}
