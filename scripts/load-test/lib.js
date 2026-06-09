// scripts/load-test/lib.js — shared safe load-test runner (Step 17).
//
// Hard safety contract (do NOT weaken):
//   • requires an explicit BASE_URL (no default);
//   • REJECTS production-looking hostnames unless a deliberate override is set;
//   • requires ALLOW_STAGING_LOAD_TEST=true to run at all;
//   • conservative defaults; finite duration; aborts on high error rate;
//   • write tests require an extra CONFIRM_WRITE_TEST=YES flag;
//   • no credentials / no real emails in source.
//
// Uses Node built-in fetch (Node 18+). No new dependency.

'use strict';

// Hostnames that must NEVER be load-tested without a deliberate, documented
// override. Extend with the real production host before use.
const PRODUCTION_HOST_PATTERNS = [
  /sscgk/i, /score-?booster/i, /\.vercel\.app$/i, // adjust to the real prod host
];

function fail(msg) { console.error(`\n[load-test ABORT] ${msg}\n`); process.exit(2); }

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }));
  return args;
}

function assertSafeTarget() {
  if (process.env.ALLOW_STAGING_LOAD_TEST !== 'true') {
    fail('Set ALLOW_STAGING_LOAD_TEST=true to run any load test (staging only).');
  }
  const base = process.env.BASE_URL;
  if (!base) fail('BASE_URL is required (no default). Point it at a STAGING URL.');
  let host;
  try { host = new URL(base).host; } catch { fail(`BASE_URL is not a valid URL: ${base}`); }

  const looksProd = PRODUCTION_HOST_PATTERNS.some(re => re.test(host));
  const override = process.env.I_UNDERSTAND_THIS_IS_PRODUCTION === 'YES';
  if (looksProd && !override) {
    fail(`BASE_URL host "${host}" looks like PRODUCTION. Refusing. ` +
         `(If this is truly a disposable staging host that matches the pattern, set ` +
         `I_UNDERSTAND_THIS_IS_PRODUCTION=YES — discouraged; document why.)`);
  }
  if (looksProd && override) {
    console.warn(`[load-test WARNING] Production-pattern host overridden by operator: ${host}`);
  }
  return base.replace(/\/$/, '');
}

function assertWriteConfirmed() {
  if (process.env.CONFIRM_WRITE_TEST !== 'YES') {
    fail('Write/idempotency tests require CONFIRM_WRITE_TEST=YES and a TEST Google Sheet. Refusing.');
  }
}

// Bounded concurrency runner. Stops early if error rate exceeds maxErrorRate.
async function runLoad({ base, paths, vus = 10, durationSec = 30, maxErrorRate = 0.10, method = 'GET', bodyFor = null }) {
  console.log(`\n[load-test] target=${base} vus=${vus} duration=${durationSec}s method=${method} paths=${paths.length}`);
  const stats = { total: 0, ok: 0, errors: {}, latencies: [], startedAt: Date.now() };
  const deadline = Date.now() + durationSec * 1000;
  let stopped = false;

  async function oneRequest(p) {
    const url = base + p;
    const t0 = Date.now();
    try {
      const opts = { method };
      if (method !== 'GET' && bodyFor) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(bodyFor(p)); }
      const res = await fetch(url, opts);
      const dt = Date.now() - t0;
      stats.total += 1; stats.latencies.push(dt);
      if (res.ok) stats.ok += 1; else stats.errors[res.status] = (stats.errors[res.status] || 0) + 1;
    } catch (e) {
      stats.total += 1; stats.errors[e.name || 'network'] = (stats.errors[e.name || 'network'] || 0) + 1;
    }
  }

  async function worker() {
    let i = 0;
    while (!stopped && Date.now() < deadline) {
      await oneRequest(paths[i % paths.length]); i += 1;
      // Abort guard: once we have a sample, stop if error rate is too high.
      if (stats.total >= 20) {
        const errs = Object.values(stats.errors).reduce((a, b) => a + b, 0);
        if (errs / stats.total > maxErrorRate) { stopped = true; console.error(`[load-test] error rate ${(errs / stats.total * 100).toFixed(1)}% > ${(maxErrorRate * 100)}% — stopping.`); }
      }
    }
  }

  await Promise.all(Array.from({ length: vus }, worker));
  return summarize(stats);
}

function pct(sorted, p) { if (!sorted.length) return 0; const i = Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length)); return sorted[i]; }

function summarize(stats) {
  const dur = (Date.now() - stats.startedAt) / 1000;
  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const errs = Object.values(stats.errors).reduce((a, b) => a + b, 0);
  const out = {
    total: stats.total, ok: stats.ok, errorCount: errs,
    successRate: stats.total ? +(stats.ok / stats.total * 100).toFixed(2) : 0,
    rps: +(stats.total / dur).toFixed(1),
    p50: pct(sorted, 50), p95: pct(sorted, 95), p99: pct(sorted, 99),
    errorsByStatus: stats.errors, durationSec: +dur.toFixed(1),
  };
  console.log('[load-test] result:', JSON.stringify(out, null, 2));
  return out;
}

module.exports = { parseArgs, assertSafeTarget, assertWriteConfirmed, runLoad, PRODUCTION_HOST_PATTERNS };
