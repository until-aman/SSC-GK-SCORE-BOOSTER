import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ── Design tokens (match existing app) ──────────────────────────────────
const ORANGE     = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
const TEAL       = '#14B8A6';
const GOLD       = '#F59E0B';
const RED_DIM    = 'rgba(239,68,68,0.15)';
const GOLD_DIM   = 'rgba(245,158,11,0.15)';
const BG_CARD    = '#172D47';
const BG_DEEP    = '#112236';
const BORDER     = 'rgba(255,255,255,0.08)';
const TEXT_PRI   = '#F0F4F8';
const TEXT_SEC   = '#94A3B8';
const TEXT_MUT   = '#64748B';

const card = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: '18px 20px',
  marginBottom: 16,
};

// ── Inline Google SVG (matches GoogleSignInCard.js) ─────────────────────
const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// ── Small reusable components ────────────────────────────────────────────
function Badge({ children, color = ORANGE, bg = ORANGE_DIM }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color,
      background: bg, borderRadius: 99,
      padding: '3px 10px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function ProgressBar({ pct, color = ORANGE, height = 8 }) {
  return (
    <div style={{ background: BG_DEEP, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, pct)}%`, height: '100%',
        background: color, borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

// ── Subject health data (static) ─────────────────────────────────────────
const SUBJECTS = [
  { name: 'Polity',           acc: 78, attempted: 145, target: 85, need: 30,  focus: 'Judiciary + Preamble',            status: 'Strong',   impact: 'Helping score' },
  { name: 'Modern History',   acc: 61, attempted:  98, target: 70, need: 60,  focus: 'Independence Movement + INC',     status: 'Improve',  impact: 'Hurting score' },
  { name: 'Ancient History',  acc: 69, attempted:  82, target: 75, need: 50,  focus: 'Vedic Period + Maurya Empire',    status: 'Good',     impact: 'Helping score' },
  { name: 'Medieval History', acc: 46, attempted:  64, target: 55, need: 80,  focus: 'Delhi Sultanate + Mughal Empire', status: 'Weak',     impact: 'Hurting score' },
  { name: 'Biology',          acc: 43, attempted:  76, target: 55, need: 90,  focus: 'Human Diseases + Nutrition',      status: 'Weak',     impact: 'Hurting score' },
  { name: 'Chemistry',        acc: 38, attempted:  55, target: 50, need: 100, focus: 'Periodic Table + Basic Reactions',status: 'Critical', impact: 'Hurting score' },
  { name: 'Physics',          acc: 55, attempted:  88, target: 65, need: 70,  focus: 'Laws of Motion + Electricity',    status: 'Improve',  impact: 'Hurting score' },
  { name: 'Geography',        acc: 74, attempted: 112, target: 82, need: 35,  focus: 'Indian Rivers + Climate',         status: 'Strong',   impact: 'Helping score' },
  { name: 'Economy',          acc: 59, attempted:  70, target: 68, need: 65,  focus: 'Budget + RBI Functions',          status: 'Improve',  impact: 'Hurting score' },
  { name: 'Static GK',        acc: 68, attempted:  90, target: 76, need: 45,  focus: 'State Capitals + Important Days', status: 'Good',     impact: 'Helping score' },
];
const STATUS_COLOR = { Strong: '#14B8A6', Good: '#6366F1', Improve: '#F59E0B', Weak: '#FF6B16', Critical: '#EF4444' };
const STATUS_BG    = { Strong: 'rgba(20,184,166,0.15)', Good: 'rgba(99,102,241,0.15)', Improve: 'rgba(245,158,11,0.15)', Weak: 'rgba(255,107,22,0.15)', Critical: 'rgba(239,68,68,0.15)' };

// ── Topic data (static) ──────────────────────────────────────────────────
const TOPICS = [
  { subject: 'Polity',        name: 'Judiciary',              acc: 56, attempted: 38, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Polity',        name: 'Fundamental Rights',     acc: 48, attempted: 42, tags: ['Weak Topics',  'High SSC Weightage'] },
  { subject: 'Polity',        name: 'Directive Principles',   acc: 52, attempted: 28, tags: ['Improve Fast'] },
  { subject: 'Modern History',name: 'Indian Natl. Congress',  acc: 58, attempted: 31, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Medieval History',name:'Delhi Sultanate',       acc: 44, attempted: 22, tags: ['Weak Topics'] },
  { subject: 'Biology',       name: 'Human Diseases',         acc: 41, attempted: 34, tags: ['Weak Topics',  'High SSC Weightage'] },
  { subject: 'Biology',       name: 'Photosynthesis',         acc: 82, attempted: 45, tags: ['Strong Topics'] },
  { subject: 'Geography',     name: 'Indian Rivers',          acc: 76, attempted: 52, tags: ['Strong Topics', 'High SSC Weightage'] },
  { subject: 'Economy',       name: 'Budget & Fiscal Policy', acc: 54, attempted: 29, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Medieval History',name:'Mughal Empire',         acc: 43, attempted: 18, tags: ['Weak Topics'] },
  { subject: 'Polity',        name: 'Indian Constitution',    acc: 79, attempted: 61, tags: ['Strong Topics', 'High SSC Weightage'] },
  { subject: 'Chemistry',     name: 'Periodic Table',         acc: 35, attempted: 24, tags: ['Weak Topics'] },
  { subject: 'Physics',       name: 'Laws of Motion',         acc: 53, attempted: 33, tags: ['Improve Fast'] },
  { subject: 'Geography',     name: 'Climate of India',       acc: 71, attempted: 47, tags: ['Strong Topics', 'High SSC Weightage'] },
];

const TAG_COLOR = {
  'Improve Fast':       { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  'Weak Topics':        { color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
  'Strong Topics':      { color: '#14B8A6', bg: 'rgba(20,184,166,0.15)' },
  'High SSC Weightage': { color: '#6366F1', bg: 'rgba(99,102,241,0.15)' },
};

// ── Main page ────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [interestRecorded, setInterestRecorded] = useState(false);
  const [ctaLoading,       setCtaLoading]       = useState(false);
  const [ctaError,         setCtaError]         = useState('');
  const [showSignIn,       setShowSignIn]       = useState(false);
  const [selectedSubject,  setSelectedSubject]  = useState(null);
  const [activeFilter,     setActiveFilter]     = useState('Improve Fast');

  const practiceGapRef = useRef(null);
  const planRef        = useRef(null);
  const autoCallFired  = useRef(false);

  // ── On mount: read localStorage flag ──────────────────────────────────
  useEffect(() => {
    try {
      if (localStorage.getItem('analysisInterestRecorded') === 'true') {
        setInterestRecorded(true);
      }
    } catch {}
  }, []);

  // ── Analytics: tab opened (fires once session status is known) ─────────
  useEffect(() => {
    if (status === 'loading') return;
    console.log('[Analytics] analysis_tab_opened', {
      userId: session?.user?.email ?? 'guest',
    });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IntersectionObserver for analytics ────────────────────────────────
  useEffect(() => {
    const targets = [
      { ref: practiceGapRef, key: 'practice_gap' },
      { ref: planRef,        key: 'plan'          },
    ];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const found = targets.find(t => t.ref.current === entry.target);
        if (found?.key === 'practice_gap') console.log('[Analytics] analysis_practice_gap_viewed');
        if (found?.key === 'plan')         console.log('[Analytics] analysis_plan_viewed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.3 });

    targets.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, []);

  // ── Auto-record after sign-in redirect ────────────────────────────────
  const recordInterest = useCallback(async () => {
    if (interestRecorded || autoCallFired.current) return;
    autoCallFired.current = true;
    setCtaLoading(true);
    setCtaError('');
    try {
      const res  = await fetch('/api/notify-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: 'AI Analysis' }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.alreadyJoined)) {
        try { localStorage.setItem('analysisInterestRecorded', 'true'); } catch {}
        setInterestRecorded(true);
        console.log('[Analytics] analysis_interest_recorded', {
          email: session?.user?.email,
        });
      } else {
        autoCallFired.current = false;
        setCtaError('Something went wrong. Try again.');
      }
    } catch {
      autoCallFired.current = false;
      setCtaError('Something went wrong. Try again.');
    } finally {
      setCtaLoading(false);
    }
  }, [interestRecorded, session]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (interestRecorded) return;
    if (!router.isReady) return;
    if (router.query.autoRecord !== '1') return;
    recordInterest();
  }, [status, router.isReady, router.query.autoRecord, interestRecorded, recordInterest]);

  // ── CTA click handler ─────────────────────────────────────────────────
  function handleCtaClick() {
    console.log('[Analytics] analysis_cta_clicked', {
      userState: session ? 'logged_in' : 'guest',
    });
    if (!session) {
      console.log('[Analytics] analysis_guest_signin_clicked');
      setShowSignIn(true);
      return;
    }
    recordInterest();
  }

  function handleSignInClick() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: '/analysis?autoRecord=1' });
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>AI Analysis — SSC GK Score Booster</title></Head>

      {/* ── Fixed Top Bar — matches dashboard header exactly ─────── */}
      <div
        className="sticky top-0 z-50 px-4 flex items-center justify-between"
        style={{
          height: '58px',
          background: 'rgba(15,32,52,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(20,184,166,0.18)',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderRadius: '0 0 22px 22px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
        }}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
            </svg>
          </div>
          <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center text-white">
            AI GK Analysis
          </span>
        </div>

        {/* Right: lock icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke={TEXT_MUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: '20px 16px 100px',
        boxSizing: 'border-box',
      }}>

        {/* ── Card 0: Personalized Identity Card ───────────────────── */}
        <div style={{
          ...card,
          marginBottom: 16,
          padding: '14px 16px',
        }}>
          {/* SAMPLE ANALYSIS label */}
          <div className="font-sans" style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUT, letterSpacing: '0.08em', marginBottom: 12 }}>
            SAMPLE ANALYSIS
          </div>

          {/* Top row: avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar — static demo photo */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src="/sakshi.png"
                alt="Sakshi"
                style={{ width: 48, height: 48, borderRadius: 99, objectFit: 'cover', display: 'block' }}
              />
              {/* Coin badge */}
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 18, height: 18, borderRadius: 99,
                background: BG_CARD,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11 }}>🪙</span>
              </div>
            </div>

            {/* Name + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI }}>
                  Sakshi&apos;s Analysis
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: GOLD,
                  background: GOLD_DIM, borderRadius: 99,
                  padding: '2px 7px', flexShrink: 0,
                }}>
                  Demo
                </span>
              </div>
              <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, marginTop: 3 }}>
                Rank #18 · 7-day active learner
              </div>
            </div>
          </div>

          {/* Stat mini-cards */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {[
              { icon: '🏆', label: 'QUIZZES',   value: '42'    },
              { icon: '🎯', label: 'QUESTIONS', value: '720'   },
              { icon: '🪙', label: 'COINS',     value: '1,840' },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                flex: 1, background: BG_DEEP, borderRadius: 12,
                padding: '10px 10px 11px',
                border: `1px solid ${BORDER}`,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              }}>
                <div className="font-sans" style={{ fontSize: 10, fontWeight: 700, color: ORANGE, letterSpacing: '0.04em', marginBottom: 6, whiteSpace: 'nowrap' }}>
                  {icon} {label}
                </div>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRI, lineHeight: 1 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: BORDER, margin: '12px 0' }} />

          {/* Curiosity teaser copy */}
          <p className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, lineHeight: 1.4, marginBottom: 6, margin: '0 0 6px' }}>
            Imagine seeing this for your own quiz history.
          </p>
          <p className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.55, margin: 0 }}>
            Know your weak topics, strongest subjects, and exactly what to practice next.
          </p>
        </div>

        {/* ── Subject Health Carousel ───────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI }}>
              Subject Health
            </span>
            <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>
              Tap a subject →
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {SUBJECTS.map(({ name, acc, status, impact }) => {
              const color      = STATUS_COLOR[status];
              const bgCol      = STATUS_BG[status];
              const isSelected = selectedSubject === name;
              return (
                <div
                  key={name}
                  onClick={() => setSelectedSubject(isSelected ? null : name)}
                  style={{
                    flexShrink: 0, width: 120,
                    background: isSelected ? 'rgba(255,107,22,0.08)' : BG_CARD,
                    border: `1px solid ${isSelected ? ORANGE : BORDER}`,
                    borderRadius: 14, padding: '12px 12px 11px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  {/* Subject name — always 1 line, truncated */}
                  <div className="font-display" style={{
                    fontSize: 13, fontWeight: 700, color: TEXT_PRI,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginBottom: 8,
                  }}>
                    {name}
                  </div>
                  {/* Accuracy */}
                  <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, marginBottom: 6 }}>
                    {acc}%
                  </div>
                  {/* Status badge */}
                  <div style={{ marginBottom: 7 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color, background: bgCol, borderRadius: 99, padding: '2px 8px' }}>
                      {status}
                    </span>
                  </div>
                  {/* Impact line */}
                  <div className="font-sans" style={{ fontSize: 10, color: impact === 'Helping score' ? '#14B8A6' : '#EF4444', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ flexShrink: 0 }}>{impact === 'Helping score' ? '↑' : '↓'}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{impact}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Selected Subject Summary Card ─────────────────────────── */}
        {(() => {
          const subj = SUBJECTS.find(s => s.name === selectedSubject);
          if (!subj) return null;
          const color = STATUS_COLOR[subj.status];
          const bgCol = STATUS_BG[subj.status];
          return (
            <div style={{
              ...card,
              border: `1px solid ${color}40`,
              background: 'linear-gradient(135deg, #1E3554 0%, #172D47 100%)',
              marginBottom: 16,
            }}>
              {/* Subject name + badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRI }}>
                  {subj.name}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color, background: bgCol, borderRadius: 99, padding: '3px 10px' }}>
                  {subj.status}
                </span>
              </div>

              {/* Accuracy → Target */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="font-display" style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>
                  {subj.acc}%
                </span>
                <span className="font-sans" style={{ fontSize: 13, color: TEXT_MUT }}>accuracy</span>
                <span className="font-sans" style={{ fontSize: 13, color: TEXT_MUT }}>→</span>
                <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>Target {subj.target}%</span>
              </div>

              {/* Need + Focus rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT, width: 48, flexShrink: 0 }}>Need:</span>
                  <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>{subj.need} more questions</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT, width: 48, flexShrink: 0 }}>Focus:</span>
                  <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>{subj.focus}</span>
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(subj.name)}&topic=All&count=25`)}
                style={{
                  width: '100%', padding: '12px 0',
                  borderRadius: 12,
                  background: color,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s ease',
                }}
                onPointerDown={e => { e.currentTarget.style.opacity = '0.8'; }}
                onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                Practice {subj.name} →
              </button>
            </div>
          );
        })()}

        {/* ── Topic Filter Chips ────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {['Improve Fast', 'Weak Topics', 'Strong Topics', 'High SSC Weightage'].map(filter => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 99,
                  border: `1px solid ${active ? ORANGE : BORDER}`,
                  background: active ? ORANGE : BG_CARD,
                  color: active ? '#fff' : TEXT_SEC,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* ── Topic Cards ───────────────────────────────────────────── */}
        {(() => {
          const filtered = TOPICS.filter(t => t.tags.includes(activeFilter));
          if (filtered.length === 0) return null;
          return (
            <div style={{ marginBottom: 16 }}>
              {filtered.map(({ subject, name, acc, attempted, tags }) => (
                <div key={name} style={{
                  ...card,
                  marginBottom: 10,
                  padding: '14px 16px',
                }}>
                  {/* Topic name + accuracy row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, marginBottom: 3 }}>
                        {name}
                      </div>
                      <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT }}>
                        <span style={{ color: acc >= 70 ? '#14B8A6' : acc >= 55 ? '#F59E0B' : '#EF4444', fontWeight: 700 }}>
                          {acc}%
                        </span>
                        {' accuracy · '}{attempted} questions attempted
                      </div>
                    </div>
                    {/* Accuracy ring */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 99, flexShrink: 0,
                      background: `conic-gradient(${acc >= 70 ? '#14B8A6' : acc >= 55 ? '#F59E0B' : '#EF4444'} ${acc * 3.6}deg, #1a2e44 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 99, background: BG_CARD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="font-sans" style={{ fontSize: 9, fontWeight: 700, color: TEXT_SEC }}>{acc}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 10, fontWeight: 700,
                        color: TAG_COLOR[tag].color,
                        background: TAG_COLOR[tag].bg,
                        borderRadius: 99, padding: '2px 8px',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA button */}
                  <button
                    onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(name)}&count=25`)}
                    style={{
                      width: '100%', padding: '11px 0',
                      borderRadius: 12,
                      background: ORANGE_DIM,
                      border: `1px solid ${ORANGE}40`,
                      color: ORANGE,
                      fontSize: 13, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'background 0.15s ease',
                    }}
                    onPointerDown={e => { e.currentTarget.style.background = `rgba(255,107,22,0.25)`; }}
                    onPointerUp={e => { e.currentTarget.style.background = ORANGE_DIM; }}
                    onPointerLeave={e => { e.currentTarget.style.background = ORANGE_DIM; }}
                  >
                    Practice 25 Questions →
                  </button>
                </div>
              ))}
            </div>
          );
        })()}




        {/* ── Inline CTA: after Practice Gap ───────────────────────── */}
        {!interestRecorded && (
          <div style={{
            ...card,
            background: 'linear-gradient(135deg, #1E3554 0%, #172D47 100%)',
            border: `1px solid ${ORANGE}30`,
            padding: '16px 18px',
          }}>
            <p className="font-sans" style={{
              fontSize: 13, color: TEXT_SEC, lineHeight: 1.45,
              margin: '0 0 12px',
            }}>
              Want this analysis for your own quiz history?
            </p>
            <button
              onClick={handleCtaClick}
              disabled={ctaLoading}
              className={ctaLoading ? '' : 'btn-daily-pulse'}
              style={{
                width: '100%',
                padding: '15px 0',
                borderRadius: 14,
                background: ctaLoading ? 'rgba(255,107,22,0.5)' : ORANGE,
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 800,
                cursor: ctaLoading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'transform 150ms ease',
                opacity: ctaLoading ? 0.6 : 1,
              }}
              onPointerDown={e => { if (!ctaLoading) e.currentTarget.style.transform = 'scale(0.98)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {ctaLoading ? 'Recording…' : 'Unlock My Personal Analysis →'}
            </button>
          </div>
        )}


        {/* ── AI Personal Analysis — Premium Card ───────────────────── */}
        <div style={{
          background: 'linear-gradient(140deg, #0e2440 0%, #0d1b2e 100%)',
          border: '1px solid rgba(20,184,166,0.4)',
          borderRadius: 20,
          padding: '20px 18px 18px',
          marginBottom: 16,
          boxShadow: '0 0 28px rgba(20,184,166,0.12), 0 4px 20px rgba(0,0,0,0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 99, background: 'rgba(20,184,166,0.08)', filter: 'blur(24px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 99, padding: '3px 10px', letterSpacing: '0.06em' }}>PREMIUM AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(20,184,166,0.2)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
              </svg>
            </div>
            <span className="font-display" style={{ fontSize: 17, fontWeight: 900, color: TEXT_PRI }}>Personal AI Analysis</span>
          </div>
          <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.6, margin: '0 0 18px' }}>
            See how AI identifies your weak areas and suggests what to practice next.
          </p>
          <button onClick={() => router.push('/personal-ai-analysis')} className="btn-daily-pulse" style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: TEAL, border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            Tap to Preview →
          </button>
        </div>

        {/* ── Advanced Insights Carousel ────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI }}>
              Advanced Insights
            </span>
            <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>Swipe →</span>
          </div>

          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 4 }}>
            {[
              {
                icon: '📊',
                title: 'Practice Gap',
                body: 'Aman practiced 720 questions. Top learners practice 1,500+.',
                cta: 'Practice More',
                color: '#6366F1',
                bg: 'rgba(99,102,241,0.12)',
                route: `/quiz-setup?subject=Polity&topic=All&count=25`,
              },
              {
                icon: '🔍',
                title: 'Mistake Pattern',
                body: 'Most mistakes are coming from Biology and Chemistry.',
                cta: 'Fix Weak Topics',
                color: '#EF4444',
                bg: 'rgba(239,68,68,0.10)',
                route: `/quiz-setup?subject=Biology&topic=Human Diseases&count=25`,
              },
              {
                icon: '📅',
                title: '7-Day Focus Plan',
                body: 'Practice 2 weak topics daily for 7 days to recover 18–25 marks.',
                cta: 'Start Plan',
                color: ORANGE,
                bg: ORANGE_DIM,
                route: `/quiz-setup?subject=Polity&topic=Fundamental Rights&count=25`,
              },
            ].map(({ icon, title, body, cta, color, bg, route }) => (
              <div key={title} style={{
                flexShrink: 0,
                width: 240,
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                padding: '16px 16px 14px',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Icon + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <span className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>
                    {title}
                  </span>
                </div>

                {/* Body */}
                <p className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.55, margin: '0 0 14px', flex: 1 }}>
                  {body}
                </p>

                {/* CTA */}
                <button
                  onClick={() => router.push(route)}
                  style={{
                    width: '100%', padding: '9px 0',
                    borderRadius: 10,
                    background: bg,
                    border: `1px solid ${color}40`,
                    color, fontSize: 12, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'opacity 0.15s ease',
                  }}
                  onPointerDown={e => { e.currentTarget.style.opacity = '0.75'; }}
                  onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                  onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {cta} →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Locked Personal Insight Card ──────────────────────────── */}
        <div style={{
          ...card,
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid rgba(255,107,22,0.25)`,
          marginBottom: 16,
        }}>
          {/* Blurred content behind */}
          <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.45 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: '#EF4444', flexShrink: 0 }} />
              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC }}>Repeated mistake topic #1</span>
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>38%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: '#EF4444', flexShrink: 0 }} />
              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC }}>Repeated mistake topic #2</span>
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>42%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: GOLD, flexShrink: 0 }} />
              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC }}>Repeated mistake topic #3</span>
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>51%</span>
            </div>
          </div>

          {/* Lock overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,22,38,0.72)',
            backdropFilter: 'blur(2px)',
            padding: '16px 20px',
            textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 99, marginBottom: 10,
              background: ORANGE_DIM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, marginBottom: 6 }}>
              Your Personal Insight is Locked
            </div>
            <p className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.5, margin: 0 }}>
              &ldquo;You may be losing marks in 3 repeated topics.&rdquo;
              <br />
              <span style={{ color: TEXT_MUT }}>Unlock personal analysis to see them.</span>
            </p>
          </div>
        </div>

        {/* ── Card 9: Premium CTA ───────────────────────────────────── */}
        <div style={{
          ...card,
          background: 'linear-gradient(160deg, #1E3554 0%, #172D47 60%, #112236 100%)',
          border: `1px solid ${ORANGE}30`,
          marginBottom: 0,
          position: 'relative',
        }}>

          {/* ── State B: already recorded ─────────────────────────── */}
          {interestRecorded ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 99, margin: '0 auto 12px',
                background: 'rgba(20,184,166,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: TEAL, marginBottom: 6 }}>
                You&apos;re on the list!
              </div>
              <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 16 }}>
                We&apos;ll notify you when personalized AI analysis is ready for your quiz history.
              </p>
              <button disabled style={{
                width: '100%', padding: '14px 0', borderRadius: 14,
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`,
                color: TEXT_MUT, fontSize: 15, fontWeight: 700,
                cursor: 'default', fontFamily: 'inherit',
              }}>
                Interest Recorded ✓
              </button>
            </div>

          ) : showSignIn ? (
            /* ── State C: guest sign-in prompt ──────────────────── */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 99, flexShrink: 0,
                  background: ORANGE_DIM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI }}>
                    Sign in to join the interest list
                  </div>
                  <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, marginTop: 2 }}>
                    We&apos;ll notify you when AI analysis goes live.
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignInClick}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14,
                  background: '#FFFFFF', color: '#0F172A',
                  border: 'none', fontSize: 15, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, fontFamily: 'inherit',
                  transition: 'transform 150ms ease',
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <GoogleSVG />
                Sign in with Google
              </button>
              <button
                onClick={() => setShowSignIn(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: TEXT_MUT, fontSize: 12, width: '100%',
                  marginTop: 10, padding: '4px 0', fontFamily: 'inherit',
                }}
              >
                Maybe later
              </button>
            </div>

          ) : (
            /* ── State A: default CTA ────────────────────────────── */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '0.04em' }}>
                    PREMIUM AI FEATURE
                  </span>
                </div>
                <div style={{
                  background: GOLD_DIM,
                  border: `1px solid ${GOLD}50`,
                  borderRadius: 99,
                  padding: '2px 8px',
                }}>
                  <span className="font-sans" style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.05em' }}>
                    COMING SOON
                  </span>
                </div>
              </div>

              <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRI, marginBottom: 10, lineHeight: 1.3 }}>
                Want this for your own quiz history?
              </div>

              <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 12 }}>
                Personal AI analysis will use your quiz history to show weak topics, strong topics, and what to practice next.
              </p>

              {/* Social proof */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '9px 12px',
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💬</span>
                <p className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                  Students who practice with topic-level insights improve faster than random practice.
                </p>
              </div>

              {ctaError && (
                <p className="font-sans" style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>
                  {ctaError}
                </p>
              )}

              <button
                onClick={handleCtaClick}
                disabled={ctaLoading}
                className={ctaLoading ? '' : 'btn-daily-pulse'}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 14,
                  background: ctaLoading ? 'rgba(255,107,22,0.5)' : ORANGE,
                  color: '#fff', border: 'none',
                  fontSize: 15, fontWeight: 800, cursor: ctaLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'transform 150ms ease, background 200ms ease',
                }}
                onPointerDown={e => { if (!ctaLoading) e.currentTarget.style.transform = 'scale(0.98)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                {ctaLoading ? 'Recording…' : 'Unlock My Personal Analysis →'}
              </button>

              <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>
                No payment now. Join interest list only.
              </p>
            </div>
          )}
        </div>

      </div>

    </>
  );
}
