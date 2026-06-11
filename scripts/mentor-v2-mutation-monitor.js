#!/usr/bin/env node
// scripts/mentor-v2-mutation-monitor.js — read-only live V2 mutation health audit.
// Performs ONLY reads. Run: DOTENV_CONFIG_PATH=.env.local node -r dotenv/config scripts/mentor-v2-mutation-monitor.js
'use strict';

const { auditV2Mutations } = require('../lib/mentor/read/v2MutationMonitor');
const flags = require('../lib/mentor/repository/featureFlags');

(async () => {
  const { getSheetsClient } = require('../lib/sheets');
  const sheets = await getSheetsClient();
  const allowedUserHashes = flags.getV2MutationAllowedUserHashes();
  const audit = await auditV2Mutations(sheets, { allowedUserHashes });
  const out = {
    ...audit,
    allowlistSize: allowedUserHashes.length,
    flags: {
      MENTOR_TASK_MUTATIONS_V2: flags.isMentorTaskMutationsV2Enabled(),
      MENTOR_SHEETS_MUTATIONS_V2: flags.isMentorSheetsMutationsV2Enabled(),
      MENTOR_MUTATION_IDEMPOTENCY_V2: flags.isMentorMutationIdempotencyV2Enabled(),
      MENTOR_DAILY_ROLLOVER_V2: flags.isMentorDailyRolloverV2Enabled(),
      MENTOR_PENDING_LIFECYCLE_V2: flags.isMentorPendingLifecycleV2Enabled(),
    },
  };
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('monitor error:', e.message); process.exit(1); });
