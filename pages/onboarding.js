import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getUserProfile, readUserProfileCache, updateUserProfile } from '@/lib/data/profileData';

export default function Onboarding() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.replace('/'); return; }
    const scope = getUserCacheScope(session);
    // If the shared profile cache already proves the user is existing → skip
    // onboarding with ZERO profile GET. If it proves new → render onboarding.
    const cached = readUserProfileCache(scope);
    if (cached && cached.isNewUser === false) { router.replace('/dashboard'); return; }
    if (cached && cached.isNewUser === true) { setName(session.user?.name || ''); setChecking(false); return; }
    // Uncertain (no cache): one GET (this also creates the Users row for a new
    // user). A transient failure renders onboarding (existing safe behavior) —
    // never a hard redirect based on a failed read.
    getUserProfile({ scope })
      .then(res => {
        const data = res?.data || {};
        if (data.isNewUser === false) { router.replace('/dashboard'); return; }
        setName(session.user?.name || '');
        setChecking(false);
      })
      .catch(() => { setName(session.user?.name || ''); setChecking(false); });
  }, [status, session, router]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      // One PATCH; patches the shared profile cache (name + isNewUser:false) so
      // the next Dashboard/Profile open needs no GET. No follow-up profile GET.
      await updateUserProfile({ scope: getUserCacheScope(session), name: trimmed });
    } catch { /* ignore — still proceed */ }
    const alreadySeen = (() => {
      try { return localStorage.getItem('ssc_onboarding_done') === 'true'; } catch { return false; }
    })();
    router.push(alreadySeen ? '/dashboard' : '/onboarding-slides');
  }

  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4 bg-[var(--ssc-bg)]">
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
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--ssc-bg)]">
        <div className="w-full max-w-[360px] rounded-[24px] border border-ssc-border bg-white px-6 py-8 text-center shadow-[var(--ssc-shadow-card)]">

        {/* Logo */}
        <div className="mx-auto w-14 h-14 rounded-3xl bg-ssc-warning-soft flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#f97316">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>

        <h1 className="font-display font-black text-xl text-ssc-text-primary text-center mt-6">
          Welcome!
        </h1>
        <p className="font-sans font-medium text-sm text-ssc-text-secondary text-center mt-2 mb-8 max-w-[280px] mx-auto">
          You&apos;re all set. Just tell us what to call you on the leaderboard.
        </p>

        {/* Name input */}
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Your display name"
          className="w-full max-w-[320px] bg-white border border-ssc-border rounded-xl px-4 py-3.5 text-ssc-text-primary text-sm font-medium placeholder:text-ssc-text-muted focus:border-ssc-teal focus:outline-none focus:ring-2 focus:ring-ssc-teal/20"
        />

        {/* Let's Go button */}
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="w-full max-w-[320px] mt-4 py-4 rounded-[16px] text-white font-display font-bold text-base btn-breathe active:scale-[0.98] transition-transform disabled:bg-ssc-disabled-bg disabled:text-ssc-disabled-text disabled:shadow-none disabled:cursor-not-allowed"
          style={{ background: saving || !name.trim() ? undefined : 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))', boxShadow: saving || !name.trim() ? undefined : 'var(--ssc-shadow-cta)' }}
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
          className="font-sans font-medium text-sm text-ssc-teal underline underline-offset-2 mt-3"
        >
          Skip, use my Google name
        </button>
        </div>

      </div>
    </>
  );
}
