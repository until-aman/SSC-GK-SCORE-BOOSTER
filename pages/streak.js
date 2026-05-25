import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import { getISTDateString } from '@/lib/streak';

const DAY_LABELS  = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MILESTONES = [
  { days: 3,  xp: 15,  label: '3-day',   color: '#f97316', floor: '#92400E' },
  { days: 7,  xp: 30,  label: '1-week',  color: '#f97316', floor: '#92400E' },
  { days: 14, xp: 60,  label: '2-week',  color: '#f59e0b', floor: '#78350F' },
  { days: 30, xp: 150, label: '1-month', color: '#eab308', floor: '#713F12' },
  { days: 90, xp: 500, label: '3-month', color: '#10b981', floor: '#065F46' },
];

const LightningSVG = ({ size = 16, color = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

function getStreakDays(streakCount, lastAttemptDate) {
  const todayIST  = getISTDateString();
  const todayDate = new Date(todayIST + 'T00:00:00+05:30');
  const todayIdx  = (todayDate.getDay() + 6) % 7;
  const playedToday = lastAttemptDate === todayIST;
  const done = new Set();
  const base = playedToday ? todayIdx : todayIdx - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) done.add(idx);
  }
  return { done, todayIdx, playedToday };
}

function buildMonthCells(year, month, streakCount, lastAttemptDate) {
  const todayIST = getISTDateString();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getDate();
  const startDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  const playedSet     = new Set();
  const milestoneSet  = new Set();
  if (lastAttemptDate && streakCount > 0) {
    const last = new Date(lastAttemptDate + 'T00:00:00+05:30');
    for (let i = 0; i < streakCount; i++) {
      const d = new Date(last);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      playedSet.add(iso);
      // day (streakCount - i) of the streak — mark milestone days
      const dayNum = streakCount - i;
      if ([3, 7, 14, 30, 90].includes(dayNum)) milestoneSet.add(iso);
    }
  }

  const cells = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({
      day: d, dateStr,
      played:      playedSet.has(dateStr),
      isMilestone: milestoneSet.has(dateStr),
      isToday:     dateStr === todayIST,
      isFuture:    dateStr > todayIST,
    });
  }
  return cells;
}

