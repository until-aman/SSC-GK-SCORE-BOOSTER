#!/usr/bin/env node
/**
 * scripts/summarize-api-diagnostics.js
 *
 * Development-only baseline summarizer. Parses `[apidiag] {...}` JSON lines
 * (emitted by lib/apiDiagnostics.js, lib/clientCache.js, lib/journeyDiagnostics.js)
 * and prints:
 *   - calls per route
 *   - Sheet reads / writes per route
 *   - average + p-ish max route duration
 *   - cache status counts
 *   - duplicate calls within a short window
 *   - mutation-followed-by-GET sequences
 *
 * No new production dependency (Node stdlib only). Not imported by the app.
 *
 * Usage:
 *   node scripts/summarize-api-diagnostics.js path/to/dev.log
 *   <your dev process> | node scripts/summarize-api-diagnostics.js      (stdin)
 *
 * Capture logs first, e.g.:
 *   npm run dev 2> dev-diag.log         (console.debug → stderr)
 *   node scripts/summarize-api-diagnostics.js dev-diag.log
 */

'use strict';

const fs = require('fs');

const TAG = '[apidiag] ';
const DUP_WINDOW_MS = 1500; // "short window" for duplicate-call detection
const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function parseLines(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(TAG);
    if (idx === -1) continue;
    const json = line.slice(idx + TAG.length).trim();
    try {
      events.push(JSON.parse(json));
    } catch {
      /* skip non-JSON */
    }
  }
  return events;
}

function summarize(events) {
  const api = events.filter((e) => e.kind === 'api');
  const sheet = events.filter((e) => e.kind === 'sheet');
  const cache = events.filter((e) => e.kind === 'cache');
  const journey = events.filter((e) => e.kind === 'journey');

  // Calls + duration per route (from api traces)
  const perRoute = {};
  for (const e of api) {
    const r = (perRoute[e.route] = perRoute[e.route] || {
      calls: 0, totalMs: 0, maxMs: 0, sheetReads: 0, sheetWrites: 0, gemini: 0,
    });
    r.calls += 1;
    r.totalMs += e.durationMs || 0;
    r.maxMs = Math.max(r.maxMs, e.durationMs || 0);
    r.sheetReads += e.sheetReads || 0;
    r.sheetWrites += e.sheetWrites || 0;
    if (e.geminiCalled) r.gemini += 1;
  }

  // Physical sheet ops grouped by requestId then tab (for unwrapped routes the
  // requestId is null — counted under "unassociated").
  const sheetByReq = {};
  for (const e of sheet) {
    const rid = e.requestId || 'unassociated';
    const b = (sheetByReq[rid] = sheetByReq[rid] || { reads: 0, writes: 0, tabs: {} });
    if (e.rw === 'read') b.reads += 1; else b.writes += 1;
    if (e.tab) b.tabs[e.tab] = (b.tabs[e.tab] || 0) + 1;
  }

  // Cache status counts
  const cacheCounts = {};
  for (const e of cache) cacheCounts[e.status] = (cacheCounts[e.status] || 0) + 1;

  // Duplicate calls within window (same route within DUP_WINDOW_MS)
  const calls = [];
  for (const e of api) calls.push({ route: e.route, method: e.method, t: ts(e) });
  for (const e of journey) calls.push({ route: e.route, method: 'GET', t: e.ts || 0 });
  calls.sort((a, b) => a.t - b.t);
  const dups = [];
  for (let i = 0; i < calls.length; i += 1) {
    for (let j = i + 1; j < calls.length && calls[j].t - calls[i].t <= DUP_WINDOW_MS; j += 1) {
      if (calls[j].route && calls[j].route === calls[i].route) {
        dups.push({ route: calls[i].route, gapMs: calls[j].t - calls[i].t });
      }
    }
  }

  // Mutation followed by a GET (any route) within window
  const muts = [];
  for (let i = 0; i < calls.length; i += 1) {
    if (!MUTATION_METHODS.has(calls[i].method)) continue;
    for (let j = i + 1; j < calls.length && calls[j].t - calls[i].t <= DUP_WINDOW_MS; j += 1) {
      if (calls[j].method === 'GET') {
        muts.push({ mutation: calls[i].route, followedBy: calls[j].route, gapMs: calls[j].t - calls[i].t });
        break;
      }
    }
  }

  return { perRoute, sheetByReq, cacheCounts, dups, muts, counts: {
    api: api.length, sheet: sheet.length, cache: cache.length, journey: journey.length,
  } };
}

function ts(e) {
  // api events have no explicit ts; approximate ordering by requestId counter.
  // Fall back to 0 so they still sort stably.
  return e.ts || 0;
}

function main() {
  const file = process.argv[2];
  const input = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
  const events = parseLines(input);
  if (!events.length) {
    console.log('No [apidiag] events found. Run the app in development and capture console.debug output.');
    return;
  }
  const s = summarize(events);

  console.log('=== API Diagnostics Summary ===');
  console.log(`events: api=${s.counts.api} sheet=${s.counts.sheet} cache=${s.counts.cache} journey=${s.counts.journey}\n`);

  console.log('--- Calls per route (api traces) ---');
  Object.entries(s.perRoute).sort((a, b) => b[1].calls - a[1].calls).forEach(([route, r]) => {
    console.log(`${route.padEnd(34)} calls=${r.calls} reads=${r.sheetReads} writes=${r.sheetWrites} avgMs=${Math.round(r.totalMs / r.calls)} maxMs=${r.maxMs} gemini=${r.gemini}`);
  });

  console.log('\n--- Sheet ops per request ---');
  Object.entries(s.sheetByReq).forEach(([rid, b]) => {
    const tabs = Object.entries(b.tabs).map(([t, n]) => `${t}:${n}`).join(',');
    console.log(`${rid.padEnd(22)} reads=${b.reads} writes=${b.writes} tabs=[${tabs}]`);
  });

  console.log('\n--- Cache status counts ---');
  Object.entries(s.cacheCounts).forEach(([k, v]) => console.log(`${k.padEnd(16)} ${v}`));

  console.log('\n--- Duplicate calls (same route within ' + DUP_WINDOW_MS + 'ms) ---');
  if (!s.dups.length) console.log('(none detected)');
  s.dups.forEach((d) => console.log(`${d.route}  gap=${d.gapMs}ms`));

  console.log('\n--- Mutation followed by GET ---');
  if (!s.muts.length) console.log('(none detected)');
  s.muts.forEach((m) => console.log(`${m.mutation} -> ${m.followedBy}  gap=${m.gapMs}ms`));
}

main();
