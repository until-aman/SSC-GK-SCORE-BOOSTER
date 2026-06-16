import { TOPIC_STATUS } from '@/lib/mentorCopy';

const TOPIC_STATUS_ORDER = [
  TOPIC_STATUS.NOT_STARTED,
  TOPIC_STATUS.WEAK,
  TOPIC_STATUS.STRONG,
];

const TOPIC_STATUS_STYLES = {
  [TOPIC_STATUS.NOT_STARTED]: {
    short: 'Not Started',
    button: 'border-[#DDE8F0] bg-white text-ssc-text-muted',
    active: 'border-[#CBD5E1] bg-[#EEF3F7] text-ssc-text-secondary',
  },
  [TOPIC_STATUS.WEAK]: {
    short: 'Weak',
    button: 'border-[#FBCACA] bg-white text-[#DC2626]',
    active: 'border-[#EF4444] bg-[#FEECEC] text-[#DC2626]',
  },
  [TOPIC_STATUS.STRONG]: {
    short: 'Strong',
    button: 'border-[#BDEDD8] bg-white text-[#0F9F75]',
    active: 'border-[#0EA5A4] bg-[#E7FAF3] text-[#0F9F75]',
  },
};

export { TOPIC_STATUS_ORDER };

export default function TopicStatusPicker({ subjectId, topics = [], value = {}, onChange }) {
  const setTopicStatus = (topicName, next) => {
    onChange?.(subjectId, { ...value, [topicName]: next });
  };

  return (
    <div className="space-y-2.5">
      {topics.map(topic => {
        const topicName = topic.topicName;
        const status = value[topicName] || TOPIC_STATUS.NOT_STARTED;
        return (
          <div
            key={topic.topicId || topicName}
            className="rounded-[18px] border border-ssc-border-soft bg-white p-3 shadow-[var(--ssc-shadow-card)]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ssc-text-primary">
                {topic.displayName || topicName}
              </p>
              {topic.sscWeightage ? (
                <p className="mt-0.5 text-xs font-semibold text-ssc-text-muted">{topic.sscWeightage} weightage</p>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {TOPIC_STATUS_ORDER.map(option => {
                const active = option === status;
                const style = TOPIC_STATUS_STYLES[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTopicStatus(topicName, option)}
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
