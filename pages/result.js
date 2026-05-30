import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import XPToast from '@/components/XPToast';
import Confetti from '@/components/Confetti';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import Loader from '@/components/ui/Loader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { fetchWithClientCache, formatLastUpdated, patchCache, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// ─── Display helper ───────────────────────────────────────────────────────────
const COLLECTION_DISPLAY_NAMES = { PYQ: 'SSC PYQ', Parmar: 'Parmar SSC' };
function getDisplaySubject(subject, collection) {
  if (!subject) return subject;
  if (subject === 'Mixed' && collection && collection !== 'general') {
    return COLLECTION_DISPLAY_NAMES[collection] || collection;
  }
  return subject;
}

/* ── Avatar — mirrors dashboard Avatar component exactly ── */
function ChampionAvatar({ imageUrl, name, size = 36 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  if (imageUrl && !imgError) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20"
        style={{ width: size, height: size }}
      >
        <img
          src={imageUrl}
          alt={name || 'avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-black text-white"
        style={{ fontSize: size * 0.42 }}
      >
        {initial}
      </span>
    </div>
  );
}


function patchProfileCaches(profileSnapshot) {
  if (!profileSnapshot) return;
  try {
    writeCache(CACHE_KEYS.USER_PROFILE, profileSnapshot);
    patchCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, data => ({
      ...(data || {}),
      profile: profileSnapshot,
    }));
  } catch {}
}

function patchGuestProfileCache() {
  try {
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const existing = readCache(CACHE_KEYS.GUEST_PROFILE);
    const next = {
      ...(existing?.data || {}),
      name: existing?.data?.name || 'Guest',
      playedToday: true,
      lastAttemptDate: today,
    };
    if (existing) patchCache(CACHE_KEYS.GUEST_PROFILE, () => next);
    else writeCache(CACHE_KEYS.GUEST_PROFILE, next);
  } catch {}
}

function getWeeklyPlayers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.weeklyTop)) return data.weeklyTop;
  if (Array.isArray(data?.leaders)) return data.leaders;
  if (Array.isArray(data?.leaderboard?.weeklyTop)) return data.leaderboard.weeklyTop;
  return [];
}

function getAIResultKey(sessionId) {
  return `ai_result:${sessionId || 'latest'}`;
}


