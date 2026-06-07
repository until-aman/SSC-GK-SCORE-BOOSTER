import { useState } from 'react';
import { useRouter } from 'next/router';

export default function MentorTaskCard({ task }) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const handleAction = () => {
    if (task.ctaRoute) {
      router.push(task.ctaRoute);
      return;
    }
    setDone(true);
  };

  const hasPrimaryAction = Boolean(task.ctaRoute);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-800 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-orange-400">
          {task.taskType || `Task ${task.priority}`}
        </span>
        {task.estimatedMinutes ? (
          <span className="text-xs text-slate-400">~{task.estimatedMinutes} min</span>
        ) : null}
      </div>
      <p className="text-base font-bold text-slate-100 mb-1">{task.subjectName}</p>
      <p className="text-sm text-slate-400 mb-3">
        {task.displayName}
        {task.questionCount ? ` · ${task.questionCount} questions` : ''}
      </p>
      {task.mentorMessage ? (
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">{task.mentorMessage}</p>
      ) : null}
      <button
        type="button"
        onClick={handleAction}
        className={`w-full rounded-2xl py-3 text-sm font-semibold transition-colors ${
          done || !hasPrimaryAction
            ? 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
        }`}
      >
        {done ? 'Done' : task.ctaLabel}
      </button>
    </div>
  );
}
