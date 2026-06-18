import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';
import { getSavedQuestions, unsaveQuestion } from '@/lib/data/savedData';
import { getUserCacheScope } from '@/lib/userCacheScope';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS   = ['optionA', 'optionB', 'optionC', 'optionD'];

/* â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
const COLLECTION_DISPLAY_NAMES = { PYQ: 'SSC PYQ', Parmar: 'Parmar SSC' };
function getDisplaySubject(subject, collection) {
  if (!subject) return subject;
  if (subject === 'Mixed' && collection && collection !== 'general') {
    return COLLECTION_DISPLAY_NAMES[collection] || collection;
  }
  return subject;
}

function formatSavedDate(ts) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return 'Saved just now';
  if (hours < 24)  return `Saved ${hours}h ago`;
  if (days  < 7)   return `Saved ${days} day${days === 1 ? '' : 's'} ago`;
  const d = new Date(ts);
  return `Saved ${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}

function BookmarkIcon({ filled = true, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'var(--ssc-teal)' : 'none'} stroke={filled ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

function SavedHeaderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  );
}

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
    subtitle: 'Saved topics',
    accent: 'var(--ssc-teal)',
    bg: 'var(--ssc-teal-soft)',
    glyph: 'book',
  };
}

function isImageIcon(icon) {
  return /^https?:\/\//i.test(icon || '') || /^data:image\//i.test(icon || '');
}

function SubjectIcon({ subject, sheetIcon = '' }) {
  const meta = getSubjectMeta(subject);
  if (sheetIcon) {
    return (
      <span className="sq-subject-icon" style={{ background: meta.bg, borderColor: `${meta.accent}33` }}>
        {isImageIcon(sheetIcon) ? (
          <img src={sheetIcon} alt="" className="sq-subject-img" />
        ) : (
          <span className="sq-subject-sheet-icon" aria-hidden="true">{sheetIcon}</span>
        )}
      </span>
    );
  }
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
    <span className="sq-subject-icon" style={{ background: meta.bg, borderColor: `${meta.accent}33` }}>
      <svg {...common}>{paths[meta.glyph] || paths.book}</svg>
    </span>
  );
}

function QuestionRow({ q, index, onView, onUnsave }) {
  const ts = q.savedAt || q.createdAt;
  let lastPracticed = null;
  if (ts) {
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      lastPracticed = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    }
  }

  return (
    <article
      className="sq-card"
      role="button"
      tabIndex={0}
      onClick={() => onView(index)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(index);
        }
      }}
    >
      <div className="sq-card-head">
        <div className="sq-card-head-main">
          <div className="sq-tags-row">
            {q.subject && <span className="sq-subject-dot">{getDisplaySubject(q.subject, q.collection)}</span>}
            {q.topic && <span className="sq-topic-inline">{q.topic}</span>}
          </div>
        </div>
        <button
          className="sq-card-bookmark-btn"
          onClick={e => { e.stopPropagation(); onUnsave(q.questionId); }}
          title="Remove bookmark"
          aria-label="Remove bookmark"
        >
          <BookmarkIcon filled size={18} />
        </button>
      </div>
      <p className="sq-question-text">{q.question}</p>
      <div className="sq-footer">
        <span className="sq-meta">
          {lastPracticed ? `Last Practiced: ${lastPracticed}` : 'Not practiced yet'}
        </span>
        <span className="sq-footer-right">
          <ChevronSVG />
        </span>
      </div>
    </article>
  );
}

/* â"€â"€ Full-screen revision overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
function RevisionCard({ questions, startIndex, onClose, onUnsave, onReveal }) {
  const [idx, setIdx]                     = useState(startIndex);
  const [revealed, setRevealed]           = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const touchStartX = useRef(null);
  const q = questions[idx];

  // Clamp if questions shrink (after unsave)
  useEffect(() => {
    if (idx >= questions.length) setIdx(Math.max(0, questions.length - 1));
  }, [questions.length, idx]);

  // Reset state on every new question
  useEffect(() => {
    setRevealed(false);
    setSelectedOption(null);
  }, [idx]);

  if (!questions.length) return null;
  if (!q) return null;
  const total = questions.length;
  const ts = q.lastPracticedAt || q.savedAt || q.createdAt;
  let lastPracticed = null;
  if (ts) {
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      lastPracticed = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    }
  }

  function goNext() { if (idx < total - 1) setIdx(i => i + 1); }
  function goPrev() { if (idx > 0)         setIdx(i => i - 1); }

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goNext();
    if (dx >  50) goPrev();
    touchStartX.current = null;
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FCFC 100%)', zIndex: 60,
        display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto',
        boxShadow: '0 0 0 1px rgba(14,165,164,0.10)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{
        minHeight: 58, padding: '10px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#FFFFFF',
      }}>
        <button
          onClick={onClose}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'transparent', border: '0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          aria-label="Back to saved questions"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ textAlign: 'center', minWidth: 0, fontSize: 13, fontWeight: 1000, color: 'var(--ssc-text-primary)' }}>
          {idx + 1} of {total}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onUnsave(q.questionId)}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Remove bookmark"
            aria-label="Remove bookmark"
          >
            <BookmarkIcon filled size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 104px' }}>
        {(q.subject || q.topic) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
            {q.subject && (
              <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(14,165,164,.14)' }}>
                {getDisplaySubject(q.subject, q.collection)}
              </span>
            )}
            {q.topic && (
              <span style={{ fontSize: 10, fontWeight: 1000, color: 'var(--ssc-orange)', background: 'var(--ssc-orange-soft)', borderRadius: 999, padding: '4px 8px', lineHeight: 1, border: '1px solid rgba(255,106,0,.14)' }}>{q.topic}</span>
            )}
          </div>
        )}

        <p style={{ color: 'var(--ssc-text-primary)', fontSize: 14, fontWeight: 1000, margin: '0 0 18px', lineHeight: 1.48 }}>
          {q.question}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: revealed ? 18 : 20 }}>
          {OPTION_LABELS.map((label, i) => {
            const text       = q[OPTION_KEYS[i]];
            if (!text) return null;
            const isCorrect  = revealed && label === q.correctOption;
            const isWrong    = revealed && selectedOption === label && label !== q.correctOption;

            let rowBg, rowBorder, textColor, markerBg, markerColor, markerBorder;
            if (isCorrect) {
              rowBg = 'var(--ssc-success-soft)'; rowBorder = 'rgba(18,184,134,0.42)';
              textColor = 'var(--ssc-success)'; markerBg = '#DDFBF0'; markerColor = 'var(--ssc-success)'; markerBorder = 'rgba(18,184,134,0.28)';
            } else if (isWrong) {
              rowBg = 'var(--ssc-danger-soft)'; rowBorder = 'rgba(239,68,68,0.38)';
              textColor = 'var(--ssc-danger)'; markerBg = '#FEE2E2'; markerColor = 'var(--ssc-danger)'; markerBorder = 'rgba(239,68,68,0.24)';
            } else {
              rowBg = '#FFFFFF'; rowBorder = 'var(--ssc-border-soft)';
              textColor = 'var(--ssc-text-secondary)'; markerBg = 'var(--ssc-surface-soft)'; markerColor = 'var(--ssc-text-secondary)'; markerBorder = 'var(--ssc-border-soft)';
            }

            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (revealed) return;
                  setSelectedOption(label);
                  setRevealed(true);
                  if (onReveal) onReveal(q.questionId);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderRadius: 12, padding: '12px 13px', width: '100%', textAlign: 'left',
                  background: rowBg, border: `1px solid ${rowBorder}`,
                  cursor: revealed ? 'default' : 'pointer',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 1000,
                  background: markerBg, color: markerColor, border: `1px solid ${markerBorder}`,
                }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: textColor, fontWeight: (isCorrect || isWrong) ? 900 : 700, flex: 1 }}>
                  {text}
                </span>
                {isCorrect && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-success)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {isWrong && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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

        <p style={{ margin: '8px 0 0', fontSize: 11, fontWeight: 800, color: 'var(--ssc-text-muted)' }}>
          Last Practiced: {lastPracticed || 'Not practiced yet'}
        </p>
      </div>

      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px 18px',
        background: 'rgba(255,255,255,0.96)',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 -14px 28px rgba(255,255,255,0.88)',
      }}>
        <button
          onClick={goPrev}
          disabled={idx === 0}
          style={{
            flex: 1, height: 48, borderRadius: 14,
            cursor: idx === 0 ? 'default' : 'pointer',
            background: idx === 0 ? 'var(--ssc-disabled-bg)' : '#FFFFFF',
            border: '1px solid var(--ssc-border-soft)',
            color: idx === 0 ? 'var(--ssc-disabled-text)' : 'var(--ssc-teal)',
            fontSize: 14, fontWeight: 1000,
            boxShadow: idx === 0 ? 'none' : '0 10px 22px rgba(16,32,51,0.07)',
          }}
        >
          ← Previous
        </button>
        <button
          onClick={goNext}
          disabled={idx === total - 1}
          style={{
            flex: 1, height: 48, borderRadius: 14,
            cursor: idx === total - 1 ? 'default' : 'pointer',
            background: idx === total - 1
              ? 'var(--ssc-disabled-bg)'
              : 'linear-gradient(135deg, #FF7A1A, #FF5A00)',
            border: idx === total - 1 ? '1px solid var(--ssc-border-soft)' : 'none',
            color: idx === total - 1 ? 'var(--ssc-disabled-text)' : '#FFFFFF',
            fontSize: 14, fontWeight: 700,
            boxShadow: idx === total - 1 ? 'none' : '0 10px 28px rgba(255,90,0,0.26)',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default function HistorySavedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questions, setQuestions]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeMode, setActiveMode] = useState('All');
  const [activeTopic, setActiveTopic] = useState('All');
  const [subjectMeta, setSubjectMeta] = useState({});
  const [revisionIdx, setRevisionIdx] = useState(null); // null = list, number = revision overlay
  const [searchQuery, setSearchQuery]   = useState('');
  const [sortOrder, setSortOrder]       = useState('newest');
  const [revisedIds, setRevisedIds]     = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef(null);
  const subjectFilterRefs = useRef({});

  const isLoggedIn = status === 'authenticated';
  const isGuest    = status === 'unauthenticated';

  // â"€â"€ Load questions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    if (status === 'loading') return;

    getSavedQuestions({ isLoggedIn, scope: getUserCacheScope(session) })
      .then(result => {
        const saved = Array.isArray(result) ? result : result.data?.saved || [];
        setQuestions(saved);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isLoggedIn]);

  useEffect(() => {
    let alive = true;
    fetch('/api/topics?includeSubjectMeta=true')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!alive || !data?.subjectMeta) return;
        setSubjectMeta(data.subjectMeta);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // â"€â"€ Load revised IDs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ssc_revised_questions');
      setRevisedIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {}
  }, []);

  // â"€â"€ Unsave â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleUnsave = useCallback(async (questionId) => {
    const updated = questions.filter(q => q.questionId !== questionId);
    setQuestions(updated);
    if (updated.length === 0) setRevisionIdx(null);

    if (isLoggedIn) {
      // Shared helper (existing DELETE route) â†' also patches scoped IDs/list
      // caches + marks History caches stale. No list refetch.
      try { await unsaveQuestion({ scope: getUserCacheScope(session), questionId }); } catch { /* optimistic list already updated */ }
    } else {
      try { localStorage.setItem('ssc_saved_questions', JSON.stringify(updated)); } catch {}
    }
  }, [isLoggedIn, questions, session]);

  // â"€â"€ Mark as revised â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function markRevised(questionId) {
    setRevisedIds(prev => {
      const next = new Set(prev);
      next.add(questionId);
      try { localStorage.setItem('ssc_revised_questions', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // â"€â"€ Reset visible count when filters/search/sort change â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => { setVisibleCount(20); }, [searchQuery, activeFilter, activeTopic, sortOrder, questions]);

  // â"€â"€ Infinite scroll sentinel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + 20); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }); // intentionally no deps â€" re-attaches after each render so sentinel stays tracked

  // â"€â"€ Practice all â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function startPractice(pool) {
    if (!pool.length) return;
    const returnUrl = router.asPath || '/history/saved';
    // Map to quiz-compatible shape
    const quizQuestions = pool.map(q => ({
      id:            q.questionId,
      subject:       q.subject,
      topic:         q.topic,
      question:      q.question,
      optionA:       q.optionA,
      optionB:       q.optionB,
      optionC:       q.optionC,
      optionD:       q.optionD,
      correctOption: q.correctOption,
      explanation:   q.explanation || '',
    }));
    try { sessionStorage.setItem('ssc_saved_quiz_questions', JSON.stringify(quizQuestions)); } catch {}
    router.push(`/quiz?mode=saved&count=${quizQuestions.length}&sourceScreen=saved&returnUrl=${encodeURIComponent(returnUrl)}`);
  }

  // â"€â"€ Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const unrevisedCount = questions.filter(q => !revisedIds.has(q.questionId)).length;
  const wrongCount     = questions.filter(q => q.userAnswer && q.userAnswer !== q.correctOption).length;

  // â"€â"€ Filter + search + sort â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  let filtered = [...questions];

  if (searchQuery.trim()) {
    const sq = searchQuery.toLowerCase();
    filtered = filtered.filter(q =>
      (q.question || '').toLowerCase().includes(sq) ||
      (q.subject  || '').toLowerCase().includes(sq) ||
      (q.topic    || '').toLowerCase().includes(sq)
    );
  }
  if (activeFilter === 'Unrevised') {
    filtered = filtered.filter(q => !revisedIds.has(q.questionId));
  } else if (activeFilter === 'Wrong') {
    filtered = filtered.filter(q => q.userAnswer && q.userAnswer !== q.correctOption);
  } else if (activeFilter !== 'All') {
    filtered = filtered.filter(q => q.subject === activeFilter);
  }
  if (activeTopic !== 'All') {
    filtered = filtered.filter(q => (q.topic || 'Mixed Topic') === activeTopic);
  }

  if (sortOrder === 'newest') {
    filtered.sort((a, b) => new Date(b.savedAt || b.createdAt || 0) - new Date(a.savedAt || a.createdAt || 0));
  } else if (sortOrder === 'oldest') {
    filtered.sort((a, b) => new Date(a.savedAt || a.createdAt || 0) - new Date(b.savedAt || b.createdAt || 0));
  } else if (sortOrder === 'subject') {
    filtered.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
  } else if (sortOrder === 'wrong') {
    filtered.sort((a, b) => {
      const aW = (a.userAnswer && a.userAnswer !== a.correctOption) ? 1 : 0;
      const bW = (b.userAnswer && b.userAnswer !== b.correctOption) ? 1 : 0;
      return bW - aW;
    });
  }

  // Subject groups + filter chips
  const subjectGroups = useMemo(() => {
    const map = new Map();
    questions.forEach(q => {
      const subj = q.subject || 'Other';
      map.set(subj, (map.get(subj) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [questions]);

  const topicGroups = useMemo(() => {
    const map = new Map();
    questions
      .filter(q => activeFilter === 'All' || q.subject === activeFilter)
      .forEach(q => {
        const topic = q.topic || 'Mixed Topic';
        map.set(topic, (map.get(topic) || 0) + 1);
      });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [questions, activeFilter]);

  useEffect(() => {
    if (activeMode === 'All') return;
    const key = activeFilter || 'All';
    const activeButton = subjectFilterRefs.current[key];
    if (!activeButton) return;
    activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeFilter, activeMode, subjectGroups]);

  function showOverview(mode = activeMode) {
    return mode === 'All';
  }

  function openSubject(name) {
    setActiveMode('Subject');
    setActiveFilter(name);
    setActiveTopic('All');
    setRevisionIdx(null);
  }

  function selectSubject(name) {
    setActiveFilter(name);
    setActiveTopic('All');
    setRevisionIdx(null);
  }

  function selectTopic(name) {
    setActiveTopic(name);
    setRevisionIdx(null);
  }

  function handleSavedBack() {
    if (!showOverview()) {
      setActiveMode('All');
      setActiveFilter('All');
      setActiveTopic('All');
      setRevisionIdx(null);
      return;
    }
    router.push('/history');
  }

  const visiblePracticePool = showOverview() ? questions : filtered;

  const savedStyles = `
    .sq-content-rail{padding-left:12px;padding-right:12px}
    .sq-detail-filters{padding:16px 0 10px}
    .sq-filter-row{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding:0 0 10px}
    .sq-filter-row::-webkit-scrollbar{display:none}
    .sq-filter-label{font-size:12px;font-weight:1000;color:var(--ssc-text-primary);margin:4px 0 10px}
    .sq-filter-chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:10px;font-weight:900;padding:7px 12px;white-space:nowrap;flex:0 0 auto;box-shadow:0 5px 12px rgba(16,32,51,.04)}
    .sq-filter-chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:#fff}
    .sq-control-row{display:flex;align-items:flex-start;justify-content:flex-start;flex-direction:column;padding:2px 0 0;margin-bottom:8px}
    .sq-sort-group{display:flex;align-items:flex-start;flex-direction:column;gap:0}
    .sq-sort-label{font-size:12px;font-weight:1000;color:var(--ssc-text-primary);white-space:nowrap;margin:4px 0 10px}
    .sq-sort-pills{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding:0 0 2px;max-width:100%}
    .sq-sort-pills::-webkit-scrollbar{display:none}
    .sq-summary-card{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(180deg,#F6FFFD 0%,#EAFBF7 100%);border:1px solid #BDEDEA;border-radius:16px;padding:15px 16px;margin:12px 0 0;box-shadow:var(--ssc-shadow-card)}
    .sq-summary-top{display:flex;align-items:center;gap:14px;min-width:0;flex:1}
    .sq-summary-icon{width:42px;height:42px;border-radius:13px;background:#E8F8F6;border:1px solid rgba(14,165,164,0.20);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .sq-summary-count{font-size:24px;font-weight:1000;color:var(--ssc-teal);line-height:1;font-family:var(--font-display);margin:0}
    .sq-summary-label{font-size:11px;color:var(--ssc-text-secondary);font-weight:800;margin:3px 0 0}
    .sq-summary-cta{width:50%;max-width:180px;min-width:132px;height:42px;border:0;border-radius:14px;background:linear-gradient(135deg,var(--ssc-orange),var(--ssc-orange-deep));color:#fff;font-size:13px;font-weight:1000;font-family:inherit;box-shadow:var(--ssc-shadow-cta);cursor:pointer;white-space:nowrap;flex-shrink:0}
    .sq-subject-row{display:flex;align-items:center;gap:12px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:14px;padding:10px 12px;margin-bottom:8px;box-shadow:0 8px 20px rgba(16,32,51,.06);cursor:pointer}
    .sq-subject-row:active{transform:scale(.99)}
    .sq-subject-icon{width:34px;height:34px;border-radius:11px;border:1px solid rgba(14,165,164,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sq-subject-img{width:22px;height:22px;object-fit:contain;display:block}
    .sq-subject-sheet-icon{font-size:18px;line-height:1;display:inline-flex;align-items:center;justify-content:center}
    .sq-subject-copy{min-width:0;flex:1}
    .sq-subject-name{display:block;font-size:12px;font-weight:1000;color:var(--ssc-text-primary);line-height:1.2}
    .sq-subject-subtitle{display:block;margin-top:3px;font-size:10px;font-weight:800;color:var(--ssc-text-secondary);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sq-subject-count{font-size:12px;font-weight:1000;color:var(--ssc-teal);margin-right:2px}
    .sq-sort-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .sq-sort-select{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:8px 12px;font-size:12px;color:var(--ssc-text-secondary);font-weight:600;outline:none;font-family:inherit;cursor:pointer}
    .sq-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:9px 10px 8px;margin:0 0 9px;position:relative;box-shadow:0 8px 18px rgba(16,32,51,.05);cursor:pointer}.sq-card:focus-visible{outline:3px solid rgba(14,165,164,.22);outline-offset:2px}
    .sq-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px;padding-right:0}
    .sq-card-head-main{display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1}
    .sq-tags-row{display:flex;gap:7px;align-items:center;min-width:0;overflow:hidden;flex:1;flex-wrap:nowrap}
    .sq-subject-dot,.sq-topic-inline{display:inline-flex;align-items:center;height:22px;border-radius:999px;padding:0 9px;font-size:10px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sq-subject-dot{max-width:36%;flex:0 1 auto}
    .sq-topic-inline{max-width:72%;flex:0 1 auto}
    .sq-subject-dot{color:var(--ssc-teal);background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,.14)}
    .sq-topic-inline{color:var(--ssc-orange);background:var(--ssc-orange-soft);border:1px solid rgba(255,106,0,.14)}
    .sq-card-bookmark-btn{height:22px;width:22px;border:0;background:transparent;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;color:var(--ssc-teal);margin-top:0}
    .sq-status-pill{display:inline-flex;align-items:center;justify-content:center;min-height:21px;border-radius:999px;border:1px solid;padding:0 8px;font-size:9px;font-weight:1000;white-space:nowrap}
    .sq-status-pill.amber{color:var(--ssc-warning);background:var(--ssc-warning-soft);border-color:rgba(245,158,11,.30)}
    .sq-status-pill.red{color:var(--ssc-danger);background:var(--ssc-danger-soft);border-color:rgba(239,68,68,.30)}
    .sq-status-pill.blue{color:#2563EB;background:#EFF6FF;border-color:rgba(37,99,235,.28)}
    .sq-question-text{font-size:11px;font-weight:900;color:var(--ssc-text-primary);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0 24px 9px 0}
    .sq-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.sq-footer-right{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto}
    .sq-meta{font-size:9px;color:var(--ssc-text-muted);font-weight:800}
    .sq-progress-track{height:3px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden;margin-right:2px}
    .sq-progress-fill{height:100%;border-radius:99px}
    .sq-attempt-stats{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden}
    .sq-stat-correct{color:var(--ssc-success)}
    .sq-stat-wrong{color:var(--ssc-danger)}
    .sq-stat-skipped{color:var(--ssc-warning)}
    .sq-empty-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:32px 16px;text-align:center}
  `;

  // â"€â"€ Loading â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)] pb-24">
        <style suppressHydrationWarning>{savedStyles}</style>
        <HistoryTopBar title="Saved Questions" badge="HISTORY" icon={<SavedHeaderIcon />} showBack onBack={handleSavedBack} />
        <div className="px-4">
          <Loader card size="md" label="Fetching your saved questions..." />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Saved Questions - SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{savedStyles}</style>
      <div
        className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)]"
        style={{ paddingBottom: questions.length > 0 && showOverview() ? 20 : 96 }}
      >
        <HistoryTopBar title="Saved Questions" badge="HISTORY" icon={<SavedHeaderIcon />} showBack onBack={handleSavedBack} />

        {/* Guest sign-in banner */}
        {isGuest && questions.length > 0 && (
          <GoogleSignInCard
            className="mx-4 mb-3"
            title="Sync across devices"
            subtitle="Back up & sync your questions"
            buttonText="Sign in"
            callbackUrl="/history/saved"
          />
        )}

        {questions.length === 0 ? (
          /* â"€â"€ Empty state â"€â"€ */
          <>
          <style suppressHydrationWarning>{`
            @keyframes ctaBeat {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 14px 30px rgba(255, 90, 0, 0.25);
              }
              50% {
                transform: scale(1.04);
                box-shadow: 0 18px 44px rgba(255, 90, 0, 0.55), 0 0 0 7px rgba(255, 90, 0, 0.10);
              }
            }
            .cta-beat {
              animation: ctaBeat 2s ease-in-out infinite;
            }
          `}</style>
          <div className="flex flex-col items-center px-6 gap-3" style={{ paddingTop: 20, paddingBottom: 32 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--ssc-teal-soft)',
              border: '1px solid rgba(14,165,164,0.24)',
              boxShadow: 'var(--ssc-shadow-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
              </svg>
            </div>
            <p className="font-display font-bold text-lg text-[var(--ssc-text-primary)] text-center">No saved questions yet</p>
            <p className="font-sans font-medium text-sm text-[var(--ssc-text-secondary)] text-center max-w-[260px] leading-relaxed">
              Save tough questions while practicing and revise them later.
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-[300px]">
              {[
                { emoji: 'Bookmark', title: 'During Quiz',   desc: 'Tap bookmark on any question' },
                { emoji: 'Chart', title: 'After Quiz',    desc: 'Save questions from Detailed Analysis' },
              ].map(({ emoji, title, desc }) => (
                <div key={title} style={{
                  background: 'var(--ssc-surface)',
                  border: '1px solid var(--ssc-border-soft)',
                  borderRadius: 16, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{emoji}</span>
                  <div>
                    <p className="font-display font-bold text-xs text-[var(--ssc-text-primary)] leading-none mb-1">{title}</p>
                    <p className="font-sans text-xs text-[var(--ssc-text-secondary)] leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="cta-beat font-display font-bold text-sm text-white"
              style={{
                marginTop: 8,
                padding: '14px 32px',
                borderRadius: 18,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #FF7A1A, #FF4D00)',
              }}
              onPointerDown={e => { e.currentTarget.style.animation = 'none'; e.currentTarget.style.transform = 'scale(0.97)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.animation = ''; }}
              onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.animation = ''; }}
            >
              Start Practice &rarr;
            </button>

            {/* Why save questions? */}
            <div style={{
              alignSelf: 'stretch',
              background: 'var(--ssc-teal-soft)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 18,
              padding: '14px 16px',
              marginTop: 4,
            }}>
              <p className="font-display font-bold text-xs text-[var(--ssc-text-primary)] mb-1">Tip: Why save questions?</p>
              <p className="font-sans text-xs text-[var(--ssc-text-secondary)] leading-relaxed">
                Revise only the questions you found tricky instead of repeating everything.
              </p>
            </div>
          </div>
          </>
                ) : (
          <>
            <div className="sq-content-rail">
              <div className="sq-summary-card">
                <div className="sq-summary-top">
                  <div className="sq-summary-icon">
                    <BookmarkIcon filled size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="sq-summary-count">{visiblePracticePool.length}</p>
                    <p className="sq-summary-label">Questions saved</p>
                  </div>
                </div>
                <button type="button" className="sq-summary-cta" onClick={() => startPractice(visiblePracticePool)}>
                  Practice all {visiblePracticePool.length}
                </button>
              </div>
            </div>

            {showOverview() ? (
              <div className="sq-content-rail" style={{ paddingTop: 14 }}>
                {subjectGroups.map(item => {
                  const subjectName = item.name;
                  const meta = getSubjectMeta(subjectName);
                  return (
                  <div
                    key={item.name}
                    className="sq-subject-row"
                    onClick={() => openSubject(item.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openSubject(item.name)}
                  >
                    <SubjectIcon subject={subjectName} sheetIcon={subjectMeta[subjectName]?.icon} />
                    <div className="sq-subject-copy">
                      <span className="sq-subject-name">{item.name}</span>
                      <span className="sq-subject-subtitle">{meta.subtitle}</span>
                    </div>
                    <span className="sq-subject-count">{item.count}</span>
                    <ChevronSVG />
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="sq-content-rail" style={{ paddingBottom: filtered.length > 0 ? 96 : 16 }}>
                <div className="sq-detail-filters">
                  <div className="sq-filter-row" aria-label="Saved question subjects">
                    <button
                      type="button"
                      ref={el => { subjectFilterRefs.current.All = el; }}
                      className={`sq-filter-chip ${activeFilter === 'All' ? 'active' : ''}`}
                      onClick={() => selectSubject('All')}
                    >
                      All ({questions.length})
                    </button>
                    {subjectGroups.map(item => (
                      <button
                        type="button"
                        key={item.name}
                        ref={el => { subjectFilterRefs.current[item.name] = el; }}
                        className={`sq-filter-chip ${activeFilter === item.name ? 'active' : ''}`}
                        onClick={() => selectSubject(item.name)}
                      >
                        {item.name} ({item.count})
                      </button>
                    ))}
                  </div>

                  <p className="sq-filter-label">Select a topic</p>
                  <div className="sq-filter-row" aria-label="Saved question topics">
                    <button
                      type="button"
                      className={`sq-filter-chip ${activeTopic === 'All' ? 'active' : ''}`}
                      onClick={() => selectTopic('All')}
                    >
                      All Topics
                    </button>
                    {topicGroups.map(item => (
                      <button
                        type="button"
                        key={item.name}
                        className={`sq-filter-chip ${activeTopic === item.name ? 'active' : ''}`}
                        onClick={() => selectTopic(item.name)}
                      >
                        {item.name} ({item.count})
                      </button>
                    ))}
                  </div>

                  <div className="sq-control-row">
                    <div className="sq-sort-group">
                      <span className="sq-sort-label">Sort by</span>
                      <div className="sq-sort-pills" aria-label="Sort saved questions">
                        {[
                          ['newest', 'Recent First'],
                          ['oldest', 'Oldest First'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`sq-filter-chip ${sortOrder === value ? 'active' : ''}`}
                            onClick={() => setSortOrder(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question list */}
                {filtered.length === 0 ? (
                  <div className="sq-empty-card">
                    <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', margin: 0 }}>
                      No {activeFilter} questions saved
                    </p>
                  </div>
                ) : (
                  <>
                    {filtered.slice(0, visibleCount).map((q, i) => (
                      <QuestionRow
                        key={q.questionId || i}
                        q={q}
                        index={i}
                        onView={i => setRevisionIdx(i)}
                        onUnsave={handleUnsave}
                      />
                    ))}
                    {visibleCount < filtered.length && (
                      <div ref={sentinelRef} style={{ padding: '12px 0', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--ssc-text-muted)' }}>
                          Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Revision overlay */}
            {revisionIdx !== null && filtered.length > 0 && (
              <RevisionCard
                questions={filtered}
                startIndex={revisionIdx}
                onClose={() => setRevisionIdx(null)}
                onUnsave={handleUnsave}
                onReveal={markRevised}
              />
            )}
          </>

        )}
      </div>

    </>
  );
}