export default function Result() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [result, setResult]                   = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem('quizResult') || 'null'); } catch { return null; }
  });
  const [aiAnalysis, setAiAnalysis]           = useState(null);
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiError, setAiError]                 = useState('');
  const [xpResult, setXPResult]               = useState(null);
  const [savingXP, setSavingXP]               = useState(false);
  const [showXPToast, setShowXPToast]         = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [topPerformers, setTopPerformers]     = useState([]);
  const [feedback, setFeedback]               = useState('');
  const [feedbackSent, setFeedbackSent]       = useState(false);
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [feedbackType, setFeedbackType]       = useState('');
  const [copied, setCopied]                   = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showConfetti, setShowConfetti]       = useState(false);
  const [champsSlide, setChampsSlide]         = useState(0);
  const [champsPaused, setChampsPaused]       = useState(false);
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false);
  const [leaderboardMsg, setLeaderboardMsg]   = useState('');
  const [weeklyUpdatedAt, setWeeklyUpdatedAt] = useState(null);
  const scoreSavedRef = useRef(false);
  const landingConfettiShownRef = useRef(false);
  const leaderboardRefreshedAfterScoreRef = useRef(false);



  async function loadWeeklyLeaderboard({ forceRefresh = false, background = false } = {}) {
    if (!background) setLeaderboardRefreshing(forceRefresh);
    try {
      const result = await fetchWithClientCache({
        key: CACHE_KEYS.WEEKLY_LEADERBOARD,
        url: '/api/leaderboard?scope=weekly',
        maxAgeMs: CACHE_TTL.THIRTY_MINUTES,
        forceRefresh,
        onCache(entry) {
          const players = getWeeklyPlayers(entry.data);
          if (players.length > 0) {
            setTopPerformers(players.slice(0, 5));
            setWeeklyUpdatedAt(entry.timestamp);
          }
        },
        onFresh(data) {
          const players = getWeeklyPlayers(data);
          if (players.length > 0) setTopPerformers(players.slice(0, 5));
        },
      });
      const players = getWeeklyPlayers(result.data);
      if (players.length > 0) {
        setTopPerformers(players.slice(0, 5));
      } else {
        setLeaderboardMsg('Showing last saved leaderboard');
      }
      setWeeklyUpdatedAt(result.timestamp || Date.now());
      if (result.stale) setLeaderboardMsg('Showing last saved leaderboard');
      else if (players.length > 0) setLeaderboardMsg('');
    } catch {
      const cached = readCache(CACHE_KEYS.WEEKLY_LEADERBOARD, CACHE_TTL.THIRTY_MINUTES);
      const players = getWeeklyPlayers(cached?.data);
      if (players.length > 0) {
        setTopPerformers(players.slice(0, 5));
        setWeeklyUpdatedAt(cached.timestamp);
      }
      if (cached?.timestamp) setWeeklyUpdatedAt(cached.timestamp);
      setLeaderboardMsg('Showing last saved leaderboard');
    } finally {
      if (!background) setLeaderboardRefreshing(false);
    }
  }

  // Fetch top performers from cache first; API only when cache is absent/stale.
  useEffect(() => {
    loadWeeklyLeaderboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance Weekly Champions carousel (mirrors dashboard behaviour)
  useEffect(() => {
    if (topPerformers.length < 2 || champsPaused) return;
    const t = setInterval(() => setChampsSlide(s => (s + 1) % Math.min(topPerformers.length, 3)), 4000);
    return () => clearInterval(t);
  }, [topPerformers.length, champsPaused]);

  useEffect(() => {
    if (!result || landingConfettiShownRef.current) return;
    landingConfettiShownRef.current = true;
    if ((result.accuracy ?? 0) >= 85) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3800);
      return () => clearTimeout(t);
    }
  }, [result]);

  // Save score (logged-in only, once)
  useEffect(() => {
    if (!router.isReady) return;
    if (status !== 'authenticated') return;
    if (scoreSavedRef.current) return;
    scoreSavedRef.current = true;

    const { correct, incorrect, skipped, total, score, subject, topic, sessionId } = router.query;
    if (!correct && !result) return;

    setSavingXP(true);
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correctAnswers:   Number(correct   || result?.correct          || 0),
        incorrectAnswers: Number(incorrect || result?.incorrect        || 0),
        skipped:          Number(skipped   || result?.skipped          || 0),
        totalQuestions:   Number(total     || result?.totalQuestions   || 0),
        rawScore:         Number(score     || result?.rawScore         || 0),
        subject:          subject  || result?.subject  || '',
        topic:            topic    || result?.topic    || '',
        sessionId:        sessionId || result?.sessionId || crypto.randomUUID(),
        isDailyChallenge: (subject || result?.subject) === 'Daily Challenge',
      }),
    })
      .then(r => r.json())
      .then(data => {
        setSavingXP(false);
        if (data.ok) {
          setXPResult(data);
          patchProfileCaches(data.profileSnapshot);
          if (!leaderboardRefreshedAfterScoreRef.current) {
            leaderboardRefreshedAfterScoreRef.current = true;
            loadWeeklyLeaderboard({ forceRefresh: true, background: true });
          }
          setShowXPToast(true);
          setTimeout(() => setShowXPToast(false), 4000);
          if (data.accuracy >= 85) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
          }
        }
      })
      .catch(() => { setSavingXP(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router.isReady, result]);

  useEffect(() => {
    if (!result || status !== 'unauthenticated') return;
    patchGuestProfileCache();
  }, [result, status]);

  useEffect(() => {
    if (!result || !router.isReady) return;
    const key = getAIResultKey(router.query.sessionId || result.sessionId);
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) setAiAnalysis(JSON.parse(cached));
    } catch {}
  }, [result, router.isReady, router.query.sessionId]);

  async function handleGenerateAIAnalysis() {
    if (!result || aiLoading) return;
    const key = getAIResultKey(router.query.sessionId || result.sessionId);
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setAiAnalysis(JSON.parse(cached));
        setAiError('');
        return;
      }
    } catch {}

    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai/result-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject:          result.subject,
          topic:            result.topic,
          totalQuestions:   result.totalQuestions,
          correctAnswers:   result.correct,
          incorrectAnswers: result.incorrect,
          skipped:          result.skipped,
          rawScore:         result.rawScore,
          accuracy:         result.accuracy,
        }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      const analysis = { summary: data.aiSummary || data.summary || '' };
      if (!analysis.summary) throw new Error('Empty AI response');
      sessionStorage.setItem(key, JSON.stringify(analysis));
      setAiAnalysis(analysis);
    } catch {
      setAiError("Couldn’t generate AI analysis. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const isGuest    = status === 'unauthenticated';
  const isLoggedIn = status === 'authenticated';
  // Index of the current user in the top-performers list (−1 if not ranked)
  const userRankIdx = isLoggedIn
    ? topPerformers.findIndex(p => p.email === session?.user?.email)
    : -1;

  useEffect(() => {
    if (!result || !result.xpEarned || result.xpEarned <= 0) return;

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#f97316', '#7B6FD8', '#0D9488', '#E11D48', '#D97706', '#ffffff', '#16a34a'];
    const TOTAL = 120;

    const pieces = Array.from({ length: TOTAL }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      speed: Math.random() * 3 + 2,
      drift: Math.random() * 2 - 1,
      spin: Math.random() * 4 - 2,
    }));

    let frame;
    const DURATION = 3000;
    const start = performance.now();

    function draw(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.y += p.speed;
        p.x += p.drift;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = elapsed < DURATION ? 1 : Math.max(0, 1 - (elapsed - DURATION) / 800);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < DURATION + 800) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(draw);
    }, 600);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [result]);

  function handleContinue() {
    const subject = result?.subject || router.query.subject;
    const collection = result?.collection || router.query.collection || 'general';
    if (subject === 'Mixed') {
      router.push(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${collection}`);
      return;
    }
    router.push('/dashboard');
  }

  function handleShareWhatsApp() {
    const msg = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster-v2.vercel.app`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function handleCopy() {
    const text = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster-v2.vercel.app`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handleFeedbackSubmit() {
    const feedbackMessage = feedback.trim();
    if (feedbackMessage.length < 7) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Feedback_pill: feedbackType,
          Feedback_message: feedbackMessage,
          subject: result?.subject || '',
          topic: result?.topic || '',
        }),
      });
    } catch {
      // silent fail — user still sees confirmation
    }
    setFeedbackSent(true);
    setFeedback('');
    setFeedbackType('');
    setShowFeedbackToast(true);
    setTimeout(() => setShowFeedbackToast(false), 3000);
  }

  if (!result) return (
    <div suppressHydrationWarning style={{ minHeight: '100vh', background: '#0D1B2E', padding: '32px 16px 0' }}>
      <Head><title>Result — SSC GK Score Booster</title></Head>
      <div className="skeleton h-6 w-48 rounded-lg mx-auto mb-4" />
      <div className="skeleton h-56 rounded-3xl mb-4" />
      <div className="skeleton h-20 rounded-3xl mb-4" />
      <div className="skeleton h-40 rounded-3xl" />
    </div>
  );

  return (
    <div suppressHydrationWarning style={{ minHeight: '100vh', background: '#0D1B2E', paddingBottom: 112 }}>
      <Head><title>Result — SSC GK Score Booster</title></Head>

      <canvas
        id="confetti-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}
      />

      <Confetti active={showConfetti} intensity="grand" />

      {xpResult && (
        <XPToast
          visible={showXPToast}
          xpEarned={xpResult.xpEarned}
          totalXP={xpResult.totalXP}
          level={xpResult.level}
          streakCount={xpResult.streakCount}
          isFirstQuizOfDay={xpResult.isFirstQuizOfDay}
          streakMilestone={xpResult.streakMilestone}
        />
      )}

      <style>{`
        @keyframes cardIn  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes stripIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes proofFade { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .card-in     { animation: cardIn  350ms cubic-bezier(0.22,1,0.36,1) both; }
        .xp-strip-in { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 100ms both; }
        .pyq-in      { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 160ms both; }
        .mentor-in   { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 220ms both; }
        .champs-in   { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 280ms both; }
        .champ-slide { animation: proofFade 0.30s ease both; }
        .btn-primary { transition: transform 140ms ease, box-shadow 140ms ease; }
        .btn-primary:hover { transform: translateY(-1px); }
        @keyframes btnPulse {
          0%, 100% { box-shadow: 0 8px 22px rgba(255,122,26,0.30); }
          50%       { box-shadow: 0 12px 32px rgba(255,122,26,0.55), 0 0 0 5px rgba(255,122,26,0.10); }
        }
        .btn-pulse { animation: btnPulse 2.2s ease-in-out infinite; }
      `}</style>

      <div style={{ maxWidth: 430, margin: '0 auto', padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── 1. RESULT SUMMARY CARD ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const rawScore = result.rawScore ?? 0;
          const score = rawScore % 1 === 0 ? rawScore : Number(rawScore).toFixed(1);
          const answeredCount = (result.correct || 0) + (result.incorrect || 0);
          const scoreNum = Number(rawScore);
          const scoreColor = scoreNum < 0 ? '#FBBF24' : scoreNum === 0 ? '#F8FAFC' : '#F97316';

          let statusLabel, statusBg, statusBorder, statusColor;
          if (acc <= 30) {
            statusLabel = 'Needs Revision';
            statusBg = 'rgba(251,191,36,0.10)'; statusBorder = 'rgba(251,191,36,0.30)'; statusColor = '#FBBF24';
          } else if (acc <= 50) {
            statusLabel = 'Keep Practicing';
            statusBg = 'rgba(96,165,250,0.10)'; statusBorder = 'rgba(96,165,250,0.30)'; statusColor = '#60A5FA';
          } else if (acc <= 70) {
            statusLabel = 'Good Attempt';
            statusBg = 'rgba(20,184,166,0.10)'; statusBorder = 'rgba(20,184,166,0.30)'; statusColor = '#14B8A6';
          } else if (acc <= 85) {
            statusLabel = 'Strong Score';
            statusBg = 'rgba(20,184,166,0.14)'; statusBorder = 'rgba(20,184,166,0.35)'; statusColor = '#14B8A6';
          } else {
            statusLabel = 'Excellent';
            statusBg = 'rgba(251,191,36,0.12)'; statusBorder = 'rgba(251,191,36,0.35)'; statusColor = '#FCD34D';
          }

          const cardLabel = result.isDailyChallenge ? 'Daily Challenge Result'
            : `${getDisplaySubject(result.subject, result.collection) || 'Quiz'} Result`;

          return (
            <div className="card-in" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 28, padding: '18px 20px', boxShadow: '0 16px 40px rgba(0,0,0,0.22)' }}>
              <p className="t-stat-label" style={{ color: '#7EA0C4', marginBottom: 8, textAlign: 'center' }}>
                {cardLabel}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                <span className="t-button-sm" style={{ background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, borderRadius: 999, padding: '4px 16px' }}>
                  {statusLabel}
                </span>
              </div>
              {/* Score + Accuracy tiles */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, background: '#112236', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span className="t-stat-lg font-display" style={{ color: scoreColor }}>{score}</span>
                  <span className="t-stat-label" style={{ color: '#7EA0C4' }}>Score</span>
                </div>
                <div style={{ flex: 1, background: '#112236', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span className="t-stat-lg font-display" style={{ color: '#F8FAFC' }}>{Math.round(acc)}%</span>
                  <span className="t-stat-label" style={{ color: '#7EA0C4' }}>Accuracy</span>
                </div>
              </div>

              {/* Correct / Wrong / Skipped */}
              <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 10, paddingBottom: 10, borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                {[
                  { val: result.correct,   label: 'Correct', color: '#22C55E' },
                  { val: result.incorrect, label: 'Wrong',   color: '#F87171' },
                  { val: result.skipped,   label: 'Skipped', color: '#94A3B8' },
                ].map(({ val, label, color: c }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span className="t-stat-sm font-display" style={{ color: c }}>{val}</span>
                    <span className="t-stat-label" style={{ color: '#7EA0C4' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <p className="t-badge" style={{ textAlign: 'center', color: '#93A4BC', marginBottom: 10 }}>
                You answered {answeredCount} of {result.totalQuestions || 0} questions
              </p>
              <button
                className="btn-pulse t-button-lg"
                onClick={() => { setLoadingDetailed(true); setTimeout(() => router.push('/result/detailed'), 100); }}
                style={{
                  width: '100%', height: 52, borderRadius: 16, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #FF7A1A, #FF5A00)',
                  color: '#FFFFFF', border: 'none',
                  marginBottom: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: 'translateY(0)', transition: 'transform 140ms ease, box-shadow 140ms ease',
                  fontFamily: 'Nunito, sans-serif',
                }}
                onPointerEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(174,80,15,0.45)'; }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(174,80,15,0.15)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                {loadingDetailed ? 'Loading…' : 'Review Mistakes →'}
              </button>

              <button
                onClick={handleContinue}
                className="t-button-sm"
                style={{
                  width: '100%', height: 46, borderRadius: 14, cursor: 'pointer',
                  background: '#1E3554', color: '#F8FAFC',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: 'scale(1)', transition: 'transform 140ms ease, background 140ms ease',
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.background = '#243D60'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#1E3554'; }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#1E3554'; }}
              >
                Practice Again
              </button>
            </div>
          );
        })()}

        {/* ── 2. XP + STREAK STRIP ── */}
        {savingXP && !xpResult && (
          <div style={{ background: '#172D47', border: '1px solid rgba(20,184,166,0.22)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid #14B8A6' }}>
            <Loader size="sm" />
            <span style={{ fontSize: 13, color: '#14B8A6', fontWeight: 600 }}>Saving your XP…</span>
          </div>
        )}
        {xpResult && (
          <div className="xp-strip-in" style={{ background: '#172D47', border: '1px solid rgba(20,184,166,0.22)', borderRadius: 20, padding: 16, borderLeft: '4px solid #14B8A6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F8FAFC' }}>+{xpResult.xpEarned} XP earned</span>
              {xpResult.streakCount > 0 && (
                <span style={{ fontSize: 13, fontWeight: 600, color: '#FDBA74' }}>🔥 {xpResult.streakCount} day streak</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#93A4BC' }}>
              Level: {xpResult.level} · {xpResult.totalXP} XP total
            </p>
          </div>
        )}

        {/* ── 3. SSC PYQ PRACTICE CARD ── */}
        <div
          className="pyq-in"
          onClick={() => router.push('/subjects?collection=ssc_pyq')}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#172D47',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 24,
            padding: 20,
            cursor: 'pointer',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '82%',
              height: '100%',
              borderTop: '2px solid rgba(249,115,22,0.72)',
              borderRight: '2px solid rgba(249,115,22,0.72)',
              borderTopRightRadius: 24,
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 14, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999, padding: '3px 12px' }}>
            <span className="t-badge" style={{ color: '#FDBA74', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Most Useful Next Step</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>📚</span>
            </div>
            <p className="t-card-title font-display" style={{ color: '#F8FAFC', margin: 0 }}>SSC PYQ Practice</p>
          </div>
          <p className="t-card-subtitle" style={{ color: '#93A4BC', marginBottom: 14 }}>
            Practice previous year SSC questions by subject.<br />
            Choose Polity, History, Science, Geography and more.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {["7,000+ Q's", 'Exam-level Practice', 'Subject-wise'].map(tag => (
              <span key={tag} className="t-badge" style={{ color: '#7EA0C4', background: 'rgba(126,160,196,0.10)', border: '1px solid rgba(126,160,196,0.20)', borderRadius: 999, padding: '3px 10px' }}>
                {tag}
              </span>
            ))}
          </div>
          <button
            className="btn-pulse t-button-lg"
            onClick={() => router.push('/subjects?collection=ssc_pyq')}
            style={{
              width: '100%', height: 52, borderRadius: 18, cursor: 'pointer',
              background: 'linear-gradient(135deg, #FF7A1A, #FF5A00)',
              color: '#FFFFFF', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translateY(0)', transition: 'transform 140ms ease, box-shadow 140ms ease',
              fontFamily: 'Nunito, sans-serif',
            }}
            onPointerEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(255,122,26,0.45)'; }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,122,26,0.15)'; }}
            onPointerUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            Start PYQ Practice →
          </button>
        </div>

        {/* ── 4. AI MENTOR ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const wrongCount = result.incorrect || 0;
          const tip = acc <= 30
            ? `Accuracy is low right now. Start with your ${wrongCount} wrong answer${wrongCount !== 1 ? 's' : ''} — that will improve your score faster than attempting random quizzes.`
            : acc <= 50
            ? 'Keep practicing. Focus on topics where you made mistakes before attempting new ones.'
            : acc <= 70
            ? 'Good base. Your next goal should be reducing negative marks by improving accuracy.'
            : 'Strong attempt. Now practice mixed quizzes daily to improve speed and consistency.';
          return (
            <div className="mentor-in" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 24, padding: 20, borderLeft: '4px solid #14B8A6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(20,184,166,0.65))' }}>
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
                </svg>
                <p className="t-section-label" style={{ color: '#14B8A6', marginBottom: 0 }}>Smart Review Tip</p>
              </div>
              <p className="t-body" style={{ color: '#93A4BC', marginBottom: 14 }}>{tip}</p>
              {aiAnalysis?.summary ? (
                <div style={{ borderRadius: 12, border: '1px solid rgba(20,184,166,0.20)', background: 'rgba(20,184,166,0.07)', padding: '12px 14px' }}>
                  <p className="t-body" style={{ color: '#99F6E4' }}>{aiAnalysis.summary}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateAIAnalysis}
                  disabled={aiLoading}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: aiLoading ? 'default' : 'pointer',
                    color: '#14B8A6', fontSize: 13, fontWeight: 600,
                    opacity: aiLoading ? 0.5 : 1,
                  }}
                >
                  {aiLoading ? 'Generating analysis...' : 'Generate Analysis →'}
                </button>
              )}
              {aiError && <p style={{ marginTop: 8, fontSize: 12, color: '#F87171' }}>{aiError}</p>}
            </div>
          );
        })()}

        {/* ── 5. GUEST SIGN-IN NUDGE ── */}
        {isGuest && (
          <GoogleSignInCard
            title="Save your progress"
            subtitle="Login to save score, XP, streak & rank."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        )}

        {/* ── 6. WEEKLY CHAMPIONS ── */}
        <div
          className="champs-in"
          role="button"
          tabIndex={0}
          onClick={() => router.push('/leaderboard')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              router.push('/leaderboard');
            }
          }}
          style={{
            background: '#172D47',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 24,
            boxShadow: '0 12px 35px rgba(0,0,0,0.20)',
            padding: 18,
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
          onPointerDown={e => { setChampsPaused(true); e.currentTarget.style.transform = 'scale(0.98)'; }}
          onPointerUp={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={() => setChampsPaused(true)}
          onTouchEnd={() => setChampsPaused(false)}
          onTouchCancel={() => setChampsPaused(false)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="t-card-title font-display" style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
                Weekly Champions
              </p>
            </div>
            <div className="flex items-center gap-3" style={{ paddingTop: 4 }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  router.push('/leaderboard');
                }}
                className="t-button-sm flex items-center gap-1 font-sans active:opacity-70"
                style={{ color: '#14B8A6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                View your rank
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {leaderboardRefreshing && topPerformers.length === 0 ? (
            <div className="py-4">
              <Loader card size="sm" label="Loading weekly champions..." />
            </div>
          ) : topPerformers.length === 0 ? (
            <p className="font-sans text-xs text-slate-500 text-center py-4">
              Showing last saved leaderboard
            </p>
          ) : (
            <>
              {/* Full-width auto-advancing card */}
              {(() => {
                const idx = champsSlide % Math.min(topPerformers.length, 3);
                const player = topPerformers[idx];
                const isSelf = player.email === session?.user?.email;
                const cardTheme = [
                  { bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.24)'   },
                  { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)' },
                  { bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.20)'    },
                ][idx];
                return (
                  <div
                    key={idx}
                    className="champ-slide"
                    style={{
                      background: cardTheme.bg,
                      border: `1px solid ${cardTheme.border}`,
                      borderRadius: 18,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    {/* Avatar with medal badge overlaid top-left */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <ChampionAvatar imageUrl={player.image || null} name={player.name} size={36} />
                      <span style={{ position: 'absolute', top: -4, left: -4, fontSize: 16, lineHeight: 1 }}>
                        {RANK_MEDALS[idx]}
                      </span>
                    </div>

                    {/* Name + level + XP */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p className="font-display font-bold truncate"
                          style={{ fontSize: 15, color: isSelf ? '#14B8A6' : '#ffffff', margin: 0 }}>
                          {(player.name || 'User').split(' ')[0]}
                        </p>
                        <span style={{
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                          color: '#facc15',
                          background: 'rgba(250,204,21,0.15)',
                          border: '1px solid rgba(250,204,21,0.3)',
                          borderRadius: 20, padding: '2px 8px',
                        }}>
                          ⭐ {player.level || 'Aspirant'}
                        </span>
                        {isSelf && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            background: 'rgba(20,184,166,0.15)', color: '#14B8A6',
                            border: '1px solid rgba(20,184,166,0.30)',
                            borderRadius: 20, padding: '2px 7px',
                          }}>You</span>
                        )}
                      </div>
                    </div>

                    {/* XP */}
                    <p className="font-display font-bold"
                      style={{ fontSize: 17, color: '#FDBA3B', margin: 0, flexShrink: 0 }}>
                      {Math.round(player.totalScore || 0).toLocaleString()} XP
                    </p>
                  </div>
                );
              })()}

              {(leaderboardMsg || leaderboardRefreshing || weeklyUpdatedAt) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      loadWeeklyLeaderboard({ forceRefresh: true });
                    }}
                    disabled={leaderboardRefreshing}
                    className="font-sans active:opacity-70 disabled:opacity-70"
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: leaderboardRefreshing ? 'default' : 'pointer',
                    }}
                  >
                    {leaderboardRefreshing
                      ? '↻ Refreshing...'
                      : leaderboardMsg
                        ? `${leaderboardMsg} • Updated ${formatLastUpdated(weeklyUpdatedAt) || 'recently'}`
                        : `↻ Updated ${formatLastUpdated(weeklyUpdatedAt) || 'recently'}`}
                  </button>
                </div>
              )}

              {/* Your rank row */}
              {isLoggedIn && (
                <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-slate-400">Your Rank</span>
                    <span className="font-display font-black text-base text-white">
                      {userRankIdx !== -1 ? `#${userRankIdx + 1}` : '—'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: 'rgba(20,184,166,0.12)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.25)' }}>
                    ✓ Active today
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── FEEDBACK CARD ── */}
        {feedbackSent ? (
          <div style={{ borderRadius: 20, padding: 20, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)', borderLeft: '4px solid rgba(20,184,166,0.7)', boxSizing: 'border-box' }}>
            <p style={{ fontSize: 13, color: '#14B8A6', margin: 0, fontWeight: 600 }}>Thanks for your feedback! We'll look into it.</p>
          </div>
        ) : (
          <AppCard
            as="button"
            interactive
            onClick={() => setShowFeedbackSheet(true)}
            className="w-full"
            style={{ display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box', background: '#172D47', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '4px solid rgba(255,107,22,0.7)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,122,26,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF7A1A" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: '0 0 2px' }}>Help us improve the app</p>
              <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.4 }}>Tell us what to improve, add, or fix.</p>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffb26b' }}>Share Feedback</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffb26b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </AppCard>
        )}

        {/* ── 7. SHARE RESULT ── */}
        <AppCard style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)', borderLeft: '4px solid #14B8A6' }}>
          <SectionHeader
            title="Share your result"
            subtitle="Challenge friends to beat your score."
            titleClassName="text-slate-50 text-[13px]"
            subtitleClassName="text-slate-500 text-[12px] mb-3"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <AppButton
              as="button"
              onClick={handleShareWhatsApp}
              className="justify-center"
              style={{
                flex: 1.5, height: 48, borderRadius: 12, cursor: 'pointer',
                background: '#14B8A6', color: '#0F172A', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transform: 'scale(1)', transition: 'background 140ms ease, transform 140ms ease',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.background = '#0F9488'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#14B8A6'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#14B8A6'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#0F172A">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Share on WhatsApp
            </AppButton>
            <AppButton
              as="button"
              variant="secondary"
              onClick={handleCopy}
              style={{
                flex: 0.8, height: 48, borderRadius: 12, cursor: 'pointer',
                background: copied ? 'rgba(20,184,166,0.12)' : '#1E3554',
                color: copied ? '#14B8A6' : '#F8FAFC',
                border: `1px solid ${copied ? 'rgba(20,184,166,0.30)' : 'rgba(255,255,255,0.10)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transform: 'scale(1)', transition: 'background 200ms ease, transform 140ms ease',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {copied ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied ✓</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#93A4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy Result</>
              )}
            </AppButton>
          </div>
        </AppCard>


      </div>

      {loadingDetailed && (
        <Loader fullScreen size="md" label="Loading detailed analysis…" />
      )}

      {/* ── FEEDBACK SUCCESS TOAST ── */}
      {showFeedbackToast && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          animation: 'backdropIn 0.2s ease both',
        }}>
          <div style={{
            background: '#172D47', border: '1px solid rgba(20,184,166,0.30)',
            borderRadius: 24, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            boxShadow: '0 24px 48px rgba(0,0,0,0.40)',
            animation: 'toastPop 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
            maxWidth: 300, width: '80%',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', textAlign: 'center' }}>Thanks for your feedback!</p>
            <p style={{ fontSize: 13, color: '#93A4BC', textAlign: 'center', lineHeight: 1.5 }}>We'll use it to improve your quiz experience.</p>
          </div>
          <style>{`@keyframes toastPop { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }`}</style>
        </div>
      )}

      {/* ── FEEDBACK BOTTOM SHEET ── */}
      {showFeedbackSheet && (
        <>
          <style>{`
            @keyframes modalIn   { from { opacity:0; transform:translate(-50%,-50%) scale(0.94); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
            @keyframes backdropIn{ from { opacity: 0; } to { opacity: 1; } }
          `}</style>

          {/* Backdrop */}
          <div
            onClick={() => setShowFeedbackSheet(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.60)',
              animation: 'backdropIn 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          />

          {/* Modal — centered on screen */}
          <div
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 48px)', maxWidth: 360,
              zIndex: 50,
              background: 'var(--bg-card)',
              borderRadius: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
              animation: 'modalIn 0.25s cubic-bezier(0.22,1,0.36,1)',
              padding: '24px 20px',
            }}
          >
            <div style={{ padding: 0 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Orange alert icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,122,26,0.12)',
                    border: '1.5px solid rgba(255,122,26,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF7A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                  </div>
                  <p className="font-display font-black" style={{ fontSize: 18, color: '#F8FAFC' }}>Report a quiz issue</p>
                </div>
                <button
                  onClick={() => setShowFeedbackSheet(false)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(148,163,184,0.12)',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94A3B8', cursor: 'pointer', flexShrink: 0,
                  }}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <p className="font-sans" style={{ fontSize: 13, color: '#64748B', marginBottom: 12, lineHeight: 1.5 }}>
                Found a wrong answer, typo, or confusing explanation?
              </p>

              {/* Type chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['Wrong answer', 'Typo', 'Explanation issue', 'App issue', 'Suggestion'].map(type => {
                  const active = feedbackType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFeedbackType(active ? '' : type)}
                      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      style={{
                        padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? 'rgba(255,122,26,0.14)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1px solid rgba(255,122,26,0.45)' : '1px solid rgba(148,163,184,0.18)',
                        color: active ? '#FFB26B' : '#94A3B8',
                        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease',
                        transform: 'scale(1)',
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              {/* Textarea label + input — 16px font prevents iOS auto-zoom */}
              <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 }}>
                Describe the issue
              </p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={
                  feedbackType === 'Wrong answer'      ? 'Which option seems correct and why?' :
                  feedbackType === 'Typo'              ? 'Where did you notice the typo?' :
                  feedbackType === 'Explanation issue' ? 'What part of the explanation felt confusing?' :
                  feedbackType === 'App issue'         ? 'What happened? E.g. button not working, screen stuck…' :
                  feedbackType === 'Suggestion'        ? 'What would you like to see improved?' :
                  'Option B seems correct, but app marked C.'
                }
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.70)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  fontSize: 16,
                  color: '#F8FAFC',
                  lineHeight: 1.55,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  height: 120,
                  marginBottom: 14,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(148,163,184,0.40)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.18)'; }}
              />
              <p style={{ fontSize: 11, color: '#64748B', marginTop: -8, marginBottom: 14 }}>
                Minimum 7 characters
              </p>

              {/* Send button — full width, Cancel removed (X button handles close) */}
              {(() => {
                const ready = feedback.trim().length >= 7;
                return (
                  <button
                    onClick={async () => { await handleFeedbackSubmit(); setShowFeedbackSheet(false); }}
                    disabled={!ready}
                    style={{
                      width: '100%', minHeight: 52, borderRadius: 16,
                      background: ready ? 'linear-gradient(135deg, #FF7A1A, #FF5A00)' : 'rgba(255,255,255,0.06)',
                      border: ready ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      color: ready ? '#FFFFFF' : 'rgba(203,213,225,0.45)',
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                      boxShadow: ready ? '0 8px 22px rgba(255,106,0,0.18)' : 'none',
                      cursor: ready ? 'pointer' : 'not-allowed',
                      transition: 'background 150ms ease, box-shadow 150ms ease, color 150ms ease, border-color 150ms ease',
                    }}
                  >
                    {ready ? 'Send Feedback →' : 'Send Feedback'}
                  </button>
                );
              })()}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
