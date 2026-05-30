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

// ── Main page ────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [interestRecorded, setInterestRecorded] = useState(false);
  const [ctaLoading,       setCtaLoading]       = useState(false);
  const [ctaError,         setCtaError]         = useState('');
  const [showSignIn,       setShowSignIn]       = useState(false);

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

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: '20px 16px 100px',
        boxSizing: 'border-box',
      }}>

        {/* ── Card 1: Page Header ────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* BrainCircuit icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: ORANGE_DIM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRI }}>
                  AI GK Analysis
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: GOLD,
                  background: GOLD_DIM, borderRadius: 99,
                  padding: '2px 8px', border: `1px solid ${GOLD}40`,
                }}>
                  PREMIUM PREVIEW
                </span>
              </div>
            </div>
          </div>
          {/* Decorative lock icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={TEXT_MUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        {/* ── Card 2: Hero / Sample Report ──────────────────────────── */}
        <div style={{ ...card, padding: '14px 18px' }}>
          <Badge>📋 Sample Report</Badge>
          <h2 className="font-display" style={{
            fontSize: 18, fontWeight: 800, color: TEXT_PRI,
            margin: '10px 0 6px', lineHeight: 1.3,
          }}>
            Know what to revise next
          </h2>
          <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, margin: '0 0 12px' }}>
            Sample AI report based on :-
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['3,000 Qs', '4 Subjects', '20 Topics'].map((chip, i) => (
              <span key={chip} style={{
                fontSize: 12, fontWeight: 700, color: ORANGE,
                background: ORANGE_DIM, borderRadius: 99,
                padding: '4px 10px', whiteSpace: 'nowrap',
              }}>
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ── Card 3: GK Readiness ──────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              GK Readiness
            </span>
            <Badge color={GOLD} bg={GOLD_DIM}>Needs Focus</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
            <span className="font-display" style={{ fontSize: 36, fontWeight: 900, color: ORANGE, lineHeight: 1 }}>
              58
            </span>
            <span className="font-sans" style={{ fontSize: 16, color: TEXT_SEC }}>/ 100</span>
          </div>

          <ProgressBar pct={58} />

          <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, marginTop: 12, lineHeight: 1.5 }}>
            Your consistency is good, but repeated Polity and Science mistakes are limiting score growth.
          </p>
        </div>

        {/* ── Card 4: Weak Topic Priority ───────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              Weak Topic Priority
            </span>
          </div>

          {[
            { subject: 'Polity',  sub: 'Fundamental Rights', acc: '38%', level: 'Revise First', levelColor: '#EF4444', levelBg: RED_DIM  },
            { subject: 'Science', sub: 'Biology Basics',     acc: '42%', level: 'Revise First', levelColor: '#EF4444', levelBg: RED_DIM  },
            { subject: 'History', sub: 'Modern India',       acc: '56%', level: 'Revise Soon',  levelColor: GOLD,      levelBg: GOLD_DIM },
          ].map(({ subject, sub, acc, level, levelColor, levelBg }, i) => (
            <div key={subject} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: BG_DEEP, borderRadius: 12, padding: '12px 14px',
              marginBottom: i < 2 ? 8 : 0, border: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={levelColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
                <div>
                  <div className="font-sans" style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRI }}>
                    {subject}
                  </div>
                  <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, marginTop: 1 }}>
                    {sub} · {acc} accuracy
                  </div>
                </div>
              </div>
              <Badge color={levelColor} bg={levelBg}>{level}</Badge>
            </div>
          ))}
        </div>

        {/* ── Card 5: Practice Gap ──────────────────────────────────── */}
        <div ref={practiceGapRef} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span className="font-sans" style={{ fontSize: 16 }}>📊</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              Practice Gap
            </span>
          </div>
          <p className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, lineHeight: 1.5, marginBottom: 18 }}>
            Compare your practice pattern with top performers — not to feel behind, but to know what to improve next.
          </p>

          {[
            { label: 'Questions',           youVal: '720',  youPct: 47, topVal: '1,536', topPct: 100 },
            { label: 'Practice Days (7d)',  youVal: '3/7',  youPct: 43, topVal: '6/7',   topPct: 86  },
            { label: 'Weak-Topic Qs',       youVal: '40',   youPct: 22, topVal: '180',   topPct: 100 },
          ].map(({ label, youVal, youPct, topVal, topPct }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 600, marginBottom: 8 }}>
                {label}
              </div>
              {/* You row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, width: 52, flexShrink: 0 }}>You</span>
                <div style={{ flex: 1 }}>
                  <ProgressBar pct={youPct} color={ORANGE} height={7} />
                </div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRI, width: 40, textAlign: 'right', flexShrink: 0 }}>
                  {youVal}
                </span>
              </div>
              {/* Top 3 Avg row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, width: 52, flexShrink: 0 }}>Top 3 Avg</span>
                <div style={{ flex: 1 }}>
                  <ProgressBar pct={topPct} color="rgba(99,102,241,0.55)" height={7} />
                </div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC, width: 40, textAlign: 'right', flexShrink: 0 }}>
                  {topVal}
                </span>
              </div>
            </div>
          ))}

          {/* Mentor note */}
          <div style={{
            background: BG_DEEP, borderRadius: 12, padding: '12px 14px',
            border: `1px solid ${BORDER}`, marginTop: 4,
          }}>
            <p className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.55, margin: 0 }}>
              💡 Your biggest gap is focused practice. Start with 2 weak-topic quizzes daily.
            </p>
          </div>
        </div>

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
              {ctaLoading ? 'Recording…' : 'I Want My GK Analysis →'}
            </button>
          </div>
        )}

        {/* ── Card 6: Mistake Pattern ───────────────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span className="font-sans" style={{ fontSize: 16 }}>🔍</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              Mistake Pattern
            </span>
          </div>

          {[
            { label: 'Forgotten facts',   pct: 31 },
            { label: 'Concept gaps',      pct: 27 },
            { label: 'Confusing options', pct: 19 },
          ].map(({ label, pct }, i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: i < 2 ? 10 : 0,
            }}>
              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC }}>{label}</span>
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>{pct}%</span>
            </div>
          ))}

          <div style={{
            marginTop: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="font-sans" style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>
              +2 more patterns in full report
            </span>
          </div>
        </div>

        {/* ── Card 7: Score Opportunity ─────────────────────────────── */}
        <div style={{ ...card, textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            <span className="font-sans" style={{ fontSize: 16 }}>💡</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              Score Opportunity
            </span>
          </div>
          <div className="font-display" style={{
            fontSize: 48, fontWeight: 900, color: ORANGE,
            lineHeight: 1, marginBottom: 10,
          }}>
            18–25
          </div>
          <div className="font-sans" style={{ fontSize: 13, color: ORANGE, fontWeight: 600, marginBottom: 8 }}>
            marks recoverable
          </div>
          <p className="font-sans" style={{ fontSize: 13, color: TEXT_MUT, lineHeight: 1.5 }}>
            Estimated score improvement by fixing repeated GK mistakes.
          </p>
        </div>

        {/* ── Card 8: 7-Day Focus Plan ──────────────────────────────── */}
        <div ref={planRef} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <span className="font-sans" style={{ fontSize: 16 }}>📅</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>
              7-Day Focus Plan
            </span>
          </div>

          {[
            { days: 'Day 1–2', task: 'Polity weak topics'              },
            { days: 'Day 3–4', task: 'Science + Biology basics'        },
            { days: 'Day 5–7', task: 'Wrong questions + mixed weak quiz' },
          ].map(({ days, task }, i) => (
            <div key={days} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              marginBottom: i < 2 ? 14 : 0,
            }}>
              {/* Outline checkmark */}
              <div style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: 99,
                border: `1.5px solid ${ORANGE}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 1,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>{days}</span>
                <p className="font-sans" style={{ fontSize: 13, color: TEXT_PRI, margin: '2px 0 0', lineHeight: 1.4 }}>
                  {task}
                </p>
              </div>
            </div>
          ))}
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

              <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 16 }}>
                Join the interest list for personalised weak-topic detection and AI study plan.
              </p>

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
                {ctaLoading ? 'Recording…' : 'I Want My GK Analysis →'}
              </button>

              <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>
                No payment now. Only interest validation.
              </p>
            </div>
          )}
        </div>

      </div>

    </>
  );
}
