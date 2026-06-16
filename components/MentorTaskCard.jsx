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
    icon: 'R',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  practice_task: {
    label: 'Practice',
    icon: 'P',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  mistake_recovery_task: {
    label: 'Practice',
    icon: 'P',
    chip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'bg-[#FFF7E6] text-[#EA580C] border-[#FDBA74]',
    card: 'border-[#F8D9A0]',
    button: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[0_10px_22px_rgba(255,106,0,0.22)]',
  },
  confidence_check: {
    label: 'Quiz',
    icon: 'Q',
    chip: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D5DF6]',
    iconChip: 'bg-[#F5F3FF] text-[#6D5DF6] border-[#DDD6FE]',
    card: 'border-[#DDD6FE]',
    button: 'bg-white text-[#0EA5A4] border border-[#0EA5A4]',
  },
  coverage_check: {
    label: 'Coverage',
    icon: 'C',
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
  const cta = task.ctaLabel || (task.taskType === 'revision_task' ? 'Revise' : task.taskType === 'confidence_check' ? 'Start Quiz' : 'Practice');

  return (
    <article className={`rounded-[18px] border bg-white p-3 shadow-[0_8px_20px_rgba(16,32,51,0.06)] ${isBlocked ? 'border-[#DDE8F0] opacity-80' : theme.card}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${isCompleted ? 'border-[#BDEDD8] bg-[#E7FAF3] text-[#0F9F75]' : isSnoozed || isBlocked ? 'border-[#DDE8F0] bg-[#EEF3F7] text-[#8A98AA]' : theme.iconChip}`}>
          {isCompleted ? 'OK' : isBlocked ? 'Lock' : theme.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${theme.chip}`}>
                {task.sequenceLabel || getTaskTypeLabel(task.taskType)}
              </span>
              <h3 className={`mt-1 font-display text-[14px] font-black leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-primary'}`}>
                {getTaskTitle(task)}
              </h3>
            </div>
            <StatusPill task={task} />
          </div>

          <p className={`mt-0.5 text-[11px] font-semibold leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-secondary'}`}>
            {getPurpose(task)}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            {meta.length ? (
              <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-ssc-text-secondary">
                {meta.map(item => <span key={item}>{item}</span>)}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-ssc-text-muted">Task {taskNumber}</span>
            )}

            {!inactive && !isBlocked ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPrimary?.(task)}
                className="shrink-0 rounded-xl border border-[#0EA5A4] bg-white px-3 py-2 text-[11px] font-black text-[#0EA5A4] active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? 'Saving...' : cta}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {task.duplicateNote ? (
        <p className="mt-2 text-xs font-bold text-[#B45309]">{task.duplicateNote}</p>
      ) : null}

      {isBlocked ? (
        <p className="mt-2 text-center text-[11px] font-bold text-ssc-text-muted">
          {task.blockedReason || 'Complete the previous step first.'}
        </p>
      ) : !inactive && showManualDone ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-center text-[11px] font-bold text-ssc-text-muted">
            Task sync nahi hua? Already completed mark kar sakte hain.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDone?.(task)}
            className="w-full rounded-xl border border-[#0EA5A4] bg-white py-2 text-xs font-black text-[#0EA5A4] active:scale-[0.98] disabled:opacity-60"
          >
            Mark as Done
          </button>
        </div>
      ) : inactive ? (
        <p className="mt-2 text-xs font-bold text-ssc-text-muted">{isCompleted ? 'Completed' : 'Saved for later'}</p>
      ) : null}

      {!inactive && !isBlocked && !showManualDone && onLater ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onLater?.(task)}
          className="mt-1.5 text-[11px] font-bold text-ssc-text-muted active:opacity-70 disabled:opacity-50"
        >
          {task.secondaryAction || 'Later'}
        </button>
      ) : null}
    </article>
  );
}
