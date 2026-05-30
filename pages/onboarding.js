import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Onboarding() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.replace('/'); return; }
    // If user already exists (not new), skip onboarding
    fetch('/api/user-profile')
      .then(r => r.json())
      .then(data => {
        if (data.isNewUser === false) {
          router.replace('/dashboard');
        } else {
          setName(session.user?.name || '');
          setChecking(false);
        }
      })
      .catch(() => {
        setName(session.user?.name || '');
        setChecking(false);
      });
  }, [status, session, router]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await fetch('/api/user-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch { /* ignore — still proceed */ }
    const alreadySeen = (() => {
      try { return localStorage.getItem('ssc_onboarding_done') === 'true'; } catch { return false; }
    })();
    router.push(alreadySeen ? '/dashboard' : '/onboarding-slides');
  }

  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <div className="skeleton h-14 w-14 rounded-3xl" />
        <div className="skeleton h-6 w-32 rounded-lg" />
        <div className="skeleton h-12 w-full max-w-[320px] rounded-xl" />
        <div className="skeleton h-14 w-full max-w-[320px] rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <Head><title>Welcome — SSC GK Score Booster</title></Head>
      <div className="min-h-screen flex flex-col items-center justify-center px-6">

        {/* Logo */}
        <div className="w-14 h-14 rounded-3xl bg-orange-500/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#f97316">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>

        <h1 className="font-display font-black text-xl text-white text-center mt-6">
          Welcome!
        </h1>
        <p className="font-sans font-medium text-sm text-slate-400 text-center mt-2 mb-8 max-w-[280px]">
          You&apos;re all set. Just tell us what to call you on the leaderboard.
        </p>

        {/* Name input */}
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Your display name"
          className="w-full max-w-[320px] bg-[#172D47] border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm font-medium placeholder:text-slate-500 focus:border-[#14B8A6] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
        />

        {/* Let's Go button */}
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="w-full max-w-[320px] mt-4 py-4 rounded-2xl text-white font-display font-bold text-base btn-breathe active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 14px rgba(255,107,22,0.30)' }}
        >
          {saving ? 'Saving…' : "Let's Go →"}
        </button>

        {/* Skip link */}
        <button
          onClick={() => {
            const alreadySeen = (() => {
              try { return localStorage.getItem('ssc_onboarding_done') === 'true'; } catch { return false; }
            })();
            router.push(alreadySeen ? '/dashboard' : '/onboarding-slides');
          }}
          className="font-sans font-medium text-sm text-[#14B8A6] underline underline-offset-2 mt-3"
        >
          Skip, use my Google name
        </button>

      </div>
    </>
  );
}
