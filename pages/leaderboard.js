import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import SectionHeader from '@/components/ui/SectionHeader';
import RefreshStatus from '@/components/ui/RefreshStatus';
import {
  buildLeaderboardCache,
  claimLeaderboardRefresh,
  isLeaderboardCacheFresh,
  readLeaderboardCache,
  toDisplayLeader,
  writeLeaderboardCache,
} from '@/lib/leaderboardCache';
import { formatLastUpdated } from '@/lib/clientCache';


function truncateName(name, maxLength = 14) {
  const cleanName = String(name || 'Unknown').trim() || 'Unknown';
  return cleanName.length > maxLength ? `${cleanName.slice(0, maxLength - 1)}...` : cleanName;
}

function RankAvatar({ leader, size = 32, borderColor }) {
  const [imgError, setImgError] = useState(false);
  const initial    = (leader.name || '?').charAt(0).toUpperCase();
  const fontSize   = Math.round(size * 0.42);
  const sharedStyle = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${borderColor || 'var(--ssc-border-soft)'}`,
    overflow: 'hidden',
  };
  if (leader.image && !imgError) {
    return (
      <div style={sharedStyle}>
        <img src={leader.image} alt={initial} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
      </div>
    );
  }
  return (
    <div style={{ ...sharedStyle, background: 'var(--ssc-teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize, fontWeight: 900, color: 'var(--ssc-teal)', fontFamily: 'inherit' }}>{initial}</span>
    </div>
  );
}

function RankRow({ leader, isSelf }) {
  return (
    <AppCard
      className="flex items-center gap-3 mb-2"
      style={isSelf ? {
        background: 'linear-gradient(135deg, var(--ssc-teal-soft), #FFFFFF)',
        border: '1px solid rgba(14,165,164,0.28)',
        boxShadow: 'var(--ssc-shadow-card)',
      } : {
        background: 'var(--ssc-surface)',
        border: '1px solid var(--ssc-border-soft)',
        boxShadow: 'var(--ssc-shadow-card)',
      }}
    >
      <span className="t-stat-label font-display w-6 text-center flex-shrink-0" style={{ color: isSelf ? 'var(--ssc-teal)' : 'var(--ssc-text-secondary)' }}>
        {leader.rank}
      </span>
      <RankAvatar leader={leader} borderColor={isSelf ? 'rgba(14,165,164,0.55)' : undefined} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="t-card-subtitle font-sans font-semibold truncate" style={{ color: 'var(--ssc-text-primary)', margin: 0 }}>
            {truncateName(leader.name)}
          </p>
          {isSelf && (
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.28)', borderRadius: 999, padding: '1px 6px', flexShrink: 0, lineHeight: '16px' }}>
              YOU
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="t-stat-sm font-display" style={{ color: isSelf ? 'var(--ssc-teal)' : 'var(--ssc-text-primary)' }}>
          {(leader.totalScore || 0).toFixed(1)}
        </p>
        <p className="font-sans text-xs text-[var(--ssc-text-muted)]">Coins</p>
      </div>
    </AppCard>
  );
}


export default function Leaderboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('weekly');
  const [leaders, setLeaders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    let timer;
    function onInteract() {
      timer = setTimeout(() => setShowCTA(true), 4000);
    }
    window.addEventListener('scroll', onInteract, { capture: true, once: true });
    window.addEventListener('touchstart', onInteract, { capture: true, once: true });
    window.addEventListener('pointermove', onInteract, { capture: true, once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onInteract, true);
      window.removeEventListener('touchstart', onInteract, true);
      window.removeEventListener('pointermove', onInteract, true);
    };
  }, []);

  async function fetchLeaderboard(scope, { forceRefresh = false } = {}) {
    let showedCache = false;
    let cacheFresh  = false;
    const refreshStartedAt = forceRefresh ? Date.now() : 0;

    // Outer try/finally guarantees setLoading(false) runs no matter what â€”
    // even if cache reads throw, early returns fire, or the fetch hangs.
    try {
      if (scope === 'weekly') {
        try {
          const cached = readLeaderboardCache();
          if (cached?.top10?.length) {
            cacheFresh = isLeaderboardCacheFresh(cached);
            const cachedLeaders = cached.top10.map(toDisplayLeader);
            const cachedUser    = cached.userRank ? toDisplayLeader(cached.userRank) : null;
            const alreadyIn     = cachedUser && cachedLeaders.some(l => l.email && l.email === cachedUser.email);
            setLeaders(alreadyIn || !cachedUser ? cachedLeaders : [...cachedLeaders, cachedUser]);
            setCurrentUser(cachedUser);
            setUpdatedAt(cached.lastFetchedAt || null);
            setLoading(false);
            showedCache = true;
          }
        } catch { /* ignore corrupt leaderboard cache */ }
      }

      // Cache is fresh â€” nothing more to do unless the user explicitly refreshes.
      if (cacheFresh && !forceRefresh) return;

      // Throttle background re-fetch only when stale cache is already visible
      if (!forceRefresh && scope === 'weekly' && showedCache) {
        try { if (!claimLeaderboardRefresh()) return; } catch { return; }
      }

      if (!showedCache) setLoading(true);
      if (forceRefresh)  setRefreshing(true);
      setError(false);

      // Inner try/catch handles API-level errors
      try {
        const res  = await fetch(`/api/leaderboard?scope=${scope}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setLeaders(data.leaders || []);
        setCurrentUser(data.currentUser || null);
        const fetchedAt = Date.now();
        setUpdatedAt(fetchedAt);
        if (scope === 'weekly' && data.leaders?.length) {
          writeLeaderboardCache(buildLeaderboardCache({
            leaders:     data.leaders,
            currentUser: data.currentUser || null,
            now:         fetchedAt,
          }));
        }
      } catch {
        if (!showedCache) setError(true);
      }

    } finally {
      // Always runs â€” clears loading/refreshing even if something threw above
      if (forceRefresh) {
        const remainingMs = 650 - (Date.now() - refreshStartedAt);
        if (remainingMs > 0) await new Promise(resolve => setTimeout(resolve, remainingMs));
      }
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // Reset stale state immediately so the old tab's data never bleeds into the new tab
    setLeaders([]);
    setCurrentUser(null);
    setLoading(true);
    setError(false);
    fetchLeaderboard(activeTab);
  }, [activeTab]);


  // Deduplicate by email so a user with duplicate sheet rows never shows twice
  const displayLeaders = leaders.reduce((acc, l) => {
    if (!l.email || !acc.some(x => x.email === l.email)) acc.push(l);
    return acc;
  }, []);

  // If the API didn't return currentUser but the session user is already in the
  // top-10 list, derive their rank card from the list so "Play a quiz" is never
  // shown to a user who clearly has a score on the board.
  const effectiveCurrentUser = currentUser ||
    (session?.user?.email
      ? displayLeaders.find(l => l.email === session.user.email) || null
      : null);

  const first  = displayLeaders[0] || null;
  const second = displayLeaders[1] || null;
  const third  = displayLeaders[2] || null;
  const rest   = displayLeaders.slice(3);

  return (
    <>
      <Head><title>Leaderboard - SSC GK Score Booster</title></Head>
      <div className="h-screen flex flex-col pb-16 bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)]">

        {/* Fixed header */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-4"
          style={{ background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}
        >
          {/* Close + Title on same row â€” title truly centred */}
          <div className="relative flex items-center mb-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-[var(--ssc-surface-soft)] border border-[var(--ssc-border-soft)] active:bg-[var(--ssc-teal-soft)] transition-colors"
              aria-label="Go back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <SectionHeader
              title="Leaderboard"
              className="absolute left-1/2 -translate-x-1/2"
              titleClassName="text-[var(--ssc-text-primary)] whitespace-nowrap"
            />
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-full p-1 w-fit mx-auto gap-1" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
            {[
              { key: 'weekly', label: 'This Week' },
              { key: 'all',    label: 'All Time' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="t-button-sm px-5 py-2 rounded-full font-display transition-all duration-200 active:scale-95"
                style={activeTab === key ? {
                  background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(255,107,22,0.35)',
                } : {
                  background: 'rgba(148,163,184,0.10)',
                  color: '#94A3B8',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-[linear-gradient(180deg,var(--ssc-bg)_0%,var(--ssc-bg-alt)_100%)]">
          <div className="px-4 pt-4 pb-6">

            {loading ? (
              <div className="py-8">
                <Loader card size="md" label="Fetching rankings from the scoreboard..." />
              </div>

            ) : error ? (
              <div className="text-center py-10">
                <p className="text-[var(--ssc-text-secondary)] text-sm mb-3">Could not load leaderboard.</p>
                <AppButton
                  as="button"
                  onClick={() => {
                    try { localStorage.removeItem('ssc_leaderboard_refresh_started_at'); } catch {}
                    fetchLeaderboard(activeTab, { forceRefresh: true });
                  }}
                  variant="secondary"
                  className="px-6 py-2 rounded-full text-xs uppercase"
                >
                  Retry
                </AppButton>
              </div>

            ) : leaders.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl" aria-hidden="true">&#127942;</span>
                <p className="text-[var(--ssc-text-muted)] text-[13px] mt-3">No scores yet. Be the first to play!</p>
              </div>

            ) : (
              <>

                {/* â”€â”€ Your Rank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {!session ? (
                  <GoogleSignInCard
                    className="mb-4"
                    title="Save your rank"
                    subtitle="Sign in to appear on the leaderboard"
                    buttonText="Sign in"
                    callbackUrl="/leaderboard"
                  />
                ) : !effectiveCurrentUser ? (
                  <div className="mb-4 rounded-2xl px-4 py-4 text-center" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
                    <p className="font-sans text-[var(--ssc-text-secondary)] text-[13px]">Play a quiz to appear on the leaderboard!</p>
                  </div>
                ) : (
                  <div className="mb-4 px-4 py-4" style={{ background: 'linear-gradient(135deg, var(--ssc-teal-soft), #FFFFFF)', border: '1px solid rgba(14,165,164,0.24)', borderRadius: 22, boxShadow: 'var(--ssc-shadow-card)' }}>
                    <p className="t-section-label" style={{ color: 'var(--ssc-teal)', marginBottom: 10 }}>Your Rank</p>

                    {/* Rank Â· Name Â· Level â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Score */}
                    <div className="flex items-center gap-2">
                      <span className="t-stat-lg font-display text-[var(--ssc-rank)] flex-shrink-0">
                        #{effectiveCurrentUser.rank}
                      </span>
                      <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                        <span className="font-sans font-bold text-[var(--ssc-text-primary)] text-sm truncate">
                          {truncateName(effectiveCurrentUser.name, 20)}
                        </span>
                        <span className="font-sans text-xs text-[var(--ssc-text-muted)] flex-shrink-0">
                          · {effectiveCurrentUser.level || 'Aspirant'}
                        </span>
                      </div>
                      <div className="flex-shrink-0 flex items-baseline gap-1">
                        <span className="t-stat-sm font-display text-[var(--ssc-rank)]">
                          {(effectiveCurrentUser.totalScore || 0).toFixed(0)}
                        </span>
                        <span className="font-sans text-xs text-[var(--ssc-text-muted)]">Coins</span>
                      </div>
                    </div>

                    {/* Message â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” Practice â†’ */}
                    <div className="flex items-center justify-between mt-2.5">
                      {effectiveCurrentUser.rank <= 3 ? (
                        <p className="font-sans text-[13px] text-[var(--ssc-teal)]" style={{ margin: 0 }}>You are in the Top 3!</p>
                      ) : third && (third.totalScore || 0) > (effectiveCurrentUser.totalScore || 0) ? (
                        <p className="font-sans text-[13px] text-[var(--ssc-warning)]" style={{ margin: 0 }}>
                          {Math.ceil((third.totalScore || 0) - (effectiveCurrentUser.totalScore || 0))} Coins away from Top 3
                        </p>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="font-display font-bold text-xs text-white active:scale-[0.97] transition-transform flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #FF7A1A, #FF4D00)', border: 'none', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', marginLeft: 8 }}
                      >
                        Practice &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* â”€â”€ Top 3 Champions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {(() => {
                  const top3 = [
                    { leader: first,  medal: '1', color: 'var(--ssc-coin)', rowBg: 'var(--ssc-warning-soft)', avatarBorder: 'rgba(246,179,49,0.58)' },
                    { leader: second, medal: '2', color: 'var(--ssc-text-secondary)', rowBg: 'transparent', avatarBorder: 'rgba(91,107,130,0.34)' },
                    { leader: third,  medal: '3', color: '#C7772A', rowBg: 'transparent', avatarBorder: 'rgba(199,119,42,0.36)' },
                  ].filter(({ leader }) => !!leader);
                  if (!top3.length) return null;
                  return (
                    <div className="mb-3" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)', borderRadius: 20, overflow: 'hidden' }}>
                      {/* Card header */}
                      <div style={{ padding: '10px 16px 9px', borderBottom: '1px solid var(--ssc-border-soft)' }}>
                        <p className="t-section-label" style={{ color: 'var(--ssc-text-secondary)', margin: 0 }}>
                          Top 3 Champions
                        </p>
                      </div>
                      {/* Rows */}
                      {top3.map(({ leader, medal, color, rowBg, avatarBorder }, i) => (
                        <div
                          key={leader.email || leader.rank}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '9px 14px',
                            background: rowBg,
                            borderBottom: i < top3.length - 1 ? '1px solid var(--ssc-border-soft)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1, width: 24, textAlign: 'center' }}>{medal}</span>
                          <RankAvatar leader={leader} size={42} borderColor={avatarBorder} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {truncateName(leader.name)}
                              {leader.email === session?.user?.email && (
                                <span style={{ fontSize: 11, color: 'var(--ssc-rank)', marginLeft: 6 }}>(you)</span>
                              )}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', margin: 0 }}>{leader.level || 'Aspirant'}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color, margin: 0 }}>
                              {(leader.totalScore || 0).toFixed(1)}
                            </p>
                            <p style={{ fontSize: 10, color: 'var(--ssc-text-muted)', margin: 0 }}>Coins</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* â”€â”€ Refresh / cache info bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="flex justify-end mt-2 mb-3">
                  <RefreshStatus
                    updatedAt={updatedAt}
                    isRefreshing={refreshing}
                    onRefresh={() => {
                      try { localStorage.removeItem('ssc_leaderboard_refresh_started_at'); } catch {}
                      fetchLeaderboard(activeTab, { forceRefresh: true });
                    }}
                    refreshText={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                    }
                  />
                </div>

                {/* â”€â”€ Rank 4 and beyond â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {rest.length > 0 && (
                  <>
                    {rest.map(leader => (
                      <RankRow
                        key={leader.email || leader.rank}
                        leader={leader}
                        isSelf={leader.email === session?.user?.email}
                      />
                    ))}
                  </>
                )}

                <div className="h-2" />
              </>
            )}

          </div>
        </div>

        {/* Practice CTA â€” fixed above bottom nav, slides in after user interaction */}
        <div
          className="fixed bottom-[74px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 z-40"
          style={{
            opacity: showCTA ? 1 : 0,
            transform: showCTA ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            pointerEvents: showCTA ? 'auto' : 'none',
          }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full font-display font-bold text-base text-white active:scale-[0.98] transition-transform"
            style={{
              borderRadius: 18,
              padding: '15px 0',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #FF7A1A, #FF4D00)',
              boxShadow: '0 12px 28px rgba(255,90,0,0.22)',
            }}
          >
            Practice to climb rank &rarr;
          </button>
        </div>
      </div>


      {/* Challenge Your Friends sheet */}
    </>
  );
}
