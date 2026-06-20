import { useEffect, useRef, useState } from 'react';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD'];

export const REVIEW_QUESTION_CARD_STYLES = `
  .rm-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:9px 10px 8px;margin:0 0 9px;position:relative;box-shadow:0 8px 18px rgba(16,32,51,.05);cursor:pointer}
  .rm-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}
  .rm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;padding-right:0}
  .rm-tags{display:flex;gap:7px;align-items:center;min-width:0;overflow:hidden;flex:1;flex-wrap:nowrap}
  .rm-subject-tag,.rm-topic-tag{display:inline-flex;align-items:center;height:22px;border-radius:999px;padding:0 9px;font-size:10px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rm-subject-tag{max-width:36%;flex:0 1 auto;color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14)}
  .rm-topic-tag{max-width:72%;flex:0 1 auto;color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.14)}
  .rm-card-bookmark-btn{height:22px;width:28px;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;color:var(--ssc-teal);margin-top:0}
  .rm-card-bookmark-btn svg{width:18px;height:18px}
  .rm-card-bookmark-btn.saved svg{fill:var(--ssc-teal);stroke:var(--ssc-teal)}
  .rm-question-text{font-size:11px;font-weight:900;color:var(--ssc-text-primary);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;margin:0 24px 9px 0}
  .rm-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
  .rm-footer-copy{min-width:0;flex:1}
  .rm-meta{font-size:9px;color:var(--ssc-text-muted);font-weight:800}
  .rm-open-icon{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:0;background:transparent;color:var(--ssc-text-secondary);font-size:14px;font-weight:900;flex:0 0 auto}
  .rm-segment-track{height:3px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden;margin:8px 2px 0 0;display:flex}
  .rm-segment-fill{height:100%;display:block;flex:0 0 auto}
  .rm-segment-fill.correct{background:var(--ssc-success)}
  .rm-segment-fill.wrong{background:var(--ssc-danger)}
  .rm-segment-fill.skipped{background:var(--ssc-border-soft)}
  .rm-attempt-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:0;margin-top:7px;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;width:100%;border-top:1px solid var(--ssc-border-soft);border-bottom:1px solid var(--ssc-border-soft);padding:7px 0 6px}
  .rm-attempt-stats.detail{font-size:10px;white-space:nowrap;overflow:hidden;margin-top:9px}
  .rm-stat-block{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center;min-width:0;border-left:1px solid var(--ssc-border-soft)}
  .rm-stat-block:first-child{border-left:0}
  .rm-stat-value{font-size:14px;font-weight:1000;line-height:1}
  .rm-stat-label{font-size:9px;font-weight:900;line-height:1.1;color:var(--ssc-text-muted);overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .rm-stat-correct .rm-stat-value{color:var(--ssc-success)}
  .rm-stat-wrong .rm-stat-value{color:var(--ssc-danger)}
  .rm-stat-skipped .rm-stat-value{color:var(--ssc-text-muted)}
  .rm-performance-head{display:flex;align-items:center;justify-content:flex-start;gap:10px;margin-bottom:7px;font-size:11px;font-weight:900;color:var(--ssc-text-muted)}
`;

function BookmarkIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'var(--ssc-teal)' : 'none'} stroke={filled ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

function ChevronSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function formatDate(value) {
  if (!value) return 'Not practiced yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not practiced yet';
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

export function getAttemptBreakdown(item) {
  const correctCount = Number(item?.correctCount) || Number(item?.stats?.correctCount) || 0;
  const wrongCount = Number(item?.wrongCount) || Number(item?.stats?.wrongCount) || 0;
  const skippedCount = Number(item?.skippedCount) || Number(item?.stats?.skippedCount) || 0;
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

function AttemptStatsRow({ stats, className = '' }) {
  if (!stats?.totalAttempts) return null;
  return (
    <div className={`rm-attempt-stats ${className}`}>
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

export function ReviewQuestionCard({ item, onView, onToggleSave }) {
  const attemptStats = getAttemptBreakdown(item);
  const lastPracticed = formatDate(item?.lastAttemptedAt || item?.lastPracticedAt || item?.attemptedAt || item?.completedAt);

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
        <button type="button" className={`rm-card-bookmark-btn ${item.isSaved ? 'saved' : ''}`} onClick={e => { e.stopPropagation(); onToggleSave(item); }} aria-label={item.isSaved ? 'Remove bookmark' : 'Save question'}>
          <BookmarkIcon filled={item.isSaved} />
        </button>
      </div>

      <p className="rm-question-text">{item.question || item.questionPreview}</p>

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

export function ReviewQuestionDetailOverlay({ questions, startIndex, onClose, onToggleSave }) {
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
  const lastPracticed = formatFullDate(q.lastAttemptedAt || q.lastPracticedAt || q.attemptedAt || q.completedAt);

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
      style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FCFC 100%)', zIndex: 60, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', boxShadow: '0 0 0 1px rgba(14,165,164,0.10)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ minHeight: 58, padding: '10px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF' }}>
        <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'transparent', border: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Back to question list">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ textAlign: 'center', minWidth: 0, fontSize: 13, fontWeight: 1000, color: 'var(--ssc-text-primary)' }}>{idx + 1} of {total}</div>
        <button type="button" onClick={() => onToggleSave(q)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={q.isSaved ? 'Remove bookmark' : 'Save question'} aria-label={q.isSaved ? 'Remove bookmark' : 'Save question'}>
          <BookmarkIcon filled={q.isSaved} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 104px' }}>
        {(q.subject || q.topic) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
            {q.subject && <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(14,165,164,.14)' }}>{q.subject}</span>}
            {q.topic && <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-orange)', background: 'var(--ssc-orange-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(255,106,0,.14)' }}>{q.topic}</span>}
          </div>
        )}

        <p style={{ color: 'var(--ssc-text-primary)', fontSize: 14, fontWeight: 1000, margin: '0 0 12px', lineHeight: 1.48 }}>{q.question || q.questionPreview}</p>

        {attemptStats.totalAttempts > 0 && (
          <div style={{ margin: '0 0 18px' }}>
            <div className="rm-performance-head"><span>Last Practiced: {lastPracticed || 'Not practiced yet'}</span></div>
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

            let rowBg = '#FFFFFF';
            let rowBorder = 'var(--ssc-border-soft)';
            let textColor = 'var(--ssc-text-secondary)';
            let markerBg = 'var(--ssc-surface-soft)';
            let markerColor = 'var(--ssc-text-secondary)';
            let markerBorder = 'var(--ssc-border-soft)';
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
            }

            return (
              <button key={label} type="button" onClick={() => { if (!revealed) { setSelectedOption(label); setRevealed(true); } }} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: '12px 13px', width: '100%', textAlign: 'left', background: rowBg, border: `1px solid ${rowBorder}`, cursor: revealed ? 'default' : 'pointer' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 1000, background: markerBg, color: markerColor, border: `1px solid ${markerBorder}` }}>{label}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: textColor, fontWeight: (isCorrect || isWrong) ? 900 : 700, flex: 1 }}>{text}</span>
                {isCorrect && <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                {isWrong && <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ background: 'linear-gradient(180deg,#F4FFFF 0%,#ECFAFB 100%)', border: '1px solid rgba(14,165,164,0.20)', borderRadius: 13, padding: '13px 14px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 7px', fontSize: 12, fontWeight: 1000, color: 'var(--ssc-teal)' }}>Explanation:</p>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.58, fontWeight: 700, color: 'var(--ssc-text-secondary)' }}>{q.explanation || `The correct answer is option ${q.correctOption}.`}</p>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 18px', background: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 -14px 28px rgba(255,255,255,0.88)' }}>
        <button type="button" onClick={goPrev} disabled={idx === 0} style={{ flex: 1, height: 48, borderRadius: 14, cursor: idx === 0 ? 'default' : 'pointer', background: idx === 0 ? 'var(--ssc-disabled-bg)' : '#FFFFFF', border: '1px solid var(--ssc-border-soft)', color: idx === 0 ? 'var(--ssc-disabled-text)' : 'var(--ssc-teal)', fontSize: 14, fontWeight: 1000, boxShadow: idx === 0 ? 'none' : '0 10px 22px rgba(16,32,51,0.07)' }}>← Previous</button>
        <button type="button" onClick={goNext} disabled={idx === total - 1} style={{ flex: 1, height: 48, borderRadius: 14, cursor: idx === total - 1 ? 'default' : 'pointer', background: idx === total - 1 ? 'var(--ssc-disabled-bg)' : 'linear-gradient(135deg, #FF7A1A, #FF5A00)', border: idx === total - 1 ? '1px solid var(--ssc-border-soft)' : 'none', color: idx === total - 1 ? 'var(--ssc-disabled-text)' : '#FFFFFF', fontSize: 14, fontWeight: 700, boxShadow: idx === total - 1 ? 'none' : '0 10px 28px rgba(255,90,0,0.26)' }}>Next →</button>
      </div>
    </div>
  );
}
