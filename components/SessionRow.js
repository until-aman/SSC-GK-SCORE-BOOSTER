import { getSubjectStyle } from '@/lib/subjects';
import { getISTDateString } from '@/lib/streak';

function formatDate(timestamp) {
  if (!timestamp) return '';
  try {
    const today = getISTDateString();
    const yesterday = getISTDateString(new Date(Date.now() - 86400000));
    const dateStr = getISTDateString(new Date(timestamp));
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function MilestoneRow({ session: s }) {
  return (
    <div className="bg-gradient-to-r from-orange-900/40 to-amber-900/30 border border-orange-500/30 rounded-2xl px-4 py-3.5 mb-2 flex items-center gap-3">
      {/* Trophy icon */}
      <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 text-lg">
        🏆
      </div>

      {/* Middle */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-[13px] text-orange-300 truncate">
          {s.milestoneLabel}
        </span>
        <span className="text-[11px] text-slate-500">{formatDate(s.timestamp)}</span>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display font-bold text-[15px] text-orange-400">+{s.xpEarned} XP</span>
        <span className="text-[11px] text-orange-500/70">streak reward</span>
      </div>
    </div>
  );
}

export default function SessionRow({ session: s }) {
  if (s.type === 'milestone') return <MilestoneRow session={s} />;

  const style = getSubjectStyle(s.subject);
  return (
    <div className="bg-slate-800 rounded-2xl px-4 py-3.5 mb-2 flex items-center gap-3">
      {/* Subject icon */}
      <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 text-lg">
        {style.icon}
      </div>

      {/* Middle */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-[13px] text-white truncate max-w-[180px]">
          {s.subject} · {s.topic}
        </span>
        <span className="text-[11px] text-slate-500">{formatDate(s.timestamp)}</span>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display font-bold text-[15px] text-emerald-400">+{s.xpEarned} XP</span>
        <span className="text-[11px] text-slate-500">{s.correctAnswers}/{s.totalQuestions} correct</span>
      </div>
    </div>
  );
}
