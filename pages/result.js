import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import XPToast from '@/components/XPToast';
import BottomNav from '@/components/BottomNav';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function TopAvatar({ player, index, isSelf }) {
  const [imgError, setImgError] = useState(false);
  const initial = (player.name || '?').charAt(0).toUpperCase();
  return (
    <div
      className={`flex-shrink-0 flex flex-col items-center rounded-2xl px-3 pt-4 pb-3 ${
        isSelf
          ? 'bg-emerald-900/40 border border-emerald-500/40'
          : 'bg-slate-800/80 border border-slate-700/50'
      }`}
      style={{ width: 80 }}
    >
      <div className="relative mb-2">
        {player.image && !imgError ? (
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20">
            <img
              src={player.image}
              alt={player.name || 'avatar'}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center">
            <span className="font-display font-black text-white text-[18px]">{initial}</span>
          </div>
        )}
        <span
          className="absolute text-[15px] leading-none"
          style={{ bottom: -5, left: -5 }}
        >
          {RANK_MEDALS[index] || (
            <span className="bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center font-display font-black text-[10px] text-slate-300">
              {index + 1}
            </span>
          )}
        </span>
      </div>
      <p className={`font-semibold text-[11px] text-center leading-tight truncate w-full ${
        isSelf ? 'text-emerald-300' : 'text-white'
      }`}>
        {(player.name || 'User').split(' ')[0]}
      </p>
      <p className="text-[10px] text-slate-500 mt-0.5">{(player.totalScore || 0).toFixed(0)} pts</p>
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

  const [result, setResult]                   = useState(null);
  const [aiSummary, setAiSummary]             = useState(null);
  const [summaryLoading, setSummaryLoading]   = useState(true);
  const [xpResult, setXPResult]               = useState(null);
  const [showXPToast, setShowXPToast]         = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [topPerformers, setTopPerformers]     = useState([]);
  const [feedback, setFeedback]               = useState('');
  const [feedbackSent, setFeedbackSent]       = useState(false);
  const [copied, setCopied]                   = useState(false);
  const scoreSavedRef = useRef(false);

  // Load result from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('quizResult');
    if (!stored) return;
    try { setResult(JSON.parse(stored)); } catch {}
  }, []);

  // Fetch top performers
  useEffect(() => {
    fetch('/api/leaderboard?scope=weekly')
      .then(r => r.json())
      .then(d => setTopPerformers((d.leaders || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  // Save score (logged-in only, once)
  useEffect(() => {
    if (!router.isReady) return;
    if (status !== 'authenticated') return;
    if (scoreSavedRef.current) return;
    scoreSavedRef.current = true;

    const { correct, incorrect, skipped, total, score, subject, topic, sessionId } = router.query;
    if (!correct && !result) return;

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
        if (data.ok) {
          setXPResult(data);
          setShowXPToast(true);
          setTimeout(() => setShowXPToast(false), 4000);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router.isReady, result]);

  // AI summary
  useEffect(() => {
    if (!result) return;
    if (result.aiData?.summary) {
      setAiSummary(result.aiData.summary);
      setSummaryLoading(false);
      return;
    }
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: result.subject, topic: result.topic,
        totalQuestions: result.totalQuestions, correctAnswers: result.correct,
        incorrectAnswers: result.incorrect, skipped: result.skipped,
        rawScore: result.rawScore, accuracy: result.accuracy,
      }),
    })
      .then(r => r.json())
      .then(d => { setAiSummary(d.aiSummary || 'Great effort!'); setSummaryLoading(false); })
      .catch(() => { setAiSummary('Great effort! Review the detailed analysis below.'); setSummaryLoading(false); });
  }, [result]);

  const isGuest = status === 'unauthenticated';

  function handleShareWhatsApp() {
    const msg = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster.vercel.app`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function handleCopy() {
    const text = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster.vercel.app`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function handlePlayAgain() {
    router.push('/');
  }

  function handleFeedbackSubmit() {
    if (!feedback.trim()) return;
    // Store locally — extend later to send to API
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
    <div className="min-h-screen bg-[#0f172a] pb-24">
      <Head><title>Result — SSC GK Score Booster</title></Head>

      {xpResult && (
        <XPToast
          visible={showXPToast}
          xpEarned={xpResult.xpEarned}
          totalXP={xpResult.totalXP}
          level={xpResult.level}
          streakCount={xpResult.streakCount}
          isFirstQuizOfDay={xpResult.isFirstQuizOfDay}
        />
      )}

      <div className="max-w-[430px] mx-auto px-4 pt-8 flex flex-col gap-4">

        {/* Subject/topic label */}
        <div className="text-center">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest">
            {result.subject} · {result.topic}
          </p>
        </div>

        {/* ── PERFORMANCE SUMMARY ── */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-3xl p-5">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-4">
            Performance Summary
          </p>

          {/* Score + Accuracy boxes */}
          <div className="flex gap-3 mb-5">
            {/* Total Score */}
            <div className="flex-1 bg-slate-900/60 rounded-2xl p-4 flex flex-col items-center gap-1 border border-slate-700/40">
              <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">Total Score</p>
              <p className="font-display font-black text-3xl text-orange-400 leading-none">
                {result.rawScore % 1 === 0 ? result.rawScore : result.rawScore.toFixed(1)}
              </p>
              <p className="font-sans text-xs text-slate-600">marks</p>
            </div>
            {/* Accuracy */}
            <div className="flex-1 bg-slate-900/60 rounded-2xl p-4 flex flex-col items-center gap-1 border border-slate-700/40">
              <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">Accuracy</p>
              <p className="font-display font-black text-3xl text-emerald-400 leading-none">
                {accuracy}
              </p>
              <p className="font-sans text-xs text-slate-600">percent</p>
            </div>
          </div>

          {/* Correct / Wrong / Skipped */}
          <div className="flex justify-around py-3 border-t border-slate-700/40 border-b border-b-slate-700/40 mb-4">
            {[
              { val: result.correct,   label: 'Correct', color: 'text-emerald-400' },
              { val: result.incorrect, label: 'Wrong',   color: 'text-red-400' },
              { val: result.skipped,   label: 'Skipped', color: 'text-slate-400' },
            ].map(({ val, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className={`font-display font-black text-2xl leading-none ${color}`}>{val}</span>
                <span className="font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>

          {/* View Detailed Analysis */}
          <button
            onClick={() => { setLoadingDetailed(true); setTimeout(() => router.push('/result/detailed'), 100); }}
            className="w-full text-center font-sans font-medium text-sm text-emerald-400 py-1 active:opacity-70 transition-opacity"
          >
            View Detailed Analysis →
          </button>
        </div>

        {/* ── XP earned banner (logged-in) ── */}
        {xpResult && (
          <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-base text-white">⚡ +{xpResult.xpEarned} XP earned</span>
              <span className="font-sans font-medium text-xs text-orange-400">🔥 {xpResult.streakCount} day streak</span>
            </div>
            <p className="font-sans text-sm text-emerald-300 mt-1">Level: {xpResult.level} · {xpResult.totalXP} XP total</p>
            {xpResult.isFirstQuizOfDay && (
              <p className="font-sans text-xs text-yellow-300 mt-0.5">🌅 First quiz bonus included!</p>
            )}
          </div>
        )}

        {/* ── AI summary ── */}
        {!summaryLoading && aiSummary && (
          <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-4">
            <p className="font-sans font-medium text-xs text-emerald-400 uppercase tracking-widest mb-2">🤖 AI Mentor</p>
            <p className="font-sans font-medium text-sm text-slate-300 leading-relaxed italic">&quot;{aiSummary}&quot;</p>
          </div>
        )}
        {summaryLoading && (
          <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-4">
            <p className="font-sans font-medium text-xs text-emerald-400 uppercase tracking-widest mb-2">🤖 AI Mentor</p>
            <div className="space-y-2">
              <div className="h-2.5 bg-slate-700 rounded animate-pulse w-full"/>
              <div className="h-2.5 bg-slate-700 rounded animate-pulse w-4/5"/>
            </div>
          </div>
        )}

        {/* ── TOP THIS WEEK ── */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-3xl pt-4 pb-3 overflow-hidden">
          <div className="px-5 flex items-center justify-between mb-3">
            <p className="font-display font-bold text-base text-white">Top this week</p>
            <button
              onClick={() => router.push('/leaderboard')}
              className="flex items-center gap-1 font-sans font-medium text-xs text-emerald-400 active:opacity-70"
            >
              See all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {topPerformers.length === 0 ? (
            <div className="px-5 py-3 text-center">
              <p className="font-sans text-xs text-slate-500">No scores yet this week.</p>
            </div>
          ) : (
            <div
              className="flex gap-3 overflow-x-auto no-scrollbar"
              style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 4 }}
            >
              {topPerformers.map((player, i) => (
                <TopAvatar
                  key={player.email || i}
                  player={player}
                  index={i}
                  isSelf={player.email === session?.user?.email}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── PLAY AGAIN ── */}
        <button
          onClick={handlePlayAgain}
          className="w-full py-4 rounded-2xl bg-orange-500 text-white font-display font-bold text-base shadow-[0_0_20px_rgba(249,115,22,0.35)] active:scale-[0.98] transition-transform"
        >
          ▶ Play Again
        </button>

        {/* ── VIEW LEADERBOARD ── */}
        <button
          onClick={() => router.push('/leaderboard')}
          className="w-full py-4 rounded-2xl bg-slate-700 border border-slate-600 text-white font-display font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          🏆 View LeaderBoard
        </button>

        {/* ── CHALLENGE YOUR FRIENDS ── */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-3xl p-5">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-1">
            Challenge Your Friends
          </p>
          <p className="font-sans font-medium text-sm text-slate-400 mb-4">Share your score and invite friends to beat it!</p>
          <div className="flex gap-3">
            <button
              onClick={handleShareWhatsApp}
              className="flex-1 bg-[#25d366]/15 border border-[#25d366]/40 rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span className="font-display font-bold text-sm text-[#25d366]">Share Results</span>
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              {copied ? (
                <span className="font-display font-bold text-sm text-emerald-400">✓ Copied!</span>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                  <span className="font-display font-bold text-sm text-slate-300">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── HELP US IMPROVE ── */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-3xl p-5">
          <p className="font-sans font-medium text-xs text-slate-500 uppercase tracking-widest mb-1">
            Help Us Improve!
          </p>
          <p className="font-sans font-medium text-sm text-slate-400 mb-3">How was your experience?</p>
          {feedbackSent ? (
            <div className="text-center py-3">
              <span className="text-2xl">🙏</span>
              <p className="font-sans font-medium text-sm text-emerald-400 mt-1">Thanks for your feedback!</p>
            </div>
          ) : (
            <>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Share your thoughts, suggestions, or report any issues…"
                className="w-full min-h-[80px] bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3.5 font-sans text-sm text-white placeholder:text-slate-600 resize-y focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedback.trim()}
                className={`mt-2 w-full py-4 rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-all ${
                  feedback.trim()
                    ? 'bg-orange-500 text-white shadow-[0_0_16px_rgba(249,115,22,0.3)]'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                Submit Feedback
              </button>
            </>
          )}
        </div>

        {/* ── Guest save banner ── */}
        {isGuest && (
          <div className="bg-slate-800 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
            <span className="text-2xl">🔒</span>
            <p className="font-sans font-medium text-sm text-slate-300">Login to save your score, XP & streak</p>
            <button
              onClick={() => { document.cookie = 'userMode=; path=/; max-age=0'; signIn('google', { callbackUrl: '/dashboard' }); }}
              className="bg-white text-slate-900 rounded-xl py-2.5 px-5 flex items-center gap-2 font-semibold text-sm"
            >
              <GoogleSVG />
              Sign in with Google
            </button>
          </div>
        )}

      </div>

      {loadingDetailed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"/>
            <p className="text-sm font-bold text-slate-300">Loading analysis…</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
