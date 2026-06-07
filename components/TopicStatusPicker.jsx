import { TOPIC_STATUS } from '@/lib/mentorCopy';

const TOPIC_STATUS_ORDER = [
  TOPIC_STATUS.NOT_STARTED,
  TOPIC_STATUS.WEAK,
  TOPIC_STATUS.STRONG,
];

const TOPIC_STATUS_STYLES = {
  [TOPIC_STATUS.NOT_STARTED]: 'border-slate-600 bg-slate-800 text-slate-300',
  [TOPIC_STATUS.WEAK]: 'border-red-500/50 bg-red-500/15 text-red-200',
  [TOPIC_STATUS.STRONG]: 'border-green-500/50 bg-green-500/15 text-green-200',
};

export { TOPIC_STATUS_ORDER };

export default function TopicStatusPicker({ subjectId, topics = [], value = {}, onChange }) {
  const cycleTopic = topicName => {
    const current = value[topicName] || TOPIC_STATUS.NOT_STARTED;
    const currentIndex = TOPIC_STATUS_ORDER.indexOf(current);
    const next = TOPIC_STATUS_ORDER[(currentIndex + 1) % TOPIC_STATUS_ORDER.length];
    onChange?.(subjectId, { ...value, [topicName]: next });
  };

  return (
    <div className="space-y-2">
      {topics.map(topic => {
        const topicName = topic.topicName;
        const status = value[topicName] || TOPIC_STATUS.NOT_STARTED;
        return (
          <button
            key={topic.topicId || topicName}
            type="button"
            onClick={() => cycleTopic(topicName)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-100">
                {topic.displayName || topicName}
              </span>
              {topic.sscWeightage ? (
                <span className="mt-0.5 block text-xs text-slate-500">{topic.sscWeightage} weightage</span>
              ) : null}
            </span>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${TOPIC_STATUS_STYLES[status]}`}>
              {status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
