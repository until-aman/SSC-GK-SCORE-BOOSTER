import { useRouter } from 'next/router';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
      style={{ background: '#172D47', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.5" className="w-5 h-5 text-white">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
