import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
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
  { key: 'weak', label: 'Weak' },
  { key: 'wrong_skipped', label: 'Wrong + Skipped' },
];

const QUESTION_TYPES = [
  { key: 'wrong', label: 'Wrong' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'repeated', label: 'Repeated' },
  { key: 'saved', label: 'Saved' },
  { key: 'never_correct', label: 'Never Correct' },
];

const TONES = {
  green: ['#86efac', 'rgba(34,197,94,.12)'],
  amber: ['#fcd34d', 'rgba(245,158,11,.12)'],
  red: ['#fca5a5', 'rgba(239,68,68,.12)'],
  blue: ['#93c5fd', 'rgba(59,130,246,.12)'],
  orange: ['#fdba74', 'rgba(255,122,26,.12)'],
  grey: ['#cbd5e1', 'rgba(148,163,184,.10)'],
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

function optionText(question, option) {
  return question[`option${String(option || '').toUpperCase()}`] || '';
}

function EmptyPanel({ title, body, action, onClick }) {
  return (
    <section className="history-card text-center">
      <p className="font-display font-black text-white">{title}</p>
      <p className="text-sm text-slate-400 mt-1 mb-4">{body}</p>
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
          <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>{busy ? 'Starting...' : 'Start Practice -&gt;'}</button>
        </div>
      </div>
    </div>
  );
}

function QuizCard({ session, onReview, onPractice, onFull }) {
  const mistakes = (Number(session.incorrect) || 0) + (Number(session.skipped) || 0);
  const maxScore = session.maxScore || session.questionCount * 2;
  const tone = TONES[session.badgeTone] || TONES.amber;
  return (
    <article className="history-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-black text-white truncate">{session.subject} · {session.topic}</h3>
          <p className="text-xs text-slate-500 mt-1">{formatDate(session.completedAt)}</p>
        </div>
        <span className="tone-pill" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{session.badge}</span>
      </div>
      <div className="mt-4 text-sm text-slate-200">
        <span className="font-black text-white">Score: {session.score} / {maxScore}</span>
        <span className="mx-2 text-slate-600">·</span>
        <span className="font-black text-white">Accuracy: {session.accuracy}%</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-black">
        <span className="text-emerald-300">✓ {session.correct}</span>
        <span className="text-red-300">× {session.incorrect}</span>
        <span className="text-amber-300">↷ {session.skipped}</span>
        <span className="text-slate-600">·</span>
        <span className="text-orange-300">+{session.coinsEarned} coins</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-5">
        {mistakes > 0 ? (
          <>
            <button type="button" className="primary-btn" onClick={() => onPractice(session)}>Practice Mistakes -&gt;</button>
            <button type="button" className="secondary-btn" onClick={() => onReview(session)}>Review Quiz</button>
          </>
        ) : (
          <>
            <button type="button" className="primary-btn" onClick={() => onReview(session)}>Review Quiz</button>
            <button type="button" className="secondary-btn" onClick={() => onFull(session)}>Re-attempt</button>
          </>
        )}
      </div>
    </article>
  );
}

function StatEntityCard({ item, type, onPractice, onReview }) {
  const tone = TONES[item.statusTone] || TONES.grey;
  const title = type === 'topic' ? item.topic : item.subject;
  return (
    <article className="history-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-black text-white truncate">{title}</h3>
          {type === 'topic' && <p className="text-xs text-slate-500 mt-1">{item.subject}</p>}
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-black" style={{ color: tone[0] }}>{item.accuracy}%</p>
          <span className="tone-pill" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.statusLabel}</span>
        </div>
      </div>
      <p className="text-sm text-slate-400 mt-4">{item.questionCount} questions attempted</p>
      <p className="text-sm font-black text-slate-200 mt-2">✓ {item.correctCount} <span className="text-red-300 ml-3">× {item.wrongCount}</span> <span className="text-amber-300 ml-3">↷ {item.skippedCount}</span></p>
      <p className="text-xs text-slate-500 mt-2">Last practiced: {formatDate(item.lastPracticedAt)}</p>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button type="button" className="primary-btn" onClick={() => onPractice(item)} disabled={!item.hasMistakes}>Practice Mistakes -&gt;</button>
        <button type="button" className="secondary-btn" onClick={() => onReview(item)}>{type === 'topic' ? 'Review' : 'Review Qs'}</button>
      </div>
    </article>
  );
}

