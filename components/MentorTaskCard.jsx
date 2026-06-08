import { TeacherMentorIcon } from '@/components/MentorMessage';

const TASK_TYPE_LABELS = {
  coverage_check: 'Coverage Check',
  confidence_check: 'Confidence Check',
  theory_task: 'Theory Task',
  practice_task: 'Practice Task',
  revision_task: 'Revision Task',
  mistake_recovery_task: 'Mistake Recovery',
  feedback_task: 'Feedback',
  pace_unlock_task: 'Pace Unlock',
};

function getTaskTypeLabel(type) {
  return TASK_TYPE_LABELS[type] || 'Practice Task';
}

function getTaskTitle(task) {
  if (task.title) return task.title;
  if (task.taskType === 'mistake_recovery_task') return 'Repeated Mistakes';
  return task.displayName || task.subjectName || 'Mentor Task';
}

function getMeta(task) {
  return [
    task.topic,
    task.questionCount ? `${task.questionCount} questions` : null,
    task.whyThisText && task.taskType === 'mistake_recovery_task' ? task.whyThisText : null,
  ].filter(Boolean).join(' · ');
}

export default function MentorTaskCard({ task, index = 0, busy, onPrimary, onLater }) {
  const isCompleted = task.status === 'completed';
  const isSnoozed = task.status === 'snoozed';
  const inactive = isCompleted || isSnoozed;

  return (
    <article className={`rounded-2xl border p-4 ${inactive ? 'border-white/[0.05] bg-[#172d47]/60' : 'border-white/[0.08] bg-[#172d47]'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${
            isCompleted ? 'border-teal-400/40 bg-teal-400/15 text-teal-300' : isSnoozed ? 'border-slate-500/30 bg-slate-500/10 text-slate-400' : 'border-orange-500/40 bg-orange-500/15 text-orange-300'
          }`}>
            {isCompleted ? '✓' : index + 1}
          </span>
          <span className="text-[11px] font-black text-slate-400">
            Task {index + 1}
          </span>
          <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300">
            {getTaskTypeLabel(task.taskType)}
          </span>
        </div>
        {task.estimatedMinutes ? <span className="shrink-0 text-xs font-semibold text-slate-500">~{task.estimatedMinutes} min</span> : null}
      </div>

      <p className="font-display text-[17px] font-black leading-snug text-slate-50">{getTaskTitle(task)}</p>
      {getMeta(task) ? <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-400">{getMeta(task)}</p> : null}

      {task.mentorMessage ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-[#112236]/70 p-3">
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/15">
            <TeacherMentorIcon className="h-4 w-4" />
          </span>
          <p className="text-xs font-semibold leading-relaxed text-slate-300">{task.mentorMessage}</p>
        </div>
      ) : null}

      {!inactive ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPrimary?.(task)}
            className="w-full rounded-2xl bg-gradient-to-r from-[#ff7a1a] to-[#ff4d00] py-3 text-sm font-black text-white shadow-[0_10px_26px_rgba(255,90,0,.22)] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'Saving...' : `${task.ctaLabel || 'Practice Questions'} →`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onLater?.(task)}
            className="w-full py-1.5 text-xs font-bold text-slate-500 active:opacity-70 disabled:opacity-50"
          >
            {task.secondaryAction || 'Maybe later'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-bold text-slate-500">{isCompleted ? 'Completed' : 'Saved for later'}</p>
      )}
    </article>
  );
}