export default function StreakPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [calView, setCalView]     = useState('week');
  const [monthOffset, setMonthOffset] = useState(0);
  const [btnPress, setBtnPress]   = useState(false);

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
        <div className="skeleton h-36 rounded-3xl mb-4" />
        <div className="skeleton h-52 rounded-3xl" />
      </div>
    );
  }

  const streakCount     = profile?.streakCount || 0;
  const lastAttemptDate = profile?.lastAttemptDate || '';
  const todayIST        = getISTDateString();
  const playedToday     = lastAttemptDate === todayIST;

  const { done, todayIdx } = getStreakDays(streakCount, lastAttemptDate);

  const nextMs   = MILESTONES.find(m => m.days > streakCount) || null;
  const prevMs   = [...MILESTONES].reverse().find(m => m.days <= streakCount) || null;
  const daysToNext   = nextMs ? nextMs.days - streakCount : 0;
  const progressBase = prevMs ? prevMs.days : 0;
  const progressEnd  = nextMs ? nextMs.days : streakCount || 1;
  const progress     = nextMs ? Math.max(4, ((streakCount - progressBase) / (progressEnd - progressBase)) * 100) : 100;

  const today      = new Date();
  const viewDate   = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthCells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth(), streakCount, lastAttemptDate);
  const canGoNext  = monthOffset < 0;

  return (
    <>
      <Head><title>Streak History — SSC GK Score Booster</title></Head>
      <style>{`
        @keyframes streakPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); }
          50%      { box-shadow: 0 0 0 12px rgba(249,115,22,0); }
        }
        .streak-fire { animation: streakPulse 2s ease-in-out infinite; }
        @keyframes progFill { from { width: 4%; } }
        .prog-bar { animation: progFill 0.8s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="min-h-screen bg-[#0f172a]" style={{ paddingBottom: 100 }}>

        {/* ── HEADER ── */}
        <div className="px-4 pt-10 pb-3 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-black text-xl text-white">Streak</h1>
        </div>

        {/* ── HERO CARD ── */}
        <div className="mx-4" style={{
          background: playedToday
            ? 'linear-gradient(145deg, rgba(249,115,22,0.16) 0%, rgba(17,28,46,1) 70%)'
            : 'linear-gradient(145deg, rgba(239,68,68,0.14) 0%, rgba(17,28,46,1) 70%)',
          border: playedToday ? '1px solid rgba(249,115,22,0.30)' : '1px solid rgba(239,68,68,0.28)',
          borderRadius: 24, padding: '20px 20px 20px',
        }}>
          {/* Top row: icon + label + number */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              className={playedToday ? 'streak-fire' : ''}
              style={{
                width: 58, height: 58, borderRadius: 18, fontSize: 28, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: playedToday ? 'linear-gradient(145deg,#f97316,#ea580c)' : 'rgba(239,68,68,0.14)',
                border: playedToday ? 'none' : '1px solid rgba(239,68,68,0.30)',
              }}
            >
              {playedToday ? '🔥' : '😴'}
            </div>
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.38)', letterSpacing: '0.08em', marginBottom: 3 }}>
                Current Streak
              </p>
              <p className="font-display font-black text-white leading-none" style={{ fontSize: 40 }}>
                {streakCount} <span style={{ fontSize: 20, fontWeight: 700, color: playedToday ? '#fdba74' : '#fca5a5' }}>days</span>
              </p>
            </div>
          </div>

          {/* Status + Best streak row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '5px 12px',
              background: playedToday ? 'rgba(16,185,129,0.13)' : 'rgba(239,68,68,0.13)',
              border: playedToday ? '1px solid rgba(16,185,129,0.28)' : '1px solid rgba(239,68,68,0.28)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: playedToday ? '#34d399' : '#f87171' }}>
                {playedToday ? '✓ Protected today' : '⚡ At risk — play now!'}
              </span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '5px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>
                🏆 Best: {profile?.bestStreak || streakCount} days
              </span>
            </div>
          </div>

          {/* Motivational line */}
          {nextMs && (
            <p className="font-sans text-sm" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 12, lineHeight: 1.5 }}>
              {playedToday
                ? `Practice tomorrow to make it ${streakCount + 1} days and unlock +${nextMs.xp} XP.`
                : `Play today to protect your ${streakCount}-day streak and stay on track for +${nextMs.xp} XP.`
              }
            </p>
          )}

          {/* Progress to next milestone */}
          {nextMs && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  Next: <span style={{ color: nextMs.color, fontWeight: 700 }}>{nextMs.label} streak</span>
                </span>
                <span className="font-display font-bold text-xs" style={{ color: nextMs.color }}>
                  {daysToNext} day{daysToNext !== 1 ? 's' : ''} away · +{nextMs.xp} XP
                </span>
              </div>
              <div style={{ height: 7, borderRadius: 7, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div
                  className="prog-bar"
                  style={{
                    height: '100%', borderRadius: 7, width: `${progress}%`,
                    background: `linear-gradient(90deg, ${nextMs.color}, ${nextMs.color}cc)`,
                    boxShadow: `0 0 10px ${nextMs.color}66`,
                  }}
                />
              </div>
            </div>
          )}
          {!nextMs && (
            <p className="font-display font-bold text-sm text-center mt-4" style={{ color: '#10b981' }}>
              🏆 All milestones unlocked! Legend status.
            </p>
          )}
        </div>

        {/* ── ACTIVITY CALENDAR ── */}
        <div className="mx-4 mt-4" style={{
          background: '#111C2E',
          border: '1px solid rgba(148,163,184,0.09)',
          borderRadius: 22, overflow: 'hidden',
        }}>
          {/* Card header + toggle */}
          <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="font-display font-bold text-base text-white">Activity</p>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 3, gap: 2 }}>
              {['week','month'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  style={{
                    padding: '4px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'capitalize',
                    background: calView === v ? 'rgba(249,115,22,0.85)' : 'transparent',
                    color: calView === v ? '#ffffff' : 'rgba(255,255,255,0.38)',
                    transition: 'all 0.18s ease',
                  }}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* ── WEEK VIEW ── */}
          {calView === 'week' && (
            <div style={{ padding: '16px 16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {DAY_LABELS.map((day, i) => {
                  const isDone      = done.has(i);
                  const isToday     = i === todayIdx;
                  const isTodayDone = isToday && playedToday;
                  const isTodayTodo = isToday && !playedToday;
                  const isMissed    = i < todayIdx && !isDone;
                  const isFuture    = i > todayIdx;

                  const bg = (isDone || isTodayDone)
                    ? 'linear-gradient(145deg,#f97316,#ea580c)'
                    : isTodayTodo ? 'rgba(249,115,22,0.08)'
                    : isMissed    ? 'rgba(239,68,68,0.07)'
                    : 'rgba(255,255,255,0.03)';
                  const border = (isDone || isTodayDone)
                    ? 'none'
                    : isTodayTodo ? '2px solid #f97316'
                    : isMissed    ? '1px solid rgba(239,68,68,0.18)'
                    : '1px solid rgba(255,255,255,0.05)';
                  const glow = isTodayDone ? '0 0 16px rgba(249,115,22,0.55)' : 'none';

                  return (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? '#f97316' : 'rgba(255,255,255,0.28)' }}>
                        {day}
                      </span>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: (isDone || isTodayDone) ? 'linear-gradient(145deg,#f97316,#ea580c)' : 'transparent',
                        border: (isDone || isTodayDone) ? 'none'
                          : isTodayTodo ? '2px solid #f97316'
                          : isMissed    ? '1px solid rgba(255,255,255,0.12)'
                          : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isTodayDone ? '0 0 14px rgba(249,115,22,0.55)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        {(isDone || isTodayDone) && <LightningSVG size={15} color="white" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {/* This Week count */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LightningSVG size={15} color="#f97316" />
                    <span className="font-display font-black text-base text-white">
                      {done.size} / 7 <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>days this week</span>
                    </span>
                  </div>
                  <span className="font-sans text-xs" style={{ color: playedToday ? '#34d399' : '#fb923c' }}>
                    {playedToday ? '✓ Protected today' : '⚡ Play to protect'}
                  </span>
                </div>

                {/* Next reward row */}
                {nextMs && (
                  <div style={{
                    marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
                    background: `${nextMs.color}0F`,
                    border: `1px solid ${nextMs.color}28`,
                    borderRadius: 12, padding: '8px 12px',
                  }}>
                    <span style={{ fontSize: 14 }}>🎯</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Next reward: </span>
                      <span className="font-sans text-xs font-bold" style={{ color: nextMs.color }}>
                        {nextMs.label} streak · +{nextMs.xp} XP
                      </span>
                    </div>
                    <span className="font-display font-black text-xs" style={{ color: nextMs.color, flexShrink: 0 }}>
                      {daysToNext} day{daysToNext !== 1 ? 's' : ''} away
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MONTH VIEW ── */}
          {calView === 'month' && (
            <div style={{ padding: '12px 14px 18px' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={() => setMonthOffset(o => o - 1)}
                  style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16 }}
                >‹</button>
                <span className="font-display font-bold text-sm text-white">
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <button
                  onClick={() => canGoNext && setMonthOffset(o => o + 1)}
                  style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', fontSize: 16 }}
                >›</button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 5 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>{d}</div>
                ))}
              </div>

              {/* Cells — simple dot states */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={`e${idx}`} />;

                  // Determine dot appearance
                  let dotBg     = 'rgba(255,255,255,0.08)'; // missed
                  let dotBorder = 'none';
                  let dotOpacity = 1;
                  let dotGlow    = 'none';

                  if (cell.isFuture) {
                    dotBg      = 'rgba(255,255,255,0.04)';
                    dotOpacity = 0.4;
                  } else if (cell.played && cell.isToday) {
                    dotBg     = 'linear-gradient(145deg,#f97316,#ea580c)';
                    dotGlow   = '0 0 10px rgba(249,115,22,0.55)';
                    dotBorder = '2px solid rgba(255,255,255,0.25)';
                  } else if (cell.played && cell.isMilestone) {
                    dotBg     = 'linear-gradient(145deg,#f97316,#ea580c)';
                    dotBorder = '2px solid #fbbf24';
                  } else if (cell.played) {
                    dotBg = 'linear-gradient(145deg,#f97316,#ea580c)';
                  } else if (cell.isToday) {
                    dotBg     = 'transparent';
                    dotBorder = '2px solid #f97316';
                  }

                  return (
                    <div key={cell.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: dotBg, border: dotBorder,
                        opacity: dotOpacity, boxShadow: dotGlow,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }} />
                      <span style={{
                        fontSize: 9, lineHeight: 1,
                        color: cell.isToday ? '#f97316' : cell.isFuture ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.30)',
                        fontWeight: cell.isToday ? 700 : 400,
                      }}>
                        {cell.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── NEXT MILESTONE SPOTLIGHT ── */}
        {nextMs && (
          <div className="mx-4 mt-4" style={{
            background: '#111C2E',
            border: `1px solid ${nextMs.color}28`,
            borderRadius: 20, padding: '16px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.38)', marginBottom: 5 }}>Next milestone</p>
              <p className="font-display font-black text-white" style={{ fontSize: 18 }}>
                {nextMs.label} streak
              </p>
              <p className="font-sans text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
                {daysToNext} more day{daysToNext !== 1 ? 's' : ''} — keep it up!
              </p>
            </div>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `${nextMs.color}18`,
              border: `1px solid ${nextMs.color}35`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <p className="font-display font-black" style={{ fontSize: 17, color: nextMs.color, lineHeight: 1 }}>
                +{nextMs.xp}
              </p>
              <p className="font-sans" style={{ fontSize: 9, color: nextMs.color, opacity: 0.75, marginTop: 1 }}>XP BONUS</p>
            </div>
          </div>
        )}

        {/* ── ALL MILESTONES ── */}
        <div className="mx-4 mt-4" style={{
          background: '#111C2E',
          border: '1px solid rgba(148,163,184,0.09)',
          borderRadius: 20, overflow: 'hidden',
        }}>
          <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="font-display font-bold text-sm text-white">All Milestones</p>
          </div>
          {MILESTONES.map((m, i) => {
            const achieved = streakCount >= m.days;
            const isNext   = nextMs?.days === m.days;
            return (
              <div
                key={m.days}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderBottom: i < MILESTONES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: isNext ? `${m.color}0B` : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    background: achieved ? `${m.color}20` : isNext ? `${m.color}10` : 'rgba(255,255,255,0.04)',
                    border: achieved ? `1px solid ${m.color}45` : isNext ? `1px solid ${m.color}28` : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}>
                    {achieved ? <span style={{ color: m.color }}>✓</span> : isNext ? <span style={{ color: m.color }}>→</span> : <span style={{ color: 'rgba(255,255,255,0.2)' }}>○</span>}
                  </div>
                  <div>
                    <p className="font-sans text-sm" style={{
                      color: achieved ? '#ffffff' : isNext ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)',
                      fontWeight: achieved || isNext ? 600 : 400,
                    }}>
                      {m.label} streak
                    </p>
                    {achieved && (
                      <p style={{ fontSize: 10, color: m.color, marginTop: 1 }}>Achieved ✓</p>
                    )}
                    {isNext && !achieved && (
                      <p style={{ fontSize: 10, color: m.color, opacity: 0.75, marginTop: 1 }}>
                        {daysToNext} day{daysToNext !== 1 ? 's' : ''} to go
                      </p>
                    )}
                  </div>
                </div>
                <p className="font-display font-bold text-sm" style={{
                  color: achieved ? m.color : isNext ? m.color : 'rgba(255,255,255,0.18)',
                }}>
                  +{m.xp} XP
                </p>
              </div>
            );
          })}
          <div style={{ padding: '10px 16px', background: 'rgba(249,115,22,0.05)', borderTop: '1px solid rgba(249,115,22,0.12)' }}>
            <p className="font-sans text-xs" style={{ color: 'rgba(249,115,22,0.7)' }}>
              💡 Bonus XP is awarded automatically when you hit a milestone
            </p>
          </div>
        </div>

      </div>

      {/* ── STICKY CTA ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        padding: '10px 16px 24px',
        background: 'linear-gradient(to top, #0f172a 65%, transparent)',
      }}>
        <button
          onPointerDown={() => setBtnPress(true)}
          onPointerUp={() => setBtnPress(false)}
          onPointerLeave={() => setBtnPress(false)}
          onClick={() => router.push('/quiz?mode=daily')}
          style={{
            display: 'block', width: '100%', maxWidth: 430, margin: '0 auto',
            padding: '17px 0', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
            color: '#ffffff',
            background: playedToday
              ? 'linear-gradient(180deg,#22C55E 0%,#16A34A 100%)'
              : 'linear-gradient(180deg,#FF8A1F 0%,#FF5A00 100%)',
            boxShadow: btnPress
              ? (playedToday ? '0 2px 0 #065F46, 0 6px 14px rgba(34,197,94,0.22)' : '0 2px 0 #B73E00, 0 6px 14px rgba(255,90,0,0.22)')
              : (playedToday ? '0 6px 0 #0F7A35, 0 14px 28px rgba(34,197,94,0.28)' : '0 6px 0 #B73E00, 0 14px 28px rgba(255,90,0,0.30)'),
            transform: btnPress ? 'translateY(4px)' : 'translateY(0)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        >
          {playedToday ? 'Practice More →' : '🔥 Play Now — Protect Your Streak'}
        </button>
      </div>
    </>
  );
}
