// lib/mentor/repository/index.js — Mentor repository factory + entry point (Phase 2 Step 17). CommonJS.
//
// Single factory. Read methods delegate to the pure orchestrator over a data
// source (Sheets today, Supabase later). Write methods are reserved/unimplemented.
// Nothing here runs in production unless a feature flag is enabled by the caller.
'use strict';

const { buildSnapshotFromRawData, notImplementedWrites } = require('./mentorRepository');
const { fetchRawMentorData } = require('./sheetsSource');
const { compareShadow, logShadowComparison } = require('./shadowCompare');
const flags = require('./featureFlags');
const { REPOSITORY_VERSION } = require('../domain/types');

/**
 * Create a Sheets-backed Mentor repository.
 * @param {{ dataSource?: Function }} [opts] inject a raw-data fetcher for tests.
 */
function createSheetsMentorRepository(opts = {}) {
  const fetchRaw = opts.dataSource || fetchRawMentorData;

  async function getMentorSnapshotData(userIdentity) {
    const raw = await fetchRaw(userIdentity);
    return buildSnapshotFromRawData(raw, userIdentity);
  }

  return {
    repositoryVersion: REPOSITORY_VERSION,
    // Reads
    getMentorSnapshotData,
    async getProfile(userIdentity) { return (await getMentorSnapshotData(userIdentity)).profile; },
    async getActivePlan(userIdentity) { return (await getMentorSnapshotData(userIdentity)).activePlan; },
    async getCurrentTasks(userIdentity) { return (await getMentorSnapshotData(userIdentity)).currentTasks; },
    async getHistoricalTasks(userIdentity) { return (await getMentorSnapshotData(userIdentity)).historicalTasks; },
    async getPendingTasks(userIdentity) { return (await getMentorSnapshotData(userIdentity)).canonicalPendingTasks; },
    async getStudentTopicState(userIdentity) { return (await getMentorSnapshotData(userIdentity)).studentTopicState; },
    async validatePlanPointer(userIdentity) {
      const s = await getMentorSnapshotData(userIdentity);
      return { valid: !!s.activePlan, selectedActivePlan: s.activePlan, diagnostics: s.diagnostics };
    },
    // Reserved writes (throw NotImplementedError)
    ...notImplementedWrites(),
  };
}

/**
 * Factory entry point. Returns a repository ONLY when MENTOR_REPO_V2 is enabled,
 * else returns null so callers keep the legacy production path. Tests can force
 * a repository by passing a dataSource.
 */
function getMentorRepository(opts = {}) {
  if (!opts.force && !opts.dataSource && !flags.isMentorRepoV2Enabled() && !flags.isMentorRepoShadowEnabled()) {
    return null; // flag off → no new repository in production
  }
  return createSheetsMentorRepository(opts);
}

/**
 * Read-only shadow comparison (Phase 2 Step 14). Runs the new adapter alongside an
 * already-computed legacy snapshot and logs non-sensitive aggregate diffs. NEVER
 * changes any response, NEVER writes. No-op unless MENTOR_REPO_V2_SHADOW is enabled.
 * Designed to be called fire-and-forget; never throws to the caller.
 * @returns {Promise<Object|null>} comparison object, or null if disabled/unavailable
 */
async function runMentorShadowComparison(userIdentity, legacySnapshot) {
  try {
    if (!flags.isMentorRepoShadowEnabled()) return null;
    const repo = createSheetsMentorRepository();
    const snapshot = await repo.getMentorSnapshotData(userIdentity);
    const cmp = compareShadow(legacySnapshot, snapshot);
    logShadowComparison(cmp);
    return cmp;
  } catch (_) {
    return null; // shadow comparison must never affect the user-facing path
  }
}

module.exports = { getMentorRepository, createSheetsMentorRepository, runMentorShadowComparison };
