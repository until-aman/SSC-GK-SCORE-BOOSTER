import { useMemo, useState } from 'react';
import MentorMessage from '@/components/MentorMessage';
import MentorTaskCard from '@/components/MentorTaskCard';
import { MENTOR_COPY } from '@/lib/mentorCopy';

export default function TodaysPlanCard({
  plan,
  activeTasks,
  completedTasks,
  deferredTasks,
  progress,
  busyTaskId,
  onPrimary,
  onLater,
  onShowNextDay,
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const active = useMemo(() => activeTasks || (plan?.tasks || []).filter(task => task.status === 'active').slice(0, 3), [activeTasks, plan]);
  const completed = useMemo(() => completedTasks || (plan?.tasks || []).filter(task => task.status === 'completed'), [completedTasks, plan]);
  const deferred = useMemo(() => deferredTasks || (plan?.tasks || []).filter(task => task.status === 'snoozed'), [deferredTasks, plan]);
  const trayTasks = [...completed, ...deferred];
  const total = progress?.total ?? (active.length + completed.length + deferred.length);
  const done = progress?.completed ?? completed.length;
  const percent = progress?.percent ?? (total ? Math.round((done / total) * 100) : 0);

  if (!active.length && !trayTasks.length) {
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
      </section>

      {active.map((task, index) => (
        <MentorTaskCard
          key={task.taskId}
          task={task}
          index={index}
          busy={busyTaskId === task.taskId}
          onPrimary={onPrimary}
          onLater={onLater}
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
          >
            <span className="font-display text-sm font-black text-slate-100">Completed / Later</span>
            <span className="text-xs font-bold text-slate-500">{trayTasks.length} tasks</span>
          </button>
          {trayOpen ? (
            <div className="space-y-2 px-3 pb-3">
              {trayTasks.map((task, index) => (
                <MentorTaskCard key={task.taskId} task={task} index={index} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
