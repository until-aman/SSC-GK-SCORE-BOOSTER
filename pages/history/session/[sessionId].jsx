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
  red:    ['#B91C1C', 'rgba(239,68,68,0.10)'],
  amber:  ['#B45309', 'rgba(245,158,11,0.10)'],
  green:  ['#047857', 'rgba(16,185,129,0.10)'],
  blue:   ['#1D4ED8', 'rgba(59,130,246,0.10)'],
  orange: ['#C2410C', 'rgba(249,115,22,0.10)'],
  grey:   ['#374151', 'rgba(107,114,128,0.10)'],
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
          <span className="answer-label">Your Answer</span>
          <div className="answer-value">
            <b>{item.isSkipped ? 'Skipped' : `${optionText(item, item.userAnswer) || item.userAnswer || '-'}${item.userAnswer ? ` (Option ${item.userAnswer})` : ''}`}</b>
            {!item.isSkipped && (item.isCorrect ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ))}
          </div>
        </div>
        <div className="answer-row correct">
          <span className="answer-label">Correct Answer</span>
          <div className="answer-value">
            <b>{optionText(item, item.correctOption) || item.correctOption} (Option {item.correctOption})</b>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
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
        <button onClick={handleShowExplanation} className="secondary-btn">{expanded ? 'Hide Explanation' : '📖 Show Explanation'}</button>
      </div>

      {expanded && cache && (
        <div className="explain-box">
          <p className="explain-title">Explanation</p>
          {cache.official ? (
            <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.58, margin: 0 }}>{cache.official}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--ssc-text-muted)', lineHeight: 1.55 }}>No official explanation available.</p>
          )}
          {cache.ai && (
            <div style={{ marginTop: 10, padding: 11, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 900, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 7px' }}>✦ AI Explanation</p>
              <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.55, margin: 0 }}>{cache.ai}</p>
            </div>
          )}
          {cache.loading ? (
            <div className="mt-3 space-y-2"><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
          ) : (
            !item.isCorrect && <button onClick={handleGetAIExplanation} className="secondary-btn mt-3 w-full">Get AI Explanation ✦</button>
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
    const returnUrl = router.asPath || `/history/session/${session?.sessionId || router.query.sessionId || ''}`;
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
          returnUrl,
        }));
        router.push(`/quiz?mode=history&count=1&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
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
        returnUrl,
      }));
      router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch {
      setStarting(false);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack badge="HISTORY" />
        <main className="px-4 pt-5">
          <Loader card size="md" label="Loading review..." />
        </main>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack badge="HISTORY" />
        <main className="px-4 pt-5">
          <p className="font-display font-bold text-[var(--ssc-text-primary)] mb-2">Sign in to see your history.</p>
          <button className="primary-btn" onClick={() => router.push('/api/auth/signin')}>Continue with Google</button>
        </main>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] pb-24">
        <Head><title>Review Session - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack badge="HISTORY" />
        <main className="px-4 pt-5">
          <div className="review-card text-center">
            <p className="font-display font-bold text-[var(--ssc-text-primary)]">This session is no longer available.</p>
            <button className="primary-btn mt-4" onClick={() => router.push('/history')}>Back to History</button>
          </div>
        </main>
      </div>
    );
  }

  const mistakes = session.incorrect + session.skipped;
  const scoreColor = Number(session.score) < 0 ? '#DC2626' : Number(session.score) > 0 ? 'var(--ssc-orange-deep)' : 'var(--ssc-text-muted)';

  return (
    <>
      <Head><title>Review Session - SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[var(--ssc-bg)] review-page-shell">
        <style>{`
          .review-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
          .primary-btn{border:0;border-radius:14px;background:linear-gradient(135deg,#FF8A1F,#FF5A00);color:white;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(255,107,22,0.25)}
          .secondary-btn{border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface);color:var(--ssc-teal);font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit}
          .primary-btn:disabled,.secondary-btn:disabled{opacity:.45;cursor:default;box-shadow:none}
          .chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:12px;font-weight:700;padding:7px 14px;white-space:nowrap;font-family:inherit;cursor:pointer}
          .chip.active{background:linear-gradient(135deg,#FF8A1F,#FF5A00);border-color:transparent;color:white}
          .status{border-radius:999px;padding:3px 9px;font-size:11px;font-weight:800;border:1px solid}
          .status.wrong{background:rgba(239,68,68,0.10);color:#DC2626;border-color:rgba(239,68,68,0.22)}
          .status.skipped{background:rgba(245,158,11,0.10);color:#D97706;border-color:rgba(245,158,11,0.22)}
          .status.correct{background:rgba(20,184,166,0.10);color:var(--ssc-teal);border-color:rgba(20,184,166,0.22)}
          .save-btn{height:34px;width:34px;border:1px solid var(--ssc-border-soft);background:rgba(248,250,252,1);border-radius:999px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer}
          .save-btn.saved{border-color:rgba(20,184,166,0.40);background:rgba(20,184,166,0.12)}
          .mastery{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:900}
          .explain-box{background:rgba(14,165,164,0.06);border:1px solid rgba(14,165,164,0.18);border-radius:14px;padding:13px;margin-top:12px}
          .explain-title{color:var(--ssc-teal);font-size:11px;font-weight:900;margin:0 0 8px;text-transform:uppercase;letter-spacing:.04em}
          .review-question-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}
          .review-question-meta{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}
          .review-question-number{color:var(--ssc-text-muted);font-size:13px;font-weight:900}
          .review-time{color:var(--ssc-text-muted);font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .review-question-text{color:var(--ssc-text-primary);font-size:14px;font-weight:800;line-height:1.48;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical}
          .review-question-text.open{-webkit-line-clamp:unset;display:block}
          .read-more-btn{border:0;background:transparent;color:var(--ssc-teal);font-size:12px;font-weight:800;padding:8px 0 0;cursor:pointer;font-family:inherit}
          .answer-compare{display:grid;gap:8px;margin-top:13px}
          .answer-row{border-radius:13px;padding:10px 12px}
          .answer-row .answer-label{display:block;color:var(--ssc-text-muted);font-size:11px;font-weight:700;margin-bottom:5px}
          .answer-row .answer-value{display:flex;align-items:center;justify-content:space-between;gap:8px}
          .answer-row .answer-value b{font-size:13px;line-height:1.45;flex:1}
          .answer-row.wrong{background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.18)}
          .answer-row.wrong .answer-value b{color:#DC2626}
          .answer-row.correct{background:rgba(20,184,166,0.07);border:1px solid rgba(20,184,166,0.18)}
          .answer-row.correct .answer-value b{color:var(--ssc-teal)}
          .answer-row.skipped{background:rgba(148,163,184,0.08);border:1px solid rgba(148,163,184,0.18)}
          .answer-row.skipped .answer-value b{color:var(--ssc-text-muted)}
          .review-history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-top:13px;padding:11px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft)}
          .review-history-row div{min-width:0}
          .review-history-row p{color:var(--ssc-text-muted);font-size:11px;font-weight:700;margin:0 0 5px}
          .review-history-row strong{display:block;color:var(--ssc-text-secondary);font-size:12px;line-height:1.4}
          .review-history-row .mastery{flex:0 0 auto;font-size:10px;padding:4px 8px;max-width:122px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .review-action-row{display:grid;grid-template-columns:1fr;gap:8px;margin-top:13px}
          .review-action-row .secondary-btn:only-child{grid-column:1 / -1}
          .filter-chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 16px 8px;margin:0 -16px;scrollbar-width:none;-ms-overflow-style:none}
          .filter-chip-row::-webkit-scrollbar{display:none}
          .review-filter-summary{color:var(--ssc-text-muted);font-size:12px;font-weight:700;line-height:1.4;margin:0 0 12px 2px}
          .session-summary{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;padding:16px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
          .session-title{color:var(--ssc-text-primary);font-size:17px;line-height:1.25;font-weight:900;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
          .session-date{color:var(--ssc-text-muted);font-size:12px;font-weight:700;margin:4px 0 0}
          .session-score-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:15px}
          .session-score strong{display:block;font-size:26px;line-height:1;font-weight:900}
          .session-score span{display:block;color:var(--ssc-text-muted);font-size:11px;font-weight:700;margin-top:6px}
          .session-time{color:var(--ssc-text-muted);font-size:11px;font-weight:700;text-align:right}
          .session-stat-row{display:flex;align-items:center;justify-content:space-between;gap:8px;row-gap:7px;flex-wrap:wrap;margin-top:13px;padding:10px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);font-size:13px;font-weight:800}
          .session-insight{background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.24);border-radius:16px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px}
          .carousel-shell{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:13px 14px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
          .carousel-progress{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
          .carousel-progress strong{display:block;color:var(--ssc-text-primary);font-size:14px;font-weight:900;line-height:1.2}
          .carousel-progress span{display:block;color:var(--ssc-text-muted);font-size:12px;font-weight:700;margin-top:4px}
          .carousel-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .carousel-nav button:disabled{opacity:.45;cursor:default}
          .review-page-shell{padding-bottom:calc(190px + env(safe-area-inset-bottom))}
          .session-action-bar{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);width:100%;max-width:430px;z-index:60;padding:0 16px 10px;background:linear-gradient(to top,var(--ssc-bg) 68%,transparent)}
          .session-action-inner{display:grid;grid-template-columns:1fr;gap:8px;border-radius:18px;padding:8px;background:rgba(255,255,255,0.96);border:1px solid var(--ssc-border-soft);box-shadow:0 16px 38px rgba(16,32,51,0.12);backdrop-filter:blur(12px)}
          .session-action-inner .primary-btn{box-shadow:0 4px 14px rgba(255,90,0,0.24)}
        `}</style>
        <HistoryTopBar title="Quiz Review" icon={QuizReviewIcon} backHref="/history/quizzes" showBack badge="HISTORY" />
        <main className="px-4 pt-5">
        <section className="session-summary">
          <h1 className="session-title font-display">{session.subject} &middot; {session.topic}</h1>
          <p className="session-date">Attempted {formatDate(session.completedAt)}</p>

          <div className="session-score-row">
            <div className="session-score">
              <strong className="font-display" style={{ color: scoreColor }}>{session.score} / {session.questionCount * 2}</strong>
              <span>Score</span>
            </div>
            {session.timeSpentSeconds ? <p className="session-time">Time: {formatTime(session.timeSpentSeconds)}</p> : null}
          </div>

          <div className="session-stat-row">
            <span style={{ color: 'var(--ssc-text-secondary)' }}>{session.questionCount} Qs</span>
            <span style={{ color: 'var(--ssc-teal)', fontWeight: 800 }}>&#10003; {session.correct}</span>
            <span style={{ color: '#DC2626', fontWeight: 800 }}>&times; {session.incorrect}</span>
            <span style={{ color: 'var(--ssc-text-muted)' }}>&#9675; {session.skipped}</span>
            {Number(session.coinsEarned) ? <span style={{ color: '#F59E0B', fontWeight: 800 }}>+{session.coinsEarned} coins</span> : null}
          </div>
        </section>

        <div className="session-insight">
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.55, margin: 0 }}>{insight(session)}</p>
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
                <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex === 0} onClick={() => setActiveQuestionIndex(index => Math.max(index - 1, 0))}>&#8592; Previous</button>
                <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex >= filtered.length - 1} onClick={() => setActiveQuestionIndex(index => Math.min(index + 1, filtered.length - 1))}>Next &#8594;</button>
              </div>
            </section>
            <QuestionCard key={activeQuestion.questionId} item={activeQuestion} onToggleSave={toggleSave} />
          </>
        ) : (
          <div className="review-card text-center">
            <p className="font-display font-black text-[var(--ssc-text-primary)] mb-1">No questions found in this filter.</p>
            <p className="text-[var(--ssc-text-muted)]">Try another filter.</p>
          </div>
        )}
        </main>
      </div>

      {mistakes > 0 && (
        <div className="session-action-bar">
          <div className="session-action-inner">
            <button disabled={starting} className="primary-btn" onClick={() => startReattempt('session_mistakes')}>Practice {mistakes} Mistakes →</button>
          </div>
        </div>
      )}
    </>
  );
}
