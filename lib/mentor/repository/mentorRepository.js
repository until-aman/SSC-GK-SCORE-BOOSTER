// lib/mentor/repository/mentorRepository.js — storage-independent contract + orchestrator (Phase 2 Step 2,12). CommonJS.
//
// Defines the read interface, reserves write methods (throw NotImplemented), and
// provides the PURE `buildSnapshotFromRawData` orchestrator used by every adapter.
'use strict';

const parsers = require('./parsers');
const gen = require('./legacyGenerationAdapter');
const { calculatePlanDayState } = require('../domain/planDay');
const { validateRepositorySnapshot } = require('../domain/invariants');
const { emptySnapshot, REPOSITORY_VERSION, diagnostic } = require('../domain/types');
const { NotImplementedError } = require('../domain/errors');
const { DIAGNOSTIC_CODE, DIAGNOSTIC_SEVERITY } = require('../domain/enums');

/**
 * Repository read interface (documented contract). A concrete adapter (Sheets,
 * future Supabase) supplies raw tab data; the orchestrator below is shared.
 *
 *   getProfile(userIdentity)
 *   getActivePlan(userIdentity)
 *   getPlanById(userIdentity, planId)
 *   getPlanRows(userIdentity, planId)
 *   getCurrentTasks(userIdentity, activePlan)
 *   getHistoricalTasks(userIdentity, activePlan)
 *   getPendingTasks(userIdentity, activePlan)
 *   getStudentTopicState(userIdentity)
 *   getMentorSnapshotData(userIdentity)
 *   validatePlanPointer(userIdentity)
 */

// Reserved write methods — NOT implemented in Phase 2 (Step 2). They throw explicitly
// rather than silently no-op, so no half-working write can ship.
const RESERVED_WRITE_METHODS = [
  'createPlan',
  'replacePlan',
  'updateTask',
  'completeTask',
  'postponeTask',
  'appendEvent',
  'reserveTaskNumbers',
  'getTaskForMutation',
  'compareAndUpdateTask',
  'appendTaskEvent',
  'getIdempotencyResult',
  'saveIdempotencyResult',
];
function notImplementedWrites() {
  const obj = {};
  RESERVED_WRITE_METHODS.forEach(op => { obj[op] = () => { throw new NotImplementedError(op); }; });
  return obj;
}

/**
 * PURE orchestrator. Accepts raw tab data shaped as:
 *   { profile:{headers,rows}, plans:{headers,rows}, tasks:{headers,rows}, topicState:{headers,rows} }
 * and produces a repository-level snapshot + diagnostics. NEVER writes.
 *
 * @param {Object} rawData
 * @param {{email:string}} userIdentity
 * @returns {import('../domain/types').MentorRepositorySnapshot & {validation:Object}}
 */
