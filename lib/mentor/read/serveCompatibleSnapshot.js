// lib/mentor/read/serveCompatibleSnapshot.js — shared Repository V2 read overlay.
// CommonJS so both the ESM Mentor routes and CJS test harnesses can use it.
//
// Reshapes a legacy snapshot using Repository V2 generation isolation + canonical
// day WITHOUT changing the response shape (same top-level keys; a few additive
// debug fields). Historical generations are hidden from the "today" view; legacy
// snoozed never enter the pending backlog; the displayed plan day becomes the
// canonical activePlanDay. Pure / read-only. Extracted verbatim from the Phase 8C
// implementation in pages/api/mentor/plan.js so GET /api/mentor/plan AND the future
// V2 task-action response can produce an identical contract.
'use strict';

/**
 * @param {Object} legacySnapshot  the legacy buildSnapshot() output (rich profile + 15 tasks)
 * @param {Object} repoSnapshot    Repository V2 snapshot (currentTasks/activePlan/canonical day)
 * @returns {Object} compatibility-shaped snapshot (same keys as legacy; corrected values)
 */
function applyRepoV2Compatibility(legacySnapshot, repoSnapshot) {
  // No-op safely when there is no plan to reshape or no active plan in the repo snapshot.
  if (!legacySnapshot || !legacySnapshot.plan || !repoSnapshot || !repoSnapshot.activePlan) return legacySnapshot;
  const currentGenIds = new Set((repoSnapshot.currentTasks || []).map(t => t.taskId));
  const allTasks = legacySnapshot.plan.tasks || [];
  // Only the current-generation tasks (full legacy UI shape) are "today's" tasks.
  const currentTasks = allTasks.filter(task => currentGenIds.has(task.taskId));
  const activeTasks = currentTasks.filter(task => task.status === 'active').slice(0, 3);
  const completedToday = currentTasks.filter(task => task.status === 'completed');
  // Phase 9C: pendingTasks = current-generation tasks the repository marked as
  // canonical V2 pending (Status=pending + v2 evidence). Mapped back to the
  // legacy-shaped task by id so the response stays UI-compatible. Legacy snoozed
  // tasks (no v2 evidence) stay hidden from pending.
  const pendingIds = new Set((repoSnapshot.canonicalPendingTasks || []).map(t => t.taskId));
  const pendingTasks = currentTasks.filter(task => pendingIds.has(task.taskId));
  // deferred = legacy snoozed current-gen tasks, never duplicating pending.
  const deferredTasks = currentTasks.filter(task => task.status === 'snoozed' && !pendingIds.has(task.taskId));
  const total = currentTasks.filter(task => ['active', 'completed', 'snoozed', 'blocked'].includes(task.status)).length;
  const completed = completedToday.length;
  const canonicalDay = repoSnapshot.activePlanDay || repoSnapshot.calendarDay || legacySnapshot.plan.dayNumber || 1;
  return {
    ...legacySnapshot,
    plan: {
      ...legacySnapshot.plan,
      tasks: currentTasks,
      dayNumber: canonicalDay,
      activeDayNumber: canonicalDay,
      daysTotal: repoSnapshot.totalPlanDays || legacySnapshot.plan.daysTotal,
      legacyActiveDayNumber: legacySnapshot.plan.dayNumber, // legacy/debug only, not primary display
      canonicalCalendarDay: repoSnapshot.calendarDay,
      canonicalActivePlanDay: repoSnapshot.activePlanDay,
    },
    activeTasks,
    completedToday,
    deferredTasks,
    pendingTasks,
    progress: { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 },
    repositoryServed: true,
    repositoryVersion: repoSnapshot.repositoryVersion,
    activeGeneration: repoSnapshot.activeGeneration || null,
    historicalTaskCount: (repoSnapshot.historicalTasks || []).length,
  };
}

module.exports = { applyRepoV2Compatibility };
