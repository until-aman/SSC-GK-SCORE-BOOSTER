import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

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

const ClockIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 15"/>
  </svg>
);

const PersonIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const TargetIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.5" fill={color} stroke="none"/>
  </svg>
);

const BrainCircuitIcon = ({ color }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
  </svg>
);

const TOOLTIP_KEY = 'analysis_tab_tooltip_seen';

export default function BottomNav() {
  const router = useRouter();
  const path = router.pathname;
  const [pressed, setPressed] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOOLTIP_KEY) === 'true') return;
    } catch {}

    const showT = setTimeout(() => setShowTooltip(true), 1500);
    const hideT = setTimeout(() => {
      setShowTooltip(false);
      try { localStorage.setItem(TOOLTIP_KEY, 'true'); } catch {}
    }, 6500); // 1500 delay + 5000 visible

    return () => { clearTimeout(showT); clearTimeout(hideT); };
  }, []);

  function markTooltipSeen() {
    setShowTooltip(false);
    try { localStorage.setItem(TOOLTIP_KEY, 'true'); } catch {}
  }

  const items = [
    { Icon: HomeIcon,         route: '/dashboard',   label: 'Home'     },
    { Icon: TrophyIcon,       route: '/leaderboard', label: 'Rank'     },
    { Icon: BrainCircuitIcon, route: '/analysis',    label: 'Analysis' },
    { Icon: ClockIcon,        route: '/history',      label: 'History'  },
    { Icon: TargetIcon,       route: '/mentor',       label: 'Mentor'   },
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
        @keyframes analysisTooltipIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.92) translateY(6px); transform-origin: bottom center; }
          to   { opacity: 1; transform: translateX(-50%) scale(1) translateY(0);   transform-origin: bottom center; }
        }
      `}</style>

      <div className="ssc-bottom-nav-safe-area" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '430px',
          margin: '0 auto',
          padding: '8px 20px calc(7px + env(safe-area-inset-bottom))',
          position: 'relative',
          zIndex: 51,
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DDE8F0',
            borderRadius: '28px',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            width: '100%',
            boxShadow: '0 16px 40px rgba(16, 32, 51, 0.12)',
          }}>
            {items.map(({ Icon, route, label }) => {
              const active = route === '/history' ? path === route || path.startsWith('/history/') : path === route;
              const isPressed = pressed === route;
              const isAnalysis = route === '/analysis';

              return (
                <div
                  key={route}
                  className={`nav-item${active ? ' active' : ''}${isPressed ? ' pressed' : ''}`}
                  onClick={() => {
                    if (isAnalysis) markTooltipSeen();
                    router.push(route);
                  }}
                  onMouseDown={() => setPressed(route)}
                  onMouseUp={() => setPressed(null)}
                  onMouseLeave={() => setPressed(null)}
                  onTouchStart={() => setPressed(route)}
                  onTouchEnd={() => setPressed(null)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    cursor: 'pointer',
                    minWidth: 56,
                    padding: '6px 8px',
                    borderRadius: 16,
                    background: active ? '#FFF1E8' : 'transparent',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Analysis tab tooltip — cloud message bubble */}
                  {isAnalysis && showTooltip && (
                    <div
                      onClick={(e) => { e.stopPropagation(); markTooltipSeen(); router.push('/analysis'); }}
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 250,
                        filter: 'drop-shadow(0 16px 34px rgba(16,32,51,0.18))',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        zIndex: 60,
                        animation: 'analysisTooltipIn 0.28s ease forwards',
                      }}>
                      {/* Bubble body */}
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #FDBA74',
                        borderRadius: 16,
                        padding: '12px 14px 13px',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#102033', lineHeight: 1.35, marginBottom: 4 }}>
                          New: AI GK Analysis ✨
                        </div>
                        <div style={{ fontSize: 12, color: '#5B6B82', lineHeight: 1.4 }}>
                          Find weak topics &amp; your next revision plan.
                        </div>
                      </div>

                      {/* Bubble tail pointing DOWN toward the Analysis icon */}
                      <div style={{
                        position: 'absolute',
                        bottom: -10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '10px solid transparent',
                        borderRight: '10px solid transparent',
                        borderTop: '10px solid #FDBA74',
                      }} />
                      <div style={{
                        position: 'absolute',
                        bottom: -9,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '9px solid transparent',
                        borderRight: '9px solid transparent',
                        borderTop: '9px solid #FFFFFF',
                      }} />
                    </div>
                  )}

                  <Icon color={active ? '#FF6A00' : '#8A98AA'} />
                  <span className={active ? 't-nav-label-active' : 't-nav-label'} style={{
                    color: active ? '#FF6A00' : '#8A98AA',
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
