import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import SectionHeader from '@/components/ui/SectionHeader';
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
  return cleanName.length > maxLength ? `${cleanName.slice(0, maxLength - 1)}…` : cleanName;
}

function RankAvatar({ leader, size = 32, borderColor }) {
  const [imgError, setImgError] = useState(false);
  const initial    = (leader.name || '?').charAt(0).toUpperCase();
  const fontSize   = Math.round(size * 0.42);
  const sharedStyle = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${borderColor || '#334155'}`,
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
    <div style={{ ...sharedStyle, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize, fontWeight: 900, color: 'white', fontFamily: 'inherit' }}>{initial}</span>
    </div>
  );
}

function RankRow({ leader, isSelf }) {
  return (
    <AppCard
      className="flex items-center gap-3 mb-2"
      style={isSelf ? {
        background: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(23,45,71,0.90))',
        border: '1px solid rgba(20,184,166,0.40)',
      } : {
        background: '#172D47',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span className="t-stat-label font-display w-6 text-center flex-shrink-0" style={{ color: isSelf ? '#14B8A6' : '#475569' }}>
        {leader.rank}
      </span>
      <RankAvatar leader={leader} borderColor={isSelf ? 'rgba(20,184,166,0.55)' : undefined} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="t-card-subtitle font-sans font-semibold truncate" style={{ color: isSelf ? '#F0FDF4' : '#F8FAFC', margin: 0 }}>
            {truncateName(leader.name)}
          </p>
          {isSelf && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#14B8A6', background: 'rgba(20,184,166,0.16)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 6, padding: '1px 6px', flexShrink: 0, lineHeight: '16px' }}>
              YOU
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="t-stat-sm font-display" style={{ color: isSelf ? '#14B8A6' : '#CBD5E1' }}>
          {(leader.totalScore || 0).toFixed(1)}
        </p>
        <p className="font-sans text-xs text-slate-500">XP</p>
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

  async function fetchLeaderboard(scope, { forceRefresh = false } = {}) {
    let showedCache = false;
    let cacheFresh  = false;
    const refreshStartedAt = forceRefresh ? Date.now() : 0;

    // Outer try/finally guarantees setLoading(false) runs no matter what —
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

      // Cache is fresh — nothing more to do unless the user explicitly refreshes.
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
      // Always runs — clears loading/refreshing even if something threw above
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

  const first  = displayLeaders[0] || null;
  const second = displayLeaders[1] || null;
  const third  = displayLeaders[2] || null;
  const rest   = displayLeaders.slice(3);

  return (
    <>
      <Head><title>Leaderboard — SSC GK Score Booster</title></Head>
      <div className="h-screen flex flex-col pb-16">

        {/* Fixed header */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-4"
          style={{ background: '#172D47', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Close + Title on same row — title truly centred */}
          <div className="relative flex items-center mb-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
              aria-label="Go back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <SectionHeader
              title="Leaderboard"
              className="absolute left-1/2 -translate-x-1/2"
              titleClassName="text-white whitespace-nowrap"
            />
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-full p-1 w-fit mx-auto gap-1" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)' }}>
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
        <div className="flex-1 overflow-y-auto min-h-0 [background:var(--bg-app)]">
          <div className="px-4 pt-4 pb-6">

            {loading ? (
              <div className="py-8">
                <Loader card size="md" label="Fetching rankings from the scoreboard…" />
              </div>

            ) : error ? (
              <div className="text-center py-10">
                <p className="text-white/60 text-sm mb-3">Could not load leaderboard.</p>
                <AppButton
                  as="button"
                  onClick={() => {
                    try { localStorage.removeItem('ssc_leaderboard_refresh_started_at'); } catch {}
                    fetchLeaderboard(activeTab, { forceRefresh: true });
                  }}
                  variant="secondary"
                  className="px-6 py-2 bg-white text-violet-700 rounded-full text-xs uppercase"
                >
                  Retry
                </AppButton>
              </div>

            ) : leaders.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">🏆</span>
                <p className="text-slate-500 text-[13px] mt-3">No scores yet. Be the first to play!</p>
              </div>

            ) : (
              <>

                {/* ── Your Rank ──────────────────────────────────────────── */}
                {!session ? (
                  <GoogleSignInCard
                    className="mb-4"
                    title="Save your rank"
                    subtitle="Sign in to appear on the leaderboard"
                    buttonText="Sign in"
                    callbackUrl="/leaderboard"
                  />
                ) : !currentUser ? (
                  <div className="mb-4 rounded-2xl px-4 py-4 text-center" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.10)' }}>
                    <p className="font-sans text-slate-400 text-[13px]">Play a quiz to appear on the leaderboard!</p>
                  </div>
                ) : (
                  <div className="mb-4 px-4 py-4" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20), rgba(20,184,166,0.10))', border: '1px solid rgba(139,92,246,0.45)', borderRadius: 22, boxShadow: '0 14px 35px rgba(124,58,237,0.14)' }}>
                    <p className="t-section-label" style={{ color: '#a78bfa', marginBottom: 12 }}>Your Rank</p>

                    {/* Rank + YOU chip */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="t-stat-lg font-display text-violet-300 flex-shrink-0">
                        #{currentUser.rank}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#14B8A6', background: 'rgba(20,184,166,0.16)', border: '1px solid rgba(20,184,166,0.35)', borderRadius: 7, padding: '2px 8px', lineHeight: '18px', flexShrink: 0 }}>
                        YOU
                      </span>
                    </div>

                    {/* Name + XP row */}
                    <div className="flex items-center gap-3 mb-2">
                      <RankAvatar leader={currentUser} size={40} borderColor="rgba(139,92,246,0.55)" />
                      <div className="flex-1 min-w-0">
                        <p className="t-card-subtitle font-sans font-bold text-violet-100 truncate" style={{ margin: 0 }}>
                          {truncateName(currentUser.name, 20)}
                        </p>
                        <p className="font-sans text-xs text-slate-500" style={{ margin: 0 }}>{currentUser.level || 'Aspirant'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="t-stat-sm font-display text-violet-300" style={{ margin: 0 }}>
                          {(currentUser.totalScore || 0).toFixed(1)}
                        </p>
                        <p className="t-stat-label font-sans text-slate-500" style={{ margin: 0 }}>XP</p>
                      </div>
                    </div>

                    {/* XP gap / top 3 message */}
                    {currentUser.rank <= 3 ? (
                      <p className="font-sans text-[13px] text-[#14B8A6] mb-3" style={{ margin: '0 0 12px' }}>🎉 You're in the Top 3!</p>
                    ) : third && (third.totalScore || 0) > (currentUser.totalScore || 0) ? (
                      <p className="font-sans text-[13px] text-amber-400" style={{ margin: '0 0 12px' }}>
                        🔥 {Math.ceil((third.totalScore || 0) - (currentUser.totalScore || 0))} XP away from Top 3
                      </p>
                    ) : null}

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="font-display font-bold text-xs text-white active:scale-[0.97] transition-transform"
                      style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', border: 'none', borderRadius: 10, padding: '8px 18px', cursor: 'pointer' }}
                    >
                      Practice to climb →
                    </button>
                  </div>
                )}

                {/* ── Top 3 Champions ────────────────────────────────────── */}
                {(() => {
                  const top3 = [
                    { leader: first,  medal: '🥇', color: '#FCD34D', rowBg: 'rgba(251,191,36,0.06)',  avatarBorder: 'rgba(251,191,36,0.55)' },
                    { leader: second, medal: '🥈', color: '#93C5FD', rowBg: 'transparent',            avatarBorder: 'rgba(99,179,237,0.45)'  },
                    { leader: third,  medal: '🥉', color: '#F9A8D4', rowBg: 'transparent',            avatarBorder: 'rgba(236,72,153,0.40)'  },
                  ].filter(({ leader }) => !!leader);
                  if (!top3.length) return null;
                  return (
                    <div className="mb-3" style={{ background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(148,163,184,0.11)', borderRadius: 20, overflow: 'hidden' }}>
                      {/* Card header */}
                      <div style={{ padding: '10px 16px 9px', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                        <p className="t-section-label" style={{ color: '#475569', margin: 0 }}>
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
                            borderBottom: i < top3.length - 1 ? '1px solid rgba(148,163,184,0.07)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1, width: 24, textAlign: 'center' }}>{medal}</span>
                          <RankAvatar leader={leader} size={42} borderColor={avatarBorder} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {truncateName(leader.name)}
                              {leader.email === session?.user?.email && (
                                <span style={{ fontSize: 11, color: '#7C3AED', marginLeft: 6 }}>(you)</span>
                              )}
                            </p>
                            <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{leader.level || 'Aspirant'}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color, margin: 0 }}>
                              {(leader.totalScore || 0).toFixed(1)}
                            </p>
                            <p style={{ fontSize: 10, color: '#334155', margin: 0 }}>XP</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── Refresh / cache info bar ───────────────────────────── */}
                <div className="flex justify-end mt-2 mb-3">
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={() => {
                      try { localStorage.removeItem('ssc_leaderboard_refresh_started_at'); } catch {}
                      fetchLeaderboard(activeTab, { forceRefresh: true });
                    }}
                    className="font-sans active:opacity-70 disabled:opacity-70 flex items-center gap-1"
                    style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', padding: 0, cursor: refreshing ? 'default' : 'pointer' }}
                  >
                    {refreshing
                      ? '\u21bb Refreshing...'
                      : `\u21bb Updated ${formatLastUpdated(updatedAt) || 'recently'}`}
                  </button>
                </div>

                {/* ── Rank 4 and beyond ──────────────────────────────────── */}
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

        {/* Practice CTA — flex child, always visible above bottom nav */}
        <div className="flex-shrink-0 px-4 pt-2 pb-3" style={{ background: 'var(--bg-app)' }}>
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
            Practice to climb rank →
          </button>
        </div>
      </div>


      {/* Challenge Your Friends sheet */}
    </>
  );
}
