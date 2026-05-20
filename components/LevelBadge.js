const levelColors = {
  Aspirant: 'bg-slate-700/60 text-slate-300',
  Scholar:  'bg-blue-600/20 text-blue-400',
  Expert:   'bg-purple-600/20 text-purple-400',
  Champion: 'bg-yellow-600/20 text-yellow-400',
  Legend:   'bg-emerald-600/20 text-emerald-400',
};

export default function LevelBadge({ level }) {
  const colors = levelColors[level] || levelColors.Aspirant;
  return (
    <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full ${colors}`}>
      ⭐ {level}
    </span>
  );
}
