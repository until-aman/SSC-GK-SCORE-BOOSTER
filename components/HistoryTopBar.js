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

export default function HistoryTopBar({ title, badge = 'HISTORY', icon = DEFAULT_ICON, backHref = '/history', showBack = false, rightAction = null, onBack = null }) {
  const router = useRouter();

  function handleBack() {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
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
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--ssc-border-soft)',
        borderRadius: '0 0 22px 22px',
        boxShadow: '0 10px 30px rgba(16,32,51,0.08)',
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-2.5 min-w-0 text-left"
        style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span className="w-8 h-8 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,106,0,0.10)' }}>
          {showBack ? BackIcon : icon}
        </span>
        <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center truncate" style={{ color: 'var(--ssc-text-primary)' }}>
          {title}
        </span>
        <span
          className="flex-shrink-0"
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: 'var(--ssc-teal)',
            background: 'var(--ssc-teal-soft)',
            border: '1px solid rgba(14,165,164,0.20)',
            borderRadius: 99,
            padding: '3px 8px',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      </button>
      {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
    </div>
  );
}
