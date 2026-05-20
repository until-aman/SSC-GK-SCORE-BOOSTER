import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';

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

// Simulated live activity feed entries
const ACTIVITY_FEED = [
  '🟢 Rahul from Bihar scored 18/20 in Polity',
  '🟢 Priya entered Top 50 on the leaderboard',
  '🟢 Aman achieved a 7-day streak 🔥',
  '🟢 Sneha scored 100% accuracy in Geography',
  '🟢 123 aspirants attempted History today',
  '🟢 Vikram beat his previous record in Economics',
  '🟢 Meena climbed to Rank #12 this week',
  '🟢 Arjun completed his daily challenge',
  '🟢 256 quizzes completed in the last hour',
  '🟢 Pooja answered 20/20 in Biology',
];

// Rotating daily challenge — deterministic by day of year
function getDailyChallenge() {
  const challenges = [
    { subject: 'History', topic: 'Ancient India', questions: 20, time: '10 mins' },
    { subject: 'Polity', topic: 'Fundamental Rights', questions: 20, time: '10 mins' },
    { subject: 'Geography', topic: 'Indian Rivers', questions: 20, time: '10 mins' },
    { subject: 'Economics', topic: 'Indian Budget', questions: 20, time: '10 mins' },
    { subject: 'Biology', topic: 'Human Body', questions: 20, time: '10 mins' },
    { subject: 'Current Affairs', topic: 'National Affairs', questions: 20, time: '10 mins' },
    { subject: 'Physics', topic: 'Laws of Motion', questions: 20, time: '10 mins' },
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return challenges[dayOfYear % challenges.length];
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [hasEntered, setHasEntered] = useState(false);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedCount, setSelectedCount] = useState(null);
  const [feedIndex, setFeedIndex] = useState(0);

  const dailyChallenge = getDailyChallenge();

  // Rotate live activity feed
  useEffect(() => {
    const interval = setInterval(() => {
      setFeedIndex(i => (i + 1) % ACTIVITY_FEED.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const availableSubjects = allData ? Object.keys(allData).map(name => ({
    name,
    icon: SUBJECT_META[name] || '📝'
  })) : [];

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

  function handleDailyChallenge() {
    router.push(`/quiz?subject=${encodeURIComponent(dailyChallenge.subject)}&topic=${encodeURIComponent(dailyChallenge.topic)}&n=${dailyChallenge.questions}`);
  }

  // ─── LANDING PAGE ────────────────────────────────────────────────────────
  if (!hasEntered) {
    if (status === 'loading') {
      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #111827 60%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ color: 'white', fontWeight: 700 }}>Loading...</div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #111827 60%, #1a1a2e 100%)', overflow: 'hidden', position: 'relative' }}>

        {/* ─── Floating background particles ─── */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {['🏛️', '🌍', '📜', '⚛️', '🧬', '📊', '🧪', '📰'].map((icon, i) => (
            <div key={i} style={{
              position: 'absolute',
              fontSize: 28,
              opacity: 0.07,
              top: `${10 + (i * 11) % 80}%`,
              left: `${5 + (i * 13) % 90}%`,
              animation: `float ${4 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
            }}>{icon}</div>
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes ticker {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(-100%); opacity: 0; }
          }
          @keyframes flamePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
        `}</style>

        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 1rem', paddingTop: '3rem', paddingBottom: '3rem', position: 'relative', zIndex: 1 }}>

          {/* ─── Logo + App Name ─── */}
          <div style={{ textAlign: 'center', marginBottom: '2rem', animation: 'fadeSlideUp 0.6s ease-out forwards' }}>
            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(255,124,26,0.15)', border: '1px solid rgba(255,124,26,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 0 40px rgba(255,124,26,0.2)' }}>
              <Image src="/images/logo.png" alt="Logo" width={56} height={56} style={{ objectFit: 'contain' }} priority />
            </div>
            <div style={{ display: 'inline-block', background: 'rgba(255,124,26,0.15)', border: '1px solid rgba(255,124,26,0.3)', borderRadius: 100, padding: '4px 14px', marginBottom: '1rem' }}>
              <span style={{ color: '#FF7C1A', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>India's SSC GK Arena</span>
            </div>
            <h1 style={{ color: 'white', fontSize: 32, fontWeight: 900, lineHeight: 1.15, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
              Crack SSC GK<br />
              <span style={{ color: '#FF7C1A' }}>One Daily Challenge</span><br />
              at a Time
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              Practice PYQs · Get AI explanations<br />Compete with aspirants across India
            </p>

            {/* ─── Social proof stats ─── */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {[
                { emoji: '🔥', text: '12,421 quizzes this week' },
                { emoji: '🏆', text: '3,281 active aspirants' },
                { emoji: '⚡', text: '100% free forever' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{s.emoji}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Live Activity Feed ─── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 16px', marginBottom: '1.5rem', overflow: 'hidden', height: 38 }}>
            <div key={feedIndex} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, animation: 'fadeSlideUp 0.4s ease-out forwards' }}>
              {ACTIVITY_FEED[feedIndex]}
            </div>
          </div>

          {/* ─── Daily Challenge Card ─── */}
          <div style={{ background: 'linear-gradient(135deg, #FF7C1A 0%, #FF6A00 100%)', borderRadius: 24, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 8px 32px rgba(255,124,26,0.4)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 6 }}>⚡ Today's Challenge</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 4 }}>
              {dailyChallenge.topic} Blitz
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: '1rem' }}>
              {dailyChallenge.questions} Questions · {dailyChallenge.time} · {dailyChallenge.subject}
            </div>
            <button
              onClick={handleDailyChallenge}
              style={{ width: '100%', background: 'white', color: '#FF6A00', borderRadius: 14, border: 'none', padding: '10px 0', fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em' }}
            >
              Compete Now →
            </button>
          </div>

          {/* ─── CTA Buttons ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
            <button
              onClick={() => session ? setHasEntered(true) : signIn('google')}
              style={{ width: '100%', background: '#FF7C1A', color: 'white', border: 'none', borderRadius: 18, padding: '14px 0', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,124,26,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              {session ? (
                `Start Quiz as ${session.user.name.split(' ')[0]} →`
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#fff" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#fff" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/><path fill="#fff" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Sign in & Start Quiz
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { signOut({ redirect: false }); setHasEntered(true); }}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Play as Guest
              </button>
              <button
                onClick={() => router.push('/leaderboard')}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 18, padding: '12px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                🏆 Leaderboard
              </button>
            </div>
          </div>

          {/* ─── Inspired by PARMAR ─── */}
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 500 }}>
            Inspired by <span style={{ color: 'rgba(255,124,26,0.6)' }}>PARMAR Sir</span> · Made with ❤️ for SSC aspirants
          </p>
        </div>
      </div>
    );
  }

  // ─── QUIZ SETUP PAGE ──────────────────────────────────────────────────────
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
                <span className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">{session.user.name}</span>
              </div>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="bg-white border border-gray-200 rounded-full py-1.5 px-3 flex items-center gap-2 text-xs font-semibold text-gray-700 hover:border-orange-400 hover:shadow-sm transition active:scale-[0.98]"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* ─── Guest notice ─── */}
        {status !== 'loading' && !session && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-700">
            ⚠️ Playing as Guest — your score won&apos;t be saved to the leaderboard
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-1">Quiz Setup</h1>
          </div>

          {/* ─── Step 1: Subject ─── */}
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
                <button onClick={() => window.location.reload()} className="text-xs font-semibold text-orange-700 hover:text-orange-900">Retry</button>
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

          {/* ─── Step 2: Topic ─── */}
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

          {/* ─── Step 3: Count ─── */}
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

          {/* ─── Start Button ─── */}
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
