import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

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
  const RADIUS = 28;
  const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - timeLeft / duration);
  const isWarning = timeLeft <= 7;

  return (
    <div className="relative w-20 h-20 mx-auto mt-4 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="5"/>
        <circle
          cx="36" cy="36" r={RADIUS}
          fill="none"
          stroke={isWarning ? '#f97316' : '#10b981'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display font-black text-xl ${isWarning ? 'text-orange-400' : 'text-white'}`}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}

function BookmarkIcon({ filled, size = 20 }) {
  return filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  );
}

export default function Quiz() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { subject, topic, count, n, sessionId: qSessionId, mode } = router.query;
  const questionCount = count || n;
  const isSavedMode = mode === 'saved';
  const effectiveSubject = isSavedMode ? 'Saved' : subject;
  const effectiveTopic   = isSavedMode ? 'Mixed' : topic;

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
  const guestBannerShown = useRef(false);
  const isLoggedIn = status === 'authenticated';

  useEffect(() => {
    if (!router.isReady) return;
    if (!isSavedMode && (!subject || !topic || !questionCount)) router.replace('/dashboard');
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
      if (guestBannerShown.current) return;
      try {
        const existing = JSON.parse(localStorage.getItem('savedQuestions') || '[]');
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
          // Show guest banner once per session
          if (!guestBannerShown.current) {
            guestBannerShown.current = true;
            setShowGuestBanner(true);
            setTimeout(() => setShowGuestBanner(false), 3000);
          }
        }
        localStorage.setItem('savedQuestions', JSON.stringify(updated));
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
      try {
        await fetch('/api/saved-questions', {
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
    fetch(`/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.questions?.length) { setError('no-questions'); setLoading(false); return; }
        const pool = shuffle(data.questions).slice(0, parseInt(questionCount));
        setQuestions(pool);
        setLoading(false);
      })
      .catch(() => { setError('fetch-failed'); setLoading(false); });
  }, [router.isReady, subject, topic, questionCount, isSavedMode]);

  useEffect(() => {
    if (loading || quizComplete || showFeedback || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, quizComplete, showFeedback]);

  useEffect(() => { setTimeLeft(20); setBulbState('neutral'); }, [currentIndex]);

  const finishQuiz = useCallback(async (finalAnswers) => {
    if (quizComplete) return;
    setQuizComplete(true);
    const results = calculateResults(questions, finalAnswers);

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

    const [summary, insights] = await Promise.all([summaryPromise, Promise.all(insightPromises)]);
    const aiData = { summary, insights: Object.fromEntries(insights.map(i => [i.id, i.text])) };

    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: effectiveSubject, topic: effectiveTopic, questions, answers: finalAnswers,
      correct: results.correct, incorrect: results.incorrect, skipped: results.skipped,
      totalQuestions: results.totalQuestions, rawScore: results.rawScore, accuracy: results.accuracy,
      aiData,
    }));

    router.push(
      `/result?subject=${encodeURIComponent(effectiveSubject)}&topic=${encodeURIComponent(effectiveTopic)}&sessionId=${sessionId}&correct=${results.correct}&incorrect=${results.incorrect}&skipped=${results.skipped}&total=${results.totalQuestions}&score=${results.rawScore}`
    );
  }, [questions, subject, topic, sessionId, router, quizComplete]);

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
    setTimeout(() => advanceQuestion(na), 600);
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
    <div className="h-screen flex flex-col bg-[#0f172a] px-4 pt-12">
      <Head><title>Loading — SSC GK Score Booster</title></Head>
      <div className="skeleton h-2 rounded-full mb-6" />
      <div className="skeleton h-20 rounded-3xl mb-4" />
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
      </div>
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

  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <div className="h-screen flex flex-col bg-[#0f172a] overflow-hidden">
      <Head><title>Q{currentIndex + 1} — SSC GK Score Booster</title></Head>

      {/* Guest bookmark banner */}
      {showGuestBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-slate-800 border border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-[400px] mx-auto">
          <span className="text-xl flex-shrink-0">🔖</span>
          <p className="font-sans font-medium text-sm text-slate-300 leading-snug flex-1">
            Saved! Sign in to sync across devices.
          </p>
        </div>
      )}

      {/* Top bar h-12 */}
      <div className="h-12 px-4 flex items-center justify-between flex-shrink-0">
        <span className="font-sans font-medium text-xs text-slate-400 truncate max-w-[180px]">
          {subject} · {topic}
        </span>
        <span className="font-display font-bold text-sm text-white">
          Q {currentIndex + 1}/{questions.length}
        </span>
        <span className="font-sans font-medium text-xs text-orange-400">⚡+10 XP</span>
      </div>

      {/* Progress bar h-1 */}
      <div className="h-1 bg-slate-800 flex-shrink-0">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${(currentIndex / questions.length) * 100}%` }}
        />
      </div>

      {/* Scrollable question area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <TimerRing timeLeft={timeLeft} duration={20} />

        {/* Question card */}
        <div className="bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-700/50 mt-4 relative">
          <button
            onClick={() => handleBookmarkToggle(q)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/60 active:scale-90 transition-transform"
            aria-label={savedIds.has(q.id) ? 'Remove bookmark' : 'Save question'}
          >
            <BookmarkIcon filled={savedIds.has(q.id)} size={16} />
          </button>
          <p className="font-display font-bold text-sm text-white leading-relaxed whitespace-pre-line pr-8">
            {q.question}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 mt-3">
          {OPTION_LABELS.map((label, idx) => {
            const optText   = q[OPTION_KEYS[idx]];
            const isSelected = selectedOption === label;
            const isCorrect  = label === q.correctOption;

            let rowCls   = 'rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all duration-100 active:scale-[0.98]';
            let badgeCls = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-xs';

            if (showFeedback) {
              if (isCorrect) {
                rowCls   += ' bg-emerald-500/15 border border-emerald-500';
                badgeCls += ' bg-emerald-500 text-white';
              } else if (isSelected) {
                rowCls   += ' bg-red-500/15 border border-red-500';
                badgeCls += ' bg-red-500 text-white';
              } else {
                rowCls   += ' bg-slate-800 border border-slate-700 opacity-40';
                badgeCls += ' bg-slate-700 text-slate-300';
              }
            } else {
              rowCls   += ' bg-slate-800 border border-slate-700';
              badgeCls += ' bg-slate-700 text-slate-300';
            }

            return (
              <button key={label} onClick={() => handleOptionSelect(label)} disabled={showFeedback} className={rowCls}>
                <span className={badgeCls}>{label}</span>
                <span className="font-sans font-medium text-sm text-white flex-1 text-left">{optText}</span>
              </button>
            );
          })}
        </div>

        {/* Skip */}
        <button
          onClick={handleSkip}
          disabled={showFeedback}
          className={`block w-full text-center py-3 mt-2 font-sans font-medium text-sm text-slate-500 ${showFeedback ? 'opacity-30 pointer-events-none' : ''}`}
        >
          Skip question →
        </button>
      </div>

      {/* Bulb indicator */}
      <QuizBulb state={bulbState} />
    </div>
  );
}
