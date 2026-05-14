import Head from 'next/head';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Layout({ children, title = 'SSC GK SCORE BOOSTER — AI Prep', hideAuth = false }) {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF8C00] to-[#FF6B35] flex flex-col">
      <Head>
        <title>{title}</title>
        <meta name="description" content="Practice SSC CGL/CHSL GK questions with AI-powered explanations and performance tracking." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* ─── Global Auth Header (Phase 1.3) ────────────────────── */}
      {!hideAuth && (
        <div className="hidden sm:flex max-w-lg w-full mx-auto px-4 pt-4 flex justify-end">
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
              <div className="flex flex-col">
                <span className="typo-username truncate max-w-[80px]">
                  {session.user.name}
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="bg-white shadow-sm border border-gray-100 rounded-full px-4 py-1.5 typo-button text-gray-600 hover:bg-gray-50 transition active:scale-95 flex items-center gap-2 scale-90 origin-right"
            >
              <svg width="12" height="12" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in
            </button>
          )}
        </div>
      )}

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
