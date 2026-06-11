// lib/data/aiData.js — shared CLIENT AI helper (Step 13).
//
// Centralizes the four existing AI POST routes with: bounded localStorage
// caching of small successful text, client in-flight dedup, and the existing
// fallback semantics. AI POSTs are NEVER routed through fetchWithClientCache.
// No API key or prompt/response is ever logged. Question-level output is keyed
// by a content hash; result-level output is account-scoped + attempt-keyed.

const AI_TIMEOUT_MS = 3000;          // unchanged from lib/fetchAI.js
const AI_CACHE_VERSION = 'v1';
const Q_PREFIX = `ai_q:${AI_CACHE_VERSION}:`;       // explain + tip (question-level)
const R_PREFIX = `ai_r:${AI_CACHE_VERSION}:`;       // summary / result-insights (attempt-level)
const Q_TTL = 7 * 24 * 60 * 60 * 1000;              // 7 days
const R_TTL = 24 * 60 * 60 * 1000;                  // 24 hours
const MAX_Q_ENTRIES = 150;                          // explanation/tip per browser
const MAX_R_ENTRIES = 20;                           // attempt insights per account

const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
function devLog(event, extra = {}) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'ai', event, ...extra })}`); } catch {}
}

// djb2 → base36. Keeps question text / personal data OUT of cache keys.
function hash(value) {
  const s = String(value || '');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// ── Bounded localStorage cache ───────────────────────────────────────────────
function readAICache(key, ttl) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.timestamp !== 'number' || typeof entry.data !== 'string') { localStorage.removeItem(key); return null; }
    if (Date.now() - entry.timestamp > ttl) return null; // expired (kept until eviction)
    return entry.data;
  } catch { try { localStorage.removeItem(key); } catch {} return null; }
}

function evict(prefix, max) {
  try {
    const entries = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        let ts = 0;
        try { ts = JSON.parse(localStorage.getItem(k)).timestamp || 0; } catch { ts = -1; /* malformed → evict first */ }
        entries.push({ k, ts });
      }
    }
    if (entries.length <= max) return;
    entries.sort((a, b) => a.ts - b.ts); // oldest (and malformed) first
    const removeCount = entries.length - max;
    for (let i = 0; i < removeCount; i += 1) { localStorage.removeItem(entries[i].k); devLog('ai-cache-evicted', { prefix }); }
  } catch {}
}

function writeAICache(key, text, prefix, max) {
  if (typeof window === 'undefined' || !text) return;
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: text }));
    evict(prefix, max);
    devLog('ai-cache-write', {});
  } catch {
    // localStorage full / blocked → non-fatal; try one eviction then give up.
    try { evict(prefix, Math.floor(max / 2)); localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: text })); }
    catch { devLog('ai-cache-write-failed', {}); }
  }
}

// ── Client in-flight dedup ────────────────────────────────────────────────────
const inflight = new Map();
async function dedupedPost(dedupeKey, url, body, fallback) {
  if (inflight.has(dedupeKey)) { devLog('ai-inflight-reused', {}); return inflight.get(dedupeKey); }
  devLog('ai-inflight-new', {});
  const p = (async () => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) { devLog('ai-fallback-used', { reason: 'status' }); return { text: fallback, source: 'fallback' }; }
      const data = await res.json().catch(() => ({}));
      return { data, source: 'ai' };
    } catch {
      clearTimeout(tid);
      devLog('ai-fallback-used', { reason: 'timeout-or-error' });
      return { text: fallback, source: 'fallback' };
    }
  })().finally(() => { inflight.delete(dedupeKey); });
  inflight.set(dedupeKey, p);
  return p;
}

// ── Explain (Category 2 — user-answer-specific) ──────────────────────────────
export async function getAIExplanation({ question, optionA, optionB, optionC, optionD, correctOption, userOption, sheetExplanation, subject, topic }) {
  const fallback = sheetExplanation || 'Review this concept in your study material.';
  // Key includes selected answer because the prompt references it.
  const key = `${Q_PREFIX}explain:${hash([question, correctOption, userOption].join('|'))}`;
  const cached = readAICache(key, Q_TTL);
  if (cached) { devLog('ai-cache-hit', { kind: 'explain' }); return { text: cached, source: 'ai' }; }
  devLog('ai-cache-miss', { kind: 'explain' });
  const result = await dedupedPost(key, '/api/ai/explain',
    { question, optionA, optionB, optionC, optionD, correctOption, userOption, explanation: sheetExplanation, subject, topic }, fallback);
  if (result.source === 'fallback') return result;
  const text = result.data?.aiExplanation || result.data?.fallback || fallback;
  if (result.data?.aiExplanation) writeAICache(key, text, Q_PREFIX, MAX_Q_ENTRIES); // never cache a fallback as success
  return { text, source: 'ai' };
}

// ── Tip (Category 1 — question-content deterministic, no selected answer) ─────
export async function getAITip({ question, correctOption, correctOptionText, sheetExplanation, subject, topic }) {
  const fallback = sheetExplanation || 'Review this concept in your study material.';
  const key = `${Q_PREFIX}tip:${hash([question, correctOption].join('|'))}`;
  const cached = readAICache(key, Q_TTL);
  if (cached) { devLog('ai-cache-hit', { kind: 'tip' }); return { text: cached, source: 'ai' }; }
  devLog('ai-cache-miss', { kind: 'tip' });
  const result = await dedupedPost(key, '/api/ai/tip',
    { question, correctOption, correctOptionText, explanation: sheetExplanation, subject, topic }, fallback);
  if (result.source === 'fallback') return result;
  const text = result.data?.aiTip || result.data?.fallback || fallback;
  if (result.data?.aiTip) writeAICache(key, text, Q_PREFIX, MAX_Q_ENTRIES);
  return { text, source: 'ai' };
}

// ── Result insights (Category 3 — attempt-specific, account-scoped) ──────────
export async function getAIResultInsights({ scope, sessionId, payload }) {
  const accuracy = payload?.accuracy ?? (payload?.totalQuestions ? Math.round((payload.correctAnswers / payload.totalQuestions) * 100) : 0);
  const fallback = `You scored ${payload?.rawScore ?? 0} marks with ${accuracy}% accuracy. Keep practicing to improve!`;
  if (!sessionId) {
    const r = await dedupedPost(`${R_PREFIX}nokey:${Date.now()}`, '/api/ai/result-insights', payload, fallback);
    return r.source === 'fallback' ? r : { text: r.data?.aiSummary || r.data?.summary || fallback, source: 'ai' };
  }
  const key = `${R_PREFIX}insights:${scope || 'guest'}:${sessionId}`;
  const cached = readAICache(key, R_TTL);
  if (cached) { devLog('ai-result-attempt-cache-hit', {}); return { text: cached, source: 'ai' }; }
  devLog('ai-cache-miss', { kind: 'insights' });
  const result = await dedupedPost(key, '/api/ai/result-insights', payload, fallback);
  if (result.source === 'fallback') return result;
  const text = result.data?.aiSummary || result.data?.summary || '';
  if (!text) return { text: fallback, source: 'fallback' }; // empty → not cached as success
  writeAICache(key, text, R_PREFIX, MAX_R_ENTRIES);
  return { text, source: 'ai' };
}

// Read-only attempt-insight cache lookup (no network) — for a result mount that
// should display previously generated insight without triggering a Gemini call.
export function readAIInsightsCache({ scope, sessionId }) {
  if (!sessionId) return null;
  const text = readAICache(`${R_PREFIX}insights:${scope || 'guest'}:${sessionId}`, R_TTL);
  if (text) devLog('ai-result-attempt-cache-hit', {});
  return text;
}

export function __getAIInflightCount() { return inflight.size; }
