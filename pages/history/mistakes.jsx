import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getHistoryQuestions, normalizeHistoryQuery } from '@/lib/data/historyClientData';
import { toggleSavedQuestion } from '@/lib/data/savedData';

const RepeatedMistakesIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
  </svg>
);

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];
const SUBJECT_META = {
  Polity: { subtitle: 'Constitution • Govt', accent: '#14B8A6', bg: '#E8F8F6', glyph: 'bookmark' },
  Economics: { subtitle: 'Banking • Budget', accent: '#8B5CF6', bg: '#F3F0FF', glyph: 'chart' },
  Geography: { subtitle: 'Maps • Climate', accent: '#0EA5E9', bg: '#E8F5FF', glyph: 'globe' },
  'Current Affairs': { subtitle: 'Latest GK', accent: '#FF5C8A', bg: '#FFF0F4', glyph: 'paper' },
  'Static GK': { subtitle: 'Awards • Books', accent: '#10B981', bg: '#EAFBF3', glyph: 'book' },
  Physics: { subtitle: 'Motion • Energy', accent: '#2563EB', bg: '#EAF1FF', glyph: 'atom' },
  Chemistry: { subtitle: 'Elements • Reactions', accent: '#14B8A6', bg: '#E8F8F6', glyph: 'flask' },
  Biology: { subtitle: 'Human Body • Life', accent: '#16A34A', bg: '#EAFBF0', glyph: 'leaf' },
  'Ancient History': { subtitle: 'Vedic • Empires', accent: '#D97706', bg: '#FFF7E6', glyph: 'pillar' },
  'Medieval History': { subtitle: 'Sultanate • Mughals', accent: '#DC2626', bg: '#FEECEC', glyph: 'fort' },
  'Modern History': { subtitle: 'Freedom • Reforms', accent: '#8B5CF6', bg: '#F3F0FF', glyph: 'flag' },
  Mixed: { subtitle: 'All Subjects', accent: '#9333EA', bg: '#F5F3FF', glyph: 'target' },
};

function getSubjectMeta(subject) {
  return SUBJECT_META[subject] || {
    subtitle: 'Repeated topics',
    accent: 'var(--ssc-teal)',
    bg: 'var(--ssc-teal-soft)',
    glyph: 'book',
  };
}

function SubjectIcon({ subject }) {
  const meta = getSubjectMeta(subject);
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: meta.accent,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const paths = {
    bookmark: <path d="M7 4h10v16l-5-3-5 3V4z" />,
    chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></>,
    globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16" /><path d="M12 4c2 2.3 3 5 3 8s-1 5.7-3 8" /><path d="M12 4c-2 2.3-3 5-3 8s1 5.7 3 8" /></>,
    paper: <><path d="M7 4h8l3 3v13H7z" /><path d="M15 4v4h4" /><path d="M9 12h6" /><path d="M9 16h5" /></>,
    book: <><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3-3V4z" /><path d="M8 8h6" /><path d="M8 12h5" /></>,
    atom: <><circle cx="12" cy="12" r="1.5" /><path d="M19 12c0 2-3.1 3.6-7 3.6S5 14 5 12s3.1-3.6 7-3.6 7 1.6 7 3.6z" /><path d="M15.5 18c-1.7 1-4.1-1.2-5.4-4.6S9.4 6.7 11.1 6s4.1 1.2 5.4 4.6.7 6.7-1 7.4z" /></>,
    flask: <><path d="M9 3h6" /><path d="M10 3v5l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V3" /><path d="M8 15h8" /></>,
    leaf: <><path d="M19 5c-8 0-13 5-13 11a4 4 0 0 0 4 4c6 0 9-7 9-15z" /><path d="M6 19c2-5 5-8 10-10" /></>,
    pillar: <><path d="M5 8h14" /><path d="M7 8v10" /><path d="M11 8v10" /><path d="M15 8v10" /><path d="M5 18h14" /><path d="M6 5h12l-6-3z" /></>,
    fort: <><path d="M5 20V8h3V5h3v3h2V5h3v3h3v12" /><path d="M4 20h16" /><path d="M10 20v-5a2 2 0 0 1 4 0v5" /></>,
    flag: <><path d="M6 21V4" /><path d="M6 5h10l-1.5 4L16 13H6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  };

  return (
    <span className="rm-subject-icon" style={{ background: meta.bg, borderColor: `${meta.accent}33` }}>
      <svg {...common}>{paths[meta.glyph] || paths.book}</svg>
    </span>
  );
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

function formatFullDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 60) return `${Math.round(value)} sec`;
  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);
  return remaining ? `${minutes}m ${remaining}s` : `${minutes} min`;
}

