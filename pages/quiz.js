import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';
import { readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

const GK_FACTS = [
  // GK Facts
  { label: '💡 GK Fact',    fact: 'The Constitution of India came into effect on 26 January 1950.' },
  { label: '💡 GK Fact',    fact: 'Article 32 is called the heart and soul of the Constitution — Dr. B.R. Ambedkar.' },
  { label: '💡 GK Fact',    fact: 'The Battle of Plassey in 1757 established British dominance in India.' },
  { label: '💡 GK Fact',    fact: 'The Tropic of Cancer passes through 8 Indian states.' },
  { label: '💡 GK Fact',    fact: 'GST was implemented in India on 1 July 2017, replacing multiple indirect taxes.' },
  { label: '💡 GK Fact',    fact: 'The Planning Commission was replaced by NITI Aayog in January 2015.' },
  { label: '💡 GK Fact',    fact: 'Vitamin C deficiency causes Scurvy; Vitamin D deficiency causes Rickets.' },
  { label: '💡 GK Fact',    fact: 'The Rajya Sabha cannot be dissolved — one-third of members retire every two years.' },
  { label: '💡 GK Fact',    fact: 'India became the 5th largest economy in the world in 2022, surpassing the UK.' },
  { label: '💡 GK Fact',    fact: 'The Non-Cooperation Movement was launched by Gandhi in 1920.' },
  // Memory Tips
  { label: '🧠 Memory Tip', fact: 'For Static GK, revise through questions. Passive reading is not enough.' },
  { label: '🧠 Memory Tip', fact: 'Link new facts to things you already know — the brain stores by association.' },
  { label: '🧠 Memory Tip', fact: 'Revise a topic 3 times: once right after, once the next day, once after a week.' },
  { label: '🧠 Memory Tip', fact: 'Wrong answers are more memorable than right ones — always review your mistakes.' },
  { label: '🧠 Memory Tip', fact: 'Group similar facts: e.g., all constitutional articles about Fundamental Rights together.' },
  // Exam Tips
  { label: '⚡ Exam Tip',   fact: "Don't spend too long on one GK question. Either you know it, or move on." },
  { label: '⚡ Exam Tip',   fact: 'Negative marking is −0.5 per wrong answer. Skip if you\'re less than 60% sure.' },
  { label: '⚡ Exam Tip',   fact: 'In SSC CGL, GK is the easiest section to score high with consistent preparation.' },
  { label: '⚡ Exam Tip',   fact: 'Read the question fully before looking at options — one word changes the answer.' },
  { label: '⚡ Exam Tip',   fact: 'Current Affairs from the last 6 months carry the most weight in SSC exams.' },
  // Strategy
  { label: '🎯 Strategy',   fact: 'Attempt easy GK questions first to save time for Maths and Reasoning.' },
  { label: '🎯 Strategy',   fact: 'Daily 20-minute focused revision beats 3-hour weekend cramming every time.' },
  { label: '🎯 Strategy',   fact: 'Focus on high-frequency topics: Polity, Geography, and Current Affairs repeat most.' },
  { label: '🎯 Strategy',   fact: 'Track your weak subjects. Improve accuracy there first — it has the highest ROI.' },
  { label: '🎯 Strategy',   fact: 'Solving previous year questions (PYQs) is the fastest way to spot exam patterns.' },
];

const PROGRESS_STAGES = [
  { target: 18, duration: 1200, label: 'Selecting subject' },
  { target: 48, duration: 2800, label: 'Fetching exam-style questions' },
  { target: 74, duration: 2200, label: 'Preparing options' },
  { target: 90, duration: 1600, label: 'Setting timer' },
  { target: 95, duration: 1000, label: 'Starting quiz' },
];

function getLoadingTitle(subject, mode) {
  if (mode === 'daily') return 'Building your Daily Challenge…';
  const s = (subject || '').trim();
  if (!s || s.toLowerCase() === 'mixed' || s.toLowerCase() === 'general') return 'Building your GK challenge…';
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  return `Building your ${cap} challenge…`;
}

function GKFactCarousel({ subject, mode, accentColor = '#10B981' }) {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * GK_FACTS.length));
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [subtext, setSubtext] = useState('Preparing questions, timer and XP');

  useEffect(() => {
    const iv = setInterval(() => setFactIndex(i => (i + 1) % GK_FACTS.length), 2500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setSubtext('Still preparing your quiz…'), 5000);
    const t2 = setTimeout(() => setSubtext('Almost there, setting up your challenge…'), 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    let rafId;
    let si = 0;
    let stageStart = null;
    let from = 0;

    function tick(now) {
      if (si >= PROGRESS_STAGES.length) return;
      const stage = PROGRESS_STAGES[si];
      if (!stageStart) stageStart = now;
      const t = Math.min((now - stageStart) / stage.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(from + (stage.target - from) * eased);
      setStageIdx(si);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        from = stage.target;
        si++;
        stageStart = null;
        if (si < PROGRESS_STAGES.length) rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const fact = GK_FACTS[factIndex];
  const title = getLoadingTitle(subject, mode);
  const pct = Math.round(progress);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 22px', background: '#0f172a',
      width: '100%', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <p style={{ fontFamily: 'var(--font-display,inherit)', fontSize: 20, fontWeight: 800, color: '#F8FAFC', marginBottom: 6, lineHeight: 1.25 }}>
          {title}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.45 }}>
          {subtext}
        </p>
      </div>

      {/* Progress bar with glow */}
      <div style={{ width: '100%', marginBottom: 18 }}>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 7, overflow: 'visible', position: 'relative' }}>
          <div style={{
            height: '100%', borderRadius: 8,
            background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})`,
            width: `${progress}%`,
            transition: 'width 0.08s linear',
            boxShadow: pct > 2 ? `0 0 14px ${accentColor}55, 0 0 5px ${accentColor}77` : 'none',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {PROGRESS_STAGES[stageIdx]?.label ?? 'Starting quiz'}
          </span>
          <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>

      {/* Stage checklist */}
      <div style={{
        width: '100%', background: '#111827', borderRadius: 16,
        padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {PROGRESS_STAGES.map((stage, i) => {
          const done   = i < stageIdx;
          const active = i === stageIdx;
          return (
            <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Icon */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? `${accentColor}22` : active ? `${accentColor}15` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${done ? accentColor + '55' : active ? accentColor : 'rgba(255,255,255,0.10)'}`,
              }}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <polyline points="1.5,5.5 4,8 8.5,2" stroke={accentColor} strokeWidth="1.8"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : active ? (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, animation: 'ldPulse 1.2s ease-in-out infinite' }} />
                ) : null}
              </div>
              {/* Label */}
              <span style={{
                fontSize: 13, fontWeight: active ? 600 : 400, flex: 1,
                color: done ? 'rgba(255,255,255,0.28)' : active ? '#F1F5F9' : 'rgba(255,255,255,0.22)',
                textDecoration: done ? 'line-through' : 'none',
                textDecorationColor: 'rgba(255,255,255,0.18)',
              }}>
                {stage.label}
              </span>
              {/* Bouncing dots for active */}
              {active && (
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{
                      width: 4, height: 4, borderRadius: '50%', background: accentColor,
                      animation: `ldBounce 0.9s ease-in-out ${d * 0.16}s infinite`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rotating tip card */}
      <div style={{
        width: '100%', background: '#111827', borderRadius: 16,
        padding: '15px 18px', border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 14, minHeight: 76,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: accentColor, marginBottom: 6 }}>
          {fact.label}
        </p>
        <p style={{ fontSize: 14, color: '#CBD5E1', lineHeight: 1.6, fontWeight: 500 }}>
          {fact.fact}
        </p>
      </div>

      {/* Dot indicator */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: i === factIndex % 3 ? 16 : 5, height: 5, borderRadius: 3,
            background: i === factIndex % 3 ? accentColor : 'rgba(255,255,255,0.15)',
            transition: 'width 0.3s ease, background 0.3s ease',
          }} />
        ))}
      </div>

      <style suppressHydrationWarning>{`
        @keyframes ldPulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes ldBounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
      `}</style>
    </div>
  );
}

