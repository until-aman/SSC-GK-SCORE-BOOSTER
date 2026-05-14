export default function PodiumCard({ performer, rank, session }) {
  if (!performer) return <div className="flex-1 invisible" />;

  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  // Staggered heights for 2-1-3 layout
  const heightClass = isFirst ? 'h-[140px]' : isSecond ? 'h-[110px]' : 'h-[90px]';
  const podiumColor = isFirst ? 'bg-orange-500' : isSecond ? 'bg-orange-400' : 'bg-orange-300';
  const avatarSize = isFirst ? 'w-24 h-24' : 'w-20 h-20';
  const medalColor = isFirst ? 'bg-yellow-400' : isSecond ? 'bg-slate-300' : 'bg-orange-400';

  return (
    <div className={`flex flex-col items-center flex-1 justify-end animate-pop-in relative z-${10 - rank}`} style={{ animationDelay: `${rank * 0.1}s` }}>
      {/* ─── Avatar & Badge ─── */}
      <div className="relative mb-4">
        <div className={`${avatarSize} rounded-full border-4 border-white/20 shadow-[0_10px_25px_rgba(0,0,0,0.2)] overflow-hidden bg-white/10 p-0.5 transform transition hover:scale-105 ${performer.name === session?.user?.name ? 'ring-4 ring-orange-400' : ''}`}>
          <img 
            src={performer.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(performer.name)}&background=random`} 
            alt={performer.name} 
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        {/* Ribbon Badge */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className={`${medalColor} w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-lg`}>
            <span className="typo-small-label !font-black !text-white">#{rank}</span>
          </div>
        </div>
      </div>
      
      {/* ─── Name & Score ─── */}
      <div className="text-center mb-5 w-full px-1">
        <p className="typo-username !text-white uppercase mb-2 drop-shadow-md truncate">{performer.name.split(' ')[0]}</p>
        <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg inline-block min-w-[70px]">
          <p className="typo-body !font-bold !text-orange-600">
            {Number(performer.score).toLocaleString()}
          </p>
          <p className="typo-small-label">
            (<span className="font-bold">{performer.totalQuestionsAttempted}</span> Q attempted)
          </p>
        </div>
      </div>

      {/* ─── 3D Podium Block ─── */}
      <div className={`w-full ${heightClass} ${podiumColor} rounded-t-3xl shadow-[inset_0_4px_12px_rgba(255,255,255,0.15),0_10px_20px_rgba(0,0,0,0.1)] flex flex-col items-center relative group transition-all duration-300`}>
        {/* Top Highlight (creates 3D look) */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-white/10 rounded-t-3xl"></div>
        
        {/* Large Medal Hanging Down */}
        <div className="mt-4 flex flex-col items-center">
          <div className="w-1.5 h-10 bg-gradient-to-b from-white/20 to-transparent mb-1"></div>
          <div className={`w-14 h-14 rounded-full border-4 border-white/30 flex items-center justify-center shadow-xl ${medalColor} group-hover:scale-110 transition-transform`}>
            <div className="w-10 h-10 rounded-full border-2 border-white/50 flex items-center justify-center">
              <span className="typo-page-heading !text-white drop-shadow-sm">{rank}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
