export default function CoinsToast({ visible, coins, totalCoins, level, streakCount, isFirstQuizOfDay, streakMilestone }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-[430px] mx-auto z-50 coins-toast">
      <div className="rounded-2xl p-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.18), rgba(23,45,71,0.95))', border: '1px solid rgba(20,184,166,0.35)', boxShadow: '0 8px 32px rgba(20,184,166,0.20)' }}>
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-lg text-white">🪙 +{coins} coins</span>
          <span className="text-orange-400 font-semibold text-sm">🔥 {streakCount} day streak</span>
        </div>
        <p className="text-[#14B8A6] text-sm mt-1">Level: {level} · {totalCoins} coins total</p>
        {isFirstQuizOfDay && (
          <p className="text-yellow-300 text-xs mt-0.5">🌅 First quiz bonus included!</p>
        )}
        {streakMilestone && (
          <p className="text-orange-300 text-xs mt-0.5 font-semibold">
            🏆 {streakMilestone.label} +{streakMilestone.bonus} bonus coins!
          </p>
        )}
        <div className="toast-progress mt-3 rounded-full" />
      </div>
    </div>
  );
}
