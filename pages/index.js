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
      <style>{`
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
          box-shadow: 0 8px 24px rgba(52,211,153,0.12);
        }
        .stats-card:hover .stat-num {
          color: #6ee7b7;
        }
        .exam-chip {
          animation: slideUpFade 0.4s cubic-bezier(0.22,1,0.36,1) both;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
          cursor: default;
        }
        .exam-chip:hover {
          transform: translateY(-2px);
          background: rgba(52,211,153,0.18) !important;
          border-color: rgba(52,211,153,0.5) !important;
          color: #6ee7b7 !important;
          box-shadow: 0 0 10px rgba(52,211,153,0.25);
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
      `}</style>
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0f172a] to-[#0c1a0e] flex flex-col items-center justify-center px-6 py-10">

        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="logo-wrap w-14 h-14 rounded-3xl bg-orange-500/10 flex items-center justify-center mb-4">
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
                className="exam-chip font-sans text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full"
                style={{ animationDelay: `${1.05 + i * 0.1}s` }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Stat strip */}
          <div className="stats-card bg-slate-800/60 rounded-2xl px-4 py-3 mt-6 w-full max-w-[320px]">
            <div className="flex justify-around">
              {[
                { target: 12,   suffix: '',  label: 'Subjects',  duration: 800,  delay: 400  },
                { target: 6000, suffix: '+', label: 'Questions', duration: 1200, delay: 500  },
                { target: 100,  suffix: '%', label: 'Free',      duration: 1000, delay: 600  },
              ].map(({ target, suffix, label, duration, delay }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="stat-num font-display font-black text-lg text-emerald-400 transition-colors duration-200">
                    <CountUp target={target} suffix={suffix} duration={duration} delay={delay} />
                  </span>
                  <span className="font-sans text-xs text-slate-500 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-[340px]">
          <button
            onClick={handleGuest}
            className="w-full border-2 border-slate-700 text-slate-300 rounded-2xl py-4 font-medium text-base active:scale-95 transition-transform duration-100"
          >
            Start as Guest
          </button>

          <div className="flex flex-col gap-1">
            <button
              onClick={handleGoogle}
              className="w-full bg-white text-slate-900 rounded-2xl py-4 flex items-center justify-center gap-3 font-semibold text-base shadow-[0_4px_20px_rgba(255,255,255,0.08)] active:scale-95 transition-transform duration-100"
            >
              <GoogleSVG />
              Continue with Google
            </button>
            <p className="font-sans text-xs text-slate-500 text-center">
              Save your XP, streaks, rank &amp; history
            </p>
          </div>
        </div>

        <p className="font-sans text-xs text-slate-600 text-center mt-10">
          Made with ❤️ for SSC aspirants
        </p>

      </div>
    </>
  );
}
