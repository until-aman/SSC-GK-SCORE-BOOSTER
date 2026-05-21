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
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'rgba(99,102,241,0.35)',
    accentColor: 'text-blue-400',
    tag: 'Step 01',
    title: 'Pick Your Topic',
    desc: 'Choose any subject — Polity, Geography, Ancient History and more.\nHand-curated questions, zero fluff.\nStart in seconds.',
  },
  {
    id: 2,
    emoji: '⏱️',
    gradient: 'from-orange-500 to-rose-500',
    glow: 'rgba(249,115,22,0.35)',
    accentColor: 'text-orange-400',
    tag: 'Step 02',
    title: 'Beat the Clock',
    desc: '20 seconds per question — just like the real SSC exam.\n+2 correct, −0.5 wrong.\nTrain your speed.',
  },
  {
    id: 3,
    emoji: '⚡',
    gradient: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.35)',
    accentColor: 'text-emerald-400',
    tag: 'Step 03',
    title: 'Earn XP & Level Up',
    desc: 'Every correct answer earns XP.\nFirst quiz of the day gets a bonus.\nRise from Aspirant to Legend.',
  },
  {
    id: 4,
    emoji: '🏆',
    gradient: 'from-amber-400 to-orange-500',
    glow: 'rgba(245,158,11,0.35)',
    accentColor: 'text-amber-400',
    tag: 'Step 04',
    title: 'Climb the Leaderboard',
    desc: 'See how you rank against thousands of aspirants.\nTop the weekly chart and own the podium.',
  },
  {
    id: 5,
    emoji: '🔥',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.35)',
    accentColor: 'text-violet-400',
    tag: 'Step 05',
    title: 'Build a Daily Habit',
    desc: 'One quiz a day keeps exam failures away.\nBuild your streak and watch your accuracy soar.',
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
      <div
        className="flex-1 flex flex-col px-5 pt-6 pb-6 select-none overflow-hidden"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Skip row */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0 px-1">
          <div className="flex gap-2 items-center">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 h-2 bg-emerald-500'
                    : 'w-2 h-2 bg-slate-700'
                }`}
              />
            ))}
          </div>
          {!isLast && (
            <button
              onClick={() => { setOnboardingDone(); router.push('/dashboard'); }}
              className="font-sans font-medium text-sm text-slate-500 active:text-slate-300 transition-colors"
            >
              Skip
            </button>
          )}
        </div>

        {/* Card */}
        <div
          className="flex-1 rounded-3xl flex flex-col overflow-hidden border border-slate-700/50"
          style={{
            background: 'linear-gradient(160deg, #1e293b 0%, #0f1a2e 100%)',
            boxShadow: `0 0 60px ${slide.glow}`,
            transition: 'box-shadow 0.5s ease',
          }}
        >
          {/* ── TEXT SECTION ── */}
          <div key={`text-${animKey}`} className="px-8 pt-10 pb-0 slide-text-in">
            {/* Step tag */}
            <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${slide.accentColor}`}>
              {slide.tag}
            </span>

            {/* Title */}
            <h1 className="font-display font-black text-[28px] text-white leading-tight mt-3 mb-4">
              {slide.title}
            </h1>

            {/* Description */}
            <p className="font-sans text-sm text-slate-400 leading-relaxed max-w-[280px] whitespace-pre-line">
              {slide.desc}
            </p>
          </div>

          {/* ── ILLUSTRATION + BUTTON SECTION ── */}
          <div className="flex-1 flex items-start justify-center relative min-h-0 pt-10">
            {/* Glow ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 160,
                height: 160,
                background: `radial-gradient(circle, ${slide.glow} 0%, transparent 70%)`,
                transition: 'background 0.5s ease',
              }}
            />
            {/* Emoji circle — half the original size */}
            <div
              key={`circle-${animKey}`}
              className={`relative w-28 h-28 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center circle-pop-in`}
              style={{
                boxShadow: `0 6px 28px ${slide.glow}, 0 0 0 6px rgba(255,255,255,0.04)`,
                fontSize: 48,
              }}
            >
              {slide.emoji}
            </div>

            {/* Button — absolutely pinned to bottom-right of this section */}
            <button
              onClick={() => {
                if (isLast) { setOnboardingDone(); router.push('/dashboard'); }
                else goTo(current + 1);
              }}
              className={`absolute bottom-6 right-6 flex items-center gap-2 rounded-full px-6 py-3 font-display font-bold text-sm transition-transform active:scale-95 shadow-lg ${
                isLast
                  ? 'bg-emerald-500 text-white btn-breathe shadow-[0_0_24px_rgba(16,185,129,0.45)]'
                  : 'bg-slate-700/80 text-white border border-slate-600/50'
              }`}
            >
              {isLast ? 'Start Practising' : 'Next'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
