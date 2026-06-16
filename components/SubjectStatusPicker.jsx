import { SUBJECT_DISPLAY_NAMES, SUBJECT_STATUS } from '@/lib/mentorCopy';

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
    short: 'Average',
    button: 'border-[#F8D9A0] bg-white text-[#B45309]',
    active: 'border-[#F59E0B] bg-[#FFF7E6] text-[#B45309]',
  },
  [SUBJECT_STATUS.PRACTICE_STARTED]: {
    short: 'Strong',
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
    <div className="space-y-2 rounded-[18px] border border-ssc-border-soft bg-white p-2 shadow-[var(--ssc-shadow-card)]">
      {SUBJECTS.map(subjectId => {
        const status = value[subjectId] || SUBJECT_STATUS.NOT_STARTED;
        return (
          <div
            key={subjectId}
            className="flex items-center gap-2 rounded-2xl border border-[#EEF3F7] bg-white px-2 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-black text-ssc-text-primary">
              {SUBJECT_DISPLAY_NAMES[subjectId]}
            </span>
            <div className="grid w-[174px] grid-cols-3 gap-1">
              {STATUS_ORDER.map(option => {
                const active = option === status;
                const style = STATUS_STYLES[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(subjectId, option)}
                    className={`min-h-[28px] rounded-lg border px-1 text-[9px] font-black leading-tight transition-all ${active ? style.active : style.button}`}
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
