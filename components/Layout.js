import Head from 'next/head';
import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function Layout({ children, title = 'SSC GK SCORE BOOSTER — AI Prep', hideAuth = false }) {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState({ streak: 0, xp: 0, rank: null });

  // Load streak/XP from localStorage (updated by quiz result)
  useEffect(() => {
    if (session?.user?.email) {
      try {
        const saved = localStorage.getItem(`ssc_stats_${session.user.email}`);
        if (saved) setStats(JSON.parse(saved));
      } catch {}
    }
  }, [session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF8C00] to-[#FF6B35] flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Practice SSC CGL/CHSL GK questions with AI-powered explanations and performance tracking." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* ─── Global Navbar ────────────────────────────────────────────── */}
      {!hideAuth && (
        <div className="w-full max-w-lg mx-auto px-4 pt-4 flex justify-between items-center">
          {/* Gamification stats — only for signed-in users */}
          {status === 'authenticated' && session ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/30">
                <span className="text-sm" style={{ animation: 'flamePulse 2s ease-in-out infinite' }}>🔥</span>
                <span className="text-white text-[11px] font-black">{stats.streak || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/30">
                <span className="text-sm">⚡</span>
                <span className="text-white text-[11px] font-black">{stats.xp || 0} XP</span>
              </div>
              {stats.rank && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/30">
                  <span className="text-sm">🏆</span>
                  <span className="text-white text-[11px] font-black">#{stats.rank}</span>
                </div>
              )}
            </div>
          ) : (
            <div />
          )}

          {/* Auth section */}
          {status === 'loading' ? (
            <div className="w-20 h-8 skeleton rounded-lg" />
          ) : session ? (
            <div className="flex items-center gap-2 bg-white shadow-sm border border-gray-100 rounded-full pl-1 pr-3 py-1 scale-90 origin-right">
              {session.user.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border border-gray-100" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">
                  {session.user.name?.charAt(0)}
                </div>
              )}
              <span className="typo-username truncate max-w-[80px]">{session.user.name?.split(' ')[0]}</span>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="bg-white shadow-sm border border-gray-100 rounded-full px-4 py-1.5 typo-button text-gray-600 hover:bg-gray-50 transition active:scale-95 flex items-center gap-2"
            >
              Sign in
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes flamePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="w-full max-w-lg mx-auto px-4 pb-8 text-center">
        <p className="typo-small-label text-white/80">
          Made with <span className="text-red-400">❤️</span> to boost your marks in GK
        </p>
      </footer>
    </div>
  );
}
