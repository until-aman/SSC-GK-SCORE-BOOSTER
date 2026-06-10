// lib/mentor/repository/headerNormalizer.js — pure header normalization (Phase 2 Step 3). CommonJS.
//
// Fixes the Phase 1B.1 trailing-newline header issue and the positional-read risk,
// WITHOUT renaming any physical Sheet header. Read-only, pure functions.
'use strict';

const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY } = require('../domain/enums');
const { diagnostic } = require('../domain/types');

/**
 * Normalize a single physical header name: stringify, strip surrounding
 * whitespace AND embedded CR/LF at the edges. Case is preserved.
 *   normalizeHeader("MentorPlanId\n")     -> "MentorPlanId"
 *   normalizeHeader(" ProgressPercent ")  -> "ProgressPercent"
 *   normalizeHeader("LastPlanRefreshAt\r\n") -> "LastPlanRefreshAt"
 */
function normalizeHeader(raw) {
  if (raw === undefined || raw === null) return '';
  // Replace CR/LF with nothing at edges; collapse internal CR/LF to space then trim.
  return String(raw).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Build a normalized header map for a physical header row.
 * @param {string[]} headers physical header row
 * @param {{required?:string[], optional?:string[]}} [spec] canonical names
 * @returns {{ index: Object<string,number>, normalizedNames: string[],
 *            diagnostics: import('../domain/types').RepositoryDiagnostic[],
 *            hasAmbiguous: boolean, missingRequired: string[] }}
 *
 * - maps canonical (normalized) header -> physical column index
 * - detects duplicate normalized names (ambiguous) and records them
 * - identifies missing critical/required headers
 * - never silently drops a critical header (caller decides to throw)
 */
function buildNormalizedHeaderMap(headers, spec = {}) {
  const required = spec.required || [];
  const optional = spec.optional || [];
  const diagnostics = [];
  const index = {};
  const seenAt = {}; // normalized -> first physical index
  const ambiguous = new Set();
  const normalizedNames = [];

  (headers || []).forEach((physical, i) => {
    const norm = normalizeHeader(physical);
    normalizedNames.push(norm);
    if (norm === '') return; // blank header column — ignored (no canonical mapping)
    if (norm !== String(physical)) {
      diagnostics.push(diagnostic(DIAGNOSTIC_CODE.HEADER_NORMALIZED, DIAGNOSTIC_SEVERITY.INFO, { header: norm }));
    }
    if (Object.prototype.hasOwnProperty.call(seenAt, norm)) {
      ambiguous.add(norm);
      diagnostics.push(diagnostic(DIAGNOSTIC_CODE.HEADER_AMBIGUOUS, DIAGNOSTIC_SEVERITY.ERROR, { header: norm, firstIndex: seenAt[norm], dupIndex: i }));
      return; // do NOT overwrite the first mapping; ambiguity surfaced via diagnostics
    }
    seenAt[norm] = i;
    index[norm] = i;
  });

  const missingRequired = required.filter(h => !(h in index));
  missingRequired.forEach(h => diagnostics.push(diagnostic(DIAGNOSTIC_CODE.REQUIRED_HEADER_MISSING, DIAGNOSTIC_SEVERITY.ERROR, { header: h })));
  // Optional missing headers are not reported as errors.
  void optional;

  return {
    index,
    normalizedNames,
    diagnostics,
    hasAmbiguous: ambiguous.size > 0,
    ambiguousHeaders: [...ambiguous],
    missingRequired,
  };
}

/** Read a cell from a row by canonical header name using a header map. */
function cell(row, headerMap, canonicalName) {
  const i = headerMap.index[canonicalName];
  if (typeof i !== 'number') return undefined;
  return row[i];
}

module.exports = { normalizeHeader, buildNormalizedHeaderMap, cell };
