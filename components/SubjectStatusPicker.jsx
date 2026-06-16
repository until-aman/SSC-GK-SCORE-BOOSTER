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
  [SUBJECT_STATUS.NOT_STARTED]: {
    short: 'Not Started',
    button: 'border-[#DDE8F0] bg-white text-ssc-text-muted',
    active: 'border-[#CBD5E1] bg-[#EEF3F7] text-ssc-text-secondary',
  },
  [SUBJECT_STATUS.THEORY_DONE]: {
    short: 'Theory Done',
    button: 'border-[#F8D9A0] bg-white text-[#B45309]',
    active: 'border-[#F59E0B] bg-[#FFF7E6] text-[#B45309]',
  },
  [SUBJECT_STATUS.PRACTICE_STARTED]: {
    short: 'Practice Started',
    button: 'border-[#BDEDD8] bg-white text-[#0F9F75]',
    active: 'border-[#0EA5A4] bg-[#E7FAF3] text-[#0F9F75]',
  },
};

export { SUBJECTS, STATUS_ORDER };

export default function SubjectStatusPicker({ value = {}, onChange }) {
  const setStatus = (subjectId, next) => {
    onChange?.({ ...value, [subjectId]: next });
  };

  return (
    <div className="space-y-2.5">
      {SUBJECTS.map(subjectId => {
        const status = value[subjectId] || SUBJECT_STATUS.NOT_STARTED;
        return (
          <div
            key={subjectId}
            className="rounded-[18px] border border-ssc-border-soft bg-white p-3 shadow-[var(--ssc-shadow-card)]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F8FEFD] text-lg">
                {SUBJECT_ICONS[subjectId]}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-black text-ssc-text-primary">
                {SUBJECT_DISPLAY_NAMES[subjectId]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {STATUS_ORDER.map(option => {
                const active = option === status;
                const style = STATUS_STYLES[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(subjectId, option)}
                    className={`min-h-[34px] rounded-xl border px-1.5 text-[10px] font-black leading-tight transition-all ${active ? style.active : style.button}`}
                  >
                    {style.short}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
