// lib/server/aiRequestDedup.js — server-instance in-flight dedup for AI work (Step 13).
//
// Collapses identical concurrent Gemini computations (same route + same
// prompt-defining input) into ONE execution. NOT a persistent cache (entries
// cleared in finally). Never includes the API key; emails are reduced to a safe
// non-reversible scope hash only where a route is user-specific. Server-only.

'use strict';

const IS_DEV = process.env.NODE_ENV !== 'production';
const registry = new Map();

function emit(event, payload) {
  if (!IS_DEV) return;
  try { console.debug(`[apidiag] ${JSON.stringify({ kind: 'ai-dedup', event, ...payload })}`); } catch {}
}

// djb2 → base36; used to keep prompt text out of keys/logs.
function hash(value) {
  const s = String(value || '');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Build a deterministic, privacy-safe key from the prompt-defining parts.
// `parts` is an array of primitives; route is the prompt type. No API key, no
// raw email (callers pass an already-hashed scope when user-specific).
function buildAiDedupKey(route, parts = []) {
  return `${route}|${hash(parts.map(p => (p == null ? '' : String(p))).join(''))}`;
}

// Run `loader` deduped by key. Identical concurrent keys share one Promise;
// different keys run independently. Errors/timeouts propagate to all callers.
function dedupeAiRequest(key, loader) {
  const existing = registry.get(key);
  if (existing) { emit('ai-inflight-reused', { key, active: registry.size }); return existing; }
  const p = (async () => loader())();
  registry.set(key, p);
  emit('ai-inflight-new', { key, active: registry.size });
  p.then(
    () => { registry.delete(key); emit('ai-inflight-cleared', { active: registry.size }); },
    () => { registry.delete(key); emit('ai-inflight-failed', { active: registry.size }); }
  ).catch(() => {});
  return p;
}

function __getAiInflightCount() { return registry.size; }

module.exports = { buildAiDedupKey, dedupeAiRequest, hash, __getAiInflightCount };
