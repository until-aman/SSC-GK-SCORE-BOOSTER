import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import { fetchWithClientCache, readCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getDailyChallenge, getQuestionBank } from '@/lib/data/questionData';
import { getSavedQuestionIds, saveQuestion, unsaveQuestion } from '@/lib/data/savedData';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { calculateAccuracy, calculateRawScore } from '@/lib/scoring';

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

function GKFactCarousel({ subject, mode, accentColor = '#14B8A6', statusText }) {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * GK_FACTS.length));
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [subtext, setSubtext] = useState(statusText || 'Preparing questions, timer and Coins');

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
      padding: '0 22px',
      background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)',
      width: '100%', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <p style={{ fontFamily: 'var(--font-display,inherit)', fontSize: 20, fontWeight: 800, color: 'var(--ssc-text-primary)', marginBottom: 6, lineHeight: 1.25 }}>
          {title}
        </p>
        <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', lineHeight: 1.45 }}>
          {subtext}
        </p>
      </div>

      {/* Progress bar with glow */}
      <div style={{ width: '100%', marginBottom: 18 }}>
        <div style={{ width: '100%', background: 'var(--ssc-border-soft)', borderRadius: 8, height: 7, overflow: 'visible', position: 'relative' }}>
          <div style={{
            height: '100%', borderRadius: 8,
            background: `linear-gradient(90deg, ${accentColor}bb, ${accentColor})`,
            width: `${progress}%`,
            transition: 'width 0.08s linear',
            boxShadow: pct > 2 ? `0 0 14px ${accentColor}55, 0 0 5px ${accentColor}77` : 'none',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ssc-text-muted)' }}>
            {PROGRESS_STAGES[stageIdx]?.label ?? 'Starting quiz'}
          </span>
          <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>

      {/* Stage checklist */}
      <div style={{
        width: '100%', background: 'var(--ssc-surface)', borderRadius: 16,
        padding: '14px 16px', border: '1px solid var(--ssc-border-soft)',
        boxShadow: 'var(--ssc-shadow-card)',
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
                background: done ? `${accentColor}18` : active ? `${accentColor}12` : 'var(--ssc-surface-soft)',
                border: `1.5px solid ${done ? accentColor + '55' : active ? accentColor : 'var(--ssc-border-soft)'}`,
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
                color: done ? 'var(--ssc-text-muted)' : active ? 'var(--ssc-text-primary)' : 'var(--ssc-text-muted)',
                textDecoration: done ? 'line-through' : 'none',
                textDecorationColor: 'var(--ssc-border-soft)',
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
        width: '100%', background: 'var(--ssc-surface)', borderRadius: 16,
        padding: '15px 18px', border: '1px solid var(--ssc-border-soft)',
        boxShadow: 'var(--ssc-shadow-card)',
        marginBottom: 14, minHeight: 76,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: accentColor, marginBottom: 6 }}>
          {fact.label}
        </p>
        <p style={{ fontSize: 14, color: 'var(--ssc-text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
          {fact.fact}
        </p>
      </div>

      {/* Dot indicator */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: i === factIndex % 3 ? 16 : 5, height: 5, borderRadius: 3,
            background: i === factIndex % 3 ? accentColor : 'var(--ssc-border-soft)',
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

function DailyChallengeLoader({ statusText }) {
  return <GKFactCarousel mode="daily" subject="Daily" accentColor="#f97316" statusText={statusText} />;
}

function QuizLoader({ subject, statusText }) {
  return <GKFactCarousel subject={subject} mode="standard" accentColor="#14B8A6" statusText={statusText} />;
}

function getISTDateString() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function getQuestionPool(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.questions)) return data.questions;
  return [];
}

function pickQuestions(pool, count) {
  return shuffle(pool).slice(0, parseInt(count, 10));
}

function filterQuestionBankByTopic(questions, topic) {
  if (topic === 'Mixed' || topic === 'All') return questions;
  return questions.filter(q => q.topic === topic);
}

function withDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
        'border-white/10'
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
  const rawScore = calculateRawScore({ correct, incorrect });
  const accuracy = calculateAccuracy({ correct, totalQuestions: total });
  return { correct, incorrect, skipped, totalQuestions: total, rawScore, accuracy };
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_KEYS   = ['optionA', 'optionB', 'optionC', 'optionD'];
const ACTIVE_QUIZ_SESSION_KEY = 'ssc_active_quiz_session';
const ACTIVE_QUIZ_RELOAD_PENDING_KEY = 'ssc_active_quiz_reload_pending';
const QUIZ_SESSION_EXPIRY_MS = 60 * 60 * 1000;
const QUESTION_DURATION_SECONDS = 30;
const VALID_SOURCE_SCREENS = new Set(['dashboard', 'analysis', 'saved', 'history', 'daily_challenge', 'mentor_plan', 'unknown']);

function normalizeSourceScreen(value) {
  return VALID_SOURCE_SCREENS.has(value) ? value : 'unknown';
}

function normalizeInternalReturnUrl(value) {
  const url = Array.isArray(value) ? value[0] : value;
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('/') || url.startsWith('//')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
  return url;
}

function isHistoryQuizSession(session) {
  if (!session) return false;
  if (normalizeSourceScreen(session.sourceScreen) === 'history') return true;
  if (session.mode === 'history') return true;
  return Boolean(session.historyMeta);
}

function getAttemptedCount(answers = {}) {
  return Object.keys(answers).length;
}

function getAnsweredCount(answers = {}) {
  return Object.values(answers).filter(a => a && a !== 'SKIPPED').length;
}

function clampTimeTaken(seconds) {
  return Math.max(0, Math.min(QUESTION_DURATION_SECONDS, Number(seconds) || 0));
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
  clearActiveQuizReloadPending();
}

function touchActiveQuizSession() {
  const session = readActiveQuizSession();
  if (!session || session.status !== 'in_progress') return;
  writeActiveQuizSession({ ...session, lastActivityAt: Date.now() });
}

function markActiveQuizReloadPending(session) {
  if (typeof window === 'undefined' || !session || session.status !== 'in_progress') return;
  try {
    sessionStorage.setItem(ACTIVE_QUIZ_RELOAD_PENDING_KEY, JSON.stringify({
      quizSessionId: session.quizSessionId || '',
      markedAt: Date.now(),
      path: window.location.pathname,
    }));
  } catch {}
}

function consumeActiveQuizReloadPending(session) {
  if (typeof window === 'undefined' || !session) return false;
  try {
    const raw = sessionStorage.getItem(ACTIVE_QUIZ_RELOAD_PENDING_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(ACTIVE_QUIZ_RELOAD_PENDING_KEY);
    const marker = JSON.parse(raw);
    if (!marker?.markedAt || Date.now() - Number(marker.markedAt) > 5 * 60 * 1000) return false;
    if (marker.quizSessionId && session.quizSessionId && marker.quizSessionId !== session.quizSessionId) return false;
    return true;
  } catch {
    try { sessionStorage.removeItem(ACTIVE_QUIZ_RELOAD_PENDING_KEY); } catch {}
    return false;
  }
}

function clearActiveQuizReloadPending() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(ACTIVE_QUIZ_RELOAD_PENDING_KEY); } catch {}
}

function wasPageReload() {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  try {
    const [navigation] = performance.getEntriesByType?.('navigation') || [];
    if (navigation?.type === 'reload') return true;
    return performance.navigation?.type === 1;
  } catch {
    return false;
  }
}

function TimerRing({ timeLeft, duration = QUESTION_DURATION_SECONDS }) {
  const SIZE   = 52;
  const RADIUS = 20;
  const CIRC   = 2 * Math.PI * RADIUS;
  const offset = CIRC * (1 - timeLeft / duration);

  const color = timeLeft >= 11 ? '#14B8A6'   // teal   30–11 s
    : timeLeft >= 6            ? '#F59E0B'   // gold   10–6 s
    :                            '#EF4444';  // red     5–0 s

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
          fill="none" stroke="var(--ssc-border-soft)" strokeWidth="3.5"
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
        <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--ssc-text-muted)', lineHeight: 1, marginTop: 1 }}>
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
      fill="#14B8A6" stroke="#14B8A6" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'bmPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
    </svg>
  );
}

