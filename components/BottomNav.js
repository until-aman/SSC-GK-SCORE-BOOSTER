import { useRouter } from 'next/router';
import { useState } from 'react';

const HomeIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const TrophyIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 01-2-2V5h4"/>
    <path d="M18 9h2a2 2 0 002-2V5h-4"/>
    <path d="M12 17v4"/>
    <path d="M8 21h8"/>
    <path d="M6 3h12v6a6 6 0 01-12 0V3z"/>
  </svg>
);

const BookmarkIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
  </svg>
);

const PersonIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const BrainCircuitIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
  </svg>
);

export default function BottomNav() {
  const router = useRouter();
  const path = router.pathname;
  const [pressed, setPressed] = useState(null);

  const items = [
    { Icon: HomeIcon,         route: '/dashboard',   label: 'Home'     },
    { Icon: TrophyIcon,       route: '/leaderboard', label: 'Rank'     },
    { Icon: BrainCircuitIcon, route: '/analysis',    label: 'Analysis' },
    { Icon: BookmarkIcon,     route: '/saved',        label: 'Saved'    },
    { Icon: PersonIcon,       route: '/profile',      label: 'Profile'  },
  ];

  return (
    <>
      <style>{`
        .nav-item {
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
        }
        .nav-item.active {
          transform: translateY(-2px);
        }
        .nav-item.pressed {
          transform: scale(0.84) !important;
          transition: transform 0.08s ease !important;
        }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '430px',
          margin: '0 auto',
          padding: '6px 20px 5px',
        }}>
          <div style={{
            background: 'rgba(13, 27, 46, 0.95)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            width: '100%',
          }}>
            {items.map(({ Icon, route, label }) => {
              const active = path === route;
              const isPressed = pressed === route;

              return (
                <div
                  key={route}
                  className={`nav-item${active ? ' active' : ''}${isPressed ? ' pressed' : ''}`}
                  onClick={() => router.push(route)}
                  onMouseDown={() => setPressed(route)}
                  onMouseUp={() => setPressed(null)}
                  onMouseLeave={() => setPressed(null)}
                  onTouchStart={() => setPressed(route)}
                  onTouchEnd={() => setPressed(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    minWidth: 56,
                    padding: '6px 8px',
                    borderRadius: 16,
                    background: active ? 'rgba(255, 107, 22, 0.15)' : 'transparent',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <Icon color={active ? '#FF6B16' : '#7A8FA6'} />
                  <span className={active ? 't-nav-label-active' : 't-nav-label'} style={{
                    color: active ? '#FF6B16' : '#7A8FA6',
                    fontFamily: 'inherit',
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
