import { SessionProvider } from 'next-auth/react';
import { Analytics } from '@vercel/analytics/react';
import { useRouter } from 'next/router';
import PageLoader from '@/components/ui/PageLoader';
import BottomNav from '@/components/BottomNav';
import '@/styles/globals.css';

const BOTTOM_NAV_ROUTES = [
  '/dashboard',
  '/leaderboard',
  '/saved',
  '/profile',
  '/result',
];

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  const showNav = BOTTOM_NAV_ROUTES.includes(router.pathname);

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen app-premium-bg flex justify-center">
        <div
          className="w-full max-w-[430px] min-h-screen app-premium-bg relative overflow-x-clip flex flex-col"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <PageLoader />
          <Component {...pageProps} />
          <Analytics />
        </div>

        {/* BottomNav lives OUTSIDE the overflow container so position:fixed always works */}
        {showNav && <BottomNav />}
      </div>
    </SessionProvider>
  );
}
