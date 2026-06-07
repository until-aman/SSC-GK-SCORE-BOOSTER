import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import DreamPostCard from '@/components/DreamPostCard';
import Loader from '@/components/ui/Loader';
import MentorMessage from '@/components/MentorMessage';
import TodaysPlanCard from '@/components/TodaysPlanCard';
import { MENTOR_COPY } from '@/lib/mentorCopy';

const ORANGE = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
const GOLD = '#F59E0B';
const GOLD_DIM = 'rgba(245,158,11,0.15)';
const BG_CARD = '#172D47';
const BG_DEEP = '#112236';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRI = '#F0F4F8';
const TEXT_SEC = '#94A3B8';
const TEXT_MUT = '#64748B';

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const MentorHeaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="#f97316" stroke="none" />
  </svg>
);

const LockIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const TargetMiniIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const CalendarMiniIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </svg>
);

const TrendMiniIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const AlertMiniIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
    <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
  </svg>
);

const mentorBenefits = [
  {
    Icon: TargetMiniIcon,
    title: 'Personal GK Plan',
    body: 'Get a daily GK plan based on your exam timeline and preparation status.',
  },
  {
    Icon: CalendarMiniIcon,
    title: "Today's Tasks",
    body: 'Know exactly what to study, revise, and practice each day.',
  },
  {
    Icon: TrendMiniIcon,
    title: 'Weak Topic Focus',
    body: 'Turn weak topics into practice tasks and track improvement.',
  },
  {
    Icon: AlertMiniIcon,
    title: 'Mistake Revision',
    body: 'Review repeated mistakes before they cost marks again.',
  },
];

const ACHIEVEMENTS = [
  { icon: '🔥', label: '1-Day\nStreak', color: '#f97316', glow: 'rgba(249,115,22,0.22)', unlocked: profile => (profile?.streakCount || 0) >= 1 },
  { icon: '🧠', label: 'GK\nStarter', color: '#22d3ee', glow: 'rgba(34,211,238,0.22)', unlocked: profile => (profile?.totalCoins || 0) > 0 },
  { icon: '⚡', label: 'Daily\nChallenger', color: '#a78bfa', glow: 'rgba(167,139,250,0.22)', unlocked: profile => (profile?.totalCoins || 0) >= 50 },
  { icon: '🌟', label: '3-Day\nStreak', color: '#fbbf24', glow: 'rgba(251,191,36,0.22)', unlocked: profile => (profile?.streakCount || 0) >= 3 },
  { icon: '🔥', label: '7-Day\nStreak', color: '#f97316', glow: 'rgba(249,115,22,0.22)', unlocked: profile => (profile?.streakCount || 0) >= 7 },
  { icon: '🏆', label: 'Champion', color: '#fbbf24', glow: 'rgba(251,191,36,0.22)', unlocked: profile => ['Champion', 'Legend'].includes(profile?.level) },
  { icon: '👑', label: 'Legend', color: '#fbbf24', glow: 'rgba(251,191,36,0.22)', unlocked: profile => profile?.level === 'Legend' },
  { icon: '📚', label: '100\nQuizzes', color: '#14B8A6', glow: 'rgba(20,184,166,0.22)', unlocked: () => false },
  { icon: '🏅', label: 'Top 100\nRank', color: '#60a5fa', glow: 'rgba(96,165,250,0.22)', unlocked: () => false },
];

function getCachedPlan() {
  try {
    const raw = localStorage.getItem('mentor_today_plan');
    if (!raw) return null;
    const { date, plan } = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];
    return date === today ? plan : null;
  } catch { return null; }
}

function setCachedPlan(plan) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('mentor_today_plan', JSON.stringify({ date: today, plan }));
}

