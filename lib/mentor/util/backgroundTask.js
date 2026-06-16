// lib/mentor/util/backgroundTask.js — Phase 10F2 background execution helper.
//
// Runs a promise as a post-response background task. On Vercel, registers it with
// `waitUntil` so the serverless function stays alive until it resolves — fixing the
// post-`res.json` freeze that truncated the old fire-and-forget rollover (Phase 10D
// FIX-3 / 10F). Locally / in tests (no Vercel runtime), falls back to a logged
// fire-and-forget. NEVER throws to the caller and never rejects: a failed task is
// logged, never surfaced to the HTTP response.
'use strict';

// Resolve Vercel `waitUntil` lazily and optionally, so this module works whether or not
// `@vercel/functions` is installed (a top-level import would break the build when absent).
function resolveWaitUntil() {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const mod = require('@vercel/functions');
    if (mod && typeof mod.waitUntil === 'function') return mod.waitUntil;
  } catch (_) { /* not on Vercel / dependency absent — use the fallback */ }
  return null;
}

/**
 * @param {Promise} promise   the background work
 * @param {string}  label     log label
 * @param {Object}  [opts]
 * @param {Function} [opts.waitUntil]  inject a waitUntil fn (tests); defaults to Vercel's
 * @returns {{ mode: 'waitUntil' | 'fire-and-forget' }}
 */
function runBackgroundTask(promise, label = 'background-task', opts = {}) {
  // Explicit injection wins (a function uses it; an explicit `null` forces the fallback,
  // which lets tests assert the fallback deterministically even when @vercel/functions is
  // installed). Only resolve Vercel's waitUntil when `waitUntil` is not provided at all.
  const waitUntil = Object.prototype.hasOwnProperty.call(opts, 'waitUntil') ? opts.waitUntil : resolveWaitUntil();
  // Guard so a rejection is ALWAYS handled (no unhandled rejection, no caller throw).
  const guarded = Promise.resolve()
    .then(() => promise)
    .catch(err => { console.error(`[${label}] background task failed`, err && err.message, err && err.stack); });
  if (typeof waitUntil === 'function') {
    waitUntil(guarded);
    return { mode: 'waitUntil' };
  }
  // Fallback (local/dev/tests). On Vercel without waitUntil this could be truncated, so
  // callers that REQUIRE completion in that environment should await instead.
  void guarded;
  return { mode: 'fire-and-forget' };
}

module.exports = { runBackgroundTask, resolveWaitUntil };
