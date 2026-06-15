import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Loader from '@/components/ui/Loader';
import MentorMessage, { TeacherMentorIcon } from '@/components/MentorMessage';
import TodaysPlanCard from '@/components/TodaysPlanCard';
import WhatsAppBell from '@/components/WhatsAppBell';
import RefreshStatus from '@/components/ui/RefreshStatus';
import {
  MENTOR_COPY,
  formatPreparationStartedDate,
  getISTDateKey,
  getMentorDayMessage,
} from '@/lib/mentorCopy';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { isMentorSnapshotFresh, fetchMentorPlan, fetchMentorRefresh } from '@/lib/data/mentorData';

const ORANGE = '#FF6B16';
const BG_CARD = '#172D47';
const BG_DEEP = '#112236';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRI = '#F0F4F8';
const TEXT_SEC = '#94A3B8';
const TEXT_MUT = '#64748B';

const QUESTION_COUNTS = [10, 25, 50];

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

function AppTopBar() {
  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between px-4"
      style={{
        height: '58px',
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--ssc-border-soft)',
        borderRadius: '0 0 22px 22px',
        boxShadow: '0 10px 30px rgba(16,32,51,0.08)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[11px] bg-orange-500/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#f97316" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <span className="font-display self-center whitespace-nowrap text-[18px] font-black leading-none tracking-wide" style={{ color: 'var(--ssc-text-primary)' }}>
          Today&apos;s GK Plan
        </span>
        <span
          className="flex-shrink-0"
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#14B8A6',
            background: 'rgba(20,184,166,0.15)',
            border: '1px solid rgba(20,184,166,0.30)',
            borderRadius: 99,
            padding: '3px 8px',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          MENTOR
        </span>
      </div>
      <WhatsAppBell />
    </div>
  );
}

function getMentorCacheKey(email) {
  // v3 + account scope. Uses a non-reversible scope hash (not the plain email)
  // so User A's snapshot can never be read for User B, and no email appears in
  // the localStorage key. Date-specific behaviour is preserved.
  const scope = email ? getUserCacheScope({ user: { email } }) : 'guest';
  return `mentor_snapshot_v3:${scope}:${getISTDateKey()}`;
}

// Plan-version guard: drop any task that does not belong to the snapshot's
// current active plan, so old-plan tasks can never render.
function sanitizeSnapshot(snapshot) {
  if (!snapshot || !snapshot.plan) return snapshot;
  const activePlanId = snapshot.plan.planId;
  if (!activePlanId) return snapshot;
  const belongs = task => !task?.planId || task.planId === activePlanId;
  const filt = arr => (Array.isArray(arr) ? arr.filter(belongs) : arr);
  return {
    ...snapshot,
    plan: { ...snapshot.plan, tasks: filt(snapshot.plan.tasks) },
    activeTasks: filt(snapshot.activeTasks),
    completedToday: filt(snapshot.completedToday),
    deferredTasks: filt(snapshot.deferredTasks),
    pendingTasks: filt(snapshot.pendingTasks),
  };
}

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('userMode=guest'));
}

function buildLocalSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const profile = JSON.parse(localStorage.getItem('mentor_profile_cache') || 'null');
    const planCache = JSON.parse(localStorage.getItem('mentor_today_plan') || 'null');
    if (!profile) return { exists: false };
    const plan = planCache?.plan || null;
    const tasks = plan?.tasks || [];
    const activeTasks = tasks.filter(task => task.status === 'active').slice(0, 3);
    const completedToday = tasks.filter(task => task.status === 'completed');
    const deferredTasks = tasks.filter(task => task.status === 'snoozed');
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    const total = activeTasks.length + completedToday.length + deferredTasks.length;
    return {
      exists: true,
      profile,
      plan: plan ? { ...plan, tasks } : null,
      activeTasks,
      completedToday,
      deferredTasks,
      pendingTasks,
      progress: {
        completed: completedToday.length,
        total,
        percent: total ? Math.round((completedToday.length / total) * 100) : 0,
      },
      mentorMessage: getMentorDayMessage(new Date()),
      lastSyncAt: new Date().toISOString(),
    };
  } catch {
    return { exists: false };
  }
}