function QuestionCard({ item, aiCache, setAiCache, onPracticeOne, onToggleSave }) {
  const [open, setOpen] = useState(false);
  const tone = TONES[item.masteryTone] || TONES.grey;
  const cache = aiCache[item.questionId] || { official: item.explanation || '', ai: null, loading: false };
  const statusText = item.lastAttemptStatus === 'skipped' ? 'Skipped' : item.lastAttemptStatus === 'correct' ? 'Correct' : 'Wrong';

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
    <article className={`history-card question-card ${open ? 'open' : ''}`}>
      <p className="text-xs font-bold text-teal-300">{item.subject} · {item.topic}</p>
      <p className="font-display font-bold text-white leading-relaxed mt-3">"{open ? item.question : item.questionPreview}"</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-red-300">× Wrong {item.wrongCount}x</span>
        <span className="text-sm font-black text-amber-300">↷ Skipped {item.skippedCount}x</span>
        <span className="tone-pill" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}55` }}>{item.masteryLabel}</span>
      </div>

      {open && (
        <div className="question-expanded">
          {['A', 'B', 'C', 'D'].map(option => {
            const isCorrect = option === item.correctOption;
            const isUser = option === item.lastUserAnswer;
            return (
              <div key={option} className={`option-row ${isCorrect ? 'correct' : ''} ${isUser && !isCorrect ? 'wrong' : ''}`}>
                <span>{option}. {optionText(item, option) || '-'}</span>
                {isUser && !isCorrect && <b>Your last answer ×</b>}
                {isCorrect && <b>Correct ✓</b>}
              </div>
            );
          })}
          <div className="divider" />
          <p className="text-xs text-slate-400">Your history on this question:</p>
          <p className="text-sm font-black text-slate-200 mt-2">✓ Correct {item.correctCount}x · × Wrong {item.wrongCount}x · ↷ {item.skippedCount}x</p>
          <p className="text-xs text-slate-500 mt-1">Last attempt: {statusText} ({formatDate(item.lastAttemptedAt)})</p>
          <div className="divider" />
          <p className="text-xs font-black text-orange-300 mb-2">Explanation</p>
          {item.explanation ? <p className="text-sm text-slate-300 leading-relaxed">{item.explanation}</p> : <p className="text-sm text-slate-500">No official explanation available.</p>}
          {cache.ai && <p className="text-sm text-orange-100 leading-relaxed mt-3">{cache.ai}</p>}
          <button type="button" className="secondary-btn mt-3 w-full" onClick={getAIExplanation} disabled={cache.loading}>
            {cache.loading ? 'Loading...' : 'Get AI Explanation ✦'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-5">
        <button type="button" className="secondary-btn" onClick={() => setOpen(value => !value)}>{open ? 'Close' : 'Open'}</button>
        <button type="button" className="primary-btn" onClick={() => onPracticeOne(item)}>Practice Again</button>
        <button type="button" className="secondary-btn" onClick={() => onToggleSave(item)}>{item.isSaved ? 'Saved ★' : 'Save ☆'}</button>
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
            <div className="flex gap-2 overflow-x-auto pb-1">
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
          <button type="button" className="primary-btn" onClick={() => onApply(draft)}>Apply Filters -&gt;</button>
        </div>
      </section>
    </div>
  );
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState('quiz');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [quizData, setQuizData] = useState({ sessions: [], total: 0, hasMore: false });
  const [quizExpanded, setQuizExpanded] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [subjects, setSubjects] = useState(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [topicsBySubject, setTopicsBySubject] = useState({});
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [questionType, setQuestionType] = useState('wrong');
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionsData, setQuestionsData] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [aiCache, setAiCache] = useState({});
  const [modal, setModal] = useState(null);
  const [starting, setStarting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ answerStatus: 'all', questionHistory: 'all', dateRange: 'all', quizType: 'all', subject: '' });

  const isGuest = status === 'unauthenticated';
  const allZero = summary && summary.totalQuizzes === 0 && summary.totalQuestions === 0 && summary.savedCount === 0;

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await fetch('/api/history/summary');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setSummary(data.data);
    } catch {
      setSummaryError("Couldn't load. Check connection.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadQuizzes = useCallback(async (limit = 3) => {
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/history/quizzes?page=1&limit=${limit}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setQuizData(data.data);
    } finally {
      setQuizLoading(false);
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    if (subjects) return subjects;
    setSubjectsLoading(true);
    try {
      const res = await fetch('/api/history/subjects');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setSubjects(data.data.subjects || []);
      return data.data.subjects || [];
    } finally {
      setSubjectsLoading(false);
    }
  }, [subjects]);

  const loadTopics = useCallback(async (subject) => {
    if (!subject || topicsBySubject[subject]) return;
    setTopicsLoading(true);
    try {
      const res = await fetch(`/api/history/topics?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setTopicsBySubject(prev => ({ ...prev, [subject]: data.data.topics || [] }));
    } finally {
      setTopicsLoading(false);
    }
  }, [topicsBySubject]);

  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (questionType === 'repeated') params.set('questionHistory', 'repeated');
      else if (questionType === 'never_correct') params.set('questionHistory', 'never_correct');
      else params.set('status', questionType);
      if (questionSubject) params.set('subject', questionSubject);
      Object.entries(advancedFilters).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key === 'answerStatus' ? 'status' : key, value);
      });
      const res = await fetch(`/api/history/questions?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setQuestionsData(data.data);
    } finally {
      setQuestionsLoading(false);
    }
  }, [advancedFilters, questionSubject, questionType]);

  useEffect(() => {
    if (status === 'loading' || isGuest) return;
    loadSummary();
    loadQuizzes(3);
  }, [status, isGuest, loadSummary, loadQuizzes]);

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

  const filteredQuizzes = useMemo(() => {
    const sessions = quizData.sessions || [];
    const now = Date.now();
    return sessions.filter(item => {
      if (quickFilter === '7d') return now - new Date(item.completedAt || 0).getTime() <= 7 * 86400000;
      if (quickFilter === '30d') return now - new Date(item.completedAt || 0).getTime() <= 30 * 86400000;
      if (quickFilter === 'weak') return item.accuracy < 50;
      if (quickFilter === 'wrong_skipped') return item.incorrect + item.skipped > 0;
      return true;
    });
  }, [quickFilter, quizData.sessions]);

  const activeFilterCount = Object.values(advancedFilters).filter(value => value && value !== 'all').length;
  const topics = topicsBySubject[selectedSubject] || [];
  const questionSubjects = subjects || [];
  const practiceCount = questionsData?.total || 0;

  async function expandQuizzes() {
    const next = !quizExpanded;
    setQuizExpanded(next);
    await loadQuizzes(next ? 10 : 3);
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
    await fetch('/api/saved-questions/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...question, action: question.isSaved ? 'unsave' : 'save' }),
    }).catch(() => loadQuestions());
  }

  function applyMoreFilters(next) {
    setAdvancedFilters(next);
    if (activeMode === 'quiz') {
      if (next.dateRange === '7d' || next.dateRange === '30d') setQuickFilter(next.dateRange);
      else if (next.answerStatus === 'wrong_skipped') setQuickFilter('wrong_skipped');
      else setQuickFilter('all');
    }
    setSheetOpen(false);
  }

  function stickyPracticeLabel() {
    if (questionSubject) return `Practice ${practiceCount} ${questionSubject} Mistakes`;
    if (questionType === 'repeated') return `Practice ${practiceCount} Repeated Mistakes`;
    if (questionType === 'skipped') return `Practice ${practiceCount} Skipped Questions`;
    return `Practice ${practiceCount} Mistakes`;
  }

  const styles = `
    .history-shell{padding:20px 16px calc(106px + env(safe-area-inset-bottom))}
    .history-title{color:#f8fafc;margin:0;line-height:1.05}.history-subtitle{color:#94a3b8;margin:8px 0 16px;line-height:1.45}
    .compact-strip,.mode-selector{background:#112236;border:1px solid rgba(255,255,255,.08)}.compact-strip{display:flex;justify-content:center;gap:8px;border-radius:999px;padding:9px 14px;color:#94a3b8;font-size:12px;font-weight:800;flex-wrap:wrap}.dot{color:#64748b}
    .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.stat-card,.history-card{background:#172d47;border:1px solid rgba(255,255,255,.08);border-radius:18px}.stat-card{padding:14px}.stat-card strong{display:block;color:#f8fafc;font-size:24px;line-height:1;font-weight:900}.stat-card span{display:block;color:#64748b;font-size:12px;margin-top:8px;font-weight:700}.history-card{padding:16px;margin-bottom:12px}
    .mode-selector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;border-radius:999px;padding:4px;margin-bottom:18px}.mode-selector button{border:0;border-radius:999px;background:transparent;color:#94a3b8;font-family:inherit;font-size:11px;font-weight:900;padding:11px 4px;white-space:nowrap}.mode-selector button.active{background:rgba(255,122,26,.18);color:white;box-shadow:inset 0 0 0 1px rgba(255,122,26,.30)}
    .chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172d47;color:#94a3b8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap;text-transform:capitalize}.chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#fdba74}
    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white}.secondary-btn{border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.04);color:#cbd5e1}.primary-btn:disabled,.secondary-btn:disabled{opacity:.45}
    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}.divider{height:1px;background:rgba(255,255,255,.07);margin:14px 0}.question-expanded{overflow:hidden;margin-top:14px}.option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid rgba(148,163,184,.12);background:rgba(255,255,255,.035);border-radius:12px;padding:10px;margin-top:8px;color:#cbd5e1;font-size:13px}.option-row.correct{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);color:#bbf7d0}.option-row.wrong{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.10);color:#fecaca}
    .modal-backdrop,.sheet-backdrop{position:fixed;inset:0;z-index:80;background:rgba(4,12,24,.72);backdrop-filter:blur(10px);display:flex}.modal-backdrop{align-items:center;justify-content:center;padding:22px}.modal-card{width:min(100%,360px);background:#172d47;border:1px solid rgba(255,255,255,.10);border-radius:22px;padding:20px}.sheet-backdrop{align-items:flex-end}.filter-sheet{width:100%;max-width:430px;margin:0 auto;background:#112236;border:1px solid rgba(255,255,255,.10);border-radius:24px 24px 0 0;padding:12px 16px 20px}.sheet-handle{width:42px;height:4px;border-radius:99px;background:rgba(148,163,184,.35);margin:0 auto 14px}.filter-label{font-size:12px;color:#94a3b8;font-weight:900;margin-bottom:8px}.filter-select{width:100%;background:#172d47;border:1px solid rgba(148,163,184,.16);border-radius:14px;color:#e2e8f0;padding:11px;font-family:inherit}
    .sticky-practice{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:50;width:100%;max-width:430px;padding:0 16px 8px}.sticky-practice button{box-shadow:0 16px 40px rgba(255,77,0,.26)}
    @media(max-width:380px){.mode-long{display:none}}@media(min-width:381px){.mode-short{display:none}}
  `;

  return (
    <>
      <Head><title>Quiz History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-28">
        <style>{styles}</style>
        <HistoryTopBar title="Quiz History" badge="REVISION ENGINE" icon={<HistoryHeaderIcon />} showBack />
        <main className="history-shell">
          <section className="mb-[18px]">
            <h1 className="history-title t-page-title font-display">Quiz History</h1>
            <p className="history-subtitle t-page-subtitle">Review attempted questions.</p>
            <div className="compact-strip"><span>Sessions</span><span className="dot">·</span><span>Questions</span><span className="dot">·</span><span>Mistakes</span></div>
          </section>

          {status === 'loading' || summaryLoading ? (
            <Loader card size="md" label="Loading quiz history..." />
          ) : isGuest ? (
            <GoogleSignInCard title="Your quiz history is waiting" subtitle="Sign in to review attempted questions and mistakes." buttonText="Continue with Google" callbackUrl="/history" />
          ) : summaryError ? (
            <EmptyPanel title="Couldn't load." body="Check connection." action="Retry" onClick={loadSummary} />
          ) : allZero ? (
            <EmptyPanel title="No quiz history yet." body="Start a quiz and your attempted questions will appear here." action="Start Daily Challenge ->" onClick={() => router.push('/quiz?mode=daily')} />
          ) : (
            <>
              <section className="summary-grid">
                {[
                  ['Quizzes', summary?.totalQuizzes || 0, ''],
                  ['Questions', summary?.totalQuestions || 0, ''],
                  ['Accuracy', summary?.overallAccuracy || 0, '%'],
                  ['Saved', summary?.savedCount || 0, ''],
                ].map(([label, value, suffix]) => <div key={label} className="stat-card"><strong className="font-display"><CountUp value={value} suffix={suffix} /></strong><span>{label}</span></div>)}
              </section>

              <section className="mode-selector">
                {MODES.map(mode => <button key={mode.key} type="button" className={activeMode === mode.key ? 'active' : ''} onClick={() => setActiveMode(mode.key)}><span className="mode-long">{mode.label}</span><span className="mode-short">{mode.shortLabel}</span></button>)}
              </section>

              {activeMode === 'quiz' && (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                    {QUICK_FILTERS.map(filter => <button key={filter.key} type="button" className={`chip ${quickFilter === filter.key ? 'active' : ''}`} onClick={() => setQuickFilter(filter.key)}>{filter.label}</button>)}
                    <button type="button" className="chip" onClick={() => setSheetOpen(true)}>More Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
                  </div>
                  {quizLoading ? <Loader card size="sm" label="Loading quizzes..." /> : filteredQuizzes.length ? filteredQuizzes.map(item => (
                    <QuizCard key={item.sessionId} session={item} onReview={session => router.push(`/history/session/${session.sessionId}`)} onPractice={session => startSessionPractice(session)} onFull={session => startSessionPractice(session, true)} />
                  )) : <EmptyPanel title="No quizzes found." body="Try another filter." action="Reset Filters" onClick={() => setQuickFilter('all')} />}
                  {(quizData.sessions || []).length > 0 && <button type="button" className="secondary-btn w-full" onClick={expandQuizzes}>{quizExpanded ? 'Show Less' : 'View More Quizzes -&gt;'}</button>}
                </>
              )}

              {activeMode === 'subject' && (
                <section>
                  <h2 className="font-display text-lg font-black text-white">Attempted Subjects</h2>
                  <p className="text-sm text-slate-500 mb-3">Subjects you have practiced questions from.</p>
                  {subjectsLoading ? <Loader card size="sm" label="Loading subjects..." /> : subjects?.length ? subjects.map(item => (
                    <StatEntityCard key={item.subject} item={item} type="subject" onPractice={subject => openPracticeModal({ subject: subject.subject, count: subject.wrongCount + subject.skippedCount })} onReview={subject => router.push(`/history/questions?subject=${encodeURIComponent(subject.subject)}`)} />
                  )) : <EmptyPanel title="No attempted subjects yet." body="Start a quiz to build your subject-wise history." action="Start Practice ->" onClick={() => router.push('/dashboard')} />}
                </section>
              )}

              {activeMode === 'topic' && (
                <section>
                  <p className="filter-label">Select Subject</p>
                  <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                    {(subjects || []).map(item => <button key={item.subject} type="button" className={`chip ${selectedSubject === item.subject ? 'active' : ''}`} onClick={() => setSelectedSubject(item.subject)}>{item.subject}</button>)}
                  </div>
                  {!selectedSubject ? <EmptyPanel title="Select a subject to see topics." body="Choose a subject above to see attempted topics." /> : topicsLoading ? <Loader card size="sm" label="Loading topics..." /> : topics.length ? (
                    <>
                      <h2 className="font-display text-lg font-black text-white">{selectedSubject} - Attempted Topics</h2>
                      <div className="mt-3">{topics.map(item => <StatEntityCard key={item.topic} item={item} type="topic" onPractice={topic => openPracticeModal({ subject: topic.subject, topic: topic.topic, count: topic.wrongCount + topic.skippedCount })} onReview={topic => router.push(`/history/questions?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic)}`)} />)}</div>
                    </>
                  ) : <EmptyPanel title={`No topics attempted in ${selectedSubject} yet.`} body={`Start a ${selectedSubject} quiz to build topic history.`} action={`Practice ${selectedSubject} ->`} onClick={() => router.push('/dashboard')} />}
                </section>
              )}

              {activeMode === 'mistakes' && (
                <section>
                  <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                    {QUESTION_TYPES.map(type => <button key={type.key} type="button" className={`chip ${questionType === type.key ? 'active' : ''}`} onClick={() => setQuestionType(type.key)}>{type.label}</button>)}
                    <button type="button" className="chip" onClick={() => setSheetOpen(true)}>More Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                    <button type="button" className={`chip ${!questionSubject ? 'active' : ''}`} onClick={() => setQuestionSubject('')}>All</button>
                    {questionSubjects.map(item => <button key={item.subject} type="button" className={`chip ${questionSubject === item.subject ? 'active' : ''}`} onClick={() => setQuestionSubject(item.subject)}>{item.subject}</button>)}
                  </div>
                  {questionsLoading ? <Loader card size="sm" label="Loading questions..." /> : (
                    <>
                      <div className="history-card">
                        <p className="font-display font-black text-white">{practiceCount} questions · {questionSubject || 'All'} · {questionType.replace('_', ' ')}</p>
                        {practiceCount > 0 && <button type="button" className="primary-btn mt-3 w-full" onClick={() => openPracticeModal({ subject: questionSubject, count: practiceCount, answerStatus: questionType === 'repeated' || questionType === 'never_correct' ? 'wrong_skipped' : questionType, questionHistory: questionType === 'repeated' ? 'repeated' : questionType === 'never_correct' ? 'never_correct' : 'all' })}>Practice All {practiceCount} -&gt;</button>}
                      </div>
                      {questionsData?.questions?.length ? questionsData.questions.map(item => <QuestionCard key={item.questionId} item={item} aiCache={aiCache} setAiCache={setAiCache} onPracticeOne={question => startFilteredPractice({ singleQuestion: question })} onToggleSave={toggleSave} />) : <EmptyPanel title={`No ${questionType.replace('_', ' ')} questions found.`} body="Practice more to build this list." action="Practice More ->" onClick={() => router.push('/dashboard')} />}
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {activeMode === 'mistakes' && practiceCount > 0 && (
        <div className="sticky-practice">
          <button type="button" className="primary-btn w-full" onClick={() => openPracticeModal({ subject: questionSubject, count: practiceCount, answerStatus: questionType === 'skipped' ? 'skipped' : 'wrong_skipped', questionHistory: questionType === 'repeated' ? 'repeated' : questionType === 'never_correct' ? 'never_correct' : 'all' })}>
            {stickyPracticeLabel()} -&gt;
          </button>
        </div>
      )}

      <Modal modal={modal} busy={starting} onClose={() => setModal(null)} onConfirm={() => startFilteredPractice()} />
      <MoreFiltersSheet open={sheetOpen} filters={advancedFilters} subjects={subjects || []} onClose={() => setSheetOpen(false)} onApply={applyMoreFilters} onReset={() => { setAdvancedFilters({ answerStatus: 'all', questionHistory: 'all', dateRange: 'all', quizType: 'all', subject: '' }); setSheetOpen(false); }} />
    </>
  );
}
