// lib/mentor/domain/enums.js — canonical Mentor enums (Phase 2).
// Source of truth: Phase 1 §3/§7/§8 + Phase 1A §3/§8/§9/§11. CommonJS.
'use strict';

// Plan statuses (Phase 1 §3). `needs_rebuild` is NOT a status (Phase 1A §3) — it is a boolean flag.
const PLAN_STATUS = Object.freeze({
  GENERATING: 'generating',
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  COMPLETED: 'completed',
  FAILED: 'failed',
  INVALID: 'invalid', // legacy/migration marker
});

// Task statuses — final model (Phase 1A §8). Legacy `snoozed` maps to `pending`.
const TASK_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
});

// Legacy task statuses seen in current Sheet data (Phase 0 §6 / Phase 1B.1).
const LEGACY_TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
});

// Task taxonomy (Phase 1 §7).
const TASK_TYPE = Object.freeze({
  COVERAGE_CHECK: 'coverage_check',
  CONFIDENCE_CHECK: 'confidence_check',
  THEORY_TASK: 'theory_task',
  PRACTICE_TASK: 'practice_task',
  REVISION_TASK: 'revision_task',
  MISTAKE_RECOVERY_TASK: 'mistake_recovery_task',
  FEEDBACK_TASK: 'feedback_task',
  PACE_UNLOCK_TASK: 'pace_unlock_task',
});

const COMPLETION_SOURCE = Object.freeze({
  QUIZ_SYNC: 'quiz_sync',
  MENTOR_RESPONSE: 'mentor_response',
  MANUAL_RECOVERY: 'manual_recovery',
  SYSTEM_RECONCILIATION: 'system_reconciliation',
});

const PENDING_REASON = Object.freeze({
  USER_POSTPONED: 'user_postponed',
  DAY_ENDED_INCOMPLETE: 'day_ended_incomplete',
  IN_PROGRESS_ABANDONED: 'in_progress_abandoned',
  PLAN_REBALANCED: 'plan_rebalanced',
});

const CANCELLATION_REASON = Object.freeze({
  PLAN_SUPERSEDED: 'plan_superseded',
  REPLACED_BY_LIGHTER: 'replaced_by_lighter',
  USER_MARKED_NOT_RELEVANT: 'user_marked_not_relevant',
  LEGACY_GENERATION_ARCHIVED: 'legacy_generation_archived',
});

// Terminal task statuses (no outgoing transitions) — Phase 1A §8.
const TERMINAL_TASK_STATUSES = Object.freeze([
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED,
  TASK_STATUS.EXPIRED,
]);

// Diagnostic codes (Phase 2 Step 15). No PII ever attached.
const DIAGNOSTIC_CODE = Object.freeze({
  HEADER_NORMALIZED: 'HEADER_NORMALIZED',
  HEADER_AMBIGUOUS: 'HEADER_AMBIGUOUS',
  REQUIRED_HEADER_MISSING: 'REQUIRED_HEADER_MISSING',
  POSITIONAL_FALLBACK_USED: 'POSITIONAL_FALLBACK_USED',
  LEGACY_VERSION_PARSED: 'LEGACY_VERSION_PARSED',
  MULTIPLE_ACTIVE_PLAN_ROWS: 'MULTIPLE_ACTIVE_PLAN_ROWS',
  PLAN_ID_REUSED: 'PLAN_ID_REUSED',
  LEGACY_GENERATIONS_DETECTED: 'LEGACY_GENERATIONS_DETECTED',
  TASK_GENERATION_AMBIGUOUS: 'TASK_GENERATION_AMBIGUOUS',
  LEGACY_TASK_NUMBER_DERIVED: 'LEGACY_TASK_NUMBER_DERIVED',
  LEGACY_QUESTION_COUNT_DERIVED: 'LEGACY_QUESTION_COUNT_DERIVED',
  MALFORMED_ROW_SKIPPED: 'MALFORMED_ROW_SKIPPED',
  DUPLICATE_TOPIC_STATE: 'DUPLICATE_TOPIC_STATE',
  POINTER_MISSING: 'POINTER_MISSING',
  POINTER_MISMATCH: 'POINTER_MISMATCH',
  NO_ACTIVE_PLAN: 'NO_ACTIVE_PLAN',
});

const DIAGNOSTIC_SEVERITY = Object.freeze({ INFO: 'info', WARN: 'warn', ERROR: 'error' });

module.exports = {
  PLAN_STATUS,
  TASK_STATUS,
  LEGACY_TASK_STATUS,
  TASK_TYPE,
  COMPLETION_SOURCE,
  PENDING_REASON,
  CANCELLATION_REASON,
  TERMINAL_TASK_STATUSES,
  DIAGNOSTIC_CODE,
  DIAGNOSTIC_SEVERITY,
};
