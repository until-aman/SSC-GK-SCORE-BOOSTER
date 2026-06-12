// lib/mentor/services/dailyRolloverService.js - canonical daily rollover foundation (Phase 5). CommonJS.
'use strict';

const crypto = require('crypto');
const { TASK_ACTION, evaluateTaskTransition, normalizeTaskStatus } = require('../domain/taskStateMachine');
const { TASK_STATUS, TASK_TYPE, PENDING_REASON } = require('../domain/enums');
const { differenceInLocalCalendarDays, toLocalDateKey } = require('../domain/planDay');

const PENDABLE_TYPES = new Set([TASK_TYPE.PRACTICE_TASK, TASK_TYPE.REVISION_TASK, TASK_TYPE.MISTAKE_RECOVERY_TASK, TASK_TYPE.THEORY_TASK]);
const QUICK_CHECK_TYPES = new Set([TASK_TYPE.COVERAGE_CHECK, TASK_TYPE.CONFIDENCE_CHECK, TASK_TYPE.FEEDBACK_TASK]);
const NON_PENDING_TYPES = new Set([...QUICK_CHECK_TYPES, TASK_TYPE.PACE_UNLOCK_TASK]);
const MAX_ACTIVE_TASKS = 3;
const LEGACY_SNOOZED = 'snoozed';