function AchievementsGrid({ userProfile }) {
  const withState = ACHIEVEMENTS.map(item => ({ ...item, isUnlocked: item.unlocked(userProfile) }));
  const unlocked = withState.filter(item => item.isUnlocked);
  const ordered = [...unlocked, ...withState.filter(item => !item.isUnlocked)];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
      {ordered.map(badge => (
        <div
          key={badge.label}
          style={{
            background: badge.isUnlocked
              ? `radial-gradient(ellipse at top, ${badge.glow}, transparent 72%), rgba(255,255,255,0.04)`
              : 'rgba(255,255,255,0.025)',
            border: `1px solid ${badge.isUnlocked ? badge.glow : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 16,
            padding: '14px 10px 10px',
            minWidth: 78,
            maxWidth: 78,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            opacity: badge.isUnlocked ? 1 : 0.38,
            filter: badge.isUnlocked ? 'none' : 'grayscale(1)',
            boxShadow: badge.isUnlocked ? `0 4px 18px ${badge.glow}` : 'none',
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>
            {badge.isUnlocked ? badge.icon : '🔒'}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: badge.isUnlocked ? badge.color : '#475569',
              textAlign: 'center',
              lineHeight: 1.35,
              whiteSpace: 'pre-line',
            }}
          >
            {badge.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MentorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [mentorProfile, setMentorProfile] = useState(null);
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [onboarded, setOnboarded] = useState(false);
  const [error, setError] = useState(null);
  const [lockedBenefit, setLockedBenefit] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    async function loadMentor() {
      setLoading(true);
      setError(null);
      try {
        const onboardedFlag = localStorage.getItem('mentor_onboarded');
        let nextOnboarded = Boolean(onboardedFlag);

        const userProfileRes = await fetch('/api/user-profile');
        const userProfileData = await userProfileRes.json();

        let nextMentorProfile = null;
        const cachedProfile = localStorage.getItem('mentor_profile_cache');
        if (cachedProfile) {
          nextMentorProfile = JSON.parse(cachedProfile);
        } else {
          const profileRes = await fetch('/api/mentor/profile');
          const profileData = await profileRes.json();
          if (profileData.exists) {
            nextMentorProfile = profileData.profile;
            nextOnboarded = true;
            localStorage.setItem('mentor_onboarded', 'true');
            localStorage.setItem('mentor_profile_cache', JSON.stringify(nextMentorProfile));
          }
        }

        let nextPlan = getCachedPlan();
        if (!nextPlan && nextMentorProfile) {
          const planRes = await fetch('/api/mentor/today-plan');
          const planData = await planRes.json();
          if (planData.exists) {
            nextPlan = planData.plan;
            setCachedPlan(nextPlan);
          }
        }

        if (!cancelled) {
          setUserProfile(userProfileData);
          setMentorProfile(nextMentorProfile);
          setTodaysPlan(nextPlan);
          setOnboarded(nextOnboarded && Boolean(nextMentorProfile));
        }
      } catch (err) {
        if (!cancelled) setError(MENTOR_COPY.PLAN_FAILED);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMentor();
    return () => { cancelled = true; };
  }, [status]);

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return <Loader fullScreen label="Loading mentor..." />;
  }

  if (status === 'unauthenticated') {
    return (
      <>
        <Head><title>Mentor — SSC GK Score Booster</title></Head>
        <div className="min-h-screen [background:var(--bg-app)] text-white">
          <div
            className="sticky top-0 z-50 px-4 flex items-center justify-between"
            style={{
              height: '58px',
              background: 'rgba(15,32,52,0.88)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderBottom: '1px solid rgba(20,184,166,0.18)',
              borderRadius: '0 0 22px 22px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <MentorHeaderIcon />
              </div>
              <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center text-white">
                SSC Mentor
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, color: GOLD, background: GOLD_DIM, border: `1px solid ${GOLD}40`, borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                GK PLAN
              </span>
            </div>
          </div>

          <main style={{ minHeight: 'calc(100dvh - 58px)', padding: '22px 16px calc(112px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
            <section style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: BG_DEEP,
              border: `1px solid ${BORDER}`,
              borderRadius: 99,
              padding: '9px 14px',
              marginBottom: 18,
              flexWrap: 'wrap',
            }}>
              <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
                <span style={{ fontWeight: 800, color: ORANGE }}>Daily</span> Plan
              </span>
              <span style={{ color: TEXT_MUT }}>·</span>
              <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
                <span style={{ fontWeight: 800, color: ORANGE }}>Weak</span> Topics
              </span>
              <span style={{ color: TEXT_MUT }}>·</span>
              <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
                <span style={{ fontWeight: 800, color: ORANGE }}>Mistake</span> Revision
              </span>
            </section>

            <section style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: '4px 16px', marginBottom: 18 }}>
              {mentorBenefits.map(({ Icon, title }, index) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setLockedBenefit(mentorBenefits[index])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 0',
                    width: '100%',
                    background: 'transparent',
                    borderLeft: 0,
                    borderRight: 0,
                    borderTop: 0,
                    borderBottom: index < mentorBenefits.length - 1 ? `1px solid ${BORDER}` : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: ORANGE_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon />
                  </div>
                  <span className="font-display" style={{ flex: 1, fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>
                    {title}
                  </span>
                  <span style={{ fontSize: 16, color: TEXT_MUT, flexShrink: 0 }}>→</span>
                </button>
              ))}
            </section>

            <section style={{ position: 'relative', height: 300, borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}>
              <div style={{ filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none', padding: 4 }}>
                <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div style={{ width: 120, height: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 10 }} />
                      <div style={{ width: 170, height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 54, height: 28, background: ORANGE_DIM, borderRadius: 99 }} />
                  </div>
                </div>
                {[
                  ['Indian Polity', 'Fundamental Rights', '#14B8A6'],
                  ['Repeated Mistakes', 'Revise 12 questions', '#EF4444'],
                  ['Daily Challenge', 'Mixed GK practice', '#F59E0B'],
                ].map(([title, body, accent]) => (
                  <div key={title} style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display font-black text-[14px]" style={{ color: TEXT_PRI }}>{title}</p>
                        <p className="font-sans text-[11px] mt-1" style={{ color: TEXT_MUT }}>{body}</p>
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 12, background: `${accent}33` }} />
                    </div>
                    <div style={{ height: 8, background: BG_DEEP, borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
                      <div style={{ width: '54%', height: '100%', background: accent, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{
                  background: 'rgba(13,27,46,0.92)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  padding: '18px 24px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, margin: '0 auto 12px', background: ORANGE_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LockIcon />
                  </div>
                  <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI, marginBottom: 4 }}>
                    Your mentor plan is waiting
                  </div>
                  <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT }}>
                    Sign in to unlock your GK plan
                  </div>
                </div>
              </div>
            </section>

          </main>
        </div>

        {lockedBenefit && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-unlock-title"
            onClick={() => setLockedBenefit(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background: 'rgba(4,12,24,0.72)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={{
                position: 'relative',
                width: 'min(100%, 360px)',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 20,
                padding: '24px 20px 20px',
                textAlign: 'center',
                boxShadow: '0 24px 70px rgba(0,0,0,0.46)',
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLockedBenefit(null)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)',
                  color: TEXT_MUT,
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
              <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 14px', background: ORANGE_DIM, color: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockIcon size={22} />
              </div>
              <h2 id="mentor-unlock-title" className="font-display text-[19px] font-black leading-tight text-white">
                Unlock {lockedBenefit.title}
              </h2>
              <p className="font-sans text-[13px] leading-relaxed mt-3" style={{ color: TEXT_SEC }}>
                {lockedBenefit.body}
              </p>
              <button
                type="button"
                onClick={() => {
                  document.cookie = 'userMode=; path=/; max-age=0';
                  signIn('google', { callbackUrl: '/mentor' });
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 14,
                  padding: '14px 0',
                  background: '#fff',
                  color: '#0F172A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  marginTop: 20,
                }}
              >
                <GoogleSVG />
                Continue with Google
              </button>
              <p className="font-sans text-[11px] mt-3" style={{ color: TEXT_MUT }}>
                Free · No payment · Saves your plan across devices
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Head><title>Mentor — SSC GK Score Booster</title></Head>
      <main className="min-h-screen bg-slate-950 px-4 pb-24 pt-5 text-white">
        <div className="mx-auto max-w-md space-y-5">
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-xl font-bold">
                🎯
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aapka SSC Mentor</p>
                <h1 className="text-2xl font-bold">Mentor</h1>
              </div>
            </div>
            <MentorMessage message={todaysPlan?.mentorDayMessage || MENTOR_COPY.NO_PLAN} />
          </section>

          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {!onboarded ? (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <MentorMessage message={MENTOR_COPY.NO_PLAN} />
              <button
                type="button"
                onClick={() => router.push('/mentor-setup')}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white"
              >
                Build My GK Plan
              </button>
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Preparation Snapshot</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {mentorProfile?.examTarget} · {mentorProfile?.daysLeftRange} · {mentorProfile?.pace}
                    </p>
                    <p className="mt-2 text-sm text-teal-200">{mentorProfile?.dailyGKTime} daily</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/mentor-setup-edit')}
                    className="shrink-0 rounded-lg border border-teal-500/40 px-3 py-2 text-xs font-semibold text-teal-200"
                  >
                    Edit Preparation Details
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Today&apos;s Plan</h2>
                  <p className="text-xs text-slate-500">
                    Day {todaysPlan?.dayNumber || 1} of {todaysPlan?.daysTotal || 45} · {todaysPlan?.tasks?.length || 0} tasks
                  </p>
                </div>
                <TodaysPlanCard plan={todaysPlan} />
              </section>
            </>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Your Goal</h2>
            <DreamPostCard coins={userProfile?.totalCoins || 0} />
          </section>

          <section className="space-y-3">
            <MentorMessage message={MENTOR_COPY.ACHIEVEMENTS_LABEL} variant="success" />
            <AchievementsGrid userProfile={userProfile} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Account</h2>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-200"
            >
              Sign Out
            </button>
          </section>
        </div>
      </main>
    </>
  );
}
