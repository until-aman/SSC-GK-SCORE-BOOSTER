import { useMemo } from 'react';
import MentorMessage from '@/components/MentorMessage';
import MentorTaskCard from '@/components/MentorTaskCard';
import { MENTOR_COPY } from '@/lib/mentorCopy';

function duplicateKey(task) {
  const subject = String(task.subject || '').replace(/^Q_PYQ_/, '').trim().toLowerCase();
  const topic = String(task.topic || task.displayName || '').trim().toLowerCase();
  return `${subject}|${topic}`;
}

function sequencePurpose(task, occurrence) {
  switch (task.taskType) {
    case 'practice_task': return `Practice Set ${occurrence}`;
    case 'revision_task': return occurrence > 1 ? `Revision Round ${occurrence}` : 'Revision Round';
    case 'mistake_recovery_task': return 'Mistake Recovery';
    default: return null;
  }
}

function decorateDuplicates(tasks) {
  const totals = {};
  tasks.forEach(task => {
    const key = duplicateKey(task);
    totals[key] = (totals[key] || 0) + 1;
  });
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
  onViewAll,
}) {
  const active = useMemo(() => activeTasks || (plan?.tasks || []).filter(task => task.status === 'active'), [activeTasks, plan]);
  const completed = useMemo(() => completedTasks || (plan?.tasks || []).filter(task => task.status === 'completed'), [completedTasks, plan]);
  const deferred = useMemo(() => deferredTasks || (plan?.tasks || []).filter(task => task.status === 'snoozed'), [deferredTasks, plan]);
  const blocked = useMemo(() => (plan?.tasks || []).filter(task => task.status === 'blocked'), [plan]);
  const pending = useMemo(() => (plan?.tasks || []).filter(task => task.status === 'pending'), [plan]);
  const decoratedActive = useMemo(() => decorateDuplicates(active).slice(0, 3), [active]);
  const total = progress?.total ?? (active.length + completed.length + deferred.length);
  const done = progress?.completed ?? completed.length;
  const percent = progress?.percent ?? (total ? Math.round((done / total) * 100) : 0);
  const activeNow = active.length;
  const lockedLater = blocked.length + deferred.length + pending.length;
  const dayNumber = plan?.dayNumber || 1;
  const daysTotal = plan?.daysTotal || 45;

  if (!active.length && !completed.length && !deferred.length && !blocked.length) {
    return <MentorMessage message={MENTOR_COPY.NO_TASKS_TODAY} variant="success" />;
  }

  return (
    <div className="space-y-3">
      <section className="rounded-[20px] border border-ssc-border-soft bg-white px-4 py-3 shadow-[var(--ssc-shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-base font-black text-ssc-text-primary">Today&apos;s Plan</p>
            <p className="mt-1 text-xs font-bold text-ssc-text-secondary">{done}/{Math.max(total, 1)} tasks completed</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-ssc-teal">{percent}%</p>
            <p className="mt-1 rounded-full border border-[#DDE8F0] bg-[#F8FEFD] px-2 py-0.5 text-[10px] font-bold text-ssc-text-secondary">
              Day {dayNumber} of {daysTotal}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF3F7]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0EA5A4] to-[#2DD4BF] transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold text-ssc-text-muted">
          <span>{activeNow} active now</span>
          {lockedLater > 0 ? <span>{lockedLater} locked/later</span> : null}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-black text-ssc-text-primary">Today&apos;s Tasks</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#BDEDEA] bg-[#E8F8F6] px-2.5 py-1 text-xs font-black text-ssc-teal">
            {active.length}
          </span>
          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-full border border-[#BDEDEA] bg-white px-3 py-1 text-xs font-black text-ssc-teal active:scale-[0.98]"
            >
              View all
            </button>
          ) : null}
        </div>
      </div>

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

      {!active.length && deferred.length ? (
        <MentorMessage message="Task later ke liye save ho gaya hai. View all ke Later filter se resume kar sakte hain." variant="info" />
      ) : null}

      {!active.length && completed.length && !deferred.length ? (
        <section className="rounded-[20px] border border-[#BDEDD8] bg-[#E7FAF3] p-4 shadow-[var(--ssc-shadow-card)]">
          <p className="font-display text-base font-black text-ssc-text-primary">Aaj ka plan complete ho gaya.</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-ssc-text-secondary">Aap chahein toh next step unlock kar sakte hain.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-[#0EA5A4] py-3 text-sm font-black text-white" onClick={onShowNextDay}>
              Show Next Day
            </button>
            <button type="button" className="rounded-xl border border-[#DDE8F0] bg-white py-3 text-sm font-bold text-ssc-text-secondary">
              Kal continue karenge
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
