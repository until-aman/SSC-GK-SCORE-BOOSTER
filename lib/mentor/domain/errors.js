// lib/mentor/domain/errors.js — typed Mentor repository errors (Phase 2). CommonJS.
'use strict';

class MentorRepositoryError extends Error {
  constructor(message, code = 'MENTOR_REPO_ERROR', details = {}) {
    super(message);
    this.name = 'MentorRepositoryError';
    this.code = code;
    this.details = details; // must not contain PII
  }
}

// Raised for ambiguous/critical legacy-compatibility conditions that must fail loudly
// (e.g., ambiguous duplicate headers, missing critical header).
class CompatibilityError extends MentorRepositoryError {
  constructor(message, details = {}) {
    super(message, 'MENTOR_COMPATIBILITY_ERROR', details);
    this.name = 'CompatibilityError';
  }
}

// Raised by reserved write methods that are intentionally not implemented in Phase 2.
class NotImplementedError extends MentorRepositoryError {
  constructor(op) {
    super(`Mentor repository write op not implemented in Phase 2: ${op}`, 'NOT_IMPLEMENTED', { op });
    this.name = 'NotImplementedError';
  }
}

module.exports = { MentorRepositoryError, CompatibilityError, NotImplementedError };
