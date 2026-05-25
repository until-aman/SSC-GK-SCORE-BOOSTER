import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import XPToast from '@/components/XPToast';
import Confetti from '@/components/Confetti';

import Loader from '@/components/ui/Loader';
import { fetchAISummary } from '@/lib/fetchAI';
import { readCache, writeCache, patchCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

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

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);


export default function Result() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [result, setResult]                   = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem('quizResult') || 'null'); } catch { return null; }
  });
  const [aiSummary, setAiSummary]             = useState(null);
  const [summaryLoading, setSummaryLoading]   = useState(true);
  const [xpResult, setXPResult]               = useState(null);
  const [savingXP, setSavingXP]               = useState(false);
  const [showXPToast, setShowXPToast]         = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [topPerformers, setTopPerformers]     = useState([]);
  const [feedback, setFeedback]               = useState('');
  const [feedbackSent, setFeedbackSent]       = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showConfetti, setShowConfetti]       = useState(false);
  const [champsSlide, setChampsSlide]         = useState(0);
  const scoreSavedRef = useRef(false);
  const landingConfettiShownRef = useRef(false);



  // Fetch top performers — check caches before hitting the API
  useEffect(() => {
    // 1. Bootstrap cache (freshest source — populated by dashboard)
    const bootstrap = readCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, CACHE_TTL.ONE_DAY);
    if (bootstrap?.isFresh && bootstrap.data?.leaderboard?.weeklyTop?.length) {
      setTopPerformers(bootstrap.data.leaderboard.weeklyTop.slice(0, 5));
      return;
    }
    // 2. Dedicated leaderboard cache (30-min TTL)
    const lbCached = readCache(CACHE_KEYS.WEEKLY_LEADERBOARD, CACHE_TTL.THIRTY_MINUTES);
    if (lbCached?.isFresh && lbCached.data?.leaders?.length) {
      setTopPerformers(lbCached.data.leaders.slice(0, 5));
      return;
    }
    // 3. Fall back to API and cache the result
    fetch('/api/leaderboard?scope=weekly')
      .then(r => r.json())
      .then(d => {
        setTopPerformers((d.leaders || []).slice(0, 5));
        if (d.leaders?.length) writeCache(CACHE_KEYS.WEEKLY_LEADERBOARD, d);
      })
      .catch(() => {});
  }, []);

  // Auto-advance Weekly Champions carousel (mirrors dashboard behaviour)
  useEffect(() => {
    if (topPerformers.length < 2) return;
    const t = setInterval(() => setChampsSlide(s => (s + 1) % Math.min(topPerformers.length, 3)), 3000);
    return () => clearInterval(t);
  }, [topPerformers.length]);

  useEffect(() => {
    if (!result || landingConfettiShownRef.current) return;
    landingConfettiShownRef.current = true;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 3800);
    return () => clearTimeout(t);
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
        isDailyChallenge: false,
      }),
    })
      .then(r => r.json())
      .then(data => {
        setSavingXP(false);
        if (data.ok) {
          setXPResult(data);
          setShowXPToast(true);
          setTimeout(() => setShowXPToast(false), 4000);

          // Patch dashboard bootstrap cache so XP/level/streak show correctly on next visit
          patchCache(CACHE_KEYS.DASHBOARD_BOOTSTRAP, existing => {
            if (!existing?.profile) return existing;
            const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
              .toISOString().split('T')[0];
            return {
              ...existing,
              profile: {
                ...existing.profile,
                totalXP:         data.totalXP         ?? existing.profile.totalXP,
                level:           data.level           ?? existing.profile.level,
                streakCount:     data.streakCount     ?? existing.profile.streakCount,
                lastAttemptDate: todayIST,
              },
            };
          });
          // Clear session refresh flag so dashboard picks up fresh data next visit
          try { sessionStorage.removeItem('dashboard_refreshed_this_session'); } catch {}

          // Confetti on milestones: perfect score, high accuracy, streak milestone, or first quiz of day
          const acc = Number(router.query.correct || 0) / Number(router.query.total || 1) * 100;
          if (
            data.streakMilestone ||
            data.isFirstQuizOfDay ||
            Number(router.query.correct) === Number(router.query.total) ||
            acc >= 80
          ) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
          }
        }
      })
      .catch(() => { setSavingXP(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router.isReady, result]);

  // AI summary — 5s timeout via fetchAISummary
  useEffect(() => {
    if (!result) return;
    if (result.aiData?.summary) {
      setAiSummary(result.aiData.summary);
      setSummaryLoading(false);
      return;
    }
    fetchAISummary({
      subject:          result.subject,
      topic:            result.topic,
      totalQuestions:   result.totalQuestions,
      correctAnswers:   result.correct,
      incorrectAnswers: result.incorrect,
      skipped:          result.skipped,
      rawScore:         result.rawScore,
    }).then(({ text }) => {
      setAiSummary(text);
      setSummaryLoading(false);
      // Persist to sessionStorage so re-visits don't re-fetch
      if (text) {
        try {
          const stored = JSON.parse(sessionStorage.getItem('quizResult') || '{}');
          if (!stored.aiData) stored.aiData = {};
          stored.aiData.summary = text;
          sessionStorage.setItem('quizResult', JSON.stringify(stored));
        } catch {}
      }
    });
  }, [result]);

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
    if (!feedback.trim()) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          subject: result?.subject || '',
          topic: result?.topic || '',
        }),
      });
    } catch {
      // silent fail — user still sees confirmation
    }
    setFeedbackSent(true);
    setFeedback('');
  }

  if (!result) return (
    <div className="min-h-screen bg-[#0f172a] px-4 pt-8 flex flex-col gap-4">
      <Head><title>Result — SSC GK Score Booster</title></Head>
      <div className="skeleton h-6 w-48 rounded-lg mx-auto" />
      <div className="skeleton h-56 rounded-3xl" />
      <div className="skeleton h-20 rounded-3xl" />
      <div className="skeleton h-40 rounded-3xl" />
    </div>
  );

  const accuracy = (result.accuracy || 0).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0f172a] pb-28">
      <Head><title>Result — SSC GK Score Booster</title></Head>

      <canvas
        id="confetti-canvas"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 999,
        }}
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

      <div className="max-w-[430px] mx-auto px-4 pt-8 flex flex-col gap-4">

        {/* ── TOP HERO SECTION ── */}
        {(() => {
          const acc   = result.accuracy ?? 0;
          const score = result.rawScore % 1 === 0 ? result.rawScore : result.rawScore.toFixed(1);
          let headline, color;
          if (acc >= 70) {
            headline = 'Excellent Work 🔥';
            color    = '#10B981';
          } else if (acc >= 40) {
            headline = 'Good Attempt 👍';
            color    = '#F59E0B';
          } else {
            headline = 'Needs Revision 💪';
            color    = '#F97316';
          }
          return (
            <div className="card-enter card-enter-1 bg-slate-800/70 border border-slate-700/50 rounded-3xl p-5 flex flex-col gap-4">

              {/* Title + headline */}
              <div className="text-center">
                <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-2">
                  {result.subject} {result.topic !== result.subject ? `· ${result.topic}` : ''} Result
                </p>
                <p className="font-display font-black" style={{ fontSize: 24, color, lineHeight: 1.2, marginBottom: 4 }}>
                  {headline}
                </p>
                <p className="font-sans text-sm" style={{ color: 'rgba(148,163,184,0.70)' }}>
                  {score} marks · {Math.round(acc)}% accuracy
                </p>
              </div>

              {/* Score + Accuracy boxes */}
              <div className="flex gap-3">
                <div className="flex-1 bg-slate-900/60 rounded-2xl p-4 flex flex-col items-center gap-1 border border-slate-700/40">
                  <p className="score-pop font-display font-black text-3xl text-orange-400 leading-none">
                    {score}
                  </p>
                  <p className="font-sans text-xs text-slate-500" style={{ marginTop: 2 }}>Marks</p>
                </div>
                <div className="flex-1 bg-slate-900/60 rounded-2xl p-4 flex flex-col items-center gap-1 border border-slate-700/40">
                  <p className="score-pop font-display font-black text-3xl text-emerald-400 leading-none" style={{ animationDelay: '0.35s' }}>
                    {Math.round(acc)}%
                  </p>
                  <p className="font-sans text-xs text-slate-500" style={{ marginTop: 2 }}>Accuracy</p>
                </div>
              </div>

              {/* Correct / Wrong / Skipped */}
              <div className="flex justify-around py-3 border-t border-slate-700/40 border-b border-slate-700/40">
                {[
                  { val: result.correct,   label: 'Correct', color: '#10B981' },
                  { val: result.incorrect, label: 'Wrong',   color: '#F87171' },
                  { val: result.skipped,   label: 'Skipped', color: '#94A3B8' },
                ].map(({ val, label, color: c }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="font-display font-black text-2xl leading-none" style={{ color: c }}>{val}</span>
                    <span className="font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">{label}</span>
                  </div>
                ))}
              </div>

              {/* Review Mistakes CTA — Orange 3D primary */}
              <button
                onClick={() => { setLoadingDetailed(true); setTimeout(() => router.push('/result/detailed'), 100); }}
                className="w-full font-display font-bold text-base flex items-center justify-center"
                style={{
                  height: 64, borderRadius: 22, cursor: 'pointer',
                  background: 'linear-gradient(180deg, #FF8A1F 0%, #FF5A00 100%)',
                  color: '#ffffff', fontSize: 16, fontWeight: 800,
                  border: '1px solid rgba(255,205,160,0.35)',
                  boxShadow: '0 8px 0 #B73E00, 0 18px 38px rgba(255,106,0,0.34)',
                  transform: 'translateY(0)',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
                onPointerDown={e => {
                  e.currentTarget.style.transform = 'translateY(5px)';
                  e.currentTarget.style.boxShadow = '0 3px 0 #B73E00, 0 8px 18px rgba(255,106,0,0.24)';
                }}
                onPointerUp={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 0 #B73E00, 0 18px 38px rgba(255,106,0,0.34)';
                }}
                onPointerLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 0 #B73E00, 0 18px 38px rgba(255,106,0,0.34)';
                }}
              >
                {loadingDetailed ? 'Loading…' : 'Review Mistakes →'}
              </button>

              {/* Try Again — Dark elevated secondary */}
              <button
                onClick={handleContinue}
                className="w-full font-display font-bold text-sm flex items-center justify-center"
                style={{
                  height: 52, borderRadius: 16, cursor: 'pointer',
                  background: '#1E293B', color: '#94A3B8',
                  border: '1px solid rgba(148,163,184,0.16)',
                  boxShadow: '0 4px 0 #0F172A, 0 8px 16px rgba(0,0,0,0.30)',
                  transform: 'translateY(0)',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
                onPointerDown={e => {
                  e.currentTarget.style.transform = 'translateY(3px)';
                  e.currentTarget.style.boxShadow = '0 1px 0 #0F172A, 0 3px 8px rgba(0,0,0,0.20)';
                }}
                onPointerUp={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 0 #0F172A, 0 8px 16px rgba(0,0,0,0.30)';
                }}
                onPointerLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 0 #0F172A, 0 8px 16px rgba(0,0,0,0.30)';
                }}
              >
                Try Again
              </button>

              {result.partialAttempt && (
                <p className="text-center font-sans text-xs text-slate-500">
                  You answered {result.answeredCount ?? result.attemptedCount ?? 0} of {result.totalQuestions} questions.
                </p>
              )}
            </div>
          );
        })()}

        {/* ── XP earned banner (logged-in) ── */}
        {savingXP && !xpResult && (
          <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
            <Loader size="sm" />
            <span className="font-display font-bold text-sm text-emerald-300 animate-pulse">Saving your XP…</span>
          </div>
        )}
        {xpResult && (
          <div className="xp-burst bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-base text-white">⚡ +{xpResult.xpEarned} XP earned</span>
              <span className="font-sans font-medium text-xs text-orange-400">🔥 {xpResult.streakCount} day streak</span>
            </div>
            <p className="font-sans text-sm text-emerald-300 mt-1">Level: {xpResult.level} · {xpResult.totalXP} XP total</p>
            {xpResult.isFirstQuizOfDay && (
              <p className="font-sans text-xs text-yellow-300 mt-0.5">🌅 First quiz bonus included!</p>
            )}
            {xpResult.streakMilestone && (
              <p className="font-sans text-xs text-orange-300 mt-0.5 font-semibold">
                🏆 {xpResult.streakMilestone.label} +{xpResult.streakMilestone.bonus} bonus XP!
              </p>
            )}
          </div>
        )}

        {/* ── AI Mentor ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const tip = acc < 50
            ? 'Accuracy is low right now. Review your wrong answers first — that will improve your score faster than attempting more random quizzes.'
            : acc <= 70
            ? 'Good base. Your next goal should be reducing negative marks by improving accuracy.'
            : 'Strong attempt. Now practice mixed quizzes daily to improve speed and consistency.';
          return (
            <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-4">
              <p className="font-sans font-medium text-xs text-emerald-400 uppercase tracking-widest mb-2">🤖 AI Mentor</p>
              <p className="font-sans font-medium text-sm text-slate-300 leading-relaxed">{tip}</p>
            </div>
          );
        })()}

        {/* ── Guest save nudge (compact) ── */}
        {isGuest && (
          <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-display font-bold text-sm text-white leading-snug">Save your progress</p>
              <p className="font-sans text-xs text-slate-500 mt-0.5">Login to save score, XP, streak &amp; rank.</p>
            </div>
            <button
              onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/dashboard' }); }}
              className="flex-shrink-0 flex items-center gap-1.5 font-semibold text-xs"
              style={{
                padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                background: '#FFFFFF', color: '#0F172A',
                border: '1px solid rgba(255,255,255,0.30)',
                boxShadow: '0 4px 0 #CBD5E1, 0 8px 20px rgba(0,0,0,0.20)',
                transform: 'translateY(0)',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'translateY(3px)';
                e.currentTarget.style.boxShadow = '0 1px 0 #CBD5E1, 0 3px 8px rgba(0,0,0,0.15)';
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 0 #CBD5E1, 0 8px 20px rgba(0,0,0,0.20)';
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 0 #CBD5E1, 0 8px 20px rgba(0,0,0,0.20)';
              }}
            >
              <GoogleSVG />
              Sign in
            </button>
          </div>
        )}

        {/* ── CONTINUE PRACTICING CARD ── */}
        <div className="card-enter card-enter-3 bg-slate-800/70 border border-slate-700/50 rounded-2xl p-4">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-1">
            Keep Going
          </p>
          <p className="font-sans font-medium text-sm text-slate-400 mb-4">
            Practice another quiz to continue your streak.
            {xpResult?.streakCount > 0 && (
              <span className="text-orange-400"> 🔥 {xpResult.streakCount} day streak</span>
            )}
          </p>
          <button
            onClick={handleContinue}
            className="w-full font-display font-extrabold text-base flex items-center justify-center gap-2"
            style={{
              height: 60,
              borderRadius: 22,
              background: 'linear-gradient(180deg, #7C3AED 0%, #5B21B6 100%)',
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 800,
              border: '1px solid rgba(196,181,253,0.35)',
              boxShadow: '0 8px 0 #3B1678, 0 18px 36px rgba(124,58,237,0.32)',
              cursor: 'pointer',
              transform: 'translateY(0)',
              transition: 'transform 140ms ease, box-shadow 140ms ease',
            }}
            onPointerDown={e => {
              e.currentTarget.style.transform = 'translateY(5px)';
              e.currentTarget.style.boxShadow = '0 3px 0 #3B1678, 0 8px 18px rgba(124,58,237,0.24)';
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 0 #3B1678, 0 18px 36px rgba(124,58,237,0.32)';
            }}
            onPointerLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 0 #3B1678, 0 18px 36px rgba(124,58,237,0.32)';
            }}
          >
            ⚡ Practice Again →
          </button>
        </div>

        {/* ── CHALLENGE YOUR FRIENDS ── */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-3xl p-5">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-1">
            Challenge Friends
          </p>
          <p className="font-sans font-medium text-sm text-slate-400 mb-4">Share your score and invite friends to beat it.</p>
          <div className="flex gap-3">
            {/* Share on WhatsApp — Green 3D */}
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 font-display font-bold text-sm flex items-center justify-center gap-2"
              style={{
                height: 52, borderRadius: 18, cursor: 'pointer',
                background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
                color: '#ffffff',
                border: '1px solid rgba(134,239,172,0.35)',
                boxShadow: '0 6px 0 #0F7A35, 0 14px 28px rgba(34,197,94,0.28)',
                transform: 'translateY(0)',
                transition: 'transform 140ms ease, box-shadow 140ms ease',
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'translateY(4px)';
                e.currentTarget.style.boxShadow = '0 2px 0 #0F7A35, 0 8px 16px rgba(34,197,94,0.22)';
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 0 #0F7A35, 0 14px 28px rgba(34,197,94,0.28)';
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 0 #0F7A35, 0 14px 28px rgba(34,197,94,0.28)';
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Share on WhatsApp
            </button>

            {/* Copy Result — Raised slate */}
            <button
              onClick={handleCopy}
              className="flex-1 font-display font-bold text-sm flex items-center justify-center gap-2"
              style={{
                height: 52, borderRadius: 18, cursor: 'pointer',
                background: copied
                  ? 'linear-gradient(180deg, #059669 0%, #047857 100%)'
                  : 'linear-gradient(180deg, #475569 0%, #334155 100%)',
                color: '#E2E8F0',
                border: '1px solid rgba(203,213,225,0.18)',
                boxShadow: copied
                  ? '0 5px 0 #065F46, 0 12px 24px rgba(5,150,105,0.28)'
                  : '0 5px 0 #1E293B, 0 12px 24px rgba(15,23,42,0.32)',
                transform: 'translateY(0)',
                transition: 'transform 140ms ease, box-shadow 140ms ease, background 200ms ease',
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'translateY(3px)';
                e.currentTarget.style.boxShadow = copied
                  ? '0 2px 0 #065F46, 0 6px 14px rgba(5,150,105,0.20)'
                  : '0 2px 0 #1E293B, 0 6px 14px rgba(15,23,42,0.24)';
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = copied
                  ? '0 5px 0 #065F46, 0 12px 24px rgba(5,150,105,0.28)'
                  : '0 5px 0 #1E293B, 0 12px 24px rgba(15,23,42,0.32)';
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = copied
                  ? '0 5px 0 #065F46, 0 12px 24px rgba(5,150,105,0.28)'
                  : '0 5px 0 #1E293B, 0 12px 24px rgba(15,23,42,0.32)';
              }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Copied ✓
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  Copy Result
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── WEEKLY CHAMPIONS + VIEW LEADERBOARD ── */}
        <div className="p-4" style={{ borderRadius: 22, background: '#111C2E', border: '1px solid rgba(253,186,59,0.22)', boxShadow: '0 0 24px rgba(253,186,59,0.06)' }}>

          <style>{`
            @keyframes proofFade {
              from { opacity: 0; transform: translateY(7px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .champ-slide { animation: proofFade 0.36s cubic-bezier(0.22,1,0.36,1) both; }
          `}</style>

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-bold text-base text-white">🔥 Weekly Champions</p>
          </div>

          {topPerformers.length === 0 ? (
            <p className="font-sans text-xs text-slate-500 text-center py-4">
              No scores yet this week. Be the first! 🚀
            </p>
          ) : (
            <>
              {/* Full-width auto-advancing card */}
              {(() => {
                const idx    = champsSlide % Math.min(topPerformers.length, 3);
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
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <ChampionAvatar imageUrl={player.image || null} name={player.name} size={36} />
                      <span style={{ position: 'absolute', top: -4, left: -4, fontSize: 16, lineHeight: 1 }}>
                        {RANK_MEDALS[idx]}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p className="font-display font-bold truncate"
                          style={{ fontSize: 15, color: isSelf ? '#10b981' : '#ffffff', margin: 0 }}>
                          {(player.name || 'User').split(' ')[0]}
                        </p>
                        <span style={{
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                          color: '#facc15', background: 'rgba(250,204,21,0.15)',
                          border: '1px solid rgba(250,204,21,0.3)',
                          borderRadius: 20, padding: '2px 8px',
                        }}>
                          ⭐ {player.level || 'Aspirant'}
                        </span>
                        {isSelf && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            background: 'rgba(16,185,129,0.15)', color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 20, padding: '2px 7px',
                          }}>You</span>
                        )}
                      </div>
                    </div>
                    <p className="font-display font-bold"
                      style={{ fontSize: 17, color: '#FDBA3B', margin: 0, flexShrink: 0 }}>
                      {Math.round(player.totalScore || 0).toLocaleString()} XP
                    </p>
                  </div>
                );
              })()}

              {/* Dot indicators */}
              {topPerformers.length > 1 && (
                <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
                  {topPerformers.slice(0, 3).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setChampsSlide(i)}
                      aria-label={`Champion ${i + 1}`}
                      style={{
                        width: champsSlide % 3 === i ? 18 : 6,
                        height: 6, borderRadius: 3,
                        background: champsSlide % 3 === i ? '#f59e0b' : 'rgba(255,255,255,0.18)',
                        border: 'none', padding: 0, cursor: 'pointer',
                        transition: 'width 0.3s ease, background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Your rank row */}
              {isLoggedIn && (
                <div className="mt-3 pt-3 border-t border-slate-700/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs text-slate-400">Your Rank</span>
                    <span className="font-display font-black text-base text-white">
                      {userRankIdx !== -1 ? `#${userRankIdx + 1}` : '—'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-3 py-1 bg-emerald-900/50 text-emerald-400 border border-emerald-700/40">
                    ✓ Active today
                  </span>
                </div>
              )}
            </>
          )}

          {/* View Full Leaderboard — Gold/amber 3D */}
          <button
            onClick={() => router.push('/leaderboard')}
            className="w-full mt-4 font-display font-bold text-sm flex items-center justify-center gap-2"
            style={{
              height: 52, borderRadius: 18, cursor: 'pointer',
              background: 'linear-gradient(180deg, #FBBF24 0%, #D97706 100%)',
              color: '#111827',
              fontWeight: 900,
              border: '1px solid rgba(253,230,138,0.40)',
              boxShadow: '0 6px 0 #92400E, 0 14px 28px rgba(245,158,11,0.28)',
              transform: 'translateY(0)',
              transition: 'transform 140ms ease, box-shadow 140ms ease',
            }}
            onPointerDown={e => {
              e.currentTarget.style.transform = 'translateY(4px)';
              e.currentTarget.style.boxShadow = '0 2px 0 #92400E, 0 8px 16px rgba(245,158,11,0.22)';
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 0 #92400E, 0 14px 28px rgba(245,158,11,0.28)';
            }}
            onPointerLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 0 #92400E, 0 14px 28px rgba(245,158,11,0.28)';
            }}
          >
            🏆 View Full Leaderboard →
          </button>

        </div>

        {/* ── FEEDBACK LINK ── */}
        <div className="text-center pb-2">
          {feedbackSent ? (
            <p className="font-sans text-xs text-emerald-400">🙏 Thanks for your feedback!</p>
          ) : (
            <button
              onClick={() => setShowFeedbackSheet(true)}
              className="font-sans text-xs text-slate-500 active:opacity-60 transition-opacity"
            >
              Had an issue with this quiz?{' '}
              <span style={{ color: '#94A3B8', textDecoration: 'underline', textUnderlineOffset: 3 }}>Send feedback</span>
            </button>
          )}
        </div>


      </div>

      {loadingDetailed && (
        <Loader fullScreen size="md" label="Loading detailed analysis…" />
      )}

      {/* ── FEEDBACK BOTTOM SHEET ── */}
      {showFeedbackSheet && (
        <>
          <style>{`
            @keyframes sheetUp   { from { transform: translateY(100%); } to { transform: translateY(0); } }
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

          {/* Sheet — anchored to bottom, max-width 480px centred on wider screens */}
          <div
            style={{
              position: 'fixed',
              bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 480,
              zIndex: 50,
              background: '#1E293B',
              borderRadius: '22px 22px 0 0',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.50)',
              animation: 'sheetUp 0.30s cubic-bezier(0.22,1,0.36,1)',
              /* Respect iOS home indicator */
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            {/* Drag handle */}
            <div style={{ paddingTop: 14, paddingBottom: 4, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.25)' }} />
            </div>

            <div style={{ padding: '12px 20px 0' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <p className="font-display font-black" style={{ fontSize: 18, color: '#F8FAFC' }}>Help us improve</p>
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

              <p className="font-sans" style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
                Report an issue or share a suggestion about this quiz.
              </p>

              {/* Textarea — 16px font prevents iOS auto-zoom */}
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="What went wrong, or what could be better?"
                autoFocus
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.70)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  fontSize: 16,
                  color: '#F8FAFC',
                  lineHeight: 1.55,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  marginBottom: 14,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(148,163,184,0.40)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(148,163,184,0.18)'; }}
              />

              {/* Buttons — full-width on mobile */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowFeedbackSheet(false)}
                  style={{
                    flex: 1, minHeight: 52, borderRadius: 16,
                    background: 'transparent',
                    border: '1.5px solid rgba(148,163,184,0.18)',
                    color: '#64748B',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { await handleFeedbackSubmit(); setShowFeedbackSheet(false); }}
                  disabled={!feedback.trim()}
                  style={{
                    flex: 1, minHeight: 52, borderRadius: 16,
                    background: feedback.trim() ? 'linear-gradient(90deg, #FF7A1A, #FF5A00)' : 'rgba(148,163,184,0.08)',
                    border: 'none',
                    color: feedback.trim() ? '#fff' : '#475569',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                    boxShadow: feedback.trim() ? '0 8px 24px rgba(255,106,0,0.25)' : 'none',
                    cursor: feedback.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s, box-shadow 0.15s',
                  }}
                >
                  Send Feedback
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
