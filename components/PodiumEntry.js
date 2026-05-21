import { useState } from 'react';

const avatarConfig = {
  1: { size: 64, ring: 'border-4 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]', bg: 'bg-amber-500', block: 'h-20 w-24 bg-amber-500/25 border-t-2 border-amber-500', name: 'text-sm max-w-[72px]', score: 'text-sm' },
  2: { size: 56, ring: 'border-4 border-blue-300',  bg: 'bg-blue-500',  block: 'h-14 w-24 bg-blue-500/20 border-t-2 border-blue-400',  name: 'text-xs max-w-[60px]', score: 'text-xs' },
  3: { size: 56, ring: 'border-4 border-rose-300',  bg: 'bg-rose-500',  block: 'h-10 w-24 bg-rose-500/20 border-t-2 border-rose-400',  name: 'text-xs max-w-[60px]', score: 'text-xs' },
};

const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

function AvatarCircle({ user, cfg }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.name || '?').charAt(0).toUpperCase();
  const sz = cfg.size;

  if (user.image && !imgError) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${cfg.ring}`}
        style={{ width: sz, height: sz }}
      >
        <img
          src={user.image}
          alt={user.name || 'avatar'}
          width={sz}
          height={sz}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`${cfg.bg} ${cfg.ring} rounded-full flex items-center justify-center`}
      style={{ width: sz, height: sz }}
    >
      <span className="font-display font-black text-white text-xl">{initial}</span>
    </div>
  );
}

function GhostEntry({ rank }) {
  const cfg = avatarConfig[rank] || avatarConfig[3];
  return (
    <div className="flex flex-col items-center pop-in" style={{ animationDelay: `${rank * 80}ms` }}>
      <div
        className="rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center"
        style={{ width: cfg.size, height: cfg.size }}
      >
        <span className="font-display font-black text-slate-500 text-xl">?</span>
      </div>
      <p className={`text-slate-600 font-display font-bold ${cfg.name} text-center mt-1.5 truncate`}>---</p>
      <div className="bg-slate-700/30 rounded-full px-2.5 py-0.5 mt-1">
        <span className={`font-display font-bold text-slate-600 ${cfg.score}`}>0</span>
      </div>
      <div className={`${cfg.block} mt-2 rounded-t-xl flex items-center justify-center border-slate-700 bg-slate-700/20`}>
        <span className="text-2xl opacity-30">{medals[rank]}</span>
      </div>
    </div>
  );
}

export default function PodiumEntry({ rank, user }) {
  if (!user) return <GhostEntry rank={rank} />;
  const cfg = avatarConfig[rank] || avatarConfig[3];

  return (
    <div className="flex flex-col items-center pop-in" style={{ animationDelay: `${rank * 80}ms` }}>
      <AvatarCircle user={user} cfg={cfg} />
      <p className={`text-white font-display font-bold ${cfg.name} text-center mt-1.5 truncate`}>
        {(user.name || '').split(' ')[0]}
      </p>
      <div className="bg-white/15 backdrop-blur rounded-full px-2.5 py-0.5 mt-1">
        <span className={`font-display font-bold text-white ${cfg.score}`}>
          {(user.totalScore || 0).toFixed(0)} XP
        </span>
      </div>
      <div className="bg-white/10 rounded-full px-2.5 py-1 mt-1">
        <span className="font-display font-bold text-[10px] text-white/70">
          ⭐ {user.level || 'Aspirant'}
        </span>
      </div>
      <div className={`${cfg.block} mt-2 rounded-t-xl flex items-center justify-center`}>
        <span className="text-3xl">{medals[rank]}</span>
      </div>
    </div>
  );
}
