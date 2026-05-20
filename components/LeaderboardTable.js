const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

function SkeletonRow() {
  return <div className="bg-slate-700 animate-pulse rounded-xl h-14 mb-2" />;
}

export default function LeaderboardTable({ leaders = [], currentUserEmail, loading }) {
  if (loading) {
    return (
      <div>
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        No scores yet. Be the first to play!
      </p>
    );
  }

  return (
    <div>
      {leaders.map((leader) => {
        const isCurrentUser = leader.email === currentUserEmail;
        return (
          <div
            key={leader.rank}
            className={`flex items-center py-3 px-4 rounded-2xl mb-2 ${
              isCurrentUser
                ? 'bg-violet-900/20 rounded-xl px-2 -mx-2 border border-violet-500/30'
                : 'bg-slate-800'
            }`}
          >
            {/* Rank */}
            <div className="w-10 text-sm font-display font-bold text-slate-300 flex-shrink-0">
              {leader.rank <= 3 ? MEDALS[leader.rank] : `#${leader.rank}`}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-display font-bold text-sm text-slate-300 flex-shrink-0">
              {(leader.name || '?').charAt(0).toUpperCase()}
            </div>

            {/* Name + accuracy */}
            <div className="flex-1 min-w-0 ml-3">
              <p className="text-white text-sm font-medium truncate">{leader.name}</p>
              <p className="text-slate-500 text-xs">
                {(leader.overallAccuracy || 0).toFixed(0)}% accuracy
              </p>
            </div>

            {/* Score */}
            <div className="text-right ml-2">
              <p className="font-display font-bold text-sm text-emerald-400">
                {(leader.totalScore || 0).toFixed(1)} pts
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