function buildLocalSnapshotFromParts(profile, plan) {
  const tasks = plan?.tasks || [];
  const activeTasks = tasks.filter(task => task.status === 'active').slice(0, 3);
  const completedToday = tasks.filter(task => task.status === 'completed');
  const deferredTasks = tasks.filter(task => task.status === 'snoozed');
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const total = activeTasks.length + completedToday.length + deferredTasks.length;
  return {
    exists: Boolean(profile),
    profile,
    plan: plan ? { ...plan, tasks } : null,
    activeTasks,
    completedToday,
    deferredTasks,
    pendingTasks,
    progress: {
      completed: completedToday.length,
      total,
      percent: total ? Math.round((completedToday.length / total) * 100) : 0,
    },
    mentorMessage: getMentorDayMessage(new Date()),
    lastSyncAt: new Date().toISOString(),
  };
}

function writeLocalSnapshot(snapshot) {
  if (typeof window === 'undefined' || !snapshot) return;
  try {
    if (snapshot.profile) localStorage.setItem('mentor_profile_cache', JSON.stringify(snapshot.profile));
    if (snapshot.plan) localStorage.setItem('mentor_today_plan', JSON.stringify({ date: getISTDateKey(), plan: snapshot.plan }));
    localStorage.setItem(getMentorCacheKey(''), JSON.stringify(snapshot));
  } catch {}
}

function getRecentMentorAttemptTaskId() {
  if (typeof window === 'undefined') return '';
  try {
    const result = JSON.parse(sessionStorage.getItem('quizResult') || 'null');
    if (!result?.sourceTaskId) return '';
    const isMentorAttempt = result.sourceScreen === 'mentor_plan' || result.sourcePage === 'mentor' || result.returnUrl === '/mentor';
    if (!isMentorAttempt) return '';
    const completedAtMs = new Date(result.completedAt || 0).getTime();
    if (!completedAtMs || Date.now() - completedAtMs > 60 * 60 * 1000) return '';
    return result.sourceTaskId;
  } catch {
    return '';
  }
}

function readCachedSnapshot(email) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getMentorCacheKey(email));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(email, snapshot) {
  if (typeof window === 'undefined' || !snapshot) return;
  try {
    // Stamp client write time so the freshness gate (10 min) is reliable even
    // if the server lastSyncAt clock differs slightly.
    localStorage.setItem(getMentorCacheKey(email), JSON.stringify({ ...snapshot, _cachedAt: Date.now() }));
  } catch {}
}

function formatDaysLeftLabel(daysLeftRange) {
  if (!daysLeftRange || daysLeftRange === "I don't know yet") return 'Timeline not set';
  if (daysLeftRange === '60+') return '60+ days left';
  return `${String(daysLeftRange).replace('-', '-')} days left`;
}

function formatDailyTimeLabel(dailyGKTime) {
  if (!dailyGKTime) return 'Time not set';
  return `${dailyGKTime.replace(/\s*daily$/i, '')}/day`;
}

function getSnapshotProgress(snapshot) {
  const progress = snapshot?.progress || {};
  const active = snapshot?.activeTasks || [];
  const done = snapshot?.completedToday || [];
  const later = snapshot?.deferredTasks || [];
  const total = progress.total ?? (active.length + done.length + later.length);
  const completed = progress.completed ?? done.length;
  return {
    total,
    completed,
    percent: progress.percent ?? (total ? Math.round((completed / total) * 100) : 0),
  };
}

function MentorEmptyState({ onBuild }) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#172d47] p-4">
      <MentorMessage message="Aapka GK plan abhi ready nahi hai. Preparation setup complete kijiye, phir daily task plan ban jayega." />
      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#112236] p-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">You will get</p>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-300">
          <p>Daily task plan</p>
          <p>Mistake revision</p>
          <p>Topic-wise practice</p>
          <p>Progress tracking</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onBuild}
        className="mt-4 w-full rounded-2xl bg-[#14B8A6] py-3 text-sm font-black text-white active:scale-[0.98]"
      >
        Build My GK Plan
      </button>
    </section>
  );
}

