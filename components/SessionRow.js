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
  const coins = s.coins ?? 0;
  return (
    <div
      className="rounded-2xl px-4 py-3.5 mb-2 flex items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7E6 100%)',
        border: '1px solid rgba(246,179,49,0.34)',
        boxShadow: 'var(--ssc-shadow-card)',
      }}
    >
      {/* Trophy icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: 'rgba(246,179,49,0.18)' }}>
        🏆
      </div>

      {/* Middle */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-[13px] truncate" style={{ color: 'var(--ssc-orange-deep)' }}>
          {s.milestoneLabel}
        </span>
        <span className="text-[11px] text-[var(--ssc-text-muted)]">{formatDate(s.timestamp)}</span>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display font-bold text-[15px]" style={{ color: 'var(--ssc-orange-deep)' }}>+{coins} coins</span>
        <span className="text-[11px]" style={{ color: 'var(--ssc-text-secondary)' }}>streak reward</span>
      </div>
    </div>
  );
}

export default function SessionRow({ session: s }) {
  if (s.type === 'milestone') return <MilestoneRow session={s} />;

  const style = getSubjectStyle(s.subject);
  const coins = s.coins ?? 0;
  return (
    <div className="rounded-2xl px-4 py-3.5 mb-2 flex items-center gap-3" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
      {/* Subject icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: style.bg || 'var(--ssc-teal-soft)' }}>
        {style.icon}
      </div>

      {/* Middle */}
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <span className="font-semibold text-[13px] text-[var(--ssc-text-primary)] truncate max-w-[180px]">
          {s.subject} · {s.topic}
        </span>
        <span className="text-[11px] text-[var(--ssc-text-muted)]">{formatDate(s.timestamp)}</span>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-display font-bold text-[15px] text-[var(--ssc-teal)]">+{coins} coins</span>
        <span className="text-[11px] text-[var(--ssc-text-muted)]">{s.correctAnswers}/{s.totalQuestions} correct</span>
      </div>
    </div>
  );
}
