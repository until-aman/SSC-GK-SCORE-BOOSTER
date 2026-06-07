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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{task.displayName}</p>
          <p className="mt-1 text-xs text-slate-400">
            {task.subjectName}
            {task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ''}
            {task.questionCount ? ` · ${task.questionCount} questions` : ''}
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">
          #{task.priority}
        </span>
      </div>
      {task.mentorMessage ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{task.mentorMessage}</p>
      ) : null}
      <button
        type="button"
        onClick={handleAction}
        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
          done ? 'bg-green-500/15 text-green-200' : 'bg-teal-600 text-white hover:bg-teal-500'
        }`}
      >
        {done ? 'Done' : task.ctaLabel}
      </button>
    </div>
  );
}