function SignInPreview() {
  return (
    <div className="app-page">
      <div className="app-shell !px-0 pb-20">
        <AppTopBar />
        <main className="px-4 pb-24 pt-[18px] text-white">
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 via-slate-800 to-teal-500/20">
                <TeacherMentorIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black">Today&apos;s GK Plan</h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Aaj ka focus clear rakhiye - ek task complete kijiye, phir next step pe chalte hain.
                </p>
              </div>
            </div>
            <MentorMessage message="Sign in kijiye. Aapka personalized GK plan save rahega aur daily progress sync hogi." />
          </section>

          <section className="relative mt-5 h-[340px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172d47] p-4">
            <div className="space-y-3 opacity-45 blur-[5px]">
              <div className="rounded-2xl border border-white/[0.08] bg-[#112236] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Day Progress</p>
                <div className="mt-3 h-2 rounded-full bg-[#0d1b2e]">
                  <div className="h-full w-1/3 rounded-full bg-teal-400" />
                </div>
              </div>
              {['Repeated Mistakes', 'Indian Polity', 'Quick Confidence Check'].map(title => (
                <div key={title} className="rounded-2xl border border-white/[0.08] bg-[#112236] p-4">
                  <p className="text-xs font-bold text-orange-300">Practice Task</p>
                  <p className="mt-2 font-display text-lg font-black text-white">{title}</p>
                  <div className="mt-3 h-10 rounded-2xl bg-orange-500" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full rounded-2xl border border-white/[0.08] bg-[#0d1b2e]/95 p-5 text-center shadow-2xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15">
                  <TeacherMentorIcon className="h-7 w-7" />
                </div>
                <p className="font-display text-lg font-black text-white">Your mentor plan is waiting</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Sign in to unlock your GK revision lane</p>
                <button
                  type="button"
                  onClick={() => {
                    document.cookie = 'userMode=; path=/; max-age=0';
                    signIn('google', { callbackUrl: '/mentor' });
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-black text-slate-950"
                >
                  <GoogleSVG />
                  Continue with Google
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function CountModal({ task, busy, onClose, onSelect }) {
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-5 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-[448px] rounded-3xl border border-white/[0.08] bg-[#172d47] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-300">How many questions?</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">{task.title || task.topic || 'Mentor Task'}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Question count select kijiye. Result ke baad Mentor tab par wapas aa sakte hain.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
            x
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {QUESTION_COUNTS.map(count => (
            <button
              key={count}
              type="button"
              disabled={busy}
              onClick={() => onSelect(count)}
              className="rounded-2xl border border-orange-500/25 bg-orange-500/10 py-4 text-center font-display text-lg font-black text-orange-200 active:scale-[0.98] disabled:opacity-60"
            >
              {count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfidenceModal({ task, busy, onClose, onSelect }) {
  if (!task) return null;
  const options = ['Weak', 'Okay', 'Strong', 'Need revision'];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-5 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-[448px] rounded-3xl border border-white/[0.08] bg-[#172d47] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-teal-300">Confidence Check</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">{task.topic || 'Topic confidence'}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Apna current confidence select kijiye. Plan uske hisaab se update hoga.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
            x
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          {options.map(option => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => onSelect(option)}
              className="rounded-2xl border border-white/[0.08] bg-[#112236] py-3 text-sm font-black text-slate-100 active:scale-[0.98] disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoverageModal({ task, busy, onClose, onSelect }) {
  if (!task) return null;
  const options = ['Theory Complete', 'Started', 'Not Yet'];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-5 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-[448px] rounded-3xl border border-white/[0.08] bg-[#172d47] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-teal-300">Coverage Check</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">{task.topic || 'Topic coverage'}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Apna theory status select kijiye. Mentor plan uske hisaab se update hoga.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
            x
          </button>
        </div>
        <div className="mt-5 grid gap-2">
          {options.map(option => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => onSelect(option)}
              className="rounded-2xl border border-white/[0.08] bg-[#112236] py-3 text-sm font-black text-slate-100 active:scale-[0.98] disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockerModal({ task, busy, onClose, onSelect }) {
  if (!task) return null;
  const options = ['Theory pending', 'Time kam hai', 'Topic confusing hai', 'Practice nahi hui'];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-5 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-[448px] rounded-3xl border border-white/[0.08] bg-[#172d47] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-300">Feedback</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">Is topic mein main blocker kya hai?</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">Ek option select kijiye. Mentor plan chhote next step mein adjust hoga.</p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
            x
          </button>
        </div>
        <div className="mt-5 grid gap-2">
          {options.map(option => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => onSelect(option)}
              className="rounded-2xl border border-white/[0.08] bg-[#112236] py-3 text-sm font-black text-slate-100 active:scale-[0.98] disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfirmTaskModal({ task, busy, onClose, onConfirm }) {
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-5 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-[448px] rounded-3xl border border-white/[0.08] bg-[#172d47] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/15">
            <TeacherMentorIcon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-300">Confirm Task</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">Mark this task as completed?</h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">
              Agar aapne yeh task complete kar liya hai, toh isse completed mark kar sakte hain. Aapka current plan uske according update ho jayega.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-2xl border border-white/[0.08] bg-[#112236] py-3 text-sm font-black text-slate-300 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-2xl bg-gradient-to-r from-[#ff7a1a] to-[#ff4d00] py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Mark Completed'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MentorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const email = session?.user?.email || '';
  const [guestMode, setGuestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState('');
  const [practiceTask, setPracticeTask] = useState(null);
  const [confidenceTask, setConfidenceTask] = useState(null);
  const [coverageTask, setCoverageTask] = useState(null);
  const [blockerTask, setBlockerTask] = useState(null);
  const [confirmTask, setConfirmTask] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    setGuestMode(isGuestMode());
    return () => clearInterval(timer);
  }, []);

  const progress = useMemo(() => getSnapshotProgress(snapshot), [snapshot]);
  const profile = snapshot?.profile || null;
  const onboarded = Boolean(snapshot?.exists && profile);
  const mentorDayMessage = snapshot?.mentorMessage || getMentorDayMessage(now);
  const preparationStartedDate = formatPreparationStartedDate(profile?.onboardingCompletedAt);
  const manualDoneTaskIds = useMemo(() => {
    const recentTaskId = getRecentMentorAttemptTaskId();
    if (!recentTaskId) return new Set();
    const stillActive = (snapshot?.activeTasks || []).some(task => task.taskId === recentTaskId && task.status === 'active');
    return stillActive ? new Set([recentTaskId]) : new Set();
  }, [snapshot]);

  const loadMentor = useCallback(async ({ forceRefresh = false, background = false } = {}) => {
    if (!email && !guestMode) return false;
    if (!background) setLoading(true);
    setError('');

    if (guestMode && !email) {
      const localSnapshot = buildLocalSnapshot();
      setSnapshot(localSnapshot);
      setLoading(false);
      return true;
    }

    const cached = !forceRefresh ? readCachedSnapshot(email) : null;
    if (cached) {
      setSnapshot(sanitizeSnapshot(cached));
      setLoading(false);
      // Fresh cache → zero API calls. Stale cache → render now, refresh once
      // below in the background (the cached render already happened).
      if (isMentorSnapshotFresh(cached)) {
        setRefreshing(false);
        return true;
      }
    }

    try {
      // Deduped reads: GET /api/mentor/plan or POST /api/mentor/refresh (force).
      const data = forceRefresh ? await fetchMentorRefresh() : await fetchMentorPlan();
      setSnapshot(sanitizeSnapshot(data));
      writeCachedSnapshot(email, data);
      return true;
    } catch (err) {
      if (!cached) setError(err.message || MENTOR_COPY.PLAN_FAILED);
      else setError('Latest sync nahi ho paya. Cached plan dikha rahe hain.');
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [email, guestMode]);

  useEffect(() => {
    if (status !== 'authenticated' && !(status === 'unauthenticated' && guestMode)) return;
    loadMentor();
  }, [guestMode, loadMentor, status]);

  // Post plan-update toast (set by the Preparation Setup edit flow via ?updated=1).
  useEffect(() => {
    if (!router.isReady || router.query.updated !== '1') return;
    setToast({ type: 'success', message: 'Aapka GK plan update ho gaya hai.' });
    const timer = setTimeout(() => setToast(null), 2800);
    router.replace('/mentor', undefined, { shallow: true });
    return () => clearTimeout(timer);
  }, [router.isReady, router.query.updated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runTaskAction(task, actionType, actionValue = '') {
    setBusyTaskId(task.taskId);
    if (guestMode && !email) {
      if (actionType !== 'launch_practice') {
        const nextStatus = actionType === 'snooze' ? 'snoozed' : 'completed';
        const nextTasks = (snapshot?.plan?.tasks || []).map(item => item.taskId === task.taskId ? {
          ...item,
          status: getGuestTaskStatus(item, actionType, nextStatus),
          taskType: getGuestTaskType(item, actionType),
          completedAt: actionType === 'snooze' ? item.completedAt : new Date().toISOString(),
          snoozedUntil: actionType === 'snooze' ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() : item.snoozedUntil,
          snoozeCount: actionType === 'snooze' ? Number(item.snoozeCount || 0) + 1 : item.snoozeCount,
          questionCount: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 2 && Number(item.questionCount || 0) > 10 ? 10 : item.questionCount,
          whyThisText: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 2 ? 'Is topic ko chhote step mein tod dete hain.' : item.whyThisText,
          ctaLabel: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3 ? 'Answer Now' : item.ctaLabel,
          secondaryAction: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3 ? 'Later' : item.secondaryAction,
          reason: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3 ? 'snooze_blocker' : item.reason,
          mentorMessage: actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3 ? 'Is topic mein main blocker kya hai? Ek quick response se next step better decide hoga.' : item.mentorMessage,
          actionValue,
        } : item);
        const nextSnapshot = buildLocalSnapshotFromParts(snapshot?.profile, { ...(snapshot?.plan || {}), tasks: nextTasks });
        setSnapshot(nextSnapshot);
        writeLocalSnapshot(nextSnapshot);
      }
      setBusyTaskId('');
      return;
    }
    const res = await fetch('/api/mentor/task-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.taskId,
        planId: task.planId || snapshot?.plan?.planId,
        actionType,
        actionValue,
        subject: task.subject || task.subjectId,
        topic: task.topic,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Action save nahi ho paya');
    // Step 8: patch state + cache from the authoritative snapshot the
    // task-action route now returns — no follow-up GET /api/mentor/plan.
    // If the server could not build a snapshot, fall back to one targeted
    // background refresh (safety only; not the normal path).
    if (actionType !== 'launch_practice') {
      if (data.snapshot) {
        setSnapshot(sanitizeSnapshot(data.snapshot));
        writeCachedSnapshot(email, data.snapshot);
      } else {
        // Targeted fallback only: fetch the plan once (bypasses freshness gate).
        try {
          const fresh = await fetchMentorPlan();
          setSnapshot(sanitizeSnapshot(fresh));
          writeCachedSnapshot(email, fresh);
        } catch { /* keep current state; controls re-enable below */ }
      }
    }
    setBusyTaskId('');
  }

  function getGuestTaskStatus(item, actionType, fallbackStatus) {
    if (actionType === 'response') return 'completed';
    if (actionType === 'resume') return 'active';
    if (actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3) return 'active';
    return fallbackStatus;
  }

  function getGuestTaskType(item, actionType) {
    if (actionType === 'snooze' && Number(item.snoozeCount || 0) + 1 >= 3) return 'feedback_task';
    return item.taskType;
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    const ok = await loadMentor({ forceRefresh: true, background: true });
    try {
      if (!ok) throw new Error('refresh failed');
      setToast({ type: 'success', message: 'Mentor plan refreshed' });
    } catch {
      setToast({ type: 'error', message: 'Could not refresh plan. Please try again.' });
    } finally {
      setTimeout(() => setToast(null), 2800);
    }
  }

  async function handleShowNextDay() {
    if (refreshing) return;
    setRefreshing(true);
    setError('');
    try {
      if (guestMode && !email) {
        const tasks = snapshot?.plan?.tasks || [];
        let unlocked = false;
        const nextTasks = tasks.map(task => {
          if (!unlocked && task.status === 'pending') {
            unlocked = true;
            return { ...task, status: 'active' };
          }
          return task;
        });
        const nextPlan = {
          ...(snapshot?.plan || {}),
          activeDayNumber: Number(snapshot?.plan?.activeDayNumber || snapshot?.plan?.dayNumber || 1) + 1,
          dayNumber: Number(snapshot?.plan?.dayNumber || 1) + 1,
          tasks: nextTasks,
        };
        const localSnapshot = buildLocalSnapshotFromParts(snapshot?.profile, nextPlan);
        setSnapshot(localSnapshot);
        writeLocalSnapshot(localSnapshot);
      } else {
        const res = await fetch('/api/mentor/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unlockNextDay: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Next day unlock nahi ho paya.');
        setSnapshot(data);
        writeCachedSnapshot(email, data);
      }
      setToast({ type: 'success', message: 'Next step unlocked' });
      setTimeout(() => setToast(null), 2400);
    } catch (err) {
      setError(err.message || 'Next day unlock nahi ho paya.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLater(task) {
    try {
      await runTaskAction(task, 'snooze');
    } catch (err) {
      setError(err.message || 'Task later save nahi ho paya.');
      setBusyTaskId('');
    }
  }

  // Phase 9E: Resume a previously-postponed (pending) task. Reuses the existing
  // task-action client flow with actionType=resume; the backend decides V2 vs
  // legacy (the frontend stays unaware of V2 flags).
  async function handleResume(task) {
    try {
      await runTaskAction(task, 'resume');
    } catch (err) {
      setError(err.message || 'Task resume nahi ho paya.');
      setBusyTaskId('');
    }
  }

  function handlePrimary(task) {
    if (isRepeatedMistakesPracticeTask(task)) {
      launchRepeatedMistakesPractice(task).catch(err => {
        setError(err.message || 'Repeated mistakes practice start nahi ho payi.');
        setBusyTaskId('');
      });
      return;
    }
    if (task.taskType === 'practice_task') {
      setPracticeTask(task);
      return;
    }
    if (task.taskType === 'revision_task') {
      setConfirmTask(task);
      return;
    }
    if (task.taskType === 'mistake_recovery_task') {
      runTaskAction(task, 'launch_practice').catch(() => {});
      router.push('/history/mistakes');
      return;
    }
    if (task.taskType === 'confidence_check') {
      setConfidenceTask(task);
      return;
    }
    if (task.taskType === 'coverage_check') {
      setCoverageTask(task);
      return;
    }
    if (task.taskType === 'feedback_task') {
      setBlockerTask(task);
      return;
    }
    setConfirmTask(task);
  }

  function isRepeatedMistakesPracticeTask(task) {
    return task?.reason === 'recent_mistakes' || task?.ctaRoute === '/history/mistakes';
  }

  async function launchRepeatedMistakesPractice(task) {
    setBusyTaskId(task.taskId);
    const count = Number(task.questionCount || 25);
    const planId = task.planId || snapshot?.plan?.planId || '';
    const mentorContext = {
      sourcePage: 'mentor',
      sourceScreen: 'mentor_plan',
      sourceTaskId: task.taskId,
      planId,
      returnUrl: '/mentor',
      subject: task.subject || '',
      topic: task.topic || 'Repeated Mistakes',
      questionCount: count,
    };
    sessionStorage.setItem('ssc_mentor_return_context', JSON.stringify(mentorContext));
    await runTaskAction(task, 'launch_practice', String(count));

    if (guestMode && !email) {
      router.push('/history/mistakes');
      return;
    }

    const res = await fetch('/api/history/reattempt-filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: '',
        topic: '',
        answerStatus: 'wrong_skipped',
        questionHistory: 'repeated',
        limit: count,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Repeated mistakes practice start nahi ho payi.');
    sessionStorage.setItem('ssc_history_quiz_questions', JSON.stringify({
      questions: data.data.questions,
      quizMode: data.data.quizMode,
      subject: 'History',
      topic: 'Repeated Mistakes',
      sourceCollection: 'general',
    }));
    const params = new URLSearchParams({
      mode: 'history',
      count: String(data.data.questionCount || count),
      sourcePage: 'mentor',
      sourceScreen: 'mentor_plan',
      sourceTaskId: task.taskId,
      planId,
      returnUrl: '/mentor',
    });
    router.push(`/quiz?${params.toString()}`);
  }

  async function launchPractice(count) {
    const task = practiceTask;
    if (!task) return;
    setBusyTaskId(task.taskId);
    try {
      await runTaskAction(task, 'launch_practice', String(count));
      const subject = task.subject || task.subjectId || task.subjectName || '';
      const topic = task.topic || '';
      const planId = task.planId || snapshot?.plan?.planId || '';
      const mentorContext = {
        sourcePage: 'mentor',
        sourceScreen: 'mentor_plan',
        sourceTaskId: task.taskId,
        planId,
        returnUrl: '/mentor',
        subject,
        topic,
        collection: 'PYQ',
        questionCount: count,
      };
      sessionStorage.setItem('ssc_mentor_return_context', JSON.stringify(mentorContext));
      const params = new URLSearchParams({
        subject,
        topic,
        count: String(count),
        collection: 'PYQ',
        sourcePage: 'mentor',
        sourceScreen: 'mentor_plan',
        sourceTaskId: task.taskId,
        planId,
        returnUrl: '/mentor',
      });
      router.push(`/quiz?${params.toString()}`);
    } catch (err) {
      setError(err.message || 'Practice start nahi ho payi.');
      setBusyTaskId('');
    }
  }

  async function saveConfidence(value) {
    const task = confidenceTask;
    if (!task) return;
    try {
      await runTaskAction(task, 'response', value);
      setConfidenceTask(null);
    } catch (err) {
      setError(err.message || 'Confidence save nahi ho paya.');
      setBusyTaskId('');
    }
  }

  async function saveCoverage(value) {
    const task = coverageTask;
    if (!task) return;
    try {
      await runTaskAction(task, 'response', value);
      setCoverageTask(null);
    } catch (err) {
      setError(err.message || 'Coverage save nahi ho paya.');
      setBusyTaskId('');
    }
  }

  async function saveBlocker(value) {
    const task = blockerTask;
    if (!task) return;
    try {
      await runTaskAction(task, 'response', value);
      setBlockerTask(null);
    } catch (err) {
      setError(err.message || 'Feedback save nahi ho paya.');
      setBusyTaskId('');
    }
  }

  if (status === 'loading' || ((status === 'authenticated' || guestMode) && loading && !snapshot)) {
    return <Loader fullScreen label="Loading mentor..." />;
  }

  if (status === 'unauthenticated' && !guestMode) {
    return (
      <>
        <Head><title>Mentor - SSC GK Score Booster</title></Head>
        <SignInPreview />
      </>
    );
  }

  return (
    <>
      <Head><title>Mentor - SSC GK Score Booster</title></Head>
      <div className="app-page">
        <div className="app-shell !px-0 pb-20">
          <AppTopBar />
          <main className="px-4 pb-24 pt-[18px] text-white">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="flex justify-end">
                  <RefreshStatus
                    updatedAt={snapshot?.lastSyncAt || snapshot?.plan?.updatedAt}
                    isRefreshing={refreshing}
                    onRefresh={handleRefresh}
                    refreshText={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                    }
                  />
                </div>
                <MentorMessage message={onboarded ? mentorDayMessage : MENTOR_COPY.NO_PLAN} />
              </section>

              {error && !onboarded ? (
                <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <p className="font-display text-base font-black text-red-100">Could not load mentor plan.</p>
                  <p className="mt-1 text-xs font-semibold text-red-200/80">Please refresh and try again.</p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="mt-4 w-full rounded-2xl border border-red-400/30 bg-red-500/15 py-3 text-sm font-black text-red-100 disabled:opacity-60"
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh My Plan'}
                  </button>
                </section>
              ) : null}

              {error && onboarded ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-200">
                  {error}
                </div>
              ) : null}

              {!onboarded ? (
                !error ? <MentorEmptyState onBuild={() => router.push('/mentor-setup')} /> : null
              ) : (
                <>
                  <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#18324f] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.16)]">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-teal-300 via-teal-400 to-transparent" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Preparation Setup</h2>
                        <p className="mt-1.5 text-base font-black leading-tight text-slate-100">
                          {profile?.examTarget || 'Exam not set'} <span className="text-slate-500">·</span> {formatDaysLeftLabel(profile?.daysLeftRange)}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-teal-300/15 bg-teal-300/10 px-3 py-1 text-xs font-black text-teal-200">
                            {formatDailyTimeLabel(profile?.dailyGKTime)}
                          </span>
                          <span className="rounded-full border border-teal-300/15 bg-white/[0.04] px-3 py-1 text-xs font-black text-slate-200">
                            {profile?.pace || 'Pace not set'} pace
                          </span>
                        </div>
                        <p className="mt-2.5 text-xs font-semibold text-slate-500">
                          Plan can be updated anytime{preparationStartedDate ? ` · Started ${preparationStartedDate}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/mentor-setup-edit')}
                        className="shrink-0 rounded-full border border-teal-300/20 bg-white/[0.03] px-3 py-2 text-xs font-black text-teal-200"
                      >
                        Edit
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl font-black leading-none text-slate-100">Today&apos;s Plan</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{progress.completed}/{Math.max(progress.total, 1)} tasks completed</p>
                      </div>
                      <p className="shrink-0 rounded-full border border-white/[0.08] bg-[#172d47] px-3 py-1.5 text-xs font-black text-slate-400">
                        Day {snapshot?.plan?.dayNumber || 1} of {snapshot?.plan?.daysTotal || 45} - {progress.total || 0} tasks
                      </p>
                    </div>
                    <TodaysPlanCard
                      plan={snapshot?.plan}
                      activeTasks={snapshot?.activeTasks}
                      completedTasks={snapshot?.completedToday}
                      deferredTasks={snapshot?.deferredTasks}
                      progress={progress}
                      busyTaskId={busyTaskId}
                      manualDoneTaskIds={manualDoneTaskIds}
                      onPrimary={handlePrimary}
                      onDone={setConfirmTask}
                      onLater={handleLater}
                      onShowNextDay={handleShowNextDay}
                    />
                  </section>

                  {/* Phase 9E: Previously Pending — read-only surfacing of canonical
                      pending tasks (V2 postponed). Hidden when empty; legacy snoozed
                      tasks are NOT here (they are deferred, not pending). */}
                  {(snapshot?.pendingTasks || []).length > 0 && (
                    <section className="space-y-3" aria-label="Previously Pending">
                      <div>
                        <h2 className="font-display text-xl font-black leading-none text-slate-100">Previously Pending</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Tasks you paused for later. Resume when you&apos;re ready.</p>
                      </div>
                      <div className="space-y-2">
                        {(snapshot?.pendingTasks || []).map(task => (
                          <div key={task.taskId} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#172d47] p-3.5">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300">Paused for later</span>
                                {(task.subject || task.subjectName) && (
                                  <span className="truncate text-[11px] font-semibold text-slate-400">{task.subject || task.subjectName}{task.topic ? ` · ${task.topic}` : ''}</span>
                                )}
                              </div>
                              <h3 className="mt-1 truncate font-display text-base font-black text-white">{task.title || task.topic || 'Mentor Task'}</h3>
                              <p className="mt-0.5 text-xs font-medium text-slate-500">Continue when you want.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleResume(task)}
                              disabled={busyTaskId === task.taskId}
                              className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-[#0b1a2e] disabled:opacity-60"
                            >
                              {busyTaskId === task.taskId ? 'Resuming…' : 'Resume'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      <CountModal
        task={practiceTask}
        busy={Boolean(busyTaskId)}
        onClose={() => {
          setPracticeTask(null);
          setBusyTaskId('');
        }}
        onSelect={launchPractice}
      />
      <ConfidenceModal
        task={confidenceTask}
        busy={Boolean(busyTaskId)}
        onClose={() => {
          setConfidenceTask(null);
          setBusyTaskId('');
        }}
        onSelect={saveConfidence}
      />
      <CoverageModal
        task={coverageTask}
        busy={Boolean(busyTaskId)}
        onClose={() => {
          setCoverageTask(null);
          setBusyTaskId('');
        }}
        onSelect={saveCoverage}
      />
      <BlockerModal
        task={blockerTask}
        busy={Boolean(busyTaskId)}
        onClose={() => {
          setBlockerTask(null);
          setBusyTaskId('');
        }}
        onSelect={saveBlocker}
      />
      <ConfirmTaskModal
        task={confirmTask}
        busy={Boolean(busyTaskId)}
        onClose={() => {
          setConfirmTask(null);
          setBusyTaskId('');
        }}
        onConfirm={async () => {
          const task = confirmTask;
          if (!task) return;
          try {
            await runTaskAction(task, 'complete', manualDoneTaskIds.has(task.taskId) ? 'manual_recovery' : '');
            setConfirmTask(null);
            setToast({ type: 'success', message: manualDoneTaskIds.has(task.taskId) ? 'Task completed mark ho gaya.' : 'Task completed' });
            setTimeout(() => setToast(null), 2400);
          } catch (err) {
            setError(err.message || 'Task complete hua, lekin save nahi ho paya. Please retry.');
            setBusyTaskId('');
          }
        }}
      />
      {toast ? (
        <div className={`fixed bottom-24 left-4 right-4 z-[90] mx-auto max-w-[430px] rounded-2xl px-4 py-3 text-sm font-black text-white shadow-2xl ${toast.type === 'success' ? 'bg-[#14B8A6]' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
