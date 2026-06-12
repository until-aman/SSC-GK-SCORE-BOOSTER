// lib/mentor/read/taskActionRouting.js — V2 task-action cut-over routing gate.
// CommonJS, pure flag/whitelist logic so the ESM route and CJS tests share it.
//
// Phase 9B-Prep: scaffolding only. The V2 mutation path may run ONLY when all
// three mutation flags are true AND the legacy actionType is on the cut-over
// whitelist (Phase 9A decision: `postpone` / "Maybe Later" first). While the
// flags are false this always returns false, so the legacy write path stays the
// sole active path. Whitelist keys are LEGACY actionType values (UI sends these).
'use strict';

const flags = require('../repository/featureFlags');
const { userScopeFromIdentity } = require('../services/taskMutationService');

// Legacy actionTypes eligible for the V2 cut-over.
//   'snooze' = Maybe Later -> V2 POSTPONE
//   'resume' = Resume      -> V2 RESUME (pending -> active)
const V2_CUTOVER_ACTIONS = Object.freeze(['snooze', 'resume']);

// Compute the user scope hash (u_<sha256(email)[:16]>) used by the cohort allowlist.
function userScopeHashFor(identity) {
  return typeof identity === 'string' ? identity : userScopeFromIdentity(identity || {});
}

// Cohort gate: the user's scope hash must be on the allowlist (fail closed if empty).
function isV2MutationUserAllowed(identity) {
  return flags.isMentorV2MutationUserAllowed(userScopeHashFor(identity));
}

// V2 task mutation is active only when ALL three mutation flags are true.
function isV2TaskMutationActive() {
  return (
    flags.isMentorTaskMutationsV2Enabled() &&
    flags.isMentorSheetsMutationsV2Enabled() &&
    flags.isMentorMutationIdempotencyV2Enabled()
  );
}

function isWhitelistedForV2(actionType) {
  return V2_CUTOVER_ACTIONS.includes(actionType);
}

// Flag + whitelist gate (no cohort check). Kept for tests/back-compat.
function shouldRouteActionThroughV2(actionType) {
  return isV2TaskMutationActive() && isWhitelistedForV2(actionType);
}

// Phase 9B3 — full route decision: flags + whitelist + cohort allowlist.
// The live route uses THIS. Even with all mutation flags on, a user not on the
// allowlist routes to the legacy path.
function shouldRouteActionThroughV2ForUser(actionType, identity) {
  return shouldRouteActionThroughV2(actionType) && isV2MutationUserAllowed(identity);
}

// Phase 9G1 — dedicated gate for quiz-return COMPLETE (quiz_sync). It does NOT use
// the manual snooze/resume whitelist; manual `complete` stays legacy. Requires all
// three mutation flags + cohort allowlist (fail closed if allowlist empty).
function shouldRouteQuizCompletionThroughV2(identity) {
  return isV2TaskMutationActive() && isV2MutationUserAllowed(identity);
}

module.exports = {
  V2_CUTOVER_ACTIONS,
  isV2TaskMutationActive,
  isWhitelistedForV2,
  shouldRouteActionThroughV2,
  isV2MutationUserAllowed,
  userScopeHashFor,
  shouldRouteActionThroughV2ForUser,
  shouldRouteQuizCompletionThroughV2,
};
