import MentorTaskCard from '@/components/MentorTaskCard';
import MentorMessage from '@/components/MentorMessage';
import { MENTOR_COPY } from '@/lib/mentorCopy';
import { useEffect, useMemo, useState } from 'react';

export default function TodaysPlanCard({ plan }) {
  const tasks = useMemo(() => plan?.tasks || [], [plan]);
  const [completedTaskIds, setCompletedTaskIds] = useState(() => new Set());
  const totalTasks = tasks.length;
  const completedTasks = completedTaskIds.size;
  const progressPercent = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

  const taskKeys = useMemo(() => tasks.map(task => task.taskId).join('|'), [tasks]);

  useEffect(() => {
    setCompletedTaskIds(prev => {
      const validIds = new Set(taskKeys ? taskKeys.split('|') : []);
      const next = new Set([...prev].filter(taskId => validIds.has(taskId)));
      return next.size === prev.size ? prev : next;
    });
  }, [taskKeys]);

  const handleDoneChange = (taskId, isDone) => {
    setCompletedTaskIds(prev => {
      const next = new Set(prev);
      if (isDone) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  if (!tasks.length) {
    return <MentorMessage message={MENTOR_COPY.NO_TASKS_TODAY} variant="success" />;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.06] bg-slate-800/60 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-300">
            {completedTasks}/{totalTasks} tasks completed
          </span>
          <span className="text-slate-500">{Math.round(progressPercent)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-teal-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      {tasks.map(task => (
        <MentorTaskCard key={task.taskId} task={task} onDoneChange={handleDoneChange} />
      ))}
    </div>
  );
}
