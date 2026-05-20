import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TopPerformers() {
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        const list = data.leaderboard || data || [];
        setPerformers(list.slice(0, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center flex-shrink-0 animate-pulse">
              <div className="w-[56px] h-[56px] bg-gray-200 rounded-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-10"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (performers.length === 0) return null;

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="typo-question !font-bold">Top Performers</h3>
        <button 
          onClick={() => router.push('/leaderboard')}
          className="typo-button !text-[#FF6A00] hover:!text-[#FF8C00] transition !text-[11px]"
        >
          View leaderboard &rarr;
        </button>
      </div>

      <div 
        className="flex gap-4 overflow-x-auto pb-2" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {performers.map((p, i) => (
          <div key={i} className="flex flex-col items-center flex-shrink-0 w-[64px]">
            <img 
              src={p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`} 
              alt={p.name}
              className="w-[56px] h-[56px] rounded-full object-cover mb-2 border border-gray-100 shadow-sm"
            />
            <span className="typo-small-label !font-bold text-center truncate w-full">
              {p.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
