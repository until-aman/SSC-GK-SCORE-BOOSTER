const LightningSVG = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

export default function StreakBadge({ streakCount, isGuest }) {
  if (isGuest) {
    return (
      <span className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 flex items-center gap-1.5">
        <LightningSVG />
        <span className="font-display font-bold text-[13px] text-slate-600">0 days</span>
      </span>
    );
  }
  return (
    <span className="bg-orange-500/15 border border-orange-500/30 rounded-full px-3 py-1.5 flex items-center gap-1.5">
      <LightningSVG />
      <span className="font-display font-bold text-[13px] text-orange-400">{streakCount} days</span>
    </span>
  );
}
