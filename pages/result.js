import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import TopPerformers from '@/components/TopPerformers';

export default function Result() {
  const { data: session } = useSession();
  const router = useRouter();

  const [result, setResult] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  // Load result from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('quizResult');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setResult(parsed);
    } catch {
      // Invalid data
    }
  }, []);

  // Update XP + streak in localStorage
  useEffect(() => {
    if (!result || !session?.user?.email) return;
    try {
      const key = `ssc_stats_${session.user.email}`;
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      const today = new Date().toDateString();
      const lastDate = saved.lastQuizDate;
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      // Calculate new streak
      let streak = saved.streak || 0;
      if (lastDate === today) {
        // Already played today — keep streak
      } else if (lastDate === yesterday) {
        streak += 1; // Consecutive day
      } else {
        streak = 1; // Reset
      }

      // XP: +20 per quiz, +40 if 100% accuracy, +10 if streak > 1
      let xpGained = 20;
      if (result.accuracy >= 100) xpGained += 40;
      if (streak > 1) xpGained += 10;
      const xp = (saved.xp || 0) + xpGained;

      const updated = { ...saved, streak, xp, lastQuizDate: today };
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  }, [result, session]);

  // Fetch AI summary
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
        subject: result.subject,
        topic: result.topic,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correct,
        incorrectAnswers: result.incorrect,
        skipped: result.skipped,
        rawScore: result.rawScore,
        accuracy: result.accuracy,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setAiSummary(data.aiSummary || 'Great effort! Review the detailed analysis below.');
        setSummaryLoading(false);
      })
      .catch(() => {
        setAiSummary('Great effort! Review the detailed analysis below.');
        setSummaryLoading(false);
      });
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setShowShare(true), 3000);
    return () => clearTimeout(timer);
  }, [result]);

  // Handle Share WhatsApp
  const handleShareWhatsApp = () => {
    const message = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster.vercel.app`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle Share Telegram
  const handleShareTelegram = () => {
    const message = `I scored ${result.rawScore} marks on SSC GK SCORE BOOSTER! Can you beat my score?`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, '_blank');
  };

  // Handle Copy Link
  const handleCopyLink = () => {
    const message = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster.vercel.app`;
    navigator.clipboard.writeText(message);
    alert('Message copied! Share it with friends.');
  };

  // Handle Feedback Submission
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (feedback.trim().length === 0) return;
    setSubmittingFeedback(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback,
          email: session?.user?.email || 'guest',
          correctAnswers: result.correct,
          accuracy: result.accuracy.toFixed(2),
          attempts: result.totalQuestions,
          timestamp: new Date().toISOString(),
          subject: result.subject,
          topic: result.topic
        }),
      });
      setFeedbackDone(true);
      setFeedback('');
      setTimeout(() => setFeedbackDone(false), 3000);
    } catch (e) {
      alert('Failed to send feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (!result) return <div className="p-10 text-center font-bold">Loading results...</div>;

  return (
    <Layout title="Quiz Result — SSC GK SCORE BOOSTER">
      <div className="card-container mx-auto fade-in pb-6">

        {/* ─── 1. Performance Summary Card ──────────────────────── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-[0.35em] mb-4">Performance Summary</h2>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-orange-50 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-black uppercase mb-1 tracking-widest">Total Score</p>
              <p className="text-3xl font-black text-orange-600 tracking-tighter">{result.rawScore}</p>
            </div>
            <div className="bg-[#E8F7EA] rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black text-black uppercase mb-1 tracking-widest">Accuracy</p>
              <p className="text-3xl font-black text-[#01D22C] tracking-tighter">{Math.round(result.accuracy)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-1 mb-8 text-center">
            <div className="flex flex-col gap-1">
              <p className="text-xl font-bold text-gray-900">{result.correct}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Correct</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xl font-bold text-gray-900">{result.incorrect}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Wrong</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xl font-bold text-gray-900">{result.skipped}</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Skipped</p>
            </div>
          </div>

          <button 
            onClick={() => {
              setLoadingDetailed(true);
              setTimeout(() => router.push('/result/detailed'), 5000);
            }}
            className="w-full mt-4 bg-orange-50 text-orange-700 rounded-2xl py-2.5 px-4 flex items-center justify-between font-bold text-xs hover:bg-orange-100 transition"
          >
            <span>📊 View Detailed Analysis</span>
            <span>→</span>
          </button>
        </div>

        <TopPerformers />

        {/* ─── 3. Action Buttons ────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => router.push('/?reset=true')}
            className="w-full bg-[#FF6A00] text-white rounded-2xl py-2.5 font-bold text-base active:scale-[0.98] transition"
          >
            Play Again
          </button>
        </div>



        {/* ─── Share Slide-Up ────────────────────────────────────── */}
        <div className={`bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 transform transition-all duration-500 ease-out ${showShare ? 'mb-6 translate-y-0 opacity-100 max-h-[480px]' : 'mb-0 translate-y-10 opacity-0 max-h-0 overflow-hidden'}`}>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-[0.2em] mb-4 text-center">Challenge your friends</h3>
          <div className="flex gap-3">
            <button 
              onClick={handleShareWhatsApp}
              className="flex-1 bg-[#00D22D] text-white rounded-2xl py-2.5 flex items-center justify-center gap-2 font-bold text-base shadow-lg active:scale-[0.98] transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Share Results
            </button>
            <button 
              onClick={handleCopyLink}
              className="w-1/4 bg-white border border-gray-200 text-gray-700 rounded-2xl py-2.5 flex items-center justify-center gap-2 font-bold text-base shadow-sm active:scale-[0.98] transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
        </div>

        {/* ─── 5. Feedback Section ──────────────────────────────── */}
        <div className={`bg-gray-50 rounded-[2.5rem] p-6 border border-gray-100 mb-6 transition-all duration-500 ${showShare ? 'mt-6' : ''}`}>
          <h3 className="font-black text-gray-800 mb-1 uppercase text-[10px] tracking-[0.2em]">Help us improve!</h3>
          <p className="text-xs text-gray-500 mb-4 font-medium">How was your experience with this quiz?</p>

          {feedbackDone ? (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-center text-xs font-bold fade-in">
              ✓ Your feedback helps us make it better 💡
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit}>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your suggestions..."
                className="w-full h-24 bg-white border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-300 focus:border-transparent transition outline-none resize-none shadow-inner mb-4"
              />
              {feedback.trim().length > 0 && (
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="w-full bg-[#FF7C1A] text-white rounded-full py-4 font-black text-xs hover:bg-[#FF6A00] transition shadow-lg active:scale-95"
                >
                  {submittingFeedback ? 'Sending...' : 'SUBMIT FEEDBACK'}
                </button>
              )}
            </form>
          )}
        </div>

        {/* ─── 6. Final Scoreboard Section ──────────────────────── */}

      </div>

      {/* ─── Loading Overlay for Detailed ─────────────────────── */}
      {loadingDetailed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm font-bold text-gray-700">Loading your analysis…😊</p>
          </div>
        </div>
      )}

    </Layout>
  );
}
