export default function XPToast({ visible, xpEarned, totalXP, level, streakCount, isFirstQuizOfDay }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-[430px] mx-auto z-50 xp-toast">
      <div className="bg-gradient-to-r from-emerald-900/90 to-teal-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-[0_8px_32px_rgba(16,185,129,0.3)] overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-lg text-white">⚡ +{xpEarned} XP earned</span>
          <span className="text-orange-400 font-semibold text-sm">🔥 {streakCount} day streak</span>
        </div>
        <p className="text-emerald-300 text-sm mt-1">Level: {level} · {totalXP} XP total</p>
        {isFirstQuizOfDay && (
          <p className="text-yellow-300 text-xs mt-0.5">🌅 First quiz bonus included!</p>
        )}
        <div className="toast-progress mt-3 rounded-full" />
      </div>
    </div>
  );
}
