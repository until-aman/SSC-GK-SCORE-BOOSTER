import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import PodiumCard from '@/components/PodiumCard';

export default function Leaderboard() {
  const { data: session } = useSession();
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const top3 = [
    enrichedLeaderboard.find(p => p.rank === 2),
    enrichedLeaderboard.find(p => p.rank === 1),
    enrichedLeaderboard.find(p => p.rank === 3),
  ];

  const others = enrichedLeaderboard.filter(p => p.rank > 3);

  return (
    <Layout title="Final Scoreboard — SSC GK SCORE BOOSTER" hideAuth={true}>
      <div className="card-container mx-auto fade-in overflow-hidden !p-0 border-none shadow-2xl bg-[#FF7C1A]">
        
        {/* ─── Header Section (Warm Orange Gradient) ─── */}
        <div className="bg-gradient-to-br from-[#FFB075] via-[#FF8C00] to-[#FF7C1A] pt-10 pb-8 px-6 relative">
          <div className="flex items-center justify-between mb-10">
            <button 
              onClick={() => router.push('/result')}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition backdrop-blur-md"
            >
              <span className="text-xl font-bold">✕</span>
            </button>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">Final Scoreboard</h1>
            <div className="w-10" />
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
          ) : (
            <div className="flex items-end justify-center gap-2 h-[380px] pb-4">
              <PodiumCard performer={top3[0]} rank={2} />
              <PodiumCard performer={top3[1]} rank={1} />
              <PodiumCard performer={top3[2]} rank={3} />
            </div>
          )}
        </div>

        {/* ─── List Section (Clean White Card) ─── */}
        <div className="bg-white rounded-t-[3rem] -mt-10 relative z-20 min-h-[500px] shadow-[0_-15px_50px_rgba(0,0,0,0.1)]">
          {!loading && !error && (
            <div className="px-2">
              <div className="divide-y divide-gray-100">
                {others.length === 0 && leaderboard.length <= 3 && (
                  <div className="p-20 text-center text-sm text-gray-400 font-medium">
                    Play a quiz to appear here!
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
                           ({p.totalQuestionsAttempted} Attempts)
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
                    className="w-full bg-[#FF7C1A] text-white rounded-2xl py-4 font-black text-sm shadow-xl shadow-[#FBD3BA] active:scale-95 transition"
                  >
                    SIGN IN WITH GOOGLE
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
                    Share Results
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
              
              <div className="h-4" /> {/* Bottom spacer */}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
