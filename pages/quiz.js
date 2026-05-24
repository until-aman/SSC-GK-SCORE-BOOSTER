import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';

const GK_FACTS = [
  { label: 'Did you know?',  fact: 'The first Census in India was conducted in 1872.' },
  { label: 'Quick GK Bite', fact: 'The Planning Commission was replaced by NITI Aayog in 2015.' },
  { label: 'Memory Trick',  fact: 'Article 32 is called the heart and soul of the Constitution.' },
  { label: 'SSC Tip',       fact: 'Static GK improves fastest with repeated revision, not one-time reading.' },
  { label: 'Quick Fact',    fact: 'The Battle of Plassey was fought in 1757.' },
  { label: 'Polity Bite',   fact: 'The President of India is the constitutional head of the Union.' },
  { label: 'History Hack',  fact: 'The Revolt of 1857 is also called the First War of Independence.' },
  { label: 'Geography',     fact: 'The Tropic of Cancer passes through 8 Indian states.' },
  { label: 'Economy',       fact: 'India became the 5th largest economy in the world in 2022.' },
  { label: 'Science',       fact: 'Vitamin C deficiency causes Scurvy.' },
];

function DailyChallengeLoader() {
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex(i => (i + 1) % GK_FACTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const fact = GK_FACTS[factIndex];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 28px',
      background: '#0f172a',
      gap: '24px',
      width: '100%',
    }}>
      <div style={{
        width: '48px', height: '48px',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #f97316',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display, inherit)',
          fontSize: '18px',
          fontWeight: '800',
          color: '#ffffff',
          marginBottom: '6px',
        }}>
          Preparing your Daily Challenge...
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
          Mixing today&apos;s 25 GK questions for you
        </div>
      </div>
      <div style={{
        background: '#1a1a2a',
        borderRadius: '18px',
        padding: '18px 20px',
        width: '100%',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
          color: '#f97316',
          marginBottom: '8px',
        }}>
          {fact.label}
        </div>
        <div style={{
          fontSize: '14px',
          color: '#ffffff',
          lineHeight: '1.55',
          fontWeight: '500',
        }}>
          {fact.fact}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
    } else {
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.4;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      source.connect(gain); gain.connect(ctx.destination);
      source.start();
    }
  } catch {}
}

function QuizBulb({ state }) {
  return (
    <div
      className={`fixed bottom-6 right-4 w-11 h-11 rounded-full flex items-center justify-center border z-30 ${
        state === 'correct' ? 'bulb-correct' :
        state === 'wrong'   ? 'bulb-wrong'   :
        'bg-slate-800/80 border-slate-700'
      }`}
    >
      <span className="text-xl leading-none select-none" style={{ filter: state === 'wrong' ? 'grayscale(0.6) brightness(0.7)' : state === 'correct' ? 'brightness(1.3)' : 'brightness(0.6)' }}>
        💡
      </span>
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calculateResults(questions, answers) {
  let correct = 0, incorrect = 0, skipped = 0;
  questions.forEach(q => {
    const a = answers[q.id];
    if (!a || a === 'SKIPPED') skipped++;
    else if (a === q.correctOption) correct++;
    else incorrect++;
  });
  const total = questions.length;
  const rawScore = correct * 2 - incorrect * 0.5;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;
  return { correct, incorrect, skipped, totalQuestions: total, rawScore, accuracy };
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS   = ['optionA', 'optionB', 'optionC', 'optionD'];

function TimerRing({ timeLeft, duration = 20 }) {
  const SIZE   = 52;
  const RADIUS = 20;
  const CIRC   = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - timeLeft / duration);

  const color = timeLeft >= 11 ? '#10b981'   // green  20–11 s
    : timeLeft >= 6            ? '#f59e0b'   // amber  10–6 s
    :                            '#ef4444';  // red     5–0 s

  const isPanic = timeLeft <= 5 && timeLeft > 0;

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: SIZE, height: SIZE,
        animation: isPanic ? 'timerPanic 0.55s ease-in-out infinite' : 'none',
      }}
    >
      <svg
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5"
        />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.35s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{
          fontFamily: 'var(--font-display, inherit)',
          fontSize: 15, fontWeight: 900, lineHeight: 1, color,
          transition: 'color 0.35s ease',
        }}>
          {timeLeft}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.3)', lineHeight: 1, marginTop: 1 }}>
          sec
        </span>
      </div>
    </div>
  );
}

