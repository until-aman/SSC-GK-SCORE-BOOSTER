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

function QuestionRow({ q, index, onView, onUnsave }) {
  const totalAttempts = (Number(q.correctCount) || 0) + (Number(q.wrongCount) || 0);
  let correctPct = null;
  if (totalAttempts > 0) {
    correctPct = Math.round((Number(q.correctCount) || 0) / totalAttempts * 100);
  } else if (q.userAnswer) {
    correctPct = q.userAnswer === q.correctOption ? 100 : 0;
  }

  const ts = q.savedAt || q.createdAt;
  let lastPracticed = null;
  if (ts) {
    const d = new Date(ts);
    if (Number.isFinite(d.getTime())) {
      lastPracticed = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
    }
  }

  return (
    <div className="sq-card" onClick={() => onView(index)}>
      <button
        className="sq-bookmark-btn"
        onClick={e => { e.stopPropagation(); onUnsave(q.questionId); }}
        title="Remove bookmark"
        aria-label="Remove bookmark"
      >
        <BookmarkIcon filled size={15} />
      </button>
      {q.topic && (
        <div className="sq-tags-row">
          <span className="sq-topic-tag">{q.topic}</span>
        </div>
      )}
      <p className="sq-question-text">{q.question}</p>
      <div className="sq-footer">
        <span className="sq-meta">
          {lastPracticed ? `Last Practiced: ${lastPracticed}` : 'Not practiced yet'}
        </span>
        {correctPct !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: correctPct >= 50 ? 'var(--ssc-success)' : 'var(--ssc-danger)' }}>
            Correct: {correctPct}%
          </span>
        )}
      </div>
      {correctPct !== null && (
        <div className="sq-progress-track">
          <div className="sq-progress-fill" style={{
            width: `${correctPct}%`,
            background: correctPct >= 50 ? 'var(--ssc-success)' : 'var(--ssc-danger)',
          }} />
        </div>
      )}
    </div>
  );
}