function DailyChallengeLoader() {
  return <GKFactCarousel mode="daily" subject="Daily" accentColor="#f97316" />;
}

function QuizLoader({ subject }) {
  return <GKFactCarousel subject={subject} mode="standard" accentColor="#10B981" />;
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
const ACTIVE_QUIZ_SESSION_KEY = 'ssc_active_quiz_session';
const QUIZ_SESSION_EXPIRY_MS = 60 * 60 * 1000;
const QUESTION_DURATION_SECONDS = 20;

function getAttemptedCount(answers = {}) {
  return Object.keys(answers).length;
}

function getAnsweredCount(answers = {}) {
  return Object.values(answers).filter(a => a && a !== 'SKIPPED').length;
}

function readActiveQuizSession() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_QUIZ_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeActiveQuizSession(session) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_QUIZ_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function clearActiveQuizSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_QUIZ_SESSION_KEY);
  } catch {}
}

function touchActiveQuizSession() {
  const session = readActiveQuizSession();
  if (!session || session.status !== 'in_progress') return;
  writeActiveQuizSession({ ...session, lastActivityAt: Date.now() });
}

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
  const [restoredMeta, setRestoredMeta] = useState(null);
  const effectiveSubject = restoredMeta?.subject || (isSavedMode ? 'Saved' : isDailyMode ? 'Daily Challenge' : subject);
  const effectiveTopic   = restoredMeta?.topic   || (isSavedMode ? 'Mixed'  : isDailyMode ? 'Mixed GK'        : topic);

  const [questions, setQuestions]       = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft]         = useState(20);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [sessionId, setSessionId]       = useState('');
  const [bulbState, setBulbState]       = useState('neutral'); // 'neutral' | 'correct' | 'wrong'
  const [savedIds, setSavedIds]         = useState(new Set());
  const [showGuestBanner, setShowGuestBanner] = useState(false);
  const [bookmarkFeedback, setBookmarkFeedback] = useState(null); // questionId being shown feedback
  const [bmAnimKey, setBmAnimKey]       = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingExitUrl, setPendingExitUrl] = useState('/dashboard');
  const [recoveryPrompt, setRecoveryPrompt] = useState(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const guestBannerShown = useRef(false);
  const allowQuizExitRef = useRef(false);
  const restoredSessionRef = useRef(false);
  const activeSessionRef = useRef(null);
  const isLoggedIn = status === 'authenticated';
  const attemptedCount = getAttemptedCount(answers);
  const answeredCount = getAnsweredCount(answers);
  const quizInProgress = questions.length > 0 && !loading && !error && !quizComplete;

  useEffect(() => {
    if (!router.isReady) return;
    if (!isSavedMode && mode !== 'daily' && (!subject || !topic || !questionCount)) router.replace('/dashboard');
  }, [router.isReady, subject, topic, questionCount, isSavedMode, router]);

  useEffect(() => {
    if (!router.isReady || recoveryChecked) return;
    const session = readActiveQuizSession();
    const isValidSession =
      session &&
      session.status === 'in_progress' &&
      Array.isArray(session.questions) &&
      session.questions.length > 0;

    if (!isValidSession) {
      clearActiveQuizSession();
      setRecoveryChecked(true);
      return;
    }

    const lastActivityAt = Number(session.lastActivityAt || session.startedAt || 0);
    const expired = !lastActivityAt || Date.now() - lastActivityAt > QUIZ_SESSION_EXPIRY_MS;
    const sessionAttemptedCount = getAttemptedCount(session.selectedAnswers || {});

    if (expired) {
      if (sessionAttemptedCount > 0) {
        setRecoveryPrompt({ type: 'expired', session });
        setLoading(false);
      } else {
        clearActiveQuizSession();
        setRecoveryChecked(true);
      }
      return;
    }

    setRecoveryPrompt({ type: 'resume', session });
    setLoading(false);
  }, [router.isReady, recoveryChecked]);

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
    touchActiveQuizSession();
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
    if (restoredSessionRef.current) return;
    setSessionId(qSessionId || crypto.randomUUID());
  }, [qSessionId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!recoveryChecked || recoveryPrompt || restoredSessionRef.current) return;

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

    // Check question pool cache first (24h TTL — pool is shuffled locally on hit)
    const poolCacheKey = CACHE_KEYS.QUESTIONS(collection, subject, topic);
    const poolCached = readCache(poolCacheKey, CACHE_TTL.ONE_DAY);
    if (poolCached?.isFresh && Array.isArray(poolCached.data) && poolCached.data.length >= parseInt(questionCount)) {
      const pool = shuffle(poolCached.data).slice(0, parseInt(questionCount));
      setQuestions(pool);
      setLoading(false);
      return;
    }

    const url = `/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&collection=${encodeURIComponent(collection)}`;

    async function fetchWithRetry(attemptsLeft) {
      try {
        const r = await fetch(url);
        const data = await r.json();
        if (data.questions?.length) {
          writeCache(poolCacheKey, data.questions); // cache full pool; shuffle on each use
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
  }, [router.isReady, subject, topic, questionCount, isSavedMode, mode, recoveryChecked, recoveryPrompt]);

  useEffect(() => {
    if (!quizInProgress || recoveryPrompt) return;
    const now = Date.now();
    const existing = activeSessionRef.current || readActiveQuizSession();
    const quizSession = {
      quizSessionId: existing?.quizSessionId || sessionId || crypto.randomUUID(),
      subject: effectiveSubject,
      topic: effectiveTopic,
      collection,
      mode: mode || 'standard',
      selectedQuestionCount: questions.length,
      totalQuestions: questions.length,
      questions,
      currentQuestionIndex: currentIndex,
      selectedAnswers: answers,
      startedAt: existing?.startedAt || now,
      lastActivityAt: now,
      questionStartedAt,
      status: 'in_progress',
    };
    activeSessionRef.current = quizSession;
    writeActiveQuizSession(quizSession);
  }, [
    answers,
    collection,
    currentIndex,
    effectiveSubject,
    effectiveTopic,
    mode,
    questionStartedAt,
    questions,
    quizInProgress,
    recoveryPrompt,
    sessionId,
  ]);

  useEffect(() => {
    if (loading || quizComplete || showFeedback || showExitModal || recoveryPrompt || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, quizComplete, showFeedback, showExitModal, recoveryPrompt]);

  useEffect(() => {
    if (recoveryPrompt) return;
    setTimeLeft(QUESTION_DURATION_SECONDS);
    setQuestionStartedAt(Date.now());
    setBulbState('neutral');
  }, [currentIndex, recoveryPrompt]);

  const finishQuiz = useCallback((finalAnswers, options = {}) => {
    if (quizComplete) return;
    allowQuizExitRef.current = true;
    activeSessionRef.current = null;
    clearActiveQuizSession();
    setQuizComplete(true);
    const results = calculateResults(questions, finalAnswers);
    const attemptedCount = Object.keys(finalAnswers || {}).length;
    const answeredCount = Object.values(finalAnswers || {}).filter(a => a && a !== 'SKIPPED').length;

    // ── Write base results immediately and navigate — no AI wait ─────────────
    // The result page already has a fallback to fetch AI summary independently
    // (see result.js summaryLoading path). Navigating now removes the blocking
    // "Calculating…" screen that previously lasted 3–8 s waiting for AI calls.
    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: effectiveSubject, topic: effectiveTopic, questions, answers: finalAnswers,
      correct: results.correct, incorrect: results.incorrect, skipped: results.skipped,
      totalQuestions: results.totalQuestions, rawScore: results.rawScore, accuracy: results.accuracy,
      partialAttempt: Boolean(options.partial),
      attemptedCount,
      answeredCount,
      collection,
      aiData: null, // result page fetches this on its own; patched below when ready
    }));

    router.push(
      `/result?subject=${encodeURIComponent(effectiveSubject)}&topic=${encodeURIComponent(effectiveTopic)}&sessionId=${sessionId}&correct=${results.correct}&incorrect=${results.incorrect}&skipped=${results.skipped}&total=${results.totalQuestions}&score=${results.rawScore}`
    );

    // ── Pre-fetch AI summary in the background ───────────────────────────────
    // Only the summary is pre-fetched; per-question AI explanations are
    // user-triggered on the detailed result page to avoid N parallel AI calls.
    fetch('/api/ai/summary', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: effectiveSubject, topic: effectiveTopic, totalQuestions: results.totalQuestions, correctAnswers: results.correct, incorrectAnswers: results.incorrect, skipped: results.skipped, rawScore: results.rawScore, accuracy: results.accuracy }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const summary = d?.aiSummary || null;
        if (!summary) return;
        try {
          const stored = JSON.parse(sessionStorage.getItem('quizResult') || '{}');
          if (!stored.aiData) stored.aiData = {};
          stored.aiData.summary = summary;
          sessionStorage.setItem('quizResult', JSON.stringify(stored));
        } catch {}
      })
      .catch(() => {});
  }, [questions, subject, topic, sessionId, router, quizComplete, effectiveSubject, effectiveTopic, collection]);

  const requestQuizExit = useCallback((targetUrl = '/dashboard') => {
    if (!quizInProgress || allowQuizExitRef.current) return true;
    setPendingExitUrl(targetUrl || '/dashboard');
    setShowExitModal(true);
    return false;
  }, [quizInProgress]);

  useEffect(() => {
    if (!quizInProgress) return;
    const currentQuizUrl = router.asPath || window.location.pathname;

    const handleBeforeUnload = (event) => {
      if (allowQuizExitRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleRouteChangeStart = (url) => {
      if (allowQuizExitRef.current) return;
      setPendingExitUrl(url || '/dashboard');
      setShowExitModal(true);
      const routeChangeError = new Error('Quiz route change cancelled');
      routeChangeError.cancelled = true;
      router.events.emit('routeChangeError', routeChangeError, url, { shallow: false });
      throw routeChangeError;
    };

    const handlePopState = () => {
      if (allowQuizExitRef.current) return;
      window.history.pushState({ quizGuard: true }, '', currentQuizUrl);
      requestQuizExit('/dashboard');
    };

    window.history.pushState({ quizGuard: true }, '', currentQuizUrl);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState, true);
    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.beforePopState(({ as }) => requestQuizExit(as || '/dashboard'));

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState, true);
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.beforePopState(() => true);
    };
  }, [quizInProgress, router, requestQuizExit]);

  function handleContinueQuiz() {
    setShowExitModal(false);
    setPendingExitUrl('/dashboard');
  }

  function handleEndQuiz() {
    allowQuizExitRef.current = true;
    setShowExitModal(false);
    if (attemptedCount > 0) {
      finishQuiz(answers, { partial: true });
      return;
    }
    activeSessionRef.current = null;
    clearActiveQuizSession();
    router.push(pendingExitUrl || '/dashboard');
  }

  function showStoredSessionResult(session, options = {}) {
    const storedQuestions = session.questions || [];
    const storedAnswers = session.selectedAnswers || {};
    if (!storedQuestions.length) {
      clearActiveQuizSession();
      router.push('/dashboard');
      return;
    }

    allowQuizExitRef.current = true;
    activeSessionRef.current = null;
    clearActiveQuizSession();
    setQuizComplete(true);

    const results = calculateResults(storedQuestions, storedAnswers);
    const storedAttemptedCount = getAttemptedCount(storedAnswers);
    const storedAnsweredCount = getAnsweredCount(storedAnswers);
    const storedSubject = session.subject || effectiveSubject || 'Quiz';
    const storedTopic = session.topic || effectiveTopic || 'Mixed';
    const storedSessionId = session.quizSessionId || sessionId || crypto.randomUUID();

    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: storedSubject,
      topic: storedTopic,
      questions: storedQuestions,
      answers: storedAnswers,
      correct: results.correct,
      incorrect: results.incorrect,
      skipped: results.skipped,
      totalQuestions: results.totalQuestions,
      rawScore: results.rawScore,
      accuracy: results.accuracy,
      partialAttempt: Boolean(options.partial),
      attemptedCount: storedAttemptedCount,
      answeredCount: storedAnsweredCount,
      collection: session.collection || 'general',
      aiData: null,
    }));

    router.push(
      `/result?subject=${encodeURIComponent(storedSubject)}&topic=${encodeURIComponent(storedTopic)}&sessionId=${storedSessionId}&correct=${results.correct}&incorrect=${results.incorrect}&skipped=${results.skipped}&total=${results.totalQuestions}&score=${results.rawScore}`
    );
  }

  function startFreshAfterRecovery() {
    activeSessionRef.current = null;
    restoredSessionRef.current = false;
    clearActiveQuizSession();
    setRecoveryPrompt(null);
    setRecoveryChecked(true);
    setLoading(true);
  }

  function handleResumeStoredQuiz() {
    const session = recoveryPrompt?.session;
    if (!session) return;

    const restoredQuestions = session.questions || [];
    const restoredAnswers = { ...(session.selectedAnswers || {}) };
    let restoredIndex = Math.min(session.currentQuestionIndex || 0, Math.max(restoredQuestions.length - 1, 0));
    let restoredQuestionStartedAt = Number(session.questionStartedAt || session.lastActivityAt || Date.now());
    let restoredTimeLeft = Math.ceil(QUESTION_DURATION_SECONDS - ((Date.now() - restoredQuestionStartedAt) / 1000));
    const currentQuestion = restoredQuestions[restoredIndex];
    const storedAnswerForCurrent = currentQuestion ? restoredAnswers[currentQuestion.id] : null;

    if (storedAnswerForCurrent) {
      if (restoredIndex >= restoredQuestions.length - 1) {
        showStoredSessionResult({ ...session, selectedAnswers: restoredAnswers });
        return;
      }
      restoredIndex += 1;
      restoredQuestionStartedAt = Date.now();
      restoredTimeLeft = QUESTION_DURATION_SECONDS;
    }

    if (!storedAnswerForCurrent && currentQuestion && restoredTimeLeft <= 0) {
      restoredAnswers[currentQuestion.id] = 'SKIPPED';
      if (restoredIndex >= restoredQuestions.length - 1) {
        showStoredSessionResult({ ...session, selectedAnswers: restoredAnswers });
        return;
      }
      restoredIndex += 1;
      restoredQuestionStartedAt = Date.now();
      restoredTimeLeft = QUESTION_DURATION_SECONDS;
    }

    restoredSessionRef.current = true;
    const restoredSession = {
      ...session,
      selectedAnswers: restoredAnswers,
      currentQuestionIndex: restoredIndex,
      questionStartedAt: restoredQuestionStartedAt,
      lastActivityAt: Date.now(),
    };
    activeSessionRef.current = restoredSession;
    writeActiveQuizSession(restoredSession);

    setRestoredMeta({ subject: session.subject, topic: session.topic });
    setQuestions(restoredQuestions);
    setAnswers(restoredAnswers);
    setCurrentIndex(restoredIndex);
    setSelectedOption(null);
    setShowFeedback(false);
    setBulbState('neutral');
    setSessionId(session.quizSessionId || crypto.randomUUID());
    setQuestionStartedAt(restoredQuestionStartedAt);
    setTimeLeft(Math.max(1, Math.min(QUESTION_DURATION_SECONDS, restoredTimeLeft)));
    setRecoveryPrompt(null);
    setRecoveryChecked(true);
    setLoading(false);
  }

  function handleEndStoredAttempt() {
    const session = recoveryPrompt?.session;
    if (!session) return;
    const storedAttemptedCount = getAttemptedCount(session.selectedAnswers || {});
    if (storedAttemptedCount > 0) {
      showStoredSessionResult(session, { partial: true });
      return;
    }
    startFreshAfterRecovery();
  }

  function handleDiscardStoredAttempt() {
    const session = recoveryPrompt?.session;
    if (!session) return;
    const storedAttemptedCount = getAttemptedCount(session.selectedAnswers || {});
    if (storedAttemptedCount > 0) {
      showStoredSessionResult(session, { partial: true });
      return;
    }
    allowQuizExitRef.current = true;
    activeSessionRef.current = null;
    restoredSessionRef.current = false;
    clearActiveQuizSession();
    setRecoveryPrompt(null);
    router.replace('/dashboard');
  }

  const persistQuizProgress = useCallback((nextAnswers = answers, nextIndex = currentIndex, nextQuestionStartedAt = questionStartedAt) => {
    if (!questions.length || quizComplete) return;
    const now = Date.now();
    const existing = activeSessionRef.current || readActiveQuizSession();
    const quizSession = {
      quizSessionId: existing?.quizSessionId || sessionId || crypto.randomUUID(),
      subject: effectiveSubject,
      topic: effectiveTopic,
      collection,
      mode: mode || 'standard',
      selectedQuestionCount: questions.length,
      totalQuestions: questions.length,
      questions,
      currentQuestionIndex: nextIndex,
      selectedAnswers: nextAnswers,
      startedAt: existing?.startedAt || now,
      lastActivityAt: now,
      questionStartedAt: nextQuestionStartedAt,
      status: 'in_progress',
    };
    activeSessionRef.current = quizSession;
    writeActiveQuizSession(quizSession);
  }, [
    answers,
    collection,
    currentIndex,
    effectiveSubject,
    effectiveTopic,
    mode,
    questionStartedAt,
    questions,
    quizComplete,
    sessionId,
  ]);

  const advanceQuestion = useCallback((newAnswers) => {
    const next = currentIndex + 1;
    if (next >= questions.length) { finishQuiz(newAnswers); return; }
    persistQuizProgress(newAnswers, next, Date.now());
    setCurrentIndex(next);
    setSelectedOption(null);
    setShowFeedback(false);
  }, [currentIndex, questions.length, finishQuiz, persistQuizProgress]);

  useEffect(() => {
    if (timeLeft === 0 && !showFeedback && !showExitModal && !quizComplete && questions.length > 0) {
      const q = questions[currentIndex];
      if (!q) return;
      const na = { ...answers, [q.id]: 'SKIPPED' };
      setAnswers(na);
      advanceQuestion(na);
    }
  }, [timeLeft, showFeedback, showExitModal, quizComplete, questions, currentIndex, answers, advanceQuestion]);

  function handleOptionSelect(label) {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const na = { ...answers, [q.id]: label };
    persistQuizProgress(na, currentIndex, questionStartedAt);
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
    persistQuizProgress(na, currentIndex, questionStartedAt);
    setAnswers(na);
    setBulbState('neutral');
    advanceQuestion(na);
  }

  if (recoveryPrompt) {
    const session = recoveryPrompt.session;
    const sessionAnswers = session.selectedAnswers || {};
    const sessionAttemptedCount = getAttemptedCount(sessionAnswers);
    const sessionAnsweredCount = getAnsweredCount(sessionAnswers);
    const isExpiredPrompt = recoveryPrompt.type === 'expired';

    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: '#0F172A' }}>
        <Head><title>{isExpiredPrompt ? 'Quiz Expired' : 'Resume Quiz'} — SSC GK Score Booster</title></Head>
        <div
          className="w-full max-w-[370px] rounded-3xl p-5"
          style={{
            background: '#1E293B',
            border: '1px solid rgba(148,163,184,0.16)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.42)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,122,26,0.14)', color: '#FF7A1A' }}
          >
            {isExpiredPrompt ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v6l4 2" />
                <path d="M21 12a9 9 0 11-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            )}
          </div>

          <h1 className="font-display font-black text-2xl mb-2" style={{ color: '#F8FAFC' }}>
            {isExpiredPrompt ? 'Quiz Attempt Expired' : 'Resume Quiz?'}
          </h1>
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#CBD5E1' }}>
            {isExpiredPrompt
              ? `Your previous quiz was inactive for too long. You answered ${sessionAnsweredCount} questions.`
              : `You have an unfinished ${session.subject || 'Quiz'} · ${session.topic || 'Mixed'} quiz. You answered ${sessionAnsweredCount} of ${session.totalQuestions || session.questions?.length || 0} questions.`}
          </p>

          {sessionAttemptedCount > 0 && (
            <p className="text-xs leading-relaxed rounded-2xl px-3 py-2 mb-4" style={{ color: '#94A3B8', background: '#0F172A', border: '1px solid rgba(148,163,184,0.16)' }}>
              Progress saved locally: {sessionAttemptedCount} attempted of {session.totalQuestions || session.questions?.length || 0}.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={isExpiredPrompt ? handleEndStoredAttempt : handleResumeStoredQuiz}
              className="w-full rounded-2xl py-3.5 font-display font-bold text-base active:scale-[0.98] transition-transform"
              style={{
                background: 'linear-gradient(90deg, #FF7A1A, #FF5A00)',
                color: '#F8FAFC',
                boxShadow: '0 16px 36px rgba(255,106,0,0.30)',
              }}
            >
              {isExpiredPrompt ? 'View Partial Result' : 'Resume Quiz'}
            </button>
            <button
              onClick={isExpiredPrompt ? startFreshAfterRecovery : handleDiscardStoredAttempt}
              className="w-full rounded-2xl py-3.5 font-display font-bold text-base active:scale-[0.98] transition-transform"
              style={{
                background: isExpiredPrompt ? 'rgba(148,163,184,0.10)' : 'rgba(239,68,68,0.10)',
                border: isExpiredPrompt ? '1px solid rgba(148,163,184,0.20)' : '1px solid rgba(248,113,113,0.30)',
                color: isExpiredPrompt ? '#CBD5E1' : '#FCA5A5',
              }}
            >
              {isExpiredPrompt ? 'Start Fresh' : 'End Attempt'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a] px-4">
      <Head><title>Loading — SSC GK Score Booster</title></Head>
      {mode === 'daily' ? (
        <DailyChallengeLoader />
      ) : (
        <QuizLoader subject={subject} />
      )}
    </div>
  );

  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center px-5 bg-[#0f172a]">
      <Head><title>Couldn&apos;t load quiz — SSC GK Score Booster</title></Head>
      <div style={{
        width: '100%', maxWidth: 380, background: '#1E293B',
        borderRadius: 24, padding: '28px 24px',
        border: '1px solid rgba(148,163,184,0.14)',
        boxShadow: '0 24px 56px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16, marginBottom: 18,
          background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>⚠️</div>
        <p style={{ fontFamily: 'var(--font-display,inherit)', fontSize: 20, fontWeight: 800, color: '#F8FAFC', textAlign: 'center', marginBottom: 8 }}>
          Couldn&apos;t load quiz
        </p>
        <p style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 1.55, marginBottom: 28 }}>
          {error === 'no-questions'
            ? 'No questions found for this topic. Try a different subject or topic.'
            : 'Please check your connection and try again.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {error === 'fetch-failed' && (
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-display,inherit)', fontWeight: 700, fontSize: 15, color: '#0f172a',
                background: 'linear-gradient(90deg, #10B981, #059669)',
                boxShadow: '0 8px 24px rgba(16,185,129,0.28)',
              }}
            >
              Retry
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, cursor: 'pointer',
              fontFamily: 'var(--font-display,inherit)', fontWeight: 700, fontSize: 15,
              color: '#94A3B8', background: 'transparent',
              border: '1.5px solid rgba(148,163,184,0.20)',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
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

      {showExitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(3px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-quiz-title"
        >
          <div
            className="w-full max-w-[360px] rounded-3xl p-5"
            style={{
              background: '#1E293B',
              border: '1px solid rgba(148,163,184,0.16)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.42)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,122,26,0.14)', color: '#FF7A1A' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <h2 id="exit-quiz-title" className="font-display font-black text-2xl mb-2" style={{ color: '#F8FAFC' }}>
              Exit Quiz?
            </h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#CBD5E1' }}>
              You&apos;re in the middle of a quiz. If you leave now, this attempt will end and your progress may not be saved.
            </p>

            {attemptedCount > 0 && (
              <p className="text-xs leading-relaxed rounded-2xl px-3 py-2 mb-4" style={{ color: '#94A3B8', background: '#0F172A', border: '1px solid rgba(148,163,184,0.16)' }}>
                You attempted {attemptedCount} of {questions.length} questions. If you end now, we&apos;ll show your result so far.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleContinueQuiz}
                className="w-full rounded-2xl py-3.5 font-display font-bold text-base active:scale-[0.98] transition-transform"
                style={{
                  background: 'linear-gradient(90deg, #FF7A1A, #FF5A00)',
                  color: '#F8FAFC',
                  boxShadow: '0 16px 36px rgba(255,106,0,0.30)',
                }}
              >
                Continue Quiz
              </button>
              <button
                onClick={handleEndQuiz}
                className="w-full rounded-2xl py-3.5 font-display font-bold text-base active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(248,113,113,0.30)',
                  color: '#FCA5A5',
                }}
              >
                End Quiz
              </button>
            </div>
          </div>
        </div>
      )}

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
