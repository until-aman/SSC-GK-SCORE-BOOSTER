import { SUBJECT_DISPLAY_NAMES, SUBJECT_ICONS, SUBJECT_STATUS } from '@/lib/mentorCopy';

const SUBJECTS = [
  'Polity',
  'Geography',
  'Ancient_History',
  'Medieval_History',
  'Modern_History',
  'Economics',
  'Physics',
  'Chemistry',
  'Biology',
  'Current_Affairs',
  'Static_GK',
];

const STATUS_ORDER = [
  SUBJECT_STATUS.NOT_STARTED,
  SUBJECT_STATUS.THEORY_DONE,
  SUBJECT_STATUS.PRACTICE_STARTED,
];

const STATUS_STYLES = {
  [SUBJECT_STATUS.NOT_STARTED]: 'border-slate-600 bg-slate-800 text-slate-300',
  [SUBJECT_STATUS.THEORY_DONE]: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
  [SUBJECT_STATUS.PRACTICE_STARTED]: 'border-green-500/50 bg-green-500/15 text-green-200',
};

export { SUBJECTS, STATUS_ORDER };

export default function SubjectStatusPicker({ value = {}, onChange }) {
  const cycleStatus = subjectId => {
    const current = value[subjectId] || SUBJECT_STATUS.NOT_STARTED;
    const currentIndex = STATUS_ORDER.indexOf(current);
    const next = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    onChange?.({ ...value, [subjectId]: next });
  };

  return (
    <div className="space-y-3">
      {SUBJECTS.map(subjectId => {
        const status = value[subjectId] || SUBJECT_STATUS.NOT_STARTED;
        return (
          <button
            key={subjectId}
            type="button"
            onClick={() => cycleStatus(subjectId)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-left transition-all hover:border-teal-500/60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-lg">
                {SUBJECT_ICONS[subjectId]}
              </span>
              <span className="truncate text-sm font-medium text-slate-100">
                {SUBJECT_DISPLAY_NAMES[subjectId]}
              </span>
            </span>
            <span className={`ml-3 shrink-0 rounded-full border px-2.5 py-1 text-xs ${STATUS_STYLES[status]}`}>
              {status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
