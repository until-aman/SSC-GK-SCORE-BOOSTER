import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SavedRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/history?section=saved');
  }, [router]);

  return null;
}
