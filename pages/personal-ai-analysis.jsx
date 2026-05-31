import { useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const ORANGE     = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
const TEAL       = '#14B8A6';
const GOLD       = '#F59E0B';
const GOLD_DIM   = 'rgba(245,158,11,0.15)';
const BG_CARD    = '#172D47';
const BG_DEEP    = '#112236';
const BORDER     = 'rgba(255,255,255,0.08)';
const TEXT_PRI   = '#F0F4F8';
const TEXT_SEC   = '#94A3B8';
const TEXT_MUT   = '#64748B';
const RED_DIM    = 'rgba(239,68,68,0.15)';

const card = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: '18px 20px',
  marginBottom: 16,
};

function ProgressBar({ pct, color = ORANGE, height = 8 }) {
  return (
    <div style={{ background: BG_DEEP, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  );
}

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function PersonalAIAnalysis() {
  const { data: session } = useSession();
  const router = useRouter();
  const [interestRecorded, setInterestRecorded] = useState(false);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const recordInterest = useCallback(async () => {
    setCtaLoading(true);
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
      }
    } catch {}
    finally { setCtaLoading(false); }
  }, []);

  function handleCtaClick() {
    if (!session) { setShowSignIn(true); return; }
    recordInterest();
  }

  function handleSignInClick() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: '/personal-ai-analysis' });
  }

  return (
    <>
      <Head><title>Personal AI Analysis — SSC GK Score Booster</title></Head>

      {/* ── Sticky top bar ── */}
      <div
        className="sticky top-0 z-50 px-4 flex items-center justify-between"
        style={{
          height: '58px',
          background: 'rgba(15,32,52,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(20,184,166,0.18)',
          borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          borderRadius: '0 0 22px 22px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: TEXT_MUT, display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
            </svg>
          </div>
          <span className="font-display font-black text-[17px] leading-none text-white">
            Personal AI Analysis
          </span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em' }}>
          PREMIUM AI
        </span>
      </div>

      <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '20px 16px 100px', boxSizing: 'border-box' }}>

        {/* Practice Gap */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>Practice Gap</span>
          </div>
          <p className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, marginBottom: 18, lineHeight: 1.5 }}>
            Compare your practice with top performers.
          </p>
          {[
            { label: 'Questions',         youVal: '720',  youPct: 47, topVal: '1,536', topPct: 100 },
            { label: 'Practice Days (7d)',youVal: '3/7',  youPct: 43, topVal: '6/7',   topPct: 86  },
            { label: 'Weak-Topic Qs',    youVal: '40',   youPct: 22, topVal: '180',   topPct: 100 },
          ].map(({ label, youVal, youPct, topVal, topPct }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 600, marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, width: 52, flexShrink: 0 }}>You</span>
                <div style={{ flex: 1 }}><ProgressBar pct={youPct} color={ORANGE} height={7} /></div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRI, width: 40, textAlign: 'right', flexShrink: 0 }}>{youVal}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, width: 52, flexShrink: 0 }}>Top 3 Avg</span>
                <div style={{ flex: 1 }}><ProgressBar pct={topPct} color="rgba(99,102,241,0.55)" height={7} /></div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC, width: 40, textAlign: 'right', flexShrink: 0 }}>{topVal}</span>
              </div>
            </div>
          ))}
          <div style={{ background: BG_DEEP, borderRadius: 12, padding: '11px 14px', border: `1px solid ${BORDER}`, marginTop: 4 }}>
            <p className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.55, margin: 0 }}>
              💡 Your biggest gap is focused practice. Start with 2 weak-topic quizzes daily.
            </p>
          </div>
        </div>

        {/* Mistake Patterns */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>Mistake Patterns</span>
          </div>
          {[
            { label: 'Forgotten facts',   pct: 31 },
            { label: 'Concept gaps',      pct: 27 },
            { label: 'Confusing options', pct: 19 },
          ].map(({ label, pct }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: i < 2 ? 10 : 0 }}>
              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC }}>{label}</span>
              <span className="font-sans" style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>{pct}%</span>
            </div>
          ))}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="font-sans" style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>+2 more patterns in full report</span>
          </div>
        </div>

        {/* Recoverable Marks */}
        <div style={{ ...card, textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>Score Opportunity</span>
          </div>
          <div className="font-display" style={{ fontSize: 48, fontWeight: 900, color: ORANGE, lineHeight: 1, marginBottom: 10 }}>18–25</div>
          <div className="font-sans" style={{ fontSize: 13, color: ORANGE, fontWeight: 600, marginBottom: 8 }}>marks recoverable</div>
          <p className="font-sans" style={{ fontSize: 13, color: TEXT_MUT, lineHeight: 1.5 }}>
            Estimated score improvement by fixing repeated GK mistakes.
          </p>
        </div>

        {/* 7-Day Focus Plan */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRI }}>7-Day Focus Plan</span>
          </div>
          {[
            { days: 'Day 1–2', task: 'Polity weak topics'               },
            { days: 'Day 3–4', task: 'Science + Biology basics'         },
            { days: 'Day 5–7', task: 'Wrong questions + mixed weak quiz' },
          ].map(({ days, task }, i) => (
            <div key={days} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 2 ? 14 : 0 }}>
              <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 99, border: `1.5px solid ${ORANGE}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>{days}</span>
                <p className="font-sans" style={{ fontSize: 13, color: TEXT_PRI, margin: '2px 0 0', lineHeight: 1.4 }}>{task}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Coach Recommendation */}
        <div style={{
          ...card,
          background: 'linear-gradient(140deg, #0e2440 0%, #0d1b2e 100%)',
          border: '1px solid rgba(20,184,166,0.35)',
          boxShadow: '0 0 24px rgba(20,184,166,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
              </svg>
            </div>
            <div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>AI Coach Recommendation</div>
              <div className="font-sans" style={{ fontSize: 11, color: TEAL, marginTop: 2 }}>Based on your quiz history</div>
            </div>
          </div>
          <div style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 12, padding: '13px 14px' }}>
            <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.6, margin: 0 }}>
              Focus on <span style={{ color: ORANGE, fontWeight: 700 }}>Polity</span> and <span style={{ color: ORANGE, fontWeight: 700 }}>Biology</span> this week. Target 2 weak-topic quizzes daily to recover <span style={{ color: TEAL, fontWeight: 700 }}>18–25 marks</span> before your exam.
            </p>
          </div>
        </div>

        {/* Join Interest List CTA */}
        <div style={{
          ...card,
          background: 'linear-gradient(160deg, #1E3554 0%, #172D47 60%, #112236 100%)',
          border: `1px solid ${ORANGE}30`,
          marginBottom: 0,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="font-sans" style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '0.04em' }}>PREMIUM AI FEATURE</span>
            </div>
            <div style={{ background: GOLD_DIM, border: `1px solid ${GOLD}50`, borderRadius: 99, padding: '2px 8px' }}>
              <span className="font-sans" style={{ fontSize: 9, fontWeight: 700, color: GOLD, letterSpacing: '0.05em' }}>COMING SOON</span>
            </div>
          </div>

          {interestRecorded ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: 99, margin: '0 auto 12px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: TEAL, marginBottom: 6 }}>You&apos;re on the list!</div>
              <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>We&apos;ll notify you when personal AI analysis is ready.</p>
            </div>
          ) : showSignIn ? (
            <div>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI, marginBottom: 10 }}>Sign in to join the interest list</div>
              <button onClick={handleSignInClick} style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#FFFFFF', color: '#0F172A', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                <GoogleSVG />Sign in with Google
              </button>
              <button onClick={() => setShowSignIn(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 12, width: '100%', marginTop: 10, padding: '4px 0', fontFamily: 'inherit' }}>Maybe later</button>
            </div>
          ) : (
            <div>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRI, marginBottom: 10, lineHeight: 1.3 }}>
                Want this for your own quiz history?
              </div>
              <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 16 }}>
                Personal AI analysis will use your quiz history to show weak topics, strong topics, and what to practice next.
              </p>
              <button
                onClick={handleCtaClick}
                disabled={ctaLoading}
                className={ctaLoading ? '' : 'btn-daily-pulse'}
                style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: ctaLoading ? 'rgba(255,107,22,0.5)' : ORANGE, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: ctaLoading ? 'default' : 'pointer', fontFamily: 'inherit' }}
              >
                {ctaLoading ? 'Recording…' : 'Unlock My Personal Analysis →'}
              </button>
              <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>No payment now. Join interest list only.</p>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
