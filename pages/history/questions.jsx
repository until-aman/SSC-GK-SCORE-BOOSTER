import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getHistoryQuestions, normalizeHistoryQuery } from '@/lib/data/historyClientData';
import { toggleSavedQuestion } from '@/lib/data/savedData';
import { getAIExplanation as getAIExplanationHelper } from '@/lib/data/aiData';
import { REVIEW_QUESTION_CARD_STYLES, ReviewQuestionCard as SharedReviewQuestionCard, ReviewQuestionDetailOverlay } from '@/components/history/ReviewQuestionCard';

const FILTERS = ['all', 'wrong', 'skipped', 'correct', 'saved'];
const FILTER_COPY = {
  all: 'attempted',
  wrong: 'wrong',
  skipped: 'skipped',
  correct: 'correct',
  saved: 'saved',
};
const FILTER_LABELS = {
  all: 'All',
  wrong: 'Wrong',
  skipped: 'Skipped',
  correct: 'Correct',
  saved: 'Saved',
};
const EMPTY_STATE_COPY = {
  correct: {
    title: 'No correct questions yet',
    body: 'You have not answered any question correctly in this filter. Review all questions or practice this set again.',
  },
  wrong: {
    title: 'No wrong questions found',
    body: 'Good job. You have no wrong answers in this filter. Try another filter to review more questions.',
  },
  skipped: {
    title: 'No skipped questions found',
    body: 'You did not skip any question in this filter. Try wrong or all questions instead.',
  },
  saved: {
    title: 'No saved questions yet',
    body: 'Save important questions while reviewing. They will appear here for quick revision.',
  },
  all: {
    title: 'No questions found',
    body: 'Try another filter or review all questions.',
  },
};
const TONES = {
  red:   ['#B91C1C', 'rgba(239,68,68,0.10)'],
  amber: ['#B45309', 'rgba(245,158,11,0.10)'],
  green: ['#047857', 'rgba(16,185,129,0.10)'],
  blue:  ['#1D4ED8', 'rgba(59,130,246,0.10)'],
  grey:  ['#374151', 'rgba(107,114,128,0.10)'],
};

function optionText(question, option) {
  return question[`option${String(option || '').toUpperCase()}`] || '';
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#14B8A6' : 'none'} stroke={filled ? '#14B8A6' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function EmptyStateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
      <path d="M8.5 11h5" />
    </svg>
  );
}

