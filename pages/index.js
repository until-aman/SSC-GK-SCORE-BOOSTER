import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import TopPerformers from '@/components/TopPerformers';

const SUBJECT_META = {
  'Polity': '🏛️',
  'Geography': '🌍',
  'Economics': '📊',
  'History': '📜',
  'Physics': '⚛️',
  'Chemistry': '🧪',
  'Biology': '🧬',
  'Current Affairs': '📰',
};

const QUESTION_COUNTS = [10, 20, 25, 30];

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [hasEntered, setHasEntered] = useState(false);
  const [allData, setAllData] = useState(null); // { Subject: { Topic: Count } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedCount, setSelectedCount] = useState(null);

  // Automatically enter if session exists
  // useEffect(() => {
  //   // If we're coming back with ?reset=true, don't auto-enter
  //   if (status === 'authenticated' && !router.query.reset) {
  //     setHasEntered(true);
  //   }
  // }, [status, router.query.reset]);

  // Fetch all subjects and topics on mount
  useEffect(() => {
    setLoading(true);
    fetch('/api/topics')
      .then(res => res.json())
      .then(data => {
        setAllData(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // Filter subjects to only those that exist in allData
  const availableSubjects = allData ? Object.keys(allData).map(name => ({
    name,
    icon: SUBJECT_META[name] || '📝'
  })) : [];

  // Filter topics based on selected subject
  const availableTopics = (selectedSubject && allData[selectedSubject]) 
    ? Object.entries(allData[selectedSubject]) 
    : [];

  const maxAvailable = (selectedSubject && selectedTopic) 
    ? allData[selectedSubject][selectedTopic] 
    : 0;

  const canStart = selectedSubject && selectedTopic && selectedCount;

  function handleStart() {
    if (!canStart) return;
    router.push(`/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(selectedTopic)}&n=${selectedCount}`);
  }

  // Show landing page by default, or during loading to prevent flash
  if (!hasEntered) {
    // Show loading state while session is being checked
    if (status === 'loading') {
      return (
        <Layout title="SSC GK Score Booster">
          <div className="page-wrapper">
            <div className="relative mx-auto w-full max-w-md px-4 py-10">
              <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-orange-200/30 via-transparent to-transparent blur-3xl rounded-full" />
              <div className="relative rounded-[2rem] bg-white/95 border border-white/80 shadow-[0_35px_80px_rgba(255,124,26,0.18)] backdrop-blur-xl px-8 py-10 text-center overflow-hidden">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-orange-50 text-5xl shadow-lg shadow-orange-200/70 animate-bounce">
                  📚
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-3">Loading SSC GK Score Booster...</h1>
                <p className="text-sm text-gray-500 mb-8">Preparing your quiz journey!</p>
                <div className="mx-auto flex h-3 w-32 items-center justify-between gap-2">
                  {[...Array(4)].map((_, i) => (
                    <span key={i} className="block h-3 w-3 rounded-full bg-orange-300 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Layout>
      );
    }

    return (
      <div className="page-wrapper">
        <div className="card-container text-center fade-in">
          <div className="mx-auto mb-5 w-24 h-24 rounded-3xl overflow-hidden bg-gray-50 shadow-sm flex items-center justify-center">
            <Image
              src="/images/logo.png"
              alt="Mascot"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1 tracking-tight uppercase">SSC GK Score Booster</h1>
          <p className="text-sm text-gray-500 mb-8 font-medium">Inspired by PARMAR Sir</p>

          <div className="space-y-2.5 mb-5">
            <button
              onClick={() => session ? setHasEntered(true) : signIn('google')}
              className="w-full bg-white border border-gray-200 rounded-[1.5rem] py-2.5 px-4 flex items-center justify-center gap-2.5 font-bold text-gray-700 hover:border-orange-400 hover:shadow-sm transition active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" className="mr-1"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              {session ? `Continue as ${session.user.name.split(' ')[0]}` : 'Sign in with Google'}
            </button>

            <div className="flex items-center gap-3 py-2 opacity-40">
              <div className="h-[1px] bg-gray-300 flex-1"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">or</span>
              <div className="h-[1px] bg-gray-300 flex-1"></div>
            </div>

            <button
              onClick={() => { signOut({ redirect: false }); setHasEntered(true); }}
              className="w-full bg-orange-50 rounded-[1.5rem] py-2.5 font-bold text-orange-600 hover:bg-orange-100 transition active:scale-[0.98]"
            >
              Play as Guest
            </button>
          </div>

          <p className="text-xs text-gray-400 font-medium">Made with <span className="text-red-500">❤️</span> to boost your marks in GK</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title="SSC GK SCORE BOOSTER — Prep Page" hideAuth={true}>
      <div className="card-container mx-auto fade-in">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">SSC GK SCORE BOOSTER</h1>
          </div>
          <div className="flex items-center justify-end gap-3 flex-shrink-0">
            {status === 'loading' ? (
              <div className="w-24 h-10 skeleton rounded-full" />
            ) : session ? (
              <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
                {session.user.image ? (
                  <img src={session.user.image} alt="Profile" className="w-9 h-9 rounded-full border border-gray-200" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">
                    {session.user.name?.charAt(0)}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">{session.user.name}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="bg-white border border-gray-200 rounded-full py-1.5 px-3 flex items-center gap-2 text-xs font-semibold text-gray-700 hover:border-orange-400 hover:shadow-sm transition active:scale-[0.98]"
              >
                <svg width="16" height="16" viewBox="0 0 48 48" className="mr-1"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* ─── Guest notice ───────────────────────────────────────── */}
        {status !== 'loading' && !session && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-700">
            ⚠️ Playing as Guest — your score won&apos;t be saved to the leaderboard
          </div>
        )}

        <TopPerformers />

        <div className="space-y-4">
          <div>
            <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-1">Quiz Setup</h1>
          </div>

          {/* ─── Step 1: Subject selector ─────────────────── */}
          <div className="fade-in">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.35em] mb-3">STEP 1 — SUBJECT</h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-20 w-full rounded-3xl" />
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center text-xs text-red-600">
                <p className="font-bold mb-2">Could not load subjects. Check your Google Sheet.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableSubjects.map(({ name, icon }) => (
                  <button
                    key={name}
                    onClick={() => {
                      setSelectedSubject(name === selectedSubject ? null : name);
                      setSelectedTopic(null);
                      setSelectedCount(null);
                    }}
                    className={`rounded-3xl border px-3 py-3 text-center transition duration-200 ${
                      selectedSubject === name
                        ? 'border-orange-600 bg-orange-50 shadow-sm scale-[1.01]'
                        : 'border-gray-100 bg-white hover:border-orange-300'
                    }`}
                  >
                    <span className="text-xl block mb-1">{icon}</span>
                    <span className={`text-[11px] font-bold ${selectedSubject === name ? 'text-orange-900' : 'text-gray-500'}`}>
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── Step 2: Topic selector ───────────────────── */}
          {selectedSubject && (
            <div className="fade-in">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.35em] mb-3">STEP 2 — TOPIC</h2>
              <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                {availableTopics.map(([topic, count]) => (
                  <button
                    key={topic}
                    onClick={() => {
                      setSelectedTopic(topic === selectedTopic ? null : topic);
                      setSelectedCount(null);
                    }}
                    className={`w-full text-left rounded-3xl border px-4 py-3 flex justify-between items-center transition duration-200 ${
                      selectedTopic === topic
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-100 bg-white hover:border-orange-300'
                    }`}
                  >
                    <span className={`text-[11px] font-bold ${selectedTopic === topic ? 'text-orange-900' : 'text-gray-500'}`}>
                      {topic}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 rounded-full px-2 py-0.5 font-bold">
                      {count} Qs
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 3: Number of questions ────────────────────────── */}
          {selectedTopic && (
            <div className="fade-in">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.35em] mb-3">STEP 3 — HOW MANY?</h2>
              <div className="grid grid-cols-4 gap-3">
                {QUESTION_COUNTS.map(n => {
                  const disabled = n > maxAvailable;
                  return (
                    <button
                      key={n}
                      disabled={disabled}
                      onClick={() => setSelectedCount(n === selectedCount ? null : n)}
                      className={`rounded-3xl border py-3 text-center text-[11px] font-bold transition duration-200 ${
                        disabled
                          ? 'border-gray-50 bg-gray-200/50 text-gray-300 cursor-not-allowed'
                          : selectedCount === n
                            ? 'border-orange-600 bg-orange-50 text-orange-900 shadow-sm'
                            : 'border-gray-100 bg-white text-gray-500 hover:border-orange-300'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Start Button ───────────────────────────────────────── */}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`w-full rounded-3xl py-3 font-black text-sm transition duration-300 ${
              canStart
                ? 'bg-[#FF7C1A] text-white hover:bg-[#FF6A00] shadow-lg shadow-[#FBD3BA] active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            {canStart ? '🚀 START QUIZ' : 'COMPLETE ALL STEPS TO START'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
