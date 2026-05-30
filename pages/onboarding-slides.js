import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

const SLIDES = [
  {
    id: 1,
    emoji: '📚',
    iconGradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)',
    bgGlow: 'rgba(79,70,229,0.45)',
    btnGradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)',
    btnGlow: 'rgba(99,102,241,0.45)',
    accentColor: '#93c5fd',
    tag: 'STEP 01',
    title: 'Pick Your Topic',
    desc: 'Practice Polity, History, Geography, Science and more.',
  },
  {
    id: 2,
    emoji: '⏱️',
    iconGradient: 'linear-gradient(135deg,#f97316,#f43f5e)',
    bgGlow: 'rgba(249,115,22,0.4)',
    btnGradient: 'linear-gradient(135deg,#f97316,#f43f5e)',
    btnGlow: 'rgba(249,115,22,0.45)',
    accentColor: '#fdba74',
    tag: 'STEP 02',
    title: 'Beat the Clock',
    desc: 'Train with SSC-style timed questions.',
  },
  {
    id: 3,
    emoji: '⚡',
    iconGradient: 'linear-gradient(135deg,#14B8A6,#0d9488)',
    bgGlow: 'rgba(20,184,166,0.4)',
    btnGradient: 'linear-gradient(135deg,#14B8A6,#0d9488)',
    btnGlow: 'rgba(20,184,166,0.45)',
    accentColor: '#2DD4BF',
    tag: 'STEP 03',
    title: 'Earn Coins',
    desc: 'Correct answers help you level up from Aspirant to Legend.',
  },
  {
    id: 4,
    emoji: '🏆',
    iconGradient: 'linear-gradient(135deg,#fbbf24,#f97316)',
    bgGlow: 'rgba(245,158,11,0.4)',
    btnGradient: 'linear-gradient(135deg,#fbbf24,#f97316)',
    btnGlow: 'rgba(245,158,11,0.45)',
    accentColor: '#fde68a',
    tag: 'STEP 04',
    title: 'Climb the Rank',
    desc: 'Compete weekly and see where you stand.',
  },
  {
    id: 5,
    emoji: '🔥',
    iconGradient: 'linear-gradient(135deg,#8b5cf6,#9333ea)',
    bgGlow: 'rgba(139,92,246,0.4)',
    btnGradient: 'linear-gradient(135deg,#FF8A1F,#FF5A00)',
    btnGlow: 'rgba(255,107,22,0.45)',
    accentColor: '#c4b5fd',
    tag: 'STEP 05',
    title: 'Build a Habit',
    desc: 'One quiz a day keeps GK fresh.',
  },
];

function setOnboardingDone() {
  try { localStorage.setItem('ssc_onboarding_done', 'true'); } catch {}
}

