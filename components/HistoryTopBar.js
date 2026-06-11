import { useRouter } from 'next/router';

const DEFAULT_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const BackIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export default function HistoryTopBar({ title, badge = 'HISTORY', icon = DEFAULT_ICON, backHref = '/history', showBack = false }) {
  const router = useRouter();

  function handleBack() {
    if (!showBack) {
      router.push(backHref);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  }

  return (
    <div
      className="sticky top-0 z-50 px-4 flex items-center justify-between"
      style={{
        height: '58px',
        background: 'rgba(15,32,52,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(20,184,166,0.18)',
        borderRadius: '0 0 22px 22px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-2.5 min-w-0 text-left"
        style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          {showBack ? BackIcon : icon}
        </span>
        <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center text-white truncate">
          {title}
        </span>
        <span
          className="flex-shrink-0"
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#F59E0B',
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 99,
            padding: '3px 8px',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      </button>
    </div>
  );
}
