import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';

function CountUp({ target, suffix = '', duration = 1000, delay = 0 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const TICK_MS = 16;
    const steps = Math.round(duration / TICK_MS);
    let step = 0;
    let interval;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - Math.min(progress, 1), 3);
        setValue(Math.round(eased * target));
        if (step >= steps) clearInterval(interval);
      }, TICK_MS);
    }, delay);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [target, duration, delay]);

  return <>{value}{suffix}</>;
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (session) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}

const LightningSVG = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#f97316">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const GoogleSVG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function LandingPage() {
  const router = useRouter();


  function handleGoogle() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: '/dashboard' });
  }

  function handleGuest() {
    document.cookie = 'userMode=guest; path=/; max-age=86400';
    router.push('/onboarding-slides');
  }

  return (
    <>
      <Head><title>SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes logoPopIn {
          0%   { transform: scale(0.8); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .title-enter {
          animation: slideUpFade 0.45s cubic-bezier(0.22,1,0.36,1) 0.6s both;
        }
        .stats-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .stats-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(20,184,166,0.12);
        }
        .stats-card:hover .stat-num {
          color: #14B8A6;
        }
        .exam-chip {
          animation: slideUpFade 0.4s cubic-bezier(0.22,1,0.36,1) both;
          opacity: 0.88;
          transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
          cursor: default;
        }
        .exam-chip:hover {
          opacity: 1;
          transform: translateY(-2px);
          background: rgba(20,184,166,0.14) !important;
          border-color: rgba(20,184,166,0.42) !important;
          color: #5eead4 !important;
          box-shadow: 0 0 8px rgba(20,184,166,0.18);
        }
        @keyframes logoGlowPulse {
          0%, 70%, 100% { box-shadow: 0 0 0px rgba(249,115,22,0); }
          35%            { box-shadow: 0 0 18px rgba(249,115,22,0.45); }
        }
        .logo-wrap {
          animation: logoPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both,
                     logoGlowPulse 3.5s ease-in-out 1s infinite;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .logo-wrap:hover {
          transform: rotate(8deg) scale(1.1);
          box-shadow: 0 0 24px rgba(249,115,22,0.6);
        }
        @keyframes guestCtaPulse {
          0%, 100% {
            box-shadow: 0 0 0 rgba(20,184,166,0), 0 16px 36px rgba(0,0,0,0.24);
          }
          50% {
            box-shadow: 0 0 26px rgba(20,184,166,0.32), 0 18px 42px rgba(0,0,0,0.34);
          }
        }
        .guest-cta {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(15,23,42,0.98), rgba(13,27,46,0.98)),
            radial-gradient(circle at 50% 0%, rgba(20,184,166,0.32), transparent 52%);
          border-color: rgba(20,184,166,0.58);
          box-shadow: 0 0 18px rgba(20,184,166,0.2), 0 16px 36px rgba(0,0,0,0.24);
          animation: guestCtaPulse 2.8s ease-in-out infinite;
          transition:
            transform 0.18s cubic-bezier(0.34,1.56,0.64,1),
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
          will-change: transform, box-shadow;
        }
        .guest-cta::before {
          content: '';
          position: absolute;
          inset: 1px;
          border-radius: 14px;
          background: linear-gradient(90deg, transparent, rgba(20,184,166,0.14), transparent);
          transform: translateX(-120%);
          transition: transform 0.45s ease;
        }
        .guest-cta:hover {
          transform: translateY(-3px) scale(1.03);
          background:
            linear-gradient(135deg, rgba(17,31,49,0.98), rgba(13,27,46,0.98)),
            radial-gradient(circle at 50% 0%, rgba(20,184,166,0.42), transparent 56%);
          border-color: rgba(20,184,166,0.95);
          box-shadow: 0 0 34px rgba(20,184,166,0.46), 0 18px 44px rgba(0,0,0,0.36);
        }
        .guest-cta:hover::before {
          transform: translateX(120%);
        }
        .guest-cta:active {
          transform: translateY(0) scale(0.97);
          transition-duration: 80ms;
        }
        .guest-cta-label {
          display: inline-grid;
          place-items: center;
          min-height: 24px;
        }
        .guest-cta-label span {
          grid-area: 1 / 1;
          transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .guest-cta-hover {
          opacity: 0;
          transform: translateY(8px);
        }
        .guest-cta:hover .guest-cta-default {
          opacity: 0;
          transform: translateY(-8px);
        }
        .guest-cta:hover .guest-cta-hover {
          opacity: 1;
          transform: translateY(0);
        }
        .google-cta {
          min-height: 54px;
          box-shadow: 0 4px 18px rgba(255,255,255,0.08);
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            background-color 0.16s ease;
          will-change: transform, box-shadow;
        }
        .google-cta:hover {
          transform: translateY(-2px) scale(1.02);
          background-color: #ffffff;
          box-shadow: 0 0 22px rgba(255,255,255,0.2), 0 10px 24px rgba(0,0,0,0.18);
        }
        .google-cta:active {
          transform: translateY(0) scale(0.98);
          transition-duration: 80ms;
        }
        @keyframes heartBeatTiny {
          0%, 100% {
            transform: translateZ(0) scale(1);
            filter: drop-shadow(0 0 0 rgba(244,63,94,0));
          }
          12% {
            transform: translateZ(0) scale(1.22);
            filter: drop-shadow(0 0 5px rgba(244,63,94,0.45));
          }
          24% {
            transform: translateZ(0) scale(1);
            filter: drop-shadow(0 0 0 rgba(244,63,94,0));
          }
          36% {
            transform: translateZ(0) scale(1.16);
            filter: drop-shadow(0 0 4px rgba(244,63,94,0.3));
          }
          48% {
            transform: translateZ(0) scale(1);
            filter: drop-shadow(0 0 0 rgba(244,63,94,0));
          }
        }
        .footer-heart {
          display: inline-block;
          transform-origin: center;
          vertical-align: -0.08em;
          font-size: 1.12em;
          line-height: 1;
          will-change: transform, filter;
          animation: heartBeatTiny 1.8s cubic-bezier(0.34,1.56,0.64,1) infinite;
        }
        @keyframes ambientFloatA {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.28; }
          50%      { transform: translate3d(14px, 18px, 0) scale(1.04); opacity: 0.38; }
        }
        @keyframes ambientFloatB {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.24; }
          50%      { transform: translate3d(-18px, -12px, 0) scale(1.06); opacity: 0.34; }
        }
        @keyframes ambientFloatC {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.2; }
          50%      { transform: translate3d(10px, -14px, 0) scale(1.05); opacity: 0.3; }
        }
        .ambient-glow {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(52px);
          mix-blend-mode: screen;
          will-change: transform, opacity;
        }
        .ambient-glow-blue {
          width: 220px;
          height: 220px;
          top: -72px;
          left: -82px;
          background: radial-gradient(circle, rgba(59,130,246,0.42), rgba(59,130,246,0) 68%);
          animation: ambientFloatA 10s ease-in-out infinite;
        }
        .ambient-glow-green {
          width: 260px;
          height: 260px;
          right: -108px;
          bottom: -88px;
          background: radial-gradient(circle, rgba(20,184,166,0.36), rgba(20,184,166,0) 70%);
          animation: ambientFloatB 12s ease-in-out infinite;
        }
        .ambient-glow-orange {
          width: 140px;
          height: 140px;
          top: 104px;
          left: 50%;
          margin-left: -70px;
          background: radial-gradient(circle, rgba(249,115,22,0.28), rgba(249,115,22,0) 68%);
          animation: ambientFloatC 8.5s ease-in-out infinite;
        }
      `}</style>
      <div className="relative min-h-screen overflow-hidden [background:var(--bg-app)] flex flex-col items-center justify-center px-6 py-10">
        <div className="ambient-glow ambient-glow-blue" aria-hidden="true" />
        <div className="ambient-glow ambient-glow-green" aria-hidden="true" />
        <div className="ambient-glow ambient-glow-orange" aria-hidden="true" />

        {/* Hero */}
        <div className="relative z-10 flex flex-col items-center text-center mb-10">
          <div className="logo-wrap w-14 h-14 rounded-[22px] bg-orange-500/10 flex items-center justify-center mb-4">
            <LightningSVG />
          </div>

          <h1 className="title-enter font-display font-black text-2xl text-white">
            SSC GK Score Booster
          </h1>
          <p className="font-sans text-sm text-slate-400 mt-1" style={{ animation: 'slideUpFade 0.45s cubic-bezier(0.22,1,0.36,1) 0.85s both' }}>
            Daily GK practice for SSC aspirants
          </p>

          {/* Exam tags */}
          <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
            {['CGL', 'CHSL', 'MTS', 'GD'].map((tag, i) => (
              <span
                key={tag}
                className="exam-chip font-sans text-xs font-semibold text-[#14B8A6] bg-[rgba(20,184,166,0.10)] border border-[rgba(20,184,166,0.20)] px-3 py-1 rounded-full"
                style={{ animationDelay: `${1.05 + i * 0.1}s` }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Stat strip */}
          <div className="stats-card bg-slate-800/60 rounded-[18px] px-4 py-3 mt-6 w-full max-w-[320px]">
            <div className="flex justify-around">
              {[
                { target: 12,   suffix: '',  label: 'Subjects',  duration: 800,  delay: 400  },
                { target: 7600, suffix: '+', label: 'Questions', duration: 1200, delay: 500  },
                { target: 100,  suffix: '%', label: 'Free',      duration: 1000, delay: 600  },
              ].map(({ target, suffix, label, duration, delay }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="stat-num font-display font-black text-lg text-[#14B8A6] transition-colors duration-200">
                    <CountUp target={target} suffix={suffix} duration={duration} delay={delay} />
                  </span>
                  <span className="font-sans text-xs text-slate-500 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="relative z-10 flex flex-col gap-3 w-full max-w-[340px]">
          <div className="self-center text-xs font-semibold text-orange-200/90">
            ⚡ Today’s GK Challenge is live
          </div>

          <button
            onClick={handleGuest}
            aria-label="Start Quiz as Guest"
            className="guest-cta group w-full border-2 text-white rounded-[18px] py-4 font-bold text-base"
          >
            <span className="guest-cta-label relative z-10" aria-hidden="true">
              <span className="guest-cta-default">Start Quiz as Guest →</span>
              <span className="guest-cta-hover">Start Quiz →</span>
            </span>
          </button>

          <div className="flex flex-col gap-1">
            <button
              onClick={handleGoogle}
              className="google-cta w-full bg-white text-slate-900 rounded-[18px] py-3.5 flex items-center justify-center gap-3 font-semibold text-[15px]"
            >
              <GoogleSVG />
              Continue with Google
            </button>
          </div>
        </div>

        <p className="relative z-10 font-sans text-xs text-slate-600 text-center mt-14">
          Made with <span className="footer-heart" aria-label="love">❤️</span> for SSC aspirants
        </p>

      </div>
    </>
  );
}
