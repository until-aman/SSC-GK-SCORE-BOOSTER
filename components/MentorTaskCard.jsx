import { TeacherMentorIcon } from '@/components/MentorMessage';

const TASK_TYPE_LABELS = {
  coverage_check: 'Coverage',
  confidence_check: 'Confidence',
  theory_task: 'Theory',
  practice_task: 'Practice',
  revision_task: 'Revision',
  mistake_recovery_task: 'Practice',
  feedback_task: 'Feedback',
  pace_unlock_task: 'Unlock',
};

const TASK_THEME = {
  revision_task: {
    label: 'Revision',
    icon: '↻',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  practice_task: {
    label: 'Practice',
    icon: '◎',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  mistake_recovery_task: {
    label: 'Practice',
    icon: '◎',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  confidence_check: {
    label: 'Quiz',
    icon: 'P',
    chip: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D5DF6]',
    iconChip: 'bg-[#F5F3FF] text-[#6D5DF6] border-[#DDD6FE]',
    card: 'border-[#DDD6FE]',
    button: 'bg-white text-[#0EA5A4] border border-[#0EA5A4]',
  },
  coverage_check: {
    label: 'Coverage',
    icon: '✓',
    chip: 'border-[#BDEDEA] bg-[#E8F8F6] text-[#0EA5A4]',
    iconChip: 'bg-[#E8F8F6] text-[#0EA5A4] border-[#BDEDEA]',
    card: 'border-[#BDEDEA]',
    button: 'bg-white text-[#0EA5A4] border border-[#0EA5A4]',
  },
  feedback_task: {
    label: 'Feedback',
    icon: '!',
    chip: 'border-[#FBCACA] bg-[#FEECEC] text-[#DC2626]',
    iconChip: 'bg-[#FEECEC] text-[#DC2626] border-[#FBCACA]',
    card: 'border-[#FBCACA]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
};

function getTaskTypeLabel(type) {
  return TASK_TYPE_LABELS[type] || 'Practice';
}

function getTheme(task) {
  return TASK_THEME[task.taskType] || TASK_THEME.practice_task;
}

function getTaskTitle(task) {
  if (task.title) return task.title;
  if (task.taskType === 'mistake_recovery_task') return 'Repeated Mistakes';
  return task.displayName || task.subjectName || 'Mentor Task';
}

function getMeta(task) {
  return [
    task.estimatedMinutes ? `${task.estimatedMinutes} min` : null,
    task.questionCount ? `${task.questionCount} Qs` : null,
    task.subject || task.subjectName || null,
  ].filter(Boolean);
}

function getPurpose(task) {
  return task.whyThisText || task.topic || task.mentorMessage || 'Focus task for today';
}

function StatusPill({ task }) {
  if (task.status === 'completed') {
    return <span className="rounded-full border border-[#BDEDD8] bg-[#E7FAF3] px-2 py-0.5 text-[10px] font-black text-[#0F9F75]">Completed</span>;
  }
  if (task.status === 'snoozed') {
    return <span className="rounded-full border border-[#F8D9A0] bg-[#FFF7E6] px-2 py-0.5 text-[10px] font-black text-[#B45309]">Later</span>;
  }
  if (task.status === 'blocked') {
    return <span className="rounded-full border border-[#DDE8F0] bg-[#EEF3F7] px-2 py-0.5 text-[10px] font-black text-[#8A98AA]">Locked</span>;
  }
  if (task.reason === 'recent_mistakes' || task.taskType === 'feedback_task') {
    return <span className="rounded-full border border-[#FBCACA] bg-[#FEECEC] px-2 py-0.5 text-[10px] font-black text-[#DC2626]">Weak</span>;
  }
  if (task.taskType === 'revision_task') {
    return <span className="rounded-full border border-[#F8D9A0] bg-[#FFF7E6] px-2 py-0.5 text-[10px] font-black text-[#B45309]">Medium</span>;
  }
  return <span className="rounded-full border border-[#BDEDD8] bg-[#E7FAF3] px-2 py-0.5 text-[10px] font-black text-[#0F9F75]">Good</span>;
}

export default function MentorTaskCard({ task, index = 0, busy, onPrimary, onDone, onLater, showManualDone = false }) {
  const isCompleted = task.status === 'completed';
  const isSnoozed = task.status === 'snoozed';
  const isBlocked = task.status === 'blocked';
  const inactive = isCompleted || isSnoozed;
  const theme = getTheme(task);
  const taskNumber = Number(task.taskNumber || task.sequenceNumber || index + 1);
  const meta = getMeta(task);

  return (
    <article className={`rounded-[18px] border bg-white p-3.5 shadow-[var(--ssc-shadow-card)] ${isBlocked ? 'border-[#DDE8F0] opacity-80' : theme.card}`}>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${isCompleted ? 'border-[#BDEDD8] bg-[#E7FAF3] text-[#0F9F75]' : isSnoozed || isBlocked ? 'border-[#DDE8F0] bg-[#EEF3F7] text-[#8A98AA]' : theme.iconChip}`}>
            {isCompleted ? '✓' : isBlocked ? '⌕' : theme.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${theme.chip}`}>
                {task.sequenceLabel || getTaskTypeLabel(task.taskType)}
              </span>
              <StatusPill task={task} />
            </div>
            <p className="mt-1 text-[11px] font-bold text-ssc-text-muted">Task {taskNumber}</p>
          </div>
        </div>
      </div>

      <h3 className={`font-display text-[16px] font-black leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-primary'}`}>
        {getTaskTitle(task)}
      </h3>
      <p className={`mt-1 text-xs font-semibold leading-relaxed ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-secondary'}`}>
        {getPurpose(task)}
      </p>

      {meta.length ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-ssc-text-secondary">
          {meta.map(item => (
            <span key={item} className="rounded-full border border-[#DDE8F0] bg-[#F8FEFD] px-2 py-0.5">{item}</span>
          ))}
        </div>
      ) : null}

      {task.duplicateNote ? (
        <p className="mt-2 text-xs font-bold text-[#B45309]">{task.duplicateNote}</p>
      ) : null}

      {task.mentorMessage && task.mentorMessage !== getPurpose(task) ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[#BDEDEA] bg-[#F2FCFA] p-2.5">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white">
            <TeacherMentorIcon className="h-5 w-5" />
          </span>
          <p className="text-xs font-semibold leading-relaxed text-ssc-text-secondary">{task.mentorMessage}</p>
        </div>
      ) : null}

      {isBlocked ? (
        <div className="mt-3 space-y-1.5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full cursor-not-allowed rounded-2xl border border-[#DDE8F0] bg-[#EEF3F7] py-3 text-sm font-black text-ssc-disabled-text"
          >
            {task.ctaLabel || 'Practice Questions'} →
          </button>
          <p className="text-center text-[11px] font-bold text-ssc-text-muted">
            {task.blockedReason || 'Complete the previous step first.'}
          </p>
        </div>
      ) : !inactive ? (
        <div className="mt-3 space-y-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPrimary?.(task)}
            className={`w-full rounded-2xl py-3 text-sm font-black active:scale-[0.98] disabled:opacity-60 ${theme.button}`}
          >
            {busy ? 'Saving...' : `${task.ctaLabel || 'Practice Questions'} →`}
          </button>
          {showManualDone ? (
            <>
              <p className="text-center text-[11px] font-bold text-ssc-text-muted">
                Task sync nahi hua? Already completed mark kar sakte hain.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDone?.(task)}
                className="w-full rounded-xl border border-[#0EA5A4] bg-white py-2 text-xs font-black text-[#0EA5A4] active:scale-[0.98] disabled:opacity-60"
              >
                ✓ Mark as Done
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onLater?.(task)}
            className="w-full py-1.5 text-xs font-bold text-ssc-text-muted active:opacity-70 disabled:opacity-50"
          >
            {task.secondaryAction || 'Maybe later'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-bold text-ssc-text-muted">{isCompleted ? 'Completed' : 'Saved for later'}</p>
      )}
    </article>
  );
}