function hashPayload(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function rolloverKey({ userScope, planId, calendarDay }) {
  return `mentor-rollover:${userScope}:${planId}:${calendarDay}`;
}

function reject(code, message) {
  return { ok: false, code, message };
}

function statusOf(task) {
  return normalizeTaskStatus(task.status);
}

function isCurrentPlanTask(task, planId) {
  return task?.planId === planId && task.isCurrentGeneration !== false && !task.isLegacyHidden;
}

function canMoveToPending(task) {
  return PENDABLE_TYPES.has(task.type || task.taskType) && [TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS].includes(statusOf(task));
}

function shouldRescheduleCheck(task) {
  return NON_PENDING_TYPES.has(task.type || task.taskType) && [TASK_STATUS.ACTIVE, TASK_STATUS.IN_PROGRESS, TASK_STATUS.SCHEDULED].includes(statusOf(task));
}

function pendingReasonFor(task) {
  return statusOf(task) === TASK_STATUS.IN_PROGRESS ? PENDING_REASON.IN_PROGRESS_ABANDONED : PENDING_REASON.DAY_ENDED_INCOMPLETE;
}

function nextEligibleAt(nowIso) {
  const d = new Date(nowIso);
  d.setUTCHours(d.getUTCHours() + 12);
  return d.toISOString();
}

function pendingAgeDays(task, timezone, serverGeneratedAt) {
  const moved = task.movedToPendingAt || task.updatedAt || task.createdAt;
  if (!moved) return 0;
  return Math.max(0, differenceInLocalCalendarDays(toLocalDateKey(moved, timezone), toLocalDateKey(serverGeneratedAt, timezone)));
}

function pendingNudgeTier(count) {
  if (count <= 0) return 'hidden';
  if (count <= 3) return 'normal';
  if (count <= 7) return 'stronger';
  if (count <= 14) return 'backlog_session';
  return 'plan_review';
}

function pendingPriority(task) {
  if ((task.type || task.taskType) === TASK_TYPE.MISTAKE_RECOVERY_TASK || task.reason === 'recent_mistakes') return 0;
  if (task.pendingReason === PENDING_REASON.IN_PROGRESS_ABANDONED) return 1;
  return Number(task.mentorPriorityScore || 99);
}

// Phase 8A: single canonical predicate for pending-backlog eligibility. A legacy
// `Status = snoozed` row (read-normalized to `pending`) is NOT canonical pending
// unless it carries explicit v2 pending evidence (PendingReason / MovedToPendingAt).
// This keeps ALL legacy snoozed rows hidden — including current-generation ones —
// consistent with Repository V2 and Phase 1C §5.
function hasV2PendingEvidence(task) {
  return String(task.pendingReason || '').trim() !== '' || String(task.movedToPendingAt || '').trim() !== '';
}

function isCanonicalPendingTask(task) {
  if (!task) return false;
  const type = task.type || task.taskType;
  // hidden historical generations + explicitly hidden legacy rows
  if (task.isCurrentGeneration === false || task.isLegacyHidden) return false;
  // quick checks + feedback never enter the pending backlog
  if (QUICK_CHECK_TYPES.has(type)) return false;
  // must be canonical pending (this also excludes completed/cancelled/expired/scheduled/active)
  if (statusOf(task) !== TASK_STATUS.PENDING) return false;
  // legacy snoozed rows stay hidden unless explicitly migrated with v2 pending evidence
  if (String(task.rawLegacyStatus || '').toLowerCase() === LEGACY_SNOOZED && !hasV2PendingEvidence(task)) return false;
  return true;
}

function listPendingTasks(tasks = [], activePlan = {}, opts = {}) {
  const planId = activePlan.planId;
  const seen = new Set();
  return tasks
    .filter(task => task.planId === planId)
    .filter(isCanonicalPendingTask)
    .filter(task => {
      if (seen.has(task.taskId)) return false;
      seen.add(task.taskId);
      return true;
    })
    .map(task => ({ ...task, pendingAgeDays: pendingAgeDays(task, opts.timezone || 'Asia/Kolkata', opts.serverGeneratedAt || new Date().toISOString()) }))
    .sort((a, b) =>
      pendingPriority(a) - pendingPriority(b) ||
      new Date(a.movedToPendingAt || a.updatedAt || 0) - new Date(b.movedToPendingAt || b.updatedAt || 0) ||
      Number(a.originalScheduledPlanDay || a.scheduledPlanDay || a.dayNumber || 0) - Number(b.originalScheduledPlanDay || b.scheduledPlanDay || b.dayNumber || 0) ||
      Number(a.taskNumber || a.legacyTaskNumber || a.sequenceNumber || 0) - Number(b.taskNumber || b.legacyTaskNumber || b.sequenceNumber || 0) ||
      String(a.taskId).localeCompare(String(b.taskId))
    );
}

function selectFeaturedPendingTask(pendingTasks = [], prior = {}, calendarDay) {
  if (!pendingTasks.length) return { featuredPendingTask: null, featuredPendingTaskId: '', featuredPendingForCalendarDay: calendarDay };
  const existing = pendingTasks.find(t => t.taskId === prior.featuredPendingTaskId && Number(prior.featuredPendingForCalendarDay) === Number(calendarDay));
  const selected = existing || pendingTasks[0];
  return { featuredPendingTask: selected, featuredPendingTaskId: selected.taskId, featuredPendingForCalendarDay: calendarDay };
}

function materializeTasksForPlanDay({ existingTasks = [] } = {}) {
  const active = existingTasks
    .filter(task => statusOf(task) === TASK_STATUS.ACTIVE && !task.isLegacyHidden && task.isCurrentGeneration !== false)
    .sort((a, b) => Number(a.taskNumber || a.sequenceNumber || 0) - Number(b.taskNumber || b.sequenceNumber || 0));
  return {
    activeTasks: active.slice(0, MAX_ACTIVE_TASKS),
    scheduledOverflow: active.slice(MAX_ACTIVE_TASKS).map(task => ({ ...task, status: TASK_STATUS.SCHEDULED })),
    diagnostics: active.length > MAX_ACTIVE_TASKS ? ['MAX_ACTIVE_TASKS_APPLIED'] : [],
  };
}

async function processDailyRollover({
  userScope,
  activePlan,
  repositorySnapshot,
  currentServerTime,
  idempotencyStore,
  priorFeatured = {},
} = {}) {
  if (!userScope || !activePlan?.planId || !repositorySnapshot) return reject('INVALID_ROLLOVER_INPUT', 'Rollover input is incomplete.');
  const calendarDay = Number(repositorySnapshot.calendarDay || 1);
  const previousProcessed = Number(repositorySnapshot.lastProcessedCalendarDay || activePlan.lastProcessedCalendarDay || activePlan.activeDayNumber || 1);
  const key = rolloverKey({ userScope, planId: activePlan.planId, calendarDay });
  const payloadHash = hashPayload({ planId: activePlan.planId, previousProcessed, calendarDay });
  const existing = await idempotencyStore?.get?.(key);
  if (existing) {
    if (existing.payloadHash !== payloadHash) return reject('ROLLOVER_IDEMPOTENCY_PAYLOAD_MISMATCH', 'Same rollover key used with different payload.');
    return { ...existing.result, idempotent: true };
  }

  const serverGeneratedAt = currentServerTime || repositorySnapshot.serverGeneratedAt || new Date().toISOString();
  const tasks = [...(repositorySnapshot.currentTasks || []), ...(repositorySnapshot.canonicalPendingTasks || [])];
  const diagnostics = [];
  if (calendarDay <= previousProcessed) {
    const pendingTasks = listPendingTasks(tasks, activePlan, { timezone: repositorySnapshot.timezone, serverGeneratedAt });
    const featured = selectFeaturedPendingTask(pendingTasks, priorFeatured, calendarDay);
    const result = {
      ok: true,
      rolloverRequired: false,
      calendarDay,
      lastProcessedCalendarDay: previousProcessed,
      pendingTasks,
      pendingCount: pendingTasks.length,
      pendingNudgeTier: pendingNudgeTier(pendingTasks.length),
      ...featured,
      movedToPendingCount: 0,
      rescheduledCount: 0,
      activatedCount: 0,
      events: [],
      diagnostics,
      rolloverProcessedAt: '',
    };
    await idempotencyStore?.save?.(key, { payloadHash, result, createdAt: serverGeneratedAt });
    return result;
  }
  if (calendarDay - previousProcessed > 1) diagnostics.push('MULTI_DAY_GAP_PROCESSED');

  const nextTasks = tasks.map(task => ({ ...task }));
  const events = [];
  let movedToPendingCount = 0;
  let rescheduledCount = 0;
  for (let i = 0; i < nextTasks.length; i += 1) {
    const task = nextTasks[i];
    if (!isCurrentPlanTask(task, activePlan.planId)) continue;
    if (canMoveToPending(task)) {
      const transition = evaluateTaskTransition({
        task,
        action: TASK_ACTION.POSTPONE,
        now: serverGeneratedAt,
        context: {
          userScope,
          pendingReason: pendingReasonFor(task),
          source: 'daily_rollover',
          idempotencyKey: key,
          eventPayload: { rollover: true },
        },
      });
      if (transition.allowed) {
        nextTasks[i] = {
          ...transition.nextTask,
          pendingReason: task.pendingReason || pendingReasonFor(task),
          movedToPendingAt: task.movedToPendingAt || serverGeneratedAt,
          nextEligibleResurfaceAt: task.nextEligibleResurfaceAt || serverGeneratedAt,
          originalScheduledPlanDay: task.originalScheduledPlanDay || task.scheduledPlanDay || task.dayNumber,
        };
        events.push(transition.event);
        movedToPendingCount += 1;
      }
    } else if (shouldRescheduleCheck(task)) {
      const transition = evaluateTaskTransition({
        task: { ...task, status: TASK_STATUS.SCHEDULED },
        action: TASK_ACTION.DEFER_CHECK,
        now: serverGeneratedAt,
        context: {
          userScope,
          source: 'daily_rollover',
          idempotencyKey: key,
          nextEligibleAt: nextEligibleAt(serverGeneratedAt),
        },
      });
      if (transition.allowed) {
        nextTasks[i] = transition.nextTask;
        events.push(transition.event);
        rescheduledCount += 1;
      }
    }
  }

  const materialized = materializeTasksForPlanDay({ plan: activePlan, planDay: calendarDay, existingTasks: nextTasks });
  diagnostics.push(...materialized.diagnostics);
  const pendingTasks = listPendingTasks(nextTasks, activePlan, { timezone: repositorySnapshot.timezone, serverGeneratedAt });
  const featured = selectFeaturedPendingTask(pendingTasks, priorFeatured, calendarDay);
  const rolloverEvent = {
    eventId: `rollover_${calendarDay}_${activePlan.planId}`,
    userScope,
    planId: activePlan.planId,
    taskId: '',
    type: 'daily_rollover_processed',
    fromStatus: '',
    toStatus: '',
    action: 'DAILY_ROLLOVER',
    idempotencyKey: key,
    source: 'daily_rollover',
    requestId: '',
    payload: {
      previousProcessedDay: previousProcessed,
      newCalendarDay: calendarDay,
      tasksMovedToPending: movedToPendingCount,
      quickChecksRescheduled: rescheduledCount,
      tasksActivated: materialized.activeTasks.length,
      featuredPendingSelected: Boolean(featured.featuredPendingTask),
    },
    createdAt: serverGeneratedAt,
  };
  const result = {
    ok: true,
    rolloverRequired: true,
    calendarDay,
    lastProcessedCalendarDay: calendarDay,
    pendingTasks,
    pendingCount: pendingTasks.length,
    pendingNudgeTier: pendingNudgeTier(pendingTasks.length),
    ...featured,
    movedToPendingCount,
    rescheduledCount,
    activatedCount: materialized.activeTasks.length,
    activeTasks: materialized.activeTasks,
    scheduledOverflow: materialized.scheduledOverflow,
    events: [...events, rolloverEvent],
    diagnostics,
    rolloverProcessedAt: serverGeneratedAt,
  };
  await idempotencyStore?.save?.(key, { payloadHash, result, createdAt: serverGeneratedAt });
  return result;
}

function extendSnapshotWithPending(snapshot, rolloverResult = {}) {
  const pendingTasks = rolloverResult.pendingTasks || listPendingTasks([...(snapshot.currentTasks || []), ...(snapshot.canonicalPendingTasks || [])], snapshot.activePlan || {}, { timezone: snapshot.timezone, serverGeneratedAt: snapshot.serverGeneratedAt });
  const featured = rolloverResult.featuredPendingTaskId ? rolloverResult : selectFeaturedPendingTask(pendingTasks, {}, snapshot.calendarDay);
  return {
    ...snapshot,
    pendingTasks,
    pendingCount: pendingTasks.length,
    featuredPendingTask: featured.featuredPendingTask || null,
    featuredPendingForCalendarDay: featured.featuredPendingForCalendarDay || snapshot.calendarDay,
    pendingNudgeTier: pendingNudgeTier(pendingTasks.length),
    lastProcessedCalendarDay: rolloverResult.lastProcessedCalendarDay || snapshot.activePlan?.activeDayNumber || 1,
    rolloverRequired: Boolean(rolloverResult.rolloverRequired),
    rolloverProcessedAt: rolloverResult.rolloverProcessedAt || '',
  };
}

module.exports = {
  MAX_ACTIVE_TASKS,
  rolloverKey,
  processDailyRollover,
  listPendingTasks,
  isCanonicalPendingTask,
  hasV2PendingEvidence,
  selectFeaturedPendingTask,
  pendingAgeDays,
  pendingNudgeTier,
  materializeTasksForPlanDay,
  extendSnapshotWithPending,
  canMoveToPending,
  shouldRescheduleCheck,
};
