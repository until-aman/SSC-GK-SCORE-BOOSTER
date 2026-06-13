export default function CoinsToast({ visible, coins, totalCoins, level, streakCount, isFirstQuizOfDay, streakMilestone }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-[430px] mx-auto z-50 coins-toast">
      <div
        className="rounded-[18px] p-4 overflow-hidden"
        style={{
          background: 'var(--ssc-surface)',
          border: '1px solid var(--ssc-border-soft)',
          boxShadow: 'var(--ssc-shadow-float)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display font-black text-lg" style={{ color: 'var(--ssc-text-primary)' }}>
            +{coins} coins
          </span>
          <span
            className="font-semibold text-sm rounded-full px-3 py-1 whitespace-nowrap"
            style={{ color: 'var(--ssc-streak)', background: 'var(--ssc-warning-soft)' }}
          >
            {streakCount} day streak
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--ssc-text-secondary)' }}>
          Level: {level} · {totalCoins} coins total
        </p>
        {isFirstQuizOfDay && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--ssc-coin)' }}>
            First quiz bonus included!
          </p>
        )}
        {streakMilestone && (
          <p className="text-xs mt-0.5 font-semibold" style={{ color: 'var(--ssc-orange)' }}>
            {streakMilestone.label} +{streakMilestone.bonus} bonus coins!
          </p>
        )}
        <div className="toast-progress mt-3 rounded-full" />
      </div>
    </div>
  );
}
