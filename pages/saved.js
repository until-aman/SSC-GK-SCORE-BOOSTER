import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import { getSavedQuestions } from '@/lib/data/savedData';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS   = ['optionA', 'optionB', 'optionC', 'optionD'];

/* ── Helpers ──────────────────────────────────────────────────────────── */
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

/* ── Compact list card ────────────────────────────────────────────────── */
function QuestionRow({ q, index, onView, onUnsave }) {
  const savedLabel = formatSavedDate(q.savedAt || q.createdAt);
  return (
    <div style={{
      background: '#131D2E', border: '1px solid rgba(148,163,184,0.10)',
      borderRadius: 18, padding: '14px 16px', marginBottom: 10,
    }}>
      {/* Subject • Topic */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {q.subject && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.10)', borderRadius: 99, padding: '2px 9px' }}>
            {getDisplaySubject(q.subject, q.collection)}
          </span>
        )}
        {q.topic && (
          <>
            <span style={{ fontSize: 10, color: '#334155' }}>•</span>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{q.topic}</span>
          </>
        )}
      </div>

      {/* Question preview — 2 lines */}
      <p style={{
        fontSize: 14, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.45,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '0 0 12px',
      }}>
        {q.question}
      </p>

      {/* Footer: saved date + View → */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#475569' }}>{savedLabel || 'Saved'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onUnsave(q.questionId)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            title="Remove bookmark"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#334155" stroke="#334155" strokeWidth="1.5" strokeLinecap="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
            </svg>
          </button>
          <button
            onClick={() => onView(index)}
            style={{
              background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: 10, padding: '5px 12px', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: '#94A3B8',
            }}
          >
            View →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Full-screen revision overlay ─────────────────────────────────────── */
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
      style={{ position: 'fixed', inset: 0, background: '#06111F', zIndex: 60, display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
        <button
          onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Saved Revision</p>
          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{idx + 1} / {total}</p>
        </div>
        {/* Spacer keeps title centred */}
        <div style={{ width: 32 }} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 16px' }}>

        {/* Subject • Topic */}
        {(q.subject || q.topic) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {q.subject && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399', background: 'rgba(52,211,153,0.10)', borderRadius: 99, padding: '2px 10px' }}>
                {getDisplaySubject(q.subject, q.collection)}
              </span>
            )}
            {q.topic && (
              <span style={{ fontSize: 11, color: '#475569' }}>{q.topic}</span>
            )}
          </div>
        )}

        {/* Question */}
        <p className="t-body" style={{ color: '#F8FAFC', fontWeight: 700, marginBottom: 20 }}>
          {q.question}
        </p>

        {/* Options — tappable before reveal */}
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
              rowBg = 'rgba(52,211,153,0.10)'; rowBorder = 'rgba(52,211,153,0.35)';
              textColor = '#34D399'; dotBg = '#34D399'; dotColor = '#0F172A';
            } else if (isWrong) {
              rowBg = 'rgba(239,68,68,0.10)'; rowBorder = 'rgba(239,68,68,0.35)';
              textColor = '#FCA5A5'; dotBg = 'rgba(239,68,68,0.65)'; dotColor = '#FFF';
            } else if (isSelected) {
              rowBg = 'rgba(99,102,241,0.12)'; rowBorder = 'rgba(99,102,241,0.50)';
              textColor = '#C7D2FE'; dotBg = 'rgba(99,102,241,0.70)'; dotColor = '#FFF';
            } else {
              rowBg = 'rgba(255,255,255,0.04)'; rowBorder = 'rgba(148,163,184,0.10)';
              textColor = '#94A3B8'; dotBg = 'rgba(148,163,184,0.15)'; dotColor = '#64748B';
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
                  borderRadius: 14, padding: '12px 14px', width: '100%', textAlign: 'left',
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
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                {isWrong && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Correct / Wrong result badge — shown after reveal when user picked an option */}
        {revealed && selectedOption && (
          <div style={{
            textAlign: 'center', marginBottom: 14,
            fontSize: 14, fontWeight: 700,
            color: selectedOption === q.correctOption ? '#34D399' : '#FCA5A5',
          }}>
            {selectedOption === q.correctOption
              ? '✓ Correct!'
              : `✗ Incorrect — answer is ${q.correctOption}`}
          </div>
        )}

        {/* Show / Check Answer button — hidden once revealed */}
        {!revealed && (
          <button
            onClick={handleReveal}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              border: 'none', cursor: 'pointer',
              background: selectedOption
                ? 'linear-gradient(135deg, #FF7A1A, #FF5A00)'
                : 'linear-gradient(135deg, #1E40AF, #2563EB)',
              color: '#FFFFFF', fontSize: 16, fontWeight: 700,
              marginBottom: 8,
              transition: 'background 200ms ease',
            }}
          >
            {selectedOption ? 'Check Answer →' : 'Show Answer'}
          </button>
        )}

        {/* Answer + explanation — shown after reveal */}
        {revealed && (
          <>
            <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.22)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#34D399', marginBottom: q.explanation ? 10 : 0 }}>
                Correct Answer: {q.correctOption}
              </p>
              {q.explanation && (
                <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.65, margin: 0 }}>
                  {q.explanation}
                </p>
              )}
            </div>

            {/* Secondary actions — muted, not loud */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, paddingBottom: 8 }}>
              <button
                onClick={() => onUnsave(q.questionId)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#334155', fontWeight: 500 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#334155" stroke="none" strokeLinecap="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
                </svg>
                Remove from Saved
              </button>
              <button
                onClick={handleMarkRevised}
                disabled={markedDone}
                style={{ background: 'none', border: 'none', cursor: markedDone ? 'default' : 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: markedDone ? '#34D399' : '#334155', fontWeight: 500 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={markedDone ? '#34D399' : '#334155'} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {markedDone ? 'Marked as Revised' : 'Mark as Revised'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer nav — Previous | Next */}
      <div style={{ padding: '10px 16px 32px', flexShrink: 0, borderTop: '1px solid rgba(148,163,184,0.10)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={goPrev}
          disabled={idx === 0}
          style={{
            flex: 1, height: 48, borderRadius: 14,
            cursor: idx === 0 ? 'default' : 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(148,163,184,0.12)',
            color: idx === 0 ? '#1E293B' : '#F8FAFC',
            fontSize: 14, fontWeight: 700,
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
              ? 'rgba(255,255,255,0.04)'
              : 'linear-gradient(135deg, #FF7A1A, #FF5A00)',
            border: idx === total - 1 ? '1px solid rgba(148,163,184,0.12)' : 'none',
            color: idx === total - 1 ? '#1E293B' : '#FFFFFF',
            fontSize: 14, fontWeight: 700,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default function Saved() {
  const { status } = useSession();
  const router = useRouter();
  const [questions, setQuestions]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [revisionIdx, setRevisionIdx] = useState(null); // null = list, number = revision overlay
  const [searchQuery, setSearchQuery]   = useState('');
  const [sortOrder, setSortOrder]       = useState('newest');
  const [revisedIds, setRevisedIds]     = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(20);
  const sentinelRef = useRef(null);

  const isLoggedIn = status === 'authenticated';
  const isGuest    = status === 'unauthenticated';

  // ── Load questions ────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;

    getSavedQuestions({ isLoggedIn })
      .then(result => {
        const saved = Array.isArray(result) ? result : result.data?.saved || [];
        setQuestions(saved);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, isLoggedIn]);

  // ── Load revised IDs ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ssc_revised_questions');
      setRevisedIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {}
  }, []);

  // ── Unsave ────────────────────────────────────────────────────────────
  const handleUnsave = useCallback(async (questionId) => {
    const updated = questions.filter(q => q.questionId !== questionId);
    setQuestions(updated);
    if (updated.length === 0) setRevisionIdx(null);

    if (isLoggedIn) {
      try {
        await fetch('/api/saved-questions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId }),
        });
      } catch {
        // Best-effort; list already updated optimistically
      }
    } else {
      try { localStorage.setItem('ssc_saved_questions', JSON.stringify(updated)); } catch {}
    }
  }, [isLoggedIn, questions]);

  // ── Mark as revised ───────────────────────────────────────────────────
  function markRevised(questionId) {
    setRevisedIds(prev => {
      const next = new Set(prev);
      next.add(questionId);
      try { localStorage.setItem('ssc_revised_questions', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // ── Reset visible count when filters/search/sort change ──────────────
  useEffect(() => { setVisibleCount(20); }, [searchQuery, activeFilter, sortOrder, questions]);

  // ── Infinite scroll sentinel ──────────────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + 20); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }); // intentionally no deps — re-attaches after each render so sentinel stays tracked

  // ── Practice all ─────────────────────────────────────────────────────
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
    router.push(`/quiz?mode=saved&count=${quizQuestions.length}`);
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  const unrevisedCount = questions.filter(q => !revisedIds.has(q.questionId)).length;
  const wrongCount     = questions.filter(q => q.userAnswer && q.userAnswer !== q.correctOption).length;

  // ── Filter + search + sort ────────────────────────────────────────────
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

  // ── Loading ───────────────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] pb-24">
        <div className="px-4 pt-8 pb-3">
          <h1 className="t-page-title font-display text-white">Saved Questions</h1>
          <p className="t-page-subtitle font-sans text-slate-400">Build your personal revision bank</p>
        </div>
        <div className="px-4">
          <Loader card size="md" label="Fetching your saved questions…" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Head><title>Saved Questions — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-24">

        {/* Header */}
        <div className="px-4 pt-8 pb-3">
          <div className="flex items-center gap-2.5">
            <h1 className="t-page-title font-display text-white">Saved Questions</h1>
            {questions.length > 0 && (
              <span className="t-badge bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-0.5 font-display text-emerald-400">
                {questions.length}
              </span>
            )}
          </div>
          <p className="t-page-subtitle font-sans text-slate-400">Build your personal revision bank</p>
        </div>

        {/* Guest sign-in banner */}
        {isGuest && questions.length > 0 && (
          <GoogleSignInCard
            className="mx-4 mb-3"
            title="Sync across devices"
            subtitle="Back up & sync your questions"
            buttonText="Sign in"
            callbackUrl="/saved"
          />
        )}

        {questions.length === 0 ? (
          /* ── Empty state ── */
          <>
          <style>{`
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
              background: 'rgba(139, 92, 246, 0.14)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
              </svg>
            </div>
            <p className="font-display font-bold text-lg text-white text-center">No saved questions yet</p>
            <p className="font-sans font-medium text-sm text-slate-400 text-center max-w-[260px] leading-relaxed">
              Save tough questions while practicing and revise them later.
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-[300px]">
              {[
                { emoji: '🔖', title: 'During Quiz',   desc: 'Tap bookmark on any question' },
                { emoji: '📊', title: 'After Quiz',    desc: 'Save questions from Detailed Analysis' },
              ].map(({ emoji, title, desc }) => (
                <div key={title} style={{
                  background: 'rgba(31, 41, 55, 0.65)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                  borderRadius: 16, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{emoji}</span>
                  <div>
                    <p className="font-display font-bold text-xs text-white leading-none mb-1">{title}</p>
                    <p className="font-sans text-xs text-slate-400 leading-snug">{desc}</p>
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
              Start Practice →
            </button>

            {/* Why save questions? */}
            <div style={{
              alignSelf: 'stretch',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.12)',
              borderRadius: 18,
              padding: '14px 16px',
              marginTop: 4,
            }}>
              <p className="font-display font-bold text-xs text-slate-300 mb-1">💡 Why save questions?</p>
              <p className="font-sans text-xs text-slate-500 leading-relaxed">
                Revise only the questions you found tricky instead of repeating everything.
              </p>
            </div>
          </div>
          </>
        ) : (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 8, paddingLeft: 16, paddingRight: 16, marginBottom: 14 }}>
              <div style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#F8FAFC' }}>{questions.length}</span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Saved</span>
              </div>
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FCD34D' }}>{unrevisedCount}</span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Unrevised</span>
              </div>
              {wrongCount > 0 && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#FCA5A5' }}>{wrongCount}</span>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Wrong</span>
                </div>
              )}
            </div>

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
                    background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(148,163,184,0.14)',
                    borderRadius: 14, fontSize: 13, color: '#E2E8F0',
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
              style={{ paddingLeft: 16, paddingRight: 16, marginBottom: 6, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filterChips.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className="flex-shrink-0"
                  style={{
                    borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: activeFilter === key ? '#10B981' : 'rgba(30,41,59,0.8)',
                    color: activeFilter === key ? '#fff' : '#64748B',
                    border: activeFilter === key ? 'none' : '1px solid rgba(148,163,184,0.14)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Count + sort row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                {filtered.length} question{filtered.length !== 1 ? 's' : ''}
              </span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                style={{
                  background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(148,163,184,0.14)',
                  borderRadius: 10, padding: '5px 10px', fontSize: 11, color: '#94A3B8',
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
                <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.10)', borderRadius: 16, padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
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
                  {/* Sentinel — triggers next page when scrolled into view */}
                  {visibleCount < filtered.length && (
                    <div ref={sentinelRef} style={{ padding: '12px 0', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: '#334155' }}>
                        Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Start Revision CTA — sticky above bottom nav */}
            {filtered.length > 0 && (
              <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-2 z-40">
                <button
                  onClick={() => setRevisionIdx(0)}
                  className="w-full font-display font-bold text-base text-white active:scale-[0.98] transition-transform"
                  style={{ borderRadius: 18, padding: '16px 0', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #FF7A1A, #FF4D00)', boxShadow: '0 10px 28px rgba(255,90,0,0.30)' }}
                >
                  Start Revision: {filtered.length} Question{filtered.length !== 1 ? 's' : ''} →
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
