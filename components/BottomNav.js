import { useRouter } from 'next/router';

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
    <path d="M8 21h8m-4-4v4M5 3H3a2 2 0 000 4c0 3.3 2.7 6 6 6s6-2.7 6-6a2 2 0 000-4h-2M5 3h14M5 3v8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const NAV_ITEMS = [
  { icon: HomeIcon,     label: 'Home',    route: '/dashboard' },
  { icon: TrophyIcon,   label: 'Ranks',   route: '/leaderboard' },
  { icon: BookmarkIcon, label: 'Saved',   route: '/saved' },
  { icon: PersonIcon,   label: 'Profile', route: '/profile' },
];

export default function BottomNav() {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center h-16 px-4 z-50">
      {NAV_ITEMS.map((item) => {
        const isActive = router.pathname === item.route;
        return (
          <button
            key={item.label}
            onClick={() => router.push(item.route)}
            className={`flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors ${
              isActive ? 'text-emerald-400' : 'text-slate-600'
            }`}
          >
            <item.icon />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            {isActive && (
              <span className="w-1 h-1 bg-emerald-400 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
