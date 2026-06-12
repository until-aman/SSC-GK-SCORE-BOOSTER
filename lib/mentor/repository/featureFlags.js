// lib/mentor/repository/featureFlags.js — server-only Mentor repository flags (Phase 2 Step 13,14). CommonJS.
//
// These are read from process.env on the SERVER only. There is no client toggle
// and no client-controlled value. Defaults are OFF.
'use strict';

// MENTOR_REPO_V2: when 'true', the new repository adapter MAY serve Mentor reads.
// Default false → existing production read path is unchanged.
function isMentorRepoV2Enabled() {
  return String(process.env.MENTOR_REPO_V2 || '').toLowerCase() === 'true';
}

// MENTOR_REPO_V2_SHADOW: when 'true', run the new adapter alongside the legacy
// path for read-only aggregate comparison. Never changes the user-facing response.
// Default false.
function isMentorRepoShadowEnabled() {
  return String(process.env.MENTOR_REPO_V2_SHADOW || '').toLowerCase() === 'true';
}

// MENTOR_CANONICAL_DAY_READ: when 'true', legacy Mentor reads may include the
// canonical repository day fields in API responses. Default false.
function isMentorCanonicalDayReadEnabled() {
  return String(process.env.MENTOR_CANONICAL_DAY_READ || '').toLowerCase() === 'true';
}

function isMentorTaskStateMachineV2Enabled() {
  return String(process.env.MENTOR_TASK_STATE_MACHINE_V2 || '').toLowerCase() === 'true';
}

function isMentorTaskMutationsV2Enabled() {
  return String(process.env.MENTOR_TASK_MUTATIONS_V2 || '').toLowerCase() === 'true';
}

function isMentorDailyRolloverV2Enabled() {
  return String(process.env.MENTOR_DAILY_ROLLOVER_V2 || '').toLowerCase() === 'true';
}

// Phase 10C — rollover-specific cohort gates, kept SEPARATE from the action-mutation
// allowlist so daily rollover can be piloted independently. `MENTOR_DAILY_ROLLOVER_V2`
// is the master write gate; eligibility is allow-all OR the rollover allowlist.
function getDailyRolloverAllowedUserHashes() {
  return String(process.env.MENTOR_DAILY_ROLLOVER_ALLOWED_USER_HASHES || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}
function isMentorDailyRolloverAllowAllEnabled() {
  return String(process.env.MENTOR_DAILY_ROLLOVER_ALLOW_ALL || '') === 'true'; // exact "true" only
}
// A user is eligible for rollover WRITES only if the master gate is on AND
// (allow-all OR their scope hash is allowlisted). Fail-closed otherwise.
function isMentorDailyRolloverUserAllowed(userScopeHash) {
  if (!isMentorDailyRolloverV2Enabled()) return false;            // master gate off => no writes
  if (isMentorDailyRolloverAllowAllEnabled()) return Boolean(userScopeHash);
  const allowed = getDailyRolloverAllowedUserHashes();
  if (!allowed.length) return false;                              // empty allowlist => fail closed
  return Boolean(userScopeHash) && allowed.includes(String(userScopeHash));
}

function isMentorPendingLifecycleV2Enabled() {
  return String(process.env.MENTOR_PENDING_LIFECYCLE_V2 || '').toLowerCase() === 'true';
}

function isMentorSheetsSchemaV2Enabled() {
  return String(process.env.MENTOR_SHEETS_SCHEMA_V2 || '').toLowerCase() === 'true';
}

function isMentorSheetsMutationsV2Enabled() {
  return String(process.env.MENTOR_SHEETS_MUTATIONS_V2 || '').toLowerCase() === 'true';
}

function isMentorMutationIdempotencyV2Enabled() {
  return String(process.env.MENTOR_MUTATION_IDEMPOTENCY_V2 || '').toLowerCase() === 'true';
}

// Phase 9B3 cohort gate: comma-separated list of allowed user scope hashes
// (e.g. "u_1d929728f3beaa74"). Empty/unset => NO users allowed (fail closed).
function getV2MutationAllowedUserHashes() {
  return String(process.env.MENTOR_V2_MUTATION_ALLOWED_USER_HASHES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Phase 9K global override: when exactly "true", ALL authenticated users route V2
// mutations (allowlist is bypassed). Any other value (unset/blank/false) => false.
function isMentorV2MutationAllowAllEnabled() {
  return String(process.env.MENTOR_V2_MUTATION_ALLOW_ALL || '') === 'true';
}

// A user may run a V2 mutation if:
//   - allow-all is enabled (any authenticated user, i.e. any non-empty scope hash), OR
//   - their scope hash is explicitly allowlisted.
// Fails closed: allow-all off AND empty allowlist => nobody.
function isMentorV2MutationUserAllowed(userScopeHash) {
  if (isMentorV2MutationAllowAllEnabled()) return Boolean(userScopeHash); // authenticated => allowed
  const allowed = getV2MutationAllowedUserHashes();
  if (!allowed.length) return false; // fail closed: no allowlist => no users
  return Boolean(userScopeHash) && allowed.includes(String(userScopeHash));
}

module.exports = {
  isMentorRepoV2Enabled,
  isMentorRepoShadowEnabled,
  isMentorCanonicalDayReadEnabled,
  isMentorTaskStateMachineV2Enabled,
  isMentorTaskMutationsV2Enabled,
  isMentorDailyRolloverV2Enabled,
  isMentorPendingLifecycleV2Enabled,
  isMentorSheetsSchemaV2Enabled,
  isMentorSheetsMutationsV2Enabled,
  isMentorMutationIdempotencyV2Enabled,
  getV2MutationAllowedUserHashes,
  isMentorV2MutationAllowAllEnabled,
  isMentorV2MutationUserAllowed,
  getDailyRolloverAllowedUserHashes,
  isMentorDailyRolloverAllowAllEnabled,
  isMentorDailyRolloverUserAllowed,
};
