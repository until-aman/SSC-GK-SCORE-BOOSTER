import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const ORANGE = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
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

const historyFeatures = [
  {
    title: 'Quiz History',
    body: 'Review attempted quizzes and re-attempt weak areas.',
    route: '/history/quizzes',
    unlockTitle: 'Unlock Quiz History',
    unlockBody: 'Sign in to review your attempted quizzes and re-attempt mistakes.',
    unlockNote: 'Free \u2022 No payment \u2022 Saves progress across devices',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
  },
  {
    title: 'Saved Questions',
    body: 'Revise bookmarked questions topic-wise.',
    route: '/history/saved',
    unlockTitle: 'Unlock Saved Questions',
    unlockBody: 'Sign in to revise your bookmarked questions across devices.',
    unlockNote: 'Free \u2022 Keeps your revision list safe',
    icon: (
      <>
        <path d="M6 4h12v17l-6-3-6 3V4z" />
      </>
    ),
  },
  {
    title: 'Repeated Mistakes',
    body: 'See which questions you keep getting wrong.',
    route: '/history/mistakes',
    unlockTitle: 'Unlock Repeated Mistakes',
    unlockBody: 'Sign in to see questions you got wrong multiple times and practice them again.',
    unlockNote: 'Free \u2022 Helps you revise smarter',
    icon: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      </>
    ),
  },
  {
    title: 'Coins History',
    body: 'Track quiz rewards and bonuses.',
    route: '/history/coins',
    unlockTitle: 'Unlock Coins History',
    unlockBody: 'Sign in to track your rewards and quiz activity.',
    unlockNote: 'Free \u2022 Saves your rewards history',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M9 10.5A3 3 0 0 1 12 8h2" />
        <path d="M15 13.5A3 3 0 0 1 12 16h-2" />
      </>
    ),
  },
  {
    title: 'Streak History',
    body: 'Monitor your practice consistency.',
    route: '/streak',
    unlockTitle: 'Unlock Streak History',
    unlockBody: 'Sign in to track your daily practice consistency.',
    unlockNote: 'Free \u2022 Keeps your streak safe',
    icon: (
      <>
        <path d="M8 14a4 4 0 1 0 8 0c0-3-4-4-2.5-9C10 7 8 10 8 14z" />
        <path d="M12 18a2 2 0 0 0 2-2c0-1.5-2-2-1.2-4.5C11 12.6 10 14 10 16a2 2 0 0 0 2 2z" />
      </>
    ),
  },
];

