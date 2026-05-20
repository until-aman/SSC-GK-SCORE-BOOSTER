import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BottomNav from '@/components/BottomNav';

const SUBJECTS = [
  'Polity', 'Geography', 'Economics', 'History',
  'Physics', 'Chemistry', 'Biology', 'Current Affairs',
];

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('userMode=guest'));
}

export default function QuizSetup() {
  const { status } = useSession();
  const router = useRouter();

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [selectedCount, setSelectedCount] = useState(10);

  const isGuest = status === 'unauthenticated' && isGuestMode();
  const isLoggedIn = status === 'authenticated';
  const isReady = !!selectedSubject && !!selectedTopic;

  // Redirect if not authorised
  useEffect(() => {
    if (status === 'loading') return;
    if (!isGuest && !isLoggedIn) router.replace('/');
  }, [status, isGuest, isLoggedIn, router]);

  // Pre-select subject from query param (e.g. from subject cards)
  useEffect(() => {
    if (!router.isReady) return;
    const { subject } = router.query;
    if (subject && SUBJECTS.includes(subject)) {
      setSelectedSubject(subject);
      fetchTopics(subject);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  async function fetchTopics(subject) {
    setTopicsLoading(true);
    setTopics([]);
    setSelectedTopic('');
    try {
      const res = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      if (data.topics) {
        setTopics(data.topics);
      } else if (data[subject]) {
        const parsed = Object.entries(data[subject]).map(([name, count]) => ({ name, count }));
        setTopics(parsed);
      } else {
        const allTopics = Object.entries(data)
          .filter(([k]) => k !== 'error')
          .flatMap(([, subjectTopics]) =>
            typeof subjectTopics === 'object'
              ? Object.entries(subjectTopics).map(([name, count]) => ({ name, count }))
              : []
          );
        setTopics(allTopics);
      }
    } catch {
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }

  function handleSubjectChange(e) {
    const val = e.target.value;
    setSelectedSubject(val);
    setSelectedTopic('');
    setTopics([]);
    if (val) fetchTopics(val);
  }

  function handleStartQuiz() {
    if (!isReady) return;
    const sessionId = crypto.randomUUID();
    router.push(
      `/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(selectedTopic)}&count=${selectedCount}&sessionId=${sessionId}`
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head><title>Quiz Setup — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-slate-900 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-10 pb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white flex-shrink-0 active:scale-95 transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="font-display font-black text-2xl text-white">Quiz Setup</h1>
            <p className="text-slate-400 text-xs mt-0.5">Choose your topic and get started</p>
          </div>
        </div>

        <div className="px-4 flex flex-col gap-4">

          {/* Question count */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Number of Questions
            </p>
            <div className="flex gap-3">
              {[
                { count: 10, label: 'Quick', duration: '~3 min', icon: '⚡' },
                { count: 25, label: 'Full',  duration: '~8 min', icon: '🎯' },
              ].map(({ count, label, duration, icon }) => {
                const sel = selectedCount === count;
                return (
                  <button
                    key={count}
                    onClick={() => setSelectedCount(count)}
                    className={`flex-1 rounded-2xl p-4 text-left transition-all duration-200 ${
                      sel
                        ? 'bg-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.4)] scale-[1.02]'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <p className={`font-display font-black text-3xl mt-1 ${sel ? 'text-white' : 'text-slate-200'}`}>
                      {count}Q
                    </p>
                    <p className={`text-xs font-bold mt-0.5 ${sel ? 'text-white/80' : 'text-slate-400'}`}>
                      {label} · {duration}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">
              Subject
            </label>
            <div className="relative">
              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="w-full bg-slate-800 text-white rounded-2xl px-4 py-4 text-sm border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none appearance-none"
              >
                <option value="">— Choose a subject —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 block">
              Topic
            </label>
            {topicsLoading ? (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-slate-400 text-sm flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                Loading topics…
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  disabled={!selectedSubject}
                  className={`w-full bg-slate-800 text-white rounded-2xl px-4 py-4 text-sm border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none appearance-none ${
                    !selectedSubject ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">— Choose a topic —</option>
                  {topics.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.count} Q)</option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            )}
            {selectedTopic && topics.length > 0 && (
              <p className="text-xs text-slate-500 mt-1.5 ml-1">
                {topics.find(t => t.name === selectedTopic)?.count || 0} questions available
              </p>
            )}
          </div>

          {/* Info strip */}
          {isReady && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3 animate-fade-in-down">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-white text-sm font-semibold">{selectedSubject} · {selectedTopic}</p>
                <p className="text-slate-400 text-xs">{selectedCount} questions · +2 per correct, −0.5 per wrong</p>
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStartQuiz}
            disabled={!isReady}
            className={`w-full py-4 rounded-2xl font-display font-bold text-base transition-all flex items-center justify-center gap-2 ${
              isReady
                ? 'bg-emerald-500 text-white btn-breathe active:scale-95 duration-100 shadow-cta'
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isReady ? 'Start Quiz' : 'Select subject & topic'}
            {isReady && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>

        </div>
      </div>

      <BottomNav />
    </>
  );
}
