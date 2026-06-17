const TASK_TYPE_LABELS = {
  coverage_check: 'Coverage',
  confidence_check: 'Quiz',
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
    accent: 'border-[#F8D9A0]',
    softBg: 'bg-[#FFFDF8]',
    pill: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    cta: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[var(--ssc-shadow-cta)]',
  },
  practice_task: {
    label: 'Practice',
    icon: 'P',
    accent: 'border-[#F8D9A0]',
    softBg: 'bg-[#FFFDF8]',
    pill: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    cta: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[var(--ssc-shadow-cta)]',
  },
  mistake_recovery_task: {
    label: 'Practice',
    icon: 'P',
    accent: 'border-[#F8D9A0]',
    softBg: 'bg-[#FFFDF8]',
    pill: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    iconChip: 'border-[#FDBA74] bg-[#FFF7E6] text-[#EA580C]',
    cta: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[var(--ssc-shadow-cta)]',
  },
  confidence_check: {
    label: 'Quiz',
    icon: 'Q',
    accent: 'border-[#DDD6FE]',
    softBg: 'bg-[#FCFBFF]',
    pill: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D5DF6]',
    iconChip: 'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D5DF6]',
    cta: 'border border-[#0EA5A4] bg-white text-[#0EA5A4]',
  },
  coverage_check: {
    label: 'Coverage',
    icon: 'C',
    accent: 'border-[#BDEDEA]',
    softBg: 'bg-[#FBFFFE]',
    pill: 'border-[#BDEDEA] bg-[#E8F8F6] text-[#0EA5A4]',
    iconChip: 'border-[#BDEDEA] bg-[#E8F8F6] text-[#0EA5A4]',
    cta: 'border border-[#0EA5A4] bg-white text-[#0EA5A4]',
  },
  feedback_task: {
    label: 'Feedback',
    icon: '!',
    accent: 'border-[#FBCACA]',
    softBg: 'bg-[#FFFBFB]',
    pill: 'border-[#FBCACA] bg-[#FEECEC] text-[#DC2626]',
    iconChip: 'border-[#FBCACA] bg-[#FEECEC] text-[#DC2626]',
    cta: 'bg-gradient-to-r from-[#FF7A1A] to-[#F45100] text-white shadow-[var(--ssc-shadow-cta)]',
  },
};

const STATUS_STYLES = {
  Weak: 'border-[#FBCACA] bg-[#FEECEC] text-[#DC2626]',
  Medium: 'border-[#F8D9A0] bg-[#FFF7E6] text-[#B45309]',
  Good: 'border-[#BDEDD8] bg-[#E7FAF3] text-[#0F9F75]',
  Completed: 'border-[#BDEDD8] bg-[#E7FAF3] text-[#0F9F75]',
  Later: 'border-[#F8D9A0] bg-[#FFF7E6] text-[#B45309]',
  Locked: 'border-[#DDE8F0] bg-[#EEF3F7] text-[#8A98AA]',
};

function getTaskTypeLabel(type) {
  return TASK_TYPE_LABELS[type] || 'Practice';
}

function getTheme(task) {
  return TASK_THEME[task.taskType] || TASK_THEME.practice_task;
}

function cleanText(value) {
  return String(value || '').replace(/^Q_PYQ_/, '').replace(/\s+/g, ' ').trim();
}

