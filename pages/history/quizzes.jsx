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

function formatFullDateTime(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently';
  const day = date.getDate();
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm}`;
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
    .sort((a, b) => b.remainder - a.remainder || b.index - a.index);

  for (let i = 0; i < remainingTenths; i += 1) {
    flooredTenths[order[i % order.length].index] += 1;
  }

  return flooredTenths.map(value => {
    const percentage = value / 10;
    return { value: percentage, label: formatPercent(percentage) };
  });
}

function getAttemptBreakdown(item) {
  const correctCount = Number(item.correctCount) || 0;
  const wrongCount = Number(item.wrongCount) || 0;
  const skippedCount = Number(item.skippedCount) || 0;
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

function AttemptStatsRow({ stats }) {
  if (!stats?.totalAttempts) return null;
  return (
    <div className="rm-attempt-stats">
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
    </div>
  );
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

function ChevronSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
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
      {/* Header row: title + status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="quiz-title font-display">{session.subject} – {session.topic}</h3>
          <p className="quiz-date">{session.questionCount} Questions &middot; {formatFullDateTime(session.completedAt)}</p>
        </div>
        <span className="tone-pill quiz-badge" style={{ color: tone[0], background: tone[1], borderColor: `${tone[0]}33` }}>{session.badge}</span>
      </div>

      {/* 5-column stats row */}
      <div className="quiz-stats-row">
        <div className="quiz-stat">
          <strong className="font-display quiz-stat-value">{session.score}/{maxScore}</strong>
          <span className="quiz-stat-label">Score</span>
        </div>
        <div className="quiz-stat-divider" />
        <div className="quiz-stat">
          <strong className="font-display quiz-stat-value" style={{ color: 'var(--ssc-coin)' }}>🪙 {session.coinsEarned}</strong>
          <span className="quiz-stat-label">Coins</span>
        </div>
        <div className="quiz-stat-divider" />
        <div className="quiz-stat">
          <strong className="font-display quiz-stat-value" style={{ color: 'var(--ssc-success)' }}>&#10003; {session.correct}</strong>
          <span className="quiz-stat-label">Correct</span>
        </div>
        <div className="quiz-stat-divider" />
        <div className="quiz-stat">
          <strong className="font-display quiz-stat-value" style={{ color: 'var(--ssc-danger)' }}>&times; {session.incorrect}</strong>
          <span className="quiz-stat-label">Wrong</span>
        </div>
        <div className="quiz-stat-divider" />
        <div className="quiz-stat">
          <strong className="font-display quiz-stat-value" style={{ color: 'var(--ssc-text-muted)' }}>&#9675; {session.skipped}</strong>
          <span className="quiz-stat-label">Skipped</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="quiz-action-row">
        {mistakes > 0 ? (
          <>
            <button type="button" className="primary-btn quiz-practice-btn" onClick={() => onPractice(session)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              Practice Mistakes
            </button>
            <button type="button" className="secondary-btn quiz-review-btn" onClick={() => onReview(session)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Review Quiz
            </button>
          </>
        ) : (
          <>
            <button type="button" className="secondary-btn" onClick={() => onReview(session)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Review Quiz
            </button>
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
function QuestionCard({ item, isOpen, onToggleOpen, aiCache, setAiCache, onToggleSave }) {
  const cache = aiCache[item.questionId] || { official: item.explanation || '', ai: null, loading: false };
  const statusText = item.lastAttemptStatus === 'skipped' ? 'Skipped' : item.lastAttemptStatus === 'correct' ? 'Correct' : 'Wrong';
  const attemptStats = getAttemptBreakdown(item);
  const lastAnswerText = item.lastUserAnswer ? optionText(item, item.lastUserAnswer) : '';
  const correctAnswerText = item.correctOption ? optionText(item, item.correctOption) : '';
  const lastAnswerTone = !item.lastUserAnswer ? 'skipped' : item.lastUserAnswer === item.correctOption ? 'correct' : 'wrong';
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
    <article
      className={`rm-card ${isOpen ? 'open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onToggleOpen}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggleOpen();
        }
      }}
    >
      <div className="rm-card-head">
        <div className="rm-tags">
          {item.subject && <span className="rm-subject-tag">{item.subject}</span>}
          {item.topic && <span className="rm-topic-tag">{item.topic}</span>}
        </div>
        <button type="button" className={`rm-card-bookmark-btn ${item.isSaved ? 'saved' : ''}`} onClick={event => { event.stopPropagation(); onToggleSave(item); }} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'} title={item.isSaved ? 'Saved' : 'Save'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>

      <p className="rm-question-text">{item.questionPreview || item.question}</p>

      <div className="rm-footer">
        <div className="rm-footer-copy">
          <span className="rm-meta">Last Practiced: {formatDate(item.lastAttemptedAt)}</span>
        </div>
        <span className="rm-open-icon" aria-hidden="true"><ChevronSVG /></span>
      </div>

      <AttemptSegmentBar stats={attemptStats} />
      <AttemptStatsRow stats={attemptStats} />

      {isOpen && (
        <div className="question-expanded" onClick={event => event.stopPropagation()}>
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
        {/* Sheet header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-black" style={{ color: 'var(--ssc-text-primary)', fontSize: 18 }}>Filters</h2>
          <button
            type="button"
            onClick={onReset}
            style={{ border: 0, background: 'transparent', color: 'var(--ssc-teal)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
          >
            Clear All
          </button>
        </div>

        {/* Attempt Status */}
        <div className="mb-4">
          <p className="filter-label">Attempt Status</p>
          <div className="chip-row sheet-chip-row">
            {[['all', 'All'], ['correct', 'Good Attempts'], ['wrong_skipped', 'Weak Attempts']].map(([value, label]) => (
              <button key={value} type="button" className={`chip ${draft.answerStatus === value ? 'active' : ''}`} onClick={() => setDraft(prev => ({ ...prev, answerStatus: value }))}>{label}</button>
            ))}
          </div>
        </div>

        {/* Question History */}
        <div className="mb-4">
          <p className="filter-label">Question History</p>
          <div className="chip-row sheet-chip-row">
            {[['all', 'All'], ['repeated', 'Repeated'], ['never_correct', 'Never Correct'], ['mastered', 'Mastered']].map(([value, label]) => (
              <button key={value} type="button" className={`chip ${draft.questionHistory === value ? 'active' : ''}`} onClick={() => setDraft(prev => ({ ...prev, questionHistory: value }))}>{label}</button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="mb-4">
          <p className="filter-label">Time Period</p>
          <div className="chip-row sheet-chip-row">
            {[['all', 'All'], ['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days']].map(([value, label]) => (
              <button key={value} type="button" className={`chip ${draft.dateRange === value ? 'active' : ''}`} onClick={() => setDraft(prev => ({ ...prev, dateRange: value }))}>{label}</button>
            ))}
          </div>
        </div>

        {/* Quiz Type */}
        <div className="mb-4">
          <p className="filter-label">Quiz Type</p>
          <div className="chip-row sheet-chip-row">
            {[['all', 'All Types'], ['normal', 'Normal'], ['daily_challenge', 'Daily Challenge'], ['reattempt', 'Re-attempt']].map(([value, label]) => (
              <button key={value} type="button" className={`chip ${draft.quizType === value ? 'active' : ''}`} onClick={() => setDraft(prev => ({ ...prev, quizType: value }))}>{label}</button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-5">
          <p className="filter-label">Subject</p>
          <select className="filter-select" value={draft.subject || ''} onChange={event => setDraft(prev => ({ ...prev, subject: event.target.value, topic: '' }))}>
            <option value="">All Subjects</option>
            {subjects.map(item => <option key={item.subject} value={item.subject}>{item.subject}</option>)}
          </select>
        </div>

        {/* Apply CTA */}
        <button
          type="button"
          onClick={() => onApply(draft)}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 16,
            padding: '15px 0',
            background: 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))',
            color: 'white',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: 'var(--ssc-shadow-cta)',
          }}
        >
          Apply Filters
        </button>
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
    const returnUrl = router.asPath || '/history/quizzes';
    try {
      if (payload.singleQuestion) {
        sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
          questions: [payload.singleQuestion],
          quizMode: 'filtered_mistakes',
          subject: payload.singleQuestion.subject,
          topic: payload.singleQuestion.topic,
          sourceCollection: payload.singleQuestion.sourceCollection || 'general',
          returnUrl,
        }));
        router.push(`/quiz?mode=history&count=1&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
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
        returnUrl,
      }));
      router.push(`/quiz?mode=history&count=${data.data.questionCount}&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
    } finally {
      setStarting(false);
    }
  }

  async function startSessionPractice(session, full = false) {
    if (full) {
      openPracticeModal({ subject: session.subject, topic: session.topic, count: session.questionCount, answerStatus: 'all', title: 'Re-attempt this quiz?' });
      return;
    }
    const returnUrl = router.asPath || '/history/quizzes';
    setStarting(true);
    try {
      const res = await fetch('/api/history/reattempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'session_mistakes', sessionId: session.sessionId }),
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
    } finally {
      setStarting(false);
    }
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
    .intro-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:0 0 16px}
    .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 16px}
    .stat-card,.history-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;box-shadow:var(--ssc-shadow-card)}
    .stat-card{padding:12px;display:flex;align-items:center;gap:10px;min-height:66px}
    .stat-card-icon{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .stat-card-copy{min-width:0;display:grid;gap:1px}
    .stat-card strong{display:block;color:var(--ssc-text-primary);font-size:21px;line-height:1;font-weight:900}
    .stat-card span{display:block;color:var(--ssc-text-secondary);font-size:11px;margin-top:0;font-weight:800;white-space:nowrap}
    .history-card{padding:16px;margin-bottom:12px}
    .history-card .text-white{color:var(--ssc-text-primary)}
    .history-card .text-slate-300,.history-card .text-slate-400,.history-card .text-slate-500{color:var(--ssc-text-secondary)}

    .quiz-card{padding:16px;margin-bottom:12px;border-radius:18px}
    .quiz-title{color:var(--ssc-text-primary);font-size:15px;font-weight:900;line-height:1.3;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
    .quiz-date{color:var(--ssc-text-muted);font-size:11px;font-weight:700;margin-top:5px;line-height:1.4}
    .quiz-badge{max-width:130px;overflow:hidden;text-overflow:ellipsis;font-size:10px}
    .quiz-stats-row{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-top:14px;padding:12px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft)}
    .quiz-stat{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;flex:1}
    .quiz-stat-value{font-size:15px;line-height:1;font-weight:900;color:var(--ssc-text-primary);white-space:nowrap}
    .quiz-stat-label{font-size:10px;font-weight:700;color:var(--ssc-text-muted);white-space:nowrap}
    .quiz-stat-divider{width:1px;height:28px;background:var(--ssc-border-soft);flex-shrink:0}
    .quiz-action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
    .quiz-practice-btn{background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep))}
    .quiz-review-btn{background:var(--ssc-surface-soft);color:var(--ssc-teal);border:1px solid rgba(14,165,164,0.28)}

    .entity-card{padding:14px 15px}.entity-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.entity-title{color:var(--ssc-text-primary);font-size:15px;font-weight:900;line-height:1.3;margin:0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.entity-subtitle{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.entity-accuracy{text-align:right;flex:0 0 auto}.entity-accuracy p{font-size:24px;line-height:1;font-weight:900;margin:0 0 5px}.entity-badge{font-size:10px;padding:4px 8px;flex:0 0 auto}.entity-meta{display:flex;flex-direction:column;gap:4px;margin-top:11px;color:var(--ssc-text-secondary);font-size:12px;font-weight:700}.entity-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;font-size:13px;font-weight:900}.entity-stat-row .text-emerald-300{color:var(--ssc-success)}.entity-stat-row .text-red-300{color:var(--ssc-danger)}.entity-stat-row .text-amber-300{color:var(--ssc-warning)}.subject-entity-card,.topic-entity-card{padding:13px 15px}.subject-entity-card .entity-top,.topic-entity-card .entity-top{align-items:flex-start}.subject-entity-card .entity-title{-webkit-line-clamp:1}.topic-entity-card .entity-title{-webkit-line-clamp:2}.topic-subject-line{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.35;margin:8px 0 0}.subject-meta-line{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.45;margin:8px 0 0}.subject-stat-row{justify-content:space-between;gap:8px;margin-top:13px;padding:10px 0;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);white-space:nowrap}.subject-action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}

    .question-card{padding:12px 14px;cursor:pointer}.question-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}.question-top-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:var(--ssc-teal);background:var(--ssc-teal-soft);border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;margin:0;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}.question-chevron{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-secondary);font-size:18px;font-weight:900}.question-preview{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.38;margin:9px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 0 0;border-top:1px solid var(--ssc-border-soft);font-size:12px;font-weight:900;white-space:nowrap}.question-stat-row .text-red-300{color:var(--ssc-danger)}.question-stat-row .text-slate-400{color:var(--ssc-text-muted)}.question-stat-row span+span:before{content:'';margin:0}.question-actions{display:flex;justify-content:flex-end;margin-top:11px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(14,165,164,.36);background:var(--ssc-teal-soft)}
    .mistake-summary-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.82fr);align-items:center;gap:14px;margin:0 0 14px;padding:16px 18px;border-radius:18px;border:1px solid rgba(20,184,166,.25);background:linear-gradient(135deg,#F0FFFC 0%,#FFFFFF 100%);box-shadow:var(--ssc-shadow-card)}
    .mistake-summary-copy{display:flex;align-items:center;gap:13px;min-width:0}.mistake-summary-icon{width:42px;height:42px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(20,184,166,.24);flex:0 0 auto}.mistake-summary-count{color:var(--ssc-teal);font-size:27px;font-weight:1000;line-height:1;margin:0}.mistake-summary-label{color:var(--ssc-text-secondary);font-size:12px;font-weight:900;line-height:1.25;margin:4px 0 0;text-transform:capitalize}.mistake-summary-cta{height:48px;border:0;border-radius:15px;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;font-family:inherit;font-size:14px;font-weight:1000;box-shadow:var(--ssc-shadow-cta);cursor:pointer;white-space:nowrap}
    .rm-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;box-shadow:var(--ssc-shadow-card);padding:12px 14px;margin-bottom:12px;cursor:pointer}.rm-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}.rm-card.open{cursor:default}.rm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}.rm-tags{display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden}.rm-subject-tag,.rm-topic-tag{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;font-size:10px;font-weight:1000;line-height:1.1;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}.rm-subject-tag{color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.16)}.rm-topic-tag{color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.16)}.rm-card-bookmark-btn{width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:var(--ssc-text-muted);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer}.rm-card-bookmark-btn svg{width:18px;height:18px}.rm-card-bookmark-btn.saved svg{fill:var(--ssc-teal);stroke:var(--ssc-teal)}.rm-question-text{font-size:13px;font-weight:900;color:var(--ssc-text-primary);line-height:1.38;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0 22px 11px 0}.rm-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.rm-footer-copy{min-width:0;display:flex;align-items:center;gap:8px}.rm-meta{font-size:11px;font-weight:900;color:var(--ssc-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rm-open-icon{width:24px;height:24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:var(--ssc-text-muted);flex:0 0 auto}.rm-segment-track{height:4px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden;display:flex;width:100%}.rm-segment-fill{height:100%;display:block}.rm-segment-fill.correct{background:var(--ssc-success)}.rm-segment-fill.wrong{background:var(--ssc-danger)}.rm-segment-fill.skipped{background:var(--ssc-border-soft)}.rm-attempt-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:0;margin-top:7px;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;width:100%;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);padding:7px 0 6px}.rm-stat-block{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;min-width:0;border-left:1px solid var(--ssc-border-soft)}.rm-stat-block:first-child{border-left:0}.rm-stat-value{font-size:14px;font-weight:1000;line-height:1}.rm-stat-label{font-size:9px;font-weight:900;line-height:1.1;color:var(--ssc-text-muted);overflow:hidden;text-overflow:ellipsis;max-width:100%}.rm-stat-correct .rm-stat-value{color:var(--ssc-success)}.rm-stat-wrong .rm-stat-value{color:var(--ssc-danger)}.rm-stat-skipped .rm-stat-value{color:var(--ssc-text-muted)}
    @media (max-width:380px){.mistake-summary-card{grid-template-columns:1fr;gap:12px}.mistake-summary-cta{width:100%}.rm-stat-label{font-size:8px}}

    .mode-selector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;margin:0 0 12px;background:rgba(255,255,255,.72);border:1px solid var(--ssc-border-soft);border-radius:12px;box-shadow:0 6px 18px rgba(16,32,51,.05)}.mode-selector button{min-width:0;border:0;border-radius:9px;background:transparent;color:var(--ssc-text-secondary);font-family:inherit;font-size:10px;font-weight:900;padding:7px 4px;white-space:nowrap;cursor:pointer;text-align:center;overflow:hidden;text-overflow:ellipsis}.mode-selector button.active{background:var(--ssc-teal);color:white;box-shadow:0 6px 14px rgba(14,165,164,.18)}

    .chip-row{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;margin-left:-16px;margin-right:-16px;padding:0 16px 14px;scrollbar-width:none;-ms-overflow-style:none}.chip-row::-webkit-scrollbar{display:none}.filter-chip-row{margin-bottom:0;padding-bottom:10px}.quiz-filter-chip-row{margin:0;padding:0 8px 0 0;flex:1}.sheet-chip-row{margin-left:0;margin-right:0;padding:0 0 4px;flex-wrap:wrap}.chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:rgba(255,255,255,.82);color:var(--ssc-text-secondary);font-size:10px;font-weight:900;padding:6px 11px;white-space:nowrap;text-transform:capitalize;flex:0 0 auto;cursor:pointer;box-shadow:0 4px 10px rgba(16,32,51,.035)}.chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 6px 14px rgba(14,165,164,.16)}

    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}
    .primary-btn{border:0;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;box-shadow:var(--ssc-shadow-cta)}
    .secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}
    .primary-btn:disabled,.secondary-btn:disabled{opacity:1;cursor:default;box-shadow:none;background:var(--ssc-disabled-bg);color:var(--ssc-disabled-text);border-color:var(--ssc-border-soft)}

    .section-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:5px 0 12px}.history-filter-title{color:var(--ssc-text-primary);font-size:17px;font-weight:1000;line-height:1.2;margin:0 0 10px;letter-spacing:0}.topic-result-title{margin:2px 0 10px}

    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}
    .divider{height:1px;background:var(--ssc-border-soft);margin:12px 0}
    .question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface-soft)}.expanded-block{margin-bottom:10px}.expanded-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.expanded-question{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.48;margin:0}.expanded-attempt{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin:9px 0 0}.answer-detail-grid{display:grid;gap:8px}.answer-detail{border:1px solid var(--ssc-border-soft);background:white;border-radius:12px;padding:9px 10px}.answer-detail span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}.answer-detail b{display:block;font-size:12px;line-height:1.4}.answer-detail.correct b{color:var(--ssc-success)}.answer-detail.wrong b{color:var(--ssc-danger)}.answer-detail.skipped b{color:var(--ssc-warning)}.option-row{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--ssc-border-soft);background:white;border-radius:12px;padding:10px;margin-top:8px;color:var(--ssc-text-secondary);font-size:13px}.option-row.correct{border-color:rgba(18,184,134,.28);background:var(--ssc-success-soft);color:var(--ssc-success)}.option-row.wrong{border-color:rgba(239,68,68,.28);background:var(--ssc-danger-soft);color:var(--ssc-danger)}

    .modal-backdrop,.sheet-backdrop{position:fixed;inset:0;z-index:80;background:var(--ssc-overlay);backdrop-filter:blur(10px);display:flex}.modal-backdrop{align-items:center;justify-content:center;padding:22px}.modal-card{width:min(100%,360px);background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;padding:20px;box-shadow:var(--ssc-shadow-float)}.modal-card h2{color:var(--ssc-text-primary)}.modal-card p{color:var(--ssc-text-secondary)}.sheet-backdrop{align-items:flex-end}.filter-sheet{width:100%;max-width:430px;margin:0 auto;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:24px 24px 0 0;padding:14px 16px calc(20px + env(safe-area-inset-bottom));box-shadow:var(--ssc-shadow-float);max-height:88vh;overflow-y:auto}.sheet-handle{width:42px;height:4px;border-radius:99px;background:var(--ssc-border-soft);margin:0 auto 16px}.filter-label{font-size:11px;color:var(--ssc-text-secondary);font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px}.filter-select{width:100%;background:var(--ssc-surface-soft);border:1px solid var(--ssc-border-soft);border-radius:14px;color:var(--ssc-text-primary);padding:12px;font-family:inherit;font-size:14px}

    .date-modal-backdrop{position:fixed;inset:0;z-index:90;background:var(--ssc-overlay);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:18px}.date-modal-card{width:min(100%,420px);background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:22px;padding:20px;box-shadow:var(--ssc-shadow-float)}.date-modal-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}.date-modal-top h2{color:var(--ssc-text-primary);font-size:20px;font-weight:900;line-height:1.2;margin:0}.date-modal-top p{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:7px 0 0;font-weight:700}.date-close-btn{height:34px;width:34px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-secondary);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}.date-field-group{display:grid;gap:8px;margin-bottom:14px}.date-field-group label{color:var(--ssc-text-secondary);font-size:12px;font-weight:900}.date-field-group input{width:100%;height:46px;border-radius:14px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-text-primary);padding:0 12px;font-family:inherit;font-size:14px;font-weight:800;color-scheme:light}.date-field-group input::-webkit-calendar-picker-indicator{opacity:.8}.date-error{color:var(--ssc-danger);font-size:12px;font-weight:800;line-height:1.35;margin:0 0 14px}.date-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}.custom-range-summary{color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4;margin:-3px 2px 13px}

    .quiz-filter-group{margin:0 0 14px}.mistake-filter-group{margin-bottom:12px}.active-filter-summary{margin:0 2px 14px;color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4}

    .empty-state-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:32px 24px;text-align:center;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
    .empty-state-icon{width:64px;height:64px;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;background:var(--ssc-teal-soft)}
    .empty-state-title{color:var(--ssc-text-primary);font-size:17px;font-weight:900;margin:0 0 8px}
    .empty-state-body{color:var(--ssc-text-secondary);font-size:13px;line-height:1.5;margin:0 0 20px}
    .empty-state-cta{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:14px;padding:13px 22px;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:white;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:var(--ssc-shadow-cta)}

    .filter-trigger-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .filter-trigger-btn{display:flex;align-items:center;gap:5px;border:1px solid var(--ssc-border-soft);border-radius:999px;background:rgba(255,255,255,.82);color:var(--ssc-text-secondary);font-size:10px;font-weight:900;padding:6px 11px;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(16,32,51,.035)}
    .filter-trigger-btn.has-filters{border-color:var(--ssc-teal);color:var(--ssc-teal);background:var(--ssc-teal-soft)}
    .history-refresh-btn{width:42px;height:42px;border-radius:999px;border:1px solid #BFEAE5;background:#ECFDFB;color:#0EA5A4;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 20px rgba(14,165,164,.10);transition:background .16s ease,border-color .16s ease,color .16s ease,transform .12s ease}
    .history-refresh-btn:hover{background:#DDF8F4;border-color:#8EDCD4;color:#0D9488}
    .history-refresh-btn:active{transform:scale(.96)}
    .history-refresh-btn:focus-visible{outline:3px solid rgba(14,165,164,.24);outline-offset:2px}

    @media(max-width:380px){.mode-long{display:none}}@media(min-width:381px){.mode-short{display:none}}
  `;

  return (
    <>
      <Head><title>Quiz History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <style>{styles}</style>
        <HistoryTopBar
          title="Quiz History"
          badge="REVISION ENGINE"
          icon={<HistoryHeaderIcon />}
          showBack
          rightAction={
            <button
              type="button"
              onClick={() => { loadSummary(); loadQuizzes(quizExpanded ? 10 : 3, quickFilter, appliedCustomRange); }}
              className="history-refresh-btn"
              aria-label="Refresh quiz history"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          }
        />
        <main className="history-shell">
          <p className="intro-subtitle">Review your attempts, identify weak areas, fix mistakes.</p>

          {status === 'loading' || summaryLoading ? (
            <Loader card size="md" label="Loading quiz history..." />
          ) : isGuest ? (
            <GoogleSignInCard title="Your quiz history is waiting" subtitle="Sign in to review attempted questions and mistakes." buttonText="Continue with Google" callbackUrl="/history" />
          ) : summaryError ? (
            <EmptyPanel title="Couldn't load." body="Check connection." action="Retry" onClick={loadSummary} />
          ) : allZero ? (
            <div className="empty-state-card">
              <div className="empty-state-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="4" width="14" height="16" rx="2"/>
                  <path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>
                </svg>
              </div>
              <p className="empty-state-title font-display">No Quiz Attempts Yet</p>
              <p className="empty-state-body">You haven&apos;t attempted any quizzes yet. Start a quiz and your history will appear here.</p>
              <button type="button" className="empty-state-cta" onClick={() => router.push('/quiz?mode=daily')}>
                Start a Quiz
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          ) : (
            <>
              {/* Stats summary — 4-col 2×2 grid */}
              <section className="summary-grid">
                <div className="stat-card">
                  <div className="stat-card-icon" style={{ background: 'var(--ssc-teal-soft)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                  </div>
                  <div className="stat-card-copy">
                    <strong className="font-display"><CountUp value={summary?.totalQuizzes || 0} /></strong>
                    <span>Quizzes</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon" style={{ background: 'rgba(246,179,49,0.14)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-coin)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                  </div>
                  <div className="stat-card-copy">
                    <strong className="font-display"><CountUp value={summary?.totalQuestions || 0} /></strong>
                    <span>Questions</span>
                  </div>
                </div>
              </section>

              {/* Mode selector as scrollable pill tabs */}
              <section className="mode-selector">
                {MODES.map(mode => (
                  <button key={mode.key} type="button" className={activeMode === mode.key ? 'active' : ''} onClick={() => setActiveMode(mode.key)}>
                    {mode.label}
                  </button>
                ))}
              </section>

              {activeMode === 'quiz' && (
                <>
                  <div className="quiz-filter-group">
                    <p className="history-filter-title font-display">Select a period</p>
                    <div className="chip-row filter-chip-row quiz-filter-chip-row">
                      {QUICK_FILTERS.map(filter => (
                        <button key={filter.key} type="button" className={`chip ${quickFilter === filter.key ? 'active' : ''}`} onClick={() => handleQuickFilter(filter.key)}>{filter.label}</button>
                      ))}
                    </div>
                  </div>
                  {quickFilter === 'custom' && customRangeSummary && <p className="custom-range-summary">{customRangeSummary}</p>}
                  {quizLoading ? <Loader card size="sm" label="Loading quizzes..." /> : filteredQuizzes.length ? filteredQuizzes.map(item => (
                    <QuizCard key={item.sessionId} session={item} onReview={session => router.push(`/history/session/${session.sessionId}`)} onPractice={session => startSessionPractice(session)} />
                  )) : quickFilter === 'custom' ? (
                    <EmptyPanel title="No quizzes in this range." body="Try different dates or reset the filter." action="Reset Date Filter" onClick={resetDateFilter} />
                  ) : (
                    <div className="empty-state-card">
                      <div className="empty-state-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/>
                        </svg>
                      </div>
                      <p className="empty-state-title font-display">No Quiz Attempts Yet</p>
                      <p className="empty-state-body">You haven&apos;t attempted any quizzes yet. Start a quiz and your history will appear here.</p>
                      <button type="button" className="empty-state-cta" onClick={() => router.push('/quiz?mode=daily')}>
                        Start a Quiz
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  )}
                  {(quizData.sessions || []).length > 0 && (
                    <button type="button" className="secondary-btn w-full" onClick={expandQuizzes}>
                      {quizExpanded ? 'Show Less ↑' : 'Show More ↓'}
                    </button>
                  )}
                </>
              )}

              {activeMode === 'subject' && (
                <section>
                  <h2 className="history-filter-title font-display">Select a subject</h2>
                  {subjectsLoading ? <Loader card size="sm" label="Loading subjects..." /> : subjects?.length ? (
                    <>
                      <div className="chip-row filter-chip-row">
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
                  <h2 className="history-filter-title font-display">Select a subject</h2>
                  <div className="chip-row filter-chip-row">
                    {(subjects || []).map(item => <button key={item.subject} type="button" className={`chip ${selectedSubject === item.subject ? 'active' : ''}`} onClick={() => setSelectedSubject(item.subject)}>{item.subject}</button>)}
                  </div>
                  {!selectedSubject ? <EmptyPanel title="Select a subject to see topics." body="Choose a subject above to see attempted topics." /> : topicsLoading ? <Loader card size="sm" label="Loading topics..." /> : topics.length ? (
                    <>
                      <h2 className="history-filter-title topic-result-title font-display">Select a topic</h2>
                      <div>{topics.map(item => <StatEntityCard key={item.topic} item={item} type="topic" onPractice={topic => openPracticeModal({ subject: topic.subject, topic: topic.topic, count: topic.wrongCount + topic.skippedCount })} onReview={topic => router.push(`/history/questions?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic)}`)} />)}</div>
                    </>
                  ) : <EmptyPanel title={`No topics attempted in ${selectedSubject} yet.`} body={`Start a ${selectedSubject} quiz to build topic history.`} action={`Practice ${selectedSubject} →`} onClick={() => router.push('/dashboard')} />}
                </section>
              )}

              {activeMode === 'mistakes' && (
                <section>
                  <div className="mistake-filter-group">
                    <p className="history-filter-title font-display">Select a mistake type</p>
                    <div className="chip-row filter-chip-row">
                      {QUESTION_TYPES.map(type => <button key={type.key} type="button" className={`chip ${questionType === type.key ? 'active' : ''}`} onClick={() => setQuestionType(type.key)}>{type.label}</button>)}
                    </div>
                  </div>
                  <div className="mistake-filter-group">
                    <p className="history-filter-title font-display">Select a subject</p>
                    <div className="chip-row filter-chip-row">
                      <button type="button" className={`chip ${!questionSubject ? 'active' : ''}`} onClick={() => setQuestionSubject('')}>All</button>
                      {questionSubjects.map(item => <button key={item.subject} type="button" className={`chip ${questionSubject === item.subject ? 'active' : ''}`} onClick={() => setQuestionSubject(item.subject)}>{item.subject}</button>)}
                    </div>
                  </div>
                  <p className="active-filter-summary">Showing: {activeMistakeSummary}</p>
                  {questionsLoading ? <Loader card size="sm" label="Loading questions..." /> : (
                    <>
                      <div className="mistake-summary-card">
                        <div className="mistake-summary-copy">
                          <span className="mistake-summary-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 9v4" />
                              <path d="M12 17h.01" />
                              <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <p className="mistake-summary-count">{practiceCount}</p>
                            <p className="mistake-summary-label">{summaryPhrase}</p>
                          </div>
                        </div>
                        {practiceCount > 0 && <button type="button" className="mistake-summary-cta" onClick={() => openPracticeModal({ subject: questionSubject, count: practiceCount, answerStatus: questionType === 'repeated' || questionType === 'never_correct' ? 'wrong_skipped' : questionType, questionHistory: questionType === 'repeated' ? 'repeated' : questionType === 'never_correct' ? 'never_correct' : 'all' })}>Practice all {practiceCount}</button>}
                      </div>
                      {questionsData?.questions?.length ? questionsData.questions.map(item => <QuestionCard key={item.questionId} item={item} isOpen={expandedQuestionId === item.questionId} onToggleOpen={() => setExpandedQuestionId(current => current === item.questionId ? '' : item.questionId)} aiCache={aiCache} setAiCache={setAiCache} onToggleSave={toggleSave} />) : <EmptyPanel title={`No ${questionType.replace('_', ' ')} questions found.`} body="Practice more to build this list." action="Practice More →" onClick={() => router.push('/dashboard')} />}
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
