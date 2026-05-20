import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import PodiumCard from '@/components/PodiumCard';

const TABS = ['Daily', 'Weekly', 'All-Time'];

function filterByTab(leaderboard, tab) {
  if (tab === 'All-Time') return leaderboard;

  const now = new Date();
  const cutoff = new Date();

  if (tab === 'Daily') {
    cutoff.setHours(0, 0, 0, 0); // midnight today
  } else if (tab === 'Weekly') {
    const day = now.getDay(); // 0 = Sunday
    cutoff.setDate(now.getDate() - day);
    cutoff.setHours(0, 0, 0, 0);
  }

  // Filter entries where timestamp >= cutoff, then re-rank
  const filtered = leaderboard.filter(p => {
    if (!p.timestamp) return false;
    const ts = new Date(p.timestamp);
    return ts >= cutoff;
  });

  // Re-aggregate by user (best score per user in the window)
  const byEmail = {};
  filtered.forEach(p => {
    if (!byEmail[p.email] || p.score > byEmail[p.email].score) {
      byEmail[p.email] = p;
    }
  });

  return Object.values(byEmail)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export default function Leaderboard() {
  const { data: session } = useSession();
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('Weekly');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const userEmail = session?.user?.email;
  const userImage = session?.user?.image;

  const enrichedLeaderboard = leaderboard.map(p => {
    if (p.email === userEmail && userImage) {
      return { ...p, image: userImage };
    }
    return p;
  });

  const filtered = filterByTab(enrichedLeaderboard, activeTab);

  const top3 = [
    filtered.find(p => p.rank === 2),
    filtered.find(p => p.rank === 1),
    filtered.find(p => p.rank === 3),
  ];

  const others = filtered.filter(p => p.rank > 3);

  return (
    <Layout title="Leaderboard — SSC GK SCORE BOOSTER" hideAuth={true}>
      <div className="card-container mx-auto fade-in overflow-hidden !p-0 border-none shadow-2xl bg-[#FF7C1A]">

        {/* ─── Header Section ─── */}
        <div className="bg-gradient-to-br from-[#FFB075] via-[#FF8C00] to-[#FF7C1A] pt-10 pb-8 px-6 relative">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/result')}
              className="w-10 h-10 rounded-full bg-white border border-white flex items-center justify-center text-orange-600 hover:bg-gray-100 transition shadow-sm"
            >
              <span className="text-xl font-bold">✕</span>
            </button>
            <h1 className="text-lg font-black text-white tracking-widest uppercase">Leaderboard</h1>
            <div className="w-10" />
          </div>

          {/* ─── Tab Switcher ─── */}
          <div className="flex bg-black/20 rounded-2xl p-1 mb-6">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-xl text-xs font-black tracking-wider transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {tab === 'Daily' ? '🌅 Daily' : tab === 'Weekly' ? '⚡ Weekly' : '🏆 All-Time'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-24">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-white/10 p-6 rounded-[2rem] text-center text-white font-bold backdrop-blur-md">
              <p className="mb-4">Could not load leaderboard.</p>
              <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-orange-600 rounded-full text-xs font-black uppercase">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white/10 p-8 rounded-[2rem] text-center text-white/80 font-bold backdrop-blur-md">
              <div className="text-4xl mb-3">🏁</div>
              <p className="text-sm">No attempts {activeTab === 'Daily' ? 'today' : activeTab === 'Weekly' ? 'this week' : 'yet'}.</p>
              <p className="text-xs text-white/50 mt-1">Be the first to compete!</p>
            </div>
          ) : (
            <div className="flex items-end justify-center gap-2 h-[320px] pb-4">
              <PodiumCard performer={top3[0]} rank={2} session={session} />
              <PodiumCard performer={top3[1]} rank={1} session={session} />
              <PodiumCard performer={top3[2]} rank={3} session={session} />
            </div>
          )}
        </div>

        {/* ─── List Section ─── */}
        <div className="bg-white rounded-t-[3rem] -mt-10 relative z-20 min-h-[500px] shadow-[0_-15px_50px_rgba(0,0,0,0.1)]">
          {!loading && !error && (
            <div className="px-2">
              <div className="divide-y divide-gray-100">
                {others.length === 0 && filtered.length <= 3 && filtered.length > 0 && (
                  <div className="p-10 text-center text-sm text-gray-400 font-medium">
                    Only top 3 aspirants so far — play to join the list!
                  </div>
                )}
                {others.map((p) => {
                  const isUser = p.email === userEmail;
                  return (
                    <div
                      key={p.rank}
                      className={`flex items-center gap-4 px-8 py-6 transition hover:bg-gray-50/80 ${isUser ? 'bg-orange-50/40' : ''}`}
                    >
                      <div className="w-8 text-base font-black text-gray-400">{p.rank}</div>

                      <div className="relative flex-shrink-0">
                        <img
                          src={p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`}
                          alt=""
                          className="w-14 h-14 rounded-full shadow-md border-2 border-white object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-base font-bold truncate ${isUser ? 'text-orange-900' : 'text-gray-800'}`}>
                          {p.name}
                        </p>
                        {isUser && <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">You</span>}
                      </div>

                      <div className="text-right flex flex-col gap-0.5">
                        <span className={`text-lg font-black ${isUser ? 'text-orange-600' : 'text-gray-900'}`}>
                          {Number(p.score).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          (<span className="font-black text-gray-500">{p.totalQuestionsAttempted}</span> Q attempted)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!session && (
                <div className="p-10 text-center bg-gray-50/20">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Sign in to claim your rank</p>
                  <button
                    onClick={() => signIn('google')}
                    className="w-full bg-white border border-gray-200 rounded-[1.5rem] py-2.5 px-4 flex items-center justify-center gap-2.5 font-bold text-gray-700 hover:border-orange-400 hover:shadow-sm transition active:scale-[0.98]"
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48" className="mr-1"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                    Sign in with Google
                  </button>
                </div>
              )}

              {/* ─── Share Section ─── */}
              <div className="px-8 py-10 bg-gray-50/30 rounded-b-[3rem] border-t border-gray-50">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">Challenge Your Friends</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const message = `Check out the SSC GK SCORE BOOSTER Leaderboard! Can you beat the top scorers? ${window.location.origin}/leaderboard`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="flex-1 bg-[#00D22D] text-white rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-sm shadow-lg active:scale-[0.98] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    Share
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/leaderboard`);
                      alert('Leaderboard link copied!');
                    }}
                    className="w-1/4 bg-white border border-gray-200 text-gray-700 rounded-2xl py-3 flex items-center justify-center gap-2 font-bold text-sm shadow-sm active:scale-[0.98] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copy
                  </button>
                </div>
              </div>

              <div className="h-4" />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
