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

module.exports = { isMentorRepoV2Enabled, isMentorRepoShadowEnabled };
