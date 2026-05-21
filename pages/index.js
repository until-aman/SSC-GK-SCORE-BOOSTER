import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import Head from 'next/head';

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
    // Always show onboarding for guest logins
    router.push('/onboarding-slides');
  }

  return (
    <>
      <Head><title>SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0f172a] to-[#0c1a0e] flex flex-col items-center justify-center gap-12 py-10 px-6">

        {/* Top: logo + tagline */}
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-3xl bg-orange-500/10 flex items-center justify-center">
            <LightningSVG />
          </div>
          <h1 className="font-display font-black text-xl text-white text-center mt-3">
            SSC GK Score Booster
          </h1>
          <p className="font-sans font-medium text-sm text-slate-400 text-center mt-1">
            Practice. Rank. Win.
          </p>

          {/* Stat strip */}
          <div className="bg-slate-800/60 rounded-2xl px-4 py-3 mt-8 w-full max-w-[320px]">
            <div className="flex justify-around">
              {[
                { num: '8',      label: 'Subjects' },
                { num: '4000+',  label: 'Questions' },
                { num: 'Free',   label: 'to Play' },
              ].map(({ num, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className="font-display font-black text-lg text-emerald-400">{num}</span>
                  <span className="font-sans text-xs text-slate-500 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: CTA buttons */}
        <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
          <button
            onClick={handleGoogle}
            className="w-full bg-white text-slate-900 rounded-2xl py-4 flex items-center justify-center gap-3 font-semibold text-base shadow-[0_4px_20px_rgba(255,255,255,0.08)] active:scale-95 transition-transform duration-100"
          >
            <GoogleSVG />
            Continue with Google
          </button>

          <button
            onClick={handleGuest}
            className="w-full border-2 border-slate-700 text-slate-300 rounded-2xl py-4 font-medium text-base active:scale-95 transition-transform duration-100"
          >
            Play as Guest
          </button>

          <p className="font-sans text-xs text-slate-600 text-center mt-2">
            Made with ❤️ to boost your marks in GK
          </p>
        </div>

      </div>
    </>
  );
}
