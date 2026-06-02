import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const FILTERS = [
  { key: 'all', label: 'All', query: {} },
  { key: '7d', label: '7 Days', query: { dateRange: '7d' } },
  { key: '30d', label: '30 Days', query: { dateRange: '30d' } },
  { key: 'weak', label: 'Weak', query: { status: 'weak' } },
  { key: 'wrong_skipped', label: 'Wrong + Skipped', query: { answerType: 'wrong_skipped' } },
  { key: 'daily', label: 'Daily Challenge', query: { quizMode: 'daily_challenge' } },
];

const BADGE_COLORS = {
  green: ['#22C55E', 'rgba(34,197,94,0.12)'],
  amber: ['#F59E0B', 'rgba(245,158,11,0.12)'],
  red: ['#EF4444', 'rgba(239,68,68,0.12)'],
  blue: ['#38BDF8', 'rgba(56,189,248,0.12)'],
  purple: ['#A78BFA', 'rgba(167,139,250,0.14)'],
  orange: ['#FF7A1A', 'rgba(255,122,26,0.14)'],
};

function qs(query) {
  const params = new URLSearchParams({ page: '1', limit: '10', ...query });
  return params.toString();
}

function formatDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Recently';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function CountUp({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let raf;
    function tick(now) {
      const pct = Math.min(1, (now - start) / 800);
      setDisplay(Math.round(target * (1 - Math.pow(1 - pct, 3))));
      if (pct < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}{suffix}</>;
}

function AccuracyRing({ accuracy }) {
  const pct = Math.max(0, Math.min(100, Number(accuracy) || 0));
  const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#F97316';
  const radius = 17;
  const circ = 2 * Math.PI * radius;
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="21" cy="21" r={radius} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4" />
      <circle cx="21" cy="21" r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} />
      <text x="21" y="24" textAnchor="middle" fill="#F8FAFC" fontSize="10" fontWeight="800" transform="rotate(90 21 21)">{Math.round(pct)}%</text>
    </svg>
  );
}

function QuizCard({ session, onReview, onPractice, onFull }) {
  const hasMistakes = session.incorrect > 0 || session.skipped > 0;
  const colors = BADGE_COLORS[session.badgeTone] || BADGE_COLORS.amber;
  return (
    <div className="history-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-display font-bold text-white text-[15px] truncate">{session.subject} <span className="text-slate-500">•</span> {session.topic}</p>
          <p className="font-sans text-xs text-slate-500 mt-0.5">{formatDate(session.completedAt)}</p>
        </div>
        <span className="badge" style={{ color: colors[0], background: colors[1], borderColor: `${colors[0]}55` }}>{session.badge}</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <AccuracyRing accuracy={session.accuracy} />
        <div>
          <p className="font-display font-black text-2xl text-white">{session.score} <span className="text-sm text-slate-500">/ {session.questionCount * 2}</span></p>
          <p className="font-sans text-xs text-slate-500">Score</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm mb-4">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">✓{session.correct}</span>
          <span className="text-red-300 font-bold">✕{session.incorrect}</span>
          <span className="text-amber-300 font-bold">↷{session.skipped}</span>
        </div>
        <span className="text-orange-300 font-black">+{session.coinsEarned} Coins</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => hasMistakes ? onPractice(session) : onReview(session)} className="primary-btn">
          {hasMistakes ? 'Practice Mistakes ->' : 'Review'}
        </button>
        <button onClick={() => hasMistakes ? onReview(session) : onFull(session)} className="secondary-btn">
          {hasMistakes ? 'Review' : 'Re-attempt'}
        </button>
      </div>
    </div>
  );
}

function EmptyPanel({ title, body, action, onClick }) {
  return (
    <div className="empty-panel">
      <p className="font-display font-bold text-white">{title}</p>
      <p className="font-sans text-sm text-slate-400 mt-1 mb-4">{body}</p>
      <button onClick={onClick} className="primary-btn inline-flex px-5">{action}</button>
    </div>
  );
}

function ReattemptModal({ modal, onClose, onConfirm, busy }) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.68)' }}>
      <div className="w-full max-w-[360px] rounded-[22px] p-5" style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)' }}>
        <h2 className="font-display text-xl font-black text-white mb-2">{modal.title}</h2>
        <p className="text-sm text-slate-300 font-semibold">{modal.session?.subject} • {modal.session?.topic}</p>
        <p className="text-sm text-slate-500 mt-1 mb-5">{modal.body}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="secondary-btn" disabled={busy}>Cancel</button>
          <button onClick={onConfirm} className="primary-btn" disabled={busy}>{busy ? 'Starting...' : modal.confirm}</button>
        </div>
      </div>
    </div>
  );
}