function getQuestionTimeSpent(item) {
  return Number(item.timeSpentSeconds || item.timeTakenSeconds || item.totalTimeTakenSeconds || 0);
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
    return {
      value: percentage,
      label: formatPercent(percentage),
    };
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

function byCountThenName(a, b) {
  return b.count - a.count || a.name.localeCompare(b.name);
}

function buildCountOptions(items, keyName) {
  const map = new Map();
  items.forEach(item => {
    const name = String(item[keyName] || '').trim();
    if (!name) return;
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort(byCountThenName);
}

function EmptyPanel({ title, body, action, onClick }) {
  return (
    <section className="history-card text-center">
      <p className="font-display font-black text-[var(--ssc-text-primary)]">{title}</p>
      <p className="mt-1 mb-4 text-sm text-[var(--ssc-text-secondary)]">{body}</p>
      {action ? <button type="button" className="primary-btn" onClick={onClick}>{action}</button> : null}
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

function QuestionCard({ item, onView, onToggleSave }) {
  const attemptStats = getAttemptBreakdown(item);
  const lastPracticed = formatDate(item.lastAttemptedAt);

  return (
    <article
      className="rm-card"
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView();
        }
      }}
    >
      <div className="rm-card-head">
        <div className="rm-tags">
          {item.subject && <span className="rm-subject-tag">{item.subject}</span>}
          {item.topic && <span className="rm-topic-tag">{item.topic}</span>}
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

      <p className="rm-question-text">{item.questionPreview || item.question}</p>

      <div className="rm-footer">
        <div className="rm-footer-copy">
          <span className="rm-meta">Last Practiced: {lastPracticed}</span>
        </div>
        <span className="rm-open-icon" aria-hidden="true"><ChevronSVG /></span>
      </div>

      <AttemptSegmentBar stats={attemptStats} />
      <AttemptStatsRow stats={attemptStats} />
    </article>
  );
}

function MistakeReviewCard({ questions, startIndex, onClose, onToggleSave }) {
  const [idx, setIdx] = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const touchStartX = useRef(null);
  const q = questions[idx];

  useEffect(() => {
    if (idx >= questions.length) setIdx(Math.max(0, questions.length - 1));
  }, [questions.length, idx]);

  useEffect(() => {
    setRevealed(false);
    setSelectedOption(null);
  }, [idx]);

  if (!questions.length || !q) return null;

  const total = questions.length;
  const attemptStats = getAttemptBreakdown(q);
  const lastPracticed = formatFullDate(q.lastAttemptedAt);

  function goNext() {
    if (idx < total - 1) setIdx(current => current + 1);
  }

  function goPrev() {
    if (idx > 0) setIdx(current => current - 1);
  }

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;
    const dx = event.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goNext();
    if (dx > 50) goPrev();
    touchStartX.current = null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FCFC 100%)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 430,
        margin: '0 auto',
        boxShadow: '0 0 0 1px rgba(14,165,164,0.10)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{
        minHeight: 58,
        padding: '10px 16px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#FFFFFF',
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'transparent',
            border: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Back to repeated mistakes"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ textAlign: 'center', minWidth: 0, fontSize: 13, fontWeight: 1000, color: 'var(--ssc-text-primary)' }}>
          {idx + 1} of {total}
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(q)}
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title={q.isSaved ? 'Remove bookmark' : 'Save question'}
          aria-label={q.isSaved ? 'Remove bookmark' : 'Save question'}
        >
          <BookmarkIcon filled={q.isSaved} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 104px' }}>
        {(q.subject || q.topic) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
            {q.subject && (
              <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(14,165,164,.14)' }}>
                {q.subject}
              </span>
            )}
            {q.topic && (
              <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-orange)', background: 'var(--ssc-orange-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(255,106,0,.14)' }}>
                {q.topic}
              </span>
            )}
          </div>
        )}

        <p style={{ color: 'var(--ssc-text-primary)', fontSize: 14, fontWeight: 1000, margin: '0 0 12px', lineHeight: 1.48 }}>
          {q.question || q.questionPreview}
        </p>

        {attemptStats.totalAttempts > 0 && (
          <div style={{ margin: '0 0 18px' }}>
            <div className="rm-performance-head">
              <span>Last Practiced: {lastPracticed || 'Not practiced yet'}</span>
            </div>
            <AttemptSegmentBar stats={attemptStats} />
            <AttemptStatsRow stats={attemptStats} className="detail" />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: revealed ? 18 : 20 }}>
          {OPTION_LABELS.map((label, i) => {
            const text = q[OPTION_KEYS[i]];
            if (!text) return null;
            const isCorrect = revealed && label === q.correctOption;
            const isWrong = revealed && selectedOption === label && label !== q.correctOption;

            let rowBg;
            let rowBorder;
            let textColor;
            let markerBg;
            let markerColor;
            let markerBorder;
            if (isCorrect) {
              rowBg = 'var(--ssc-success-soft)';
              rowBorder = 'rgba(18,184,134,0.42)';
              textColor = 'var(--ssc-success)';
              markerBg = '#DDFBF0';
              markerColor = 'var(--ssc-success)';
              markerBorder = 'rgba(18,184,134,0.28)';
            } else if (isWrong) {
              rowBg = 'var(--ssc-danger-soft)';
              rowBorder = 'rgba(239,68,68,0.38)';
              textColor = 'var(--ssc-danger)';
              markerBg = '#FEE2E2';
              markerColor = 'var(--ssc-danger)';
              markerBorder = 'rgba(239,68,68,0.24)';
            } else {
              rowBg = '#FFFFFF';
              rowBorder = 'var(--ssc-border-soft)';
              textColor = 'var(--ssc-text-secondary)';
              markerBg = 'var(--ssc-surface-soft)';
              markerColor = 'var(--ssc-text-secondary)';
              markerBorder = 'var(--ssc-border-soft)';
            }

            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (revealed) return;
                  setSelectedOption(label);
                  setRevealed(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 12,
                  padding: '12px 13px',
                  width: '100%',
                  textAlign: 'left',
                  background: rowBg,
                  border: `1px solid ${rowBorder}`,
                  cursor: revealed ? 'default' : 'pointer',
                }}
              >
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 1000,
                  background: markerBg,
                  color: markerColor,
                  border: `1px solid ${markerBorder}`,
                }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: textColor, fontWeight: (isCorrect || isWrong) ? 900 : 700, flex: 1 }}>
                  {text}
                </span>
                {isCorrect && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
                {isWrong && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                )}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{
            background: 'linear-gradient(180deg,#F4FFFF 0%,#ECFAFB 100%)',
            border: '1px solid rgba(14,165,164,0.20)',
            borderRadius: 13,
            padding: '13px 14px',
            marginBottom: 16,
          }}>
            <p style={{ margin: '0 0 7px', fontSize: 12, fontWeight: 1000, color: 'var(--ssc-teal)' }}>Explanation:</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.58, fontWeight: 700, color: 'var(--ssc-text-secondary)' }}>
              {q.explanation || `The correct answer is option ${q.correctOption}.`}
            </p>
          </div>
        )}

      </div>

      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px 18px',
        background: 'rgba(255,255,255,0.96)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 -14px 28px rgba(255,255,255,0.88)',
      }}>
        <button
          type="button"
          onClick={goPrev}
          disabled={idx === 0}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            cursor: idx === 0 ? 'default' : 'pointer',
            background: idx === 0 ? 'var(--ssc-disabled-bg)' : '#FFFFFF',
            border: '1px solid var(--ssc-border-soft)',
            color: idx === 0 ? 'var(--ssc-disabled-text)' : 'var(--ssc-teal)',
            fontSize: 14,
            fontWeight: 1000,
            boxShadow: idx === 0 ? 'none' : '0 10px 22px rgba(16,32,51,0.07)',
          }}
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={idx === total - 1}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 14,
            cursor: idx === total - 1 ? 'default' : 'pointer',
            background: idx === total - 1
              ? 'var(--ssc-disabled-bg)'
              : 'linear-gradient(135deg, #FF7A1A, #FF5A00)',
            border: idx === total - 1 ? '1px solid var(--ssc-border-soft)' : 'none',
            color: idx === total - 1 ? 'var(--ssc-disabled-text)' : '#FFFFFF',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: idx === total - 1 ? 'none' : '0 10px 28px rgba(255,90,0,0.26)',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default function RepeatedMistakesPage() {
  const { data: session } = useSession();
  const cacheScope = getUserCacheScope(session);
  const router = useRouter();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionTopic, setQuestionTopic] = useState('');
  const [showQuestionList, setShowQuestionList] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');
  const [reviewIndex, setReviewIndex] = useState(null);
  const subjectFilterRefs = useRef({});

  useEffect(() => {
    let ignore = false;

    async function loadRepeatedMistakes() {
      setLoading(true);
      setError('');
      try {
        const allQuestions = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const query = normalizeHistoryQuery({
            answerStatus: 'wrong_skipped',
            questionHistory: 'repeated',
            limit: 50,
            page,
          });
          const res = await getHistoryQuestions({ scope: cacheScope, query });
          const json = res?.data;
          if (!json?.success) {
            throw new Error(json?.error || 'Failed to load repeated mistakes');
          }

          allQuestions.push(...(json.data?.questions || []));
          hasMore = Boolean(json.data?.hasMore);
          page += 1;
        }

        if (!ignore) setMistakes(allQuestions);
      } catch (err) {
        if (!ignore) {
          setMistakes([]);
          setError(err.message || 'Failed to load repeated mistakes');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadRepeatedMistakes();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQuestionTopic('');
    setReviewIndex(null);
  }, [questionSubject]);

  useEffect(() => {
    setReviewIndex(null);
  }, [questionTopic]);

  const subjects = useMemo(() => buildCountOptions(mistakes, 'subject'), [mistakes]);
  const topics = useMemo(() => {
    const source = questionSubject
      ? mistakes.filter(item => item.subject === questionSubject)
      : mistakes;
    return buildCountOptions(source, 'topic');
  }, [mistakes, questionSubject]);

  useEffect(() => {
    if (!showQuestionList) return;
    const activeButton = subjectFilterRefs.current[questionSubject || 'All'];
    if (!activeButton) return;
    activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [questionSubject, showQuestionList, subjects]);

  const filteredMistakes = useMemo(() => {
    const filtered = mistakes.filter(item => {
      if (questionSubject && item.subject !== questionSubject) return false;
      if (questionTopic && item.topic !== questionTopic) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(a.lastAttemptedAt || 0).getTime();
      const bTime = new Date(b.lastAttemptedAt || 0).getTime();
      if (sortOrder === 'most_repeated') {
        const aStats = getAttemptBreakdown(a);
        const bStats = getAttemptBreakdown(b);
        return bStats.wrongCount - aStats.wrongCount
          || bStats.totalAttempts - aStats.totalAttempts
          || bTime - aTime;
      }
      return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
    });
  }, [mistakes, questionSubject, questionTopic, sortOrder]);
  const practiceCount = filteredMistakes.length;

  function openQuestionList(subject = '') {
    setQuestionSubject(subject);
    setShowQuestionList(true);
  }

  function closeQuestionList() {
    setShowQuestionList(false);
    setQuestionSubject('');
    setQuestionTopic('');
    setReviewIndex(null);
  }

  async function startPractice(payload) {
    if (starting) return;
    setStarting(true);
    const returnUrl = router.asPath || '/history/mistakes';
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
          subject: questionSubject,
          topic: questionTopic,
          answerStatus: 'wrong_skipped',
          questionHistory: 'repeated',
          limit: Math.min(50, Math.max(1, practiceCount)),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to start practice');
      sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
        questions: json.data.questions,
        quizMode: json.data.quizMode,
        subject: questionSubject || 'History',
        topic: questionTopic || 'Repeated Mistakes',
        sourceCollection: 'general',
        returnUrl,
      }));
      router.push(`/quiz?mode=history&count=${json.data.questionCount}&sourceScreen=history&returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch (err) {
      setError(err.message || 'Failed to start practice');
    } finally {
      setStarting(false);
    }
  }

  async function toggleSave(question) {
    setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: !item.isSaved } : item));
    try {
      const r = await toggleSavedQuestion({ scope: cacheScope, action: question.isSaved ? 'unsave' : 'save', question });
      if (!r.ok) setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: question.isSaved } : item));
    } catch {
      setMistakes(prev => prev.map(item => item.questionId === question.questionId ? { ...item, isSaved: question.isSaved } : item));
    }
  }

  const styles = `
    .history-shell{padding:12px 12px 20px}
    .history-shell.filtered{padding-bottom:calc(104px + env(safe-area-inset-bottom))}
    .intro-block{margin-bottom:12px}.intro-subtitle{color:var(--ssc-text-secondary);font-size:13px;line-height:1.45;margin:0}
    .history-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:var(--ssc-shadow-card)}
    .question-card{padding:12px 14px}.question-top-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.question-kicker{color:var(--ssc-teal);font-size:11px;font-weight:900;margin:0;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.question-badge{font-size:10px;padding:4px 8px;max-width:132px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}.question-preview{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.38;margin:9px 0 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.question-stat-row{display:flex;align-items:center;gap:14px;margin-top:10px;padding:8px 0 0;border-top:1px solid var(--ssc-border-soft);font-size:12px;font-weight:900;white-space:nowrap}.question-stat-row span+span:before{content:'';margin:0}.question-actions{display:grid;grid-template-columns:1fr .72fr 40px;gap:8px;margin-top:11px;align-items:center}.save-icon-btn{height:40px;width:40px;border-radius:999px;border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);display:flex;align-items:center;justify-content:center;transition:transform .12s ease,background .12s ease,border-color .12s ease}.save-icon-btn:active{transform:scale(.92)}.save-icon-btn.saved{border-color:rgba(14,165,164,.34);background:var(--ssc-teal-soft)}
    .chip-row{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:0 0 10px;scrollbar-width:none;-ms-overflow-style:none}.chip-row::-webkit-scrollbar{display:none}.chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:10px;font-weight:900;padding:7px 12px;white-space:nowrap;text-transform:none;flex:0 0 auto;box-shadow:0 5px 12px rgba(16,32,51,.04)}.chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white;box-shadow:0 8px 18px rgba(14,165,164,.16)}
    .primary-btn,.secondary-btn{border-radius:14px;font-size:13px;font-weight:900;padding:11px 12px;text-align:center;cursor:pointer;font-family:inherit;min-height:40px}.primary-btn{border:0;background:linear-gradient(135deg,#ff7a1a,#ff4d00);color:white;box-shadow:var(--ssc-shadow-cta)}.secondary-btn{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface-soft);color:var(--ssc-teal)}.primary-btn:disabled,.secondary-btn:disabled{opacity:.55;cursor:default;box-shadow:none}
    .tone-pill{display:inline-flex;border:1px solid;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}.divider{height:1px;background:var(--ssc-border-soft);margin:12px 0}.question-expanded{overflow:hidden;margin-top:12px;padding:11px;border:1px solid var(--ssc-border-soft);border-radius:14px;background:var(--ssc-surface-soft)}.expanded-block{margin-bottom:10px}.expanded-label{color:var(--ssc-text-muted);font-size:10px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin:0 0 6px}.expanded-question{color:var(--ssc-text-primary);font-size:13px;font-weight:900;line-height:1.48;margin:0}.expanded-attempt{color:var(--ssc-text-muted);font-size:11px;font-weight:800;margin:9px 0 0}.answer-detail-grid{display:grid;gap:8px}.answer-detail{border:1px solid var(--ssc-border-soft);background:var(--ssc-surface);border-radius:12px;padding:9px 10px}.answer-detail span{display:block;color:var(--ssc-text-muted);font-size:10px;font-weight:900;margin-bottom:4px}.answer-detail b{display:block;font-size:12px;line-height:1.4}.answer-detail.correct{background:var(--ssc-success-soft);border-color:rgba(18,184,134,.28)}.answer-detail.wrong{background:var(--ssc-danger-soft);border-color:rgba(239,68,68,.28)}.answer-detail.correct b{color:var(--ssc-success)}.answer-detail.wrong b{color:var(--ssc-danger)}.answer-detail.skipped b{color:var(--ssc-text-secondary)}
    .mistake-filter-group{margin-bottom:16px}.mistake-filter-group .chip-row{padding-bottom:0}.mistake-filter-label{display:block;margin:0 0 10px 2px;color:var(--ssc-text-primary);font-size:12px;font-weight:900;line-height:1}.active-filter-summary{margin:-2px 2px 14px;color:var(--ssc-text-secondary);font-size:12px;font-weight:800;line-height:1.4}
    .rm-summary-card{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(180deg,#F6FFFD 0%,#EAFBF7 100%);border:1px solid #BDEDEA;border-radius:16px;padding:15px 16px;margin:12px 0 0;box-shadow:var(--ssc-shadow-card)}
    .rm-summary-top{display:flex;align-items:center;gap:14px;min-width:0;flex:1}
    .rm-summary-icon{width:42px;height:42px;border-radius:13px;background:#E8F8F6;border:1px solid rgba(14,165,164,0.20);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .rm-summary-count{font-size:24px;font-weight:1000;color:var(--ssc-teal);line-height:1;font-family:var(--font-display);margin:0}
    .rm-summary-label{font-size:11px;color:var(--ssc-text-secondary);font-weight:800;margin:3px 0 0}
    .rm-summary-cta{width:50%;max-width:180px;min-width:132px;height:42px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:#fff;font-size:13px;font-weight:1000;font-family:inherit;box-shadow:var(--ssc-shadow-cta);cursor:pointer;white-space:nowrap;flex-shrink:0}
    .rm-summary-cta:disabled{opacity:.62;cursor:default;box-shadow:none}
    .rm-detail-filters{padding:16px 0 10px}
    .rm-cache-message{margin:0 0 10px;color:var(--ssc-text-secondary);font-size:11px;font-weight:800;text-align:right}
    .rm-filter-label{font-size:12px;font-weight:1000;color:var(--ssc-text-primary);margin:4px 0 10px}
    .rm-control-row{display:flex;align-items:flex-start;justify-content:flex-start;flex-direction:column;padding:2px 0 0;margin-bottom:8px}
    .rm-sort-group{display:flex;align-items:flex-start;flex-direction:column;gap:0}
    .rm-sort-label{font-size:12px;font-weight:1000;color:var(--ssc-text-primary);white-space:nowrap;margin:4px 0 10px}
    .rm-sort-pills{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding:0 0 2px;max-width:100%}
    .rm-sort-pills::-webkit-scrollbar{display:none}
    .rm-subject-row{display:flex;align-items:center;gap:12px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:14px;padding:10px 12px;margin-bottom:8px;box-shadow:0 8px 20px rgba(16,32,51,.06);cursor:pointer}
    .rm-overview-list{padding-top:14px}
    .rm-subject-row:active{transform:scale(.99)}
    .rm-subject-icon{width:34px;height:34px;border-radius:11px;border:1px solid rgba(14,165,164,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .rm-subject-copy{min-width:0;flex:1}
    .rm-subject-name{display:block;font-size:12px;font-weight:1000;color:var(--ssc-text-primary);line-height:1.2}
    .rm-subject-subtitle{display:block;margin-top:3px;font-size:10px;font-weight:800;color:var(--ssc-text-secondary);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rm-subject-count{font-size:12px;font-weight:1000;color:var(--ssc-teal);margin-right:2px}
    .rm-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:9px 10px 8px;margin:0 0 9px;position:relative;box-shadow:0 8px 18px rgba(16,32,51,.05);cursor:pointer}.rm-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}
    .rm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;padding-right:0}
    .rm-tags{display:flex;gap:7px;align-items:center;min-width:0;overflow:hidden;flex:1;flex-wrap:nowrap}
    .rm-subject-tag,.rm-topic-tag{display:inline-flex;align-items:center;height:22px;border-radius:999px;padding:0 9px;font-size:10px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rm-subject-tag{max-width:36%;flex:0 1 auto;color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14)}
    .rm-topic-tag{max-width:72%;flex:0 1 auto;color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.14)}
    .rm-repeat-pill{font-size:11px;font-weight:900;color:var(--ssc-danger);background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.20);border-radius:99px;padding:3px 10px;white-space:nowrap;flex-shrink:0}
    .rm-question-text{font-size:11px;font-weight:900;color:var(--ssc-text-primary);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0 24px 9px 0}
    .rm-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
    .rm-footer-copy{min-width:0;flex:1}
    .rm-open-icon{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:0;background:transparent;color:var(--ssc-text-secondary);font-size:14px;font-weight:900;flex:0 0 auto}
    .rm-meta{font-size:9px;color:var(--ssc-text-muted);font-weight:800}
    .rm-correct-label{font-size:9px;color:var(--ssc-text-secondary);font-weight:900}
    .rm-card-bookmark-btn{height:22px;width:28px;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;color:var(--ssc-teal);margin-top:0}
    .sq-progress-track{height:3px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden;margin-right:2px}
    .sq-progress-fill{height:100%;border-radius:99px}
    .rm-performance-head{display:flex;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:7px;font-size:11px;font-weight:900;color:var(--ssc-text-muted)}
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
  `;

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)]"
      style={{ paddingBottom: !showQuestionList && !loading && !error ? 20 : 112 }}
    >
      <Head><title>Repeated Mistakes - SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{styles}</style>
      <HistoryTopBar
        title="Repeated Mistakes"
        icon={RepeatedMistakesIcon}
        showBack
        onBack={showQuestionList ? closeQuestionList : null}
      />
      <main className={`history-shell ${showQuestionList ? 'filtered' : ''}`}>
        {loading ? <Loader card size="md" label="Loading mistakes..." /> : error ? (
          <EmptyPanel title="Couldn't load repeated mistakes." body={error} action="Retry" onClick={() => router.reload()} />
        ) : (
          <>
            {!showQuestionList ? (
              <>
                {/* Summary card */}
                <div className="rm-summary-card">
                  <div className="rm-summary-top">
                    <div className="rm-summary-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="rm-summary-count">{mistakes.length}</p>
                      <p className="rm-summary-label">Repeated mistakes</p>
                    </div>
                  </div>
                  {mistakes.length > 0 && (
                    <button
                      type="button"
                      className="rm-summary-cta"
                      disabled={starting}
                      onClick={() => startPractice({})}
                    >
                      {starting ? 'Starting...' : `Practice all ${mistakes.length}`}
                    </button>
                  )}
                </div>

                {/* Subject category rows */}
                <div className="rm-overview-list">
                  {subjects.map(subj => {
                    const meta = getSubjectMeta(subj.name);
                    return (
                      <div
                        key={subj.name}
                        className="rm-subject-row"
                        onClick={() => openQuestionList(subj.name)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && openQuestionList(subj.name)}
                      >
                        <SubjectIcon subject={subj.name} />
                        <div className="rm-subject-copy">
                          <span className="rm-subject-name">{subj.name}</span>
                          <span className="rm-subject-subtitle">{meta.subtitle}</span>
                        </div>
                        <span className="rm-subject-count">{subj.count}</span>
                        <ChevronSVG />
                      </div>
                    );
                  })}
                </div>

                {mistakes.length === 0 && (
                  <EmptyPanel
                    title="No repeated mistakes yet."
                    body="Practice more quizzes to build this list."
                    action="Practice Now"
                    onClick={() => router.push('/dashboard')}
                  />
                )}
              </>
            ) : (
              <>
                <div className="rm-summary-card">
                  <div className="rm-summary-top">
                    <div className="rm-summary-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="rm-summary-count">{filteredMistakes.length}</p>
                      <p className="rm-summary-label">Repeated mistakes</p>
                    </div>
                  </div>
                  {practiceCount > 0 && (
                    <button
                      type="button"
                      className="rm-summary-cta"
                      disabled={starting}
                      onClick={() => startPractice({})}
                    >
                      {starting ? 'Starting...' : `Practice all ${practiceCount}`}
                    </button>
                  )}
                </div>

                <div className="rm-detail-filters">
                  <div className="chip-row" aria-label="Repeated mistake subjects">
                    <button
                      type="button"
                      ref={el => { subjectFilterRefs.current.All = el; }}
                      className={`chip ${!questionSubject ? 'active' : ''}`}
                      onClick={() => openQuestionList('')}
                    >
                      All ({mistakes.length})
                    </button>
                    {subjects.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        ref={el => { subjectFilterRefs.current[item.name] = el; }}
                        className={`chip ${questionSubject === item.name ? 'active' : ''}`}
                        onClick={() => setQuestionSubject(item.name)}
                      >
                        {item.name} ({item.count})
                      </button>
                    ))}
                  </div>

                  <p className="rm-filter-label">Select a topic</p>
                  <div className="chip-row" aria-label="Repeated mistake topics">
                    <button
                      type="button"
                      className={`chip ${!questionTopic ? 'active' : ''}`}
                      onClick={() => setQuestionTopic('')}
                    >
                      All Topics
                    </button>
                    {topics.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        className={`chip ${questionTopic === item.name ? 'active' : ''}`}
                        onClick={() => setQuestionTopic(item.name)}
                      >
                        {item.name} ({item.count})
                      </button>
                    ))}
                  </div>

                  <div className="rm-control-row">
                    <div className="rm-sort-group">
                      <span className="rm-sort-label">Sort by</span>
                      <div className="rm-sort-pills" aria-label="Sort repeated mistakes">
                        {[
                          ['newest', 'Recent First'],
                          ['oldest', 'Oldest First'],
                          ['most_repeated', 'Most Repeated'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`chip ${sortOrder === value ? 'active' : ''}`}
                            onClick={() => setSortOrder(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question cards */}
                {filteredMistakes.length ? filteredMistakes.map((item, index) => (
                  <QuestionCard
                    key={item.questionId}
                    item={item}
                    onView={() => setReviewIndex(index)}
                    onToggleSave={toggleSave}
                  />
                )) : (
                  <EmptyPanel
                    title="No repeated questions found."
                    body="Practice more to build this list."
                    action="Practice More"
                    onClick={() => router.push('/dashboard')}
                  />
                )}
                {reviewIndex !== null && filteredMistakes.length > 0 && (
                  <MistakeReviewCard
                    questions={filteredMistakes}
                    startIndex={reviewIndex}
                    onClose={() => setReviewIndex(null)}
                    onToggleSave={toggleSave}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