// ─── Display helper ───────────────────────────────────────────────────────────
// When subject is "Mixed" and collection is not "general", show the collection
// name instead of "Mixed" so the header reads e.g. "SSC PYQ · Mixed" not "Mixed · Mixed".
const COLLECTION_DISPLAY_NAMES = { PYQ: 'SSC PYQ', Parmar: 'Parmar SSC' };
function getDisplaySubject(subject, collection) {
  if (!subject) return subject;
  if (subject === 'Mixed' && collection && collection !== 'general') {
    return COLLECTION_DISPLAY_NAMES[collection] || collection;
  }
  return subject;
}

export default function Quiz() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    subject,
    topic,
    count,
    n,
    sessionId: qSessionId,
    mode,
    collection = 'general',
    sourceScreen: qSourceScreen,
    sourcePage = '',
    sourceTaskId = '',
    planId = '',
    returnUrl = '',
  } = router.query;
  const questionCount = count || n;
  const isSavedMode  = mode === 'saved';
  const isHistoryMode = mode === 'history';
  const isDailyMode  = mode === 'daily';
  const [restoredMeta, setRestoredMeta] = useState(null);
  const [historyMeta, setHistoryMeta] = useState(null);
  const effectiveSubject = restoredMeta?.subject || historyMeta?.subject || (isSavedMode ? 'Saved' : isDailyMode ? 'Daily Challenge' : subject);
  const effectiveTopic   = restoredMeta?.topic   || historyMeta?.topic   || (isSavedMode ? 'Mixed'  : isDailyMode ? 'Mixed GK'        : topic);
  const sourceScreen = normalizeSourceScreen(isDailyMode ? 'daily_challenge' : isSavedMode ? 'saved' : isHistoryMode ? 'history' : qSourceScreen);
  const queryReturnUrl = normalizeInternalReturnUrl(returnUrl);
  const quizReturnUrl = sourceScreen === 'history'
    ? (historyMeta?.returnUrl || queryReturnUrl || '/history/quizzes')
    : sourceScreen === 'saved'
      ? (queryReturnUrl || '/history/saved')
      : '';
  const mentorContext = useMemo(() => (
    sourceScreen === 'mentor_plan' || sourcePage === 'mentor'
      ? {
          sourcePage: 'mentor',
          sourceScreen: 'mentor_plan',
          sourceTaskId: String(sourceTaskId || ''),
          planId: String(planId || ''),
          returnUrl: queryReturnUrl || '/mentor',
        }
      : null
  ), [planId, queryReturnUrl, sourcePage, sourceScreen, sourceTaskId]);

  const [questions, setQuestions]       = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState({});
  const [answerTimes, setAnswerTimes]   = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [retryCount, setRetryCount]     = useState(0);
  const [loadingCopy, setLoadingCopy]   = useState('Preparing your quiz');
  const [cacheWarning, setCacheWarning] = useState('');
  const [showLoadingRetry, setShowLoadingRetry] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft]         = useState(QUESTION_DURATION_SECONDS);
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
  const loadRunRef = useRef(0);
  const isLoggedIn = status === 'authenticated';
  const attemptedCount = getAttemptedCount(answers);
  const answeredCount = getAnsweredCount(answers);
  const quizInProgress = questions.length > 0 && !loading && !error && !quizComplete;

  useEffect(() => {
    if (!router.isReady) return;
    if (!recoveryChecked) return;
    if (!isSavedMode && !isHistoryMode && mode !== 'daily' && (!subject || !topic || !questionCount)) router.replace('/dashboard');
  }, [router.isReady, recoveryChecked, subject, topic, questionCount, isSavedMode, isHistoryMode, mode, router]);

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

    const wasInterruptedReload = consumeActiveQuizReloadPending(session);
    const shouldUseLeavePrompt = wasPageReload() || wasInterruptedReload || isHistoryQuizSession(session);
    setRecoveryPrompt({ type: shouldUseLeavePrompt ? 'reload_exit' : 'resume', session });
    setLoading(false);
  }, [router.isReady, recoveryChecked]);

  // Load saved IDs for bookmark state
  useEffect(() => {
    if (status === 'loading') return;
    getSavedQuestionIds({ isLoggedIn, scope: getUserCacheScope(session) })
      .then(result => {
        const ids = Array.isArray(result) ? result : result.data?.savedIds || [];
        setSavedIds(new Set(ids));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Logged-in: use the shared mutation helpers (existing routes), which also
    // patch the scoped saved-IDs/list caches + mark History caches stale.
    const scope = getUserCacheScope(session);
    const isSaved = savedIds.has(question.id);
    if (isSaved) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(question.id); return n; });
      try {
        const r = await unsaveQuestion({ scope, questionId: question.id });
        if (!r.ok) setSavedIds(prev => new Set([...prev, question.id])); // rollback
      } catch {
        setSavedIds(prev => new Set([...prev, question.id])); // rollback
      }
    } else {
      setSavedIds(prev => new Set([...prev, question.id]));
      setBmAnimKey(k => k + 1);
      setBookmarkFeedback(question.id);
      setTimeout(() => setBookmarkFeedback(null), 1200);
      try {
        const r = await saveQuestion({ scope, question: {
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
        } });
        if (!r.ok) {
          console.error('[bookmark save failed]');
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
      setError(null);
      setShowLoadingRetry(false);
      setLoadingCopy('Preparing your quiz');
      setCacheWarning('');
      (async () => {
        try {
          const today = getISTDateString();
          const cacheKey = CACHE_KEYS.DAILY_CHALLENGE(today);
          const cached = readCache(cacheKey, CACHE_TTL.ONE_DAY);
          const cachedPool = cached ? getQuestionPool(cached.data) : [];

          if (cached?.isFresh && cachedPool.length) {
            setLoadingCopy('Loading saved question pool...');
            setQuestions(cachedPool.slice(0, 25));
            setLoading(false);
            return;
          }

          const result = await getDailyChallenge();

          const pool = getQuestionPool(result.data);
          if (pool.length) {
            setQuestions(pool.slice(0, 25));
            if (result.stale) setCacheWarning('Showing saved questions. Refresh when internet is stable.');
            setLoading(false);
            return;
          }

          setError('no-questions');
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
    if (isHistoryMode) {
      try {
        const payload = JSON.parse(sessionStorage.getItem('ssc_history_quiz_questions') || 'null');
        const historyQuestions = Array.isArray(payload) ? payload : payload?.questions;
        if (!historyQuestions?.length) { setError('no-questions'); setLoading(false); return; }
        const nextHistoryMeta = {
          quizMode: payload.quizMode || 'reattempt_mistakes',
          parentSessionId: payload.parentSessionId || '',
          isRetry: true,
          attemptNumber: Number(payload.attemptNumber) || 2,
          subject: payload.subject || 'History',
          topic: payload.topic || 'Re-attempt',
          sourceCollection: payload.sourceCollection || 'general',
          returnUrl: normalizeInternalReturnUrl(payload.returnUrl) || queryReturnUrl || '/history/quizzes',
        };
        const nextQuestions = shuffle(historyQuestions);
        const now = Date.now();
        const nextSessionId = qSessionId || crypto.randomUUID();
        const initialMentorContext = sourcePage === 'mentor' || qSourceScreen === 'mentor_plan'
          ? {
              sourcePage: 'mentor',
              sourceScreen: 'mentor_plan',
              sourceTaskId: String(sourceTaskId || ''),
              planId: String(planId || ''),
              returnUrl: queryReturnUrl || '/mentor',
            }
          : null;
        const initialHistorySession = {
          quizSessionId: nextSessionId,
          subject: nextHistoryMeta.subject,
          topic: nextHistoryMeta.topic,
          collection,
          mode: 'history',
          historyMeta: nextHistoryMeta,
          sourceScreen: initialMentorContext ? 'mentor_plan' : 'history',
          returnUrl: nextHistoryMeta.returnUrl,
          mentorContext: initialMentorContext,
          selectedQuestionCount: nextQuestions.length,
          totalQuestions: nextQuestions.length,
          questions: nextQuestions,
          currentQuestionIndex: 0,
          selectedAnswers: {},
          selectedAnswerTimes: {},
          startedAt: now,
          lastActivityAt: now,
          questionStartedAt: now,
          status: 'in_progress',
        };
        activeSessionRef.current = initialHistorySession;
        writeActiveQuizSession(initialHistorySession);
        setHistoryMeta(nextHistoryMeta);
        setQuestions(nextQuestions);
        setSessionId(nextSessionId);
        setQuestionStartedAt(now);
        setLoading(false);
      } catch { setError('fetch-failed'); setLoading(false); }
      return;
    }
    if (!subject || !topic || !questionCount) return;
    setLoading(true);
    setError(null);
    setShowLoadingRetry(false);
    setLoadingCopy('Preparing your quiz');
    setCacheWarning('');

    (async () => {
    const runId = ++loadRunRef.current;
    const isActiveRun = () => loadRunRef.current === runId && !restoredSessionRef.current;
    const startQuizFromPool = (pool, warning = '') => {
      if (!isActiveRun()) return true;
      setLoadingCopy('Selecting questions');
      const selected = pickQuestions(pool, questionCount);
      if (!selected.length) return false;
      setQuestions(selected);
      setCacheWarning(warning);
      setShowLoadingRetry(false);
      setLoadingCopy('Starting quiz');
      setLoading(false);
      return true;
    };

    const url = `/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&collection=${encodeURIComponent(collection)}`;
    const cacheKey = CACHE_KEYS.QUESTIONS(collection, subject, topic);

    async function refreshQuestionBank() {
      if (subject === 'Mixed') return null;
      return getQuestionBank({ collection, subject, forceRefresh: true });
    }

    if (subject !== 'Mixed') {
      const bankCacheKey = CACHE_KEYS.QUESTION_BANK(collection, subject);
      const freshBankCache = readCache(bankCacheKey, CACHE_TTL.ONE_DAY);
      const anyBankCache = freshBankCache || readCache(bankCacheKey, Infinity);
      const cachedBankPool = filterQuestionBankByTopic(getQuestionPool(anyBankCache?.data), topic);

      if (freshBankCache?.isFresh && cachedBankPool.length) {
        setLoadingCopy('Loading saved question pool');
        startQuizFromPool(cachedBankPool);
        return;
      }

      if (cachedBankPool.length) {
        setLoadingCopy('Loading saved question pool');
        try {
          const refreshed = await Promise.race([
            refreshQuestionBank(),
            withDelay(5000).then(() => ({ timedOut: true })),
          ]);
          if (refreshed?.timedOut) {
            startQuizFromPool(cachedBankPool, 'Using saved question pool. Refresh later for latest questions.');
            return;
          }
          const refreshedPool = filterQuestionBankByTopic(getQuestionPool(refreshed?.data), topic);
          if (refreshedPool.length) {
            startQuizFromPool(refreshedPool, refreshed.stale ? 'Using saved question pool. Refresh later for latest questions.' : '');
            return;
          }
        } catch {
          startQuizFromPool(cachedBankPool, 'Using saved question pool. Refresh later for latest questions.');
          return;
        }
      }

      try {
        setLoadingCopy('Loading saved question pool');
        const refreshed = await refreshQuestionBank();
        const refreshedPool = filterQuestionBankByTopic(getQuestionPool(refreshed?.data), topic);
        if (refreshedPool.length) {
          startQuizFromPool(refreshedPool, refreshed.stale ? 'Using saved question pool. Refresh later for latest questions.' : '');
          return;
        }
      } catch {}
    }

    // Step 14: reaching here means the canonical /api/question-bank path did not
    // produce a usable pool — i.e. the legacy /api/questions fallback. Log why.
    if (process.env.NODE_ENV !== 'production') {
      const reason = subject === 'Mixed' ? 'mixed-subject' : 'missing-bank';
      try { console.debug(`[apidiag] {"kind":"public-cache","event":"questions-legacy-fallback","reason":"${reason}"}`); } catch {}
    }

    const cached = readCache(cacheKey, CACHE_TTL.ONE_DAY);
    const cachedPool = cached ? getQuestionPool(cached.data) : [];

    if (cached?.isFresh && cachedPool.length) {
      setLoadingCopy('Loading saved question pool');
      startQuizFromPool(cachedPool);
      return;
    }

    async function fetchWithRetry(attemptsLeft) {
      try {
        setLoadingCopy('Loading saved question pool');
        const result = await fetchWithClientCache({
          key: cacheKey,
          url,
          maxAgeMs: CACHE_TTL.ONE_DAY,
          forceRefresh: true,
        });
        const pool = getQuestionPool(result.data);
        if (pool.length) {
          startQuizFromPool(pool, result.stale ? 'Using saved question pool. Refresh later for latest questions.' : '');
          return;
        }
        if (attemptsLeft > 0) {
          setTimeout(() => fetchWithRetry(attemptsLeft - 1), 1500);
        } else {
          if (!isActiveRun()) return;
          setError('no-questions');
          setLoading(false);
        }
      } catch {
        if (attemptsLeft > 0) {
          setTimeout(() => fetchWithRetry(attemptsLeft - 1), 1500);
        } else {
          // Last resort: serve stale cache silently rather than showing error
          const stalePool = getQuestionPool(readCache(cacheKey, Infinity)?.data);
          if (stalePool?.length) {
            startQuizFromPool(stalePool, 'Using saved question pool. Refresh later for latest questions.');
          } else {
            if (!isActiveRun()) return;
            setError('fetch-failed');
            setLoading(false);
          }
        }
      }
    }

    fetchWithRetry(3);
    })();
  }, [router.isReady, subject, topic, questionCount, collection, isSavedMode, isHistoryMode, mode, recoveryChecked, recoveryPrompt, retryCount, queryReturnUrl, qSessionId, sourcePage, qSourceScreen, sourceTaskId, planId]);

  useEffect(() => {
    if (!loading || error || mode === 'daily') return;
    const fiveSecondTimer = setTimeout(() => {
      setLoadingCopy('Still loading. Preparing your questions.');
    }, 5000);
    const tenSecondTimer = setTimeout(() => {
      setLoadingCopy('Taking longer than usual. You can retry.');
      setShowLoadingRetry(true);
    }, 10000);

    return () => {
      clearTimeout(fiveSecondTimer);
      clearTimeout(tenSecondTimer);
    };
  }, [loading, error, mode, retryCount]);

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
      historyMeta,
      sourceScreen,
      returnUrl: quizReturnUrl || '',
      mentorContext,
      selectedQuestionCount: questions.length,
      totalQuestions: questions.length,
      questions,
      currentQuestionIndex: currentIndex,
      selectedAnswers: answers,
      selectedAnswerTimes: answerTimes,
      startedAt: existing?.startedAt || now,
      lastActivityAt: now,
      questionStartedAt,
      status: 'in_progress',
    };
    activeSessionRef.current = quizSession;
    writeActiveQuizSession(quizSession);
  }, [
    answers,
    answerTimes,
    collection,
    currentIndex,
    effectiveSubject,
    effectiveTopic,
    mode,
    historyMeta,
    quizReturnUrl,
    mentorContext,
    sourceScreen,
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
    const finalAnswerTimes = options.answerTimes || answerTimes;
    const activeSession = activeSessionRef.current || readActiveQuizSession();
    const startedAtMs = Number(activeSession?.startedAt || Date.now());
    const completedAtMs = Date.now();
    const clientSessionId = activeSession?.quizSessionId || sessionId || crypto.randomUUID();
    allowQuizExitRef.current = true;
    activeSessionRef.current = null;
    clearActiveQuizSession();
    setQuizComplete(true);
    const results = calculateResults(questions, finalAnswers);
    const attemptedCount = Object.keys(finalAnswers || {}).length;
    const answeredCount = Object.values(finalAnswers || {}).filter(a => a && a !== 'SKIPPED').length;

    // Write base results immediately and navigate without waiting for AI.
    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: effectiveSubject, topic: effectiveTopic, questions, answers: finalAnswers,
      answerTimes: finalAnswerTimes,
      correct: results.correct, incorrect: results.incorrect, skipped: results.skipped,
      totalQuestions: results.totalQuestions, rawScore: results.rawScore, accuracy: results.accuracy,
      partialAttempt: Boolean(options.partial),
      attemptedCount,
      answeredCount,
      collection,
      mode: mode || 'standard',
      quizMode: historyMeta?.quizMode || null,
      parentSessionId: historyMeta?.parentSessionId || '',
      isRetry: Boolean(historyMeta?.isRetry),
      attemptNumber: historyMeta?.attemptNumber || 1,
      sourceScreen,
      sourcePage: mentorContext?.sourcePage || '',
      sourceTaskId: mentorContext?.sourceTaskId || '',
      planId: mentorContext?.planId || '',
      returnUrl: mentorContext?.returnUrl || quizReturnUrl || '',
      sessionId: clientSessionId,
      clientSessionId,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      timeSpentSeconds: Math.max(0, Math.round((completedAtMs - startedAtMs) / 1000)),
      aiData: null,
    }));

    router.push(
      `/result?subject=${encodeURIComponent(effectiveSubject)}&topic=${encodeURIComponent(effectiveTopic)}&sessionId=${clientSessionId}&correct=${results.correct}&incorrect=${results.incorrect}&skipped=${results.skipped}&total=${results.totalQuestions}&score=${results.rawScore}`
    );
  }, [questions, sessionId, router, quizComplete, effectiveSubject, effectiveTopic, collection, mode, answerTimes, sourceScreen, historyMeta, mentorContext, quizReturnUrl]);

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
      const session = activeSessionRef.current || readActiveQuizSession();
      if (session?.status === 'in_progress') {
        const nextSession = { ...session, lastActivityAt: Date.now() };
        writeActiveQuizSession(nextSession);
        markActiveQuizReloadPending(nextSession);
      }
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
      finishQuiz(answers, { partial: true, answerTimes });
      return;
    }
    activeSessionRef.current = null;
    clearActiveQuizSession();
    router.push(pendingExitUrl || '/dashboard');
  }

  function showStoredSessionResult(session, options = {}) {
    const storedQuestions = session.questions || [];
    const storedAnswers = session.selectedAnswers || {};
    const storedAnswerTimes = session.selectedAnswerTimes || {};
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
    const startedAtMs = Number(session.startedAt || Date.now());
    const completedAtMs = Date.now();

    sessionStorage.setItem('quizResult', JSON.stringify({
      subject: storedSubject,
      topic: storedTopic,
      questions: storedQuestions,
      answers: storedAnswers,
      answerTimes: storedAnswerTimes,
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
      mode: session.mode || 'standard',
      quizMode: session.historyMeta?.quizMode || null,
      parentSessionId: session.historyMeta?.parentSessionId || '',
      isRetry: Boolean(session.historyMeta?.isRetry),
      attemptNumber: session.historyMeta?.attemptNumber || 1,
      sourceScreen: normalizeSourceScreen(session.sourceScreen),
      sourcePage: session.mentorContext?.sourcePage || '',
      sourceTaskId: session.mentorContext?.sourceTaskId || '',
      planId: session.mentorContext?.planId || '',
      returnUrl: session.mentorContext?.returnUrl || normalizeInternalReturnUrl(session.returnUrl) || '',
      sessionId: storedSessionId,
      clientSessionId: storedSessionId,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      timeSpentSeconds: Math.max(0, Math.round((completedAtMs - startedAtMs) / 1000)),
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
    const restoredAnswerTimes = { ...(session.selectedAnswerTimes || {}) };
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
      restoredAnswerTimes[currentQuestion.id] = QUESTION_DURATION_SECONDS;
      if (restoredIndex >= restoredQuestions.length - 1) {
        showStoredSessionResult({ ...session, selectedAnswers: restoredAnswers, selectedAnswerTimes: restoredAnswerTimes });
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
      selectedAnswerTimes: restoredAnswerTimes,
      currentQuestionIndex: restoredIndex,
      questionStartedAt: restoredQuestionStartedAt,
      lastActivityAt: Date.now(),
    };
    activeSessionRef.current = restoredSession;
    writeActiveQuizSession(restoredSession);

    setRestoredMeta({ subject: session.subject, topic: session.topic });
    setQuestions(restoredQuestions);
    setAnswers(restoredAnswers);
    setAnswerTimes(restoredAnswerTimes);
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
    router.replace(normalizeInternalReturnUrl(session.returnUrl) || (isHistoryQuizSession(session) ? '/history/quizzes' : '/dashboard'));
  }

  const persistQuizProgress = useCallback((nextAnswers = answers, nextIndex = currentIndex, nextQuestionStartedAt = questionStartedAt, nextAnswerTimes = answerTimes) => {
    if (!questions.length || quizComplete) return;
    const now = Date.now();
    const existing = activeSessionRef.current || readActiveQuizSession();
    const quizSession = {
      quizSessionId: existing?.quizSessionId || sessionId || crypto.randomUUID(),
      subject: effectiveSubject,
      topic: effectiveTopic,
      collection,
      mode: mode || 'standard',
      sourceScreen,
      mentorContext,
      selectedQuestionCount: questions.length,
      totalQuestions: questions.length,
      questions,
      currentQuestionIndex: nextIndex,
      selectedAnswers: nextAnswers,
      selectedAnswerTimes: nextAnswerTimes,
      startedAt: existing?.startedAt || now,
      lastActivityAt: now,
      questionStartedAt: nextQuestionStartedAt,
      status: 'in_progress',
    };
    activeSessionRef.current = quizSession;
    writeActiveQuizSession(quizSession);
  }, [
    answers,
    answerTimes,
    collection,
    currentIndex,
    effectiveSubject,
    effectiveTopic,
    mode,
    mentorContext,
    sourceScreen,
    questionStartedAt,
    questions,
    quizComplete,
    sessionId,
  ]);

  const advanceQuestion = useCallback((newAnswers, newAnswerTimes = answerTimes) => {
    const next = currentIndex + 1;
    if (next >= questions.length) { finishQuiz(newAnswers, { answerTimes: newAnswerTimes }); return; }
    persistQuizProgress(newAnswers, next, Date.now(), newAnswerTimes);
    setCurrentIndex(next);
    setSelectedOption(null);
    setShowFeedback(false);
  }, [answerTimes, currentIndex, questions.length, finishQuiz, persistQuizProgress]);

  useEffect(() => {
    if (timeLeft === 0 && !showFeedback && !showExitModal && !quizComplete && questions.length > 0) {
      const q = questions[currentIndex];
      if (!q) return;
      const na = { ...answers, [q.id]: 'SKIPPED' };
      const nt = { ...answerTimes, [q.id]: QUESTION_DURATION_SECONDS };
      setAnswers(na);
      setAnswerTimes(nt);
      advanceQuestion(na, nt);
    }
  }, [timeLeft, showFeedback, showExitModal, quizComplete, questions, currentIndex, answers, answerTimes, advanceQuestion]);

  function handleOptionSelect(label) {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const na = { ...answers, [q.id]: label };
    const nt = { ...answerTimes, [q.id]: clampTimeTaken(QUESTION_DURATION_SECONDS - timeLeft) };
    persistQuizProgress(na, currentIndex, questionStartedAt, nt);
    setAnswers(na);
    setAnswerTimes(nt);
    setSelectedOption(label);
    setShowFeedback(true);
    const correct = label === q.correctOption;
    setBulbState(correct ? 'correct' : 'wrong');
    playSound(correct ? 'correct' : 'wrong');
    setTimeout(() => advanceQuestion(na, nt), 800);
  }

  function handleSkip() {
    if (showFeedback || quizComplete) return;
    const q = questions[currentIndex];
    const na = { ...answers, [q.id]: 'SKIPPED' };
    const nt = { ...answerTimes, [q.id]: clampTimeTaken(QUESTION_DURATION_SECONDS - timeLeft) };
    persistQuizProgress(na, currentIndex, questionStartedAt, nt);
    setAnswers(na);
    setAnswerTimes(nt);
    setBulbState('neutral');
    advanceQuestion(na, nt);
  }

  if (recoveryPrompt) {
    const session = recoveryPrompt.session;
    const sessionAnswers = session.selectedAnswers || {};
    const sessionAttemptedCount = getAttemptedCount(sessionAnswers);
    const sessionAnsweredCount = getAnsweredCount(sessionAnswers);
    const isExpiredPrompt = recoveryPrompt.type === 'expired';
    const isLeaveExitPrompt = recoveryPrompt.type === 'reload_exit' || recoveryPrompt.type === 'history_exit';
    const sessionQuestionCount = session.totalQuestions || session.questions?.length || 0;
    const attemptedProgress = sessionQuestionCount > 0
      ? Math.round((sessionAttemptedCount / sessionQuestionCount) * 100)
      : 0;

    if (isLeaveExitPrompt) {
      return (
        <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
          <Head><title>Leave quiz? - SSC GK Score Booster</title></Head>
          <div
            className="w-full max-w-[360px]"
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 28,
              padding: 24,
              boxShadow: 'var(--ssc-shadow-float)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-reload-exit-title"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,122,26,0.12)', color: '#ff7a1a' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            </div>

            <h2 id="history-reload-exit-title" className="t-page-title font-display mb-3" style={{ color: 'var(--ssc-text-primary)' }}>
              Leave quiz?
            </h2>

            <div className="w-full mb-4">
              <div className="t-badge inline-flex items-center mb-2" style={{
                color: 'var(--ssc-orange)',
                background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.18)',
                borderRadius: 999, padding: '4px 12px',
              }}>
                {sessionAttemptedCount} / {sessionQuestionCount} attempted
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--ssc-border-soft)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 999,
                  width: `${attemptedProgress}%`,
                  background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <p className="t-body mb-5" style={{ color: 'var(--ssc-text-secondary)' }}>
              End now to see your current result, or continue the quiz.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleResumeStoredQuiz}
                className="t-button-lg w-full rounded-2xl py-3.5 font-display active:scale-[0.98] transition-transform flex items-center justify-center"
                style={{
                  background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                  color: 'var(--ssc-text-inverse)',
                  boxShadow: 'var(--ssc-shadow-cta)',
                }}
              >
                Continue Quiz
              </button>
              <button
                onClick={handleDiscardStoredAttempt}
                className="t-button-sm w-full rounded-2xl font-display active:scale-[0.98] transition-transform flex items-center justify-center"
                style={{
                  padding: '11px 16px',
                  background: 'var(--ssc-danger-soft)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: 'var(--ssc-danger)',
                }}
              >
                End &amp; See Result
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <Head><title>{isExpiredPrompt ? 'Quiz Expired' : 'Resume Quiz'} — SSC GK Score Booster</title></Head>
        <AppCard
          variant="premium"
          className="w-full max-w-[360px] p-6"
          style={{
            background: 'var(--ssc-surface)',
            border: '1px solid var(--ssc-border-soft)',
            borderRadius: 28,
            boxShadow: 'var(--ssc-shadow-float)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,106,0,0.12)', color: 'var(--ssc-orange)' }}
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

          <h1 id="resume-quiz-title" className="t-page-title font-display mb-3" style={{ color: 'var(--ssc-text-primary)' }}>
            {isExpiredPrompt ? 'Quiz Attempt Expired' : 'Resume Quiz?'}
          </h1>
          <p className="t-body mb-4" style={{ color: 'var(--ssc-text-secondary)' }}>
            {isExpiredPrompt
              ? `Your previous quiz was inactive for too long. You answered ${sessionAnsweredCount} of ${sessionQuestionCount} questions.`
              : `You have an unfinished ${getDisplaySubject(session.subject, session.collection) || 'Quiz'} · ${session.topic || 'Mixed'} quiz. You answered ${sessionAnsweredCount} of ${session.totalQuestions || session.questions?.length || 0} questions.`}
          </p>

          {sessionAttemptedCount > 0 && (
            <div className="w-full mb-4">
              <div className="t-badge inline-flex items-center mb-2" style={{
                color: 'var(--ssc-orange)',
                background: 'rgba(255,106,0,0.10)',
                border: '1px solid rgba(255,106,0,0.18)',
                borderRadius: 999,
                padding: '4px 12px',
              }}>
                {sessionAttemptedCount} / {sessionQuestionCount} attempted
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--ssc-border-soft)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 999,
                  width: `${attemptedProgress}%`,
                  background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {!isExpiredPrompt && (
            <p className="text-xs mb-4" style={{ color: 'var(--ssc-text-muted)' }}>
              Resume from the same question without restarting the set.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <AppButton
              as="button"
              onClick={isExpiredPrompt ? handleEndStoredAttempt : handleResumeStoredQuiz}
              className="w-full py-3.5"
              style={{
                background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                color: 'var(--ssc-text-inverse)',
                boxShadow: 'var(--ssc-shadow-cta)',
              }}
            >
              {isExpiredPrompt ? 'View Partial Result' : 'Continue Quiz'}
            </AppButton>
            <AppButton
              as="button"
              variant="secondary"
              onClick={isExpiredPrompt ? startFreshAfterRecovery : handleDiscardStoredAttempt}
              className="w-full py-3.5"
              style={{
                background: isExpiredPrompt ? 'var(--ssc-surface)' : 'var(--ssc-danger-soft)',
                border: isExpiredPrompt ? '1px solid var(--ssc-border-soft)' : '1px solid rgba(239,68,68,0.24)',
                color: isExpiredPrompt ? 'var(--ssc-text-secondary)' : 'var(--ssc-danger)',
              }}
            >
              {isExpiredPrompt ? 'Start Fresh' : 'End & See Result'}
            </AppButton>
          </div>
        </AppCard>
      </div>
    );
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
      <Head><title>Loading — SSC GK Score Booster</title></Head>
      {mode === 'daily' ? (
        <DailyChallengeLoader statusText={loadingCopy} />
      ) : (
        <QuizLoader subject={subject} statusText={loadingCopy} />
      )}
      <p className="sr-only" aria-live="polite">{loadingCopy}</p>
      <p className="fixed bottom-8 left-0 right-0 text-center text-xs font-medium text-slate-500">
        {loadingCopy}
      </p>
      {showLoadingRetry && mode !== 'daily' && (
        <button
          onClick={() => {
            setShowLoadingRetry(false);
            setLoadingCopy('Preparing your quiz');
            setRetryCount(c => c + 1);
          }}
          className="fixed bottom-16 rounded-2xl px-5 py-2.5 text-sm font-bold active:scale-[0.98] transition-transform"
          style={{
            background: 'rgba(255,122,26,0.14)',
            border: '1px solid rgba(255,122,26,0.32)',
            color: '#FDBA74',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );

  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center px-5" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
      <Head><title>Couldn&apos;t load quiz — SSC GK Score Booster</title></Head>
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--ssc-surface)',
        borderRadius: 24, padding: '28px 24px',
        border: '1px solid var(--ssc-border-soft)',
        boxShadow: 'var(--ssc-shadow-float)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16, marginBottom: 18,
          background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>⚠️</div>
        <p style={{ fontFamily: 'var(--font-display,inherit)', fontSize: 20, fontWeight: 800, color: 'var(--ssc-text-primary)', textAlign: 'center', marginBottom: 8 }}>
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
              onClick={() => {
                setError(null);
                setShowLoadingRetry(false);
                setLoadingCopy('Preparing your quiz');
                setLoading(true);
                setRetryCount(c => c + 1);
              }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-display,inherit)', fontWeight: 700, fontSize: 15, color: 'var(--ssc-text-inverse)',
                background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                boxShadow: 'var(--ssc-shadow-cta)',
              }}
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14, cursor: 'pointer',
              fontFamily: 'var(--font-display,inherit)', fontWeight: 700, fontSize: 15,
              color: 'var(--ssc-text-secondary)', background: 'var(--ssc-surface)',
              border: '1.5px solid var(--ssc-border-soft)',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );

  if (quizComplete) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
      <Head><title>Results — SSC GK Score Booster</title></Head>
      <div className="w-12 h-12 rounded-full border-4 animate-spin" style={{ borderColor: 'rgba(20,184,166,0.25)', borderTopColor: '#14B8A6' }} />
      <p className="font-display font-bold text-lg" style={{ color: 'var(--ssc-text-primary)' }}>Loading your results…</p>
    </div>
  );

  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
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
          border-color: var(--ssc-teal) !important;
          box-shadow: 0 8px 20px rgba(16,32,51,0.10) !important;
        }
        .opt-btn:not(:disabled):hover .opt-badge {
          background: var(--ssc-teal-soft) !important;
          box-shadow: 0 0 0 3px rgba(14,165,164,0.10);
        }
        .opt-btn:not(:disabled):active {
          transform: scale(0.97) translateY(0) !important;
        }
      `}</style>

      {showExitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: 'var(--ssc-overlay)', backdropFilter: 'blur(3px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-quiz-title"
        >
          <div
            className="w-full max-w-[360px]"
            style={{
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              borderRadius: 28,
              padding: 24,
              boxShadow: 'var(--ssc-shadow-float)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,122,26,0.12)', color: '#ff7a1a' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            </div>

            <h2 id="exit-quiz-title" className="t-page-title font-display mb-3" style={{ color: 'var(--ssc-text-primary)' }}>
              Leave quiz?
            </h2>

            <div className="w-full mb-4">
              <div className="t-badge inline-flex items-center mb-2" style={{
                color: 'var(--ssc-orange)',
                background: 'rgba(255,106,0,0.10)', border: '1px solid rgba(255,106,0,0.18)',
                borderRadius: 999, padding: '4px 12px',
              }}>
                {attemptedCount} / {questions.length} attempted
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--ssc-border-soft)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 999,
                  width: `${questions.length ? Math.round((attemptedCount / questions.length) * 100) : 0}%`,
                  background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <p className="t-body mb-5" style={{ color: 'var(--ssc-text-secondary)' }}>
              End now to see your current result, or continue the quiz.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleContinueQuiz}
                className="t-button-lg w-full rounded-2xl py-3.5 font-display active:scale-[0.98] transition-transform flex items-center justify-center"
                style={{
                  background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-orange-deep))',
                  color: 'var(--ssc-text-inverse)',
                  boxShadow: 'var(--ssc-shadow-cta)',
                }}
              >
                Continue Quiz
              </button>
              <button
                onClick={handleEndQuiz}
                className="t-button-sm w-full rounded-2xl font-display active:scale-[0.98] transition-transform flex items-center justify-center"
                style={{
                  padding: '11px 16px',
                  background: 'var(--ssc-danger-soft)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: 'var(--ssc-danger)',
                }}
              >
                End &amp; See Result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest bookmark banner */}
      {showGuestBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl max-w-[400px] mx-auto" style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.24)' }}>
          <span className="text-xl flex-shrink-0">🔖</span>
          <p className="font-sans font-medium text-sm text-slate-300 leading-snug flex-1">
            Saved! Sign in to sync across devices.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="px-4 pt-3 flex-shrink-0">
        {/* Row 1: subject · topic | Q X/Y | earn coins */}
        <div className="h-10 flex items-center justify-between">
          <span className="t-badge font-sans truncate max-w-[150px]" style={{ color: 'var(--ssc-text-secondary)' }}>
            {getDisplaySubject(effectiveSubject, collection)} · {effectiveTopic}
          </span>
          <span className="t-stat-sm font-display" style={{ color: 'var(--ssc-text-primary)' }}>
            Q {currentIndex + 1}
            <span className="t-badge font-sans font-normal" style={{ color: 'var(--ssc-text-muted)' }}>/{questions.length}</span>
          </span>
          <span className="t-badge font-sans" style={{ color: 'var(--ssc-orange)' }}>⚡ Earn Coins</span>
        </div>
        {cacheWarning && (
          <p className="text-xs pb-2" style={{ color: '#fbbf24' }}>
            {cacheWarning}
          </p>
        )}

        {/* Row 2: progress bar + completed count */}
        <div className="flex items-center gap-2 pb-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: 'var(--ssc-border-soft)' }}>
            <div
              style={{
                height: '100%',
                width: `${(currentIndex / questions.length) * 100}%`,
                background: 'linear-gradient(90deg, var(--ssc-teal), #14B8A6)',
                borderRadius: 999,
                transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
          <span className="font-sans font-semibold flex-shrink-0" style={{ fontSize: 11, color: 'var(--ssc-text-muted)' }}>
            {currentIndex}/{questions.length}
          </span>
        </div>
      </div>

      {/* ── Quiz status row ── */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{
          borderTop: '1px solid var(--ssc-border-soft)',
          borderBottom: '1px solid var(--ssc-border-soft)',
          background: 'rgba(255,255,255,0.70)',
        }}
      >
        <TimerRing timeLeft={timeLeft} duration={QUESTION_DURATION_SECONDS} />

        <div style={{ width: 1, height: 32, background: 'var(--ssc-border-soft)', flexShrink: 0 }} />

        <div className="flex flex-col gap-0.5 min-w-0">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ssc-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Scoring
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ssc-text-primary)' }}>
            ⚡ +2 correct &nbsp;·&nbsp; <span style={{ color: '#f87171' }}>−0.5 wrong</span>
          </span>
        </div>
      </div>

      {/* Scrollable question area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* Question card */}
        <AppCard
          className="mt-3 relative"
          style={{
            background: 'var(--ssc-surface)',
            border: '1px solid var(--ssc-border-soft)',
            boxShadow: 'var(--ssc-shadow-card)',
          }}
        >
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
                background: savedIds.has(q.id) ? 'var(--ssc-teal-soft)' : 'var(--ssc-surface-soft)',
                border: savedIds.has(q.id) ? '1px solid rgba(14,165,164,0.35)' : '1px solid var(--ssc-border-soft)',
              }}
            >
              <BookmarkIcon filled={savedIds.has(q.id)} size={16} animKey={bmAnimKey} />
            </div>
            {bookmarkFeedback === q.id && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#14B8A6',
                whiteSpace: 'nowrap',
                animation: 'bmLabelIn 0.2s ease both',
              }}>
                Saved ✓
              </span>
            )}
          </button>

          <p className="font-display font-bold text-sm leading-relaxed whitespace-pre-line pr-10" style={{ color: 'var(--ssc-text-primary)' }}>
            {q.question}
          </p>
        </AppCard>

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
              background: 'var(--ssc-surface)',
              border: '1px solid var(--ssc-border-soft)',
              boxShadow: '0 4px 14px rgba(16,32,51,0.04)',
            };

            /* ── Badge style ── */
            let badgeStyle = {
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: 'var(--font-display,inherit)', fontWeight: 800, fontSize: 12,
              background: 'var(--ssc-teal-soft)',
              color: 'var(--ssc-teal)',
              border: '1px solid rgba(14,165,164,0.20)',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
            };

            let badgeContent = label; // A / B / C / D

            if (showFeedback) {
              if (isCorrect) {
                rowStyle = { ...rowStyle,
                  background: 'var(--ssc-success-soft)',
                  border: '1px solid var(--ssc-success)',
                  boxShadow: '0 8px 22px rgba(18,184,134,0.14)',
                  animation: 'optCorrect 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
                };
                badgeStyle = { ...badgeStyle,
                  background: 'var(--ssc-success)', color: '#fff',
                  boxShadow: '0 0 0 3px rgba(18,184,134,0.14)',
                };
                badgeContent = 'check';
              } else if (isSelected) {
                rowStyle = { ...rowStyle,
                  background: 'var(--ssc-danger-soft)',
                  border: '1px solid var(--ssc-danger)',
                  animation: 'optWrong 0.35s ease both',
                };
                badgeStyle = { ...badgeStyle,
                  background: 'var(--ssc-danger)', color: '#fff',
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
                <span style={{ fontSize: 14, fontWeight: 600, color: showFeedback && isSelected && !isCorrect ? 'var(--ssc-danger)' : showFeedback && isCorrect ? 'var(--ssc-text-primary)' : 'var(--ssc-text-primary)', flex: 1, lineHeight: 1.5 }}>
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
              style={{ color: 'var(--ssc-teal)', padding: '6px 2px', minHeight: 36 }}
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
