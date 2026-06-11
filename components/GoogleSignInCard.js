import { signIn } from 'next-auth/react';

const GoogleSVG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function GoogleSignInCard({
  title = 'Save your progress',
  subtitle = 'Login to save score, Coins, streak & rank.',
  buttonText = 'Sign in',
  callbackUrl = '/dashboard',
  className = '',
  style = {},
}) {
  function handleSignIn() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl });
  }

  return (
    <div
      className={className}
      style={{
        background: '#FFFFFF',
        border: '1px solid #DDE8F0',
        borderRadius: 22,
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        boxShadow: '0 8px 24px rgba(16, 32, 51, 0.08)',
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="font-display" style={{ fontSize: 16, fontWeight: 800, color: '#102033', lineHeight: 1.2, marginBottom: 6 }}>
          {title}
        </p>
        <p className="font-sans" style={{ fontSize: 13, color: '#5B6B82', lineHeight: 1.35 }}>
          {subtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSignIn}
        style={{
          flexShrink: 0,
          minHeight: 42,
          borderRadius: 16,
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: '#FFFFFF',
          color: '#0F172A',
          border: '1px solid #DDE8F0',
          boxShadow: '0 4px 14px rgba(16, 32, 51, 0.08)',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          transition: 'transform 150ms ease',
        }}
        onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
        onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <GoogleSVG />
        {buttonText}
      </button>
    </div>
  );
}
