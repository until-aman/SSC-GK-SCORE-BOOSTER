import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { reconcileCacheScope, getUserCacheScope } from '@/lib/userCacheScope';

/**
 * Central client-cache account-transition handler. Mounted once inside the
 * SessionProvider. On every account-identity change (guest→A, A→guest, A→B,
 * expired→guest) it clears unscoped/shared user-specific caches so the new
 * account never sees the previous account's data. No-op when scope is unchanged.
 *
 * Renders nothing. Does not modify session/NextAuth behaviour.
 */
export default function CacheScopeGuard() {
  const { data: session, status } = useSession();
  const lastScopeRef = useRef(null);

  useEffect(() => {
    // Wait until the session identity is known — never reconcile on 'loading'.
    if (status === 'loading') return;
    const scope = getUserCacheScope(session);
    if (lastScopeRef.current === scope) return;
    lastScopeRef.current = scope;
    reconcileCacheScope(session);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.email]);

  return null;
}
