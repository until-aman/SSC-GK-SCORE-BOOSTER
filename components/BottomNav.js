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

export default function BottomNav() {
  const router = useRouter();
  const path = router.pathname;
  const [pressed, setPressed] = useState(null);

  const items = [
    { Icon: HomeIcon,     route: '/dashboard',   label: 'Home'    },
    { Icon: TrophyIcon,   route: '/leaderboard', label: 'Rank'    },
    { Icon: BookmarkIcon, route: '/saved',        label: 'Saved'   },
    { Icon: PersonIcon,   route: '/profile',      label: 'Profile' },
  ];

  return (
    <>
      <style>{`
        @keyframes navFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-2px); }
        }
        .nav-pill {
          animation: navFloat 3s ease-in-out infinite;
        }
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
        background: 'transparent',
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '430px',
          margin: '0 auto',
          padding: '6px 20px 13px',
        }}>
          <div
            className="nav-pill"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              boxShadow: '0 0 20px rgba(124,58,237,0.35)',
              borderRadius: '60px',
              padding: '8px 12px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              width: '100%',
            }}
          >
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
                    padding: '6px 4px',
                    borderRadius: 16,
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    boxShadow: active ? '0 0 12px rgba(255,255,255,0.2)' : 'none',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <Icon color={active ? '#ffffff' : 'rgba(255,255,255,0.55)'} />
                  <span style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
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
