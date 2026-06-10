// lib/mentor/repository/legacyGenerationAdapter.js — Phase 2 Steps 6,7,8,11. CommonJS.
//
// Pure, read-only compatibility logic for the reused-PlanId legacy data
// (Phase 1B.1 confirmed: 1 PlanId, 5 plan rows, 15 tasks, 3/generation).
// Never mutates raw rows. Never hardcodes the counts 5 or 3.
'use strict';

const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY, TASK_STATUS } = require('../domain/enums');
const { diagnostic } = require('../domain/types');

const ts = (v) => { const t = new Date(v || 0).getTime(); return Number.isFinite(t) ? t : 0; };

/**
 * Step 6: derive generation batches for one logical PlanId.
 * @param {Array} planRows parsed plans (same planId)
 * @param {Array} taskRows parsed tasks (same planId)
 * @returns {{ generations, generationOrdinalByPlanCreatedAt, activeGeneration,
 *            assignTask, diagnostics }}
 */
function deriveGenerations(planRows, taskRows) {
  const diagnostics = [];
  const plans = [...planRows].sort((a, b) => ts(a.createdAt) - ts(b.createdAt) || String(a.planId).localeCompare(b.planId));

  if (plans.length > 1) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_ID_REUSED, DIAGNOSTIC_SEVERITY.WARN, { planRows: plans.length, uniquePlanIds: new Set(plans.map(p => p.planId)).size }));
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_GENERATIONS_DETECTED, DIAGNOSTIC_SEVERITY.INFO, { generations: plans.length }));
  }

  // Assign ordinal g1..gN by ascending CreatedAt.
  const generations = plans.map((plan, i) => ({
    ordinal: i + 1,
    generationBatchId: `${plan.planId}#g${i + 1}`,
    planRow: plan,
    createdAtMs: ts(plan.createdAt),
    status: plan.status,
  }));

  // Active generation = the gen whose plan row is 'active' (newest if multiple).
  const activeCandidates = generations.filter(g => g.status === 'active');
  let activeGeneration = null;
  if (activeCandidates.length === 1) {
    activeGeneration = activeCandidates[0];
  } else if (activeCandidates.length > 1) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.MULTIPLE_ACTIVE_PLAN_ROWS, DIAGNOSTIC_SEVERITY.WARN, { count: activeCandidates.length }));
    activeGeneration = activeCandidates.sort((a, b) => b.createdAtMs - a.createdAtMs)[0]; // newest active
  } else if (generations.length) {
    activeGeneration = generations[generations.length - 1]; // fallback: newest generation
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.NO_ACTIVE_PLAN, DIAGNOSTIC_SEVERITY.WARN, { fallback: 'newest_generation' }));
  }

  // Assign each task to the generation whose plan CreatedAt is the greatest <= task.CreatedAt.
  // Deterministic tie-break: CreatedAt then TaskId. Tasks before the first batch -> g1 (ambiguous).
  function assignTask(task) {
    const tTs = ts(task.createdAt);
    let chosen = null;
    for (const g of generations) { // generations sorted ascending
      if (g.createdAtMs <= tTs) chosen = g; else break;
    }
    if (!chosen) {
      chosen = generations[0] || null; // earliest, with ambiguity note
      if (chosen) diagnostics.push(diagnostic(DIAGNOSTIC_CODE.TASK_GENERATION_AMBIGUOUS, DIAGNOSTIC_SEVERITY.WARN, { taskCreatedBeforeFirstBatch: true }));
    }
    return chosen;
  }

  return { generations, activeGeneration, assignTask, diagnostics };
}

/**
 * Step 7: isolate current-generation tasks; partition historical; flag hidden legacy snoozed.
 */
