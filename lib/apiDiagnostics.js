/**
 * lib/apiDiagnostics.js  (CommonJS — interops with both `require` and `import`)
 *
 * Development-only API / cache / Google Sheets diagnostics.
 *
 * HARD RULE: every export is a no-op when NODE_ENV === 'production'.
 * Nothing here changes response shapes, Sheet ranges, cache TTLs, or runtime
 * behaviour. It only emits structured `console.debug` lines (dev) and counts
 * physical operations for baseline measurement.
 *
 * Final exported names (Step 2 TASK A):
 *   createRequestId, maskUserIdentifier,
 *   startApiTrace, runWithTrace, getCurrentTrace, setTraceUser,
 *   markGemini, markServerCacheHit,
 *   recordCacheEvent, recordSheetRead, recordSheetWrite, finishApiTrace,
 *   withApiTrace, instrumentSheetsClient, IS_DIAGNOSTICS_ENABLED
 *
 * Never logs: private keys, credentials, OAuth tokens, full session, cookies,
 * authorization headers, full emails, or full question/history payloads.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

// ── AsyncLocalStorage (Node runtime only; dev only) ──────────────────────────
let als = null;
if (IS_DEV) {
  try {
    const { AsyncLocalStorage } = require('async_hooks');
    als = new AsyncLocalStorage();
  } catch {
    als = null;
  }
}

let _counter = 0;

function emit(kind, payload) {
  if (!IS_DEV) return;
  try {
    console.debug(`[apidiag] ${JSON.stringify({ kind, ...payload })}`);
  } catch {
    /* never throw from diagnostics */
  }
}

