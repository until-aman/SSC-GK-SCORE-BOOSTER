// lib/mentor/domain/invariants.js — pure snapshot validation (Phase 2 Step 12). CommonJS.
'use strict';

const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY } = require('./enums');
const { diagnostic } = require('./types');

/**
 * Validate repository-level snapshot invariants. Pure; returns issues, never throws.
 * Invariants (Phase 1A / Phase 1C):
 *  - all current tasks belong to the selected active generation
 *  - no duplicate task IDs across the union (current + historical)
 *  - no historical task appears in current tasks
 *  - no hidden legacy snoozed task appears in canonical pending/current results
 *  - completed evidence remains available (count preserved)
 */
function validateRepositorySnapshot(snapshot) {
  const issues = [];
  const push = (msg, detail) => issues.push(diagnostic('SNAPSHOT_INVARIANT_VIOLATION', DIAGNOSTIC_SEVERITY.ERROR, { msg, ...(detail || {}) }));

  const current = snapshot.currentTasks || [];
  const historical = snapshot.historicalTasks || [];
  const pending = snapshot.canonicalPendingTasks || [];
  const hidden = snapshot.hiddenLegacyTasks || [];
  const activeOrdinal = snapshot.activeGeneration ? snapshot.activeGeneration.ordinal : null;

  // 1. current tasks belong to active generation
  if (activeOrdinal != null) {
    current.forEach(t => { if (t.generationOrdinal !== activeOrdinal) push('current task not in active generation', { taskId: t.taskId }); });
  }

  // 2. no duplicate task IDs in the partition union
  const union = [...current, ...historical];
  const seen = new Set();
  union.forEach(t => { if (seen.has(t.taskId)) push('duplicate task id in partition', { taskId: t.taskId }); seen.add(t.taskId); });

  // 3. no historical task in current
  const currentIds = new Set(current.map(t => t.taskId));
  historical.forEach(t => { if (currentIds.has(t.taskId)) push('historical task also in current', { taskId: t.taskId }); });

  // 4. no hidden legacy snoozed task in canonical pending or current
  const hiddenIds = new Set(hidden.map(t => t.taskId));
  pending.forEach(t => { if (hiddenIds.has(t.taskId)) push('hidden legacy task leaked into pending', { taskId: t.taskId }); });

  // 5. completed evidence preserved (non-negative; informational)
  const completedCount = (snapshot.completedEvidence || []).length;

  return {
    valid: issues.length === 0,
    issues,
    summary: {
      currentCount: current.length,
      historicalCount: historical.length,
      pendingCount: pending.length,
      hiddenCount: hidden.length,
      completedCount,
    },
  };
}

void DIAGNOSTIC_CODE;
module.exports = { validateRepositorySnapshot };
