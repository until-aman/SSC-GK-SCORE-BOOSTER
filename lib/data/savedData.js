import { fetchWithClientCache, getCacheKey, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_TTL } from '@/lib/cachePolicy';
import { buildUserScopedKey } from '@/lib/userCacheScope';

const SAVED_IDS_CACHE_KEY = 'saved_question_ids';
const SAVED_QUESTIONS_CACHE_KEY = 'saved_questions';

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'saved', event, ...extra })}`); } catch {}
}

export function getGuestSavedQuestions() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem('ssc_saved_questions') || localStorage.getItem('savedQuestions');
    if (!raw) return [];
    const questions = JSON.parse(raw);
    return Array.isArray(questions) ? questions : [];
  } catch {
    return [];
  }
}

// `scope` (from getUserCacheScope(session)) isolates an account's saved cache.
// Guest path (localStorage) is unchanged so guest→login migration still works.
export async function getSavedQuestionIds({ forceRefresh = false, isLoggedIn = false, scope = 'guest' } = {}) {
  if (!isLoggedIn) {
    return getGuestSavedQuestions()
      .map(q => q.questionId || q.id)
      .filter(Boolean);
  }

  return fetchWithClientCache({
    key: buildUserScopedKey(SAVED_IDS_CACHE_KEY, scope),
    url: '/api/saved-questions/ids',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

export async function getSavedQuestions({ forceRefresh = false, isLoggedIn = false, scope = 'guest' } = {}) {
  if (!isLoggedIn) return getGuestSavedQuestions();

  return fetchWithClientCache({
    key: buildUserScopedKey(SAVED_QUESTIONS_CACHE_KEY, scope),
    url: '/api/saved-questions',
    maxAgeMs: CACHE_TTL.TEN_MINUTES,
    forceRefresh,
  });
}

const qid = (q) => (q && (q.questionId || q.id)) ? String(q.questionId || q.id) : '';

// ── Cache patching (Step 11) — keep patched caches CURRENT (writeCache stamps now) ──
export function patchSavedIdsCache(scope, questionId, add) {
  if (typeof window === 'undefined' || !scope || scope === 'guest' || !questionId) return;
  const key = buildUserScopedKey(SAVED_IDS_CACHE_KEY, scope);
  const entry = readCache(key);
  if (!entry) return; // not cached yet → next open fetches fresh
  const data = entry.data || {};
  const ids = Array.isArray(data.savedIds) ? data.savedIds : [];
  const has = ids.includes(questionId);
  if (add && !has) writeCache(key, { ...data, savedIds: [...ids, questionId] });
  else if (!add && has) writeCache(key, { ...data, savedIds: ids.filter(id => id !== questionId) });
  else return;
  devLog('saved-cache-patched', { part: 'ids', add: Boolean(add) });
}

export function patchSavedListCache(scope, item, add) {
  if (typeof window === 'undefined' || !scope || scope === 'guest' || !qid(item)) return;
  const key = buildUserScopedKey(SAVED_QUESTIONS_CACHE_KEY, scope);
  const entry = readCache(key);
  if (!entry) return;
  const data = entry.data || {};
  const list = Array.isArray(data.saved) ? data.saved : [];
  const id = qid(item);
  const idx = list.findIndex(q => (q.questionId || q.id) === id);
  if (add) {
    if (idx !== -1) return;
    const next = [{ ...item, questionId: id, savedAt: item.savedAt || new Date().toISOString() }, ...list];
    writeCache(key, { ...data, saved: next });
  } else {
    if (idx === -1) return;
    writeCache(key, { ...data, saved: list.filter(q => (q.questionId || q.id) !== id) });
  }
  devLog('saved-cache-patched', { part: 'list', add: Boolean(add) });
}

// Mark this scope's History question/session caches stale (keep data; next open
// renders cached + 1 background refresh). Fixes the Step-9 saved-state lag.
export function markSavedHistoryCachesStale(scope) {
  if (typeof window === 'undefined' || !scope || scope === 'guest') return;
  try {
    let touched = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      const isHist = k.includes('history_questions:') || k.includes('history_session:') || k.includes('history_landing');
      if (!isHist || !k.includes(scope)) continue;
      const raw = localStorage.getItem(k);
      try {
        const e = JSON.parse(raw);
        if (e && typeof e.timestamp === 'number') { e.timestamp = 0; localStorage.setItem(k, JSON.stringify(e)); touched += 1; }
      } catch {}
    }
    if (touched) devLog('saved-history-cache-marked-stale', { touched });
  } catch {}
}

// Remove only the broken scoped Saved entry (no global clear).
export function dropSavedCache(scope, which = 'both') {
  if (typeof window === 'undefined') return;
  try {
    if (which === 'ids' || which === 'both') localStorage.removeItem(getCacheKey(buildUserScopedKey(SAVED_IDS_CACHE_KEY, scope)));
    if (which === 'list' || which === 'both') localStorage.removeItem(getCacheKey(buildUserScopedKey(SAVED_QUESTIONS_CACHE_KEY, scope)));
  } catch {}
}

// ── Mutations (NEVER routed through fetchWithClientCache) ─────────────────────
// Per question+action pending guard so a double-click shares one request and
// opposite actions / different questions are never merged.
const savedPending = new Map();

async function runSavedMutation(key, fn) {
  if (savedPending.has(key)) { devLog('saved-mutation-pending-reused', {}); return savedPending.get(key); }
  devLog('saved-mutation-start', {});
  const p = (async () => fn())().finally(() => savedPending.delete(key));
  savedPending.set(key, p);
  return p;
}

// Toggle route (save/unsave) — used by History/quiz-review screens.
export function toggleSavedQuestion({ scope, action, question }) {
  const questionId = qid(question);
  return runSavedMutation(`${scope}|${questionId}|${action}`, async () => {
    const res = await fetch('/api/saved-questions/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...question, questionId, action }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.success;
    if (ok) {
      const isSaved = Boolean(data.data?.isSaved);
      patchSavedIdsCache(scope, questionId, isSaved);
      patchSavedListCache(scope, { ...question, questionId }, isSaved);
      markSavedHistoryCachesStale(scope);
      devLog(data.data?.alreadySaved ? 'saved-mutation-already-state' : 'saved-mutation-success', {});
    } else { devLog('saved-mutation-failed', {}); }
    return { ok, isSaved: data.data?.isSaved, alreadySaved: Boolean(data.data?.alreadySaved) };
  });
}

// Top-level POST (save one) — used by the quiz player.
export function saveQuestion({ scope, question }) {
  const questionId = qid(question);
  return runSavedMutation(`${scope}|${questionId}|save`, async () => {
    const res = await fetch('/api/saved-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...question, questionId }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.ok;
    if (ok) {
      patchSavedIdsCache(scope, questionId, true);
      patchSavedListCache(scope, { ...question, questionId }, true);
      markSavedHistoryCachesStale(scope);
      devLog(data.alreadySaved ? 'saved-mutation-already-state' : 'saved-mutation-success', {});
    } else { devLog('saved-mutation-failed', {}); }
    return { ok, alreadySaved: Boolean(data.alreadySaved) };
  });
}

// Top-level DELETE (unsave one) — used by the quiz player.
export function unsaveQuestion({ scope, questionId }) {
  const id = String(questionId || '');
  return runSavedMutation(`${scope}|${id}|unsave`, async () => {
    const res = await fetch('/api/saved-questions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: id }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.ok;
    if (ok) {
      patchSavedIdsCache(scope, id, false);
      patchSavedListCache(scope, { questionId: id }, false);
      markSavedHistoryCachesStale(scope);
      devLog(data.notFound ? 'saved-mutation-already-state' : 'saved-mutation-success', {});
    } else { devLog('saved-mutation-failed', {}); }
    return { ok, notFound: Boolean(data.notFound) };
  });
}

// One batched guest→login migration POST (server appends only missing rows).
export async function migrateGuestSavedQuestions({ scope, questions }) {
  devLog('saved-guest-migration-start', { count: Array.isArray(questions) ? questions.length : 0 });
  const res = await fetch('/api/saved-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.ok && data.ok;
  if (ok) {
    // Merge migrated items into the scoped caches so the next open is warm.
    (questions || []).forEach(q => { patchSavedIdsCache(scope, qid(q), true); patchSavedListCache(scope, { ...q, questionId: qid(q) }, true); });
    devLog(data.failed ? 'saved-guest-migration-partial' : 'saved-guest-migration-success', { migrated: data.migrated, skipped: data.skipped, failed: data.failed });
  } else { devLog('saved-guest-migration-failed', {}); }
  return { ok, migrated: data.migrated || 0, skipped: data.skipped || 0, failed: data.failed || 0 };
}
