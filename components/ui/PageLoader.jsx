import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Loader from './Loader';

const ROUTE_LABELS = {
  '/':              'Going home…',
  '/dashboard':     'Loading dashboard…',
  '/quiz':          'Setting up your quiz…',
  '/result/detailed': 'Loading detailed analysis…',
  '/leaderboard':   'Fetching the leaderboard…',
  '/quiz-setup':    'Setting up your quiz…',
  '/saved':         'Loading saved questions…',
  '/history':       'Loading Coins history…',
  '/profile':       'Loading profile…',
};

function getLabel(url) {
  const path = url.split('?')[0];
  return ROUTE_LABELS[path] || 'Loading…';
}

export default function PageLoader() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [label, setLabel]     = useState('Loading…');

  useEffect(() => {
    function onStart(url) {
      setLabel(getLabel(url));
      setLoading(true);
    }
    function onEnd() {
      setLoading(false);
    }

    router.events.on('routeChangeStart',    onStart);
    router.events.on('routeChangeComplete', onEnd);
    router.events.on('routeChangeError',    onEnd);

    return () => {
      router.events.off('routeChangeStart',    onStart);
      router.events.off('routeChangeComplete', onEnd);
      router.events.off('routeChangeError',    onEnd);
    };
  }, [router]);

  if (!loading) return null;
  return <Loader fullScreen size="lg" label={label} />;
}