function FilterEmptyState({ activeFilter, canPractice, onViewAll, onPractice }) {
  const copy = EMPTY_STATE_COPY[activeFilter] || EMPTY_STATE_COPY.all;
  const showViewAll = activeFilter !== 'all';
  const actionClass = showViewAll && canPractice ? 'review-empty-actions two' : 'review-empty-actions';
  return (
    <section className="review-empty-state" aria-live="polite">
      <div className="review-empty-icon"><EmptyStateIcon /></div>
      <h2 className="review-empty-title font-display">{copy.title}</h2>
      <p className="review-empty-body">{copy.body}</p>
      {(showViewAll || canPractice) && (
        <div className={actionClass}>
          {showViewAll && (
            <button type="button" className="review-empty-secondary" onClick={onViewAll}>
              View All Questions
            </button>
          )}
          {canPractice && (
            <button type="button" className="review-empty-primary" onClick={onPractice}>
              Practice Again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function QuestionReviewCard({ item, aiCache, setAiCache, onToggleSave }) {
  const [open, setOpen] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);
  const tone = TONES[item.masteryTone] || TONES.grey;
  const cache = aiCache[item.questionId] || { official: item.explanation || '', ai: null, loading: false };
  const optionKeys = ['A', 'B', 'C', 'D'].filter(option => optionText(item, option));
  const userAnswerText = item.lastUserAnswer ? optionText(item, item.lastUserAnswer) : '';
  const correctAnswerText = item.correctOption ? optionText(item, item.correctOption) : '';
  const userAnswerClass = !item.lastUserAnswer ? 'skipped' : item.lastUserAnswer === item.correctOption ? 'correct' : 'wrong';

  async function getAIExplanation() {
    if (cache.ai || cache.loading) return;
    setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, loading: true } }));
    try {
      // Shared helper: 7-day content-keyed cache + in-flight dedup. Sheet
      // explanation remains visible (cache.official) while AI loads.
      const { text, source } = await getAIExplanationHelper({
        question: item.question,
        optionA: item.optionA, optionB: item.optionB, optionC: item.optionC, optionD: item.optionD,
        correctOption: item.correctOption,
        userOption: item.lastUserAnswer,
        sheetExplanation: item.explanation || '',
        subject: item.subject, topic: item.topic,
      });
      setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, ai: source === 'ai' ? text : null, loading: false } }));
    } catch {
      setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, loading: false } }));
    }
  }

  return (
    <article
      className="history-card question-review-card"
      role="button"
      tabIndex={0}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen(value => !value);
        }
      }}
    >
      <div className="question-card-top">
        <div className="question-tag-row">
          {item.subject && <span className="subject-tag">{item.subject}</span>}
          {item.topic && <span className="topic-tag">{item.topic}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="tone-pill question-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.masteryLabel}</span>
          <span className="question-chevron" aria-hidden="true">{open ? '⌃' : '›'}</span>
        </div>
      </div>
      <p className={`question-review-text font-display ${questionExpanded ? 'open' : ''}`}>{item.question}</p>
      {item.question?.length > 260 && (
        <button type="button" className="read-more-btn" onClick={event => { event.stopPropagation(); setQuestionExpanded(value => !value); }}>{questionExpanded ? 'Show Less' : 'Read More'}</button>
      )}
      <div className="question-history-stats">
        <span className="stat-correct">&#10003; Correct {item.correctCount}x</span>
        <span className="stat-wrong">&times; Wrong {item.wrongCount}x</span>
        <span className="stat-skipped">&#9675; Skipped {item.skippedCount}x</span>
      </div>
      {open && (
        <div className="open-detail-panel" onClick={event => event.stopPropagation()}>
          <div className="detail-section">
            <p className="detail-label">Full Question</p>
            <p className="detail-question font-display">{item.question}</p>
          </div>
          {optionKeys.length ? optionKeys.map(option => {
            const correct = option === item.correctOption;
            const user = option === item.lastUserAnswer;
            return (
              <div key={option} className={`option-row ${correct ? 'correct' : ''} ${user && !correct ? 'wrong' : ''}`}>
                <span>{option}. {optionText(item, option) || '-'}</span>
                {user && !correct && <b>Your last answer ×</b>}
                {correct && <b>Correct ✓</b>}
              </div>
            );
          }) : null}
          <div className="divider" />
          <div className="answer-summary-grid">
            <div className={`answer-summary-row ${userAnswerClass}`}>
              <span>Your Last Answer</span>
              <b>{userAnswerText || 'Skipped'}</b>
            </div>
            <div className="answer-summary-row correct">
              <span>Correct Answer</span>
              <b>{correctAnswerText || item.correctOption || 'Not available'}</b>
            </div>
          </div>
          <div className="divider" />
          {true && (
            <div className="explanation-panel">
              <p className="detail-label">Explanation</p>
              {item.explanation ? (
                <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.55 }}>{item.explanation}</p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ssc-text-muted)', lineHeight: 1.55 }}>No official explanation available.</p>
              )}
              {cache.ai && (
                <div style={{ marginTop: 10, padding: 11, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 7px' }}>✦ AI Explanation</p>
                  <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.55, margin: 0 }}>{cache.ai}</p>
                </div>
              )}
              <button type="button" className="secondary-btn mt-3 w-full" disabled={cache.loading} onClick={getAIExplanation}>{cache.loading ? 'Loading...' : 'Get AI Explanation ✦'}</button>
            </div>
          )}
        </div>
      )}
      <div className="question-action-row">
        <button type="button" className={`save-icon-btn ${item.isSaved ? 'saved' : ''}`} onClick={event => { event.stopPropagation(); onToggleSave(item); }} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'} title={item.isSaved ? 'Saved' : 'Save'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>
    </article>
  );
}