function isolateTasks(taskRows, gen) {
  const diagnostics = [];
  const annotated = taskRows.map(t => {
    const g = gen.assignTask(t);
    return {
      ...t,
      generationBatchId: g ? g.generationBatchId : null,
      generationOrdinal: g ? g.ordinal : null,
      isCurrentGeneration: !!(gen.activeGeneration && g && g.ordinal === gen.activeGeneration.ordinal),
    };
  });

  const currentTasks = annotated.filter(t => t.isCurrentGeneration);
  const historicalTasks = annotated.filter(t => !t.isCurrentGeneration);
  // Phase 1C §5: ALL legacy snoozed/pending(from snoozed) tasks are hidden from canonical pending.
  const hiddenLegacyTasks = annotated.filter(t => t.rawLegacyStatus === 'snoozed').map(t => ({ ...t, isLegacyHidden: true }));
  const completedEvidence = annotated.filter(t => t.rawLegacyStatus === 'completed' || t.status === TASK_STATUS.COMPLETED);
  // Canonical pending for legacy = EMPTY (legacy snoozed are not migrated — Phase 1C §5).
  const canonicalPendingTasks = [];

  return { annotated, currentTasks, historicalTasks, hiddenLegacyTasks, completedEvidence, canonicalPendingTasks, diagnostics };
}

/**
 * Step 8: deterministic stable legacy task numbers (read-time; no Sheet write).
 * Plan-wide order: (generationOrdinal, CreatedAt, TaskId). Adds legacyTaskNumber
 * (1..N plan-wide) and legacyCurrentGenerationDisplayOrder (1..k within active gen).
 */
function deriveLegacyTaskNumbers(annotatedTasks) {
  const diagnostics = [];
  const ordered = [...annotatedTasks].sort((a, b) =>
    (a.generationOrdinal || 0) - (b.generationOrdinal || 0) ||
    ts(a.createdAt) - ts(b.createdAt) ||
    String(a.taskId).localeCompare(b.taskId)
  );
  const withNumbers = ordered.map((t, i) => ({ ...t, legacyTaskNumber: i + 1 }));
  // Per-current-generation display order (1..k) for the active generation only.
  let dispCounter = 0;
  const result = withNumbers.map(t => {
    if (t.isCurrentGeneration) { dispCounter += 1; return { ...t, legacyCurrentGenerationDisplayOrder: dispCounter }; }
    return { ...t, legacyCurrentGenerationDisplayOrder: null };
  });
  if (result.length) diagnostics.push(diagnostic(DIAGNOSTIC_CODE.LEGACY_TASK_NUMBER_DERIVED, DIAGNOSTIC_SEVERITY.INFO, { count: result.length, nextTaskNumber: result.length + 1 }));
  return { tasks: result, nextTaskNumber: result.length + 1, diagnostics };
}

/**
 * Step 11: validate the active-plan pointer (read-only; never repairs).
 */
function validateActivePlanPointer(profile, planRows) {
  const diagnostics = [];
  const pointer = profile && profile.mentorPlanId;
  if (!pointer) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.POINTER_MISSING, DIAGNOSTIC_SEVERITY.ERROR, {}));
    return { valid: false, selectedActivePlan: null, diagnostics };
  }
  const referenced = planRows.filter(p => p.planId === pointer);
  if (!referenced.length) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.POINTER_MISMATCH, DIAGNOSTIC_SEVERITY.ERROR, { reason: 'pointer references no plan' }));
    return { valid: false, selectedActivePlan: null, diagnostics };
  }
  const activeRows = referenced.filter(p => p.status === 'active');
  if (activeRows.length === 0) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.NO_ACTIVE_PLAN, DIAGNOSTIC_SEVERITY.WARN, {}));
    // pick newest referenced row as best-effort selected plan (still flagged invalid)
    const newest = [...referenced].sort((a, b) => ts(b.createdAt) - ts(a.createdAt))[0];
    return { valid: false, selectedActivePlan: newest, diagnostics };
  }
  if (activeRows.length > 1) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.MULTIPLE_ACTIVE_PLAN_ROWS, DIAGNOSTIC_SEVERITY.WARN, { count: activeRows.length, sharedPlanId: true }));
  }
  if (referenced.length > 1) {
    diagnostics.push(diagnostic(DIAGNOSTIC_CODE.PLAN_ID_REUSED, DIAGNOSTIC_SEVERITY.WARN, { rows: referenced.length }));
  }
  const selected = [...activeRows].sort((a, b) => ts(b.createdAt) - ts(a.createdAt))[0]; // newest active
  return { valid: true, selectedActivePlan: selected, diagnostics };
}

module.exports = { deriveGenerations, isolateTasks, deriveLegacyTaskNumbers, validateActivePlanPointer };