export default function OnboardingSlides() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    // Only skip onboarding for Google-authenticated users who have already seen it.
    // Guests always see onboarding on every login.
    if (isGuestMode()) return;
    try {
      if (localStorage.getItem('ssc_onboarding_done') === 'true') {
        router.replace('/dashboard');
      }
    } catch {}
  }, []);

  function goTo(idx) {
    setCurrent(idx);
    setAnimKey(k => k + 1);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 50 && current < SLIDES.length - 1) goTo(current + 1);
    if (delta < -50 && current > 0) goTo(current - 1);
    touchStartX.current = null;
  }

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <>
      <Head><title>Welcome — SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes obIconPop {
          0%   { transform: scale(0.72); opacity: 0; }
          65%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes obCardUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes obFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ob-icon  { animation: obIconPop  0.44s cubic-bezier(0.34,1.56,0.64,1) both; }
        .ob-card  { animation: obCardUp   0.38s cubic-bezier(0.22,1,0.36,1) 0.12s both; }
        .ob-tag   { animation: obFadeUp   0.3s  cubic-bezier(0.22,1,0.36,1) 0.22s both; }
        .ob-title { animation: obFadeUp   0.3s  cubic-bezier(0.22,1,0.36,1) 0.30s both; }
        .ob-desc  { animation: obFadeUp   0.3s  cubic-bezier(0.22,1,0.36,1) 0.36s both; }
        .ob-btn   { animation: obFadeUp   0.3s  cubic-bezier(0.22,1,0.36,1) 0.42s both; }
      `}</style>

      <div
        className="relative flex flex-col select-none overflow-hidden"
        style={{
          height: '100svh',
          minHeight: '100dvh',
          WebkitTapHighlightColor: 'transparent',
          /* Full-screen dark base */
          background: 'var(--bg-app)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Full-screen colored glow — top half only ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 55% at 50% -5%, ${slide.bgGlow} 0%, transparent 70%)`,
            transition: 'background 0.5s ease',
          }}
        />

        {/* ── Progress bar + Skip ── */}
        <div className="relative z-10 flex-shrink-0 px-6 pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans font-semibold text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {current + 1}/{SLIDES.length}
            </span>
            {!isLast && (
              <button
                onClick={() => { setOnboardingDone(); router.push('/dashboard'); }}
                className="font-sans font-medium text-xs active:opacity-40 transition-opacity"
                style={{
                  color: 'rgba(255,255,255,0.38)',
                  minHeight: 44,
                  padding: '8px 12px',
                  margin: '-8px -12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
            )}
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              style={{
                height: '100%',
                width: `${((current + 1) / SLIDES.length) * 100}%`,
                background: slide.btnGradient,
                borderRadius: 999,
                transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1), background 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* ── Icon — floats in the colored zone ── */}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div
            key={`icon-${animKey}`}
            className="ob-icon flex items-center justify-center rounded-full"
            style={{
              width: 116,
              height: 116,
              background: slide.iconGradient,
              fontSize: 52,
              boxShadow: `0 12px 48px ${slide.bgGlow}, 0 0 0 10px rgba(255,255,255,0.05)`,
            }}
          >
            {slide.emoji}
          </div>
        </div>

        {/* ── Bottom content card (text only) ── */}
        <div
          key={`card-${animKey}`}
          className="ob-card relative z-10 flex-shrink-0 mx-4"
          style={{
            background: 'rgba(13,22,38,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 28,
            padding: 24,
            /* leave room for the fixed button below */
            marginBottom: 'calc(100px + env(safe-area-inset-bottom))',
          }}
        >
          <span
            key={`tag-${animKey}`}
            className="ob-tag block font-sans font-black text-[11px] uppercase tracking-[0.2em] mb-2"
            style={{ color: slide.accentColor }}
          >
            {slide.tag}
          </span>

          <h1
            key={`title-${animKey}`}
            className="ob-title font-display font-black text-[26px] leading-tight text-white mb-2"
          >
            {slide.title}
          </h1>

          <p
            key={`desc-${animKey}`}
            className="ob-desc font-sans text-sm leading-relaxed"
            style={{ color: 'rgba(148,163,184,0.85)' }}
          >
            {slide.desc}
          </p>
        </div>

        {/* ── Fixed bottom CTA ── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pointer-events-none"
        >
          <div
            className="w-full max-w-[430px] pointer-events-auto"
            style={{
              padding: 'calc(12px + env(safe-area-inset-bottom)) 16px calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <button
              key={`btn-${animKey}`}
              onClick={() => {
                if (isLast) { setOnboardingDone(); router.push('/dashboard'); }
                else goTo(current + 1);
              }}
              className={`ob-btn w-full flex items-center justify-center gap-2 font-display font-bold text-base text-white transition-transform active:scale-[0.97] ${isLast ? 'btn-breathe' : ''}`}
              style={{
                height: 56,
                background: slide.btnGradient,
                borderRadius: 18,
                boxShadow: `0 6px 22px ${slide.btnGlow}`,
                transition: 'background 0.4s ease, box-shadow 0.4s ease',
              }}
            >
              {isLast ? 'Start Practising' : 'Next'}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
