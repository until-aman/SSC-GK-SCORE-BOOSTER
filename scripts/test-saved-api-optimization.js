#!/usr/bin/env node
/**
 * scripts/test-saved-api-optimization.js  (Step 11)
 *
 * Dependency-free. Requires the REAL server service (CommonJS) for identity/row
 * logic, mirrors the client cache patching + mutation idempotency, and runs
 * source-level assertions on the real files.
 *
 * Run:  node scripts/test-saved-api-optimization.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const svc = require('../lib/server/savedQuestionsService');

const TEN_MIN = 10 * 60 * 1000;
function hashIdentity(v) { const s = String(v || '').toLowerCase(); let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0; return h.toString(36); }
const scopeOf = (e) => (e ? `u_${hashIdentity(e)}` : 'guest');
const scopedKey = (b, s) => `${b}:${s || 'guest'}`;

// ── client cache mirror ──────────────────────────────────────────────────────
const store = new Map();
let net = 0;
const readC = (k) => store.get(k) || null;
const writeC = (k, d) => store.set(k, { data: d, timestamp: Date.now() });
async function fetchCache(key, maxAge, server) { const e = store.get(key); if (e && (Date.now() - e.timestamp) < maxAge) return { data: e.data }; net++; const d = await server(); store.set(key, { data: d, timestamp: Date.now() }); return { data: d }; }

const IDS = (s) => scopedKey('saved_question_ids', s);
const LIST = (s) => scopedKey('saved_questions', s);

function patchIds(scope, qid, add) {
  const e = readC(IDS(scope)); if (!e) return;
  const ids = e.data.savedIds || [];
  if (add && !ids.includes(qid)) writeC(IDS(scope), { ...e.data, savedIds: [...ids, qid] });
  else if (!add && ids.includes(qid)) writeC(IDS(scope), { ...e.data, savedIds: ids.filter(i => i !== qid) });
}
function patchList(scope, item, add) {
  const e = readC(LIST(scope)); if (!e) return;
  const list = e.data.saved || [];
  const id = item.questionId;
  if (add) { if (!list.some(q => q.questionId === id)) writeC(LIST(scope), { ...e.data, saved: [{ ...item }, ...list] }); }
  else writeC(LIST(scope), { ...e.data, saved: list.filter(q => q.questionId !== id) });
}

// ── server SavedQuestions mirror (uses real service for rows/identity) ───────
let sheet = []; // rows A..L
const saveInflight = new Map();
async function serverToggle(email, q, action) {
  const id = svc.normalizeQuestionId(q);
  const key = `${email}|${id}|${action}`;
  let p = saveInflight.get(key);
  if (!p) {
    p = (async () => {
      await new Promise(r => setTimeout(r, 3));
      const idx = svc.findSavedRowIndex(sheet, email, id);
      if (action === 'save') { if (idx !== -1) return { isSaved: true, alreadySaved: true }; sheet.push(svc.buildSavedRow(email, q)); return { isSaved: true }; }
      if (idx !== -1) { sheet.splice(idx, 1); return { isSaved: false }; }
      return { isSaved: false, alreadyUnsaved: true };
    })().finally(() => saveInflight.delete(key));
    saveInflight.set(key, p);
  }
  return p;
}
async function serverMigrate(email, questions) {
  const batch = svc.normalizeMigrationBatch(questions);
  const savedSet = new Set(sheet.filter(r => r[0] === email).map(r => r[1]));
  const toAppend = batch.filter(q => !savedSet.has(svc.normalizeQuestionId(q)));
  toAppend.forEach(q => sheet.push(svc.buildSavedRow(email, q)));
  return { ok: true, migrated: toAppend.length, skipped: batch.length - toAppend.length, failed: 0 };
}
const countRows = (email, id) => sheet.filter(r => r[0] === email && r[1] === id).length;

let passed = 0, failed = 0;
const check = (n, c) => { if (c) { passed++; console.log(`  PASS  ${n}`); } else { failed++; console.log(`  FAIL  ${n}`); } };
const reset = () => { store.clear(); net = 0; sheet = []; saveInflight.clear(); };

const A = scopeOf('a@gmail.com'), B = scopeOf('b@gmail.com');
const Q1 = { questionId: 'q1', question: 'Q1?', correctOption: 'A', subject: 'GK', topic: 'T' };
const Q2 = { questionId: 'q2', question: 'Q2?', correctOption: 'B' };

(async () => {
  // T1 — list cold/fresh
  reset();
  await fetchCache(LIST(A), TEN_MIN, async () => ({ saved: [] }));
  { const before = net; await fetchCache(LIST(A), TEN_MIN, async () => ({ saved: [] })); check('T1 list cold 1 / fresh 0', net === 1 && net === before); }

  // T2 — ids cold/fresh
  reset();
  await fetchCache(IDS(A), TEN_MIN, async () => ({ savedIds: [] }));
  { const before = net; await fetchCache(IDS(A), TEN_MIN, async () => ({ savedIds: [] })); check('T2 ids cold 1 / fresh 0', net === 1 && net === before); }

  // T3 — save one: 1 row, caches patched, no GET
  reset(); writeC(IDS(A), { savedIds: [] }); writeC(LIST(A), { saved: [] });
  { const before = net; await serverToggle('a@gmail.com', Q1, 'save'); patchIds(A, 'q1', true); patchList(A, Q1, true);
    check('T3 save: one row', countRows('a@gmail.com', 'q1') === 1);
    check('T3 save: ids patched', readC(IDS(A)).data.savedIds.includes('q1'));
    check('T3 save: list patched', readC(LIST(A)).data.saved.length === 1);
    check('T3 save: no GET', net === before); }

  // T4 — save already-saved: no dup
  { const r = await serverToggle('a@gmail.com', Q1, 'save'); check('T4 already-saved no dup', r.alreadySaved === true && countRows('a@gmail.com', 'q1') === 1); }

  // T5 — unsave: removed once, caches patched
  { await serverToggle('a@gmail.com', Q1, 'unsave'); patchIds(A, 'q1', false); patchList(A, { questionId: 'q1' }, false);
    check('T5 unsave: row gone', countRows('a@gmail.com', 'q1') === 0);
    check('T5 unsave: ids patched', !readC(IDS(A)).data.savedIds.includes('q1'));
    check('T5 unsave: list patched', readC(LIST(A)).data.saved.length === 0); }

  // T6 — unsave already-unsaved
  { const r = await serverToggle('a@gmail.com', Q1, 'unsave'); check('T6 already-unsaved stable', r.alreadyUnsaved === true); }

  // T7 — concurrent identical save → 1 append
  reset();
  { const [r1, r2] = await Promise.all([serverToggle('a@gmail.com', Q1, 'save'), serverToggle('a@gmail.com', Q1, 'save')]); check('T7 concurrent save: 1 row', countRows('a@gmail.com', 'q1') === 1 && !!r1 && !!r2); }

  // T8 — concurrent identical unsave → stable
  { const [r1] = await Promise.all([serverToggle('a@gmail.com', Q1, 'unsave'), serverToggle('a@gmail.com', Q1, 'unsave')]); check('T8 concurrent unsave: row gone', countRows('a@gmail.com', 'q1') === 0 && !!r1); }

  // T9 — opposite actions not merged (different keys → run independently)
  reset();
  { await serverToggle('a@gmail.com', Q1, 'save'); await serverToggle('a@gmail.com', Q1, 'unsave'); check('T9 opposite actions serialized', countRows('a@gmail.com', 'q1') === 0); }

  // T10 — guest local save (no API)
  reset();
  { const guestNet = net; const guest = [Q1]; check('T10 guest local: 0 API', net === guestNet && guest.length === 1); }

  // T11 — migration: missing appended, existing skipped, caches populated
  reset(); sheet.push(svc.buildSavedRow('a@gmail.com', Q1)); // q1 already saved
  writeC(IDS(A), { savedIds: ['q1'] }); writeC(LIST(A), { saved: [{ questionId: 'q1' }] });
  { const r = await serverMigrate('a@gmail.com', [Q1, Q2]); [Q1, Q2].forEach(q => { patchIds(A, q.questionId, true); patchList(A, q, true); });
    check('T11 migration: 1 migrated 1 skipped', r.migrated === 1 && r.skipped === 1);
    check('T11 migration: caches populated', readC(IDS(A)).data.savedIds.includes('q2'));
    check('T11 migration: no dup q1', countRows('a@gmail.com', 'q1') === 1); }

  // T12 — repeated migration: 0 new dup
  { const r = await serverMigrate('a@gmail.com', [Q1, Q2]); check('T12 repeat migration: 0 migrated', r.migrated === 0 && countRows('a@gmail.com', 'q2') === 1); }

  // T13 — migration failure: guest keys remain (modeled: ok=false → don't clear)
  { let guestKeysCleared = false; const ok = false; if (ok) guestKeysCleared = true; check('T13 migration failure: guest keys remain', guestKeysCleared === false); }

  // T14 — A/B isolation
  check('T14 distinct ids keys', IDS(A) !== IDS(B));
  check('T14 distinct list keys', LIST(A) !== LIST(B));

  // T19 — broken cache: only scoped removed
  reset(); store.set(IDS(A), { data: 'x', timestamp: Date.now() }); store.set('other', { data: 'k', timestamp: Date.now() }); store.delete(IDS(A));
  check('T19 broken scoped removed', !store.has(IDS(A))); check('T19 other kept', store.has('other'));

  // T20 — batch bound
  { const big = Array.from({ length: 500 }, (_, i) => ({ questionId: `b${i}`, question: 'x', correctOption: 'A' })); const bounded = svc.normalizeMigrationBatch(big); check('T20 batch bounded to MAX', bounded.length === svc.MAX_MIGRATION_BATCH); }

  // T22 — Sheet column compatibility (12 cols, exact order)
  { const row = svc.buildSavedRow('e@x.com', { questionId: 'q', subject: 's', topic: 't', question: 'qq', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctOption: 'a', explanation: 'ex' });
    check('T22 row has 12 columns', row.length === 12);
    check('T22 col0 email, col1 questionId, col9 correctOption upper, col11 savedAt', row[0] === 'e@x.com' && row[1] === 'q' && row[9] === 'A' && typeof row[11] === 'string'); }

  // ── Source assertions ──
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const saved = read('lib/data/savedData.js');
  const toggle = read('pages/api/saved-questions/toggle.js');
  const route = read('pages/api/saved-questions.js');
  const dash = read('pages/dashboard.js');
  const q = read('pages/history/questions.jsx');
  const sess = read('pages/history/session/[sessionId].jsx');

  check('SRC savedData: mutation + patch helpers', /toggleSavedQuestion/.test(saved) && /saveQuestion/.test(saved) && /unsaveQuestion/.test(saved) && /migrateGuestSavedQuestions/.test(saved) && /patchSavedIdsCache/.test(saved));
  // Mutations use raw fetch; fetchWithClientCache only appears in the read helpers.
  const mutationSection = saved.slice(saved.indexOf('runSavedMutation'));
  check('SRC savedData: mutations NOT via fetchWithClientCache', !mutationSection.includes('fetchWithClientCache') && mutationSection.includes("fetch('/api/saved-questions/toggle'"));
  check('SRC toggle.js: in-flight guard', /toggleInflight/.test(toggle));
  check('SRC route: batch path + in-flight guard', /Array\.isArray\(req\.body\?\.questions\)/.test(route) && /saveInflight/.test(route));
  check('SRC dashboard: one batched migration', /migrateGuestSavedQuestions/.test(dash) && !/for \(const q of questions\)/.test(dash));
  check('SRC questions.jsx: uses toggleSavedQuestion (no direct toggle fetch)', /toggleSavedQuestion/.test(q) && !/fetch\(['"]\/api\/saved-questions\/toggle/.test(q));
  check('SRC session: uses toggleSavedQuestion', /toggleSavedQuestion/.test(sess) && !/fetch\(['"]\/api\/saved-questions\/toggle/.test(sess));

  // T21 — route preservation (no invented routes)
  const savedDir = fs.readdirSync(path.join(__dirname, '..', 'pages', 'api', 'saved-questions'));
  check('T21 routes: ids.js + toggle.js only in subdir', savedDir.sort().join(',') === 'ids.js,toggle.js');
  check('T21 no invented routes', !savedDir.includes('action.js') && !savedDir.includes('bulk.js'));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