/* â"€â"€ Full-screen revision overlay â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
function RevisionCard({ questions, startIndex, onClose, onUnsave, onReveal }) {
  const [idx, setIdx]                     = useState(startIndex);
  const [revealed, setRevealed]           = useState(false);
  const [markedDone, setMarkedDone]       = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const touchStartX = useRef(null);

  // Clamp if questions shrink (after unsave)
  useEffect(() => {
    if (idx >= questions.length) setIdx(Math.max(0, questions.length - 1));
  }, [questions.length, idx]);

  // Reset state on every new question
  useEffect(() => { setRevealed(false); setMarkedDone(false); setSelectedOption(null); }, [idx]);

  if (!questions.length) return null;
  const q     = questions[idx];
  const total = questions.length;

  function goNext() { if (idx < total - 1) setIdx(i => i + 1); }
  function goPrev() { if (idx > 0)         setIdx(i => i - 1); }

  function handleReveal() {
    setRevealed(true);
    if (onReveal) onReveal(q.questionId);
  }
  function handleMarkRevised() {
    setMarkedDone(true);
    if (onReveal) onReveal(q.questionId); // idempotent
  }

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
        position: 'fixed', inset: 0, background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)', zIndex: 60,
        display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto',
        boxShadow: '0 0 0 1px rgba(14,165,164,0.10)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div style={{
        minHeight: 64, padding: '12px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.96)',
        borderBottom: '1px solid var(--ssc-border-soft)',
        borderRadius: '0 0 22px 22px',
        boxShadow: 'var(--ssc-shadow-card)',
      }}>
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--ssc-orange-soft, #FFF3E8)', border: '1px solid rgba(255,106,0,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          aria-label="Close"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-orange)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ssc-text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>Saved Revision</p>
            <span style={{
              fontSize: 9, fontWeight: 800, color: 'var(--ssc-warning)',
              border: '1px solid rgba(245,158,11,0.30)', borderRadius: 999,
              padding: '3px 7px', letterSpacing: '0.02em',
              background: 'var(--ssc-warning-soft)',
            }}>SAVED</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', margin: '3px 0 0', fontWeight: 700 }}>{idx + 1} / {total}</p>
        </div>
        {/* Spacer keeps title centred */}
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 18px' }}>
        <section style={{
          background: 'var(--ssc-surface)',
          border: '1px solid var(--ssc-border-soft)',
          borderRadius: 22,
          padding: '16px 16px 14px',
          boxShadow: 'var(--ssc-shadow-card)',
        }}>

        {/* Subject â€¢ Topic */}
        {(q.subject || q.topic) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
            {q.subject && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', borderRadius: 99, padding: '2px 10px' }}>
                {getDisplaySubject(q.subject, q.collection)}
              </span>
            )}
            {q.topic && (
              <span style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', fontWeight: 600 }}>{q.topic}</span>
            )}
          </div>
        )}

        {/* Question */}
        <p className="t-body" style={{ color: 'var(--ssc-text-primary)', fontWeight: 800, marginBottom: 18, lineHeight: 1.55 }}>
          {q.question}
        </p>

        {/* Options â€" tappable before reveal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {OPTION_LABELS.map((label, i) => {
            const text       = q[OPTION_KEYS[i]];
            if (!text) return null;
            const isSelected = !revealed && selectedOption === label;
            const isCorrect  = revealed && label === q.correctOption;
            const isWrong    = revealed && selectedOption === label && label !== q.correctOption;

            // Compute per-state colours
            let rowBg, rowBorder, textColor, dotBg, dotColor;
            if (isCorrect) {
              rowBg = 'var(--ssc-success-soft)'; rowBorder = 'rgba(18,184,134,0.36)';
              textColor = 'var(--ssc-success)'; dotBg = 'var(--ssc-success)'; dotColor = '#FFFFFF';
            } else if (isWrong) {
              rowBg = 'var(--ssc-danger-soft)'; rowBorder = 'rgba(239,68,68,0.34)';
              textColor = 'var(--ssc-danger)'; dotBg = 'var(--ssc-danger)'; dotColor = '#FFF';
            } else if (isSelected) {
              rowBg = 'var(--ssc-teal-soft)'; rowBorder = 'rgba(14,165,164,0.45)';
              textColor = 'var(--ssc-teal)'; dotBg = 'var(--ssc-teal)'; dotColor = '#FFF';
            } else {
              rowBg = 'var(--ssc-surface-soft)'; rowBorder = 'var(--ssc-border-soft)';
              textColor = 'var(--ssc-text-primary)'; dotBg = 'var(--ssc-teal-soft)'; dotColor = 'var(--ssc-teal)';
            }

            return (
              <button
                key={label}
                onClick={() => { if (!revealed) { setSelectedOption(label); setRevealed(true); if (onReveal) onReveal(q.questionId); } }}
                onPointerDown={e => { if (!revealed) e.currentTarget.style.transform = 'scale(0.98)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderRadius: 16, padding: '13px 14px', width: '100%', textAlign: 'left',
                  background: rowBg, border: `1px solid ${rowBorder}`,
                  cursor: revealed ? 'default' : 'pointer',
                  transition: 'background 250ms ease, border-color 250ms ease, transform 80ms ease',
                  transform: 'scale(1)',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: dotBg, color: dotColor,
                  transition: 'background 250ms ease, color 250ms ease',
                }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: textColor, fontWeight: (isCorrect || isWrong || isSelected) ? 600 : 400, transition: 'color 250ms ease', flex: 1 }}>
                  {text}
                </span>
                {isCorrect && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-success)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {isWrong && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-danger)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Correct / Wrong result badge â€" shown after reveal when user picked an option */}
        {revealed && selectedOption && (
          <div style={{
            textAlign: 'center', marginBottom: 14,
            fontSize: 14, fontWeight: 700,
            color: selectedOption === q.correctOption ? 'var(--ssc-success)' : 'var(--ssc-danger)',
          }}>
            {selectedOption === q.correctOption
              ? 'Correct!'
              : `Incorrect - answer is ${q.correctOption}`}
          </div>
        )}

        {/* Show / Check Answer button â€" hidden once revealed */}
        {!revealed && (
          <button
            onClick={handleReveal}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              border: 'none', cursor: 'pointer',
              background: selectedOption
                ? 'linear-gradient(135deg, #FF7A1A, #FF5A00)'
                : 'linear-gradient(135deg, var(--ssc-teal), #0C8F8D)',
              color: '#FFFFFF', fontSize: 16, fontWeight: 700,
              marginBottom: 8,
              transition: 'background 200ms ease',
            }}
          >
            {selectedOption ? 'Check Answer ->' : 'Show Answer'}
          </button>
        )}

        {/* Answer + explanation â€" shown after reveal */}
        {revealed && (
          <>
            <div style={{ background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.24)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ssc-teal)', marginBottom: q.explanation ? 10 : 0 }}>
                Correct Answer: {q.correctOption}
              </p>
              {q.explanation && (
                <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.65, margin: 0 }}>
                  {q.explanation}
                </p>
              )}
            </div>

            {/* Secondary actions â€" muted, not loud */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 8 }}>
              <button
                onClick={() => onUnsave(q.questionId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ssc-text-secondary)', fontWeight: 700 }}
              >
                <BookmarkIcon filled size={13} />
                Remove from Saved
              </button>
              <button
                onClick={handleMarkRevised}
                disabled={markedDone}
                style={{ background: 'none', border: 'none', cursor: markedDone ? 'default' : 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: markedDone ? 'var(--ssc-success)' : 'var(--ssc-text-secondary)', fontWeight: 700 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={markedDone ? 'var(--ssc-success)' : 'var(--ssc-text-secondary)'} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {markedDone ? 'Marked as Revised' : 'Mark as Revised'}
              </button>
            </div>
          </>
        )}
        </section>
      </div>

      {/* Footer nav â€" Previous | Next */}
      <div style={{
        padding: '12px 16px 24px', flexShrink: 0,
        borderTop: '1px solid var(--ssc-border-soft)',
        background: 'rgba(255,255,255,0.96)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={goPrev}
          disabled={idx === 0}
          style={{
            flex: 1, height: 48, borderRadius: 14,
            cursor: idx === 0 ? 'default' : 'pointer',
            background: idx === 0 ? 'var(--ssc-disabled-bg)' : 'var(--ssc-surface-soft)',
            border: '1px solid var(--ssc-border-soft)',
            color: idx === 0 ? 'var(--ssc-disabled-text)' : 'var(--ssc-text-primary)',
            fontSize: 14, fontWeight: 700,
          }}
        >
          Previous
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
          Next
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
  const [revisionIdx, setRevisionIdx] = useState(null); // null = list, number = revision overlay
  const [searchQuery, setSearchQuery]   = useState('');
  const [sortOrder, setSortOrder]       = useState('newest');
  const [revisedIds, setRevisedIds]     = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const [showCTA, setShowCTA] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    let timer;
    function onInteract() {
      timer = setTimeout(() => setShowCTA(true), 4000);
    }
    window.addEventListener('scroll', onInteract, { capture: true, once: true });
    window.addEventListener('touchstart', onInteract, { capture: true, once: true });
    window.addEventListener('pointermove', onInteract, { capture: true, once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onInteract, true);
      window.removeEventListener('touchstart', onInteract, true);
      window.removeEventListener('pointermove', onInteract, true);
    };
  }, []);

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
  useEffect(() => { setVisibleCount(20); }, [searchQuery, activeFilter, sortOrder, questions]);

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
    router.push(`/quiz?mode=saved&count=${quizQuestions.length}&sourceScreen=saved`);
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

  const filterChips = [
    { key: 'All', label: `All ${questions.length}` },
    ...subjectGroups.map(s => ({ key: s.name, label: `${s.name} ${s.count}` })),
  ];

  const savedStyles = `
    .sq-chips-row{display:flex;gap:8px;overflow-x:auto;padding:0 16px 12px;scrollbar-width:none;-ms-overflow-style:none}
    .sq-chips-row::-webkit-scrollbar{display:none}
    .sq-chip{border:1px solid var(--ssc-border-soft);border-radius:999px;background:var(--ssc-surface);color:var(--ssc-text-secondary);font-size:12px;font-weight:700;padding:7px 14px;white-space:nowrap;flex-shrink:0;cursor:pointer}
    .sq-chip.active{background:var(--ssc-teal);border-color:var(--ssc-teal);color:white}
    .sq-summary-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:20px;padding:20px 18px;margin-bottom:14px;box-shadow:var(--ssc-shadow-card)}
    .sq-summary-icon{width:44px;height:44px;border-radius:13px;background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,0.20);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
    .sq-summary-heading{font-size:13px;font-weight:700;color:var(--ssc-text-secondary);margin:0 0 4px}
    .sq-summary-count{font-size:40px;font-weight:900;color:var(--ssc-text-primary);line-height:1;font-family:var(--font-display);margin:0}
    .sq-summary-label{font-size:12px;color:var(--ssc-text-muted);font-weight:600;margin:4px 0 0}
    .sq-subject-row{display:flex;align-items:center;gap:12px;background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:var(--ssc-shadow-card);cursor:pointer}
    .sq-subject-icon{width:40px;height:40px;border-radius:11px;background:var(--ssc-teal-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sq-subject-name{flex:1;font-size:15px;font-weight:800;color:var(--ssc-text-primary)}
    .sq-subject-count{font-size:13px;font-weight:700;color:var(--ssc-text-secondary);margin-right:4px}
    .sq-sort-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .sq-sort-select{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:12px;padding:8px 12px;font-size:12px;color:var(--ssc-text-secondary);font-weight:600;outline:none;font-family:inherit;cursor:pointer}
    .sq-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;padding:14px 16px;margin-bottom:10px;position:relative;box-shadow:var(--ssc-shadow-card);cursor:pointer}
    .sq-bookmark-btn{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:12px;background:var(--ssc-teal-soft);border:1px solid rgba(14,165,164,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer}
    .sq-tags-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding-right:40px}
    .sq-topic-tag{font-size:11px;font-weight:700;color:#FF6A00;background:rgba(255,106,0,0.10);border-radius:99px;padding:2px 9px}
    .sq-question-text{font-size:14px;font-weight:700;color:var(--ssc-text-primary);line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0 0 10px}
    .sq-footer{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    .sq-meta{font-size:11px;color:var(--ssc-text-muted)}
    .sq-progress-track{height:4px;border-radius:99px;background:var(--ssc-border-soft);overflow:hidden}
    .sq-progress-fill{height:100%;border-radius:99px}
    .sq-empty-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:32px 16px;text-align:center}
  `;

  // â"€â"€ Loading â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)] pb-24">
        <HistoryTopBar title="Saved Questions" showBack />
        <div className="px-4 pt-5 pb-5">
          <p className="t-page-subtitle text-[var(--ssc-text-secondary)]">Build your personal revision bank</p>
        </div>
        <div className="px-4">
          <Loader card size="md" label="Fetching your saved questions..." />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Saved Questions - SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)] pb-24">
        <HistoryTopBar title="Saved Questions" showBack />

        {/* Header */}
        <div className="px-4 pt-5 pb-5">
          <p className="t-page-subtitle text-[var(--ssc-text-secondary)]">Build your personal revision bank</p>
        </div>

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
            <style suppressHydrationWarning>{savedStyles}</style>

            {/* Subject filter chips */}
            <div className="sq-chips-row">
              {filterChips.map(({ key, label }) => (
                <button
                  key={key}
                  className={`sq-chip ${activeFilter === key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeFilter === 'All' ? (
              <div className="px-4">
                {/* Summary card */}
                <div className="sq-summary-card">
                  <div className="sq-summary-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                    </svg>
                  </div>
                  <p className="sq-summary-heading font-display">Your Saved Questions</p>
                  <p className="sq-summary-count">{questions.length}</p>
                  <p className="sq-summary-label">Questions saved</p>
                </div>

                {/* Subject category rows */}
                {subjectGroups.map(subj => (
                  <div
                    key={subj.name}
                    className="sq-subject-row"
                    onClick={() => setActiveFilter(subj.name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setActiveFilter(subj.name)}
                  >
                    <div className="sq-subject-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                    </div>
                    <span className="sq-subject-name">{subj.name}</span>
                    <span className="sq-subject-count">{subj.count}</span>
                    <ChevronSVG />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4" style={{ paddingBottom: filtered.length > 0 ? 96 : 16 }}>
                {/* Sort row */}
                <div className="sq-sort-row">
                  <span style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', fontWeight: 500 }}>
                    {filtered.length} question{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <select
                    className="sq-sort-select"
                    value={sortOrder}
                    onChange={e => setSortOrder(e.target.value)}
                  >
                    <option value="newest">Recent First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="subject">Subject-wise</option>
                    <option value="wrong">Wrong First</option>
                  </select>
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

            {/* Start Revision CTA */}
            {activeFilter !== 'All' && filtered.length > 0 && (
              <div
                className="fixed bottom-[74px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-2 z-40"
                style={{
                  opacity: showCTA ? 1 : 0,
                  transform: showCTA ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
                  transition: 'opacity 0.4s ease, transform 0.4s ease',
                  pointerEvents: showCTA ? 'auto' : 'none',
                }}
              >
                <button
                  onClick={() => setRevisionIdx(0)}
                  className="w-full font-display font-bold text-base text-white active:scale-[0.98] transition-transform"
                  style={{ borderRadius: 18, padding: '16px 0', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FF7A1A, #FF4D00)', boxShadow: '0 10px 28px rgba(255,90,0,0.30)' }}
                >
                  Start Revision: {filtered.length} Question{filtered.length !== 1 ? 's' : ''} &rarr;
                </button>
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
