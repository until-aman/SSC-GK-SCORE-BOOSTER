/**
 * lib/userCacheScope.js  (browser-safe; ESM)
 *
 * Account scoping for client caches. Prevents one authenticated account's
 * cached data from being read by another account on the same browser.
 *
 * - No Node crypto (browser-safe djb2 hash, no new dependency).
 * - Never stores tokens, secrets, full session objects, or plain emails in keys.
 * - Scope generation is synchronous and falls back to 'guest' on missing data.
 *
 * Exposed functions (Step 4 PHASE B):
 *   getUserCacheScope(session)         → 'guest' | 'u_<hash>'
 *   buildUserScopedKey(baseKey, sessionOrScope) → '<baseKey>:<scope>'
 *   isGuestScope(scope)
 *   clearUserScopedKeys()              → removes unscoped/shared user-specific keys
 *   migrateLegacyUserCacheKey(...)     → best-effort, ownership-verified
 *   reconcileCacheScope(session)       → central transition handler (PHASE G/H)
 *
 * Authenticated key format: `<baseKey>:u_<djb2(email)>`  e.g. `saved_questions:u_1a2b3c`
 */

import { CACHE_VERSION } from './cachePolicy';

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
const SCOPE_MARKER_KEY = 'active_user_cache_scope';

// ── djb2 hash → base36 (deterministic, non-reversible enough for key naming) ──
function hashIdentity(value) {
  const s = String(value || '').toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try {
    console.debug(`[apidiag] ${JSON.stringify({ kind: 'cache-scope', event, ...extra })}`);
  } catch {}
}

// ── 1. getUserCacheScope ─────────────────────────────────────────────────────
export function getUserCacheScope(session) {
  const email = session?.user?.email;
  if (!email || typeof email !== 'string') return 'guest';
  return `u_${hashIdentity(email)}`;
}

// ── 2. buildUserScopedKey ────────────────────────────────────────────────────
export function buildUserScopedKey(baseKey, sessionOrScope) {
  const scope = typeof sessionOrScope === 'string'
    ? (sessionOrScope || 'guest')
    : getUserCacheScope(sessionOrScope);
  return `${baseKey}:${scope}`;
}

// ── 3. isGuestScope ──────────────────────────────────────────────────────────
export function isGuestScope(scope) {
  return !scope || scope === 'guest';
}

// ── Key sets cleared on account change ───────────────────────────────────────
// Unscoped / cross-account-shared user-specific keys (the real leak vectors).
// Account-scoped keys (…:u_<hash>) are isolated and intentionally NOT cleared,
// so a returning account can reuse its still-fresh cache.
const EXACT_USER_KEYS = [
  'mentor_today_plan',
  'mentor_profile_cache',
  'mentor_onboarded',
  'analysisInterestRecorded',
  'ssc_revised_questions',
  'ssc_understood_questions',
  'ssc_reminder_hour',
  'ssc_reminder_scheduled',
  `${CACHE_VERSION}:user_profile`,
  `${CACHE_VERSION}:history`,
  // Legacy UNSCOPED versions of the now-scoped reusable caches:
  `${CACHE_VERSION}:dashboard_bootstrap`,
  `${CACHE_VERSION}:saved_question_ids`,
  `${CACHE_VERSION}:saved_questions`,
];

// Prefix matches: shared / legacy mentor snapshots. `mentor_snapshot_v2:account:`
// is shared by ALL accounts (a leak); legacy `mentor_snapshot_v3:<email>:` used a
// plain email. We clear those but keep new `mentor_snapshot_v3:u_<hash>:` (isolated).
function isClearablePrefixKey(key) {
  if (key.startsWith('mentor_snapshot_v2:')) return true;          // shared :account: leak
  if (key.startsWith('mentor_snapshot_v3:') && key.includes('@')) return true; // legacy plain-email
  return false;
}

// Guest saved-question keys are deliberately preserved here so the existing
// guest→login migration still works.
export function clearUserScopedKeys() {
  if (typeof window === 'undefined') return 0;
  let removed = 0;
  try {
    EXACT_USER_KEYS.forEach((k) => {
      if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); removed += 1; }
    });
    const prefixHits = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && isClearablePrefixKey(key)) prefixHits.push(key);
    }
    prefixHits.forEach((k) => { localStorage.removeItem(k); removed += 1; });
  } catch {}
  return removed;
}

// ── 4. migrateLegacyUserCacheKey ─────────────────────────────────────────────
/**
 * Move a legacy unscoped value to the account-scoped key ONLY when ownership is
 * verifiable from the payload (e.g. payload.email matches the session). Otherwise
 * the legacy value is discarded. Idempotent.
 */
export function migrateLegacyUserCacheKey({ legacyKey, baseKey, session, verifyOwner }) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(legacyKey);
    if (raw === null) return false;
    const scope = getUserCacheScope(session);
    if (isGuestScope(scope)) return false;

    let owned = false;
    try {
      const parsed = JSON.parse(raw);
      owned = typeof verifyOwner === 'function' ? Boolean(verifyOwner(parsed, session)) : false;
    } catch { owned = false; }

    if (owned) {
      const scopedKey = buildUserScopedKey(baseKey, scope);
      if (localStorage.getItem(scopedKey) === null) localStorage.setItem(scopedKey, raw);
      localStorage.removeItem(legacyKey);
      devLog('legacy-migrated', { key: legacyKey, to: scope });
      return true;
    }
    localStorage.removeItem(legacyKey);
    devLog('legacy-discarded-unverified', { key: legacyKey });
    return false;
  } catch {
    return false;
  }
}

// ── 5. reconcileCacheScope — central session transition handler ──────────────
/**
 * Call whenever the session identity may have changed. Compares the stored scope
 * marker to the current one; on change, clears unscoped/shared user-specific
 * caches (so the new account never sees the previous account's data) and updates
 * the marker. Idempotent — does nothing when the scope is unchanged.
 *
 * @returns {{ changed: boolean, from: string, to: string }}
 */
export function reconcileCacheScope(session) {
  if (typeof window === 'undefined') return { changed: false, from: 'guest', to: 'guest' };
  const to = getUserCacheScope(session);
  let from = 'guest';
  try { from = localStorage.getItem(SCOPE_MARKER_KEY) || 'guest'; } catch {}

  if (from === to) return { changed: false, from, to };

  const removed = clearUserScopedKeys();
  try { localStorage.setItem(SCOPE_MARKER_KEY, to); } catch {}
  devLog('scope-changed', { from, to, cleared: removed });
  return { changed: true, from, to };
}

export const ACTIVE_SCOPE_MARKER_KEY = SCOPE_MARKER_KEY;