function BookmarkIcon({ filled, size = 20, animKey }) {
  return filled ? (
    <svg
      key={animKey}
      width={size} height={size} viewBox="0 0 24 24"
      fill="#10b981" stroke="#10b981" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'bmPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  );
}

export default function Quiz() {
  const router = useRouter();
  const { status } = useSession();
  const { subject, topic, count, n, sessionId: qSessionId, mode, collection = 'general' } = router.query;
  const questionCount = count || n;
  const isSavedMode  = mode === 'saved';
  const isDailyMode  = mode === 'daily';
  const effectiveSubject = isSavedMode ? 'Saved' : isDailyMode ? 'Daily Challenge' : subject;
  const effectiveTopic   = isSavedMode ? 'Mixed'  : isDailyMode ? 'Mixed GK'        : topic;

  const [questions, setQuestions]       = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft]         = useState(20);
  const [sessionId, setSessionId]       = useState('');
  const [bulbState, setBulbState]       = useState('neutral'); // 'neutral' | 'correct' | 'wrong'
  const [savedIds, setSavedIds]         = useState(new Set());
  const [showGuestBanner, setShowGuestBanner] = useState(false);
  const [bookmarkFeedback, setBookmarkFeedback] = useState(null); // questionId being shown feedback
  const [bmAnimKey, setBmAnimKey]       = useState(0);
  const guestBannerShown = useRef(false);
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    if (!router.isReady) return;
    if (!isSavedMode && mode !== 'daily' && (!subject || !topic || !questionCount)) router.replace('/dashboard');
  }, [router.isReady, subject, topic, questionCount, isSavedMode, router]);

  // Load saved IDs for bookmark state
  useEffect(() => {
    if (status === 'loading') return;
    if (!isLoggedIn) return;
    fetch('/api/saved-questions/ids')
      .then(r => r.ok ? r.json() : { savedIds: [] })
      .then(d => setSavedIds(new Set(d.savedIds || [])))
      .catch(() => {});
  }, [status, isLoggedIn]);

  async function handleBookmarkToggle(question) {
    if (!isLoggedIn) {
      // Guest: use localStorage
      try {
        const existing = JSON.parse(localStorage.getItem('ssc_saved_questions') || '[]');
        const alreadySaved = existing.some(q => q.questionId === question.id);
        let updated;
        if (alreadySaved) {
          updated = existing.filter(q => q.questionId !== question.id);
          setSavedIds(prev => { const n = new Set(prev); n.delete(question.id); return n; });
        } else {
          updated = [...existing, {
            questionId:    question.id,
            subject:       question.subject,
            topic:         question.topic,
            question:      question.question,
            optionA:       question.optionA,
            optionB:       question.optionB,
            optionC:       question.optionC,
            optionD:       question.optionD,
            correctOption: question.correctOption,
            explanation:   question.explanation || '',
          }];
          setSavedIds(prev => new Set([...prev, question.id]));
          setBmAnimKey(k => k + 1);
          setBookmarkFeedback(question.id);
          setTimeout(() => setBookmarkFeedback(null), 1200);
          // Show guest sign-in nudge banner once per session
          if (!guestBannerShown.current) {
            guestBannerShown.current = true;
            setShowGuestBanner(true);
            setTimeout(() => setShowGuestBanner(false), 3000);
          }
        }
        localStorage.setItem('ssc_saved_questions', JSON.stringify(updated));
      } catch {}
      return;
    }

    // Logged-in: use API
    const isSaved = savedIds.has(question.id);
    if (isSaved) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(question.id); return n; });
      try {
        await fetch('/api/saved-questions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId: question.id }),
        });
      } catch {
        setSavedIds(prev => new Set([...prev, question.id])); // rollback
      }
    } else {
      setSavedIds(prev => new Set([...prev, question.id]));
      setBmAnimKey(k => k + 1);
      setBookmarkFeedback(question.id);
      setTimeout(() => setBookmarkFeedback(null), 1200);
      try {
        const saveRes = await fetch('/api/saved-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId:    question.id,
            subject:       question.subject,
            topic:         question.topic,
            question:      question.question,
            optionA:       question.optionA,
            optionB:       question.optionB,
            optionC:       question.optionC,
            optionD:       question.optionD,
            correctOption: question.correctOption,
            explanation:   question.explanation || '',
          }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          console.error('[bookmark save failed]', saveRes.status, err);
          setSavedIds(prev => { const n = new Set(prev); n.delete(question.id); return n; }); // rollback
        }
      } catch {
        setSavedIds(prev => { const n = new Set(prev); n.delete(question.id); return n; }); // rollback
      }
    }
  }

  useEffect(() => {
    setSessionId(qSessionId || crypto.randomUUID());
  }, [qSessionId]);

  useEffect(() => {
    if (!router.isReady) return;

    if (mode === 'daily') {
      setLoading(true);
      (async () => {
        try {
          const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
          const cacheKey = `dc_${today}`;
          const cached = localStorage.getItem(cacheKey);

          if (cached) {
            const data = JSON.parse(cached);
            if (data.questions?.length) {
              setQuestions(data.questions.slice(0, 25));
              setLoading(false);
              return;
            }
          }

          const res = await fetch('/api/daily-challenge');
          const data = await res.json();

          if (!data.questions?.length) {
            setError('no-questions');
            setLoading(false);
            return;
          }

          localStorage.setItem(cacheKey, JSON.stringify(data));
          setQuestions(data.questions.slice(0, 25));
          setLoading(false);
        } catch {
          setError('fetch-failed');
          setLoading(false);
        }
      })();
      return;
    }

    if (isSavedMode) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('ssc_saved_quiz_questions') || '[]');
        if (!saved.length) { setError('no-questions'); setLoading(false); return; }
        setQuestions(shuffle(saved));
        setLoading(false);
      } catch { setError('fetch-failed'); setLoading(false); }
      return;
    }
    if (!subject || !topic || !questionCount) return;
    setLoading(true);

    const url = `/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&collection=${encodeURIComponent(collection)}`;

    async function fetchWithRetry(attemptsLeft) {
      try {
        const r = await fetch(url);
        const data = await r.json();
        if (data.questions?.length) {
          const pool = shuffle(data.questions).slice(0, parseInt(questionCount));
          setQuestions(pool);
          setLoading(false);
          return;
        }
        // Empty response — retry if attempts remain (cache may still be warming)
        if (attemptsLeft > 0) {
          setTimeout(() => fetchWithRetry(attemptsLeft - 1), 3000);
        } else {
          setError('no-questions');
          setLoading(false);
        }
      } catch {
        if (attemptsLeft > 0) {
          setTimeout(() => fetchWithRetry(attemptsLeft - 1), 3000);
        } else {
          setError('fetch-failed');
          setLoading(false);
        }
      }
    }

    fetchWithRetry(3);
  }, [router.isReady, subject, topic, questionCount, isSavedMode, mode]);

  useEffect(() => {
    if (loading || quizComplete || showFeedback || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, quizComplete, showFeedback]);

  useEffect(() => { setTimeLeft(20); setBulbState('neutral'); }, [currentIndex]);

  const finishQuiz = useCallback((finalAnswers) => {
    if (quizComplete) return;
    setQuizComplete(true);
    const results = calculateResults(questions, finalAnswers);

    // ── Write base results immediately and navigate — no AI wait ─────────────
    // The result page already has a fallback to fetch AI summary independently
    // (see result.js summaryLoading path). Navigating now removes the blocking
    // "Calculating…" screen that previously lasted 3–8 s waiting for AI calls.
    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: effectiveSubject, topic: effectiveTopic, questions, answers: finalAnswers,
      correct: results.correct, incorrect: results.incorrect, skipped: results.skipped,
      totalQuestions: results.totalQuestions, rawScore: results.rawScore, accuracy: results.accuracy,
      aiData: null, // result page fetches this on its own; patched below when ready
    }));

    router.push(
      `/result?subject=${encodeURIComponent(effectiveSubject)}&topic=${encodeURIComponent(effectiveTopic)}&sessionId=${sessionId}&correct=${results.correct}&incorrect=${results.incorrect}&skipped=${results.skipped}&total=${results.totalQuestions}&score=${results.rawScore}`
    );

    // ── Fire AI calls in the background ──────────────────────────────────────
    // When they complete, patch sessionStorage so the detailed-analysis page
    // can use per-question explanations without fetching again.
    const summaryPromise = fetch('/api/ai/summary', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: effectiveSubject, topic: effectiveTopic, totalQuestions: results.totalQuestions, correctAnswers: results.correct, incorrectAnswers: results.incorrect, skipped: results.skipped, rawScore: results.rawScore, accuracy: results.accuracy }),
    }).then(r => r.ok ? r.json() : null).then(d => d?.aiSummary || null).catch(() => null);

    const insightPromises = questions.map(q => {
      const ua = finalAnswers[q.id];
      if (!ua || ua === 'SKIPPED') {
        return fetch('/api/ai/tip', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q.question, correctOption: q.correctOption, correctOptionText: q[OPTION_KEYS[OPTION_LABELS.indexOf(q.correctOption)]], explanation: q.explanation, subject, topic }) })
          .then(r => r.ok ? r.json() : null).then(d => ({ id: q.id, text: d?.aiTip || null })).catch(() => ({ id: q.id, text: null }));
      }
      if (ua === q.correctOption) return Promise.resolve({ id: q.id, text: null });
      return fetch('/api/ai/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctOption: q.correctOption, userOption: ua, explanation: q.explanation, subject, topic }) })
        .then(r => r.ok ? r.json() : null).then(d => ({ id: q.id, text: d?.aiExplanation || null })).catch(() => ({ id: q.id, text: null }));
    });

    Promise.all([summaryPromise, Promise.all(insightPromises)])
      .then(([summary, insights]) => {
        try {
          const stored = JSON.parse(sessionStorage.getItem('quizResult') || '{}');
          stored.aiData = { summary, insights: Object.fromEntries(insights.map(i => [i.id, i.text])) };
          sessionStorage.setItem('quizResult', JSON.stringify(stored));
        } catch {}
      })
      .catch(() => {});
  }, [questions, subject, topic, sessionId, router, quizComplete, effectiveSubject, effectiveTopic]);

  const advanceQuestion = useCallback((newAnswers) => {
    const next = currentIndex + 1;
    if (next >= questions.length) { finishQuiz(newAnswers); return; }
    setCurrentIndex(next);
    setSelectedOption(null);
    setShowFeedback(false);
  }, [currentIndex, questions.length, finishQuiz]);

  useEffect(() => {
    if (timeLeft === 0 && !showFeedback && !quizComplete && questions.length > 0) {
      const q = questions[currentIndex];
      if (!q) return;
      const na = { ...answers, [q.id]: 'SKIPPED' };
      setAnswers(na);
      advanceQuestion(na);
    }
  }, [timeLeft, showFeedback, quizComplete, questions, currentIndex, answers, advanceQuestion]);

  function handleOptionSelect(label) {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const na = { ...answers, [q.id]: label };
    setAnswers(na);
    setSelectedOption(label);
    setShowFeedback(true);
    const correct = label === q.correctOption;
    setBulbState(correct ? 'correct' : 'wrong');
    playSound(correct ? 'correct' : 'wrong');
    setTimeout(() => advanceQuestion(na), 800);
  }

  function handleSkip() {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const na = { ...answers, [q.id]: 'SKIPPED' };
    setAnswers(na);
    setBulbState('neutral');
    advanceQuestion(na);
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a] px-4">
      <Head><title>Loading — SSC GK Score Booster</title></Head>
      {mode === 'daily' ? (
        <DailyChallengeLoader />
      ) : (
        <Loader card size="lg" label="Preparing your quiz… questions loading from sheet" />
      )}
    </div>
  );

  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center px-6 bg-[#0f172a]">
      <Head><title>Error — SSC GK Score Booster</title></Head>
      <p className="text-white font-display font-bold text-lg mb-4 text-center">
        {error === 'no-questions' ? 'No questions found for this topic.' : 'Could not load questions.'}
      </p>
      <button
        onClick={() => error === 'fetch-failed' ? window.location.reload() : router.push('/dashboard')}
        className="bg-emerald-500 text-white rounded-2xl py-3 px-6 font-bold"
      >
        {error === 'fetch-failed' ? 'Retry' : 'Go Back'}
      </button>
    </div>
  );

  if (quizComplete) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a] gap-4">
      <Head><title>Results — SSC GK Score Booster</title></Head>
      <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
      <p className="font-display font-bold text-lg text-white">Loading your results…</p>
    </div>
  );

  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">
      <Head><title>Q{currentIndex + 1} — SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes timerPanic {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.1); }
        }
        @keyframes bmPop {
          0%   { transform: scale(0.6); opacity: 0.4; }
          65%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes bmLabelIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes optCorrect {
          0%   { transform: scale(0.97); }
          55%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes optWrong {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-5px); }
          40%     { transform: translateX(5px); }
          60%     { transform: translateX(-3px); }
          80%     { transform: translateX(3px); }
        }
        .opt-btn {
          transition: transform 0.14s ease, box-shadow 0.14s ease,
                      border-color 0.14s ease, background 0.14s ease,
                      opacity 0.18s ease;
        }
        .opt-btn:not(:disabled):hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.28) !important;
          box-shadow: 0 6px 18px rgba(0,0,0,0.35) !important;
        }
        .opt-btn:not(:disabled):hover .opt-badge {
          background: rgba(255,255,255,0.18) !important;
          box-shadow: 0 0 10px rgba(255,255,255,0.15);
        }
        .opt-btn:not(:disabled):active {
          transform: scale(0.97) translateY(0) !important;
        }
      `}</style>

      {/* Guest bookmark banner */}
      {showGuestBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-slate-800 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-[400px] mx-auto">
          <span className="text-xl flex-shrink-0">🔖</span>
          <p className="font-sans font-medium text-sm text-slate-300 leading-snug flex-1">
            Saved! Sign in to sync across devices.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="px-4 pt-3 flex-shrink-0">
        {/* Row 1: subject · topic | Q X/Y | ⚡ Earn XP */}
        <div className="h-10 flex items-center justify-between">
          <span className="font-sans font-medium text-xs text-slate-400 truncate max-w-[150px]">
            {effectiveSubject} · {effectiveTopic}
          </span>
          <span className="font-display font-bold text-sm text-white">
            Q {currentIndex + 1}
            <span className="font-sans font-normal text-slate-500">/{questions.length}</span>
          </span>
          <span className="font-sans font-medium text-xs text-orange-400">⚡ Earn XP</span>
        </div>

        {/* Row 2: progress bar + completed count */}
        <div className="flex items-center gap-2 pb-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
            <div
              style={{
                height: '100%',
                width: `${(currentIndex / questions.length) * 100}%`,
                background: 'linear-gradient(90deg, #10b981, #34d399)',
                borderRadius: 999,
                transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
          <span className="font-sans font-semibold flex-shrink-0" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {currentIndex}/{questions.length}
          </span>
        </div>
      </div>

      {/* ── Quiz status row ── */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <TimerRing timeLeft={timeLeft} duration={20} />

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        <div className="flex flex-col gap-0.5 min-w-0">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Scoring
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>
            ⚡ +2 correct &nbsp;·&nbsp; <span style={{ color: '#f87171' }}>−0.5 wrong</span>
          </span>
        </div>
      </div>

      {/* Scrollable question area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* Question card */}
        <div className="bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-700/50 mt-3 relative">
          {/* Bookmark button */}
          <button
            onClick={() => handleBookmarkToggle(q)}
            className="absolute top-3 right-3 flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
            style={{ minWidth: 36, minHeight: 36, justifyContent: 'center' }}
            aria-label={savedIds.has(q.id) ? 'Remove bookmark' : 'Save question'}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{
                background: savedIds.has(q.id) ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.08)',
                border: savedIds.has(q.id) ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <BookmarkIcon filled={savedIds.has(q.id)} size={16} animKey={bmAnimKey} />
            </div>
            {bookmarkFeedback === q.id && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#10b981',
                whiteSpace: 'nowrap',
                animation: 'bmLabelIn 0.2s ease both',
              }}>
                Saved ✓
              </span>
            )}
          </button>

          <p className="font-display font-bold text-sm text-white leading-relaxed whitespace-pre-line pr-10">
            {q.question}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 mt-3">
          {OPTION_LABELS.map((label, idx) => {
            const optText    = q[OPTION_KEYS[idx]];
            const isSelected = selectedOption === label;
            const isCorrect  = label === q.correctOption;

            /* ── Row style ── */
            let rowStyle = {
              borderRadius: 16,
              padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', textAlign: 'left',
              cursor: showFeedback ? 'default' : 'pointer',
              background: 'rgba(30,41,59,0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
            };

            /* ── Badge style ── */
            let badgeStyle = {
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: 'var(--font-display,inherit)', fontWeight: 800, fontSize: 12,
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.65)',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
            };

            let extraAnim = {};
            let badgeContent = label; // A / B / C / D

            if (showFeedback) {
              if (isCorrect) {
                rowStyle = { ...rowStyle,
                  background: 'rgba(16,185,129,0.13)',
                  border: '1px solid #10b981',
                  boxShadow: '0 0 20px rgba(16,185,129,0.18)',
                  animation: 'optCorrect 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
                };
                badgeStyle = { ...badgeStyle,
                  background: '#10b981', color: '#fff',
                  boxShadow: '0 0 10px rgba(16,185,129,0.55)',
                };
                badgeContent = 'check';
              } else if (isSelected) {
                rowStyle = { ...rowStyle,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid #ef4444',
                  animation: 'optWrong 0.35s ease both',
                };
                badgeStyle = { ...badgeStyle,
                  background: '#ef4444', color: '#fff',
                };
              } else {
                rowStyle = { ...rowStyle, opacity: 0.32 };
              }
            }

            return (
              <button
                key={label}
                onClick={() => handleOptionSelect(label)}
                disabled={showFeedback}
                className="opt-btn"
                style={rowStyle}
              >
                <span className="opt-badge" style={badgeStyle}>
                  {badgeContent === 'check' ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', flex: 1, lineHeight: 1.5 }}>
                  {optText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Skip — only before answering */}
        {!showFeedback && (
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSkip}
              className="font-sans text-xs font-medium active:opacity-40 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.28)', padding: '6px 2px', minHeight: 36 }}
            >
              Not sure? Skip →
            </button>
          </div>
        )}


      </div>

      {/* Bulb indicator */}
      <QuizBulb state={bulbState} />
    </div>
  );
}
