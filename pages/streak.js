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
  { days: 90, xp: 500, label: '3-month', color: '#14B8A6', floor: '#0D4F47' },
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

  const playedSet    = new Set();
  const milestoneSet = new Set();
  if (lastAttemptDate && streakCount > 0) {
    const last = new Date(lastAttemptDate + 'T00:00:00+05:30');
    for (let i = 0; i < streakCount; i++) {
      const d = new Date(last);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      playedSet.add(iso);
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
  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [calView, setCalView]         = useState('week');
  const [monthOffset, setMonthOffset] = useState(0);
  const [btnPress, setBtnPress]       = useState(false);

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
      <div className="min-h-screen [background:var(--bg-app)] px-4 pt-10">
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

  const nextMs       = MILESTONES.find(m => m.days > streakCount) || null;
  const prevMs       = [...MILESTONES].reverse().find(m => m.days <= streakCount) || null;
  const daysToNext   = nextMs ? nextMs.days - streakCount : 0;
  const progressBase = prevMs ? prevMs.days : 0;
  const progressEnd  = nextMs ? nextMs.days : streakCount || 1;
  const progress     = nextMs ? Math.max(4, ((streakCount - progressBase) / (progressEnd - progressBase)) * 100) : 100;

  const achievedMs   = MILESTONES.filter(m => m.days <= streakCount);
  const upcomingMs   = MILESTONES.filter(m => m.days > streakCount).slice(1);

  const today      = new Date();
  const viewDate   = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthCells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth(), streakCount, lastAttemptDate);
  const canGoNext  = monthOffset < 0;

  return (
    <>
      <Head><title>Streak History — SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes streakPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.45); }
          50%      { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
        }
        .streak-fire { animation: streakPulse 2s ease-in-out infinite; }
        @keyframes progFill { from { width: 4%; } }
        .prog-bar { animation: progFill 0.8s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="min-h-screen [background:var(--bg-app)]" style={{ paddingBottom: 100 }}>

        {/* ── HEADER ── */}
        <div className="px-4 pt-10 pb-3 flex items-center gap-3">
          <BackButton />
          <h1 className="font-display font-black text-xl text-white">Streak History</h1>
        </div>

        {/* ── HERO CARD — navy base, orange accent ── */}
        <div className="mx-4" style={{
          background: '#111C2E',
          border: '1px solid rgba(249,115,22,0.22)',
          borderRadius: 24,
          padding: '20px 20px 20px',
          boxShadow: '0 0 32px rgba(249,115,22,0.07)',
        }}>
          {/* Icon + label + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              className={playedToday ? 'streak-fire' : ''}
              style={{
                width: 58, height: 58, borderRadius: 18, fontSize: 28, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: playedToday
                  ? 'linear-gradient(145deg,#f97316,#ea580c)'
                  : 'rgba(249,115,22,0.10)',
                border: playedToday ? 'none' : '1px solid rgba(249,115,22,0.22)',
              }}
            >🔥</div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                Current Streak
              </p>
              <p className="font-display font-black text-white leading-none" style={{ fontSize: 40 }}>
                {streakCount}{' '}
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fdba74' }}>days</span>
              </p>
            </div>
          </div>

          {/* Status + best streak pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '5px 12px',
              background: playedToday ? 'rgba(20,184,166,0.12)' : 'rgba(249,115,22,0.10)',
              border: playedToday ? '1px solid rgba(20,184,166,0.26)' : '1px solid rgba(249,115,22,0.24)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: playedToday ? '#14B8A6' : '#fb923c' }}>
                {playedToday ? '✓ Protected today' : '⚡ At risk — play now!'}
              </span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '5px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.42)' }}>
                🏆 Best: {profile?.bestStreak || streakCount} days
              </span>
            </div>
          </div>

          {/* Motivational line */}
          {nextMs && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', marginTop: 10, lineHeight: 1.55 }}>
              {playedToday
                ? `Practice tomorrow to make it ${streakCount + 1} days and unlock +${nextMs.xp} XP.`
                : `Play today to protect your ${streakCount}-day streak and stay on track for +${nextMs.xp} XP.`
              }
            </p>
          )}

          {/* Progress bar to next milestone */}
          {nextMs && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                  Next: <span style={{ color: nextMs.color, fontWeight: 700 }}>{nextMs.label} streak</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: nextMs.color }}>
                  {daysToNext} day{daysToNext !== 1 ? 's' : ''} away · +{nextMs.xp} XP
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div
                  className="prog-bar"
                  style={{
                    height: '100%', borderRadius: 6, width: `${progress}%`,
                    background: `linear-gradient(90deg, ${nextMs.color}, ${nextMs.color}cc)`,
                    boxShadow: `0 0 10px ${nextMs.color}55`,
                  }}
                />
              </div>
            </div>
          )}
          {!nextMs && (
            <p className="font-display font-bold text-sm text-center mt-4" style={{ color: '#14B8A6' }}>
              🏆 All milestones unlocked! Legend status.
            </p>
          )}
        </div>

        {/* ── ACTIVITY CARD ── */}
        <div className="mx-4 mt-4" style={{
          background: '#111C2E',
          border: '1px solid rgba(148,163,184,0.09)',
          borderRadius: 22, overflow: 'hidden',
        }}>
          {/* Header with indigo-pill toggle */}
          <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="font-display font-bold text-base text-white">Activity</p>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 3, gap: 2 }}>
              {['week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  style={{
                    padding: '4px 14px', borderRadius: 16, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'capitalize',
                    border: calView === v ? '1px solid rgba(99,102,241,0.38)' : '1px solid transparent',
                    background: calView === v ? 'rgba(79,70,229,0.28)' : 'transparent',
                    color: calView === v ? '#ffffff' : 'rgba(255,255,255,0.32)',
                    transition: 'all 0.18s ease',
                  }}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* ── WEEK VIEW ── */}
          {calView === 'week' && (
            <div style={{ padding: '14px 16px 18px' }}>
              {/* This Week subheader */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>This Week</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span className="font-display font-black text-white" style={{ fontSize: 24 }}>{done.size}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>/ 7 active days</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: playedToday ? '#14B8A6' : '#fb923c', marginBottom: 2 }}>
                  {playedToday ? '✓ Protected' : '⚡ Play today'}
                </span>
              </div>

              {/* Day circles */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {DAY_LABELS.map((day, i) => {
                  const isDone      = done.has(i);
                  const isToday     = i === todayIdx;
                  const isTodayDone = isToday && playedToday;
                  const isTodayTodo = isToday && !playedToday;
                  const isMissed    = i < todayIdx && !isDone;

                  return (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        fontSize: 11, fontWeight: isToday ? 700 : 400,
                        color: isToday ? '#f97316' : 'rgba(255,255,255,0.28)',
                      }}>{day}</span>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: (isDone || isTodayDone)
                          ? 'linear-gradient(145deg,#f97316,#ea580c)'
                          : 'transparent',
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

              {/* Next reward footer */}
              {nextMs && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 14, textAlign: 'center' }}>
                  Next reward in{' '}
                  <span style={{ color: nextMs.color, fontWeight: 700 }}>
                    {daysToNext} active day{daysToNext !== 1 ? 's' : ''}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* ── MONTH VIEW — compact date cells ── */}
          {calView === 'month' && (
            <div style={{ padding: '12px 14px 18px' }}>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
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

              {/* Day letter headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 3 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{d}</div>
                ))}
              </div>

              {/* Compact date cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={`e${idx}`} />;

                  const isActive = cell.played && !cell.isFuture;
                  const cellBg = isActive
                    ? (cell.isToday ? 'rgba(249,115,22,0.26)' : 'rgba(249,115,22,0.16)')
                    : cell.isToday ? 'rgba(249,115,22,0.10)'
                    : 'transparent';
                  const cellBorder = cell.isToday
                    ? '1px solid rgba(249,115,22,0.45)'
                    : (isActive && cell.isMilestone) ? '1px solid rgba(251,191,36,0.45)'
                    : '1px solid transparent';
                  const numColor = isActive
                    ? (cell.isToday ? '#ffffff' : '#fdba74')
                    : cell.isToday ? '#f97316'
                    : cell.isFuture ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.26)';

                  return (
                    <div
                      key={cell.dateStr}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '5px 2px 4px',
                        background: cellBg,
                        border: cellBorder,
                        borderRadius: 7,
                        opacity: cell.isFuture ? 0.45 : 1,
                      }}
                    >
                      <span style={{
                        fontSize: 11, lineHeight: 1,
                        fontWeight: (isActive || cell.isToday) ? 700 : 400,
                        color: numColor,
                      }}>
                        {cell.day}
                      </span>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%', marginTop: 3,
                        background: isActive ? '#f97316' : 'transparent',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── MILESTONE SECTION ── */}
        <div className="mx-4 mt-4" style={{
          background: '#111C2E',
          border: '1px solid rgba(148,163,184,0.09)',
          borderRadius: 20, overflow: 'hidden',
        }}>
          {/* Next milestone — prominent */}
          {nextMs && (
            <div style={{
              padding: '16px 18px 18px',
              background: `linear-gradient(135deg, ${nextMs.color}0D 0%, transparent 100%)`,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Next Milestone
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-display font-black text-white" style={{ fontSize: 20, marginBottom: 5 }}>
                    {nextMs.label} streak
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    {daysToNext} more active day{daysToNext !== 1 ? 's' : ''} to unlock{' '}
                    <span style={{ color: nextMs.color, fontWeight: 700 }}>+{nextMs.xp} XP</span>
                  </p>
                </div>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: `${nextMs.color}18`,
                  border: `1px solid ${nextMs.color}35`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <p className="font-display font-black" style={{ fontSize: 16, color: nextMs.color, lineHeight: 1 }}>
                    +{nextMs.xp}
                  </p>
                  <p style={{ fontSize: 9, color: nextMs.color, opacity: 0.7, marginTop: 1 }}>XP</p>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming rewards */}
          {upcomingMs.length > 0 && (
            <>
              <div style={{ padding: '10px 18px 5px' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Upcoming Rewards
                </p>
              </div>
              {upcomingMs.map(m => (
                <div key={m.days} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 18px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', fontWeight: 400 }}>{m.label} streak</span>
                  </div>
                  <span className="font-display font-bold" style={{ fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>+{m.xp} XP</span>
                </div>
              ))}
            </>
          )}

          {/* Achieved milestones */}
          {achievedMs.length > 0 && (
            <>
              <div style={{ padding: '10px 18px 5px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Achieved
                </p>
              </div>
              {achievedMs.map(m => (
                <div key={m.days} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 18px',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: m.color, fontSize: 12, lineHeight: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{m.label} streak</span>
                  </div>
                  <span className="font-display font-bold" style={{ fontSize: 13, color: m.color }}>+{m.xp} XP</span>
                </div>
              ))}
            </>
          )}

          {!nextMs && (
            <div style={{ padding: '18px', textAlign: 'center' }}>
              <p className="font-display font-bold text-sm" style={{ color: '#14B8A6' }}>
                🏆 All milestones unlocked! Legend status.
              </p>
            </div>
          )}

          <div style={{ padding: '9px 16px', background: 'rgba(249,115,22,0.05)', borderTop: '1px solid rgba(249,115,22,0.10)' }}>
            <p style={{ fontSize: 11, color: 'rgba(249,115,22,0.58)' }}>
              💡 Bonus XP is awarded automatically when you hit a milestone
            </p>
          </div>
        </div>

      </div>

      {/* ── STICKY CTA — always orange ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        padding: '10px 16px 24px',
        background: 'linear-gradient(to top, var(--bg-app) 65%, transparent)',
      }}>
        <button
          onPointerDown={() => setBtnPress(true)}
          onPointerUp={() => setBtnPress(false)}
          onPointerLeave={() => setBtnPress(false)}
          onClick={() => router.push('/quiz?mode=daily')}
          style={{
            display: 'block', width: '100%', maxWidth: 430, margin: '0 auto',
            padding: '17px 0', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800, color: '#ffffff',
            background: 'linear-gradient(180deg,#FF8A1F 0%,#FF5A00 100%)',
            boxShadow: btnPress
              ? '0 2px 0 #B73E00, 0 6px 14px rgba(255,90,0,0.22)'
              : '0 6px 0 #B73E00, 0 14px 28px rgba(255,90,0,0.30)',
            transform: btnPress ? 'translateY(4px)' : 'translateY(0)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
        >
          {playedToday ? 'Practice More →' : 'Protect Today\'s Streak →'}
        </button>
      </div>
    </>
  );
}