function FeatureIcon({ children }) {
  return (
    <div className="history-feature-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

const HistoryHeaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

function HistoryGuestState() {
  const [lockedFeature, setLockedFeature] = useState(null);

  function handleSignIn(feature) {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: feature?.route || '/history' });
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)]">
        <style>{`
          .history-guest-card {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            padding: 4px 16px;
          }
          .history-benefit-strip {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: ${BG_DEEP};
            border: 1px solid ${BORDER};
            border-radius: 999px;
            padding: 9px 14px;
            flex-wrap: wrap;
          }
          .history-benefit-strip span {
            color: ${TEXT_SEC};
            font-size: 12px;
          }
          .history-benefit-separator {
            color: ${TEXT_MUT};
          }
          .history-feature-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 13px 0;
            border-bottom: 1px solid ${BORDER};
            width: 100%;
            background: transparent;
            border-left: 0;
            border-right: 0;
            border-top: 0;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
          }
          .history-feature-row:active {
            transform: scale(.99);
          }
          .history-feature-row:last-child {
            border-bottom: none;
          }
          .history-feature-icon {
            width: 32px;
            height: 32px;
            border-radius: 9px;
            background: ${ORANGE_DIM};
            color: ${ORANGE};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .history-arrow {
            color: ${TEXT_MUT};
            flex-shrink: 0;
            font-size: 16px;
          }
          .history-preview-shell {
            position: relative;
            height: 360px;
            margin-top: auto;
            overflow: hidden;
            border-radius: 18px;
            background: transparent;
            flex: 0 0 auto;
          }
          .history-preview-blur {
            filter: blur(6px);
            opacity: .4;
            pointer-events: none;
            user-select: none;
            padding: 4px;
          }
          .history-lock-card {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            pointer-events: none;
          }
          .history-preview-block {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
          }
          .history-google-btn {
            width: 100%;
            border: none;
            border-radius: 14px;
            padding: 14px 0;
            background: #fff;
            color: #0F172A;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
          }
          .history-google-btn:active {
            transform: scale(.98);
          }
          .history-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 80;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(4, 12, 24, .72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
          .history-modal-card {
            position: relative;
            width: min(100%, 360px);
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 20px;
            padding: 24px 20px 20px;
            text-align: center;
            box-shadow: 0 24px 70px rgba(0,0,0,.46);
          }
          .history-modal-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 34px;
            height: 34px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,.08);
            background: rgba(255,255,255,.04);
            color: ${TEXT_MUT};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
          }
          .history-modal-close:active {
            transform: scale(.96);
          }
          .history-modal-lock {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            margin: 0 auto 14px;
            background: ${ORANGE_DIM};
            color: ${ORANGE};
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .history-guest-content {
            background: var(--bg-app);
            min-height: calc(100dvh - 58px);
            display: flex;
            flex-direction: column;
            padding: 22px 16px calc(94px + env(safe-area-inset-bottom));
            box-sizing: border-box;
          }
          @media (max-height: 700px) {
            .history-preview-shell {
              height: 300px;
            }
          }
        `}</style>

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
              <HistoryHeaderIcon />
            </div>
            <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center text-white">
              My History
            </span>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              PRACTICE ARCHIVE
            </span>
          </div>
        </div>

        <div className="history-guest-content">

        <section className="history-benefit-strip mb-[18px]">
          <span>Review</span>
          <span className="history-benefit-separator">&middot;</span>
          <span>Revise</span>
          <span className="history-benefit-separator">&middot;</span>
          <span>Re-attempt</span>
          <span className="history-benefit-separator">&middot;</span>
          <span>Track</span>
        </section>

        <section className="history-guest-card mb-[18px]">
          {historyFeatures.map(feature => (
            <button key={feature.title} type="button" className="history-feature-row" onClick={() => setLockedFeature(feature)}>
              <FeatureIcon>{feature.icon}</FeatureIcon>
              <span className="font-display min-w-0 flex-1" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>{feature.title}</span>
              <span className="history-arrow" aria-hidden="true">&rarr;</span>
            </button>
          ))}
        </section>

        <section className="history-preview-shell">
          <div className="history-preview-blur">
            {[
              {
                title: 'Polity • Fundamental Rights',
                meta: '68% Accuracy',
                body: 'Review / Re-attempt',
                accent: ORANGE,
              },
              {
                title: 'Saved Question',
                meta: 'Question preview',
                body: 'Saved for revision',
                accent: '#14B8A6',
              },
              {
                title: 'Repeated Mistake',
                meta: 'Wrong 3x',
                body: 'Practice now',
                accent: '#EF4444',
              },
              {
                title: 'Rewards',
                meta: 'Total Coins',
                body: 'Weekly rewards',
                accent: '#F59E0B',
              },
            ].map(({ title, meta, body, accent }) => (
              <div key={title} className="history-preview-block">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-black text-[14px]" style={{ color: TEXT_PRI }}>{title}</p>
                    <p className="font-sans text-[11px] mt-1" style={{ color: TEXT_MUT }}>{meta}</p>
                  </div>
                  <div className="h-8 w-8 rounded-xl" style={{ background: `${accent}33` }} />
                </div>
                <p className="font-sans text-[12px] mt-3" style={{ color: TEXT_SEC }}>{body}</p>
                <div className="h-2 w-2/3 rounded bg-white/10 mt-3" />
              </div>
            ))}
          </div>
          <div className="history-lock-card">
            <div className="text-center rounded-2xl px-6 py-[18px]" style={{ background: 'rgba(13,27,46,.92)', border: `1px solid ${BORDER}`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
              <div className="w-[42px] h-[42px] rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: ORANGE_DIM }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="font-display text-[15px] font-extrabold mb-1" style={{ color: TEXT_PRI }}>Your history is waiting</p>
              <p className="font-sans text-[12px]" style={{ color: TEXT_MUT }}>Sign in to unlock your quiz archive</p>
            </div>
          </div>
        </section>

        </div>
      </div>
      {lockedFeature && (
        <div className="history-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-unlock-title" onClick={() => setLockedFeature(null)}>
          <div className="history-modal-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="history-modal-close" aria-label="Close" onClick={() => setLockedFeature(null)}>
              &times;
            </button>
            <div className="history-modal-lock" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 id="history-unlock-title" className="font-display text-[19px] font-black leading-tight text-white">
              {lockedFeature.unlockTitle}
            </h2>
            <p className="font-sans text-[13px] leading-relaxed mt-3" style={{ color: TEXT_SEC }}>
              {lockedFeature.unlockBody}
            </p>
            <button className="history-google-btn mt-5" onClick={() => handleSignIn(lockedFeature)}>
              <GoogleSVG />
              Continue with Google
            </button>
            <p className="font-sans text-[11px] mt-3" style={{ color: TEXT_MUT }}>
              {lockedFeature.unlockNote}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const isGuest = status === 'unauthenticated';

  useEffect(() => {
    if (status === 'loading') return;
    setLoading(false);
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>History - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="My History" badge="PRACTICE ARCHIVE" icon={<HistoryHeaderIcon />} />
        <main className="px-4 pt-5">
          <Loader card size="md" label="Loading history..." />
        </main>
      </div>
    );
  }

  if (isGuest) {
    return <HistoryGuestState />;
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-28">
        <style>{`
          .history-guest-card {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 18px;
            padding: 4px 16px;
          }
          .history-benefit-strip {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: ${BG_DEEP};
            border: 1px solid ${BORDER};
            border-radius: 999px;
            padding: 9px 14px;
            flex-wrap: wrap;
          }
          .history-benefit-strip span {
            color: ${TEXT_SEC};
            font-size: 12px;
          }
          .history-benefit-separator {
            color: ${TEXT_MUT};
          }
          .history-feature-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 13px 0;
            border-bottom: 1px solid ${BORDER};
            width: 100%;
            background: transparent;
            border-left: 0;
            border-right: 0;
            border-top: 0;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
          }
          .history-feature-row:active {
            transform: scale(.99);
          }
          .history-feature-row:last-child {
            border-bottom: none;
          }
          .history-feature-icon {
            width: 32px;
            height: 32px;
            border-radius: 9px;
            background: ${ORANGE_DIM};
            color: ${ORANGE};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .history-arrow {
            color: ${TEXT_MUT};
            flex-shrink: 0;
            font-size: 16px;
          }
        `}</style>

        <HistoryTopBar title="My History" badge="PRACTICE ARCHIVE" icon={<HistoryHeaderIcon />} />

        <main className="px-4 pt-[28px]">
          <section className="history-benefit-strip mb-[24px]">
            <span>Review</span>
            <span className="history-benefit-separator">&middot;</span>
            <span>Revise</span>
            <span className="history-benefit-separator">&middot;</span>
            <span>Re-attempt</span>
            <span className="history-benefit-separator">&middot;</span>
            <span>Track</span>
          </section>

          <section className="history-guest-card">
            {historyFeatures.map(feature => (
              <button key={feature.title} type="button" className="history-feature-row" onClick={() => router.push(feature.route)}>
                <FeatureIcon>{feature.icon}</FeatureIcon>
                <span className="font-display min-w-0 flex-1" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>{feature.title}</span>
                <span className="history-arrow" aria-hidden="true">&rarr;</span>
              </button>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
