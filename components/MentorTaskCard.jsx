import { useState } from 'react';
import { useRouter } from 'next/router';
import { TeacherMentorIcon } from '@/components/MentorMessage';

const TASK_TYPE_LABELS = {
  MISTAKE_REVISION: 'Mistake Revision',
  PRACTICE_TASK: 'Practice Task',
  QUICK_REVISION: 'Quick Revision',
  THEORY_TASK: 'Theory Task',
  DAILY_CHALLENGE: 'Daily Challenge',
  SAVED_REVISION: 'Saved Revision',
};

function getTaskTypeLabel(taskType) {
  if (!taskType) return 'Practice Task';
  return TASK_TYPE_LABELS[taskType] || String(taskType)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getTaskTitle(task) {
  return task.taskType === 'MISTAKE_REVISION'
    ? 'Repeated Mistakes'
    : (task.subjectName || task.displayName || 'Practice Task');
}

function getTaskMeta(task) {
  return [
    task.displayName,
    task.questionCount ? `${task.questionCount} questions` : null,
  ].filter(Boolean).join(' · ');
}

function getCtaLabel(label) {
  if (!label) return 'Start Practice →';
  return label.endsWith('→') ? label : `${label} →`;
}

export default function MentorTaskCard({ task, onDoneChange }) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const handleAction = () => {
    if (task.ctaRoute) {
      router.push(task.ctaRoute);
      return;
    }
    setDone(true);
    onDoneChange?.(task.taskId, true);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-800 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-400">
          {getTaskTypeLabel(task.taskType)}
        </span>
        {task.estimatedMinutes ? (
          <span className="text-xs font-medium text-slate-400">~{task.estimatedMinutes} min</span>
        ) : null}
      </div>

      <p className="text-base font-bold text-slate-100">{getTaskTitle(task)}</p>
      {getTaskMeta(task) ? (
        <p className="mt-1 text-sm text-slate-400">{getTaskMeta(task)}</p>
      ) : null}

      {task.mentorMessage ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.05] bg-slate-900/45 p-3">
          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
            <TeacherMentorIcon className="h-4 w-4" />
          </span>
          <p className="text-xs leading-relaxed text-slate-300">{task.mentorMessage}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAction}
        className={`mt-4 w-full rounded-2xl py-3 text-sm font-semibold transition-colors ${
          done
            ? 'border border-teal-500/25 bg-teal-500/10 text-teal-300'
            : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
        }`}
      >
        {done ? 'Done' : getCtaLabel(task.ctaLabel)}
      </button>
    </div>
  );
}