function buildSnapshotFromRawData(rawData, userIdentity) {
  const email = userIdentity && userIdentity.email;
  const snap = emptySnapshot();
  const D = snap.diagnostics;

  // 1. Profile (header-based read; logged positional fallback inside parser).
  const profileRes = parsers.parseProfile(rawData.profile || {}, email);
  D.push(...profileRes.diagnostics);
  snap.profile = profileRes.profile;

  // 2. Plans for the logical pointer PlanId (or all plans if no pointer).
  const plansRes = parsers.parsePlans(rawData.plans || {}, email);
  D.push(...plansRes.diagnostics);
  const pointer = snap.profile && snap.profile.mentorPlanId;
  const planRows = pointer ? plansRes.plans.filter(p => p.planId === pointer) : plansRes.plans;

  // 3. Validate the pointer (read-only).
  const pointerRes = gen.validateActivePlanPointer(snap.profile, plansRes.plans);
  D.push(...pointerRes.diagnostics);
  snap.activePlan = pointerRes.selectedActivePlan;

  const earliestPlan = plansRes.plans.length
    ? [...plansRes.plans].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0]
    : null;
  const planDay = calculatePlanDayState({
    serverNow: userIdentity?.serverNow,
    timezone: snap.activePlan?.timezone || snap.profile?.timezone,
    planStartLocalDate: snap.activePlan?.planStartLocalDate || snap.profile?.planStartLocalDate,
    onboardingCompletedAt: snap.profile?.onboardingCompletedAt,
    activePlanCreatedAt: snap.activePlan?.createdAt,
    earliestPlanCreatedAt: earliestPlan?.createdAt,
    daysLeftRange: snap.activePlan?.daysLeftSnapshot || snap.profile?.daysLeftRange,
    customDaysLeft: snap.profile?.customDaysLeft,
    totalPlanDays: snap.activePlan?.totalPlanDays,
    legacyActiveDayNumber: snap.activePlan?.unlockedDay || snap.activePlan?.activeDayNumber || snap.profile?.activeDayNumber,
  });
  D.push(...planDay.diagnostics);
  snap.planStartLocalDate = planDay.planStartLocalDate;
  snap.planStartSource = planDay.planStartSource;
  snap.timezone = planDay.timezone;
  snap.totalPlanDays = planDay.totalPlanDays;
  snap.calendarDay = planDay.calendarDay;
  snap.unlockedDay = planDay.unlockedDay;
  snap.activePlanDay = planDay.activePlanDay;
  snap.isPlanComplete = planDay.isPlanComplete;
  snap.daysRemaining = planDay.daysRemaining;
  snap.serverGeneratedAt = planDay.serverGeneratedAt;

  // 4. Tasks for that PlanId.
  const planId = (snap.activePlan && snap.activePlan.planId) || pointer || (planRows[0] && planRows[0].planId);
  const tasksRes = parsers.parseTasks(rawData.tasks || {}, email, planId);
  D.push(...tasksRes.diagnostics);

  // 5. Generation derivation + current-task isolation + stable numbering.
  if (planRows.length) {
    const g = gen.deriveGenerations(planRows, tasksRes.tasks);
    D.push(...g.diagnostics);
    snap.activeGeneration = g.activeGeneration
      ? { ordinal: g.activeGeneration.ordinal, generationBatchId: g.activeGeneration.generationBatchId, planId: g.activeGeneration.planRow.planId }
      : null;

    const iso = gen.isolateTasks(tasksRes.tasks, g);
    D.push(...iso.diagnostics);

    const numbered = gen.deriveLegacyTaskNumbers(iso.annotated);
    D.push(...numbered.diagnostics);
    snap.nextTaskNumber = numbered.nextTaskNumber;

    const byId = new Map(numbered.tasks.map(t => [t.taskId, t]));
    const proj = (list) => list.map(t => byId.get(t.taskId) || t);
    snap.currentTasks = proj(iso.currentTasks);
    snap.historicalTasks = proj(iso.historicalTasks);
    snap.hiddenLegacyTasks = proj(iso.hiddenLegacyTasks);
    snap.completedEvidence = proj(iso.completedEvidence);
    snap.canonicalPendingTasks = iso.canonicalPendingTasks; // empty for legacy
  } else if (snap.profile) {
    D.push(diagnostic(DIAGNOSTIC_CODE.NO_ACTIVE_PLAN, DIAGNOSTIC_SEVERITY.WARN, { reason: 'no plan rows for pointer' }));
  }

  // 6. StudentTopicState (dedupe newest).
  const topicRes = parsers.parseTopicState(rawData.topicState || {}, email);
  D.push(...topicRes.diagnostics);
  snap.studentTopicState = topicRes.topicState;

  snap.repositoryVersion = REPOSITORY_VERSION;
  const validation = validateRepositorySnapshot(snap);
  return { ...snap, validation };
}

module.exports = { buildSnapshotFromRawData, notImplementedWrites, RESERVED_WRITE_METHODS };
