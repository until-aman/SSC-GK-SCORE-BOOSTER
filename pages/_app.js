import { SessionProvider } from 'next-auth/react';
import { Analytics } from '@vercel/analytics/react';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

  // Create once per app mount — factory prevents recreation on re-renders
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 24 h — no background refetch within that window
        staleTime: 1000 * 60 * 60 * 24,
        // Keep inactive cache for 7 days so SPA navigation is always instant
        gcTime: 1000 * 60 * 60 * 24 * 7,
        // Don't hammer the API on window refocus
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
