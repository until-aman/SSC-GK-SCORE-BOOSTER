// lib/server/savedQuestionsService.js — shared SavedQuestions server logic (Step 11).
//
// One source of truth for question identity + SavedQuestions row shape, reused by
// all three existing routes. Does NOT change the Sheet column order (A..L:
// email, questionId, subject, topic, question, A, B, C, D, correctOption,
// explanation, savedAt). Identity = authenticated email + existing questionId.

'use strict';

const SHEET_NAME = 'SavedQuestions';

// Bound a guest-migration batch so a single request can't append unbounded rows.
const MAX_MIGRATION_BATCH = 200;

// Existing question identity — the questionId already stored in column B. Accept
// the legacy `id` alias some client payloads use; never invent a new format.
function normalizeQuestionId(q) {
  if (!q) return '';
  return String(q.questionId || q.id || '').trim();
}

// Build the 12-column SavedQuestions row in the EXACT existing order.
function buildSavedRow(email, q, savedAt = new Date().toISOString()) {
  return [
    email,
    normalizeQuestionId(q),
    q.subject || '',
    q.topic || '',
    q.question || '',
    q.optionA || '',
    q.optionB || '',
    q.optionC || '',
    q.optionD || '',
    String(q.correctOption || '').toUpperCase(),
    q.explanation || '',
    savedAt,
  ];
}

// Parse an A2:L row into the existing object shape (safe on malformed rows).
function parseSavedRow(r = []) {
  return {
    email:         r[0]  || '',
    questionId:    r[1]  || '',
    subject:       r[2]  || '',
    topic:         r[3]  || '',
    question:      r[4]  || '',
    optionA:       r[5]  || '',
    optionB:       r[6]  || '',
    optionC:       r[7]  || '',
    optionD:       r[8]  || '',
    correctOption: r[9]  || '',
    explanation:   r[10] || '',
    savedAt:       r[11] || '',
  };
}

// Index of a user's saved row by email + questionId (A:B reads), or -1.
function findSavedRowIndex(rows, email, questionId) {
  return rows.findIndex(r => r[0] === email && r[1] === questionId);
}

// Normalize + de-duplicate an incoming migration batch (keep first occurrence,
// drop entries missing required fields), bounded to MAX_MIGRATION_BATCH.
function normalizeMigrationBatch(questions) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(questions)) return out;
  for (const q of questions) {
    if (out.length >= MAX_MIGRATION_BATCH) break;
    const id = normalizeQuestionId(q);
    if (!id || !q.question || !q.correctOption) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(q);
  }
  return out;
}

module.exports = {
  SHEET_NAME,
  MAX_MIGRATION_BATCH,
  normalizeQuestionId,
  buildSavedRow,
  parseSavedRow,
  findSavedRowIndex,
  normalizeMigrationBatch,
};
