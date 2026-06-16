import { useState, useEffect, useCallback, useRef } from 'react';
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

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€ Compact list card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function QuestionRow({ q, index, onView, onUnsave }) {
  const savedLabel = formatSavedDate(q.savedAt || q.createdAt);
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onView(index)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(index);
        }
      }}
      style={{
      background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
      borderRadius: 18, padding: '14px 16px', paddingRight: 54, marginBottom: 10,
      position: 'relative', cursor: 'pointer',
      boxShadow: 'var(--ssc-shadow-card)',
    }}>
      <button
        onClick={event => {
          event.stopPropagation();
          onUnsave(q.questionId);
        }}
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 32, height: 32, borderRadius: 12,
          background: 'var(--ssc-teal-soft)',
          border: '1px solid rgba(14,165,164,0.18)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Remove bookmark"
        aria-label="Remove bookmark"
      >
        <BookmarkIcon filled size={15} />
      </button>

      {/* Subject â€¢ Topic */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {q.subject && (
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', borderRadius: 99, padding: '2px 9px' }}>
            {getDisplaySubject(q.subject, q.collection)}
          </span>
        )}
        {q.topic && (
          <>
            <span style={{ fontSize: 10, color: 'var(--ssc-text-muted)' }}>•</span>
            <span style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', fontWeight: 500 }}>{q.topic}</span>
          </>
        )}
      </div>

      {/* Question preview â€” 2 lines */}
      <p style={{
        fontSize: 14, fontWeight: 700, color: 'var(--ssc-text-primary)', lineHeight: 1.45,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '0 0 12px',
      }}>
        {q.question}
      </p>

      {/* Footer: saved date + View â†’ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--ssc-text-muted)' }}>{savedLabel || 'Saved'}</span>
        <span aria-hidden="true" style={{
          width: 28, height: 28, borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)',
          color: 'var(--ssc-teal)', fontSize: 18, fontWeight: 900,
        }}>
          &rsaquo;
        </span>
      </div>
    </article>
  );
}

/* â”€â”€ Full-screen revision overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

        {/* Options â€” tappable before reveal */}
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

        {/* Correct / Wrong result badge â€” shown after reveal when user picked an option */}
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

        {/* Show / Check Answer button â€” hidden once revealed */}
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

        {/* Answer + explanation â€” shown after reveal */}
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

            {/* Secondary actions â€” muted, not loud */}
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

      {/* Footer nav â€” Previous | Next */}
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

  // â”€â”€ Load questions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load revised IDs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ssc_revised_questions');
      setRevisedIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {}
  }, []);

  // â”€â”€ Unsave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleUnsave = useCallback(async (questionId) => {
    const updated = questions.filter(q => q.questionId !== questionId);
    setQuestions(updated);
    if (updated.length === 0) setRevisionIdx(null);

    if (isLoggedIn) {
      // Shared helper (existing DELETE route) â†’ also patches scoped IDs/list
      // caches + marks History caches stale. No list refetch.
      try { await unsaveQuestion({ scope: getUserCacheScope(session), questionId }); } catch { /* optimistic list already updated */ }
    } else {
      try { localStorage.setItem('ssc_saved_questions', JSON.stringify(updated)); } catch {}
    }
  }, [isLoggedIn, questions, session]);

  // â”€â”€ Mark as revised â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function markRevised(questionId) {
    setRevisedIds(prev => {
      const next = new Set(prev);
      next.add(questionId);
      try { localStorage.setItem('ssc_revised_questions', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // â”€â”€ Reset visible count when filters/search/sort change â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { setVisibleCount(20); }, [searchQuery, activeFilter, sortOrder, questions]);

  // â”€â”€ Infinite scroll sentinel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + 20); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }); // intentionally no deps â€” re-attaches after each render so sentinel stays tracked

  // â”€â”€ Practice all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const unrevisedCount = questions.filter(q => !revisedIds.has(q.questionId)).length;
  const wrongCount     = questions.filter(q => q.userAnswer && q.userAnswer !== q.correctOption).length;

  // â”€â”€ Filter + search + sort â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Filter chip definitions
  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject).filter(Boolean)));
  const filterChips = [
    { key: 'All',       label: 'All' },
    { key: 'Unrevised', label: unrevisedCount > 0 ? `Unrevised ${unrevisedCount}` : 'Unrevised' },
    ...(wrongCount > 0 ? [{ key: 'Wrong', label: `Wrong ${wrongCount}` }] : []),
    ...uniqueSubjects.map(s => ({ key: s, label: s })),
  ];

  // â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          /* â”€â”€ Empty state â”€â”€ */
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
            {/* Search bar */}
            <div style={{ paddingLeft: 16, paddingRight: 16, marginBottom: 10 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg style={{ position: 'absolute', left: 12, flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search saved questions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 36px',
                    background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
                    borderRadius: 14, fontSize: 13, color: 'var(--ssc-text-primary)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                {searchQuery.length > 0 && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filter chips + sort */}
            <div
              className="flex gap-2 overflow-x-auto"
              style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 2, paddingBottom: 4, marginBottom: 12, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filterChips.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className="flex-shrink-0"
                  style={{
                    borderRadius: 99, padding: '8px 15px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: activeFilter === key ? 'var(--ssc-teal)' : 'var(--ssc-surface)',
                    color: activeFilter === key ? '#fff' : 'var(--ssc-text-secondary)',
                    border: activeFilter === key ? 'none' : '1px solid var(--ssc-border-soft)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Count + sort row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 16, paddingRight: 16, marginBottom: 18 }}>
              <span style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', fontWeight: 500 }}>
                {filtered.length} question{filtered.length !== 1 ? 's' : ''}
              </span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                style={{
                  background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
                  borderRadius: 12, padding: '8px 12px', minHeight: 36, fontSize: 12, color: 'var(--ssc-text-secondary)',
                  cursor: 'pointer', fontWeight: 600, outline: 'none', fontFamily: 'inherit',
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="subject">Subject-wise</option>
                <option value="wrong">Wrong first</option>
              </select>
            </div>

            {/* Question list */}
            <div className="px-4" style={{ paddingBottom: filtered.length > 0 ? 96 : 16 }}>
              {filtered.length === 0 ? (
                <div style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderRadius: 16, padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', margin: 0 }}>
                    {searchQuery.trim() ? `No questions match "${searchQuery}"` : `No ${activeFilter.toLowerCase()} questions`}
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
                  {/* Sentinel â€” triggers next page when scrolled into view */}
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

            {/* Start Revision CTA â€” sticky above bottom nav */}
            {filtered.length > 0 && (
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
