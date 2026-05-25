import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import PodiumEntry from '@/components/PodiumEntry';
import Loader from '@/components/ui/Loader';
import {
  buildLeaderboardCache,
  claimLeaderboardRefresh,
  isLeaderboardCacheFresh,
  readLeaderboardCache,
  toDisplayLeader,
  writeLeaderboardCache,
} from '@/lib/leaderboardCache';
import { readCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';


function truncateName(name, maxLength = 14) {
  const cleanName = String(name || 'Unknown').trim() || 'Unknown';
  return cleanName.length > maxLength ? `${cleanName.slice(0, maxLength - 1)}…` : cleanName;
}

function RankAvatar({ leader }) {
  const [imgError, setImgError] = useState(false);
  const initial = (leader.name || '?').charAt(0).toUpperCase();
  if (leader.image && !imgError) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-slate-600">
        <img src={leader.image} alt={initial} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
      <span className="font-display font-black text-[14px] text-white">{initial}</span>
    </div>
  );
}

function RankRow({ leader, isSelf }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-2 ${
      isSelf
        ? 'bg-violet-900/40 border border-violet-500/40'
        : 'bg-slate-800 border border-slate-700/50'
    }`}>
      <span className={`font-display font-bold text-sm w-6 text-center flex-shrink-0 ${
        isSelf ? 'text-violet-300' : 'text-slate-500'
      }`}>
        {leader.rank}
      </span>
      <RankAvatar leader={leader} />
      <div className="flex-1 min-w-0">
        <p className={`font-sans font-semibold text-sm truncate ${isSelf ? 'text-violet-200' : 'text-white'}`}>
          {truncateName(leader.name)}
          {isSelf && <span className="font-sans text-xs text-violet-400 ml-1.5">(you)</span>}
        </p>
        <p className="font-sans text-xs text-slate-500">{leader.level || 'Aspirant'}</p>
      </div>
      <div className="text-right">
        <p className={`font-display font-bold text-sm ${isSelf ? 'text-violet-300' : 'text-slate-300'}`}>
          {(leader.totalScore || 0).toFixed(1)}
        </p>
        <p className="font-sans text-xs text-slate-500">XP</p>
      </div>
    </div>
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

  async function fetchLeaderboard(scope) {
    let showedCache = false;
    let cacheFresh = false;
    if (scope === 'weekly') {
      // 1. Check bootstrap cache first (dashboard already populated this, 24h TTL)
      const bootstrap = readCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, CACHE_TTL.ONE_DAY);
      if (bootstrap?.isFresh && bootstrap.data?.leaderboard?.weeklyTop?.length) {
        const leaders = bootstrap.data.leaderboard.weeklyTop;
        const self = session?.user?.email
          ? leaders.find(l => l.email === session.user.email) || null
          : null;
        setLeaders(leaders);
        setCurrentUser(self);
        setLoading(false);
        showedCache = true;
        cacheFresh = true; // bootstrap fresh = no need to re-fetch
      }

      // 2. Fall back to old leaderboard cache (30-min TTL)
      if (!showedCache) {
        const cached = readLeaderboardCache();
        if (cached?.top10?.length) {
          cacheFresh = isLeaderboardCacheFresh(cached);
          const cachedLeaders = cached.top10.map(toDisplayLeader);
          const cachedUser = cached.userRank ? toDisplayLeader(cached.userRank) : null;
          const userAlreadyInTop10 = cachedUser && cachedLeaders.some(l => l.email && l.email === cachedUser.email);
          setLeaders(userAlreadyInTop10 || !cachedUser ? cachedLeaders : [...cachedLeaders, cachedUser]);
          setCurrentUser(cachedUser);
          setLoading(false);
          showedCache = true;
        }
      }
    }

    if (cacheFresh) return;

    if (scope === 'weekly' && !claimLeaderboardRefresh()) {
      if (!showedCache) setError(true);
      setLoading(false);
      return;
    }

    if (!showedCache) setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/leaderboard?scope=${scope}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLeaders(data.leaders || []);
      setCurrentUser(data.currentUser || null);
      if (scope === 'weekly' && data.leaders?.length) {
        writeLeaderboardCache(buildLeaderboardCache({
          leaders: data.leaders,
          currentUser: data.currentUser || null,
        }));
      }
    } catch {
      if (!showedCache) setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeaderboard(activeTab); }, [activeTab]);


  const first  = leaders[0] || null;
  const second = leaders[1] || null;
  const third  = leaders[2] || null;
  const rest   = leaders.slice(3);

  return (
    <>
      <Head><title>Leaderboard — SSC GK Score Booster</title></Head>
      <div className="h-screen flex flex-col overflow-hidden pb-16">

        {/* Fixed header */}
        <div
          className="flex-shrink-0 px-4 pt-4 pb-4"
          style={{ background: 'linear-gradient(180deg, #2e1065 0%, #1e1b4b 100%)' }}
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
            <h1 className="absolute left-1/2 -translate-x-1/2 font-display font-black text-xl text-white leading-none whitespace-nowrap">
              Leaderboard
            </h1>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-white/10 rounded-full p-1 w-fit mx-auto">
            {[
              { key: 'weekly', label: 'This Week' },
              { key: 'all',    label: 'All Time' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-2 rounded-full text-sm font-display font-bold transition-all duration-200 active:scale-95 ${
                  activeTab === key
                    ? 'bg-white text-violet-700'
                    : 'text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto bg-[#0f172a]">

          {/* Podium */}
          <div
            className="px-4 pb-6 pt-4"
            style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)' }}
          >
            {loading ? (
              <div className="py-4">
                <Loader card size="md" label="Fetching rankings from the scoreboard…" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-white/60 text-sm mb-3">Could not load leaderboard.</p>
                <button
                  onClick={() => fetchLeaderboard(activeTab)}
                  className="px-6 py-2 bg-white text-violet-700 rounded-full text-xs font-display font-black uppercase"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-end justify-center gap-4">
                <PodiumEntry rank={2} user={second} />
                <PodiumEntry rank={1} user={first}  />
                <PodiumEntry rank={3} user={third}  />
              </div>
            )}
          </div>

          {/* Rank rows */}
          <div className="px-4 pt-3">

            {/* Current user rank (outside top 3) */}
            {currentUser && currentUser.rank > 3 && (
              <div className="bg-violet-900/40 border border-violet-500/40 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
                <span className="font-display font-black text-base text-violet-300 flex-shrink-0">
                  #{currentUser.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
                  <span className="font-display font-bold text-sm text-white">
                    {(currentUser.name || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13px] text-violet-200 truncate">
                    {truncateName(currentUser.name)}
                    <span className="font-sans text-xs text-violet-400 ml-1.5">(you)</span>
                  </p>
                  <p className="font-sans text-xs text-slate-500">Your rank this period</p>
                </div>
                <p className="font-display font-bold text-sm text-violet-300">
                  {(currentUser.totalScore || 0).toFixed(1)} XP
                </p>
              </div>
            )}

            {/* Not on leaderboard */}
            {!loading && !currentUser && session && (
              <p className="text-slate-500 text-[12px] text-center mb-3">
                Play a quiz to appear on the leaderboard!
              </p>
            )}

            {/* Guest sign-in */}
            {!session && (
              <GoogleSignInCard
                className="mb-3"
                title="Save your rank"
                subtitle="Sign in to appear on the leaderboard"
                buttonText="Sign in"
                callbackUrl="/leaderboard"
              />
            )}

            {/* Rank 4+ */}
            {!loading && !error && rest.length > 0 && (
              <>
                <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-wider mb-2 ml-1">
                  Rank 4 and beyond
                </p>
                {rest.map(leader => (
                  <RankRow
                    key={leader.email || leader.rank}
                    leader={leader}
                    isSelf={leader.email === session?.user?.email}
                  />
                ))}
              </>
            )}

            {!loading && !error && leaders.length === 0 && (
              <div className="text-center py-12">
                <span className="text-4xl">🏆</span>
                <p className="text-slate-500 text-[13px] mt-3">No scores yet. Be the first to play!</p>
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>
      </div>


      {/* Challenge Your Friends sheet */}
    </>
  );
}
