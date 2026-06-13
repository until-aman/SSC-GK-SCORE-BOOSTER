import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { markJourney } from '@/lib/journeyDiagnostics';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getHistoryLanding, getHistoryQuizzes, getHistoryTopics, getHistoryQuestions, normalizeHistoryQuery } from '@/lib/data/historyClientData';
import { toggleSavedQuestion } from '@/lib/data/savedData';
import { getAIExplanation as getAIExplanationHelper } from '@/lib/data/aiData';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';

const MODES = [
  { key: 'quiz', label: 'Quiz-wise', shortLabel: 'Quizzes' },
  { key: 'subject', label: 'Subject-wise', shortLabel: 'Subjects' },
  { key: 'topic', label: 'Topic-wise', shortLabel: 'Topics' },
  { key: 'mistakes', label: 'Mistakes', shortLabel: 'Mistakes' },
];

const QUICK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'custom', label: 'Custom' },
];

const QUESTION_TYPES = [
  { key: 'wrong', label: 'Wrong' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'repeated', label: 'Repeated' },
  { key: 'saved', label: 'Saved' },
  { key: 'never_correct', label: 'Never Correct' },
];

const TONES = {
  green: ['#0F8F6F', 'var(--ssc-success-soft)'],
  amber: ['#B77900', 'var(--ssc-warning-soft)'],
  red: ['#DC2626', 'var(--ssc-danger-soft)'],
  blue: ['#2563EB', 'var(--ssc-info-soft)'],
  orange: ['#F45100', 'rgba(255,106,0,.10)'],
  grey: ['#5B6B82', 'var(--ssc-surface-soft)'],
};

function HistoryHeaderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CountUp({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let frame;
    function tick(now) {
      const pct = Math.min(1, (now - start) / 600);
      setDisplay(Math.round(target * (1 - Math.pow(1 - pct, 3))));
      if (pct < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display}{suffix}</>;
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--ssc-teal)' : 'none'} stroke={filled ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function formatDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatRangeDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function optionText(question, option) {
  return question[`option${String(option || '').toUpperCase()}`] || '';
}

function EmptyPanel({ title, body, action, onClick }) {
  return (
    <section className="history-card text-center">
      <p className="font-display font-black" style={{ color: 'var(--ssc-text-primary)' }}>{title}</p>
      <p className="text-sm mt-1 mb-4" style={{ color: 'var(--ssc-text-secondary)' }}>{body}</p>
      {action && <button type="button" className="primary-btn" onClick={onClick}>{action}</button>}
    </section>
  );
}

function Modal({ modal, onClose, onConfirm, busy }) {
  if (!modal) return null;
  const sizes = modal.count > 25 ? [10, 25, 50].filter(size => size <= modal.count || size === 50) : [];
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h2 className="font-display text-xl font-black text-white">{modal.title}</h2>
        <p className="text-sm font-bold text-slate-300 mt-3">{modal.subject}{modal.topic ? ` · ${modal.topic}` : ''}</p>
        <p className="text-sm text-slate-400 mt-2">{modal.body}</p>
        {sizes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 mb-2">Choose practice size:</p>
            <div className="grid grid-cols-3 gap-2">
              {sizes.map(size => (
                <button key={size} type="button" className={`chip ${modal.limit === size ? 'active' : ''}`} onClick={() => modal.setLimit(size)}>{size}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button type="button" className="secondary-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{busy ? 'Starting...' : <>Start Practice &rarr;</>}</button>
        </div>
      </div>
    </div>
  );
}

function DateRangeModal({
  open,
  startDate,
  endDate,
  error,
  onStartChange,
  onEndChange,
  onApply,
  onClose,
  onReset,
}) {
  if (!open) return null;
  return (
    <div className="date-modal-backdrop" onClick={onClose}>
      <section className="date-modal-card" onClick={event => event.stopPropagation()}>
        <div className="date-modal-top">
          <div>
            <h2 className="font-display">Select Date Range</h2>
            <p>Choose the quiz attempt period you want to review.</p>
          </div>
          <button type="button" className="date-close-btn" onClick={onClose} aria-label="Close date range modal">&times;</button>
        </div>

        <div className="date-field-group">
          <label htmlFor="quiz-history-start-date">From</label>
          <input id="quiz-history-start-date" type="date" value={startDate} max={todayInputValue()} onChange={event => onStartChange(event.target.value)} />
        </div>

        <div className="date-field-group">
          <label htmlFor="quiz-history-end-date">To</label>
          <input id="quiz-history-end-date" type="date" value={endDate} max={todayInputValue()} onChange={event => onEndChange(event.target.value)} />
        </div>

        {error && <p className="date-error">{error}</p>}

        <div className="date-modal-actions">
          <button type="button" className="secondary-btn" onClick={onReset}>Reset</button>
          <button type="button" className="primary-btn" onClick={onApply}>Apply &rarr;</button>
        </div>
      </section>
    </div>
  );
}

function QuizCard({ session, onReview, onPractice }) {
  const mistakes = (Number(session.incorrect) || 0) + (Number(session.skipped) || 0);
  const maxScore = session.maxScore || session.questionCount * 2;
  const tone = TONES[session.badgeTone] || TONES.amber;
  return (
    <article className="history-card quiz-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="quiz-title font-display">{session.subject} &middot; {session.topic}</h3>
          <p className="quiz-date">{formatDate(session.completedAt)}</p>
        </div>
        <span className="tone-pill quiz-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{session.badge}</span>
      </div>

      <div className="quiz-metric-row">
        <div className="quiz-metric">
          <strong className="font-display">{session.score} / {maxScore}</strong>
          <span>Score</span>
        </div>
        <div className="quiz-metric quiz-metric-coins">
          <strong className="font-display">+{session.coinsEarned}</strong>
          <span>Coins</span>
        </div>
      </div>

      <div className="quiz-result-row">
        <span className="text-slate-400">{session.questionCount} Qs</span>
        <span className="text-emerald-300">&#10003; {session.correct}</span>
        <span className="text-red-300">&times; {session.incorrect}</span>
        <span className="text-slate-400">&#9675; {session.skipped}</span>
      </div>

      <div className="quiz-action-row">
        {mistakes > 0 ? (
          <>
            <button type="button" className="primary-btn" onClick={() => onPractice(session)}>Practice Mistakes</button>
            <button type="button" className="secondary-btn" onClick={() => onReview(session)}>Review Quiz</button>
          </>
        ) : (
          <>
            <button type="button" className="primary-btn" onClick={() => onReview(session)}>Review Quiz</button>
            <button type="button" className="secondary-btn" disabled>Practice Mistakes</button>
          </>
        )}
      </div>
    </article>
  );
}
function StatEntityCard({ item, type, onPractice, onReview }) {
  const tone = TONES[item.statusTone] || TONES.grey;
  const title = type === 'topic' ? item.topic : item.subject;
  const hasMistakes = item.hasMistakes || ((Number(item.wrongCount) || 0) + (Number(item.skippedCount) || 0)) > 0;
  const revisionLabel = item.statusLabel === 'Improve' ? 'Needs Revision' : item.statusLabel;

  if (type === 'subject') {
    return (
      <article className="history-card entity-card subject-entity-card">
        <div className="entity-top">
          <h3 className="entity-title font-display">{title}</h3>
          <span className="tone-pill entity-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{revisionLabel}</span>
        </div>

        <p className="subject-meta-line">Last practiced {formatDate(item.lastPracticedAt)}</p>

        <div className="entity-stat-row subject-stat-row">
          <span className="text-slate-400">{item.questionCount} Qs</span>
          <span className="text-emerald-300">&#10003; {item.correctCount}</span>
          <span className="text-red-300">&times; {item.wrongCount}</span>
          <span className="text-slate-400">&#9675; {item.skippedCount}</span>
        </div>

        <div className="subject-action-row">
          {hasMistakes ? (
            <>
              <button type="button" className="primary-btn" onClick={() => onPractice(item)}>Practice Mistakes</button>
              <button type="button" className="secondary-btn" onClick={() => onReview(item)}>Review Questions</button>
            </>
          ) : (
            <>
              <button type="button" className="primary-btn" onClick={() => onReview(item)}>Review Questions</button>
              <button type="button" className="secondary-btn" disabled>Practice Mistakes</button>
            </>
          )}
        </div>
      </article>
    );
  }

  if (type === 'topic') {
    return (
      <article className="history-card entity-card topic-entity-card">
        <div className="entity-top">
          <h3 className="entity-title font-display">{title}</h3>
          <span className="tone-pill entity-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{revisionLabel}</span>
        </div>

        <p className="topic-subject-line">{item.subject}</p>
        <p className="subject-meta-line">Last practiced {formatDate(item.lastPracticedAt)}</p>

        <div className="entity-stat-row subject-stat-row">
          <span className="text-slate-400">{item.questionCount} Qs</span>
          <span className="text-emerald-300">&#10003; {item.correctCount}</span>
          <span className="text-red-300">&times; {item.wrongCount}</span>
          <span className="text-slate-400">&#9675; {item.skippedCount}</span>
        </div>

        <div className="subject-action-row">
          {hasMistakes ? (
            <>
              <button type="button" className="primary-btn" onClick={() => onPractice(item)}>Practice Mistakes</button>
              <button type="button" className="secondary-btn" onClick={() => onReview(item)}>Review</button>
            </>
          ) : (
            <>
              <button type="button" className="primary-btn" onClick={() => onReview(item)}>Review</button>
              <button type="button" className="secondary-btn" disabled>Practice Mistakes</button>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="history-card entity-card">
      <div className="entity-top">
        <div className="min-w-0 flex-1">
          <h3 className="entity-title font-display">{title}</h3>
          {type === 'topic' && (
            <p className="entity-subtitle">{item.subject} &middot; {item.statusLabel}</p>
          )}
        </div>
        <div className="entity-accuracy">
          <p className="font-display" style={{ color: tone[0] }}>{item.accuracy}%</p>
          {type !== 'topic' && (
            <span className="tone-pill entity-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.statusLabel}</span>
          )}
        </div>
      </div>

      <div className="entity-meta">
        <span>{item.questionCount} questions attempted</span>
        <span>Last practiced: {formatDate(item.lastPracticedAt)}</span>
      </div>

      <div className="entity-stat-row">
        <span className="text-emerald-300">&#10003; {item.correctCount}</span>
        <span className="text-red-300">&times; {item.wrongCount}</span>
        <span className="text-amber-300">~ {item.skippedCount}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {hasMistakes ? (
          <>
            <button type="button" className="primary-btn" onClick={() => onPractice(item)}>Practice Mistakes</button>
            <button type="button" className="secondary-btn" onClick={() => onReview(item)}>{type === 'topic' ? 'Review' : 'Review Questions'}</button>
          </>
        ) : (
          <>
            <button type="button" className="primary-btn" onClick={() => onReview(item)}>{type === 'topic' ? 'Review' : 'Review Questions'}</button>
            <button type="button" className="secondary-btn" disabled>Practice Mistakes</button>
          </>
        )}
      </div>
    </article>
  );
}
function QuestionCard({ item, isOpen, onToggleOpen, aiCache, setAiCache, onPracticeOne, onToggleSave }) {
  const cache = aiCache[item.questionId] || { official: item.explanation || '', ai: null, loading: false };
  const statusText = item.lastAttemptStatus === 'skipped' ? 'Skipped' : item.lastAttemptStatus === 'correct' ? 'Correct' : 'Wrong';
  const correctCount = Number(item.correctCount) || 0;
  const wrongCount = Number(item.wrongCount) || 0;
  const skippedCount = Number(item.skippedCount) || 0;
  const lastAnswerText = item.lastUserAnswer ? optionText(item, item.lastUserAnswer) : '';
  const correctAnswerText = item.correctOption ? optionText(item, item.correctOption) : '';
  const lastAnswerTone = !item.lastUserAnswer ? 'skipped' : item.lastUserAnswer === item.correctOption ? 'correct' : 'wrong';
  let smartTag = 'Needs Revision';
  let tagTone = TONES.amber;
  if (wrongCount >= 2 && correctCount === 0) {
    smartTag = 'Never Correct';
    tagTone = TONES.red;
  } else if (wrongCount >= 2) {
    smartTag = 'Repeated Mistake';
    tagTone = TONES.red;
  } else if (skippedCount >= 2) {
    smartTag = 'Often Skipped';
    tagTone = TONES.blue;
  } else if (correctCount > 0 && wrongCount > 0) {
    smartTag = 'Improving';
    tagTone = TONES.amber;
  } else if (correctCount >= 2 && item.lastAttemptStatus === 'correct') {
    smartTag = 'Mastered';
    tagTone = TONES.green;
  }

  async function getAIExplanation() {
    if (cache.ai || cache.loading) return;
    setAiCache(prev => ({ ...prev, [item.questionId]: { ...cache, loading: true } }));
    try {
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
    <article className={`history-card question-card ${isOpen ? 'open' : ''}`}>
      <div className="question-top-row">
        <p className="question-kicker">{item.subject} &middot; {item.topic}</p>
        <span className="tone-pill question-badge" style={{ color: tagTone[0], background: tagTone[1], borderColor: `${tagTone[0]}55` }}>{smartTag}</span>
      </div>

      <p className="question-preview font-display">{item.questionPreview || item.question}</p>

      <div className="question-stat-row">
        <span className="text-red-300">Wrong {wrongCount}x</span>
        <span className="text-slate-400">Skipped {skippedCount}x</span>
      </div>

      {isOpen && (
        <div className="question-expanded">
          <div className="expanded-block">
            <p className="expanded-label">Full Question</p>
            <p className="expanded-question font-display">{item.question}</p>
          </div>
          <div className="answer-detail-grid">
            <div className={`answer-detail ${lastAnswerTone}`}>
              <span>Your Last Answer</span>
              <b>{lastAnswerText || 'Skipped'}</b>
            </div>
            <div className="answer-detail correct">
              <span>Correct Answer</span>
              <b>{correctAnswerText || item.correctOption || 'Not available'}</b>
            </div>
          </div>
          <p className="expanded-attempt">Last attempt: {statusText} &middot; {formatDate(item.lastAttemptedAt)}</p>
          <div className="divider" />
          <p className="expanded-label">Explanation</p>
          {item.explanation ? <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
          {cache.ai ? <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p> : null}
          <button type="button" className="secondary-btn mt-3 w-full" onClick={getAIExplanation} disabled={cache.loading}>
            {cache.loading ? 'Loading...' : 'Get AI Explanation'}
          </button>
        </div>
      )}

      <div className="question-actions">
        <button type="button" className="primary-btn" onClick={() => onPracticeOne(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={onToggleOpen}>{isOpen ? 'Close' : 'Open'}</button>
        <button type="button" className={`save-icon-btn ${item.isSaved ? 'saved' : ''}`} onClick={event => { event.stopPropagation(); onToggleSave(item); }} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'} title={item.isSaved ? 'Saved' : 'Save'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>
    </article>
  );
}
function MoreFiltersSheet({ open, filters, subjects, onClose, onApply, onReset }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { setDraft(filters); }, [filters, open]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop">
      <section className="filter-sheet">
        <div className="sheet-handle" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-black text-white">Filter Attempted Questions</h2>
          <button type="button" className="secondary-btn px-3" onClick={onClose}>× Close</button>
        </div>
        {[
          ['Answer Status', 'answerStatus', ['all', 'correct', 'wrong', 'skipped', 'wrong_skipped']],
          ['Question History', 'questionHistory', ['all', 'repeated', 'never_correct', 'mastered']],
          ['Date Range', 'dateRange', ['all', 'today', '7d', '30d']],
          ['Quiz Type', 'quizType', ['all', 'normal', 'daily_challenge', 'reattempt']],
        ].map(([label, key, values]) => (
          <div key={key} className="mb-4">
            <p className="filter-label">{label}</p>
            <div className="chip-row sheet-chip-row">
              {values.map(value => <button key={value} type="button" className={`chip ${draft[key] === value ? 'active' : ''}`} onClick={() => setDraft(prev => ({ ...prev, [key]: value }))}>{value.replaceAll('_', ' ')}</button>)}
            </div>
          </div>
        ))}
        <div className="mb-5">
          <p className="filter-label">Subject</p>
          <select className="filter-select" value={draft.subject || ''} onChange={event => setDraft(prev => ({ ...prev, subject: event.target.value, topic: '' }))}>
            <option value="">All Subjects</option>
            {subjects.map(item => <option key={item.subject} value={item.subject}>{item.subject}</option>)}
          </select>
        </div>
        <div className="mb-5">
          <p className="filter-label">Topic</p>
          <select className="filter-select" disabled value="">
            <option>{draft.subject ? 'Select from Topic-wise mode' : 'Select subject first'}</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="secondary-btn" onClick={onReset}>Reset All</button>
          <button type="button" className="primary-btn" onClick={() => onApply(draft)}>Apply Filters &rarr;</button>
        </div>
      </section>
    </div>
  );
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const cacheScope = getUserCacheScope(session);
  const router = useRouter();
  const [activeMode, setActiveMode] = useState('quiz');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [quizData, setQuizData] = useState({ sessions: [], total: 0, hasMore: false });
  const [quizExpanded, setQuizExpanded] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState({ start: '', end: '' });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [dateValidationError, setDateValidationError] = useState('');
  const [subjects, setSubjects] = useState(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [topicsBySubject, setTopicsBySubject] = useState({});
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [questionType, setQuestionType] = useState('wrong');
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionsData, setQuestionsData] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState('');
  const [aiCache, setAiCache] = useState({});
  const [modal, setModal] = useState(null);
  const [starting, setStarting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ answerStatus: 'all', questionHistory: 'all', dateRange: 'all', quizType: 'all', subject: '' });

  const isGuest = status === 'unauthenticated';
  const allZero = summary && summary.totalQuizzes === 0 && summary.totalQuestions === 0 && summary.savedCount === 0;

  // Step 9: summary, default quiz page, and subjects all come from ONE
  // cache-aware GET /api/history/landing. The three loaders share the same
  // scoped key, so Step 5 in-flight dedup collapses the mount to one network
  // request (cold) and zero (warm).
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      markJourney({ journey: 'history-landing', route: '/api/history/landing', trigger: 'mount', cache: 'helper', helper: 'getHistoryLanding' });
      const res = await getHistoryLanding({ scope: cacheScope });
      const payload = res?.data?.data;
      if (!payload) throw new Error('Failed');
      setSummary(payload.summary);
    } catch {
      setSummaryError("Couldn't load. Check connection.");
    } finally {
      setSummaryLoading(false);
    }
  }, [cacheScope]);

  const loadQuizzes = useCallback(async (limit = 3, filter = 'all', range = appliedCustomRange) => {
    setQuizLoading(true);
    try {
      // Default landing page (all, page 1, limit ≤ 3) → served by the shared
      // landing payload (no extra request). Any filter/expansion → cache-aware
      // GET /api/history/quizzes keyed by the exact query.
      const isDefault = filter === 'all' && !range.start && !range.end && limit <= 3;
      if (isDefault) {
        const res = await getHistoryLanding({ scope: cacheScope });
        if (res?.data?.data?.quizzes) setQuizData(res.data.data.quizzes);
        return;
      }
      const params = { page: 1, limit };
      if (filter === '7d' || filter === '30d') params.dateRange = filter;
      if (filter === 'custom' && range.start && range.end) { params.startDate = range.start; params.endDate = range.end; }
      const query = normalizeHistoryQuery(params);
      const res = await getHistoryQuizzes({ scope: cacheScope, query });
      const data = res?.data;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      setQuizData(data.data);
    } finally {
      setQuizLoading(false);
    }
  }, [appliedCustomRange, cacheScope]);

  const loadSubjects = useCallback(async () => {
    if (subjects) return subjects;
    setSubjectsLoading(true);
    try {
      const res = await getHistoryLanding({ scope: cacheScope });
      const list = res?.data?.data?.subjects || [];
      setSubjects(list);
      return list;
    } finally {
      setSubjectsLoading(false);
    }
  }, [subjects, cacheScope]);

  const loadTopics = useCallback(async (subject) => {
    if (!subject || topicsBySubject[subject]) return;
    setTopicsLoading(true);
    try {
      const res = await getHistoryTopics({ scope: cacheScope, subject });
      const data = res?.data;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      setTopicsBySubject(prev => ({ ...prev, [subject]: data.data.topics || [] }));
    } finally {
      setTopicsLoading(false);
    }
  }, [topicsBySubject, cacheScope]);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const params = { limit: 10 };
      if (questionType === 'repeated') params.questionHistory = 'repeated';
      else if (questionType === 'never_correct') params.questionHistory = 'never_correct';
      else params.status = questionType;
      if (questionSubject) params.subject = questionSubject;
      Object.entries(advancedFilters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key === 'answerStatus' ? 'status' : key] = value;
      });
      const query = normalizeHistoryQuery(params);
      const res = await getHistoryQuestions({ scope: cacheScope, query });
      const data = res?.data;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      setQuestionsData(data.data);
    } finally {
      setQuestionsLoading(false);
    }
  }, [advancedFilters, questionSubject, questionType, cacheScope]);

  useEffect(() => {
    if (status === 'loading' || isGuest) return;
    loadSummary();
  }, [status, isGuest, loadSummary]);

  useEffect(() => {
    if (status === 'loading' || isGuest) return;
    loadQuizzes(3, quickFilter, appliedCustomRange);
  }, [status, isGuest, loadQuizzes, quickFilter, appliedCustomRange]);

  useEffect(() => {
    if (status === 'loading' || isGuest) return;
    if (activeMode === 'subject') loadSubjects();
    if (activeMode === 'topic') {
      loadSubjects().then(items => {
        const subject = selectedSubject || items?.[0]?.subject || '';
        if (subject) {
          setSelectedSubject(subject);
          loadTopics(subject);
        }
      });
    }
    if (activeMode === 'mistakes') {
      loadSubjects();
      loadQuestions();
    }
  }, [activeMode, isGuest, loadQuestions, loadSubjects, loadTopics, selectedSubject, status]);

  useEffect(() => {
    if (activeMode === 'topic' && selectedSubject) loadTopics(selectedSubject);
  }, [activeMode, loadTopics, selectedSubject]);

  useEffect(() => {
    if (activeMode === 'mistakes' && status !== 'loading' && !isGuest) loadQuestions();
  }, [activeMode, isGuest, loadQuestions, status]);

  useEffect(() => {
    if (sheetOpen && status !== 'loading' && !isGuest) loadSubjects();
  }, [isGuest, loadSubjects, sheetOpen, status]);

  useEffect(() => {
    setExpandedQuestionId('');
  }, [questionType, questionSubject, advancedFilters]);

  const filteredQuizzes = useMemo(() => {
    const sessions = quizData.sessions || [];
    return sessions;
  }, [quizData.sessions]);

  const filteredSubjects = useMemo(() => {
    const items = subjects || [];
    if (!subjectFilter) return items;
    return items.filter(item => item.subject === subjectFilter);
  }, [subjectFilter, subjects]);
  const topics = topicsBySubject[selectedSubject] || [];
  const questionSubjects = subjects || [];
  const practiceCount = questionsData?.total || 0;
  const activeMistakeLabel = QUESTION_TYPES.find(type => type.key === questionType)?.label || 'Filtered';
  const mistakePhrase = {
    wrong: 'wrong questions',
    skipped: 'skipped questions',
    repeated: 'repeated mistakes',
    saved: 'saved questions',
    never_correct: 'never correct questions',
  }[questionType] || `${activeMistakeLabel.toLowerCase()} questions`;
  const summaryPhrase = questionType === 'repeated' ? 'repeated questions' : mistakePhrase;
  const activeMistakeSummary = `${mistakePhrase} in ${questionSubject || 'All subjects'}`;
  const customRangeSummary = appliedCustomRange.start && appliedCustomRange.end
    ? `Showing quizzes from ${formatRangeDate(appliedCustomRange.start)} to ${formatRangeDate(appliedCustomRange.end)}`
    : '';

  async function expandQuizzes() {
    const next = !quizExpanded;
    setQuizExpanded(next);
    await loadQuizzes(next ? 10 : 3, quickFilter, appliedCustomRange);
  }

  function handleQuickFilter(nextFilter) {
    if (nextFilter === 'custom') {
      setDateValidationError('');
      setCustomStartDate(appliedCustomRange.start || '');
      setCustomEndDate(appliedCustomRange.end || '');
      setIsDateModalOpen(true);
      return;
    }
    setIsDateModalOpen(false);
    setDateValidationError('');
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedCustomRange({ start: '', end: '' });
    setQuickFilter(nextFilter);
    setQuizExpanded(false);
  }

  function resetDateFilter() {
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedCustomRange({ start: '', end: '' });
    setDateValidationError('');
    setQuickFilter('all');
    setQuizExpanded(false);
  }

  function applyCustomDateRange() {
    const today = todayInputValue();
    if (!customStartDate) {
      setDateValidationError('Select a start date.');
      return;
    }
    if (!customEndDate) {
      setDateValidationError('Select an end date.');
      return;
    }
    if (customStartDate > customEndDate) {
      setDateValidationError('Start date cannot be after end date.');
      return;
    }
    if (customEndDate > today) {
      setDateValidationError('End date cannot be in the future.');
      return;
    }
    setAppliedCustomRange({ start: customStartDate, end: customEndDate });
    setQuickFilter('custom');
    setQuizExpanded(false);
    setDateValidationError('');
    setIsDateModalOpen(false);
  }

  function openPracticeModal(payload) {
    const count = payload.count || 0;
    setModal({
      ...payload,
      title: payload.title || 'Practice your mistakes?',
      body: payload.body || `${count} wrong + skipped questions. Your old result stays saved.`,
      limit: count > 25 ? 25 : count || 10,
      setLimit: limit => setModal(prev => ({ ...prev, limit })),
    });
  }

  async function startFilteredPractice(payload = modal) {
    if (!payload) return;
    setStarting(true);
    try {
      if (payload.singleQuestion) {
        sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
          questions: [payload.singleQuestion],
          quizMode: 'filtered_mistakes',
          subject: payload.singleQuestion.subject,
          topic: payload.singleQuestion.topic,
          sourceCollection: payload.singleQuestion.sourceCollection || 'general',
        }));
        router.push('/quiz?mode=history&count=1&sourceScreen=history');
        return;
      }
      const res = await fetch('/api/history/reattempt-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: payload.subject || '',
          topic: payload.topic || '',
          answerStatus: payload.answerStatus || 'wrong_skipped',
          questionHistory: payload.questionHistory || 'all',
          limit: payload.limit || 25,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
        questions: data.data.questions,
        quizMode: data.data.quizMode,
        subject: payload.subject || 'History',
        topic: payload.topic || 'Filtered Practice',
        sourceCollection: 'general',
      }));
      router.push(`/quiz?mode=history&count=${data.data.questionCount}&sourceScreen=history`);
    } finally {
      setStarting(false);
    }
  }

  async function startSessionPractice(session, full = false) {
    if (full) {
      openPracticeModal({ subject: session.subject, topic: session.topic, count: session.questionCount, answerStatus: 'all', title: 'Re-attempt this quiz?' });
      return;
    }
    openPracticeModal({ subject: session.subject, topic: session.topic, count: session.incorrect + session.skipped, answerStatus: 'wrong_skipped' });
  }

  async function toggleSave(question) {
    setQuestionsData(prev => ({
      ...prev,
      questions: prev.questions.map(item => item.questionId === question.questionId ? { ...item, isSaved: !item.isSaved } : item),
    }));
    try {
      const r = await toggleSavedQuestion({ scope: cacheScope, action: question.isSaved ? 'unsave' : 'save', question });
      if (!r.ok) loadQuestions();
    } catch { loadQuestions(); }
  }

  function applyMoreFilters(next) {
    setAdvancedFilters(next);
    setQuizExpanded(false);
    if (activeMode === 'quiz') {
      if (next.dateRange === '7d' || next.dateRange === '30d') setQuickFilter(next.dateRange);
      else if (next.answerStatus === 'wrong_skipped') setQuickFilter('wrong_skipped');
      else setQuickFilter('all');
    }
    setSheetOpen(false);
  }

  const styles = `
    .history-shell{padding:16px 16px calc(158px + env(safe-area-inset-bottom))}
    .intro-block{margin-bottom:12px}.intro-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:0}
    .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 14px}.stat-card,.history-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;box-shadow:var(--ssc-shadow-card)}.stat-card{padding:12px}.stat-card strong{display:block;color:var(--ssc-text-primary);font-size:20px;line-height:1;font-weight:900}.stat-card span{display:block;color:var(--ssc-text-secondary);font-size:11px;margin-top:5px;font-weight:700}.history-card{padding:16px;margin-bottom:12px}.history-card .text-white{color:var(--ssc-text-primary)}.history-card .text-slate-300,.history-card .text-slate-400,.history-card .text-slate-500{color:var(--ssc-text-secondary)}
    .quiz-card{padding:14px 15px}.quiz-title{color:var(--ssc-text-primary);font-size:15px;font-weight:900;line-height:1.25;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}.quiz-date{color:var(--ssc-text-muted);font-size:11px;font-weight:700;margin-top:5px}.quiz-badge{max-width:124px;overflow:hidden;text-overflow:ellipsis}.quiz-metric-row{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px;margin-top:14px}.quiz-metric strong{display:block;color:var(--ssc-text-primary);font-size:22px;line-height:1;font-weight:900}.quiz-metric span{display:block;color:var(--ssc-text-secondary);font-size:11px;font-weight:800;margin-top:6px}.quiz-metric-coins{text-align:right}.quiz-metric-coins strong{color:var(--ssc-coin)}.quiz-result-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:13px;padding:10px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);font-size:13px;font-weight:900;white-space:nowrap}.quiz-result-row .text-slate-400{color:var(--ssc-text-muted)}.quiz-result-row .text-emerald-300{color:var(--ssc-success)}.quiz-result-row .text-red-300{color:var(--ssc-danger)}.quiz-action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
    .entity-card{padding:14px 15px}.entity-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.entity-title{color:var(--ssc-text-primary);font-size:15px;font-weight:900;line-height:1.3;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.entity-subtitle{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.entity-accuracy{text-align:right;flex:0 0 auto}.entity-accuracy p{font-size:24px;line-height:1;font-weight:900;margin:0 0 5px}.entity-badge{font-size:10px;padding:4px 8px;flex:0 0 auto}.entity-meta{display:flex;flex-direction:column;gap:4px;margin-top:11px;color:var(--ssc-text-secondary);font-size:12px;font-weight:700}.entity-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;font-size:13px;font-weight:900}.entity-stat-row .text-emerald-300{color:var(--ssc-success)}.entity-stat-row .text-red-300{color:var(--ssc-danger)}.entity-stat-row .text-amber-300{color:var(--ssc-warning)}.subject-entity-card,.topic-entity-card{padding:13px 15px}.subject-entity-card .entity-top,.topic-entity-card .entity-top{align-items:flex-start}.subject-entity-card .entity-title{-webkit-line-clamp:1}.topic-entity-card .entity-title{-webkit-line-clamp:2}.topic-subject-line{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.35;margin:8px 0 0}.subject-meta-line{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.45;margin:8px 0 0}.subject-stat-row{justify-content:space-between;gap:8px;margin-top:13px;padding:10px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);white-space:nowrap}.subject-action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
    .question-card{padding:11px 14px}.question-top-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:var(--ssc-teal);font-size:11px;font-weight:900;margin:0;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}.question-preview{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.38;margin:9px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 0 0;border-top:1px solid var(--ssc-border-soft);font-size:12px;font-weight:900;white-space:nowrap}.question-stat-row .text-red-300{color:var(--ssc-danger)}.question-stat-row .text-slate-400{color:var(--ssc-text-muted)}.question-stat-row span+span:before{content:'';margin:0}.question-actions{display:grid;grid-template-columns:1fr .72fr 40px;gap:8px;margin-top:11px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(14,165,164,.36);background:var(--ssc-teal-soft)}
    .mode-selector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;border-radius:999px;padding:3px;margin-bottom:16px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);box-shadow:0 8px 20px rgba(16,32,51,.05)}.mode-selector button{border:0;border-radius:999px;background:transparent;color:var(--ssc-text-secondary);font-family:inherit;font-size:11px;font-weight:900;padding:9px 4px;white-space:nowrap}.mode-selector button.active{background:var(--ssc-teal);color:white;box-shadow:0 5px 16px rgba(14,165,164,.16)}
    .chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;margin-left:-16px;margin-right:-16px;padding:0 16px 14px;scrollbar-width:none;-ms-overflow-style:none}.chip-row::-webkit-scrollbar{display:none}.sheet-chip-row{margin-left:0;margin-right:0;padding:0 0 4px}.chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:12px;font-weight:800;padding:7px 13px;white-space:nowrap;text-transform:capitalize;flex:0 0 auto}.chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 5px 16px rgba(14,165,164,.14)}
    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}.primary-btn{border:0;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;box-shadow:var(--ssc-shadow-cta)}.secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}.primary-btn:disabled,.secondary-btn:disabled{opacity:1;cursor:default;box-shadow:none;background:var(--ssc-disabled-bg);color:var(--ssc-disabled-text);border-color:var(--ssc-border-soft)}
    .section-title{color:var(--ssc-text-primary);font-size:17px;font-weight:900;line-height:1.25;margin:0}.section-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:5px 0 12px}
    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}.divider{height:1px;background:var(--ssc-border-soft);margin:12px 0}.question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface-soft)}.expanded-block{margin-bottom:10px}.expanded-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.expanded-question{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.48;margin:0}.expanded-attempt{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin:9px 0 0}.answer-detail-grid{display:grid;gap:8px}.answer-detail{border:1px solid var(--ssc-border-soft);background:white;border-radius:12px;padding:9px 10px}.answer-detail span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}.answer-detail b{display:block;font-size:12px;line-height:1.4}.answer-detail.correct b{color:var(--ssc-success)}.answer-detail.wrong b{color:var(--ssc-danger)}.answer-detail.skipped b{color:var(--ssc-warning)}.option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--ssc-border-soft);background:white;border-radius:12px;padding:10px;margin-top:8px;color:var(--ssc-text-secondary);font-size:13px}.option-row.correct{border-color:rgba(18,184,134,.28);background:var(--ssc-success-soft);color:var(--ssc-success)}.option-row.wrong{border-color:rgba(239,68,68,.28);background:var(--ssc-danger-soft);color:var(--ssc-danger)}
    .modal-backdrop,.sheet-backdrop{position:fixed;inset:0;z-index:80;background:var(--ssc-overlay);backdrop-filter:blur(10px);display:flex}.modal-backdrop{align-items:center;justify-content:center;padding:22px}.modal-card{width:min(100%,360px);background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;padding:20px;box-shadow:var(--ssc-shadow-float)}.modal-card h2{color:var(--ssc-text-primary)}.modal-card p{color:var(--ssc-text-secondary)}.sheet-backdrop{align-items:flex-end}.filter-sheet{width:100%;max-width:430px;margin:0 auto;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:24px 24px 0 0;padding:12px 16px 20px;box-shadow:var(--ssc-shadow-float)}.filter-sheet h2{color:var(--ssc-text-primary)}.sheet-handle{width:42px;height:4px;border-radius:99px;background:var(--ssc-border-soft);margin:0 auto 14px}.filter-label{font-size:12px;color:var(--ssc-text-secondary);font-weight:900;margin-bottom:8px}.filter-select{width:100%;background:var(--ssc-surface-soft);border:1px solid var(--ssc-border-soft);border-radius:14px;color:var(--ssc-text-primary);padding:11px;font-family:inherit}
    .date-modal-backdrop{position:fixed;inset:0;z-index:90;background:var(--ssc-overlay);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.date-modal-card{width:min(100%,420px);background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;padding:20px;box-shadow:var(--ssc-shadow-float)}.date-modal-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.date-modal-top h2{color:var(--ssc-text-primary);font-size:20px;font-weight:900;line-height:1.2;margin:0}.date-modal-top p{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:7px 0 0;font-weight:700}.date-close-btn{height:34px;width:34px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-secondary);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}.date-field-group{display:grid;gap:8px;margin-bottom:14px}.date-field-group label{color:var(--ssc-text-secondary);font-size:12px;font-weight:900}.date-field-group input{width:100%;height:46px;border-radius:14px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-primary);padding:0 12px;font-family:inherit;font-size:14px;font-weight:800;color-scheme:light}.date-field-group input::-webkit-calendar-picker-indicator{opacity:.8}.date-error{color:var(--ssc-danger);font-size:12px;font-weight:800;line-height:1.35;margin:0 0 14px}.date-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}.custom-range-summary{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4;margin:-3px 2px 13px}
    .mistake-filter-group{margin-bottom:16px}.mistake-filter-group .chip-row{padding-bottom:0}.mistake-filter-label{display:block;margin:0 0 10px 2px;color:var(--ssc-text-secondary);font-size:12px;font-weight:900;line-height:1}.active-filter-summary{margin:-2px 2px 14px;color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4}
    @media(max-width:380px){.mode-long{display:none}}@media(min-width:381px){.mode-short{display:none}}
  `;

  return (
    <>
      <Head><title>Quiz History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <style>{styles}</style>
        <HistoryTopBar title="Quiz History" badge="REVISION ENGINE" icon={<HistoryHeaderIcon />} showBack />
        <main className="history-shell">
          <section className="intro-block">
            <p className="intro-subtitle">Filter attempted questions and fix weak areas.</p>
          </section>

          {status === 'loading' || summaryLoading ? (
            <Loader card size="md" label="Loading quiz history..." />
          ) : isGuest ? (
            <GoogleSignInCard title="Your quiz history is waiting" subtitle="Sign in to review attempted questions and mistakes." buttonText="Continue with Google" callbackUrl="/history" />
          ) : summaryError ? (
            <EmptyPanel title="Couldn't load." body="Check connection." action="Retry" onClick={loadSummary} />
          ) : allZero ? (
            <EmptyPanel title="No quiz history yet." body="Start a quiz and your attempted questions will appear here." action="Start Daily Challenge →" onClick={() => router.push('/quiz?mode=daily')} />
          ) : (
            <>
              <section className="summary-grid">
                {[
                  ['Quizzes', summary?.totalQuizzes || 0, ''],
                  ['Questions', summary?.totalQuestions || 0, ''],
                ].map(([label, value, suffix]) => <div key={label} className="stat-card"><strong className="font-display"><CountUp value={value} suffix={suffix} /></strong><span>{label}</span></div>)}
              </section>

              <section className="mode-selector">
                {MODES.map(mode => <button key={mode.key} type="button" className={activeMode === mode.key ? 'active' : ''} onClick={() => setActiveMode(mode.key)}><span className="mode-long">{mode.label}</span><span className="mode-short">{mode.shortLabel}</span></button>)}
              </section>

              {activeMode === 'quiz' && (
                <>
                  <div className="chip-row">
                    {QUICK_FILTERS.map(filter => <button key={filter.key} type="button" className={`chip ${quickFilter === filter.key ? 'active' : ''}`} onClick={() => handleQuickFilter(filter.key)}>{filter.label}</button>)}
                  </div>
                  {quickFilter === 'custom' && customRangeSummary && <p className="custom-range-summary">{customRangeSummary}</p>}
                  {quizLoading ? <Loader card size="sm" label="Loading quizzes..." /> : filteredQuizzes.length ? filteredQuizzes.map(item => (
                    <QuizCard key={item.sessionId} session={item} onReview={session => router.push(`/history/session/${session.sessionId}`)} onPractice={session => startSessionPractice(session)} onFull={session => startSessionPractice(session, true)} />
                  )) : quickFilter === 'custom' ? <EmptyPanel title="No quizzes found in this date range." body="Try changing the dates or reset the filter." action="Reset Date Filter" onClick={resetDateFilter} /> : <EmptyPanel title="No quizzes found." body="Try another date filter." action="Reset Filters" onClick={resetDateFilter} />}
                  {(quizData.sessions || []).length > 0 && <button type="button" className="secondary-btn w-full" onClick={expandQuizzes}>{quizExpanded ? 'Show Less' : 'View More Quizzes →'}</button>}
                </>
              )}

              {activeMode === 'subject' && (
                <section>
                  <h2 className="section-title font-display">Choose a Subject</h2>
                  {subjectsLoading ? <Loader card size="sm" label="Loading subjects..." /> : subjects?.length ? (
                    <>
                      <div className="chip-row">
                        <button type="button" className={`chip ${!subjectFilter ? 'active' : ''}`} onClick={() => setSubjectFilter('')}>All</button>
                        {subjects.map(item => <button key={item.subject} type="button" className={`chip ${subjectFilter === item.subject ? 'active' : ''}`} onClick={() => setSubjectFilter(item.subject)}>{item.subject}</button>)}
                      </div>
                      {filteredSubjects.map(item => (
                        <StatEntityCard key={item.subject} item={item} type="subject" onPractice={subject => openPracticeModal({ subject: subject.subject, count: subject.wrongCount + subject.skippedCount })} onReview={subject => router.push(`/history/questions?subject=${encodeURIComponent(subject.subject)}`)} />
                      ))}
                    </>
                  ) : <EmptyPanel title="No attempted subjects yet." body="Start a quiz to build your subject-wise history." action="Start Practice →" onClick={() => router.push('/dashboard')} />}
                </section>
              )}

              {activeMode === 'topic' && (
                <section>
                  <p className="filter-label">Select Subject</p>
                  <div className="chip-row">
                    {(subjects || []).map(item => <button key={item.subject} type="button" className={`chip ${selectedSubject === item.subject ? 'active' : ''}`} onClick={() => setSelectedSubject(item.subject)}>{item.subject}</button>)}
                  </div>
                  {!selectedSubject ? <EmptyPanel title="Select a subject to see topics." body="Choose a subject above to see attempted topics." /> : topicsLoading ? <Loader card size="sm" label="Loading topics..." /> : topics.length ? (
                    <>
                      <h2 className="section-title font-display">{selectedSubject} - Attempted Topics</h2>
                      <div className="mt-3">{topics.map(item => <StatEntityCard key={item.topic} item={item} type="topic" onPractice={topic => openPracticeModal({ subject: topic.subject, topic: topic.topic, count: topic.wrongCount + topic.skippedCount })} onReview={topic => router.push(`/history/questions?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic)}`)} />)}</div>
                    </>
                  ) : <EmptyPanel title={`No topics attempted in ${selectedSubject} yet.`} body={`Start a ${selectedSubject} quiz to build topic history.`} action={`Practice ${selectedSubject} →`} onClick={() => router.push('/dashboard')} />}
                </section>
              )}

              {activeMode === 'mistakes' && (
                <section>
                  <div className="mistake-filter-group">
                    <p className="mistake-filter-label">Mistake Type</p>
                    <div className="chip-row">
                      {QUESTION_TYPES.map(type => <button key={type.key} type="button" className={`chip ${questionType === type.key ? 'active' : ''}`} onClick={() => setQuestionType(type.key)}>{type.label}</button>)}
                    </div>
                  </div>
                  <div className="mistake-filter-group">
                    <p className="mistake-filter-label">Subject / Source</p>
                    <div className="chip-row">
                      <button type="button" className={`chip ${!questionSubject ? 'active' : ''}`} onClick={() => setQuestionSubject('')}>All</button>
                      {questionSubjects.map(item => <button key={item.subject} type="button" className={`chip ${questionSubject === item.subject ? 'active' : ''}`} onClick={() => setQuestionSubject(item.subject)}>{item.subject}</button>)}
                    </div>
                  </div>
                  <p className="active-filter-summary">Showing: {activeMistakeSummary}</p>
                  {questionsLoading ? <Loader card size="sm" label="Loading questions..." /> : (
                    <>
                      <div className="history-card">
                        <p className="font-display font-black text-white">{practiceCount} {summaryPhrase} found</p>
                        {practiceCount > 0 && <button type="button" className="primary-btn mt-3 w-full" onClick={() => openPracticeModal({ subject: questionSubject, count: practiceCount, answerStatus: questionType === 'repeated' || questionType === 'never_correct' ? 'wrong_skipped' : questionType, questionHistory: questionType === 'repeated' ? 'repeated' : questionType === 'never_correct' ? 'never_correct' : 'all' })}>Practice All {practiceCount}</button>}
                      </div>
                      {questionsData?.questions?.length ? questionsData.questions.map(item => <QuestionCard key={item.questionId} item={item} isOpen={expandedQuestionId === item.questionId} onToggleOpen={() => setExpandedQuestionId(current => current === item.questionId ? '' : item.questionId)} aiCache={aiCache} setAiCache={setAiCache} onPracticeOne={question => startFilteredPractice({ singleQuestion: question })} onToggleSave={toggleSave} />) : <EmptyPanel title={`No ${questionType.replace('_', ' ')} questions found.`} body="Practice more to build this list." action="Practice More →" onClick={() => router.push('/dashboard')} />}
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <Modal modal={modal} busy={starting} onClose={() => setModal(null)} onConfirm={() => startFilteredPractice()} />
      <DateRangeModal
        open={isDateModalOpen}
        startDate={customStartDate}
        endDate={customEndDate}
        error={dateValidationError}
        onStartChange={value => { setCustomStartDate(value); setDateValidationError(''); }}
        onEndChange={value => { setCustomEndDate(value); setDateValidationError(''); }}
        onApply={applyCustomDateRange}
        onClose={() => { setIsDateModalOpen(false); setDateValidationError(''); }}
        onReset={resetDateFilter}
      />
      <MoreFiltersSheet open={sheetOpen} filters={advancedFilters} subjects={subjects || []} onClose={() => setSheetOpen(false)} onApply={applyMoreFilters} onReset={() => { setAdvancedFilters({ answerStatus: 'all', questionHistory: 'all', dateRange: 'all', quizType: 'all', subject: '' }); setSheetOpen(false); }} />
    </>
  );
}
