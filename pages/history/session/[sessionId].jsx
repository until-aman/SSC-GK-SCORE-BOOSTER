import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import SmartHistoryLoader from '@/components/ui/SmartHistoryLoader';
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

function formatPercent(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function getDistributedPercentages(counts = []) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return counts.map(() => ({ value: 0, label: '0' }));

  const rawTenths = counts.map(count => (count / total) * 1000);
  const flooredTenths = rawTenths.map(Math.floor);
  let remainingTenths = 1000 - flooredTenths.reduce((sum, value) => sum + value, 0);

  const order = rawTenths
    .map((value, index) => ({ index, remainder: value - flooredTenths[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; i < remainingTenths; i += 1) {
    flooredTenths[order[i % order.length].index] += 1;
  }

  return flooredTenths.map(value => {
    const percentage = value / 10;
    return {
      value: percentage,
      label: formatPercent(percentage),
    };
  });
}

function getAttemptBreakdown(item) {
  const correctCount = Number(item.stats?.correctCount || item.correctCount || 0);
  const wrongCount = Number(item.stats?.wrongCount || item.wrongCount || 0);
  const skippedCount = Number(item.stats?.skippedCount || item.skippedCount || 0);
  const totalAttempts = correctCount + wrongCount + skippedCount;
  const [correctPct, wrongPct, skippedPct] = getDistributedPercentages([correctCount, wrongCount, skippedCount]);
  return {
    correctCount,
    wrongCount,
    skippedCount,
    totalAttempts,
    correctPct: correctPct.value,
    wrongPct: wrongPct.value,
    skippedPct: skippedPct.value,
    correctPctLabel: correctPct.label,
    wrongPctLabel: wrongPct.label,
    skippedPctLabel: skippedPct.label,
  };
}

function AttemptSegmentBar({ stats }) {
  if (!stats?.totalAttempts) return null;
  return (
    <div className="rm-segment-track">
      {stats.correctPct > 0 && <span className="rm-segment-fill correct" style={{ width: `${stats.correctPct}%` }} />}
      {stats.wrongPct > 0 && <span className="rm-segment-fill wrong" style={{ width: `${stats.wrongPct}%` }} />}
      {stats.skippedPct > 0 && <span className="rm-segment-fill skipped" style={{ width: `${stats.skippedPct}%` }} />}
    </div>
  );
}

function AttemptStatsRow({ stats, includeTime, timeSpent, className = '' }) {
  if (!stats?.totalAttempts && !timeSpent) return null;
  return (
    <div className={`rm-attempt-stats ${className}`}>
      {includeTime && timeSpent && <span className="rm-stat-time">Time {timeSpent}</span>}
      {stats?.totalAttempts > 0 && (
        <>
          <span className="rm-stat-block rm-stat-correct">
            <span className="rm-stat-value">✓ {stats.correctCount}</span>
            <span className="rm-stat-label">Correct ({stats.correctPctLabel}%)</span>
          </span>
          <span className="rm-stat-block rm-stat-wrong">
            <span className="rm-stat-value">× {stats.wrongCount}</span>
            <span className="rm-stat-label">Wrong ({stats.wrongPctLabel}%)</span>
          </span>
          <span className="rm-stat-block rm-stat-skipped">
            <span className="rm-stat-value">○ {stats.skippedCount}</span>
            <span className="rm-stat-label">Skipped ({stats.skippedPctLabel}%)</span>
          </span>
        </>
      )}
    </div>
  );
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

function QuestionCard({ item, session, onToggleSave }) {
  const [expanded, setExpanded] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);
  const [cache, setCache] = useState(null);
  const tone = TONES[item.masteryTone] || TONES.grey;

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

  const attemptStats = getAttemptBreakdown(item);
  const timeSpent = item.timeTakenSeconds ? `${item.timeTakenSeconds}s taken` : `Q${item.questionNumber}`;
  const lastPracticed = formatDate(item.lastAttemptedAt || item.lastPracticedAt);

  return (
    <article className="rm-card session-question-card">
      <div className="rm-card-head">
        <div className="rm-tags">
          {(item.subject || session?.subject) && <span className="rm-subject-tag">{item.subject || session.subject}</span>}
          {(item.topic || session?.topic) && <span className="rm-topic-tag">{item.topic || session.topic}</span>}
        </div>
        <button
          type="button"
          className={`rm-card-bookmark-btn ${item.isSaved ? 'saved' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleSave(item); }}
          aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'}
        >
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>

      <p className={`rm-question-text ${questionExpanded ? 'open' : ''}`}>{item.question}</p>
      {item.question?.length > 220 && (
        <button type="button" className="read-more-btn" onClick={() => setQuestionExpanded(value => !value)}>{questionExpanded ? 'Show less' : 'Read more'}</button>
      )}

      <div className="rm-footer">
        <div className="rm-footer-copy">
          <span className="rm-meta">{timeSpent}</span>
        </div>
        <span className="rm-open-icon" aria-hidden="true">›</span>
      </div>

      <AttemptSegmentBar stats={attemptStats} />
      <AttemptStatsRow stats={attemptStats} />

      <div className="review-action-row">
        <button onClick={handleShowExplanation} className="secondary-btn">{expanded ? 'Hide Explanation' : '📖 Show Explanation'}</button>
      </div>

      {expanded && cache && (
        <div className="question-expanded">
          <div className="expanded-block">
            <p className="expanded-label">Your answer</p>
            <p className="expanded-question">{item.isSkipped ? 'Skipped' : `${optionText(item, item.userAnswer) || item.userAnswer || '-'}${item.userAnswer ? ` (Option ${item.userAnswer})` : ''}`}</p>
          </div>
          <div className="answer-detail-grid">
            <div className={`answer-detail ${item.isSkipped ? 'skipped' : item.isCorrect ? 'correct' : 'wrong'}`}>
              <span>Your response</span>
              <b>{item.isSkipped ? 'Skipped' : `${optionText(item, item.userAnswer) || item.userAnswer || '-'}`}</b>
            </div>
            <div className="answer-detail correct">
              <span>Correct answer</span>
              <b>{optionText(item, item.correctOption) || item.correctOption}</b>
            </div>
          </div>
          <p className="expanded-label">Explanation</p>
          <p className="expanded-question" style={{ fontSize: 13, lineHeight: 1.55, margin: 0, color: cache.official ? 'var(--ssc-text-secondary)' : 'var(--ssc-text-muted)' }}>
            {cache.official || 'No official explanation available.'}
          </p>
          {cache.ai && (
            <div className="answer-detail correct" style={{ marginTop: 10, background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.18)' }}>
              <span style={{ color: '#7C3AED', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Explanation</span>
              <b style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', fontWeight: 500, marginTop: 6 }}>{cache.ai}</b>
            </div>
          )}
          {cache.loading ? (
            <div className="mt-3 space-y-2"><div className="skeleton h-3 w-full rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div>
          ) : (
            !item.isCorrect && <button onClick={handleGetAIExplanation} className="secondary-btn mt-3 w-full">Get AI Explanation ✦</button>
          )}
        </div>
      )}
    </article>
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
  const filterLabel = activeFilter === 'Wrong + Skipped' ? 'wrong/skipped' : activeFilter.toLowerCase();
  const reviewSummary = `Reviewing ${filtered.length} ${filterLabel} question${filtered.length !== 1 ? 's' : ''}`;

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
          <SmartHistoryLoader variant="review-session" compact />
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
          .session-question-list{display:grid;gap:10px}
          .session-question-card{border-radius:14px;padding:12px 13px;margin-bottom:0}
          .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}
          .primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white;box-shadow:var(--ssc-shadow-cta)}
          .secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}
          .primary-btn:disabled,.secondary-btn:disabled{opacity:.55;cursor:default;box-shadow:none}
          .chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:10px;font-weight:900;padding:7px 12px;white-space:nowrap;text-transform:none;flex:0 0 auto;box-shadow:0 5px 12px rgba(16,32,51,.04)}
          .chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 8px 18px rgba(14,165,164,.16)}
          .question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface-soft)}
          .expanded-block{margin-bottom:10px}
          .expanded-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}
          .expanded-question{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.48;margin:0}
          .expanded-attempt{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin:9px 0 0}
          .answer-detail-grid{display:grid;gap:8px}
          .answer-detail{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);border-radius:12px;padding:9px 10px}
          .answer-detail span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}
          .answer-detail b{display:block;font-size:12px;line-height:1.4}
          .answer-detail.correct{background:var(--ssc-success-soft);border-color:rgba(18,184,134,.28)}
          .answer-detail.wrong{background:var(--ssc-danger-soft);border-color:rgba(239,68,68,.28)}
          .answer-detail.skipped b{color:var(--ssc-text-secondary)}
          .rm-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:9px 10px 8px;margin:0 0 9px;position:relative;box-shadow:0 8px 18px rgba(16,32,51,.05);cursor:pointer}
          .rm-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}
          .rm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;padding-right:0}
          .rm-tags{display:flex;gap:7px;align-items:center;min-width:0;overflow:hidden;flex:1;flex-wrap:nowrap}
          .rm-subject-tag,.rm-topic-tag{display:inline-flex;align-items:center;height:22px;border-radius:999px;padding:0 9px;font-size:10px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .rm-subject-tag{max-width:36%;flex:0 1 auto;color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14)}
          .rm-topic-tag{max-width:72%;flex:0 1 auto;color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.14)}
          .rm-question-text{font-size:11px;font-weight:900;color:var(--ssc-text-primary);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;margin:0 24px 9px 0}
          .rm-question-text.open{-webkit-line-clamp:unset;display:block}
          .rm-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
          .rm-footer-copy{min-width:0;flex:1}
          .rm-open-icon{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:0;background:transparent;color:var(--ssc-text-secondary);font-size:14px;font-weight:900;flex:0 0 auto}
          .rm-meta{font-size:9px;color:var(--ssc-text-muted);font-weight:800}
          .rm-card-bookmark-btn{height:22px;width:28px;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;color:var(--ssc-teal);margin-top:0}
          .rm-segment-track{height:3px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden;margin:8px 2px 0 0;display:flex}
          .rm-segment-fill{height:100%;display:block;flex:0 0 auto}
          .rm-segment-fill.correct{background:var(--ssc-success)}
          .rm-segment-fill.wrong{background:var(--ssc-danger)}
          .rm-segment-fill.skipped{background:var(--ssc-border-soft)}
          .rm-attempt-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:0;margin-top:7px;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;width:100%;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);padding:7px 0 6px}
          .rm-attempt-stats.detail{font-size:10px;white-space:nowrap;overflow:hidden;margin-top:9px}
          .rm-stat-time{color:var(--ssc-text-secondary)}
          .rm-stat-block{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;min-width:0;border-left:1px solid var(--ssc-border-soft)}
          .rm-stat-block:first-child{border-left:0}
          .rm-stat-value{font-size:14px;font-weight:1000;line-height:1}
          .rm-stat-label{font-size:9px;font-weight:900;line-height:1.1;color:var(--ssc-text-muted);overflow:hidden;text-overflow:ellipsis;max-width:100%}
          .rm-stat-correct .rm-stat-value{color:var(--ssc-success)}
          .rm-stat-wrong .rm-stat-value{color:var(--ssc-danger)}
          .rm-stat-skipped .rm-stat-value{color:var(--ssc-text-muted)}
          .review-action-row{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
          .review-action-row .secondary-btn:only-child{grid-column:1 / -1}
          .filter-chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 0 10px;margin:0;scrollbar-width:none;-ms-overflow-style:none}
          .filter-chip-row::-webkit-scrollbar{display:none}
          .review-summary-card{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:14px 16px;margin:0 0 12px;box-shadow:var(--ssc-shadow-card)}
          .review-summary-copy{min-width:0;flex:1}
          .review-summary-label{margin:0;color:var(--ssc-text-muted);font-size:12px;font-weight:800}
          .review-summary-count{margin:4px 0 0;color:var(--ssc-text-primary);font-size:24px;font-weight:900;line-height:1}
          .review-summary-cta{min-width:148px;white-space:nowrap;}
          .review-filter-summary{color:var(--ssc-text-primary);font-size:12px;font-weight:1000;line-height:1.4;margin:0 0 12px 2px}
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
        <div className="review-summary-card">
          <div className="review-summary-copy">
            <p className="review-summary-label">Showing {filterLabel} questions</p>
            <p className="review-summary-count">{filtered.length}</p>
          </div>
          <button
            type="button"
            className="primary-btn review-summary-cta"
            disabled={!filtered.length || starting}
            onClick={() => startReattempt('session_mistakes')}
          >
            Practice all {filtered.length}
          </button>
        </div>
        <p className="review-filter-summary">{reviewSummary}</p>

        {filtered.length ? (
          <div className="session-question-list">
            {filtered.map(item => (
              <QuestionCard key={item.questionId} item={item} session={session} onToggleSave={toggleSave} />
            ))}
          </div>
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
