/**
 * lib/server/sheetsReadDedup.js  (server-only; CommonJS)
 *
 * In-flight deduplication for identical physical Google Sheets READS. If two
 * helpers/routes request the exact same `values.get` / `values.batchGet` while
 * the first physical Google API call is still pending, only one physical read
 * runs; all callers reuse the same Promise.
 *
 * NOT a cache: resolved/rejected Promises are removed immediately. No TTL, no
 * persisted data, no timers, no new dependency. Server-process-local only —
 * must never be imported into client bundles (it is only used by lib/sheets.js
 * via getSheetsClient, which is server-side).
 *
 * Eligible (read) methods: `values.get`, `values.batchGet`.
 * Everything else (all writes + dataFilter variants) passes straight through.
 *
 * Exposes: dedupeSheetsReads(client), buildSheetsReadKey(method, params),
 *          __getSheetsInflightCount().
 */

'use strict';

const IS_DEV = process.env.NODE_ENV !== 'production';

// Active-read registry: dedupeKey → Promise. Server-process-local.
const registry = new Map();

// Only these read methods are eligible for dedup (defensive allowlist —
// never "starts with get"). Writes are intentionally absent.
const ELIGIBLE_READ_METHODS = ['get', 'batchGet'];

function emit(event, payload) {
  if (!IS_DEV) return;
  try {
    console.debug(`[apidiag] ${JSON.stringify({ kind: 'sheet-dedup', event, ...payload })}`);
  } catch {
    /* never throw from diagnostics */
  }
}

function s(v) {
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Deterministic key for a physical read. Includes every parameter that can
 * change the result; never credentials/auth/requestId/route. Range-array order
 * is PRESERVED (not sorted) so two batchGets with different range order do not
 * incorrectly share a Promise.
 */
function buildSheetsReadKey(method, params = {}) {
  if (method === 'values.batchGet') {
    const ranges = Array.isArray(params.ranges) ? params.ranges.map(s).join(',') : s(params.ranges);
    return [
      'values.batchGet',
      s(params.spreadsheetId),
      ranges,
      s(params.majorDimension),
      s(params.valueRenderOption),
      s(params.dateTimeRenderOption),
    ].join('|');
  }
  // values.get
  return [
    'values.get',
    s(params.spreadsheetId),
    s(params.range),
    s(params.majorDimension),
    s(params.valueRenderOption),
    s(params.dateTimeRenderOption),
  ].join('|');
}

function tabFromParams(params) {
  const range = params && (params.range || (Array.isArray(params.ranges) ? params.ranges[0] : params.ranges));
  if (!range || typeof range !== 'string') return null;
  const bang = range.indexOf('!');
  return bang === -1 ? range : range.slice(0, bang);
}

/**
 * Wrap a sheets client's `values.get` / `values.batchGet` with in-flight dedup.
 * Active in ALL environments (this is a real optimisation, not diagnostics).
 * Dev-only structured events are emitted for observability.
 *
 * IMPORTANT: apply this OUTSIDE the Step-2 diagnostics wrapper, i.e.
 *   dedupeSheetsReads(instrumentSheetsClient(client))
 * so the inner diagnostics records the physical read exactly once (only when a
 * NEW read actually invokes the underlying method); reused callers never reach
 * it, so no second physical `sheet` event is recorded.
 */
function dedupeSheetsReads(client) {
  if (!client || !client.spreadsheets || !client.spreadsheets.values) return client;
  const values = client.spreadsheets.values;

  ELIGIBLE_READ_METHODS.forEach((m) => {
    const method = `values.${m}`;
    const original = values[m];
    if (typeof original !== 'function') return;

    values[m] = function dedupedRead(params, ...rest) {
      const key = buildSheetsReadKey(method, params);

      const existing = registry.get(key);
      if (existing) {
        emit('sheet-inflight-reused', { operation: method, tab: tabFromParams(params), active: registry.size });
        return existing; // reuse — underlying method (and its physical log) NOT invoked
      }

      const startedAt = Date.now();
      let promise;
      try {
        promise = original.call(this, params, ...rest);
      } catch (err) {
        // synchronous failure — not registered
        throw err;
      }
      if (!promise || typeof promise.then !== 'function') {
        // non-thenable result — return untouched, no dedup
        return promise;
      }

      registry.set(key, promise);
      emit('sheet-inflight-new', { operation: method, tab: tabFromParams(params), active: registry.size });

      // Remove on success AND failure; guard the cleanup chain so it never
      // surfaces as an unhandled rejection (callers handle the real rejection).
      promise.then(
        () => { registry.delete(key); emit('sheet-inflight-cleared', { operation: method, active: registry.size, durationMs: Date.now() - startedAt }); },
        () => { registry.delete(key); emit('sheet-inflight-failed', { operation: method, active: registry.size, durationMs: Date.now() - startedAt }); }
      ).catch(() => {});

      return promise;
    };
  });

  return client;
}

function __getSheetsInflightCount() {
  return registry.size;
}

module.exports = {
  dedupeSheetsReads,
  buildSheetsReadKey,
  __getSheetsInflightCount,
  ELIGIBLE_READ_METHODS,
};
