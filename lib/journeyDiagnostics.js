/**
 * lib/journeyDiagnostics.js  (client-safe; ESM)
 *
 * Development-only frontend journey markers. Emits the same `[apidiag]` JSON
 * line shape as lib/apiDiagnostics.js so one summarizer can parse client +
 * server events together.
 *
 * Imports nothing server-only (no async_hooks / googleapis), so it is safe in
 * the browser bundle. No-op in production. Never changes when a call runs.
 *
 * Usage:
 *   import { markJourney } from '@/lib/journeyDiagnostics';
 *   markJourney({ journey: 'mentor', route: '/api/mentor/plan', trigger: 'mount',
 *                 cache: 'bypass', helper: 'direct', user: email });
 */

function maskUser(value) {
  if (!value) return 'guest';
  const s = String(value);
  const at = s.indexOf('@');
  if (at === -1) return s.length <= 3 ? `${s[0]}***` : `${s.slice(0, 2)}***`;
  const name = s.slice(0, at);
  const domain = s.slice(at + 1);
  const maskedName = name.length <= 2 ? `${name[0] || ''}***` : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

export function markJourney({ journey, route, trigger, cache, helper, user } = {}) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    console.debug(`[apidiag] ${JSON.stringify({
      kind: 'journey',
      journey: journey || null,
      route: route || null,
      trigger: trigger || null,
      cache: cache || null,          // 'used' | 'bypass' | 'n/a'
      helper: helper || null,        // 'direct' | 'shared-helper'
      user: maskUser(user),
      ts: Date.now(),
    })}`);
  } catch {
    /* never throw from diagnostics */
  }
}

export { maskUser as maskJourneyUser };