export default function HistoryQuestionsPage() {
  const { data: session, status } = useSession();
  const cacheScope = getUserCacheScope(session);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reviewIndex, setReviewIndex] = useState(null);

  const queryTitle = [router.query.subject, router.query.topic].filter(Boolean).join(' · ') || 'Attempted Questions';

  const loadQuestions = useCallback(async function loadQuestions(nextPage = 1, append = false) {
    setLoading(true);
    try {
      const query = normalizeHistoryQuery({ ...router.query, page: nextPage, limit: 50 });
      const res = await getHistoryQuestions({ scope: cacheScope, query });
      const json = res?.data;
      if (!json?.success) throw new Error(json?.error || 'Failed');
      setData(prev => append ? { ...json.data, questions: [...(prev?.questions || []), ...json.data.questions] } : json.data);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }, [router.query, cacheScope]);

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') { setLoading(false); return; }
    loadQuestions(1, false);
  }, [router.isReady, status, router.query.subject, router.query.topic, router.query.status, router.query.questionHistory, loadQuestions]);

  const allQuestions = useMemo(() => data?.questions || [], [data?.questions]);
  const filtered = useMemo(() => {
    const questions = allQuestions;
    if (activeFilter === 'all') return questions;
    if (activeFilter === 'saved') return questions.filter(item => item.isSaved);
    if (activeFilter === 'wrong') return questions.filter(item => item.wrongCount > 0);
    if (activeFilter === 'skipped') return questions.filter(item => item.skippedCount > 0);
    if (activeFilter === 'correct') return questions.filter(item => item.correctCount > 0);
    return questions;
  }, [activeFilter, allQuestions]);
  const filterCounts = useMemo(() => {
    const questions = allQuestions;
    return {
      all: questions.length,
      wrong: questions.filter(item => item.wrongCount > 0).length,
      skipped: questions.filter(item => item.skippedCount > 0).length,
      correct: questions.filter(item => item.correctCount > 0).length,
      saved: questions.filter(item => item.isSaved).length,
    };
  }, [allQuestions]);
  const reviewNoun = activeFilter === 'all' ? 'questions' : `question${filtered.length !== 1 ? 's' : ''}`;
  const reviewSummary = `Showing ${FILTER_COPY[activeFilter]} ${reviewNoun}`;
  const reviewSummaryLabel = activeFilter === 'wrong' ? 'Wrong Questions'
    : activeFilter === 'skipped' ? 'Skipped Questions'
      : activeFilter === 'correct' ? 'Correct Questions'
        : activeFilter === 'saved' ? 'Saved Questions'
          : 'Questions';

  function startQuestionSet(questions, quizMode, topicLabel) {
    if (!questions.length) return;
    const returnUrl = router.asPath || '/history/questions';
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions,
      quizMode,
      subject: String(router.query.subject || 'History'),
      topic: topicLabel,
      sourceCollection: questions[0]?.sourceCollection || 'general',
      returnUrl,
    }));
    router.push(`/quiz?mode=history&count=${questions.length}&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
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
    const returnUrl = router.asPath || '/history/questions';
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions: json.data.questions,
      quizMode: json.data.quizMode,
      subject: subject || 'History',
      topic: topic || 'Filtered Practice',
      sourceCollection: 'general',
      returnUrl,
    }));
    router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
  }

  async function toggleSave(question) {
    // Optimistic UI patch (unchanged), then shared mutation helper that patches
    // the scoped IDs/list caches + marks History caches stale. No full GET.
    setData(prev => ({ ...prev, questions: prev.questions.map(item => item.questionId === question.questionId ? { ...item, isSaved: !item.isSaved } : item) }));
    try {
      const r = await toggleSavedQuestion({ scope: cacheScope, action: question.isSaved ? 'unsave' : 'save', question });
      if (!r.ok) loadQuestions(page, false); // rollback via refetch on failure
    } catch { loadQuestions(page, false); }
  }

  return (
    <>
      <Head><title>Question Review - SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[var(--ssc-bg)] pb-28">
        <style>{`
          .history-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:16px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
          ${REVIEW_QUESTION_CARD_STYLES}
          .review-summary-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:15px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
          .summary-total{font-family:var(--font-display);font-size:22px;font-weight:950;line-height:1;color:var(--ssc-text-primary)}
          .summary-label{font-size:12px;font-weight:700;color:var(--ssc-text-muted);margin-top:4px}
          .summary-stat-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:12px;padding-top:12px;border-top:1px solid var(--ssc-border-soft);font-size:13px;font-weight:800}
          .summary-stat.correct{color:var(--ssc-teal)}
          .summary-stat.wrong{color:#DC2626}
          .summary-stat.skipped{color:var(--ssc-text-muted)}
          .question-review-list{display:grid;gap:10px}
          .question-review-card{padding:12px 13px;margin-bottom:0;border-radius:14px}
          .question-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
          .question-tag-row{display:flex;gap:7px;align-items:center;min-width:0;overflow:hidden;flex:1}
          .subject-tag,.topic-tag{display:inline-flex;align-items:center;height:22px;border-radius:999px;padding:0 9px;font-size:10px;font-weight:1000;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .subject-tag{max-width:40%;color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14)}
          .topic-tag{max-width:72%;color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.14)}
          .question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto}
          .question-review-text{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.38;margin:10px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical}
          .question-review-text.open{-webkit-line-clamp:unset;display:block}
          .read-more-btn{border:0;background:transparent;color:var(--ssc-teal);font-size:12px;font-weight:800;padding:8px 0 0;cursor:pointer;font-family:inherit}
          .question-history-stats{display:flex;align-items:center;justify-content:space-between;gap:8px;row-gap:7px;flex-wrap:wrap;margin-top:14px;padding:11px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);font-size:12px;font-weight:800}
          .stat-correct{color:var(--ssc-teal)}
          .stat-wrong{color:#DC2626}
          .stat-skipped{color:var(--ssc-text-muted)}
          .question-review-card{cursor:pointer}.question-review-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}.question-action-row{display:flex;justify-content:flex-end;margin-top:13px;align-items:center}.question-chevron{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-secondary);font-size:18px;font-weight:900}
          .save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:rgba(248,250,252,1);display:flex;align-items:center;justify-content:center}
          .save-icon-btn:active{transform:scale(.92)}
          .save-icon-btn.saved{border-color:rgba(20,184,166,0.40);background:rgba(20,184,166,0.12)}
          .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit}
          .primary-btn{border:0;background:linear-gradient(135deg,#FF8A1F,#FF5A00);color:white;box-shadow:0 4px 12px rgba(255,107,22,0.25)}
          .secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);color:var(--ssc-teal)}
          .primary-btn:disabled,.secondary-btn:disabled{opacity:.45;cursor:default;box-shadow:none}
          .chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:12px;font-weight:700;padding:7px 14px;white-space:nowrap;text-transform:capitalize;cursor:pointer;font-family:inherit}
          .chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 8px 18px rgba(14,165,164,.16)}
          .filter-chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 0 10px;margin:0;scrollbar-width:none;-ms-overflow-style:none}
          .filter-chip-row::-webkit-scrollbar{display:none}
          .review-filter-summary-card{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin:0 0 14px;padding:15px 16px;border-radius:16px;border:1px solid #BDEDEA;background:linear-gradient(180deg,#F6FFFD 0%,#EAFBF7 100%);box-shadow:var(--ssc-shadow-card)}
          .review-filter-summary-title{color:var(--ssc-text-primary);font-size:12px;font-weight:1000;line-height:1.35;margin:0}
          .review-filter-summary-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
          .review-filter-summary-count{color:var(--ssc-teal);font-family:var(--font-display);font-size:24px;font-weight:1000;line-height:1;margin:0}
          .review-filter-summary-label{color:var(--ssc-text-secondary);font-size:11px;font-weight:800;line-height:1.25;margin:3px 0 0}
          .review-filter-summary-cta{width:50%;max-width:180px;min-width:132px;height:42px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;font-family:inherit;font-size:13px;font-weight:1000;box-shadow:var(--ssc-shadow-cta);cursor:pointer;white-space:nowrap;flex-shrink:0}
          .review-empty-state{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;box-shadow:var(--ssc-shadow-card);padding:26px 20px;margin:0 0 14px;text-align:center}
          .review-empty-icon{width:58px;height:58px;border-radius:18px;background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14);display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
          .review-empty-title{color:var(--ssc-text-primary);font-size:17px;font-weight:1000;line-height:1.2;margin:0 0 9px}
          .review-empty-body{color:var(--ssc-text-secondary);font-size:13px;font-weight:700;line-height:1.55;margin:0 auto 18px;max-width:310px}
          .review-empty-actions{display:grid;grid-template-columns:1fr;gap:10px}
          .review-empty-actions.two{grid-template-columns:1fr 1fr}
          .review-empty-primary,.review-empty-secondary{height:44px;border-radius:14px;font-family:inherit;font-size:13px;font-weight:1000;cursor:pointer}
          .review-empty-primary{border:0;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;box-shadow:var(--ssc-shadow-cta)}
          .review-empty-secondary{border:1px solid rgba(14,165,164,.28);background:var(--ssc-surface-soft);color:var(--ssc-teal)}
          .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900}
          .open-detail-panel{margin-top:14px;padding:12px;border:1px solid var(--ssc-border-soft);border-radius:16px;background:rgba(248,250,252,1)}
          .detail-section{margin-bottom:10px}
          .detail-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}
          .detail-question{color:var(--ssc-text-primary);font-size:13px;font-weight:800;line-height:1.48;margin:0}
          .answer-summary-grid{display:grid;gap:8px}
          .answer-summary-row{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);border-radius:12px;padding:9px 10px}
          .answer-summary-row span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}
          .answer-summary-row b{display:block;font-size:12px;line-height:1.4;color:var(--ssc-text-primary)}
          .answer-summary-row.correct b{color:var(--ssc-teal)}
          .answer-summary-row.wrong b{color:#DC2626}
          .answer-summary-row.skipped b{color:var(--ssc-text-muted)}
          .explanation-panel{margin-top:10px;border:1px solid rgba(14,165,164,0.20);border-radius:14px;background:rgba(14,165,164,0.06);padding:11px}
          .option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);border-radius:12px;padding:10px;margin-top:8px;color:var(--ssc-text-secondary);font-size:13px}
          .option-row.correct{border-color:rgba(20,184,166,0.35);background:rgba(20,184,166,0.07);color:var(--ssc-teal)}
          .option-row.wrong{border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.07);color:#DC2626}
          .divider{height:1px;background:var(--ssc-border-soft);margin:12px 0}
        `}</style>
        <HistoryTopBar title="Question Review" showBack badge="HISTORY" />
        <main className="px-4 pt-5">
          <header className="mb-4">
            <h1 className="font-display text-xl font-black text-[var(--ssc-text-primary)]">{queryTitle}</h1>
            <p className="text-sm text-[var(--ssc-text-muted)]">Attempted questions · {router.query.status || 'All'}</p>
          </header>
          {status === 'loading' || loading ? <Loader card size="md" label="Loading questions..." /> : status === 'unauthenticated' ? (
            <div className="history-card text-center text-[var(--ssc-text-secondary)]">Sign in to review questions.</div>
          ) : (
            <>
              <section className="review-summary-card">
                <div>
                  <p className="summary-total">{data?.summary?.totalQuestions || 0} Questions</p>
                  <p className="summary-label">Attempted in this review set</p>
                </div>
                <div className="summary-stat-row">
                  <span className="summary-stat correct">✓ {data?.summary?.correctCount || 0} Correct</span>
                  <span className="summary-stat wrong">× {data?.summary?.wrongCount || 0} Wrong</span>
                  <span className="summary-stat skipped">○ {data?.summary?.skippedCount || 0} Skipped</span>
                </div>
              </section>
              <div className="filter-chip-row">{FILTERS.map(filter => <button key={filter} type="button" className={`chip ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)}>{FILTER_LABELS[filter]} ({filterCounts[filter] ?? 0})</button>)}</div>
              <section className="review-filter-summary-card">
                <p className="review-filter-summary-title">{reviewSummary}</p>
                <div className="review-filter-summary-row">
                  <div>
                    <p className="review-filter-summary-count">{filtered.length}</p>
                    <p className="review-filter-summary-label">{reviewSummaryLabel}</p>
                  </div>
                  {filtered.length > 0 && (
                    <button
                      type="button"
                      className="review-filter-summary-cta"
                      onClick={() => startQuestionSet(filtered, activeFilter === 'skipped' ? 'reattempt_skipped' : 'reattempt_mistakes', reviewSummaryLabel)}
                    >
                      Practice all {filtered.length}
                    </button>
                  )}
                </div>
              </section>
              {filtered.length ? (
                <div className="question-review-list">
                  {filtered.map((item, index) => (
                    <SharedReviewQuestionCard key={item.questionId} item={item} onView={() => setReviewIndex(index)} onToggleSave={toggleSave} />
                  ))}
                </div>
              ) : (
                <FilterEmptyState
                  activeFilter={activeFilter}
                  canPractice={allQuestions.length > 0}
                  onViewAll={() => setActiveFilter('all')}
                  onPractice={() => startQuestionSet(allQuestions, activeFilter === 'skipped' ? 'reattempt_skipped' : 'reattempt_mistakes', 'Question Practice')}
                />
              )}
            </>
          )}
        </main>
        {reviewIndex !== null && filtered.length > 0 && (
          <ReviewQuestionDetailOverlay
            questions={filtered}
            startIndex={reviewIndex}
            onClose={() => setReviewIndex(null)}
            onToggleSave={toggleSave}
          />
        )}
      </div>
    </>
  );
}
