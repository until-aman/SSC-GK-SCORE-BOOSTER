import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MentorMessage from '@/components/MentorMessage';
import MentorTaskCard from '@/components/MentorTaskCard';
import { MENTOR_COPY } from '@/lib/mentorCopy';

function trayTaskTitle(task) {
  return task.displayName || task.subjectName || task.topic || 'Mentor Task';
}

// Group active tasks by topic so same-topic cards don't look identical.
function duplicateKey(task) {
  const subject = String(task.subject || '').replace(/^Q_PYQ_/, '').trim().toLowerCase();
  const topic = String(task.topic || task.displayName || '').trim().toLowerCase();
  return `${subject}|${topic}`;
}

function sequencePurpose(task, occurrence) {
  switch (task.taskType) {
    case 'practice_task':         return `Practice Set ${occurrence}`;
    case 'revision_task':         return occurrence > 1 ? `Revision Round ${occurrence}` : 'Revision Round';
    case 'mistake_recovery_task': return 'Mistake Recovery';
    default:                      return null;
  }
}

// Adds sequenceLabel + duplicateNote to tasks that share a topic with another.
function decorateDuplicates(tasks) {
  const totals = {};
  tasks.forEach(task => { const key = duplicateKey(task); totals[key] = (totals[key] || 0) + 1; });
  const running = {};
  return tasks.map(task => {
    const key = duplicateKey(task);
    if ((totals[key] || 0) < 2) return task;
    const occurrence = (running[key] = (running[key] || 0) + 1);
    return {
      ...task,
      sequenceLabel: sequencePurpose(task, occurrence),
      duplicateNote: occurrence >= 2 ? `Set ${occurrence}: same topic, new questions` : '',
    };
  });
}

// Short date/time for the tray row — real timestamp when available, else task meta.
function trayTaskWhen(task) {
  const iso = task.completedAt || task.snoozedUntil || task.updatedAt || '';
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      const sameDay = date.toDateString() === new Date().toDateString();
      return sameDay
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }
  }
  const parts = [];
  if (task.questionCount) parts.push(`${task.questionCount} Q`);
  if (task.estimatedMinutes) parts.push(`~${task.estimatedMinutes} min`);
  return parts.join(' · ');
}

function Chevron({ open }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function TodaysPlanCard({
  plan,
  activeTasks,
  completedTasks,
  deferredTasks,
  progress,
  busyTaskId,
  manualDoneTaskIds,
  onPrimary,
  onDone,
  onLater,
  onShowNextDay,
}) {
  const router = useRouter();
  const [trayOpen, setTrayOpen] = useState(false);
  const active = useMemo(() => activeTasks || (plan?.tasks || []).filter(task => task.status === 'active').slice(0, 3), [activeTasks, plan]);
  const completed = useMemo(() => completedTasks || (plan?.tasks || []).filter(task => task.status === 'completed'), [completedTasks, plan]);
  const deferred = useMemo(() => deferredTasks || (plan?.tasks || []).filter(task => task.status === 'snoozed'), [deferredTasks, plan]);
  const blocked = useMemo(() => (plan?.tasks || []).filter(task => task.status === 'blocked'), [plan]);
  const decoratedActive = useMemo(() => decorateDuplicates(active), [active]);
  const trayTasks = [...completed, ...deferred];
  const pending = useMemo(() => (plan?.tasks || []).filter(task => task.status === 'pending'), [plan]);
  const total = progress?.total ?? (active.length + completed.length + deferred.length);
  const done = progress?.completed ?? completed.length;
  const percent = progress?.percent ?? (total ? Math.round((done / total) * 100) : 0);
  const activeNow = active.length;
  const lockedLater = blocked.length + deferred.length + pending.length;
  const dayNumber = plan?.dayNumber || 1;
  const daysTotal = plan?.daysTotal || 45;

  if (!active.length && !trayTasks.length && !blocked.length) {
    return <MentorMessage message={MENTOR_COPY.NO_TASKS_TODAY} variant="success" />;
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-white/[0.08] bg-[#172d47] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-slate-100">{done}/{Math.max(total, 1)} tasks completed</p>
          <p className="text-xs font-bold text-teal-300">{percent}%</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0d1b2e]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#14B8A6] to-[#2DD4BF] transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
          <span>Day {dayNumber} of {daysTotal}</span>
          {lockedLater > 0 ? <span>{activeNow} active now · {lockedLater} locked/later</span> : null}
        </div>
      </section>

      {decoratedActive.map((task, index) => (
        <MentorTaskCard
          key={task.taskId}
          task={task}
          index={index}
          busy={busyTaskId === task.taskId}
          showManualDone={manualDoneTaskIds?.has?.(task.taskId)}
          onPrimary={onPrimary}
          onDone={onDone}
          onLater={onLater}
        />
      ))}

      {/* Blocked tasks — surfaced only when present (next locked step) */}
      {blocked.map((task, index) => (
        <MentorTaskCard
          key={task.taskId}
          task={task}
          index={active.length + index}
        />
      ))}

      {!active.length && deferred.length ? (
        <MentorMessage message="Task later ke liye save kar diya gaya hai. Aap Completed / Later tray se ise dobara dekh sakte hain." variant="info" />
      ) : null}

      {!active.length && completed.length && !deferred.length ? (
        <section className="rounded-2xl border border-teal-400/20 bg-teal-400/10 p-4">
          <p className="font-display text-base font-black text-teal-200">Aaj ka plan complete ho gaya.</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">Aap chahein toh next step unlock kar sakte hain.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-teal-500 py-3 text-sm font-black text-slate-950" onClick={onShowNextDay}>
              Show Next Day
            </button>
            <button type="button" className="rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-sm font-bold text-slate-300">
              Kal continue karenge
            </button>
          </div>
        </section>
      ) : null}

      {trayTasks.length ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#112236]">
          <button
            type="button"
            onClick={() => setTrayOpen(value => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={trayOpen}
          >
            <span className="font-display text-sm font-black text-slate-100">Completed / Later</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Completed {completed.length} · Later {deferred.length}
              </span>
              <Chevron open={trayOpen} />
            </div>
          </button>
          {trayOpen ? (
            <div className="space-y-1.5 px-3 pb-3">
              {trayTasks.map(task => {
                const isCompleted = task.status === 'completed';
                const when = trayTaskWhen(task);
                return (
                  <div
                    key={task.taskId}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-[#0d1b2e] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-200">
                        <span className="text-slate-500">Task {Number(task.taskNumber || task.sequenceNumber || 0) || '–'} · </span>
                        {trayTaskTitle(task)}
                      </p>
                      {when ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{when}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${
                        isCompleted
                          ? 'border-teal-400/20 bg-teal-400/10 text-teal-300'
                          : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                      }`}
                    >
                      {isCompleted ? '✓ Completed' : 'Later'}
                    </span>
                    {!isCompleted && onPrimary ? (
                      <button
                        type="button"
                        onClick={() => onPrimary(task)}
                        className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300 active:opacity-70"
                      >
                        Resume
                      </button>
                    ) : isCompleted ? (
                      <button
                        type="button"
                        onClick={() => router.push('/history')}
                        className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300 active:opacity-70"
                      >
                        View
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
