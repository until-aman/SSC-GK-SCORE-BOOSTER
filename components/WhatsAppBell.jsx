import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const WIGGLE_STYLE = `
  @keyframes bellWiggle {
    0%   { transform: rotate(0deg); }
    15%  { transform: rotate(14deg); }
    30%  { transform: rotate(-11deg); }
    45%  { transform: rotate(8deg); }
    60%  { transform: rotate(-5deg); }
    75%  { transform: rotate(3deg); }
    90%  { transform: rotate(-1deg); }
    100% { transform: rotate(0deg); }
  }
`;

// ── Replace with your real WhatsApp community invite link ──────────────────
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/IQO1AETl4IREmgP3eqtotF';

export default function WhatsAppBell() {
  const [showSheet, setShowSheet] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [wiggle, setWiggle]       = useState(false);

  useEffect(() => {
    setMounted(true);
    // Wiggle once on page load after 1.8s — draws attention without being intrusive
    const t = setTimeout(() => setWiggle(true), 1800);
    return () => clearTimeout(t);
  }, []);

  function handleBellTap() {
    setShowSheet(true);
    setWiggle(true);   // wiggle again when popup opens
    try { localStorage.setItem('whatsapp_prompt_seen', 'true'); } catch {}
  }

  function handleMaybeLater() {
    try { localStorage.setItem('whatsapp_prompt_seen', 'true'); } catch {}
    setShowSheet(false);
  }

  function handleJoin() {
    try { localStorage.setItem('whatsapp_prompt_seen', 'true'); } catch {}
    window.open(WHATSAPP_COMMUNITY_URL, '_blank', 'noopener,noreferrer');
    setShowSheet(false);
  }

  return (
    <>
      <style>{WIGGLE_STYLE}</style>

      {/* Standalone orange bell — no circular background, 40px tap target */}
      <button
        onClick={handleBellTap}
        className="flex items-center justify-center active:opacity-55 transition-opacity"
        style={{ width: 40, height: 40 }}
        aria-label="Join WhatsApp Community"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={wiggle ? {
            animation: 'bellWiggle 0.55s cubic-bezier(0.36,0.07,0.19,0.97) both',
            transformOrigin: '50% 20%',
          } : { transformOrigin: '50% 20%' }}
          onAnimationEnd={() => setWiggle(false)}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {/* Portal — rendered on document.body to escape the header's backdrop-filter
          containing block, so fixed positioning is always viewport-relative     */}
      {mounted && showSheet && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center px-5"
          style={{ zIndex: 9999, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={handleMaybeLater}
        >
          <div
            className="w-full max-w-[380px] px-6 pt-5 pb-6"
            style={{
              background: 'linear-gradient(160deg, #1E3554 0%, #172D47 55%, #112236 100%)',
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-display font-black text-xl text-white">
                🔔 Daily GK Updates
              </h2>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0, opacity: 0.9 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>

            {/* Description */}
            <p className="font-sans text-sm leading-relaxed mb-4" style={{ color: '#94A3B8' }}>
              Quiz links, streak reminders & rank updates on WhatsApp.
            </p>

            {/* Benefit chips */}
            <div className="flex gap-2 mb-5">
              {['🔥 Daily quiz', '🏆 Rank updates'].map(chip => (
                <span
                  key={chip}
                  className="font-sans font-medium rounded-full"
                  style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#94A3B8' }}
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* Primary CTA — WhatsApp icon + text */}
            <button
              onClick={handleJoin}
              className="w-full rounded-2xl text-white font-display font-bold text-lg active:scale-95 transition-transform flex items-center justify-center gap-2.5"
              style={{
                padding: '17px 0',
                background: '#16C47F',
                boxShadow: '0 14px 36px rgba(37,211,102,0.40), 0 4px 12px rgba(37,211,102,0.25)',
              }}
            >
              {/* WhatsApp icon — white on green */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" style={{ flexShrink: 0 }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Join WhatsApp →
            </button>

            {/* Trust line */}
            <p className="text-center font-sans mt-2.5" style={{ fontSize: 11, color: '#334155' }}>
              No spam. Only useful updates.
            </p>

            {/* Secondary — plain muted text */}
            <button
              onClick={handleMaybeLater}
              className="w-full pt-2 pb-0 font-sans text-sm active:opacity-50 transition-opacity"
              style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer' }}
            >
              Maybe later
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
