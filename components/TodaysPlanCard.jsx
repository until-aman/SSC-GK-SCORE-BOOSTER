import MentorTaskCard from '@/components/MentorTaskCard';
import MentorMessage from '@/components/MentorMessage';
import { MENTOR_COPY } from '@/lib/mentorCopy';

export default function TodaysPlanCard({ plan }) {
  const tasks = plan?.tasks || [];

  if (!tasks.length) {
    return <MentorMessage message={MENTOR_COPY.NO_TASKS_TODAY} variant="success" />;
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <MentorTaskCard key={task.taskId} task={task} />
      ))}
    </div>
  );
}
