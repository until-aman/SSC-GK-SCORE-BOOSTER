// lib/mentor/services/rolloverWriteExecutor.js — Phase 10C daily-rollover WRITE executor.
//
// Persists a computed daily rollover behind flags. Gated and NEVER run while the
// rollover write flags are off. Ordering: per-task compare-and-update + event rows
// FIRST, LastProcessedCalendarDay next, the rollover idempotency row LAST — so a
// partial failure does not finalize idempotency and a re-run safely resumes
// (already-moved tasks fail RowVersion and are skipped). No net-new tasks.
'use strict';

const crypto = require('crypto');
const { processDailyRollover, rolloverKey } = require('./dailyRolloverService');

const NOOP_STORE = { get: async () => null, save: async () => {} };
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v || {})).digest('hex');
const isStale = msg => /STALE_|TASK_NOT_FOUND|DUPLICATE_TASK_ROWS/.test(String(msg || ''));

async function executeDailyRolloverWrite({ snapshot, userScope, activePlan, now, mutationRepository, idempotencyStore, planWriter, totalPlanDays } = {}) {
  if (!userScope || !activePlan || !activePlan.planId || !snapshot || !mutationRepository || !idempotencyStore) {
    return { ok: false, code: 'INVALID_ROLLOVER_WRITE_INPUT' };
  }
  const planId = activePlan.planId;
  const calendarDay = Number(snapshot.calendarDay || 1);
  const key = rolloverKey({ userScope, planId, calendarDay });
  const at = now || new Date().toISOString();

  // 1. idempotent replay — already finalized for this user/plan/day.
  const existing = await idempotencyStore.get(key);
  if (existing) return { ok: true, idempotent: true, ...(existing.result || {}) };

  // 2. compute the plan with a NO-OP store (executor owns persistence ordering).
  const plan = await processDailyRollover({ userScope, activePlan, repositorySnapshot: snapshot, currentServerTime: at, idempotencyStore: NOOP_STORE });
  if (!plan.ok) return { ok: false, code: plan.code || 'ROLLOVER_PLAN_FAILED' };
  if (!plan.rolloverRequired) return { ok: true, rolloverRequired: false, movedToPendingCount: 0, rescheduledCount: 0, idempotent: false };

  // 3. final-day policy: do NOT auto-move work to pending on/after the last plan day.
  const tpd = Number(totalPlanDays || snapshot.totalPlanDays || 0);
  const finalDay = tpd > 0 && calendarDay >= tpd;
  const diagnostics = [...(plan.diagnostics || [])];
  if (!tpd) diagnostics.push('FINAL_DAY_POLICY_UNKNOWN');      // blocker to resolve before live run
  if (finalDay) diagnostics.push('FINAL_DAY_NO_PENDING_MOVE');
  const updates = finalDay ? [] : (plan.taskUpdates || []);

  // 4. persist each change, RowVersion-guarded. STALE_* = benign (already moved) -> skip.
  //    A real error aborts WITHOUT finalizing the idempotency row -> re-run resumes.
  let applied = 0, skippedStale = 0; const appliedTaskIds = [];
  for (const u of updates) {
    try {
      await mutationRepository.compareAndUpdateTask({ taskId: u.taskId, expected: u.expected, updates: u.updates });
      await mutationRepository.appendTaskEvent({ ...u.event, planId, idempotencyKey: key, source: 'daily_rollover', createdAt: at });
      applied += 1; appliedTaskIds.push(u.taskId);
    } catch (e) {
      if (isStale(e.message)) { skippedStale += 1; continue; }
      return { ok: false, code: 'ROLLOVER_PARTIAL_FAILURE', error: e.message, applied, skippedStale };
    }
  }

  // 5. LastProcessedCalendarDay on the ACTIVE / current-generation plan row (Bug A fix).
  //    A missing column is tolerated (Phase 10C contract); but an UNRESOLVED active row
  //    (not found / no active / ambiguous) is a real failure — do NOT finalize, so a
  //    re-run after the data is corrected can complete. (Bug B: no silent partial success.)
  const UNRESOLVED = new Set(['PLAN_ROW_NOT_FOUND', 'PLAN_ROW_NO_ACTIVE', 'PLAN_ROW_AMBIGUOUS']);
  let lastProcessedWritten = false;
  try {
    if (planWriter && typeof planWriter.setLastProcessedCalendarDay === 'function') {
      const w = await planWriter.setLastProcessedCalendarDay(planId, calendarDay, {
        planVersion: activePlan.planVersion, generationId: activePlan.generationId,
      });
      lastProcessedWritten = Boolean(w && w.written);
      if (w && w.reason) diagnostics.push(w.reason);
      if (w && !w.written && UNRESOLVED.has(w.reason)) {
        return { ok: false, code: 'ROLLOVER_DAY_MARKER_UNRESOLVED', reason: w.reason, appliedCount: applied, skippedStaleCount: skippedStale, appliedTaskIds, diagnostics };
      }
    }
  } catch (e) {
    return { ok: false, code: 'ROLLOVER_DAY_MARKER_FAILED', error: e.message, appliedCount: applied, skippedStaleCount: skippedStale, appliedTaskIds, diagnostics };
  }

  // 6. finalize the rollover idempotency row LAST (Action=ROLLOVER on MentorMutationRequests).
  //    A finalization failure is surfaced as ok:false — the caller MUST treat it as a
  //    failure (the idempotency row is absent, so a re-run safely resumes and finalizes).
  const result = {
    ok: true, rolloverRequired: true, calendarDay, finalDay,
    movedToPendingCount: finalDay ? 0 : plan.movedToPendingCount,
    rescheduledCount: finalDay ? 0 : plan.rescheduledCount,
    appliedCount: applied, skippedStaleCount: skippedStale, appliedTaskIds,
    lastProcessedWritten, diagnostics,
    event: { ...(plan.rolloverEvent || {}), action: 'ROLLOVER', idempotencyKey: key },
    task: { planId },
  };
  try {
    await idempotencyStore.save(key, { payloadHash: hash({ planId, calendarDay }), result, createdAt: at });
  } catch (e) {
    return { ok: false, code: 'ROLLOVER_FINALIZE_FAILED', error: e.message, appliedCount: applied, skippedStaleCount: skippedStale, appliedTaskIds, lastProcessedWritten, diagnostics };
  }
  return result;
}

module.exports = { executeDailyRolloverWrite };
