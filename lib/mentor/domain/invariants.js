// lib/mentor/domain/invariants.js — pure snapshot validation (Phase 2 Step 12). CommonJS.
'use strict';

const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY } = require('./enums');
const { diagnostic } = require('./types');
const { isValidLocalDateKey, normalizeIanaTimezone, calculateActivePlanDay } = require('./planDay');
const { normalizeTaskStatus } = require('./taskStateMachine');
const { TASK_STATUS } = require('./enums');

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
  const derivedPending = snapshot.pendingTasks || [];
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

  if (typeof snapshot.pendingCount === 'number' && snapshot.pendingCount !== derivedPending.length) {
    push('pendingCount does not match pendingTasks length', { pendingCount: snapshot.pendingCount, actual: derivedPending.length });
  }
  const activeIds = new Set(current.filter(t => [TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS].includes(normalizeTaskStatus(t.status))).map(t => t.taskId));
  const derivedPendingIds = new Set();
  derivedPending.forEach(t => {
    if (derivedPendingIds.has(t.taskId)) push('duplicate pending task id', { taskId: t.taskId });
    derivedPendingIds.add(t.taskId);
    if (activeIds.has(t.taskId)) push('pending task also appears active', { taskId: t.taskId });
    if (hiddenIds.has(t.taskId) || t.isLegacyHidden) push('hidden legacy task leaked into pendingTasks', { taskId: t.taskId });
    if ([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED, TASK_STATUS.EXPIRED].includes(normalizeTaskStatus(t.status))) {
      push('terminal task leaked into pendingTasks', { taskId: t.taskId, status: t.status });
    }
  });
  if (snapshot.featuredPendingTask && !derivedPendingIds.has(snapshot.featuredPendingTask.taskId)) {
    push('featured pending task missing from pendingTasks', { taskId: snapshot.featuredPendingTask.taskId });
  }

  const totalPlanDays = Number(snapshot.totalPlanDays || 0);
  const calendarDay = Number(snapshot.calendarDay || 0);
  const unlockedDay = Number(snapshot.unlockedDay || 0);
  const activePlanDay = Number(snapshot.activePlanDay || 0);
  if (!Number.isInteger(totalPlanDays) || totalPlanDays < 1) push('totalPlanDays invalid', { totalPlanDays });
  if (totalPlanDays >= 1) {
    if (!Number.isInteger(calendarDay) || calendarDay < 1 || calendarDay > totalPlanDays) push('calendarDay out of range', { calendarDay, totalPlanDays });
    if (!Number.isInteger(unlockedDay) || unlockedDay < 1 || unlockedDay > totalPlanDays) push('unlockedDay out of range', { unlockedDay, totalPlanDays });
    const expectedActive = calculateActivePlanDay({ calendarDay, unlockedDay, totalPlanDays });
    if (activePlanDay !== expectedActive) push('activePlanDay formula mismatch', { activePlanDay, expectedActive });
    if (Number(snapshot.daysRemaining) < 0) push('daysRemaining negative', { daysRemaining: snapshot.daysRemaining });
  }
  if (snapshot.planStartSource !== 'fallback_day_one' && !isValidLocalDateKey(snapshot.planStartLocalDate)) {
    push('planStartLocalDate invalid', { planStartSource: snapshot.planStartSource });
  }
  if (!snapshot.timezone || normalizeIanaTimezone(snapshot.timezone, []) !== snapshot.timezone) push('timezone invalid', {});
  if (!snapshot.serverGeneratedAt || !Number.isFinite(new Date(snapshot.serverGeneratedAt).getTime())) push('serverGeneratedAt missing', {});
  if (snapshot.activePlan?.activeDayNumber && snapshot.activePlan.activeDayNumber !== snapshot.calendarDay) {
    const hasIgnoredDiag = (snapshot.diagnostics || []).some(d => d.code === DIAGNOSTIC_CODE.LEGACY_ACTIVE_DAY_IGNORED);
    if (!hasIgnoredDiag) push('legacy ActiveDayNumber not explicitly ignored', {});
  }

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