export default function QuizHistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [landing, setLanding] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterResult, setFilterResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [starting, setStarting] = useState(false);

  const isGuest = status === 'unauthenticated';

  async function loadLanding() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/history/landing');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setLanding(data.data);
    } catch {
      setError("Couldn't load history. Check connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) { setLoading(false); return; }
    loadLanding();
  }, [status, isGuest]);

  async function loadExpanded() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    const res = await fetch('/api/history/quizzes?page=1&limit=10');
    const data = await res.json();
    setExpandedSessions(data.data?.sessions || []);
    setExpanded(true);
  }

  async function selectFilter(filter) {
    setActiveFilter(filter.key);
    const res = await fetch(`/api/history/quizzes?${qs(filter.query)}`);
    const data = await res.json();
    setFilterResult(data.data || null);
  }

  function openReview(session) {
    router.push(`/history/session/${session.sessionId}`);
  }

  function openPractice(session) {
    setModal({
      type: 'session_mistakes',
      session,
      title: 'Practice your mistakes?',
      body: `${session.incorrect + session.skipped} wrong + skipped questions. Your old result stays saved.`,
      confirm: 'Start Practice ->',
    });
  }

  function openFull(session) {
    setModal({
      type: 'session_full',
      session,
      title: 'Re-attempt this quiz?',
      body: `${session.questionCount} questions. This creates a new quiz session.`,
      confirm: 'Start Re-attempt ->',
    });
  }

  async function confirmReattempt() {
    if (!modal) return;
    setStarting(true);
    try {
      const res = await fetch('/api/history/reattempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: modal.type, sessionId: modal.session.sessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      const payload = data.data;
      sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
        questions: payload.questions,
        quizMode: payload.quizMode,
        parentSessionId: payload.parentSessionId,
        attemptNumber: (modal.session.attemptNumber || 1) + 1,
        subject: payload.subject,
        topic: payload.topic,
        sourceCollection: payload.sourceCollection,
      }));
      router.push(`/quiz?mode=history&count=${payload.questionCount}&sourceScreen=history`);
    } catch {
      setStarting(false);
    }
  }

  const summary = landing?.summary || {};
  const allZero = summary.totalQuizzes === 0 && summary.totalQuestions === 0 && summary.savedCount === 0;
  const visibleLatest = expanded ? expandedSessions : (landing?.latestQuizzes || []);
  const selectedFilter = FILTERS.find(item => item.key === activeFilter) || FILTERS[0];
  const filteredSessions = filterResult?.sessions || [];
  const filterWrongSkipped = filterResult?.filterSummary?.totalWrongSkipped || 0;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>History - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz History" showBack />
        <main className="px-4 pt-5">
          <h1 className="t-page-title font-display text-white mb-1">My History</h1>
          <p className="t-page-subtitle text-slate-400 mb-5">Review quizzes, revise mistakes, and re-attempt weak areas.</p>
          <Loader card size="md" label="Loading history..." />
        </main>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-screen [background:var(--bg-app)] pb-24">
        <Head><title>History - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="Quiz History" showBack />
        <main className="px-4 pt-5">
          <h1 className="t-page-title font-display text-white mb-1">My History</h1>
          <p className="t-page-subtitle text-slate-400 mb-5">Sign in to see your history.</p>
          <GoogleSignInCard title="Sign in to see your history" subtitle="Review quizzes, mistakes, saved questions and Coins." buttonText="Continue with Google" callbackUrl="/history" />
        </main>
      </div>
    );
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen [background:var(--bg-app)] pb-28">
        <style>{`
          .history-card,.empty-panel{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:16px;margin-bottom:12px}
          .stat-card{background:#172D47;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px}
          .badge{border:1px solid;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;white-space:nowrap}
          .primary-btn{border:0;border-radius:14px;background:linear-gradient(135deg,#FF7A1A,#FF4D00);color:white;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}
          .secondary-btn{border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(255,255,255,.04);color:#CBD5E1;font-size:13px;font-weight:800;padding:11px 12px;text-align:center;cursor:pointer}
          .chip{border:1px solid rgba(148,163,184,.16);border-radius:999px;background:#172D47;color:#94A3B8;font-size:12px;font-weight:800;padding:8px 13px;white-space:nowrap}
          .chip.active{background:rgba(255,122,26,.16);border-color:rgba(255,122,26,.45);color:#FDBA74}
        `}</style>
        <HistoryTopBar title="Quiz History" showBack />
        <main className="px-4 pt-5">
        <div className="mb-5">
          <h1 className="t-page-title font-display text-white">My History</h1>
          <p className="t-page-subtitle text-slate-400">Review quizzes, revise mistakes, and re-attempt weak areas.</p>
        </div>

        {error ? (
          <EmptyPanel title="Couldn't load history" body="Check connection." action="Retry" onClick={loadLanding} />
        ) : allZero ? (
          <EmptyPanel title="No quiz history yet." body="Attempt your first quiz and your progress will appear here." action="Start Daily Challenge" onClick={() => router.push('/quiz?mode=daily')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ['Quizzes', summary.totalQuizzes],
                ['Questions', summary.totalQuestions],
                ['Accuracy', summary.overallAccuracy, '%'],
                ['Saved', summary.savedCount],
              ].map(([label, value, suffix]) => (
                <div key={label} className="stat-card">
                  <p className="font-display font-black text-2xl text-white"><CountUp value={value} suffix={suffix || ''} /></p>
                  <p className="font-sans text-xs text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </div>

            <section className="mb-5">
              <h2 className="font-display text-lg font-black text-white">Latest Quiz History</h2>
              <p className="font-sans text-sm text-slate-500 mb-3">Your recent practice sessions</p>
              {visibleLatest.map(item => <QuizCard key={item.sessionId} session={item} onReview={openReview} onPractice={openPractice} onFull={openFull} />)}
              {(landing?.latestQuizzes || []).length > 0 && (
                <button onClick={loadExpanded} className="secondary-btn w-full">{expanded ? 'Show Less' : 'View More Quizzes -&gt;'}</button>
              )}
            </section>

            <section className="mb-5">
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {FILTERS.map(filter => (
                  <button key={filter.key} onClick={() => selectFilter(filter)} className={`chip ${activeFilter === filter.key ? 'active' : ''}`}>{filter.label}</button>
                ))}
              </div>
              {filterResult && (
                <>
                  <div className="history-card">
                    <p className="text-sm font-bold text-white">{selectedFilter.label} practice</p>
                    <p className="text-xs text-slate-500">{filterResult.filterSummary.quizCount} quizzes found · {filterWrongSkipped} wrong/skipped questions</p>
                    {filterWrongSkipped > 0 && <button className="primary-btn mt-3 w-full" onClick={() => filteredSessions[0] && openPractice(filteredSessions[0])}>Practice {filterWrongSkipped} Mistakes -&gt;</button>}
                  </div>
                  {filteredSessions.length === 0 ? (
                    <EmptyPanel title="No quizzes found." body="Try different filters." action="Reset Filters" onClick={() => { setFilterResult(null); setActiveFilter('all'); }} />
                  ) : filteredSessions.map(item => <QuizCard key={item.sessionId} session={item} onReview={openReview} onPractice={openPractice} onFull={openFull} />)}
                </>
              )}
            </section>

            <section className="mb-5">
              <h2 className="font-display text-lg font-black text-white">Repeated Mistakes</h2>
              <p className="font-sans text-sm text-slate-500 mb-3">Questions you got wrong more than once</p>
              {(landing?.repeatedMistakesPreview || []).length ? landing.repeatedMistakesPreview.map(item => (
                <div key={item.questionId} className="history-card">
                  <p className="text-xs font-bold text-teal-400">{item.subject} • {item.topic}</p>
                  <p className="text-sm font-semibold text-white my-3">"{item.questionPreview}"</p>
                  <p className="text-sm text-red-300 font-bold">Wrong {item.wrongCount}x <span className="text-amber-300 ml-2">Skipped {item.skippedCount}x</span></p>
                  <p className="text-xs text-red-200 mt-1">Repeated Mistake</p>
                </div>
              )) : <EmptyPanel title="No repeated mistakes yet." body="Good work - keep practicing to build your history." action="Start Quiz" onClick={() => router.push('/dashboard')} />}
              {(landing?.repeatedMistakesPreview || []).length > 0 && <button className="primary-btn w-full" onClick={() => router.push('/dashboard')}>Practice All Repeated Mistakes -&gt;</button>}
            </section>

          </>
        )}
        </main>
      </div>
      <ReattemptModal modal={modal} onClose={() => setModal(null)} onConfirm={confirmReattempt} busy={starting} />
    </>
  );
}