function createRequestId() {
  _counter = (_counter + 1) % 1_000_000;
  return `req_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

function maskUserIdentifier(value) {
  if (!value) return 'guest';
  const s = String(value);
  const at = s.indexOf('@');
  if (at === -1) return s.length <= 3 ? `${s[0]}***` : `${s.slice(0, 2)}***`;
  const name = s.slice(0, at);
  const domain = s.slice(at + 1);
  const maskedName = name.length <= 2 ? `${name[0] || ''}***` : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

function startApiTrace({ route, method, user } = {}) {
  if (!IS_DEV) return null;
  return {
    requestId: createRequestId(),
    route: route || 'unknown',
    method: method || 'GET',
    user: maskUserIdentifier(user),
    startedAt: Date.now(),
    durationMs: null,
    statusCode: null,
    cacheStatus: null,
    serverCacheHit: false,
    geminiCalled: false,
    sheetReads: 0,
    sheetWrites: 0,
    sheetTabs: new Set(),
    sheetOps: [],
  };
}

function runWithTrace(trace, fn) {
  if (!IS_DEV || !als || !trace) return fn();
  return als.run(trace, fn);
}

function getCurrentTrace() {
  if (!IS_DEV || !als) return null;
  return als.getStore() || null;
}

function setTraceUser(value) {
  if (!IS_DEV) return;
  const t = getCurrentTrace();
  if (t) t.user = maskUserIdentifier(value);
}

function markGemini() {
  if (!IS_DEV) return;
  const t = getCurrentTrace();
  if (t) t.geminiCalled = true;
}

function markServerCacheHit() {
  if (!IS_DEV) return;
  const t = getCurrentTrace();
  if (t) t.serverCacheHit = true;
}

function recordCacheEvent(trace, evt = {}) {
  if (!IS_DEV) return;
  const t = trace || getCurrentTrace();
  if (t) t.cacheStatus = evt.status || t.cacheStatus;
  emit('cache', {
    requestId: t?.requestId || null,
    key: evt.key || null,
    status: evt.status || null,
    source: evt.source || null,
    url: evt.url || null,
    maxAgeMs: evt.maxAgeMs ?? null,
    ageMs: evt.ageMs ?? null,
    ranNetwork: evt.ranNetwork ?? null,
    usedStale: evt.usedStale ?? null,
    forceRefresh: evt.forceRefresh ?? null,
  });
}

function recordSheetOp(kind, trace, op = {}) {
  if (!IS_DEV) return;
  const t = trace || getCurrentTrace();
  if (t) {
    if (kind === 'read') t.sheetReads += 1;
    else t.sheetWrites += 1;
    if (op.tab) t.sheetTabs.add(op.tab);
    t.sheetOps.push({ kind, tab: op.tab, operation: op.operation, durationMs: op.durationMs, ok: op.ok });
  }
  emit('sheet', {
    requestId: t?.requestId || null,
    rw: kind,
    tab: op.tab || null,
    range: op.range || null,
    operation: op.operation || null,
    durationMs: op.durationMs ?? null,
    ok: op.ok ?? null,
  });
}

function recordSheetRead(trace, op) {
  recordSheetOp('read', trace, op);
}

function recordSheetWrite(trace, op) {
  recordSheetOp('write', trace, op);
}

function categorizeError(error) {
  const name = error?.name || 'Error';
  const code = error?.code || error?.status || null;
  return code ? `${name}:${code}` : name;
}

function finishApiTrace(trace, { statusCode, error } = {}) {
  if (!IS_DEV || !trace) return;
  trace.durationMs = Date.now() - trace.startedAt;
  if (typeof statusCode === 'number') trace.statusCode = statusCode;
  emit('api', {
    requestId: trace.requestId,
    route: trace.route,
    method: trace.method,
    user: trace.user,
    statusCode: trace.statusCode,
    durationMs: trace.durationMs,
    cacheStatus: trace.cacheStatus,
    serverCacheHit: trace.serverCacheHit,
    geminiCalled: trace.geminiCalled,
    sheetReads: trace.sheetReads,
    sheetWrites: trace.sheetWrites,
    sheetTabs: Array.from(trace.sheetTabs),
    errorCategory: error ? categorizeError(error) : null,
  });
}

/**
 * Wraps a Next.js API handler. Production → original handler unchanged (zero
 * overhead). Development → opens an AsyncLocalStorage trace so central Sheet/
 * cache events associate to this route, and logs a route summary on finish.
 */
function withApiTrace(route, handler) {
  if (!IS_DEV) return handler;
  return async function tracedHandler(req, res) {
    const trace = startApiTrace({ route, method: req?.method });
    return runWithTrace(trace, async () => {
      const originalStatus = res.status.bind(res);
      res.status = (code) => {
        trace.statusCode = code;
        return originalStatus(code);
      };
      try {
        const result = await handler(req, res);
        finishApiTrace(trace, { statusCode: trace.statusCode ?? res.statusCode });
        return result;
      } catch (err) {
        finishApiTrace(trace, { statusCode: 500, error: err });
        throw err;
      }
    });
  };
}

const READ_METHODS = ['get', 'batchGet', 'batchGetByDataFilter'];
const WRITE_METHODS = ['append', 'update', 'batchUpdate', 'batchUpdateByDataFilter', 'clear'];

function tabFromRange(range) {
  if (!range || typeof range !== 'string') return null;
  const bang = range.indexOf('!');
  return bang === -1 ? range : range.slice(0, bang);
}

/**
 * Wraps google.sheets() so each physical values.* call is timed + counted.
 * Dev-only; production returns the client untouched. Args/return preserved.
 */
function instrumentSheetsClient(client) {
  if (!IS_DEV || !client || !client.spreadsheets || !client.spreadsheets.values) return client;

  const values = client.spreadsheets.values;
  const wrapMethod = (methodName, isRead) => {
    const original = values[methodName];
    if (typeof original !== 'function') return;
    values[methodName] = function wrappedValuesMethod(params, ...rest) {
      const startedAt = Date.now();
      const rawRange = params && (params.range || (params.ranges ? params.ranges.join(',') : null));
      const tab = tabFromRange(Array.isArray(rawRange) ? rawRange[0] : rawRange);
      const operation = `values.${methodName}`;
      const record = isRead ? recordSheetRead : recordSheetWrite;
      let p;
      try {
        p = original.call(this, params, ...rest);
      } catch (err) {
        record(null, { tab, range: rawRange, operation, durationMs: Date.now() - startedAt, ok: false });
        throw err;
      }
      if (p && typeof p.then === 'function') {
        return p.then(
          (val) => { record(null, { tab, range: rawRange, operation, durationMs: Date.now() - startedAt, ok: true }); return val; },
          (err) => { record(null, { tab, range: rawRange, operation, durationMs: Date.now() - startedAt, ok: false }); throw err; }
        );
      }
      record(null, { tab, range: rawRange, operation, durationMs: Date.now() - startedAt, ok: true });
      return p;
    };
  };

  READ_METHODS.forEach((m) => wrapMethod(m, true));
  WRITE_METHODS.forEach((m) => wrapMethod(m, false));
  return client;
}

module.exports = {
  IS_DIAGNOSTICS_ENABLED: IS_DEV,
  createRequestId,
  maskUserIdentifier,
  startApiTrace,
  runWithTrace,
  getCurrentTrace,
  setTraceUser,
  markGemini,
  markServerCacheHit,
  recordCacheEvent,
  recordSheetRead,
  recordSheetWrite,
  finishApiTrace,
  withApiTrace,
  instrumentSheetsClient,
};
