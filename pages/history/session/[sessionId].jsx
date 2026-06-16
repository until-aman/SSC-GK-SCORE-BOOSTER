import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getHistorySession } from '@/lib/data/historyClientData';
import { toggleSavedQuestion } from '@/lib/data/savedData';
import { getAIExplanation as getAIExplanationHelper } from '@/lib/data/aiData';

const FILTERS = ['Wrong + Skipped', 'Wrong', 'Skipped', 'Correct', 'Saved'];
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

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#14B8A6' : 'none'} stroke={filled ? '#14B8A6' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function QuestionCard({ item, onToggleSave }) {
  const [expanded, setExpanded] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);
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
      const { text, source } = await getAIExplanationHelper({
        question: item.question,
        optionA: item.optionA, optionB: item.optionB, optionC: item.optionC, optionD: item.optionD,
        correctOption: item.correctOption,
        userOption: item.userAnswer,
        sheetExplanation: item.explanation || '',
        subject: item.subject, topic: item.topic,
      });
      setCache(prev => ({ ...(prev || {}), ai: source === 'ai' ? text : null, loading: false }));
    } catch {
      setCache(prev => ({ ...(prev || { official: item.explanation || '', ai: null }), loading: false }));
    }
  }

  return (
    <div className="review-card">
      <div className="review-question-top">
        <div className="review-question-meta">
          <span className="review-question-number">Q{item.questionNumber}</span>
          <span className={`status ${status.toLowerCase()}`}>{status}</span>
          {item.timeTakenSeconds ? <span className="review-time">{item.timeTakenSeconds}s taken</span> : null}
        </div>
        <button type="button" onClick={() => onToggleSave(item)} className={`save-btn ${item.isSaved ? 'saved' : ''}`} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'} title={item.isSaved ? 'Saved' : 'Save'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>

      <p className={`review-question-text font-display ${questionExpanded ? 'open' : ''}`}>{item.question}</p>
      {item.question?.length > 220 && (
        <button type="button" className="read-more-btn" onClick={() => setQuestionExpanded(value => !value)}>{questionExpanded ? 'Show less' : 'Read more'}</button>
      )}

      <div className="answer-compare">
        <div className={`answer-row ${item.isSkipped ? 'skipped' : item.isCorrect ? 'correct' : 'wrong'}`}>
          <span>Your Answer</span>
          <b>{item.isSkipped ? 'Skipped' : `${optionText(item, item.userAnswer) || item.userAnswer || '-'}${item.userAnswer ? ` (Option ${item.userAnswer})` : ''}`}</b>
        </div>
        <div className="answer-row correct">
          <span>Correct Answer</span>
          <b>{optionText(item, item.correctOption) || item.correctOption} (Option {item.correctOption})</b>
        </div>
      </div>

      <div className="review-history-row">
        <div>
          <p>Your history on this question</p>
          <strong>&#10003; Correct {item.stats.correctCount}x &middot; &times; Wrong {item.stats.wrongCount}x &middot; &#9675; Skipped {item.stats.skippedCount}x</strong>
        </div>
        <span className="mastery" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}44` }}>{item.masteryLabel}</span>
      </div>

      <div className="review-action-row">
        <button onClick={handleShowExplanation} className="secondary-btn">{expanded ? 'Hide Explanation' : 'Show Explanation'}</button>
      </div>

      {expanded && cache && (
        <div className="explain-box">
          <p className="explain-title">Explanation</p>
          {cache.official ? <p className="text-sm text-slate-200 leading-relaxed">{cache.official}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
          {cache.ai && <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p>}
          {cache.loading ? (
            <div className="mt-3 space-y-2"><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
          ) : (
            !item.isCorrect && <button onClick={handleGetAIExplanation} className="secondary-btn mt-3 w-full">Get AI Explanation</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionReviewPage() {
  const { data: authSession, status } = useSession();
  const cacheScope = getUserCacheScope(authSession);
  const router = useRouter();
  const { sessionId } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('Wrong + Skipped');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [starting, setStarting] = useState(false);

  const loadSession = useCallback(async function loadSession() {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getHistorySession({ scope: cacheScope, sessionId });
      const json = res?.data;
      if (!json?.success) throw new Error(json?.error || 'Failed');
      setData(json.data);
    } catch {
      setError('This session is no longer available.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, cacheScope]);

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') { setLoading(false); return; }
    loadSession();
  }, [router.isReady, sessionId, status, loadSession]);

  const session = data?.session;
  const answers = useMemo(() => data?.answers || [], [data?.answers]);
  const filtered = useMemo(() => {
    if (activeFilter === 'Wrong + Skipped') return answers.filter(item => !item.isCorrect);
    if (activeFilter === 'Wrong') return answers.filter(item => !item.isCorrect && !item.isSkipped);
    if (activeFilter === 'Skipped') return answers.filter(item => item.isSkipped);
    if (activeFilter === 'Correct') return answers.filter(item => item.isCorrect);
    if (activeFilter === 'Saved') return answers.filter(item => item.isSaved);
    return answers;
  }, [answers, activeFilter]);
  const filterCounts = useMemo(() => ({
    'Wrong + Skipped': answers.filter(item => !item.isCorrect).length,
    Wrong: answers.filter(item => !item.isCorrect && !item.isSkipped).length,
    Skipped: answers.filter(item => item.isSkipped).length,
    Correct: answers.filter(item => item.isCorrect).length,
    Saved: answers.filter(item => item.isSaved).length,
  }), [answers]);
  const safeActiveQuestionIndex = filtered.length ? Math.min(activeQuestionIndex, filtered.length - 1) : 0;
  const activeQuestion = filtered[safeActiveQuestionIndex] || null;
  const filterLabel = activeFilter === 'Wrong + Skipped' ? 'wrong/skipped' : activeFilter.toLowerCase();
  const reviewSummary = `Reviewing ${filtered.length} ${filterLabel} question${filtered.length !== 1 ? 's' : ''}`;

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [activeFilter, answers]);

  useEffect(() => {
    if (activeQuestionIndex > 0 && activeQuestionIndex >= filtered.length) {
      setActiveQuestionIndex(Math.max(filtered.length - 1, 0));
    }
  }, [activeQuestionIndex, filtered.length]);

  async function toggleSave(item) {
    setData(prev => ({
      ...prev,
      answers: prev.answers.map(answer => answer.questionId === item.questionId ? { ...answer, isSaved: !answer.isSaved } : answer),
    }));
    try {
      const r = await toggleSavedQuestion({ scope: cacheScope, action: item.isSaved ? 'unsave' : 'save', question: { ...item, sessionId } });
      if (!r.ok) throw new Error('toggle failed');
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
      <div className="min-h-screen [background:var(--bg-app)] review-page-shell">
        <style>{`
          .review-card{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;margin-bottom:12px}
          .primary-btn{border:0;border-radius:14px;background:linear-gradient(135deg,#FF7A1A,#FF4D00);color:white;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}
          .secondary-btn{border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(255,255,255,.04);color:#CBD5E1;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}.primary-btn:disabled,.secondary-btn:disabled{opacity:.45;cursor:default;box-shadow:none}
          .chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172D47;color:#94A3B8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap}
          .chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#FDBA74}
          .status{border-radius:999px;padding:3px 8px;font-size:11px;font-weight:900}.status.wrong{background:rgba(239,68,68,.12);color:#FCA5A5}.status.skipped{background:rgba(245,158,11,.12);color:#FCD34D}.status.correct{background:rgba(34,197,94,.12);color:#86EFAC}
          .save-btn{height:34px;width:34px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.04);border-radius:999px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.save-btn.saved{border-color:rgba(20,184,166,.40);background:rgba(20,184,166,.18)}
          .divider{height:1px;background:rgba(255,255,255,.07);margin:14px 0}.mastery{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:900}.explain-box{background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.10);border-radius:14px;padding:13px;margin-top:12px}.explain-title{color:#FDBA74;font-size:11px;font-weight:900;margin:0 0 8px}
          .review-question-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.review-question-meta{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}.review-question-number{color:#F8FAFC;font-size:13px;font-weight:900}.review-time{color:#64748B;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-question-text{color:#F8FAFC;font-size:14px;font-weight:900;line-height:1.48;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical}.review-question-text.open{-webkit-line-clamp:unset;display:block}.read-more-btn{border:0;background:transparent;color:#FDBA74;font-size:12px;font-weight:900;padding:8px 0 0}
          .answer-compare{display:grid;gap:8px;margin-top:13px}.answer-row{border:1px solid rgba(148,163,184,.10);background:rgba(15,23,42,.38);border-radius:13px;padding:10px 11px}.answer-row span{display:block;color:#94A3B8;font-size:11px;font-weight:900;margin-bottom:4px}.answer-row b{display:block;font-size:12px;line-height:1.45}.answer-row.wrong b{color:#FCA5A5}.answer-row.correct b{color:#5EEAD4}.answer-row.skipped b{color:#94A3B8}
          .review-history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-top:13px;padding:11px 0;border-top:1px solid rgba(148,163,184,.10);border-bottom:1px solid rgba(148,163,184,.10)}.review-history-row div{min-width:0}.review-history-row p{color:#64748B;font-size:11px;font-weight:900;margin:0 0 5px}.review-history-row strong{display:block;color:#CBD5E1;font-size:12px;line-height:1.4}.review-history-row .mastery{flex:0 0 auto;font-size:10px;padding:4px 8px;max-width:122px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .review-action-row{display:grid;grid-template-columns:1fr;gap:8px;margin-top:13px}.review-action-row .secondary-btn:only-child{grid-column:1 / -1}
          .filter-chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 16px 8px;margin:0 -16px;scrollbar-width:none;-ms-overflow-style:none}.filter-chip-row::-webkit-scrollbar{display:none}
          .review-filter-summary{color:#94A3B8;font-size:12px;font-weight:800;line-height:1.4;margin:0 0 12px 2px}
          .session-summary{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:15px;margin-bottom:12px}
          .session-title{color:#F8FAFC;font-size:17px;line-height:1.25;font-weight:900;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
          .session-date{color:#64748B;font-size:12px;font-weight:800;margin:4px 0 0}
          .session-score-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:15px}
          .session-score strong{display:block;color:#F8FAFC;font-size:25px;line-height:1;font-weight:900}
          .session-score span{display:block;color:#64748B;font-size:11px;font-weight:900;margin-top:6px}
          .session-time{color:#94A3B8;font-size:11px;font-weight:800;text-align:right}
          .session-stat-row{display:flex;align-items:center;justify-content:space-between;gap:8px;row-gap:7px;flex-wrap:wrap;margin-top:13px;padding:10px 0;border-top:1px solid rgba(148,163,184,.10);border-bottom:1px solid rgba(148,163,184,.10);font-size:13px;font-weight:900}
          .session-insight{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:13px 14px;margin-bottom:12px}
          .carousel-shell{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:13px 14px;margin-bottom:12px}
          .carousel-progress{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
          .carousel-progress strong{display:block;color:#F8FAFC;font-size:14px;font-weight:900;line-height:1.2}
          .carousel-progress span{display:block;color:#94A3B8;font-size:12px;font-weight:800;margin-top:4px}
          .carousel-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .carousel-nav button:disabled{opacity:.45;cursor:default}
          .review-page-shell{padding-bottom:calc(190px + env(safe-area-inset-bottom))}
          .session-action-bar{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);width:100%;max-width:430px;z-index:60;padding:0 16px 10px;background:linear-gradient(to top,var(--bg-app) 68%,transparent)}
          .session-action-inner{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-radius:18px;padding:8px;background:rgba(13,27,46,.96);border:1px solid rgba(255,255,255,.08);box-shadow:0 16px 38px rgba(0,0,0,.24)}
          .session-action-inner .primary-btn{box-shadow:0 14px 34px rgba(255,90,0,.24)}
          .review-card,.session-summary,.session-insight,.carousel-shell{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);box-shadow:var(--ssc-shadow-card)}
          .session-title,.session-score strong,.carousel-progress strong,.review-question-number,.review-question-text{color:var(--ssc-text-primary)}
          .session-date,.session-score span,.session-time,.carousel-progress span,.review-filter-summary,.review-time,.review-history-row p{color:var(--ssc-text-secondary)}
          .secondary-btn{border-color:var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}
          .chip{background:var(--ssc-surface);border-color:var(--ssc-border-soft);color:var(--ssc-text-secondary)}
          .chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white}
          .status.wrong{background:var(--ssc-danger-soft);color:var(--ssc-danger)}.status.skipped{background:var(--ssc-warning-soft);color:var(--ssc-warning)}.status.correct{background:var(--ssc-success-soft);color:var(--ssc-success)}
          .save-btn{border-color:var(--ssc-border-soft);background:var(--ssc-surface-soft)}.save-btn.saved{border-color:rgba(14,165,164,.36);background:var(--ssc-teal-soft)}
          .explain-box{background:var(--ssc-surface-soft);border-color:var(--ssc-border-soft)}.explain-title{color:var(--ssc-teal)}
          .explain-box .text-slate-200,.explain-box .text-orange-100{color:var(--ssc-text-secondary)}.explain-box .text-slate-500{color:var(--ssc-text-muted)}
          .answer-row{background:var(--ssc-surface);border-color:var(--ssc-border-soft)}.answer-row span{color:var(--ssc-text-muted)}.answer-row.correct{background:var(--ssc-success-soft);border-color:rgba(18,184,134,.28)}.answer-row.wrong{background:var(--ssc-danger-soft);border-color:rgba(239,68,68,.28)}.answer-row.skipped{background:var(--ssc-surface-soft)}
          .answer-row.correct b{color:var(--ssc-success)}.answer-row.wrong b{color:var(--ssc-danger)}.answer-row.skipped b{color:var(--ssc-text-secondary)}
          .review-history-row,.session-stat-row{border-color:var(--ssc-border-soft)}.review-history-row strong{color:var(--ssc-text-secondary)}
          .session-insight .text-slate-200,.review-card .text-slate-400,.review-card .text-white{color:var(--ssc-text-secondary)}
          .session-action-bar{background:linear-gradient(to top,var(--ssc-bg) 68%,transparent)}.session-action-inner{background:var(--ssc-surface);border-color:var(--ssc-border-soft);box-shadow:var(--ssc-shadow-card)}
        `}</style>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack />
        <main className="px-4 pt-5">
        <section className="session-summary">
          <h1 className="session-title font-display">{session.subject} &middot; {session.topic}</h1>
          <p className="session-date">Attempted {formatDate(session.completedAt)}</p>

          <div className="session-score-row">
            <div className="session-score">
              <strong className="font-display">{session.score} / {session.questionCount * 2}</strong>
              <span>Score</span>
            </div>
            {session.timeSpentSeconds ? <p className="session-time">Time: {formatTime(session.timeSpentSeconds)}</p> : null}
          </div>

          <div className="session-stat-row">
            <span className="text-slate-400">{session.questionCount} Qs</span>
            <span className="text-emerald-300">&#10003; {session.correct}</span>
            <span className="text-red-300">&times; {session.incorrect}</span>
            <span className="text-slate-400">&#9675; {session.skipped}</span>
            {Number(session.coinsEarned) ? <span className="text-orange-300">+{session.coinsEarned} coins</span> : null}
          </div>
        </section>

        <div className="session-insight">
          <p className="text-sm text-slate-200 leading-relaxed">{insight(session)}</p>
        </div>

        <div className="filter-chip-row">
          {FILTERS.map(filter => <button key={filter} onClick={() => setActiveFilter(filter)} className={`chip ${activeFilter === filter ? 'active' : ''}`}>{filter} ({filterCounts[filter] ?? 0})</button>)}
        </div>
        <p className="review-filter-summary">{reviewSummary}</p>

        {filtered.length ? (
          <>
            <section className="carousel-shell">
              <div className="carousel-progress">
                <div>
                  <strong className="font-display">Question {safeActiveQuestionIndex + 1} of {filtered.length}</strong>
                  <span>Use Previous and Next to review one question at a time</span>
                </div>
              </div>
              <div className="carousel-nav">
                <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex === 0} onClick={() => setActiveQuestionIndex(index => Math.max(index - 1, 0))}>Previous</button>
                <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex >= filtered.length - 1} onClick={() => setActiveQuestionIndex(index => Math.min(index + 1, filtered.length - 1))}>Next</button>
              </div>
            </section>
            <QuestionCard key={activeQuestion.questionId} item={activeQuestion} onToggleSave={toggleSave} />
          </>
        ) : (
          <div className="review-card text-center text-slate-400">
            <p className="font-display font-black text-white mb-1">No questions found in this filter.</p>
            <p>Try another filter.</p>
          </div>
        )}
        </main>
      </div>

      {mistakes > 0 && (
        <div className="session-action-bar">
          <div className="session-action-inner">
            <button disabled={starting} className="primary-btn" onClick={() => startReattempt('session_mistakes')}>Practice {mistakes} Mistakes →</button>
            <button disabled={starting} className="secondary-btn" onClick={() => startReattempt('session_full')}>Re-attempt Full Quiz</button>
          </div>
        </div>
      )}
    </>
  );
}
