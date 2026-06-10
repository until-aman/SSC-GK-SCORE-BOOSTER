// lib/mentor/repository/shadowCompare.js — read-only shadow comparison (Phase 2 Step 14). CommonJS.
//
// Compares the NEW repository snapshot against the legacy read result using ONLY
// non-sensitive aggregates. Never changes any response, never writes to the Sheet,
// never logs emails / question content / full task messages.
'use strict';

/** Reduce a legacy mentor read into comparable aggregates (non-sensitive). */
function summarizeLegacy(legacy) {
  legacy = legacy || {};
  const tasks = legacy.tasks || legacy.plan?.tasks || [];
  return {
    activePlanId: legacy.planId || legacy.plan?.planId || null,
    totalTaskCount: Array.isArray(tasks) ? tasks.length : 0,
    completedCount: Array.isArray(tasks) ? tasks.filter(t => String(t.status).toLowerCase() === 'completed').length : 0,
    snoozedCount: Array.isArray(tasks) ? tasks.filter(t => String(t.status).toLowerCase() === 'snoozed').length : 0,
    topicStateCount: Array.isArray(legacy.studentTopicState) ? legacy.studentTopicState.length : (legacy.topicStateCount || 0),
  };
}

/** Reduce the new repository snapshot into the same aggregates. */
function summarizeAdapter(snapshot) {
  snapshot = snapshot || {};
  return {
    activePlanId: snapshot.activePlan ? snapshot.activePlan.planId : null,
    generationCount: snapshot.activeGeneration ? snapshot.activeGeneration.ordinal : (snapshot.generationCount || 0),
    totalTaskCount: (snapshot.currentTasks || []).length + (snapshot.historicalTasks || []).length,
    currentTaskCount: (snapshot.currentTasks || []).length,
    historicalCount: (snapshot.historicalTasks || []).length,
    completedCount: (snapshot.completedEvidence || []).length,
    hiddenSnoozedCount: (snapshot.hiddenLegacyTasks || []).length,
    topicStateCount: (snapshot.studentTopicState || []).length,
  };
}

/**
 * Produce a non-sensitive comparison object. Does NOT log by itself; the caller
 * decides whether to emit. Returns aggregates + a diff list (counts only).
 */
function compareShadow(legacy, snapshot) {
  const a = summarizeLegacy(legacy);
  const b = summarizeAdapter(snapshot);
  const diffs = [];
  if (a.activePlanId && b.activePlanId && a.activePlanId !== b.activePlanId) diffs.push('activePlanId');
  // Legacy reader returns ALL tasks for the reused PlanId; adapter isolates current gen.
  // A difference here is EXPECTED for legacy data (this is the whole point) — report, don't alarm.
  if (a.totalTaskCount !== b.totalTaskCount) diffs.push(`totalTaskCount(legacy=${a.totalTaskCount},adapter=${b.totalTaskCount})`);
  if (a.completedCount !== b.completedCount) diffs.push(`completedCount(legacy=${a.completedCount},adapter=${b.completedCount})`);
  if (a.topicStateCount !== b.topicStateCount) diffs.push(`topicStateCount(legacy=${a.topicStateCount},adapter=${b.topicStateCount})`);
  return { legacy: a, adapter: b, diffs, expectedLegacyDivergence: a.totalTaskCount > b.currentTaskCount };
}

/** Emit the comparison to the server log (aggregates only; no PII). */
function logShadowComparison(comparison) {
  try {
    // eslint-disable-next-line no-console
    console.info('[mentor-repo-v2:shadow]', JSON.stringify({
      adapter: comparison.adapter,
      diffs: comparison.diffs,
      expectedLegacyDivergence: comparison.expectedLegacyDivergence,
    }));
  } catch (_) { /* never throw from diagnostics */ }
}

module.exports = { summarizeLegacy, summarizeAdapter, compareShadow, logShadowComparison };
