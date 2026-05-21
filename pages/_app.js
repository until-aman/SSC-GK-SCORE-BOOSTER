import { SessionProvider } from 'next-auth/react';
import { Analytics } from '@vercel/analytics/react';
import '@/styles/globals.css';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-[#080e1a] flex justify-center">
        <div
          className="w-full max-w-[430px] min-h-screen bg-[#0f172a] relative overflow-x-hidden flex flex-col"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Component {...pageProps} />
          <Analytics />
        </div>
      </div>
    </SessionProvider>
  );
}
