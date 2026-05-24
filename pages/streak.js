import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import { getISTDateString } from '@/lib/streak';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const LightningSVG = ({ size = 16, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

function getStreakDays(streakCount, lastAttemptDate) {
  const todayIST = getISTDateString();
  const todayDate = new Date(todayIST + 'T00:00:00+05:30');
  const todayIdx = (todayDate.getDay() + 6) % 7; // 0=Mon
  const playedToday = lastAttemptDate === todayIST;
  const done = new Set();
  const base = playedToday ? todayIdx : todayIdx - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) done.add(idx);
  }
  return { done, todayIdx, playedToday };
}

function getMotivation(count) {
  if (count === 0) return 'Start your first streak today! 🚀';
  if (count <= 3)  return "You're building momentum! Keep going 💪";
  if (count <= 6)  return "Almost a week! Don't break now 🔥";
  if (count <= 13) return "One week down! You're unstoppable 🏆";
  return `Legend in the making! ${count} days strong ⚡`;
}

export default function StreakPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/'); return; }
    fetch('/api/user-profile')
      .then(r => r.json())
      .then(d => { setProfile(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] px-4 pt-10">
        <div className="skeleton h-9 w-48 rounded-xl mb-4" />
        <div className="skeleton h-32 rounded-3xl mb-4" />
        <div className="skeleton h-48 rounded-3xl" />
      </div>
    );
  }

  const streakCount     = profile?.streakCount || 0;
  const lastAttemptDate = profile?.lastAttemptDate || '';
  const todayIST        = getISTDateString();
  const playedToday     = lastAttemptDate === todayIST;

  const { done, todayIdx } = getStreakDays(streakCount, lastAttemptDate);

  return (
    <>
      <Head><title>Streak History — SSC GK Score Booster</title></Head>
      <div className="min-h-screen bg-[#0f172a] pb-10">

        {/* Header */}
        <div className="px-4 pt-10 pb-4 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-black text-xl text-white">Streak History</h1>
        </div>

        {/* Hero card */}
        <div className="mx-4 bg-gradient-to-br from-orange-900/40 to-amber-900/20 border border-orange-500/30 rounded-3xl px-5 py-5 flex items-center justify-between">
          <div>
            <div className="text-4xl mb-1">🔥</div>
            <p className="font-display font-black text-4xl text-white leading-none">{streakCount}</p>
            <p className="font-sans text-sm text-orange-300 mt-0.5">day streak</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="font-sans text-xs text-orange-300">🏆 Best: {streakCount} days</p>
            {playedToday ? (
              <p className="font-sans text-xs text-emerald-400">✓ Protected today</p>
            ) : (
              <p className="font-sans text-xs text-orange-400">Play today to extend!</p>
            )}
          </div>
        </div>

        {/* This Week calendar */}
        <div className="mx-4 mt-4 bg-slate-800 rounded-3xl p-4">
          <p className="font-display font-bold text-base text-white mb-3">This Week</p>

          <div className="flex justify-between">
            {DAY_LABELS.map((day, i) => {
              const isDone     = done.has(i);
              const isToday    = i === todayIdx;
              const isTodayDone = isToday && playedToday;
              const isTodayTodo = isToday && !playedToday;

              let circleCls = 'w-10 h-10 rounded-full flex items-center justify-center ';
              if (isDone || isTodayDone) {
                circleCls += 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)] ';
                if (isTodayDone) circleCls += 'ring-2 ring-orange-300 ring-offset-2 ring-offset-slate-800';
              } else if (isTodayTodo) {
                circleCls += 'bg-white/5 border-2 border-white';
              } else {
                circleCls += 'bg-slate-700/50 border border-slate-600';
              }

              return (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <span className="font-sans text-xs text-slate-500">{day}</span>
                  <div className={circleCls}>
                    {(isDone || isTodayDone) && <LightningSVG size={16} color="white" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Streak count row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <LightningSVG size={18} color="#f97316" />
              <span className="font-display font-black text-lg text-white">{streakCount} days</span>
            </div>
            <div className="flex gap-1">
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 text-sm">‹</div>
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400 text-sm">›</div>
            </div>
          </div>
        </div>

        {/* Motivation card */}
        <div className="mx-4 mt-4 bg-slate-800 rounded-2xl px-4 py-4">
          <p className="font-sans font-medium text-sm text-slate-300 text-center py-2">{getMotivation(streakCount)}</p>
        </div>

        {/* Streak Milestone Bonuses table */}
        <div className="mx-4 mt-5 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <p className="font-display font-bold text-base text-white">Streak Milestone Bonuses 🔥</p>
            <p className="font-sans text-xs text-slate-400 mt-0.5">Keep your streak to unlock bonus XP</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/40">
                <th className="px-4 py-2.5 text-left font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">Streak</th>
                <th className="px-4 py-2.5 text-right font-sans font-medium text-xs text-slate-500 uppercase tracking-wide">Bonus XP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '3-day streak',   xp: '+15 XP',  color: 'text-orange-400',  active: streakCount >= 3  },
                { label: '1-week streak',   xp: '+30 XP',  color: 'text-orange-400',  active: streakCount >= 7  },
                { label: '2-week streak',   xp: '+60 XP',  color: 'text-amber-400',   active: streakCount >= 14 },
                { label: '1-month streak',  xp: '+150 XP', color: 'text-yellow-400',  active: streakCount >= 30 },
                { label: '3-month streak',  xp: '+500 XP', color: 'text-emerald-400', active: streakCount >= 90 },
              ].map((row, i, arr) => (
                <tr key={row.label} className={i < arr.length - 1 ? 'border-b border-slate-700/30' : ''}>
                  <td className="px-4 py-3">
                    <span className={`font-sans text-sm ${row.active ? 'text-white' : 'text-slate-500'}`}>{row.label}</span>
                    {row.active && <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 rounded-full px-2 py-0.5 font-display font-bold">Achieved ✓</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-display font-black text-sm ${row.active ? row.color : 'text-slate-600'}`}>{row.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-orange-500/5 border-t border-orange-500/20">
            <p className="font-sans text-xs text-orange-400">💡 Bonus XP is awarded automatically when you hit a milestone</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-4 mt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-display font-bold text-base active:scale-[0.98] transition-transform"
          >
            Practice Now →
          </button>
        </div>

      </div>
    </>
  );
}
