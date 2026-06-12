#!/usr/bin/env node
// scripts/mentor-v2-mutation-monitor.js — read-only live V2 mutation health audit.
// Performs ONLY reads. Run: DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mentor-v2-mutation-monitor.js
'use strict';

const { auditV2Mutations, evaluateMonitorAlerts } = require('../lib/mentor/read/v2MutationMonitor');
const flags = require('../lib/mentor/repository/featureFlags');

const JSON_ONLY = process.argv.includes('--json');

(async () => {
  const { getSheetsClient } = require('../lib/sheets');
  const sheets = await getSheetsClient();
  const allowedUserHashes = flags.getV2MutationAllowedUserHashes();
  const audit = await auditV2Mutations(sheets, { allowedUserHashes });
  const mutationAllowAll = flags.isMentorV2MutationAllowAllEnabled();
  const rolloverAllowlist = flags.getDailyRolloverAllowedUserHashes();
  const flagState = {
    MENTOR_TASK_MUTATIONS_V2: flags.isMentorTaskMutationsV2Enabled(),
    MENTOR_SHEETS_MUTATIONS_V2: flags.isMentorSheetsMutationsV2Enabled(),
    MENTOR_MUTATION_IDEMPOTENCY_V2: flags.isMentorMutationIdempotencyV2Enabled(),
    MENTOR_V2_MUTATION_ALLOW_ALL: mutationAllowAll,
    MENTOR_DAILY_ROLLOVER_V2: flags.isMentorDailyRolloverV2Enabled(),
    MENTOR_DAILY_ROLLOVER_ALLOW_ALL: flags.isMentorDailyRolloverAllowAllEnabled(),
    rolloverAllowlistCount: rolloverAllowlist.length,
    MENTOR_PENDING_LIFECYCLE_V2: flags.isMentorPendingLifecycleV2Enabled(),
  };
  const { status, alerts } = evaluateMonitorAlerts(audit, { flags: flagState });
  const out = { alertStatus: status, alerts, mutationAllowAll, ...audit, allowlistSize: allowedUserHashes.length, flags: flagState };

  if (JSON_ONLY) { console.log(JSON.stringify(out, null, 2)); if (status === 'CRITICAL') process.exitCode = 2; return; }

  // Operator summary first, then full JSON.
  console.log(`\n===== Mentor V2 Mutation Monitor =====`);
  console.log(`ALERT STATUS: ${status}${status === 'OK' ? ' OK' : ' <<'}`);
  if (alerts.length) alerts.forEach(a => console.log(`  [${a.level}] ${a.code}: ${a.message}`));
  else console.log('  (no alerts)');
  console.log(`MutationRequests: ${audit.totalMutationRequests}  (POSTPONE ${audit.postponeMutationCount} / RESUME ${audit.resumeMutationCount} / COMPLETE ${audit.completeMutationCount})`);
  console.log(`Canonical events: POSTPONE ${audit.canonicalPostponeEvents} / RESUME ${audit.canonicalResumeEvents} / COMPLETE ${audit.canonicalCompleteEvents}`);
  console.log(`Guardrails: unexpectedOutsideAllowlist=${audit.unexpectedMutationsOutsideAllowlist}  duplicateIdempotencyKeys=${audit.duplicateIdempotencyKeys}  failed=${audit.failedMutationRequests}`);
  console.log(`Affected real plan (${audit.affectedRealPlanId}): ${JSON.stringify(audit.affectedRealPlanStatus)}  (expected {completed:5, snoozed:10})`);
  console.log(`Mutation scope: allowAll=${mutationAllowAll}  allowlistSize=${allowedUserHashes.length}  |  rollover/pending write flags: ${flagState.MENTOR_DAILY_ROLLOVER_V2}/${flagState.MENTOR_PENDING_LIFECYCLE_V2}`);
  console.log(`Rollover:`);
  console.log(`  dailyRolloverFlagEnabled=${flagState.MENTOR_DAILY_ROLLOVER_V2}  rolloverAllowAllEnabled=${flagState.MENTOR_DAILY_ROLLOVER_ALLOW_ALL}  rolloverAllowlistedUsersCount=${rolloverAllowlist.length}`);
  console.log(`  rolloverMutationRequestCount=${audit.rolloverMutationRequestCount}  duplicateRolloverIdempotencyKeys=${audit.duplicateRolloverIdempotencyKeys}  failedRolloverMutationRequests=${audit.failedRolloverMutationRequests}`);
  console.log(`  tasksMovedToPendingByRollover=${audit.tasksMovedToPendingByRollover}  quickChecksIncorrectlyPendingByRollover=${audit.quickChecksIncorrectlyPendingByRollover}  activeTaskCountOverLimit=${audit.activeTaskCountOverLimit}`);
  console.log(`  maxPendingBacklogByPlan=${audit.maxPendingBacklogByPlan}  rolloverPlansMissingLastProcessedCalendarDay=${audit.rolloverPlansMissingLastProcessedCalendarDay}`);
  console.log(`\n--- full audit JSON ---`);
  console.log(JSON.stringify(out, null, 2));

  if (status === 'CRITICAL') process.exitCode = 2; // gate CI/cron alerting
})().catch(e => { console.error('monitor error:', e.message); process.exit(1); });
