import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function TopPerformersSection() {
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setPerformers(data.slice(0, 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="hidden sm:block bg-white rounded-3xl p-5 border border-gray-100 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 w-1/3 mb-5 rounded mx-auto" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-50 rounded-full mb-2" />
              <div className="h-2 bg-gray-50 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (performers.length === 0) return null;

  return (
    <div className="hidden sm:block bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            <img 
              src={session.user.image}
              alt="Your profile"
              className="w-10 h-10 rounded-full border-2 border-orange-600 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-orange-600 bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
              {session?.user?.name?.charAt(0)}
            </div>
          )}
          <h3 className="text-[8px] font-black text-gray-400 uppercase tracking-[0.35em]">Final Scoreboard</h3>
        </div>
        <button 
          onClick={() => router.push('/result')}
          className="w-8 h-8 rounded-full bg-white border border-white flex items-center justify-center text-orange-600 text-lg font-bold shadow-sm transition hover:bg-gray-100"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {performers.map((p, i) => (
          <div 
            key={i} 
            className="flex flex-col items-center cursor-pointer group"
            onClick={() => router.push('/leaderboard')}
          >
            <div className={`w-6 h-6 rounded-full border-2 p-0.5 mb-1 transition-transform group-hover:scale-110 ${
              i === 0 ? 'border-yellow-400' : i === 1 ? 'border-gray-300' : i === 2 ? 'border-orange-300' : 'border-gray-100'
            }`}>
              <img 
                src={p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`} 
                alt={p.name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <span className="text-[8px] font-bold text-gray-700 truncate w-full text-center">
              {p.name.split(' ')[0]}
            </span>
            <span className="text-[7px] font-medium text-gray-400">
              {Number(p.score).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <button 
        onClick={() => router.push('/leaderboard')}
        className="w-full mt-5 py-2 border-t border-gray-50 text-[10px] font-bold text-orange-400 hover:text-orange-600 transition"
      >
        🔗 Show my rank
      </button>
    </div>
  );
}