function sameText(a, b) {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function getTaskTitle(task) {
  if (cleanText(task.title)) return cleanText(task.title);
  if (task.reason === 'recent_mistakes' || task.taskType === 'mistake_recovery_task') return 'Repeated Mistakes';
  return cleanText(task.displayName || task.topicName || task.topic || task.subjectName || task.subject) || 'Mentor Task';
}

function getSubject(task) {
  const rawSubject = cleanText(task.subject || task.subjectName || task.subjectId);
  if (!rawSubject || sameText(rawSubject, 'Repeated Mistakes')) return 'Mixed GK';
  return rawSubject;
}

function getTopic(task) {
  if ((task.reason === 'recent_mistakes' || task.taskType === 'mistake_recovery_task') && !cleanText(task.topic || task.topicName)) {
    return 'Repeated Mistakes';
  }
  const rawTopic = cleanText(task.topic || task.topicName || task.displayName);
  const title = getTaskTitle(task);
  if (!rawTopic) return sameText(title, 'Repeated Mistakes') ? 'Repeated Mistakes' : 'Mixed Topic';
  if (sameText(rawTopic, getSubject(task))) return sameText(rawTopic, 'Mixed GK') ? 'Mixed Topic' : 'Mixed Topic';
  return rawTopic;
}

function getSubjectTopic(task) {
  const subject = getSubject(task);
  let topic = getTopic(task);
  if (sameText(subject, topic)) {
    topic = sameText(subject, 'Repeated Mistakes') || sameText(subject, 'Mixed GK')
      ? 'Repeated Mistakes'
      : 'Mixed Topic';
  }
  return { subject, topic, label: `${subject} - ${topic}` };
}

function getQuestionCount(task) {
  return Number(task.questionCount || task.questionsCount || task.totalQuestions || 0);
}

function getTime(task) {
  return Number(task.estimatedMinutes || task.durationMinutes || task.timeMinutes || 0);
}

function getModeLabel(task) {
  if (cleanText(task.sourceLabel)) return cleanText(task.sourceLabel);
  if (task.reason === 'recent_mistakes' || task.taskType === 'mistake_recovery_task') return 'Repeated Mistakes';
  if (task.reason === 'mostly_wrong') return 'Mostly Wrong';
  if (task.reason === 'mostly_incorrect') return 'Mostly Incorrect';
  if (task.status === 'snoozed') return 'Saved for Later';
  return getTaskTypeLabel(task.taskType);
}

function getMeta(task) {
  const minutes = getTime(task);
  const questionCount = getQuestionCount(task);
  return [
    minutes ? { key: 'time', label: `${minutes} min` } : null,
    questionCount ? { key: 'questions', label: `${questionCount} Qs` } : null,
    { key: 'mode', label: getModeLabel(task) },
  ].filter(Boolean);
}

function getDescription(task) {
  const existing = cleanText(task.whyThisText || task.mentorMessage);
  if (existing) return existing;
  const count = getQuestionCount(task);
  const mode = getModeLabel(task).toLowerCase();
  if (count) return `${count} focused questions selected for this ${mode} task.`;
  return 'Complete this mentor-recommended step to keep your plan moving.';
}

function getStatusLabel(task) {
  if (task.status === 'completed') return 'Completed';
  if (task.status === 'snoozed') return 'Later';
  if (task.status === 'blocked') return 'Locked';
  if (task.reason === 'recent_mistakes' || task.taskType === 'feedback_task') return 'Weak';
  if (task.taskType === 'revision_task') return 'Medium';
  return 'Good';
}

function StatusPill({ task }) {
  const label = getStatusLabel(task);
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black leading-none ${STATUS_STYLES[label] || STATUS_STYLES.Good}`}>
      {label}
    </span>
  );
}

function MetaRow({ items }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-extrabold text-ssc-text-secondary">
      {items.map(item => (
        <span key={`${item.key}-${item.label}`} className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5A4]/45" aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ActionRow({
  task,
  busy,
  cta,
  theme,
  isBlocked,
  showManualDone,
  onPrimary,
  onLater,
  variant,
}) {
  if (isBlocked) {
    return (
      <p className="mt-3 rounded-2xl bg-[#EEF3F7] px-3 py-2 text-center text-[11px] font-bold text-ssc-text-muted">
        {task.blockedReason || 'Complete the previous step first.'}
      </p>
    );
  }

  const canShowLater = !showManualDone && task.status !== 'completed' && task.status !== 'snoozed' && onLater;
  const ctaClass = task.status === 'completed' || task.status === 'snoozed'
    ? 'border border-[#0EA5A4] bg-white text-[#0EA5A4]'
    : theme.cta;
  const buttonWidth = variant === 'flow' ? 'flex-1' : 'shrink-0';

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {canShowLater ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onLater?.(task)}
          className="shrink-0 text-[11px] font-black text-ssc-text-muted active:opacity-70 disabled:opacity-50"
        >
          {task.secondaryAction || 'Maybe later'}
        </button>
      ) : (
        <span className="min-w-[1px]" />
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => onPrimary?.(task)}
        className={`${buttonWidth} rounded-2xl px-4 py-2.5 text-[12px] font-black leading-none active:scale-[0.98] disabled:opacity-60 ${ctaClass}`}
      >
        {busy ? 'Saving...' : cta}
      </button>
    </div>
  );
}

export default function MentorTaskCard({
  task,
  index = 0,
  busy,
  onPrimary,
  onDone,
  onLater,
  showManualDone = false,
  variant = 'compact',
}) {
  const isCompleted = task.status === 'completed';
  const isSnoozed = task.status === 'snoozed';
  const isBlocked = task.status === 'blocked';
  const theme = getTheme(task);
  const taskNumber = Number(task.taskNumber || task.sequenceNumber || index + 1);
  const title = getTaskTitle(task);
  const typeLabel = task.sequenceLabel || getTaskTypeLabel(task.taskType);
  const { label: subjectTopic } = getSubjectTopic(task);
  const description = getDescription(task);
  const meta = getMeta(task);
  const cta = task.ctaLabel || (
    isCompleted
      ? 'Review Result'
      : isSnoozed
        ? 'Resume'
        : task.taskType === 'revision_task'
          ? 'Revise Now'
          : task.taskType === 'confidence_check'
            ? 'Start Quiz'
            : 'Practice Questions'
  );

  return (
    <article className={`relative overflow-hidden rounded-[22px] border bg-white p-3.5 shadow-[0_10px_26px_rgba(16,32,51,0.07)] ${isCompleted ? 'border-[#BDEDD8] bg-[#FBFFFE]' : isSnoozed ? 'border-[#F8D9A0] bg-[#FFFDF8]' : isBlocked ? 'border-[#DDE8F0] bg-[#F8FAFC] opacity-85' : `${theme.accent} ${theme.softBg}`}`}>
      <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase leading-none tracking-wide ${theme.pill}`}>
              {typeLabel}
            </span>
            <StatusPill task={task} />
          </div>

          <h3 className={`mt-2 font-display text-[15px] font-black leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-primary'}`}>
            {title}
          </h3>
          <p className={`mt-1 text-[11px] font-black leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-secondary'}`}>
            {subjectTopic}
          </p>
          <p className={`mt-1 text-[11px] font-semibold leading-snug ${isBlocked ? 'text-ssc-text-muted' : 'text-ssc-text-muted'}`}>
            {description}
          </p>

          <div className="mt-3">
            {meta.length ? <MetaRow items={meta} /> : <span className="text-[11px] font-bold text-ssc-text-muted">Task {taskNumber}</span>}
          </div>
      </div>

      {task.duplicateNote ? (
        <p className="mt-2 rounded-2xl bg-[#FFF7E6] px-3 py-2 text-xs font-bold text-[#B45309]">{task.duplicateNote}</p>
      ) : null}

      <ActionRow
        task={task}
        busy={busy}
        cta={cta}
        theme={theme}
        isBlocked={isBlocked}
        showManualDone={showManualDone}
        onPrimary={onPrimary}
        onLater={onLater}
        variant={variant}
      />

      {!isBlocked && showManualDone ? (
        <div className="mt-3 space-y-1.5 rounded-2xl border border-[#BDEDEA] bg-[#E8F8F6] p-3">
          <p className="text-center text-[11px] font-bold text-ssc-text-secondary">
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
      ) : null}
    </article>
  );
}
