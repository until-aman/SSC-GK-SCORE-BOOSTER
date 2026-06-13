// pages/api/internal/mentor-v2-monitor.js
// Phase 9M2 — Vercel Cron read-only Mentor V2 guardrail monitor.
//
// Invoked on a schedule by Vercel Cron (see vercel.json). Performs ONLY Google
// Sheets reads via auditV2Mutations, evaluates guardrail alerts, and returns JSON.
// CRITICAL -> HTTP 500 (marks the cron run failed / alert); WARNING/OK -> 200.
// NEVER mutates the Sheet. Protected by CRON_SECRET (fail-closed).

import { getSheetsClient } from '@/lib/sheets';
import { auditV2Mutations, cronMonitorResult, isValidCronRequest } from '@/lib/mentor/read/v2MutationMonitor';
import * as flags from '@/lib/mentor/repository/featureFlags';

export default async function handler(req, res) {
  // Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
  // is set on the project. Fail closed if the secret is unset or the header mismatches.
  if (!isValidCronRequest(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sheets = await getSheetsClient();
    const allowedUserHashes = flags.getV2MutationAllowedUserHashes();
    const audit = await auditV2Mutations(sheets, { allowedUserHashes }); // read-only
    const flagState = {
      MENTOR_TASK_MUTATIONS_V2: flags.isMentorTaskMutationsV2Enabled(),
      MENTOR_SHEETS_MUTATIONS_V2: flags.isMentorSheetsMutationsV2Enabled(),
      MENTOR_MUTATION_IDEMPOTENCY_V2: flags.isMentorMutationIdempotencyV2Enabled(),
      MENTOR_V2_MUTATION_ALLOW_ALL: flags.isMentorV2MutationAllowAllEnabled(),
      MENTOR_DAILY_ROLLOVER_V2: flags.isMentorDailyRolloverV2Enabled(),
      MENTOR_DAILY_ROLLOVER_ALLOW_ALL: flags.isMentorDailyRolloverAllowAllEnabled(),
      rolloverAllowlistCount: flags.getDailyRolloverAllowedUserHashes().length,
      MENTOR_PENDING_LIFECYCLE_V2: flags.isMentorPendingLifecycleV2Enabled(),
    };
    const { httpStatus, body } = cronMonitorResult(audit, flagState);
    return res.status(httpStatus).json(body);
  } catch (err) {
    // A failure to even read is itself an alert-worthy condition.
    return res.status(500).json({ alertStatus: 'CRITICAL', error: 'monitor_failed', message: err.message });
  }
}
