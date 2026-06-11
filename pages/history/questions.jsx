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

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#14B8A6' : 'none'} stroke={filled ? '#14B8A6' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function QuestionReviewCard({ item, aiCache, setAiCache, onPractice, onToggleSave }) {
  const [open, setOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
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
    <article className="history-card question-review-card">
      <div className="question-card-top">
        <p className="question-kicker">{item.subject} &middot; {item.topic}</p>
        <span className="tone-pill question-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.masteryLabel}</span>
      </div>
      <p className={`question-review-text font-display ${questionExpanded ? 'open' : ''}`}>{item.question}</p>
      {item.question?.length > 260 && (
        <button type="button" className="read-more-btn" onClick={() => setQuestionExpanded(value => !value)}>{questionExpanded ? 'Show Less' : 'Read More'}</button>
      )}
      <div className="question-history-stats">
        <span className="stat-correct">&#10003; Correct {item.correctCount}x</span>
        <span className="stat-wrong">&times; Wrong {item.wrongCount}x</span>
        <span className="stat-skipped">&#9675; Skipped {item.skippedCount}x</span>
      </div>
      {open && (
        <div className="open-detail-panel">
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
          <button type="button" className="secondary-btn w-full" onClick={() => setExplanationOpen(value => !value)}>{explanationOpen ? 'Hide Explanation' : 'Show Explanation'}</button>
          {explanationOpen && (
            <div className="explanation-panel">
              <p className="detail-label">Explanation</p>
              {item.explanation ? <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
              {cache.ai && <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p>}
              <button type="button" className="secondary-btn mt-3 w-full" disabled={cache.loading} onClick={getAIExplanation}>{cache.loading ? 'Loading...' : 'Get AI Explanation ✦'}</button>
            </div>
          )}
        </div>
      )}
      <div className="question-action-row">
        <button type="button" className="primary-btn" onClick={() => onPractice(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={() => { setOpen(value => !value); if (open) setExplanationOpen(false); }}>{open ? 'Close' : 'Open'}</button>
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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [aiCache, setAiCache] = useState({});

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
  const practiceSet = useMemo(() => {
    if (activeFilter === 'skipped') return allQuestions.filter(item => item.skippedCount > 0);
    if (activeFilter === 'wrong') return allQuestions.filter(item => item.wrongCount > 0);
    return allQuestions.filter(item => item.wrongCount > 0 || item.skippedCount > 0);
  }, [activeFilter, allQuestions]);
  const practiceSetLabel = activeFilter === 'skipped' ? 'Skipped' : 'Mistakes';
  const safeActiveQuestionIndex = filtered.length ? Math.min(activeQuestionIndex, filtered.length - 1) : 0;
  const activeQuestion = filtered[safeActiveQuestionIndex] || null;
  const reviewNoun = activeFilter === 'all' ? 'questions' : `question${filtered.length !== 1 ? 's' : ''}`;
  const reviewSummary = `Reviewing ${filtered.length} ${FILTER_COPY[activeFilter]} ${reviewNoun}`;

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [activeFilter, data?.questions]);

  useEffect(() => {
    if (activeQuestionIndex > 0 && activeQuestionIndex >= filtered.length) {
      setActiveQuestionIndex(Math.max(filtered.length - 1, 0));
    }
  }, [activeQuestionIndex, filtered.length]);

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

  function startQuestionSet(questions, quizMode, topicLabel) {
    if (!questions.length) return;
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions,
      quizMode,
      subject: String(router.query.subject || 'History'),
      topic: topicLabel,
      sourceCollection: questions[0]?.sourceCollection || 'general',
    }));
    router.push(`/quiz?mode=history&count=${questions.length}&sourceScreen=history`);
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
      <div className="min-h-screen [background:var(--bg-app)] pb-28">
        <style>{`
          .history-card{background:#172d47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;margin-bottom:12px}.review-summary-card{background:linear-gradient(180deg,rgba(23,45,71,.98),rgba(20,40,64,.98));border:1px solid rgba(148,163,184,.14);border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:0 18px 45px rgba(0,0,0,.16)}.summary-total{font-family:var(--font-display);font-size:20px;font-weight:950;line-height:1;color:#fff}.summary-label{font-size:12px;font-weight:800;color:#8fa3bd;margin-top:4px}.summary-stat-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);font-size:13px;font-weight:900}.summary-stat.correct{color:#5eead4}.summary-stat.wrong{color:#fca5a5}.summary-stat.skipped{color:#93a4ba}.carousel-shell{background:#172d47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:13px 14px;margin-bottom:12px}.carousel-progress{margin-bottom:12px}.carousel-progress strong{display:block;color:#f8fafc;font-size:14px;font-weight:900;line-height:1.2}.carousel-progress span{display:block;color:#94a3b8;font-size:12px;font-weight:800;margin-top:4px}.carousel-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px}.question-review-card{padding:14px 15px}.question-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:#5eead4;font-size:11px;font-weight:900;line-height:1.35;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto}.question-review-text{color:#f8fafc;font-size:15px;font-weight:900;line-height:1.5;margin:13px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical}.question-review-text.open{-webkit-line-clamp:unset;display:block}.read-more-btn{border:0;background:transparent;color:#fdba74;font-size:12px;font-weight:900;padding:8px 0 0}.question-history-stats{display:flex;align-items:center;justify-content:space-between;gap:8px;row-gap:7px;flex-wrap:wrap;margin-top:14px;padding:11px 0;border-top:1px solid rgba(148,163,184,.10);border-bottom:1px solid rgba(148,163,184,.10);font-size:12px;font-weight:900}.stat-correct{color:#5eead4}.stat-wrong{color:#fca5a5}.stat-skipped{color:#93a4ba}.question-action-row{display:grid;grid-template-columns:1fr .72fr 40px;gap:8px;margin-top:13px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(20,184,166,.40);background:rgba(20,184,166,.18)}.bottom-action-card{display:grid;gap:8px;margin:18px 0 8px;padding:8px;border-radius:18px;background:rgba(13,27,46,.72);border:1px solid rgba(255,255,255,.08);box-shadow:0 16px 38px rgba(0,0,0,.18)}.bottom-action-card .primary-btn{box-shadow:0 14px 34px rgba(255,90,0,.22)}.primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white}.secondary-btn{border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.04);color:#cbd5e1}.primary-btn:disabled,.secondary-btn:disabled{opacity:.45;cursor:default}.chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172d47;color:#94a3b8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap;text-transform:capitalize}.chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#fdba74}.filter-chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 16px 8px;margin:0 -16px;scrollbar-width:none;-ms-overflow-style:none}.filter-chip-row::-webkit-scrollbar{display:none}.review-filter-summary{color:#94a3b8;font-size:12px;font-weight:800;line-height:1.4;margin:0 0 12px 2px}.tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900}.open-detail-panel{margin-top:14px;padding:12px;border:1px solid rgba(148,163,184,.10);border-radius:16px;background:rgba(15,23,42,.28)}.detail-section{margin-bottom:10px}.detail-label{color:#94a3b8;font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.detail-question{color:#f8fafc;font-size:13px;font-weight:900;line-height:1.48;margin:0}.answer-summary-grid{display:grid;gap:8px}.answer-summary-row{border:1px solid rgba(148,163,184,.10);background:rgba(255,255,255,.035);border-radius:12px;padding:9px 10px}.answer-summary-row span{display:block;color:#94a3b8;font-size:10px;font-weight:900;margin-bottom:4px}.answer-summary-row b{display:block;font-size:12px;line-height:1.4}.answer-summary-row.correct b{color:#5eead4}.answer-summary-row.wrong b{color:#fca5a5}.answer-summary-row.skipped b{color:#93a4ba}.explanation-panel{margin-top:10px;border:1px solid rgba(148,163,184,.10);border-radius:14px;background:rgba(15,23,42,.45);padding:11px}.option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(148,163,184,.12);background:rgba(255,255,255,.035);border-radius:12px;padding:10px;margin-top:8px;color:#cbd5e1;font-size:13px}.option-row.correct{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);color:#bbf7d0}.option-row.wrong{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.10);color:#fecaca}.divider{height:1px;background:rgba(255,255,255,.07);margin:12px 0}
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
              <p className="review-filter-summary">{reviewSummary}</p>
              {activeQuestion ? (
                <>
                  <section className="carousel-shell">
                    <div className="carousel-progress">
                      <strong className="font-display">Question {safeActiveQuestionIndex + 1} of {filtered.length}</strong>
                      <span>Use Previous and Next to review one question at a time</span>
                    </div>
                    <div className="carousel-nav">
                      <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex === 0} onClick={() => setActiveQuestionIndex(index => Math.max(index - 1, 0))}>Previous</button>
                      <button type="button" className="secondary-btn" disabled={safeActiveQuestionIndex >= filtered.length - 1} onClick={() => setActiveQuestionIndex(index => Math.min(index + 1, filtered.length - 1))}>Next</button>
                    </div>
                  </section>
                  <QuestionReviewCard key={activeQuestion.questionId} item={activeQuestion} aiCache={aiCache} setAiCache={setAiCache} onPractice={practiceQuestion} onToggleSave={toggleSave} />
                  <section className="bottom-action-card">
                    <button type="button" className="primary-btn" disabled={!practiceSet.length} onClick={() => startQuestionSet(practiceSet, activeFilter === 'skipped' ? 'reattempt_skipped' : 'reattempt_mistakes', activeFilter === 'skipped' ? 'Skipped Practice' : 'Mistake Practice')}>Practice {practiceSet.length} {practiceSetLabel}</button>
                    <button type="button" className="secondary-btn" disabled={!allQuestions.length} onClick={() => startQuestionSet(allQuestions, 'reattempt_all', 'Full Set Re-attempt')}>Re-attempt All {allQuestions.length}</button>
                  </section>
                </>
              ) : (
                <div className="history-card text-center text-slate-400">
                  <p className="font-display font-black text-white mb-1">No questions found in this filter.</p>
                  <p>Try another filter.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
