import { useRouter } from 'next/router';

export default function BackButton({ fallbackHref = '/history' }) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      onClick={handleBack}
      className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform ssc-focus-ring"
      style={{ background: '#FFFFFF', border: '1px solid #DDE8F0', boxShadow: '0 8px 24px rgba(16, 32, 51, 0.08)' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.5" className="w-5 h-5 text-ssc-text-primary">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
